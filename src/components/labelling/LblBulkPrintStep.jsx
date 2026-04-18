/**
 * LblBulkPrintStep
 *
 * Manages Rynan printer communication for bulk label printing.
 * Printer is auto-resolved from job.line_id — no manual selection needed.
 *
 * PRINT SEQUENCE: STOP → STAR (load template) → MON (verify) → DATA × quantity
 *
 * PAUSE:  Sends STOP to printer, saves current_printed_qty, sets status = 'paused'
 * RESUME: Calculates remaining = planned - current_printed_qty
 *         Sends STOP → STAR → MON → DATA × remaining to printer
 *
 * COMPLETION (two-phase via usePrinterPollStatus):
 *   Phase 1: Printer reports all labels done → status = 'bulk_printing_awaiting_printer_reset'
 *   Phase 2: Printer reports 0/0 (idle)      → status = 'completed'
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { logLabellingEvent } from '@/lib/labellingEventLogger';
import LblPrintPreviewModal from './LblPrintPreviewModal';
import {
  sendStarCommand,
  postToMiddleware,
  buildHeaders,
  getPrinterBase,
  MIDDLEWARE_ENDPOINTS,
  PRINTER_COMMANDS,
} from '@/lib/rynanPrinterService';
import { usePrinterPollStatus } from '@/hooks/usePrinterPollStatus';
import { toast } from '@/components/ui/use-toast';
import {
  Loader2, Play, Pause, RotateCcw, Printer, AlertTriangle, CheckCircle2, Clock
} from 'lucide-react';

export default function LblBulkPrintStep({ job, user, onComplete, mode }) {
  const [acting, setActing]               = useState(false);
  const [sendingPrint, setSendingPrint]   = useState(false);
  const [showResumePreview, setShowResumePreview] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(job.printer_template_id || null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const queryClient                       = useQueryClient();

  // ── All available templates ──
  const { data: availableTemplates = [] } = useQuery({
    queryKey: ['lbl-print-templates-all'],
    queryFn:  () => base44.entities.LblPrintTemplate.filter({ is_active: true }),
  });

  // ── Active printers — auto-resolve by line_id ──
  const { data: printers = [], isLoading: printersLoading } = useQuery({
    queryKey: ['lbl-printers-active'],
    queryFn:  () => base44.entities.LblPrinterConfig.filter({ is_active: true }),
  });

  const selectedPrinter = printers.find(p => p.line_id === job.line_id) || null;
  const noLinePrinter   = printers.length > 0 && !selectedPrinter;

  // ── Demo print commands — to extract POD values only ──
  const { data: demoCommands = [], isLoading: demoLoading } = useQuery({
    queryKey: ['demo-commands-job', job.id],
    queryFn:  () => base44.entities.LblPrintCommand.filter({ job_id: job.id, command_type: 'demo' }),
    enabled:  !!job.id,
  });

  // Extract POD values from the DATA demo command
  const dataCommand   = demoCommands.find(c => c.request_payload?.command?.command === 'DATA')
    || demoCommands.find(c => c.request_payload?.command?.data)
    || demoCommands[0]
    || null;
  const sentPodValues = dataCommand?.request_payload?.command?.data || {};

  // ── Job's print template — sourced directly from selectedTemplateId ──
  const { data: jobTemplate, isLoading: templateLoading } = useQuery({
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
    
    // If job doesn't have a printer_template_id, save it now
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

  const templateName     = jobTemplate?.middleware_template_name || '';
  const templateResolved = !templateLoading;

  // ── Real-time printer polling ──
  // Poll when actively printing OR awaiting the final printer idle reset
  const shouldPoll =
    job.status === 'bulk_printing' ||
    job.status === 'bulk_printing_awaiting_printer_reset';

  const { livePrintedCount } = usePrinterPollStatus(job, selectedPrinter, shouldPoll, 200);

  const planned    = job.quantity_bottles_planned || 0;
  // Use livePrintedCount from hook for instant UI updates (no DB round-trip)
  // Fall back to job.current_printed_qty when not polling (paused / idle)
  const printedQty = shouldPoll ? livePrintedCount : (job.current_printed_qty || 0);
  const remaining  = Math.max(0, planned - printedQty);
  const progress   = planned ? Math.min(100, (printedQty / planned) * 100) : 0;

  // ──────────────────────────────────────────────────────────────────────
  // START BULK PRINT
  // Sends: STOP → STAR → MON → DATA × (planned - already_printed)
  // ──────────────────────────────────────────────────────────────────────
  const handleStartBulkPrint = async () => {
    if (!selectedPrinter) {
      toast({
        title: 'No printer assigned to this line',
        description: `Assign a printer to ${job.line_name || job.line_id} in Printer Settings.`,
        variant: 'destructive',
      });
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

    const alreadyPrinted = job.current_printed_qty || 0;
    const toPrint        = planned - alreadyPrinted;

    if (toPrint <= 0) {
      toast({ title: 'All labels already printed', description: 'This job has already been fully printed.' });
      setSendingPrint(false);
      return;
    }

    const result = await sendStarCommand(
      selectedPrinter,
      templateName,
      toPrint,
      { jobId: job.id, commandType: 'bulk_start', user, podValues: sentPodValues }
    );

    if (!result.success) {
      toast({
        title: result.templateNotOnPrinter ? 'Template Not Found on Printer' : 'Bulk Print Failed',
        description: result.templateNotOnPrinter
          ? `Template "${templateName}" is not loaded on the printer. Load it first then retry.`
          : result.errorMessage || 'Middleware returned an error.',
        variant: 'destructive',
        duration: 8000,
      });
      await logLabellingEvent({
        action_type:  'printer_command_failed',
        job_id:       job.id,
        plan_id:      job.plan_id,
        description:  `Bulk print failed: ${result.errorMessage}`,
        user,
      });
      setSendingPrint(false);
      return;
    }

    // All DATA commands sent — set to bulk_printing so RQLP polling starts
    await base44.entities.LabellingJob.update(job.id, {
      status:              'bulk_printing',
      current_printed_qty: alreadyPrinted, // don't pre-fill — let RQLP track actual count
    });
    await logLabellingEvent({
      action_type:  'bulk_print_started',
      job_id:       job.id,
      plan_id:      job.plan_id,
      description:  `Bulk print started — ${toPrint.toLocaleString()} DATA commands sent to ${selectedPrinter.name} using template "${templateName}". Label data: ${JSON.stringify(sentPodValues)}`,
      user,
    });

    toast({
      title: 'Bulk Print Started',
      description: `${toPrint.toLocaleString()} label commands sent to printer. Monitoring progress…`,
    });
    queryClient.invalidateQueries({ queryKey: ['labelling-job', job.id] });
    onComplete?.();
    setSendingPrint(false);
  };

  // ──────────────────────────────────────────────────────────────────────
  // PAUSE PRINTING
  // Sends STOP to clear printer buffer, saves current_printed_qty from
  // last RQLP reading, sets job status to 'paused'
  // ──────────────────────────────────────────────────────────────────────
  const handlePausePrinting = async () => {
    if (!selectedPrinter) {
      toast({ title: 'No printer found for this line', variant: 'destructive' });
      return;
    }
    setActing(true);

    // Send STOP to clear any remaining queued labels on the printer
    const stopPayload = {
      printer_id: selectedPrinter.printer_id,
      printer:    { ip: selectedPrinter.ip_address, port: selectedPrinter.port },
      command:    { command: PRINTER_COMMANDS.STOP },
    };
    const base    = getPrinterBase(selectedPrinter);
    const headers = buildHeaders(selectedPrinter);

    const { error: transportError, body } = await postToMiddleware(
      `${base}${MIDDLEWARE_ENDPOINTS.PRINT}`,
      stopPayload,
      headers,
      selectedPrinter.request_timeout_ms || 15000
    );

    if (transportError && !body) {
      toast({ title: 'Failed to Pause Printer', description: transportError, variant: 'destructive' });
      setActing(false);
      return;
    }

    // Save the exact live printed count to the database
    await base44.entities.LabellingJob.update(job.id, {
      status: 'paused',
      current_printed_qty: printedQty,
    });
    await logLabellingEvent({
      action_type:  'bulk_print_stopped',
      job_id:       job.id,
      plan_id:      job.plan_id,
      description:  `Bulk print paused at ${printedQty.toLocaleString()} labels printed (of ${planned.toLocaleString()} target). ${remaining.toLocaleString()} labels remaining.`,
      user,
    });

    toast({
      title: 'Printing Paused',
      description: `Paused at ${printedQty.toLocaleString()} labels. ${remaining.toLocaleString()} remaining when resumed.`,
    });
    await queryClient.refetchQueries({ queryKey: ['labelling-job', job.id] });
    onComplete?.();
    setActing(false);
  };

  // ──────────────────────────────────────────────────────────────────────
  // RESUME PRINTING
  // Calculates remaining = planned - current_printed_qty
  // Sends: STOP → STAR (reload template) → MON (verify) → DATA × remaining
  // ──────────────────────────────────────────────────────────────────────
  const handleResumePrinting = async (podValues) => {
    if (!selectedPrinter) {
      toast({ title: 'No printer found for this line', variant: 'destructive' });
      return;
    }
    if (!templateName) {
      toast({ title: 'No print template assigned', variant: 'destructive' });
      return;
    }

    const currentPrinted = job.current_printed_qty || 0;
    const toResume       = planned - currentPrinted;

    if (toResume <= 0) {
      toast({ title: 'All labels already printed', description: 'Nothing remaining to resume.' });
      return;
    }

    setShowResumePreview(false);
    setActing(true);

    toast({
      title: 'Resuming Print…',
      description: `Sending ${toResume.toLocaleString()} remaining labels to printer. Please wait.`,
    });

    // sendStarCommand internally handles: STOP → STAR → MON → DATA × toResume
    const result = await sendStarCommand(
      selectedPrinter,
      templateName,
      toResume,
      { jobId: job.id, commandType: 'bulk_resume', user, podValues: podValues || sentPodValues }
    );

    if (!result.success) {
      toast({
        title:       'Resume Failed',
        description: result.templateNotOnPrinter
          ? `Template "${templateName}" not found on printer. Load it first and retry.`
          : result.errorMessage || 'Could not resume printing.',
        variant: 'destructive',
      });
      await logLabellingEvent({
        action_type:  'printer_command_failed',
        job_id:       job.id,
        plan_id:      job.plan_id,
        description:  `Resume failed: ${result.errorMessage}`,
        user,
      });
      setActing(false);
      return;
    }

    // Resume successful — set back to bulk_printing so RQLP polling restarts
    await base44.entities.LabellingJob.update(job.id, { status: 'bulk_printing' });
    await logLabellingEvent({
      action_type:  'bulk_print_resumed',
      job_id:       job.id,
      plan_id:      job.plan_id,
      description:  `Bulk print resumed. Sent ${toResume.toLocaleString()} remaining label commands to ${selectedPrinter.name} (already printed: ${currentPrinted.toLocaleString()}, target: ${planned.toLocaleString()}).`,
      user,
    });

    toast({
      title:       'Printing Resumed',
      description: `${toResume.toLocaleString()} label commands sent. Monitoring progress…`,
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
        Assign a printer to this line in Printer Settings.
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
        <p className="text-xs text-indigo-600">Auto-selected from {job.line_name || job.line_id}</p>
      </div>
    </div>
  ) : null;

  // ──────────────────────────────────────────────────────────────────────
  // START MODE — before bulk printing begins
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
            No label data (POD) found from demo print. Labels may print with empty fields. Confirm before proceeding.
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
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending {planned.toLocaleString()} labels to printer…</>
            : <><Play className="w-4 h-4" /> Start Bulk Print</>
          }
        </Button>

        {sendingPrint && (
          <p className="text-xs text-center text-slate-500">
            Sending {planned.toLocaleString()} DATA commands to the printer — this may take a while. Do not close this page.
          </p>
        )}
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  // CONTROL MODE — once bulk_printing is active
  // ──────────────────────────────────────────────────────────────────────

  const isAwaitingReset = job.status === 'bulk_printing_awaiting_printer_reset';
  const isPaused        = job.status === 'paused';
  const isPrinting      = job.status === 'bulk_printing';

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
      <h2 className="text-base font-semibold text-slate-900">Bulk Print Control</h2>

      {/* Template Selection (if missing) */}
      {!selectedTemplateId && availableTemplates.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-amber-900">⚠ Print Template Required</p>
          <p className="text-sm text-amber-700">Select a print template to proceed:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {availableTemplates.map(template => (
              <button
                key={template.id}
                onClick={() => handleSelectTemplate(template.id)}
                disabled={savingTemplate}
                className="h-11 px-3 py-2 text-left border border-amber-300 rounded-lg hover:bg-amber-100 active:bg-amber-200 disabled:opacity-50 transition-colors text-sm font-medium text-amber-900"
              >
                {savingTemplate ? '...' : `${template.name} [${template.middleware_template_name}]`}
              </button>
            ))}
          </div>
        </div>
      )}

      <NoPrinterWarning />
      <PrinterBadge />

      {/* Progress section */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Progress</span>
          <span className="font-medium text-slate-900">{progress.toFixed(1)}%</span>
        </div>
        <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isAwaitingReset ? 'bg-green-500 animate-pulse' :
              isPaused        ? 'bg-orange-500' :
              'bg-indigo-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Counters */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-slate-50 rounded-lg p-2">
            <p className="text-xs text-slate-500">Target</p>
            <p className="text-lg font-bold text-slate-900">{planned.toLocaleString()}</p>
          </div>
          <div className="bg-indigo-50 rounded-lg p-2">
            <p className="text-xs text-indigo-500">Printed</p>
            <p className="text-lg font-bold text-indigo-700">{printedQty.toLocaleString()}</p>
          </div>
          <div className={`rounded-lg p-2 ${isPaused ? 'bg-orange-50' : 'bg-slate-50'}`}>
            <p className={`text-xs ${isPaused ? 'text-orange-500' : 'text-slate-500'}`}>Remaining</p>
            <p className={`text-lg font-bold ${isPaused ? 'text-orange-700' : 'text-slate-900'}`}>
              {remaining.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Status banners */}
      {isAwaitingReset && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800">All labels sent — Waiting for printer to finish</p>
            <p className="text-xs text-green-700">All {planned.toLocaleString()} labels have been sent. Monitoring printer for physical completion…</p>
          </div>
        </div>
      )}

      {isPaused && (
        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg p-3">
          <Pause className="w-4 h-4 text-orange-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-orange-800">Printing Paused</p>
            <p className="text-xs text-orange-700">
              {printedQty.toLocaleString()} labels printed. {remaining.toLocaleString()} labels will be sent when you resume.
            </p>
          </div>
        </div>
      )}

      {isPrinting && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
          <Clock className="w-4 h-4 shrink-0 animate-pulse" />
          Print count is automatically updated every 200ms via RQLP status from the printer.
        </div>
      )}

      {/* Action buttons */}
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
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending {remaining.toLocaleString()} labels…</>
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

      {/* Resume Preview Modal — same confirm flow as demo print */}
      <LblPrintPreviewModal
        open={showResumePreview}
        onOpenChange={setShowResumePreview}
        podValues={sentPodValues}
        printerName={selectedPrinter?.name}
        templateName={templateName}
        quantity={remaining}
        title="Confirm Resume Print"
        onConfirm={(podValues) => handleResumePrinting(podValues)}
        isLoading={acting}
      />
    </div>
  );
}