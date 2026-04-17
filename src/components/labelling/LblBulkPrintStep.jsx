/**
 * LblBulkPrintStep
 *
 * Wires up actual Rynan printer communication for bulk printing:
 *   STOP → STAR (load template) → MON (verify) → DATA × quantity_bottles_planned
 *
 * POD values are re-used from the approved demo DATA command (same label data).
 * Printer selection is required before starting.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { logLabellingEvent } from '@/lib/labellingEventLogger';
import { sendStarCommand } from '@/lib/rynanPrinterService';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Play, Pause, RotateCcw, Printer, AlertTriangle } from 'lucide-react';

export default function LblBulkPrintStep({ job, user, onComplete, mode }) {
  const [printedQty, setPrintedQty]   = useState(job.current_printed_qty || 0);
  const [printerId, setPrinterId]     = useState('');
  const [acting, setActing]           = useState(false);
  const [sendingPrint, setSendingPrint] = useState(false);

  const remaining = (job.quantity_bottles_planned || 0) - printedQty;
  const progress  = job.quantity_bottles_planned
    ? Math.min(100, (printedQty / job.quantity_bottles_planned) * 100)
    : 0;

  // Active printers
  const { data: printers = [] } = useQuery({
    queryKey: ['lbl-printers-active'],
    queryFn:  () => base44.entities.LblPrinterConfig.filter({ is_active: true }),
  });

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
  const dataCommand   = demoCommands.find(c => c.request_payload?.command?.command === 'DATA')
    || demoCommands.find(c => c.request_payload?.command?.data)
    || demoCommands[0]
    || null;
  const sentPodValues = dataCommand?.request_payload?.command?.data || {};
  const templateName  = jobTemplate?.middleware_template_name || '';
  const selectedPrinter = printers.find(p => p.printer_id === printerId) || null;

  // ── Start bulk print: send actual commands to Rynan middleware ──
  const handleStartBulkPrint = async () => {
    if (!selectedPrinter) {
      toast({ title: 'Select a printer first', variant: 'destructive' });
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

    // STOP → STAR (load template, retry up to 5) → MON (verify) → DATA × qty
    const result = await sendStarCommand(
      selectedPrinter,
      templateName,
      qty,
      { jobId: job.id, commandType: 'bulk_start', user, podValues: sentPodValues }
    );

    if (!result.success) {
      if (result.templateNotOnPrinter) {
        toast({
          title:       'Template Not Found on Printer',
          description: `Template "${templateName}" is not loaded on the printer. Load it first then retry.`,
          variant:     'destructive',
          duration:    8000,
        });
      } else {
        toast({
          title:       'Bulk Print Failed',
          description: result.errorMessage || 'Middleware returned an error.',
          variant:     'destructive',
          duration:    6000,
        });
      }
      await logLabellingEvent({
        action_type: 'printer_command_failed',
        job_id:      job.id,
        plan_id:     job.plan_id,
        description: `Bulk print failed after ${result.sentCount} of ${qty} labels: ${result.errorMessage}`,
        user,
      });
      setSendingPrint(false);
      return;
    }

    // Success — update job status
    await base44.entities.LabellingJob.update(job.id, {
      status:              'bulk_printing',
      current_printed_qty: result.sentCount,
    });

    await logLabellingEvent({
      action_type: 'bulk_print_started',
      job_id:      job.id,
      plan_id:     job.plan_id,
      description: `Bulk print started — ${result.sentCount} of ${qty} labels sent to ${selectedPrinter.name} using template "${templateName}". Middleware job: ${result.lastMiddlewareJobId || 'N/A'}.`,
      user,
    });

    toast({ title: 'Bulk Print Started', description: `${result.sentCount.toLocaleString()} labels sent to printer successfully.` });
    onComplete?.();
    setSendingPrint(false);
  };

  // ── Status-only actions (pause / resume) — no Rynan call needed ──
  const handleStatusAction = async (actionType, nextStatus) => {
    setActing(true);
    await base44.entities.LabellingJob.update(job.id, { status: nextStatus, current_printed_qty: printedQty });
    await logLabellingEvent({
      action_type: actionType,
      job_id:      job.id,
      plan_id:     job.plan_id,
      description: `Bulk print ${actionType.replace('bulk_print_', '')} for job ${job.job_id}`,
      user,
    });
    toast({ title: actionType === 'bulk_print_stopped' ? 'Printing Paused' : 'Printing Resumed' });
    onComplete?.();
    setActing(false);
  };

  const handleUpdateQty = async () => {
    await base44.entities.LabellingJob.update(job.id, { current_printed_qty: printedQty });
    toast({ title: 'Printed Quantity Updated' });
    onComplete?.();
  };

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

        {/* Printer Selection */}
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-700">Select Printer <span className="text-red-500">*</span></Label>
          <Select value={printerId} onValueChange={setPrinterId}>
            <SelectTrigger className="h-11 md:h-9">
              <SelectValue placeholder="Select printer to print on" />
            </SelectTrigger>
            <SelectContent>
              {printers.map(p => (
                <SelectItem key={p.printer_id} value={p.printer_id}>
                  {p.name} ({p.printer_id}) — {p.line_name || 'No line'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          className="h-11 w-full gap-2 bg-indigo-600 hover:bg-indigo-700"
          onClick={handleStartBulkPrint}
          disabled={sendingPrint || !printerId || !templateName}
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

      {/* Manual printed count update */}
      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-1">
          <Label className="text-xs font-medium text-slate-700">Current Printed Count</Label>
          <Input
            type="number"
            value={printedQty}
            onChange={e => setPrintedQty(Number(e.target.value))}
            className="h-11 md:h-9"
            min="0"
          />
        </div>
        <Button variant="outline" className="h-11 md:h-9" onClick={handleUpdateQty}>Update</Button>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        {job.status === 'bulk_printing' && (
          <Button
            variant="outline"
            className="h-11 flex-1 gap-2 border-orange-300 text-orange-600 hover:bg-orange-50"
            onClick={() => handleStatusAction('bulk_print_stopped', 'paused')}
            disabled={acting}
          >
            {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />}
            Stop Printing
          </Button>
        )}
        {job.status === 'paused' && (
          <Button
            className="h-11 flex-1 gap-2 bg-indigo-600 hover:bg-indigo-700"
            onClick={() => handleStatusAction('bulk_print_resumed', 'bulk_printing')}
            disabled={acting}
          >
            {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            Resume Printing
          </Button>
        )}
      </div>
    </div>
  );
}