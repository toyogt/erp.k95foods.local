import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

export default function ShiftTimingForm({ open, shift, onClose, onSubmit, saving }) {
  const [form, setForm] = useState({
    shift_name: '',
    start_time: '09:00',
    end_time: '18:00',
    grace_minutes_late: 10,
    grace_minutes_early: 10,
    break_minutes: 30,
    overtime_threshold_minutes: 0,
    is_default: false,
    is_active: true,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setError('');
      setForm({
        shift_name: shift?.shift_name || '',
        start_time: shift?.start_time || '09:00',
        end_time: shift?.end_time || '18:00',
        grace_minutes_late: shift?.grace_minutes_late ?? 10,
        grace_minutes_early: shift?.grace_minutes_early ?? 10,
        break_minutes: shift?.break_minutes ?? 30,
        overtime_threshold_minutes: shift?.overtime_threshold_minutes ?? 0,
        is_default: shift?.is_default || false,
        is_active: shift?.is_active !== false,
      });
    }
  }, [open, shift]);

  const handleSave = () => {
    if (!form.shift_name.trim()) return setError('Shift name is required');
    if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(form.start_time)) return setError('Invalid start time (HH:mm)');
    if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(form.end_time)) return setError('Invalid end time (HH:mm)');
    onSubmit({
      ...form,
      shift_name: form.shift_name.trim(),
      grace_minutes_late: Number(form.grace_minutes_late) || 0,
      grace_minutes_early: Number(form.grace_minutes_early) || 0,
      break_minutes: Number(form.break_minutes) || 0,
      overtime_threshold_minutes: Number(form.overtime_threshold_minutes) || 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{shift ? 'Edit Shift Timing' : 'New Shift Timing'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700">Shift Name *</Label>
            <Input
              value={form.shift_name}
              onChange={(e) => setForm({ ...form, shift_name: e.target.value })}
              placeholder="e.g. General Day, Morning Shift"
              className="h-11 md:h-9 text-base md:text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Start Time *</Label>
              <Input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className="h-11 md:h-9 text-base md:text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">End Time *</Label>
              <Input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className="h-11 md:h-9 text-base md:text-sm"
              />
              <p className="text-xs text-slate-500">If end ≤ start, shift crosses midnight</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Grace - Late Arrival (min)</Label>
              <Input
                type="number" min="0"
                value={form.grace_minutes_late}
                onChange={(e) => setForm({ ...form, grace_minutes_late: e.target.value })}
                className="h-11 md:h-9 text-base md:text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Grace - Early Out (min)</Label>
              <Input
                type="number" min="0"
                value={form.grace_minutes_early}
                onChange={(e) => setForm({ ...form, grace_minutes_early: e.target.value })}
                className="h-11 md:h-9 text-base md:text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Break Deduction (min)</Label>
              <Input
                type="number" min="0"
                value={form.break_minutes}
                onChange={(e) => setForm({ ...form, break_minutes: e.target.value })}
                className="h-11 md:h-9 text-base md:text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Overtime Threshold (min)</Label>
              <Input
                type="number" min="0"
                value={form.overtime_threshold_minutes}
                onChange={(e) => setForm({ ...form, overtime_threshold_minutes: e.target.value })}
                className="h-11 md:h-9 text-base md:text-sm"
              />
              <p className="text-xs text-slate-500">Minutes past end time before counting as overtime</p>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                className="w-4 h-4"
              />
              Default shift (used when employee has none assigned)
            </label>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4"
              />
              Active
            </label>
          </div>

          {error && (
            <div className="text-xs bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2">{error}</div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving} className="h-11 md:h-9">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="h-11 md:h-9 gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {shift ? 'Save Changes' : 'Create Shift'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}