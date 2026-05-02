import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertCircle } from 'lucide-react';

const EMPTY = {
  employee_code: '',
  employee_name: '',
  phone: '',
  email: '',
  department: '',
  designation: '',
  shift_name: '',
  is_active: true,
};

export default function EmployeeFormDialog({ open, employee, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts-active'],
    queryFn: () => base44.entities.ShiftTiming.filter({ is_active: true }, 'shift_name', 100),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setForm(employee ? { ...EMPTY, ...employee } : EMPTY);
      setError('');
    }
  }, [open, employee]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const code = form.employee_code?.trim();
    const name = form.employee_name?.trim();
    if (!code) return setError('Employee code is required');
    if (!name) return setError('Employee name is required');
    if (form.phone && !/^[+\d][\d\s-]{6,19}$/.test(form.phone.trim())) {
      return setError('Phone number looks invalid');
    }

    setSaving(true);
    try {
      await onSubmit({
        ...form,
        employee_code: code,
        employee_name: name,
        phone: form.phone?.trim() || '',
        email: form.email?.trim() || '',
        department: form.department?.trim() || '',
        designation: form.designation?.trim() || '',
        shift_name: form.shift_name?.trim() || '',
      });
    } catch (err) {
      setError(err?.message || 'Failed to save employee');
    } finally {
      setSaving(false);
    }
  };

  const isEdit = !!employee?.id;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Employee' : 'Register New Employee'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">
                Employee Code <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.employee_code}
                onChange={(e) => update('employee_code', e.target.value)}
                placeholder="e.g. 00000040"
                disabled={isEdit}
                className="h-11 md:h-9 text-base md:text-sm"
              />
              <p className="text-xs text-slate-500">Must match the code stored on the biometric device</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.employee_name}
                onChange={(e) => update('employee_name', e.target.value)}
                placeholder="e.g. Sanjit Mishra"
                className="h-11 md:h-9 text-base md:text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Phone Number</Label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="h-11 md:h-9 text-base md:text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="optional"
                className="h-11 md:h-9 text-base md:text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Department</Label>
              <Input
                value={form.department}
                onChange={(e) => update('department', e.target.value)}
                placeholder="e.g. Production"
                className="h-11 md:h-9 text-base md:text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Designation</Label>
              <Input
                value={form.designation}
                onChange={(e) => update('designation', e.target.value)}
                placeholder="e.g. Operator"
                className="h-11 md:h-9 text-base md:text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700">Shift</Label>
            <Select
              value={form.shift_name || 'none'}
              onValueChange={(v) => update('shift_name', v === 'none' ? '' : v)}
            >
              <SelectTrigger className="h-11 md:h-9 text-base md:text-sm">
                <SelectValue placeholder="Use default shift" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Use default shift</SelectItem>
                {shifts.map((s) => (
                  <SelectItem key={s.id} value={s.shift_name}>
                    {s.shift_name} ({s.start_time}–{s.end_time})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">Used by attendance calculation for late/early/overtime</p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={form.is_active !== false}
              onChange={(e) => update('is_active', e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-slate-700">Active</span>
          </label>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="h-11 md:h-9">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="h-11 md:h-9 gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Register Employee'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}