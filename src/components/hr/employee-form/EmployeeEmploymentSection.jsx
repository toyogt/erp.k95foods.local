import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const FIELD_INPUT = 'h-11 md:h-9 text-base md:text-sm';
const LABEL_CLASS = 'text-xs font-medium text-slate-700';

const SHIFT_TYPE_OPTIONS = ['Fixed', 'Rotating', 'Flexible'];

/**
 * Employment / organisation section: department, designation, branch,
 * supervisor, joining/resignation dates, shift, biometric IDs.
 */
export default function EmployeeEmploymentSection({
  form,
  update,
  departments,
  designations,
  branches,
  shifts,
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-1">
        Employment & Shift
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className={LABEL_CLASS}>Department</Label>
          <Select
            value={form.department || 'none'}
            onValueChange={(v) => update('department', v === 'none' ? '' : v)}
          >
            <SelectTrigger className={FIELD_INPUT}>
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Not assigned —</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.department_name}>{d.department_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className={LABEL_CLASS}>Designation</Label>
          <Select
            value={form.designation || 'none'}
            onValueChange={(v) => update('designation', v === 'none' ? '' : v)}
          >
            <SelectTrigger className={FIELD_INPUT}>
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
          <Label className={LABEL_CLASS}>Branch</Label>
          <Select
            value={form.branch_name || 'none'}
            onValueChange={(v) => update('branch_name', v === 'none' ? '' : v)}
          >
            <SelectTrigger className={FIELD_INPUT}>
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
          <Label className={LABEL_CLASS}>Date of Joining (DD/MM/YYYY)</Label>
          <Input
            value={form.date_of_joining || ''}
            onChange={(e) => update('date_of_joining', e.target.value)}
            placeholder="DD/MM/YYYY"
            className={FIELD_INPUT}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className={LABEL_CLASS}>Supervisor Email</Label>
          <Input
            type="email"
            value={form.supervisor_email || ''}
            onChange={(e) => update('supervisor_email', e.target.value)}
            placeholder="supervisor@company.com"
            className={FIELD_INPUT}
          />
          <p className="text-xs text-slate-500">If empty, the Department head email is used</p>
        </div>

        <div className="space-y-1">
          <Label className={LABEL_CLASS}>Supervisor Name</Label>
          <Input
            value={form.supervisor_name || ''}
            onChange={(e) => update('supervisor_name', e.target.value)}
            className={FIELD_INPUT}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className={LABEL_CLASS}>Proximity Card Number</Label>
          <Input
            value={form.card_number || ''}
            onChange={(e) => update('card_number', e.target.value)}
            className={FIELD_INPUT}
          />
          <p className="text-xs text-slate-500">From biometric device</p>
        </div>

        <div className="space-y-1">
          <Label className={LABEL_CLASS}>Biometric Enrollment No.</Label>
          <Input
            value={form.enroll_no || ''}
            onChange={(e) => update('enroll_no', e.target.value)}
            className={FIELD_INPUT}
          />
          <p className="text-xs text-slate-500">From biometric device</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className={LABEL_CLASS}>Office Time Policy</Label>
          <Input
            value={form.office_time_policy || ''}
            onChange={(e) => update('office_time_policy', e.target.value)}
            placeholder="e.g. Standard 9-6"
            className={FIELD_INPUT}
          />
        </div>

        <div className="space-y-1">
          <Label className={LABEL_CLASS}>Shift Start Date (DD/MM/YYYY)</Label>
          <Input
            value={form.shift_start_date || ''}
            onChange={(e) => update('shift_start_date', e.target.value)}
            placeholder="DD/MM/YYYY"
            className={FIELD_INPUT}
          />
        </div>

        <div className="space-y-1">
          <Label className={LABEL_CLASS}>Resignation Date (DD/MM/YYYY)</Label>
          <Input
            value={form.resignation_date || ''}
            onChange={(e) => update('resignation_date', e.target.value)}
            placeholder="DD/MM/YYYY"
            className={FIELD_INPUT}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className={LABEL_CLASS}>Shift Type</Label>
          <Select
            value={form.shift_type || 'unset'}
            onValueChange={(v) => update('shift_type', v === 'unset' ? '' : v)}
          >
            <SelectTrigger className={FIELD_INPUT}>
              <SelectValue placeholder="Select shift type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">— Not set —</SelectItem>
              {SHIFT_TYPE_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className={LABEL_CLASS}>Shift</Label>
          <Select
            value={form.shift_name || 'none'}
            onValueChange={(v) => update('shift_name', v === 'none' ? '' : v)}
          >
            <SelectTrigger className={FIELD_INPUT}>
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
          <p className="text-xs text-slate-500">Used by attendance for late/early/overtime</p>
        </div>
      </div>
    </div>
  );
}