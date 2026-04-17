/**
 * LblDemoPrintVerificationStep
 *
 * Validates demo print before allowing checklist submission.
 * THREE conditions required to enable "Confirm & Proceed":
 *   1. RQLP check: all requested labels have been physically printed (X/Y = full)
 *   2. RQLP check: POD data on printer matches what was sent (col1=POD1, col2=POD2, ...)
 *   3. Physical checkbox: operator manually confirms label looks correct
 */

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { logLabellingEvent } from '@/lib/labellingEventLogger';
import { fetchRynanPodStatus } from '@/lib/rynanPrinterService';
import { toast } from '@/components/ui/use-toast';
import {
  Loader2, CheckCircle2, XCircle, RefreshCw, ShieldCheck,
  RotateCcw, AlertTriangle, Printer, ListChecks
} from 'lucide-react';

// Maps col1→POD1, col2→POD2, etc. from RQLP response back to POD keys
function colToPod(colKey) {
  const num = colKey.replace('col', '');
  return `POD${num}`;
}

// Compares printer POD data (colN) with sent POD values (PODN)
// Returns array of { pod, sent, printed, match }
function comparePodData(sentPodValues, printerColData) {
  const results = [];
  // Only check non-empty sent values
  Object.entries(sentPodValues).forEach(([podKey, sentValue]) => {
    if (!sentValue && sentValue !== 0) return; // skip empty sent values
    const colNum = podKey.replace('POD', '');
    const colKey = `col${colNum}`;
    const printed = printerColData[colKey] ?? '';
    const match = String(sentValue).trim() === String(printed).trim();
    results.push({ pod: podKey, sent: String(sentValue), printed: String(printed), match });
  });
  return results;
}

