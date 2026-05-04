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
  father_name: '',
  card_number: '',
  phone: '',
  email: '',
  department: '',
  designation: '',
  branch_name: '',
  company_name: '',
  supervisor_email: '',
  supervisor_name: '',
  date_of_birth: '',
  date_of_joining: '',
  weekly_off: '',
  shift_name: '',
  is_active: true,
};

const WEEKLY_OFF_OPTIONS = ['None', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function EmployeeFormDialog({ open, employee, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts-active'],
    queryFn: () => base44.entities.ShiftTiming.filter({ is_active: true }, 'shift_name', 100),
    enabled: open,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments-active'],
    queryFn: () => base44.entities.Department.filter({ is_active: true }, 'department_name', 200),
    enabled: open,
  });

  const { data: designations = [] } = useQuery({
    queryKey: ['designations-active'],
    queryFn: () => base44.entities.Designation.filter({ is_active: true }, 'designation_name', 200),
    enabled: open,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches-active'],
    queryFn: () => base44.entities.Branch.filter({ is_active: true }, 'branch_name', 200),
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
        branch_name: form.branch_name?.trim() || '',
        company_name: form.company_name?.trim() || '',
        supervisor_email: form.supervisor_email?.trim() || '',
        supervisor_name: form.supervisor_name?.trim() || '',
        weekly_off: form.weekly_off?.trim() || '',
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
              <Select
                value={form.department || 'none'}
                onValueChange={(v) => update('department', v === 'none' ? '' : v)}
              >
                <SelectTrigger className="h-11 md:h-9 text-base md:text-sm">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Not assigned —</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.department_name}>{d.department_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">Manage list in HR &gt; Departments</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Designation</Label>
              <Select
                value={form.designation || 'none'}
                onValueChange={(v) => update('designation', v === 'none' ? '' : v)}
              >
                <SelectTrigger className="h-11 md:h-9 text-base md:text-sm">
                  <SelectValue placeholder="Select designation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Not assigned —</SelectItem>
                  {designations.map((d) => (
                    <SelectItem key={d.id} value={d.designation_name}>{d.designation_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Branch</Label>
              <Select
                value={form.branch_name || 'none'}
                onValueChange={(v) => update('branch_name', v === 'none' ? '' : v)}
              >
                <SelectTrigger className="h-11 md:h-9 text-base md:text-sm">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Not assigned —</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.branch_name}>{b.branch_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Weekly Off</Label>
              <Select
                value={form.weekly_off || 'unset'}
                onValueChange={(v) => update('weekly_off', v === 'unset' ? '' : v)}
              >
                <SelectTrigger className="h-11 md:h-9 text-base md:text-sm">
                  <SelectValue placeholder="Select weekly off" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">— Not set —</SelectItem>
                  {WEEKLY_OFF_OPTIONS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700">Supervisor Email</Label>
            <Input
              type="email"
              value={form.supervisor_email}
              onChange={(e) => update('supervisor_email', e.target.value)}
              placeholder="supervisor@company.com"
              className="h-11 md:h-9 text-base md:text-sm"
            />
            <p className="text-xs text-slate-500">Receives attendance anomaly alerts. If empty, the Department head email is used.</p>
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