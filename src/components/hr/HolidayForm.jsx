import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

function isoToDDMMYYYY(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function HolidayForm({ open, holiday, onClose, onSubmit, saving }) {
  const [form, setForm] = useState({
    holiday_date_iso: '',
    holiday_name: '',
    holiday_type: 'gazetted',
    is_paid: true,
    remarks: '',
    is_active: true,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setError('');
      setForm({
        holiday_date_iso: holiday?.holiday_date_iso || '',
        holiday_name: holiday?.holiday_name || '',
        holiday_type: holiday?.holiday_type || 'gazetted',
        is_paid: holiday?.is_paid !== false,
        remarks: holiday?.remarks || '',
        is_active: holiday?.is_active !== false,
      });
    }
  }, [open, holiday]);

  const handleSave = () => {
    if (!form.holiday_date_iso) return setError('Date is required');
    if (!form.holiday_name.trim()) return setError('Holiday name is required');
    onSubmit({
      ...form,
      holiday_name: form.holiday_name.trim(),
      holiday_date: isoToDDMMYYYY(form.holiday_date_iso),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{holiday ? 'Edit Holiday' : 'New Holiday'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Date *</Label>
              <Input
                type="date"
                value={form.holiday_date_iso}
                onChange={(e) => setForm({ ...form, holiday_date_iso: e.target.value })}
                className="h-11 md:h-9 text-base md:text-sm"
              />
              {form.holiday_date_iso && (
                <p className="text-xs text-slate-500">Stored as: {isoToDDMMYYYY(form.holiday_date_iso)}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Type</Label>
              <select
                value={form.holiday_type}
                onChange={(e) => setForm({ ...form, holiday_type: e.target.value })}
                className="h-11 md:h-9 w-full border border-slate-200 rounded-md px-3 text-base md:text-sm bg-white"
              >
                <option value="gazetted">Gazetted</option>
                <option value="restricted">Restricted</option>
                <option value="optional">Optional</option>
                <option value="weekly_off">Weekly Off</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700">Holiday Name *</Label>
            <Input
              value={form.holiday_name}
              onChange={(e) => setForm({ ...form, holiday_name: e.target.value })}
              placeholder="e.g. Republic Day, Diwali"
              className="h-11 md:h-9 text-base md:text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700">Remarks</Label>
            <Input
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              placeholder="Optional notes"
              className="h-11 md:h-9 text-base md:text-sm"
            />
          </div>

          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_paid}
                onChange={(e) => setForm({ ...form, is_paid: e.target.checked })}
                className="w-4 h-4"
              />
              Paid
            </label>
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
            {holiday ? 'Save Changes' : 'Create Holiday'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}