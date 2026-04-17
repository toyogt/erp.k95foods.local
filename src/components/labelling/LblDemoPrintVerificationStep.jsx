/**
 * LblDemoPrintVerificationStep
 *
 * Mandatory step between demo_print_sent and checklist_submitted.
 * Requires:
 *   1. Middleware job reports "completed" (polled via GET /job/<id>)
 *   2. Operator physically confirms label looks correct (checkbox)
 *
 * Only when both conditions are met can the job move to demo_print_verified.
 */

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { logLabellingEvent } from '@/lib/labellingEventLogger';
import { fetchRynanMiddlewareJobStatus } from '@/lib/rynanPrinterService';
import { toast } from '@/components/ui/use-toast';
import { Loader2, CheckCircle2, Clock, XCircle, RefreshCw, ShieldCheck, RotateCcw, AlertTriangle } from 'lucide-react';

export default function LblDemoPrintVerificationStep({ job, user, onComplete }) {
  const queryClient = useQueryClient();
  const [physicalConfirmed, setPhysicalConfirmed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [middlewareStatus, setMiddlewareStatus] = useState(null); // null | 'completed' | 'pending' | 'failed'
  const [middlewareRaw, setMiddlewareRaw] = useState(null);

  // Fetch the printer config associated with this job's demo print command
  const { data: printers = [] } = useQuery({
    queryKey: ['lbl-printers-active'],
    queryFn: () => base44.entities.LblPrinterConfig.filter({ is_active: true }),
  });

  // Fetch the demo print command record
  const { data: demoCommand } = useQuery({
    queryKey: ['demo-command', job.demo_print_command_id],
    queryFn: () => base44.entities.LblPrintCommand.filter({ command_id: job.demo_print_command_id }),
    enabled: !!job.demo_print_command_id,
    select: data => data?.[0] || null,
  });

  const printer = printers.find(p => p.printer_id === demoCommand?.printer_id);
  const middlewareJobId = job.demo_print_middleware_job_id;

  const checkMiddlewareStatus = useCallback(async () => {
    if (!middlewareJobId || !printer) {
      toast({ title: 'Cannot check — no middleware job ID or printer found', variant: 'destructive' });
      return;
    }
    setChecking(true);
    try {
      const result = await fetchRynanMiddlewareJobStatus({ printer, middlewareJobId });
      setMiddlewareStatus(result.status);
      setMiddlewareRaw(result.raw);
      if (result.status === 'completed') {
        toast({ title: 'Middleware confirms print completed' });
      } else if (result.status === 'failed') {
        toast({ title: 'Middleware reports print failed', variant: 'destructive' });
      } else {
        toast({ title: 'Print still in progress — check again shortly' });
      }
    } catch (err) {
      toast({ title: 'Could not reach middleware', description: err.message, variant: 'destructive' });
      setMiddlewareStatus(null);
    }
    setChecking(false);
  }, [middlewareJobId, printer]);

  // Roll back to stock_transferred so operator can re-send demo print
  const handleResetDemoPrint = async () => {
    setResetting(true);
    await base44.entities.LabellingJob.update(job.id, {
      status: 'stock_transferred',
      demo_print_qty: 0,
      demo_print_command_id: null,
      demo_print_middleware_job_id: null,
    });
    await logLabellingEvent({
      action_type: 'demo_print_sent',
      job_id: job.id,
      plan_id: job.plan_id,
      description: `Demo print reset by operator — label was not physically printed. Returning to Demo Print step to re-send.`,
      user,
    });
    toast({ title: 'Reset Done', description: 'You can now re-send the demo print.' });
    queryClient.invalidateQueries({ queryKey: ['labelling-job', job.id] });
    onComplete?.();
    setResetting(false);
  };

  const handleVerifyAndProceed = async () => {
    if (!physicalConfirmed) {
      toast({ title: 'Please confirm physical label check', variant: 'destructive' });
      return;
    }
    // If we have a middleware job ID, require middleware confirmation
    if (middlewareJobId && middlewareStatus !== 'completed') {
      toast({ title: 'Middleware has not confirmed print completion. Click "Check Middleware Status" first.', variant: 'destructive' });
      return;
    }

    setVerifying(true);
    const now = new Date().toISOString();

    await base44.entities.LabellingJob.update(job.id, {
      status: 'demo_print_verified',
      demo_print_verified_at: now,
      demo_print_verified_by: user?.email || '',
    });

    await logLabellingEvent({
      action_type: 'demo_print_verified',
      job_id: job.id,
      plan_id: job.plan_id,
      description: `Demo print physically verified by operator. Middleware status: ${middlewareStatus || 'not checked'}`,
      user,
    });

    toast({ title: 'Demo Print Verified', description: 'You can now proceed to fill the checklist.' });
    queryClient.invalidateQueries({ queryKey: ['labelling-job', job.id] });
    onComplete?.();
    setVerifying(false);
  };

  const statusIcon = {
    completed: <CheckCircle2 className="w-5 h-5 text-green-600" />,
    pending: <Clock className="w-5 h-5 text-amber-500" />,
    failed: <XCircle className="w-5 h-5 text-red-600" />,
  };

  const statusText = {
    completed: 'Print completed on machine',
    pending: 'Print still in progress',
    failed: 'Print failed on machine',
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-teal-600" />
        <h2 className="text-base font-semibold text-slate-900">Verify Demo Print</h2>
      </div>

      <p className="text-sm text-slate-600">
        Before proceeding to the checklist, you must verify the demo labels printed correctly — both on the machine and physically.
      </p>

      {/* Job summary */}
      <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
        <p className="text-slate-600"><span className="font-medium">Product:</span> {job.product_name}</p>
        {job.batch_no && <p className="text-slate-600"><span className="font-medium">Batch:</span> <span className="font-mono font-bold">{job.batch_no}</span></p>}
        <p className="text-slate-600"><span className="font-medium">Demo Quantity Sent:</span> {job.demo_print_qty || '—'} labels</p>
        {middlewareJobId && <p className="text-slate-500 text-xs font-mono">Middleware Job ID: {middlewareJobId}</p>}
      </div>

      {/* Middleware status check */}
      <div className="border border-slate-200 rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-900">Step 1 — Machine Verification</p>
          {middlewareJobId ? (
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={checkMiddlewareStatus} disabled={checking}>
              {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Check Middleware Status
            </Button>
          ) : (
            <span className="text-xs text-slate-400">No middleware job ID — manual verification only</span>
          )}
        </div>

        {middlewareStatus && (
          <div className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
            middlewareStatus === 'completed' ? 'bg-green-50 text-green-800' :
            middlewareStatus === 'failed' ? 'bg-red-50 text-red-800' :
            'bg-amber-50 text-amber-800'
          }`}>
            {statusIcon[middlewareStatus]}
            <span>{statusText[middlewareStatus]}</span>
          </div>
        )}

        {!middlewareJobId && (
          <p className="text-xs text-slate-500">This demo print was sent without middleware tracking. Proceed with physical confirmation only.</p>
        )}
      </div>

      {/* Physical confirmation */}
      <div className="border border-slate-200 rounded-lg p-3 space-y-2">
        <p className="text-sm font-medium text-slate-900">Step 2 — Physical Label Confirmation</p>
        <div className="flex items-start gap-3">
          <Checkbox
            id="physical-confirm"
            checked={physicalConfirmed}
            onCheckedChange={setPhysicalConfirmed}
            className="mt-0.5"
          />
          <Label htmlFor="physical-confirm" className="text-sm text-slate-700 leading-relaxed cursor-pointer">
            I have physically inspected the demo labels. The batch number, product name, MRP, manufacturing date, and expiry date are all correct and the print quality is acceptable.
          </Label>
        </div>
      </div>

      {/* Reset section — label not printed, go back to re-send */}
      <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm font-medium text-amber-800">Label did not print physically?</p>
        </div>
        <p className="text-xs text-amber-700">
          If the label was not printed on the machine (even if middleware shows success), use this to go back and re-send the demo print with corrected settings.
        </p>
        <Button
          variant="outline"
          className="h-11 w-full gap-2 border-amber-300 text-amber-800 hover:bg-amber-100"
          onClick={handleResetDemoPrint}
          disabled={resetting}
        >
          {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
          Reset — Go Back to Re-send Demo Print
        </Button>
      </div>

      <Button
        className="h-11 w-full gap-2 bg-teal-600 hover:bg-teal-700"
        onClick={handleVerifyAndProceed}
        disabled={verifying || !physicalConfirmed || (!!middlewareJobId && middlewareStatus !== 'completed')}
      >
        {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
        Confirm Verification &amp; Proceed to Checklist
      </Button>

      {middlewareJobId && middlewareStatus !== 'completed' && (
        <p className="text-xs text-center text-slate-500">
          Check middleware status first. Button activates once machine confirms completion.
        </p>
      )}
    </div>
  );
}