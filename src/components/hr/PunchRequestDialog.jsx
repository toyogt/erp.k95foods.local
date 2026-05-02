import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

function isoToLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToIso(local) {
  if (!local) return null;
  const d = new Date(local);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function isoDateToDDMMYYYY(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Submit a manual punch ADD or EDIT request (approval-gated).
 * For DELETE requests, use a separate confirm flow that calls onSubmit directly.
 */
export default function PunchRequestDialog({ open, mode, sourceLog, onClose, onSubmit, saving }) {
  const [form, setForm] = useState({
    employee_code: '',
    employee_name: '',
    log_datetime_local: '',
    punch_direction: 'IN',
    device_sn: 'MANUAL',
    reason: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setError('');
      setForm({
        employee_code: sourceLog?.employee_code || '',
        employee_name: sourceLog?.employee_name || '',
        log_datetime_local: isoToLocalInput(sourceLog?.log_datetime),
        punch_direction: sourceLog?.punch_direction || 'IN',
        device_sn: sourceLog?.device_sn || 'MANUAL',
        reason: '',
      });
    }
  }, [open, sourceLog]);

  const handleSave = () => {
    if (!form.employee_code.trim()) return setError('Employee code is required');
    if (!form.log_datetime_local) return setError('Date & time is required');
    if (!form.reason.trim()) return setError('Reason is required');
    const iso = localInputToIso(form.log_datetime_local);
    if (!iso) return setError('Invalid date/time');

    onSubmit({
      request_type: mode,
      target_log_id: mode === 'edit' ? sourceLog?.id : '',
      employee_code: form.employee_code.trim(),
      employee_name: form.employee_name.trim(),
      log_datetime: iso,
      log_date: isoDateToDDMMYYYY(iso),
      punch_direction: form.punch_direction,
      device_sn: form.device_sn.trim() || 'MANUAL',
      reason: form.reason.trim(),
      previous_values: mode === 'edit' && sourceLog ? {
        employee_code: sourceLog.employee_code,
        log_datetime: sourceLog.log_datetime,
        punch_direction: sourceLog.punch_direction,
        device_sn: sourceLog.device_sn,
      } : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'add' ? 'Request: Add Punch' : 'Request: Edit Punch'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Employee Code *</Label>
              <Input
                value={form.employee_code}
                onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
                placeholder="e.g. RT001"
                className="h-11 md:h-9 text-base md:text-sm"
                disabled={mode === 'edit'}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Employee Name</Label>
              <Input
                value={form.employee_name}
                onChange={(e) => setForm({ ...form, employee_name: e.target.value })}
                placeholder="Optional"
                className="h-11 md:h-9 text-base md:text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700">Punch Date & Time *</Label>
            <Input
              type="datetime-local"
              value={form.log_datetime_local}
              onChange={(e) => setForm({ ...form, log_datetime_local: e.target.value })}
              className="h-11 md:h-9 text-base md:text-sm"
            />
            <p className="text-xs text-slate-500">Local time (Asia/Calcutta)</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Direction *</Label>
              <select
                value={form.punch_direction}
                onChange={(e) => setForm({ ...form, punch_direction: e.target.value })}
                className="h-11 md:h-9 w-full border border-slate-200 rounded-md px-3 text-base md:text-sm bg-white"
              >
                <option value="IN">IN</option>
                <option value="OUT">OUT</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Device Serial</Label>
              <Input
                value={form.device_sn}
                onChange={(e) => setForm({ ...form, device_sn: e.target.value })}
                placeholder="MANUAL"
                className="h-11 md:h-9 text-base md:text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700">Reason for Change *</Label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="e.g. Forgot to punch out, biometric device offline..."
              rows={3}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-base md:text-sm"
            />
            <p className="text-xs text-slate-500">Will be visible to the approver</p>
          </div>

          {error && (
            <div className="text-xs bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2">{error}</div>
          )}
          <p className="text-xs text-slate-500">
            Request will be sent for approval. Daily attendance is recalculated only after the request is approved.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving} className="h-11 md:h-9">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="h-11 md:h-9 gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}