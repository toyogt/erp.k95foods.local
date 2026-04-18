/**
 * LblBulkPrintStep
 *
 * Wires up actual Rynan printer communication for bulk printing.
 * Printer is auto-resolved from job.line_id — no manual selection needed.
 *
 *   STOP → STAR (load template) → MON (verify) → DATA × quantity_bottles_planned
 *
 * POD values are re-used from the approved demo DATA command (same label data).
 */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { logLabellingEvent } from '@/lib/labellingEventLogger';
import { sendStarCommand, postToMiddleware, buildHeaders, getPrinterBase, MIDDLEWARE_ENDPOINTS, PRINTER_COMMANDS } from '@/lib/rynanPrinterService';
import { usePrinterPollStatus } from '@/hooks/usePrinterPollStatus';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Play, Pause, RotateCcw, Printer, AlertTriangle } from 'lucide-react';

export default function LblBulkPrintStep({ job, user, onComplete, mode }) {
  const [acting, setActing]           = useState(false);
  const [sendingPrint, setSendingPrint] = useState(false);

  // All active printers — auto-resolve by line_id
  const { data: printers = [] } = useQuery({
    queryKey: ['lbl-printers-active'],
    queryFn:  () => base44.entities.LblPrinterConfig.filter({ is_active: true }),
  });

  // Auto-resolve printer from job's line_id
  const selectedPrinter = printers.find(p => p.line_id === job.line_id) || null;
  const noLinePrinter = printers.length > 0 && !selectedPrinter;

  // All demo print commands for this job — to find the DATA command with POD values
  const { data: demoCommands = [] } = useQuery({
    queryKey: ['demo-commands-job', job.id],
    queryFn:  () => base44.entities.LblPrintCommand.filter({ job_id: job.id, command_type: 'demo' }),
    enabled:  !!job.id,
  });

  // Job's print template
  const { data: jobTemplate } = useQuery({
    queryKey: ['lbl-job-print-template', job.printer_template_id],
    queryFn:  async () => {
      if (!job.printer_template_id) return null;
      const templates = await base44.entities.LblPrintTemplate.filter({ is_active: true });
      return templates.find(t => t.id === job.printer_template_id) || null;
    },
    enabled: !!job.printer_template_id,
  });

  // Extract POD values from the approved DATA command (same values used for demo)
  const dataCommand = demoCommands.find(c => c.request_payload?.command?.command === 'DATA')
    || demoCommands.find(c => c.request_payload?.command?.data)
    || demoCommands[0]
    || null;
  const sentPodValues = dataCommand?.request_payload?.command?.data || {};
  const templateName  = jobTemplate?.middleware_template_name || '';

  const printedQty = job.current_printed_qty || 0;
  const remaining  = (job.quantity_bottles_planned || 0) - printedQty;
  const progress   = job.quantity_bottles_planned
    ? Math.min(100, (printedQty / job.quantity_bottles_planned) * 100)
    : 0;

  // Real-time printer polling — automatically updates printed count
  const shouldPoll = job.status === 'bulk_printing' || job.status === 'paused';
  usePrinterPollStatus(job, selectedPrinter, shouldPoll, 500);

  // ── Start bulk print ──
  const handleStartBulkPrint = async () => {
    if (!selectedPrinter) {
      toast({ title: 'No printer assigned to this line', description: `Assign a printer to ${job.line_name || job.line_id} in Printer Settings.`, variant: 'destructive' });
      return;
    }
    if (!templateName) {
      toast({ title: 'No print template assigned to this job', variant: 'destructive' });
      return;
    }

    const qty = job.quantity_bottles_planned || 0;
    if (qty <= 0) {
      toast({ title: 'Invalid quantity — cannot start bulk print', variant: 'destructive' });
      return;
    }

    setSendingPrint(true);

    const alreadyPrinted = job.current_printed_qty || 0;
    const toPrint = qty - alreadyPrinted;

    if (toPrint <= 0) {
      toast({ title: 'All bottles already printed', description: 'This job is complete or has been fully printed.' });
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
      await logLabellingEvent({ action_type: 'printer_command_failed', job_id: job.id, plan_id: job.plan_id, description: `Bulk print failed: ${result.errorMessage}`, user });
      setSendingPrint(false);
      return;
    }

    const newPrintedQty = alreadyPrinted + result.sentCount;
    await base44.entities.LabellingJob.update(job.id, {
      status: newPrintedQty >= qty ? 'completed' : 'bulk_printing',
      current_printed_qty: newPrintedQty,
    });
    await logLabellingEvent({ action_type: 'bulk_print_started', job_id: job.id, plan_id: job.plan_id, description: `Bulk print started — ${result.sentCount} of ${qty} labels sent to ${selectedPrinter.name} using template "${templateName}".`, user });

    toast({ title: 'Bulk Print Started', description: `${result.sentCount.toLocaleString()} labels sent to printer successfully.` });
    onComplete?.();
    setSendingPrint(false);
  };

  // ── Stop printing ──
  const handleStopPrinting = async () => {
    if (!selectedPrinter) { toast({ title: 'No printer found for this line', variant: 'destructive' }); return; }
    setActing(true);

    const stopPayload = {
      printer_id: selectedPrinter.printer_id,
      printer: { ip: selectedPrinter.ip_address, port: selectedPrinter.port },
      command: { command: PRINTER_COMMANDS.STOP },
    };
    const base = getPrinterBase(selectedPrinter);
    const headers = buildHeaders(selectedPrinter);
    const { error: transportError, body } = await postToMiddleware(`${base}${MIDDLEWARE_ENDPOINTS.PRINT}`, stopPayload, headers, selectedPrinter.request_timeout_ms || 15000);

    if (transportError && !body) {
      toast({ title: 'Failed to Stop Printer', description: transportError, variant: 'destructive' });
      setActing(false);
      return;
    }

    await base44.entities.LabellingJob.update(job.id, { status: 'paused' });
    await logLabellingEvent({ action_type: 'bulk_print_stopped', job_id: job.id, plan_id: job.plan_id, description: `Bulk print stopped at ${printedQty} bottles (of ${job.quantity_bottles_planned} target).`, user });
    toast({ title: 'Printing Stopped', description: 'Printer queue cleared. Ready to resume.' });
    onComplete?.();
    setActing(false);
  };

  // ── Resume printing ──
  const handleResumePrinting = async () => {
    if (!selectedPrinter) { toast({ title: 'No printer found for this line', variant: 'destructive' }); return; }
    if (!templateName) { toast({ title: 'No print template assigned', variant: 'destructive' }); return; }

    setActing(true);
    const qty = job.quantity_bottles_planned || 0;
    const toPrint = qty - printedQty;

    if (toPrint <= 0) { toast({ title: 'All bottles already printed' }); setActing(false); return; }

    const result = await sendStarCommand(selectedPrinter, templateName, toPrint, { jobId: job.id, commandType: 'bulk_resume', user, podValues: sentPodValues });

    if (!result.success) {
      toast({ title: 'Resume Failed', description: result.errorMessage || 'Could not resume printing', variant: 'destructive' });
      setActing(false);
      return;
    }

    await base44.entities.LabellingJob.update(job.id, { status: 'bulk_printing' });
    await logLabellingEvent({ action_type: 'bulk_print_resumed', job_id: job.id, plan_id: job.plan_id, description: `Bulk print resumed. Sending ${toPrint} more labels to ${selectedPrinter.name}.`, user });
    toast({ title: 'Printing Resumed', description: `${toPrint} labels queued to printer.` });
    onComplete?.();
    setActing(false);
  };

  // ── No printer warning (shared) ──
  const NoPrinterWarning = () => noLinePrinter ? (
    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
      <p className="text-sm text-amber-700">No printer assigned to <strong>{job.line_name || job.line_id}</strong>. Assign a printer to this line in Printer Settings.</p>
    </div>
  ) : null;

  // ── Printer info badge (shared) ──
  const PrinterBadge = () => selectedPrinter ? (
    <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
      <Printer className="w-4 h-4 text-indigo-600 shrink-0" />
      <div>
        <p className="text-sm font-medium text-indigo-800">{selectedPrinter.name} <span className="font-normal text-indigo-600">({selectedPrinter.printer_id})</span></p>
        <p className="text-xs text-indigo-600">Auto-selected from {job.line_name || job.line_id}</p>
      </div>
    </div>
  ) : null;

  // ── START mode — shown before bulk printing begins ──
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
          <p><span className="font-medium">Target:</span> {job.quantity_bottles_planned?.toLocaleString()} bottles</p>
          <p><span className="font-medium">Product:</span> {job.product_name}</p>
          <p><span className="font-medium">Template:</span> <span className="font-mono text-indigo-700">{templateName || '—'}</span></p>
          {Object.keys(sentPodValues).length > 0 && (
            <p><span className="font-medium">Label Data (POD):</span> {Object.entries(sentPodValues).map(([k, v]) => `${k}: ${v}`).join(' | ')}</p>
          )}
        </div>

        {noPodValues && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            No POD data found from demo print. The label may print with empty fields. Confirm before proceeding.
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
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending {job.quantity_bottles_planned?.toLocaleString()} labels to printer…</>
            : <><Play className="w-4 h-4" /> Start Bulk Print</>
          }
        </Button>

        {sendingPrint && (
          <p className="text-xs text-center text-slate-500">
            Sending {job.quantity_bottles_planned?.toLocaleString()} DATA commands to the printer — this may take a while. Do not close this page.
          </p>
        )}
      </div>
    );
  }

  // ── CONTROL mode — shown once bulk_printing is active ──
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
      <h2 className="text-base font-semibold text-slate-900">Bulk Print Control</h2>

      <NoPrinterWarning />
      <PrinterBadge />

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Progress</span>
          <span className="font-medium text-slate-900">{progress.toFixed(1)}%</span>
        </div>
        <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${job.status === 'paused' ? 'bg-orange-500' : 'bg-indigo-500'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-slate-50 rounded-lg p-2">
            <p className="text-xs text-slate-500">Target</p>
            <p className="text-lg font-bold text-slate-900">{job.quantity_bottles_planned?.toLocaleString()}</p>
          </div>
          <div className="bg-indigo-50 rounded-lg p-2">
            <p className="text-xs text-indigo-500">Printed</p>
            <p className="text-lg font-bold text-indigo-700">{printedQty.toLocaleString()}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-2">
            <p className="text-xs text-slate-500">Remaining</p>
            <p className="text-lg font-bold text-slate-900">{Math.max(0, remaining).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
        ℹ Print count is automatically updated from the printer every 2 seconds using RQLP status command.
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        {job.status === 'bulk_printing' && (
          <Button
            variant="outline"
            className="h-11 flex-1 gap-2 border-orange-300 text-orange-600 hover:bg-orange-50"
            onClick={handleStopPrinting}
            disabled={acting || !selectedPrinter}
          >
            {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />}
            Stop Printing
          </Button>
        )}
        {job.status === 'paused' && (
          <Button
            className="h-11 flex-1 gap-2 bg-indigo-600 hover:bg-indigo-700"
            onClick={handleResumePrinting}
            disabled={acting || !selectedPrinter}
          >
            {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            Resume Printing
          </Button>
        )}
      </div>
    </div>
  );
}