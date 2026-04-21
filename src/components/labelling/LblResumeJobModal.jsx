import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { PlayCircle, Loader2, Package, Printer, Hash, Lock, AlertCircle } from 'lucide-react';
import { canManagePlans } from '@/lib/labellingHelpers';

function StatCard({ icon: Icon, label, value, tone = 'slate' }) {
  const tones = {
    slate:  'bg-slate-50 border-slate-200 text-slate-700',
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    amber:  'bg-amber-50 border-amber-200 text-amber-700',
  };
  return (
    <div className={`border rounded-lg px-3 py-2.5 ${tones[tone]}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide opacity-80">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className="text-base font-bold mt-0.5 leading-none">{value}</div>
    </div>
  );
}

export default function LblResumeJobModal({ open, onOpenChange, job, user, onConfirm, isLoading }) {
  const [reason, setReason] = useState('');
  const [availableQty, setAvailableQty] = useState('');

  const printedQty = job?.current_printed_qty || 0;
  const originalPlanned = job?.quantity_bottles_planned || 0;
  const defaultRemaining = Math.max(0, originalPlanned - printedQty);
  const canEdit = canManagePlans(user?.role);

  useEffect(() => {
    if (open) {
      setAvailableQty(String(defaultRemaining));
      setReason('');
    }
  }, [open, defaultRemaining]);

  const newPlannedTotal = Number(availableQty || 0) + printedQty;
  const qtyChanged = newPlannedTotal !== originalPlanned;
  const isValid = reason.trim() && Number(availableQty) >= 0 && newPlannedTotal >= printedQty;

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm(reason.trim(), newPlannedTotal);
  };

  const restoredStatus = job?.previous_status || 'pending';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="bg-gradient-to-br from-green-600 to-emerald-600 px-5 py-4 space-y-1">
          <DialogTitle className="flex items-center gap-2 text-white text-base font-semibold">
            <PlayCircle className="w-5 h-5" />
            Resume On-Hold Job
          </DialogTitle>
          <p className="text-xs text-green-50">
            Job <span className="font-mono font-semibold">{job?.job_id}</span> · Will restore to{' '}
            <span className="font-mono font-semibold">{restoredStatus}</span>
          </p>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Product identity */}
          <div>
            <p className="text-sm font-semibold text-slate-900 leading-tight">{job?.product_name}</p>
            {job?.batch_no && (
              <p className="text-xs text-slate-500 mt-0.5">Batch: <span className="font-mono">{job.batch_no}</span></p>
            )}
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-2">
            <StatCard icon={Package} label="Planned"  value={originalPlanned.toLocaleString()} tone="slate" />
            <StatCard icon={Printer} label="Printed"  value={printedQty.toLocaleString()}      tone="blue" />
            <StatCard icon={Hash}    label="Remaining" value={defaultRemaining.toLocaleString()} tone="amber" />
          </div>

          {/* Hold Reason (collapsed styling) */}
          {job?.rejection_reason && (
            <div className="border-l-2 border-amber-400 bg-amber-50/50 pl-3 py-1.5">
              <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">Original Hold Reason</p>
              <p className="text-sm text-slate-700 mt-0.5">{job.rejection_reason}</p>
            </div>
          )}

          {/* Bottles still available */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                Bottles Still Available to Label
                {canEdit ? <span className="text-red-500">*</span> : <Lock className="w-3 h-3 text-slate-400" />}
              </Label>
              {qtyChanged && canEdit && (
                <span className="text-[10px] font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  Modified
                </span>
              )}
            </div>

            <div className="relative">
              <Input
                type="number"
                min="0"
                value={availableQty}
                onChange={(e) => setAvailableQty(e.target.value)}
                readOnly={!canEdit}
                className={`h-12 text-lg font-bold pr-20 ${
                  !canEdit
                    ? 'bg-slate-50 cursor-not-allowed text-slate-600'
                    : qtyChanged
                      ? 'border-amber-300 focus-visible:ring-amber-400'
                      : ''
                }`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 pointer-events-none">
                bottles
              </span>
            </div>

            {/* New total preview */}
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
              qtyChanged ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'
            }`}>
              <span className="text-xs text-slate-600">New total planned</span>
              <span className="text-sm font-bold text-slate-900">
                {newPlannedTotal.toLocaleString()} bottles
                {qtyChanged && (
                  <span className={`ml-2 text-xs font-medium ${
                    newPlannedTotal > originalPlanned ? 'text-green-600' : 'text-amber-600'
                  }`}>
                    ({newPlannedTotal > originalPlanned ? '+' : ''}
                    {(newPlannedTotal - originalPlanned).toLocaleString()})
                  </span>
                )}
              </span>
            </div>

            <p className="text-xs text-slate-500 flex items-start gap-1.5">
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
              {canEdit
                ? 'Edit if fewer bottles are actually available to label.'
                : 'Only a supervisor or admin can edit this value.'}
            </p>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              Reason for Resuming <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Equipment fixed, Issue resolved, Approved to continue…"
              className="min-h-[72px] text-sm"
            />
            <p className="text-xs text-slate-500">Recorded in the audit log.</p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 flex gap-3">
          <Button
            variant="outline"
            className="h-11 md:h-10 flex-1"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            className="h-11 md:h-10 flex-[1.5] gap-2 bg-green-600 hover:bg-green-700 shadow-sm"
            onClick={handleConfirm}
            disabled={isLoading || !isValid}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Resuming…
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4" />
                Resume Job
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}