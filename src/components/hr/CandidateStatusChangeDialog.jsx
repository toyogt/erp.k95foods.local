import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Loader2, AlertCircle, CheckCircle2, Calendar } from 'lucide-react';
import { getAllowedNextStatuses, getStatusMeta } from '@/lib/candidateStatusTransitions';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDDMMYYYY(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Guided dialog for changing a candidate lead's status.
 * - Shows current status with description
 * - Presents only the logical next-status options as cards
 * - Requires remarks for any transition (audit/analytics quality)
 * - Warns when moving to "Terminated" (redirects to full termination form)
 */
export default function CandidateStatusChangeDialog({
  open,
  onOpenChange,
  candidate,
  onSubmit,
  saving,
}) {
  const [selectedStatus, setSelectedStatus] = useState('');
  const [remarks, setRemarks] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(todayISO());
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setSelectedStatus('');
      setRemarks('');
      setEffectiveDate(todayISO());
      setError('');
    }
  }, [open, candidate?.id]);

  if (!candidate) return null;

  const currentStatus = candidate.status || 'New';
  const currentMeta = getStatusMeta(currentStatus);
  const allowedNext = getAllowedNextStatuses(currentStatus);

  const handleConfirm = () => {
    if (!selectedStatus) {
      setError('Please select a new status');
      return;
    }
    if (!remarks.trim()) {
      setError('Please add remarks explaining this status change');
      return;
    }
    if (!effectiveDate) {
      setError('Please pick the effective date of this status change');
      return;
    }
    if (effectiveDate > todayISO()) {
      setError('Effective date cannot be in the future');
      return;
    }
    onSubmit({
      newStatus: selectedStatus,
      remarks: remarks.trim(),
      effectiveDate,
    });
  };

  const isTerminating = selectedStatus === 'Terminated';
  const isHiring = selectedStatus === 'Hired';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Change Status</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Candidate Identity */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="text-xs text-slate-500">Candidate</div>
            <div className="font-semibold text-slate-900">{candidate.candidate_name}</div>
            <div className="text-xs text-slate-600 font-mono mt-0.5">{candidate.mobile_number}</div>
          </div>

          {/* Current Status */}
          <div>
            <Label className="text-xs font-medium text-slate-700">Current Status</Label>
            <div className={`mt-1 inline-flex items-center gap-2 px-3 py-1.5 rounded-md border ${currentMeta.color}`}>
              <span className={`w-2 h-2 rounded-full ${currentMeta.dotColor}`} />
              <span className="font-medium">{currentStatus}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{currentMeta.description}</p>
          </div>

          {/* Allowed Next Statuses */}
          {allowedNext.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
              <AlertCircle className="w-5 h-5 mx-auto text-slate-400 mb-1" />
              <div className="text-sm font-medium text-slate-700">No further transitions available</div>
              <div className="text-xs text-slate-500 mt-1">
                This candidate is in a terminal state.
              </div>
            </div>
          ) : (
            <div>
              <Label className="text-xs font-medium text-slate-700 mb-2 block">
                Move to <ArrowRight className="w-3 h-3 inline -mt-0.5" />
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {allowedNext.map((status) => {
                  const meta = getStatusMeta(status);
                  const isSelected = selectedStatus === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => { setSelectedStatus(status); setError(''); }}
                      className={`text-left p-3 rounded-lg border-2 transition-all min-h-[44px] ${
                        isSelected
                          ? 'border-slate-900 bg-slate-50'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${meta.dotColor}`} />
                          <span className="font-medium text-sm text-slate-900">{status}</span>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-slate-900" />}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{meta.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Special Warnings */}
          {isTerminating && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                After confirming, you'll be taken to the full <strong>Termination Form</strong> to record exit type, last working day, and feedback.
              </div>
            </div>
          )}
          {isHiring && !candidate.employee_id && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-800">
                Remember to link an <strong>Employee record</strong> in the Edit form after marking as Hired.
              </div>
            </div>
          )}

          {/* Effective Date */}
          {allowedNext.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Effective Date of Change <span className="text-red-600">*</span>
              </Label>
              <Input
                type="date"
                value={effectiveDate}
                max={todayISO()}
                onChange={(e) => { setEffectiveDate(e.target.value); setError(''); }}
                className="h-11 md:h-9 text-base md:text-sm"
              />
              <p className="text-xs text-slate-500">
                Defaults to today ({formatDDMMYYYY(todayISO())}). Edit only if the change actually happened on a different day. Used for funnel & attrition analytics.
              </p>
            </div>
          )}

          {/* Remarks */}
          {allowedNext.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">
                Remarks <span className="text-red-600">*</span>
              </Label>
              <Textarea
                value={remarks}
                onChange={(e) => { setRemarks(e.target.value); setError(''); }}
                placeholder="Why is this status changing? (e.g., Candidate confirmed available, passed interview, joined on 06/05/2026)"
                rows={3}
                className="text-base md:text-sm"
              />
              <p className="text-xs text-slate-500">
                Required — adds context to the candidate's timeline and analytics.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 md:h-9"
            disabled={saving}
          >
            Cancel
          </Button>
          {allowedNext.length > 0 && (
            <Button
              onClick={handleConfirm}
              className="h-11 md:h-9"
              disabled={saving || !selectedStatus}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm Status Change
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}