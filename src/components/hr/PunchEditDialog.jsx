import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

// Convert UTC ISO datetime → local datetime-local input value (YYYY-MM-DDTHH:mm)
function isoToLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Convert local datetime-local input → UTC ISO
function localInputToIso(local) {
  if (!local) return null;
  const d = new Date(local);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

// DD/MM/YYYY for log_date
function isoDateToDDMMYYYY(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// HH:mm:ss
function isoToTimeStr(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function PunchEditDialog({ open, mode, punch, onClose, onSubmit, saving }) {
  const [form, setForm] = useState({
    employee_code: '',
    employee_name: '',
    log_datetime_local: '',
    punch_direction: 'IN',
    device_sn: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setError('');
      setForm({
        employee_code: punch?.employee_code || '',
        employee_name: punch?.employee_name || '',
        log_datetime_local: isoToLocalInput(punch?.log_datetime),
        punch_direction: punch?.punch_direction || 'IN',
        device_sn: punch?.device_sn || 'MANUAL',
      });
    }
  }, [open, punch]);

  const handleSave = () => {
    if (!form.employee_code.trim()) return setError('Employee code is required');
    if (!form.log_datetime_local) return setError('Date & time is required');
    const iso = localInputToIso(form.log_datetime_local);
    if (!iso) return setError('Invalid date/time');

    const payload = {
      employee_code: form.employee_code.trim(),
      employee_name: form.employee_name.trim(),
      log_datetime: iso,
      log_date: isoDateToDDMMYYYY(iso),
      log_time: isoToTimeStr(iso),
      punch_direction: form.punch_direction,
      device_sn: form.device_sn.trim() || 'MANUAL',
      dedup_key: `${form.employee_code.trim()}|${iso}|${form.device_sn.trim() || 'MANUAL'}`,
    };

    if (mode === 'create') {
      payload.downloaded_at = new Date().toISOString();
      payload.delivery_status = 'NOT_QUEUED';
      payload.raw_payload = { source: 'manual_entry' };
    }

    onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add Punch' : 'Edit Punch'}</DialogTitle>
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

          {error && (
            <div className="text-xs bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2">{error}</div>
          )}
          <p className="text-xs text-slate-500">
            Saving will automatically re-run the daily attendance calculation for this date.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving} className="h-11 md:h-9">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="h-11 md:h-9 gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'create' ? 'Create Punch' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}