export default function LblDemoPrintVerificationStep({ job, user, onComplete }) {
  const queryClient = useQueryClient();

  const [physicalConfirmed, setPhysicalConfirmed] = useState(false);
  const [checking, setChecking]   = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resetting, setResetting] = useState(false);

  // RQLP check result state
  const [podCheckResult, setPodCheckResult] = useState(null);
  // { printedCount, totalCount, allPrinted, podComparison: [...], allPodsMatch, errorMessage }

  // Fetch active printers
  const { data: printers = [] } = useQuery({
    queryKey: ['lbl-printers-active'],
    queryFn: () => base44.entities.LblPrinterConfig.filter({ is_active: true }),
  });

  // Fetch the demo print command record (has request_payload with sent POD values)
  const { data: demoCommand } = useQuery({
    queryKey: ['demo-command', job.demo_print_command_id],
    queryFn: () => base44.entities.LblPrintCommand.filter({ command_id: job.demo_print_command_id }),
    enabled: !!job.demo_print_command_id,
    select: data => data?.[0] || null,
  });

  const printer = printers.find(p => p.printer_id === demoCommand?.printer_id);

  // Extract the original sent POD values from the DATA command payload
  // request_payload.command.data = { POD1: "...", POD2: "...", ... }
  const sentPodValues = demoCommand?.request_payload?.command?.data || {};
  const hasSentPods   = Object.keys(sentPodValues).length > 0;

  const handleCheckPodStatus = useCallback(async () => {
    if (!printer) {
      toast({ title: 'Printer not found — cannot run check', variant: 'destructive' });
      return;
    }
    setChecking(true);
    setPodCheckResult(null);

    const result = await fetchRynanPodStatus(printer);

    if (!result.success) {
      setPodCheckResult({ errorMessage: result.errorMessage || 'Could not reach printer' });
      toast({ title: 'Could not read printer status', description: result.errorMessage, variant: 'destructive' });
      setChecking(false);
      return;
    }

    const podComparison = hasSentPods
      ? comparePodData(sentPodValues, result.printerPodData)
      : [];

    const allPodsMatch = podComparison.length === 0 || podComparison.every(r => r.match);

    setPodCheckResult({
      printedCount:  result.printedCount,
      totalCount:    result.totalCount,
      allPrinted:    result.allPrinted,
      podComparison,
      allPodsMatch,
      errorMessage:  null,
    });

    if (!result.allPrinted) {
      toast({
        title: `Only ${result.printedCount} of ${result.totalCount} labels printed`,
        description: 'All demo labels must be printed before confirming.',
        variant: 'destructive',
      });
    } else if (!allPodsMatch) {
      toast({ title: 'POD data mismatch detected', description: 'Some printed fields do not match sent values.', variant: 'destructive' });
    } else {
      toast({ title: 'All labels printed with correct data' });
    }

    setChecking(false);
  }, [printer, sentPodValues, hasSentPods]);

  // Roll back to stock_transferred — operator can re-send demo print
  const handleResetDemoPrint = async () => {
    setResetting(true);
    await base44.entities.LabellingJob.update(job.id, {
      status:                      'stock_transferred',
      demo_print_qty:              0,
      demo_print_command_id:       null,
      demo_print_middleware_job_id: null,
    });
    await logLabellingEvent({
      action_type: 'demo_print_sent',
      job_id:      job.id,
      plan_id:     job.plan_id,
      description: 'Demo print reset by operator — label was not physically printed. Returning to Demo Print step to re-send.',
      user,
    });
    toast({ title: 'Reset Done', description: 'You can now re-send the demo print.' });
    queryClient.invalidateQueries({ queryKey: ['labelling-job', job.id] });
    onComplete?.();
    setResetting(false);
  };

  // All three conditions for enabling the confirm button
  const podCheckPassed = podCheckResult && !podCheckResult.errorMessage && podCheckResult.allPrinted && podCheckResult.allPodsMatch;
  const canConfirm     = physicalConfirmed && podCheckPassed;

  const handleVerifyAndProceed = async () => {
    if (!physicalConfirmed) {
      toast({ title: 'Please confirm physical label check', variant: 'destructive' });
      return;
    }
    if (!podCheckPassed) {
      toast({ title: 'Run printer check first — all labels must be printed with correct data', variant: 'destructive' });
      return;
    }

    setVerifying(true);
    const now = new Date().toISOString();

    await base44.entities.LabellingJob.update(job.id, {
      status:                   'demo_print_verified',
      demo_print_verified_at:   now,
      demo_print_verified_by:   user?.email || '',
    });

    await logLabellingEvent({
      action_type: 'demo_print_verified',
      job_id:      job.id,
      plan_id:     job.plan_id,
      description: `Demo print physically verified. Labels printed: ${podCheckResult.printedCount}/${podCheckResult.totalCount}. All POD fields matched.`,
      user,
    });

    toast({ title: 'Demo Print Verified', description: 'You can now proceed to fill the checklist.' });
    queryClient.invalidateQueries({ queryKey: ['labelling-job', job.id] });
    onComplete?.();
    setVerifying(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">

      {/* Header */}
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-teal-600" />
        <h2 className="text-base font-semibold text-slate-900">Verify Demo Print</h2>
      </div>

      <p className="text-sm text-slate-600">
        Before proceeding to the checklist, verify that all demo labels printed correctly and the label data matches exactly what was sent.
      </p>

      {/* Job summary */}
      <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
        <p className="text-slate-600"><span className="font-medium">Product:</span> {job.product_name}</p>
        {job.batch_no && <p className="text-slate-600"><span className="font-medium">Batch:</span> <span className="font-mono font-bold">{job.batch_no}</span></p>}
        <p className="text-slate-600"><span className="font-medium">Demo Labels Sent:</span> {job.demo_print_qty || '—'}</p>
      </div>

      {/* ── STEP 1: RQLP Printer Check ── */}
      <div className="border border-slate-200 rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-slate-600" />
            <p className="text-sm font-medium text-slate-900">Step 1 — Printer Label Count &amp; Data Check</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 shrink-0"
            onClick={handleCheckPodStatus}
            disabled={checking || !printer}
          >
            {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Check Printer
          </Button>
        </div>

        {!printer && (
          <p className="text-xs text-amber-600">Printer config not found — cannot run check.</p>
        )}

        {/* Error state */}
        {podCheckResult?.errorMessage && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-2 text-sm text-red-700">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{podCheckResult.errorMessage}</span>
          </div>
        )}

        {/* Results */}
        {podCheckResult && !podCheckResult.errorMessage && (
          <div className="space-y-3">

            {/* Label count */}
            <div className={`flex items-center gap-2 p-2 rounded-lg text-sm font-medium ${
              podCheckResult.allPrinted ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {podCheckResult.allPrinted
                ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                : <XCircle className="w-4 h-4 shrink-0" />
              }
              <span>
                Labels Printed: {podCheckResult.printedCount} of {podCheckResult.totalCount}
                {!podCheckResult.allPrinted && ` — ${podCheckResult.totalCount - podCheckResult.printedCount} still pending`}
              </span>
            </div>

            {/* POD comparison table */}
            {podCheckResult.podComparison.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-slate-600" />
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">POD Field Verification</p>
                  {podCheckResult.allPodsMatch
                    ? <span className="ml-auto text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">All fields match</span>
                    : <span className="ml-auto text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">{podCheckResult.podComparison.filter(r => !r.match).length} mismatch(es)</span>
                  }
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="text-left px-3 py-2 text-slate-700 font-semibold w-16">Field</th>
                        <th className="text-left px-3 py-2 text-slate-700 font-semibold">Sent Value</th>
                        <th className="text-left px-3 py-2 text-slate-700 font-semibold">Printed Value</th>
                        <th className="text-center px-3 py-2 text-slate-700 font-semibold w-16">Match</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {podCheckResult.podComparison.map(row => (
                        <tr key={row.pod} className={row.match ? 'hover:bg-slate-50' : 'bg-red-50 hover:bg-red-100'}>
                          <td className="px-3 py-2 font-mono font-bold text-slate-700">{row.pod}</td>
                          <td className="px-3 py-2 font-mono text-slate-600">{row.sent || <span className="text-slate-400 italic">empty</span>}</td>
                          <td className="px-3 py-2 font-mono text-slate-600">{row.printed || <span className="text-slate-400 italic">empty</span>}</td>
                          <td className="px-3 py-2 text-center">
                            {row.match
                              ? <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" />
                              : <XCircle className="w-4 h-4 text-red-600 mx-auto" />
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── STEP 2: Physical Confirmation ── */}
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

      {/* ── Reset Section ── */}
      <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm font-medium text-amber-800">Label did not print physically?</p>
        </div>
        <p className="text-xs text-amber-700">
          If the label was not printed on the machine (even if the check shows success), use this to go back and re-send the demo print with corrected settings.
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

      {/* ── Confirm Button ── */}
      <Button
        className="h-11 w-full gap-2 bg-teal-600 hover:bg-teal-700"
        onClick={handleVerifyAndProceed}
        disabled={verifying || !canConfirm}
      >
        {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
        Confirm Verification &amp; Proceed to Checklist
      </Button>

      {/* Helper hint */}
      {!canConfirm && (
        <p className="text-xs text-center text-slate-500">
          {!podCheckResult
            ? 'Run the printer check first to verify labels are printed and data is correct.'
            : !podCheckResult.allPrinted
              ? `Waiting for all ${podCheckResult.totalCount} labels to print (${podCheckResult.printedCount} done so far).`
              : !podCheckResult.allPodsMatch
                ? 'Fix data mismatch before confirming — re-send demo print with correct values.'
                : 'Tick the physical confirmation checkbox above.'
          }
        </p>
      )}
    </div>
  );
}