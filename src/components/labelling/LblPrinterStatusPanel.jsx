/**
 * LblPrinterStatusPanel
 *
 * Runs and displays the full 5-step printer validation flow:
 *   Step 1 — GET /printers  → is printer_id registered? IP/port correct?
 *   Step 2 — Auto-fix       → POST /printers (register) or PUT /printers/{id} (update IP/port)
 *   Step 3 — POST /print { command:"MON" } → live middleware ↔ printer connection test
 *   Step 4 — Parse MON response → cartridge presence + ink level (RSAL error codes)
 *   Step 5 — Show overall result → enable/block the print button
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';
import { checkAndSyncPrinterConfig, sendPurgeCommand } from '@/lib/rynanPrinterService';
import { logLabellingEvent } from '@/lib/labellingEventLogger';
import { Loader2, CheckCircle2, XCircle, Droplets, Wifi, Settings2, Eraser, RefreshCw, AlertTriangle, FileText } from 'lucide-react';

// Map configAction to a readable label
const CONFIG_ACTION_LABELS = {
  found:   'Printer ID found — configuration matches',
  created: 'Printer registered in middleware (was missing)',
  updated: 'Printer IP/port updated in middleware',
  error:   'Could not configure printer in middleware',
};

export default function LblPrinterStatusPanel({ printer, job, user, templateName, onStatusFetched }) {
  const [result, setResult]       = useState(null);  // full checkAndSyncPrinterConfig result
  const [fetching, setFetching]   = useState(false);
  const [purging, setPurging]     = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

  const runCheck = async () => {
    setFetching(true);
    const res = await checkAndSyncPrinterConfig(printer, templateName || null);
    setResult(res);

    // Always pass result so parent knows status was checked (statusChecked = true)
    // Parent uses has_cartridge + templateFound to gate the print button
    onStatusFetched?.({ ...res, success: res.configOk && res.connectionOk });
    const templateOk = res.templateFound === null || res.templateFound === true;
    if (!res.configOk || !res.connectionOk || !templateOk) {
      const errMsg = res.configError || res.connectionError
        || (res.templateFound === false ? `Template "${templateName}" not found on printer` : 'Printer check failed');
      toast({ title: 'Printer Check Failed', description: errMsg, variant: 'destructive' });
    }
    setFetching(false);
  };

  const handlePurge = async () => {
    setShowPurgeConfirm(false);
    setPurging(true);
    const res = await sendPurgeCommand(printer, user);
    if (res.success) {
      toast({ title: 'Printer Purged', description: 'Purge command accepted by printer.' });
      if (job) await logLabellingEvent({ action_type: 'printer_command_sent', job_id: job.id, plan_id: job.plan_id, description: `Purge sent to ${printer.name}`, user });
      await runCheck(); // refresh status after purge
    } else {
      toast({ title: 'Purge Failed', description: res.errorMessage || 'Printer did not accept purge.', variant: 'destructive' });
      if (job) await logLabellingEvent({ action_type: 'printer_command_failed', job_id: job.id, plan_id: job.plan_id, description: `Purge failed: ${res.errorMessage}`, user });
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

  const Row = ({ icon: Icon, iconClass, label, value, valueClass, children }) => (
    <div className="flex items-start gap-2.5 py-1.5">
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconClass}`} />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-slate-600">{label}: </span>
        {value && <span className={`text-xs font-semibold ${valueClass || 'text-slate-900'}`}>{value}</span>}
        {children}
      </div>
    </div>
  );

  return (
    <div className="border border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50">

      {/* Header + Check button */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
          Printer Check — {printer.name}
        </p>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={runCheck} disabled={fetching}>
          {fetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          {result ? 'Re-check' : 'Check Status'}
        </Button>
      </div>

      {/* Idle state */}
      {!result && !fetching && (
        <p className="text-xs text-slate-500 text-center py-2">
          Click "Check Status" to verify printer configuration, connection, and cartridge before printing.
        </p>
      )}

      {/* Loading */}
      {fetching && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Running printer checks…
        </div>
      )}

      {/* Results */}
      {result && !fetching && (
        <div className="space-y-1 divide-y divide-slate-100">

          {/* Step 1+2 — Config check */}
          <Row
            icon={Settings2}
            iconClass={result.configOk ? 'text-green-600' : 'text-red-500'}
            label="Middleware Configuration"
            value={CONFIG_ACTION_LABELS[result.configAction] || '—'}
            valueClass={result.configOk ? 'text-green-700' : 'text-red-700'}
          />
          {result.configError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded p-2 mt-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
              <p className="text-xs text-red-700">{result.configError}</p>
            </div>
          )}

          {/* Step 3 — Live connection */}
          <Row
            icon={Wifi}
            iconClass={result.connectionOk ? 'text-green-600' : 'text-red-500'}
            label="Printer Connection (MON)"
            value={result.connectionOk ? 'Connected and responding' : (result.connectionError || 'No response from printer')}
            valueClass={result.connectionOk ? 'text-green-700' : 'text-red-700'}
          />

          {/* Step 4 — Cartridge */}
          <Row
            icon={result.has_cartridge ? CheckCircle2 : XCircle}
            iconClass={result.has_cartridge ? 'text-green-600' : 'text-red-500'}
            label="Cartridge"
            value={result.has_cartridge ? 'Detected' : (result.cartridgeError || 'Not detected')}
            valueClass={result.has_cartridge ? 'text-green-700' : 'text-red-700'}
          />

          {/* Ink level bar — only if cartridge present and level known */}
          {result.has_cartridge && result.ink_level != null && (
            <div className="pt-1.5 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-slate-600">
                  <Droplets className="w-3.5 h-3.5" /> Ink Level
                </span>
                <span className={`font-semibold ${inkColor(result.ink_level)}`}>{result.ink_level}%</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${inkBg(result.ink_level)}`}
                  style={{ width: `${result.ink_level}%` }}
                />
              </div>
              {result.ink_level <= 15 && (
                <p className="text-xs text-red-600">⚠ Very low ink — replace cartridge soon</p>
              )}
            </div>
          )}

          {/* Low ink warning from RSAL 008 even without a numeric level */}
          {result.has_cartridge && result.cartridgeError && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded p-2 mt-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700">{result.cartridgeError}</p>
            </div>
          )}

          {/* Step 5 — Template check (only if templateName was provided) */}
          {result.templateFound !== null && (
            <Row
              icon={FileText}
              iconClass={result.templateFound ? 'text-green-600' : 'text-red-500'}
              label={`Template "${templateName}"`}
              value={result.templateFound ? `Found on printer (${result.availableTemplates.length} total templates)` : 'NOT found on printer'}
              valueClass={result.templateFound ? 'text-green-700' : 'text-red-700'}
            >
              {!result.templateFound && result.availableTemplates.length > 0 && (
                <div className="mt-1">
                  <p className="text-xs text-slate-500 mb-0.5">Templates on this printer ({result.availableTemplates.length}):</p>
                  <div className="flex flex-wrap gap-1">
                    {result.availableTemplates.map(t => (
                      <span key={t} className="text-xs bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 font-mono text-slate-700">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {!result.templateFound && result.availableTemplates.length === 0 && (
                <p className="text-xs text-amber-600 mt-0.5">Could not read template list from printer — check middleware configuration.</p>
              )}
            </Row>
          )}
          {result.templateError && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded p-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700">Template check failed: {result.templateError}</p>
            </div>
          )}

          {/* No cartridge — block print */}
          {!result.has_cartridge && result.connectionOk && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded p-2 mt-1">
              <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
              <p className="text-xs text-red-700 font-medium">Cannot print — no cartridge installed.</p>
            </div>
          )}

          {/* Overall summary badge */}
          <div className="pt-2">
            {(() => {
              const tplOk = result.templateFound === null || result.templateFound === true;
              const allOk = result.configOk && result.connectionOk && result.has_cartridge && tplOk;
              const failReason = !result.configOk ? 'middleware configuration failed'
                : !result.connectionOk ? 'printer connection failed'
                : !result.has_cartridge ? 'no cartridge installed'
                : !tplOk ? `template "${templateName}" not found on printer`
                : '';
              return allOk ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded p-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  <p className="text-xs text-green-700 font-semibold">Printer is ready — all checks passed.</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded p-2">
                  <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <p className="text-xs text-red-700 font-semibold">Printer not ready — {failReason}. Cannot send print command.</p>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Purge button — only if cartridge present */}
      {result?.has_cartridge && (
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
              This will send a purge command to <strong>{printer.name}</strong>. Purging clears dried ink from the print heads and uses some ink. Continue?
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