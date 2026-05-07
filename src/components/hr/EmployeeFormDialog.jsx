import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';
import EmployeePersonalSection from './employee-form/EmployeePersonalSection';
import EmployeeContactBankSection from './employee-form/EmployeeContactBankSection';
import EmployeeEmploymentSection from './employee-form/EmployeeEmploymentSection';
import EmployeeNotificationsSection from './employee-form/EmployeeNotificationsSection';

const EMPTY = {
  // Personal
  employee_code: '',
  employee_name: '',
  father_name: '',
  date_of_birth: '',
  gender: '',
  nationality: '',
  government_uid: '',
  address: '',

  // Contact & Bank
  phone: '',
  email: '',
  attachment_1_url: '',
  attachment_2_url: '',
  bank_name: '',
  bank_account_number: '',
  bank_ifsc_code: '',

  // Employment
  card_number: '',
  enroll_no: '',
  department: '',
  designation: '',
  branch_name: '',
  company_name: '',
  supervisor_email: '',
  supervisor_name: '',
  date_of_joining: '',
  office_time_policy: '',
  shift_start_date: '',
  resignation_date: '',
  shift_type: '',
  shift_name: '',
  weekly_off: '',

  // Notifications & mobile attendance
  telegram_token: '',
  chat_id: '',
  allow_notifications: true,
  auto_approved_gps_punch: false,
  mobile_attendance_mode: '',

  is_active: true,
};

// Trim every string field before saving
function normalize(form) {
  const out = { ...form };
  Object.keys(out).forEach((k) => {
    if (typeof out[k] === 'string') out[k] = out[k].trim();
  });
  return out;
}

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

    const normalized = normalize(form);
    if (!normalized.employee_code) return setError('Employee code is required');
    if (!normalized.employee_name) return setError('Employee name is required');
    if (normalized.phone && !/^[+\d][\d\s-]{6,19}$/.test(normalized.phone)) {
      return setError('Phone number looks invalid');
    }

    setSaving(true);
    try {
      await onSubmit(normalized);
    } catch (err) {
      setError(err?.message || 'Failed to save employee');
    } finally {
      setSaving(false);
    }
  };

  const isEdit = !!employee?.id;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Employee' : 'Register New Employee'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <EmployeePersonalSection form={form} update={update} isEdit={isEdit} />

          <EmployeeContactBankSection form={form} update={update} />

          <EmployeeEmploymentSection
            form={form}
            update={update}
            departments={departments}
            designations={designations}
            branches={branches}
            shifts={shifts}
          />

          <EmployeeNotificationsSection form={form} update={update} />

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