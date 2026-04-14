/**
 * LblPrinterStatusPanel
 * Fetches and displays cartridge status, ink level, and MON command output
 * from the Rynan middleware. Also provides a Purge button.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';
import { getPrinterStatus, sendPurgeCommand } from '@/lib/rynanPrinterService';
import { logLabellingEvent } from '@/lib/labellingEventLogger';
import { Loader2, CheckCircle2, XCircle, Droplets, Activity, Eraser, RefreshCw } from 'lucide-react';

export default function LblPrinterStatusPanel({ printer, job, user, onStatusFetched }) {
  const [status, setStatus] = useState(null); // { has_cartridge, ink_level, mon_output, raw }
  const [fetching, setFetching] = useState(false);
  const [purging, setPurging] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

  const fetchStatus = async () => {
    setFetching(true);
    const result = await getPrinterStatus(printer);
    if (result.success) {
      setStatus(result);
      onStatusFetched?.(result);
    } else {
      toast({ title: 'Could not fetch printer status', description: result.errorMessage, variant: 'destructive' });
      setStatus(null);
      onStatusFetched?.(null);
    }
    setFetching(false);
  };

  const handlePurge = async () => {
    setShowPurgeConfirm(false);
    setPurging(true);
    const result = await sendPurgeCommand(printer, user);
    if (result.success) {
      toast({ title: 'Printer Purged', description: 'Purge command accepted by printer.' });
      if (job) {
        await logLabellingEvent({ action_type: 'printer_command_sent', job_id: job.id, plan_id: job.plan_id, description: `Purge command sent to printer ${printer.name}`, user });
      }
      // Refresh status after purge
      await fetchStatus();
    } else {
      toast({ title: 'Purge Failed', description: result.errorMessage || 'Printer did not accept purge command.', variant: 'destructive' });
      if (job) {
        await logLabellingEvent({ action_type: 'printer_command_failed', job_id: job.id, plan_id: job.plan_id, description: `Purge failed: ${result.errorMessage}`, user });
      }
    }
    setPurging(false);
  };

  const inkColor = (level) => {
    if (level == null) return 'text-slate-500';
    if (level <= 15) return 'text-red-600';
    if (level <= 30) return 'text-amber-600';
    return 'text-green-700';
  };

  const inkBg = (level) => {
    if (level == null) return 'bg-slate-200';
    if (level <= 15) return 'bg-red-500';
    if (level <= 30) return 'bg-amber-500';
    return 'bg-green-500';
  };

  return (
    <div className="border border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Printer Status — {printer.name}</p>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={fetchStatus} disabled={fetching}>
          {fetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          {status ? 'Refresh' : 'Check Status'}
        </Button>
      </div>

      {!status && !fetching && (
        <p className="text-xs text-slate-500 text-center py-2">Click "Check Status" to verify printer before sending command.</p>
      )}

      {fetching && (
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Checking printer…
        </div>
      )}

      {status && !fetching && (
        <div className="space-y-2">
          {/* Cartridge status */}
          <div className="flex items-center gap-2">
            {status.has_cartridge ? (
              <><CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" /><span className="text-sm font-medium text-green-700">Cartridge Detected</span></>
            ) : (
              <><XCircle className="w-4 h-4 text-red-600 shrink-0" /><span className="text-sm font-medium text-red-700">No Cartridge Found</span></>
            )}
          </div>

          {/* Ink Level */}
          {status.has_cartridge && status.ink_level != null && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-slate-600"><Droplets className="w-3.5 h-3.5" /> Ink Level</span>
                <span className={`font-semibold ${inkColor(status.ink_level)}`}>{status.ink_level}%</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${inkBg(status.ink_level)}`} style={{ width: `${status.ink_level}%` }} />
              </div>
              {status.ink_level <= 15 && (
                <p className="text-xs text-red-600">⚠ Very low ink — replace cartridge soon</p>
              )}
            </div>
          )}

          {/* MON command output */}
          {status.mon_output && (
            <div className="flex items-start gap-2">
              <Activity className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-600 font-mono break-all">{status.mon_output}</p>
            </div>
          )}

          {/* No cartridge warning */}
          {!status.has_cartridge && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2">
              <p className="text-xs text-red-700 font-medium">Cannot send print command — no cartridge installed in the printer.</p>
            </div>
          )}
        </div>
      )}

      {/* Purge button — only show if cartridge is present */}
      {status?.has_cartridge && (
        <div className="pt-1">
          <Button
            variant="outline"
            className="h-11 md:h-9 w-full gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
            onClick={() => setShowPurgeConfirm(true)}
            disabled={purging}
          >
            {purging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eraser className="w-4 h-4" />}
            Purge Printer
          </Button>
        </div>
      )}

      <AlertDialog open={showPurgeConfirm} onOpenChange={setShowPurgeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Purge Printer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send a purge command to <strong>{printer.name}</strong>. Purging clears dried ink from the print heads and consumes some ink. Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 md:h-9">Cancel</AlertDialogCancel>
            <AlertDialogAction className="h-11 md:h-9 bg-orange-600 hover:bg-orange-700" onClick={handlePurge}>
              Yes, Purge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}