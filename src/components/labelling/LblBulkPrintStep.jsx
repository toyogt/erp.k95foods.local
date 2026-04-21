/**
 * LblBulkPrintStep
 *
 * NON-BLOCKING BULK PRINT DASHBOARD
 * ─────────────────────────────────
 * • Start / Resume → single backend call, UI transitions to "bulk_printing" INSTANTLY
 *   The backend runs STOP → STAR → MON → DATA × N server-side (no browser blocking).
 * • Live counters (Total / Printed / Remaining / %) update every 200 ms via RQLP poll.
 * • DB milestone writes every 100 bottles — UI never waits for DB.
 *
 * PRINT SEQUENCE (backend): STOP → STAR → MON → DATA × quantity
 * PAUSE:  STOP → save current_printed_qty → status = 'paused'
 * RESUME: backend recalculates remaining → STOP → STAR → MON → DATA × remaining
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { logLabellingEvent } from '@/lib/labellingEventLogger';
import LblPrintPreviewModal from './LblPrintPreviewModal';
import {
  postToMiddleware,
  buildHeaders,
  getPrinterBase,
  MIDDLEWARE_ENDPOINTS,
  PRINTER_COMMANDS,
} from '@/lib/rynanPrinterService';
import { usePrinterPollStatus } from '@/hooks/usePrinterPollStatus';
import { toast } from '@/components/ui/use-toast';
import {
  Loader2, Pause, RotateCcw, Printer, AlertTriangle,
  CheckCircle2, Clock, Zap
} from 'lucide-react';
import LblPrintLiveCounters from './LblPrintLiveCounters';


export default function LblBulkPrintStep({ job, user, onComplete, mode }) {
  const [acting, setActing]               = useState(false);
  const [sendingPrint, setSendingPrint]   = useState(false);
  const [showResumePreview, setShowResumePreview] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(job.printer_template_id || null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const queryClient = useQueryClient();

  // ── All available templates ──
  const { data: availableTemplates = [] } = useQuery({
    queryKey: ['lbl-print-templates-all'],
    queryFn:  () => base44.entities.LblPrintTemplate.filter({ is_active: true }),
  });

  // ── Printers — auto-resolve by line_id ──
  const { data: printers = [], isLoading: printersLoading } = useQuery({
    queryKey: ['lbl-printers-active'],
    queryFn:  () => base44.entities.LblPrinterConfig.filter({ is_active: true }),
  });

  const selectedPrinter = printers.find(p => p.line_id === job.line_id) || null;
  const noLinePrinter   = printers.length > 0 && !selectedPrinter;

  // ── Demo print commands for POD values ──
  const { data: demoCommands = [] } = useQuery({
    queryKey: ['demo-commands-job', job.id],
    queryFn:  () => base44.entities.LblPrintCommand.filter({ job_id: job.id, command_type: 'demo' }),
    enabled:  !!job.id,
  });

  const dataCommand   = demoCommands.find(c => c.request_payload?.command?.command === 'DATA')
    || demoCommands.find(c => c.request_payload?.command?.data)
    || demoCommands[0] || null;
  const sentPodValues = dataCommand?.request_payload?.command?.data || {};

  // ── Job template ──
  const { data: jobTemplate } = useQuery({
    queryKey: ['lbl-job-print-template', selectedTemplateId],
    queryFn:  async () => {
      if (!selectedTemplateId) return null;
      return availableTemplates.find(t => t.id === selectedTemplateId) || null;
    },
    enabled: !!selectedTemplateId && availableTemplates.length > 0,
  });

  const handleSelectTemplate = async (templateId) => {
    if (!templateId) return;
    setSelectedTemplateId(templateId);
    if (!job.printer_template_id) {
      setSavingTemplate(true);
      try {
        await base44.entities.LabellingJob.update(job.id, { printer_template_id: templateId });
      } catch (error) {
        toast({ title: 'Failed to Save Template', description: error.message, variant: 'destructive' });
        setSelectedTemplateId(null);
      } finally {
        setSavingTemplate(false);
      }
    }
  };

  const templateName = jobTemplate?.middleware_template_name || '';

  // ── Real-time printer polling ──
  const shouldPoll = job.status === 'bulk_printing' || job.status === 'bulk_printing_awaiting_printer_reset';
  const { livePrintedCount } = usePrinterPollStatus(job, selectedPrinter, shouldPoll, 200);

  const planned    = job.quantity_bottles_planned || 0;
  const printedQty = shouldPoll ? livePrintedCount : (job.current_printed_qty || 0);
  const remaining  = Math.max(0, planned - printedQty);
  const progress   = planned ? Math.min(100, (printedQty / planned) * 100) : 0;
  const printRate  = 0; // Could be derived from delta tracking if needed

  // ── Status flags ──
  const isAwaitingReset = job.status === 'bulk_printing_awaiting_printer_reset';
  const isPaused        = job.status === 'paused';
  const isPrinting      = job.status === 'bulk_printing';

  // ──────────────────────────────────────────────────────────────────────
  // START BULK PRINT — fully non-blocking
  // 1. Call backend (STOP → STAR → MON only — returns immediately)
  // 2. Backend sets job status = 'bulk_printing' before returning
  // 3. Frontend receives response, shows dashboard instantly
  // 4. DATA commands continue in background via EdgeRuntime.waitUntil
  // 5. Polling starts automatically via usePrinterPollStatus
  // ──────────────────────────────────────────────────────────────────────
  const handleStartBulkPrint = async () => {
    if (!selectedPrinter) {
      toast({ title: 'No printer assigned to this line', variant: 'destructive' });
      return;
    }
    if (!templateName) {
      toast({ title: 'No print template assigned to this job', variant: 'destructive' });
      return;
    }
    if (planned <= 0) {
      toast({ title: 'Invalid quantity — cannot start bulk print', variant: 'destructive' });
      return;
    }

    setSendingPrint(true);
    toast({
      title: '⚡ Connecting to Printer…',
      description: `Loading template "${templateName}" and initialising print sequence.`,
    });

    let result = null;
    try {
      const response = await base44.functions.invoke('triggerBulkPrintJob', {
        job_id:       job.id,
        command_type: 'bulk_start',
      });
      result = response?.data;
    } catch (err) {
      // Extract error detail from Axios error response body if available
      result = err?.response?.data || { success: false, error: err?.message || 'Bulk print failed — check printer connection.' };
    }

    if (!result?.success) {
      const errMsg = result?.error || 'Bulk print failed — check printer connection.';
      toast({
        title: result?.templateNotOnPrinter ? 'Template Not Found on Printer' : 'Bulk Print Failed',
        description: result?.templateNotOnPrinter
          ? `Template "${templateName}" is not loaded. Load it on the printer first.`
          : errMsg,
        variant: 'destructive',
        duration: 8000,
      });
      setSendingPrint(false);
      return;
    }

    // ── SUCCESS: backend has set status = 'bulk_printing' and returned ────────
    // DATA commands are now streaming to the printer in the background.
    // Show the live dashboard immediately — polling starts via usePrinterPollStatus.
    toast({
      title: '✅ Printing Started',
      description: `${result.toPrint?.toLocaleString()} label commands dispatching in background. Live counter updating every 200 ms.`,
    });

    // Refetch job to pick up status = 'bulk_printing' and show dashboard
    await queryClient.refetchQueries({ queryKey: ['labelling-job', job.id] });
    onComplete?.();
    setSendingPrint(false);
  };

  // ──────────────────────────────────────────────────────────────────────
  // PAUSE PRINTING
  // ──────────────────────────────────────────────────────────────────────
  const handlePausePrinting = async () => {
    if (!selectedPrinter) return;
    setActing(true);

    const stopPayload = {
      printer_id: selectedPrinter.printer_id,
      printer:    { ip: selectedPrinter.ip_address, port: selectedPrinter.port },
      command:    { command: PRINTER_COMMANDS.STOP },
    };
    const base    = getPrinterBase(selectedPrinter);
    const headers = buildHeaders(selectedPrinter);

    await postToMiddleware(
      `${base}${MIDDLEWARE_ENDPOINTS.PRINT}`, stopPayload, headers,
      selectedPrinter.request_timeout_ms || 15000
    );

    await base44.entities.LabellingJob.update(job.id, {
      status: 'paused',
      current_printed_qty: printedQty,
    });
    await logLabellingEvent({
      action_type:  'bulk_print_stopped',
      job_id:       job.id,
      plan_id:      job.plan_id,
      description:  `Bulk print paused at ${printedQty.toLocaleString()} of ${planned.toLocaleString()} labels.`,
      user,
    });

    toast({
      title: 'Printing Paused',
      description: `Saved at ${printedQty.toLocaleString()} labels. ${remaining.toLocaleString()} remaining.`,
    });
    await queryClient.refetchQueries({ queryKey: ['labelling-job', job.id] });
    onComplete?.();
    setActing(false);
  };

  // ──────────────────────────────────────────────────────────────────────
  // RESUME PRINTING — non-blocking
  // ──────────────────────────────────────────────────────────────────────
  const handleResumePrinting = async () => {
    if (!selectedPrinter || !templateName) return;

    setShowResumePreview(false);
    setActing(true);

    toast({
      title: '⚡ Resuming Print…',
      description: `Sending ${remaining.toLocaleString()} remaining labels to printer in background.`,
    });

    let result = null;
    try {
      const response = await base44.functions.invoke('triggerBulkPrintJob', {
        job_id:       job.id,
        command_type: 'bulk_resume',
      });
      result = response?.data;
    } catch (err) {
      result = err?.response?.data || { success: false, error: err?.message || 'Could not resume printing.' };
    }

    if (!result?.success) {
      toast({
        title:       'Resume Failed',
        description: result?.templateNotOnPrinter
          ? `Template "${templateName}" not found on printer.`
          : (result?.error || 'Could not resume printing.'),
        variant: 'destructive',
      });
      setActing(false);
      return;
    }

    toast({
      title:       '✅ Printing Resumed',
      description: `${result.toPrint?.toLocaleString()} label commands dispatching in background. Live counter updating every 200 ms.`,
    });
    await queryClient.refetchQueries({ queryKey: ['labelling-job', job.id] });
    onComplete?.();
    setActing(false);
  };

  // ── Shared sub-components ──
  const NoPrinterWarning = () => noLinePrinter ? (
    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
      <p className="text-sm text-amber-700">
        No printer assigned to <strong>{job.line_name || job.line_id}</strong>.
        Assign one in Printer Settings.
      </p>
    </div>
  ) : null;

  const PrinterBadge = () => selectedPrinter ? (
    <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
      <Printer className="w-4 h-4 text-indigo-600 shrink-0" />
      <div>
        <p className="text-sm font-medium text-indigo-800">
          {selectedPrinter.name}{' '}
          <span className="font-normal text-indigo-600">({selectedPrinter.printer_id})</span>
        </p>
        <p className="text-xs text-indigo-500">Auto-selected from {job.line_name || job.line_id}</p>
      </div>
    </div>
  ) : null;

  // ──────────────────────────────────────────────────────────────────────
  // START MODE
  // ──────────────────────────────────────────────────────────────────────
  if (mode === 'start') {
    const noPodValues = Object.keys(sentPodValues).length === 0;
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Printer className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-semibold text-slate-900">Ready for Bulk Printing</h2>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
          Demo print approved! You can now start bulk label printing.
        </div>

        {/* Summary card */}
        <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
          <p><span className="font-medium">Target:</span> {planned.toLocaleString()} labels</p>
          <p><span className="font-medium">Product:</span> {job.product_name}</p>
          <p><span className="font-medium">Template:</span>{' '}
            <span className="font-mono text-indigo-700">{templateName || '—'}</span>
          </p>
          {Object.keys(sentPodValues).length > 0 && (
            <p className="text-slate-600">
              <span className="font-medium">Label Data:</span>{' '}
              {Object.entries(sentPodValues).map(([k, v]) => `${k}: ${v}`).join(' | ')}
            </p>
          )}
        </div>

        {noPodValues && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            No label data (POD) found. Labels may print with empty fields. Confirm before proceeding.
          </div>
        )}

        <NoPrinterWarning />
        <PrinterBadge />

        <Button
          className="h-11 w-full gap-2 bg-indigo-600 hover:bg-indigo-700"
          onClick={handleStartBulkPrint}
          disabled={sendingPrint || !selectedPrinter || !templateName}
        >
          {sendingPrint
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Initialising Printer…</>
            : <><Zap className="w-4 h-4" /> Start Bulk Print ({planned.toLocaleString()} labels)</>
          }
        </Button>

        {sendingPrint && (
          <p className="text-xs text-center text-slate-500 animate-pulse">
            Running STOP → STAR → MON on printer… Dashboard will appear immediately after template is confirmed.
          </p>
        )}
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  // CONTROL MODE — live dashboard while bulk_printing / paused / awaiting reset
  // ──────────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">

      {/* Title + live indicator */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Bulk Print Dashboard</h2>
        {isPrinting && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Live — updating every 200 ms
          </div>
        )}
      </div>

      {/* Template selector if missing */}
      {!selectedTemplateId && availableTemplates.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-amber-900">⚠ Print Template Required</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {availableTemplates.map(t => (
              <button
                key={t.id}
                onClick={() => handleSelectTemplate(t.id)}
                disabled={savingTemplate}
                className="h-11 px-3 py-2 text-left border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors text-sm font-medium text-amber-900 disabled:opacity-50"
              >
                {savingTemplate ? '…' : `${t.name} [${t.middleware_template_name}]`}
              </button>
            ))}
          </div>
        </div>
      )}

      <NoPrinterWarning />
      <PrinterBadge />

      {/* ── Live Counters + Progress bar (sub-component) ── */}
      <LblPrintLiveCounters
        planned={planned}
        printedQty={printedQty}
        remaining={remaining}
        progress={progress}
        isPrinting={isPrinting}
        isPaused={isPaused}
        isAwaitingReset={isAwaitingReset}
      />

      {/* ── Status banners ── */}
      {isAwaitingReset && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800">All {planned.toLocaleString()} labels sent — waiting for printer to finish</p>
            <p className="text-xs text-green-600">Job will auto-complete once printer reports idle.</p>
          </div>
        </div>
      )}

      {isPaused && (
        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg p-3">
          <Pause className="w-4 h-4 text-orange-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-orange-800">Printing Paused</p>
            <p className="text-xs text-orange-600">
              {printedQty.toLocaleString()} printed. {remaining.toLocaleString()} labels will be sent when you resume.
            </p>
          </div>
        </div>
      )}

      {isPrinting && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
          <Clock className="w-4 h-4 shrink-0 animate-pulse" />
          <span>Printer is actively printing. Count updates every 200 ms via live RQLP status.</span>
        </div>
      )}

      {/* ── Action buttons ── */}
      <div className="flex flex-col md:flex-row gap-3">
        {isPrinting && (
          <Button
            variant="outline"
            className="h-11 flex-1 gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
            onClick={handlePausePrinting}
            disabled={acting || !selectedPrinter}
          >
            {acting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Pause className="w-4 h-4" />
            }
            Pause Printing
          </Button>
        )}

        {isPaused && (
          <Button
            className="h-11 flex-1 gap-2 bg-indigo-600 hover:bg-indigo-700"
            onClick={() => setShowResumePreview(true)}
            disabled={acting || !selectedTemplateId || !selectedPrinter || remaining <= 0 || !templateName}
          >
            {acting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Resuming…</>
              : <><RotateCcw className="w-4 h-4" /> Resume Printing ({remaining.toLocaleString()} remaining)</>
            }
          </Button>
        )}

        {isAwaitingReset && (
          <div className="h-11 flex-1 flex items-center justify-center gap-2 bg-green-50 border border-green-200 rounded-lg text-sm font-medium text-green-700">
            <Loader2 className="w-4 h-4 animate-spin" />
            Awaiting printer completion…
          </div>
        )}
      </div>

      {/* Resume Preview Modal */}
      <LblPrintPreviewModal
        open={showResumePreview}
        onOpenChange={setShowResumePreview}
        podValues={sentPodValues}
        printerName={selectedPrinter?.name}
        templateName={templateName}
        quantity={remaining}
        title="Confirm Resume Print"
        onConfirm={() => handleResumePrinting()}
        isLoading={acting}
      />
    </div>
  );
}