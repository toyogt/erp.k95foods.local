import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const FIELD_INPUT = 'h-11 md:h-9 text-base md:text-sm';
const LABEL_CLASS = 'text-xs font-medium text-slate-700';

/**
 * Personal information section: name, father's name, DOB, gender, nationality,
 * Government UID, residential address.
 */
export default function EmployeePersonalSection({ form, update, isEdit }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-1">
        Personal Information
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className={LABEL_CLASS}>
            Employee Code <span className="text-red-500">*</span>
          </Label>
          <Input
            value={form.employee_code || ''}
            onChange={(e) => update('employee_code', e.target.value)}
            placeholder="e.g. 00000040"
            disabled={isEdit}
            className={FIELD_INPUT}
          />
          <p className="text-xs text-slate-500">Must match the code on the biometric device</p>
        </div>

        <div className="space-y-1">
          <Label className={LABEL_CLASS}>
            Full Name <span className="text-red-500">*</span>
          </Label>
          <Input
            value={form.employee_name || ''}
            onChange={(e) => update('employee_name', e.target.value)}
            placeholder="e.g. Sanjit Mishra"
            className={FIELD_INPUT}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className={LABEL_CLASS}>Father's / Husband's Name</Label>
          <Input
            value={form.father_name || ''}
            onChange={(e) => update('father_name', e.target.value)}
            className={FIELD_INPUT}
          />
        </div>

        <div className="space-y-1">
          <Label className={LABEL_CLASS}>Date of Birth (DD/MM/YYYY)</Label>
          <Input
            value={form.date_of_birth || ''}
            onChange={(e) => update('date_of_birth', e.target.value)}
            placeholder="DD/MM/YYYY"
            className={FIELD_INPUT}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className={LABEL_CLASS}>Gender</Label>
          <Select
            value={form.gender || 'unset'}
            onValueChange={(v) => update('gender', v === 'unset' ? '' : v)}
          >
            <SelectTrigger className={FIELD_INPUT}>
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">— Not set —</SelectItem>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className={LABEL_CLASS}>Nationality</Label>
          <Input
            value={form.nationality || ''}
            onChange={(e) => update('nationality', e.target.value)}
            placeholder="e.g. Indian"
            className={FIELD_INPUT}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className={LABEL_CLASS}>Government UID (Aadhaar / PAN)</Label>
        <Input
          value={form.government_uid || ''}
          onChange={(e) => update('government_uid', e.target.value)}
          className={FIELD_INPUT}
        />
      </div>

      <div className="space-y-1">
        <Label className={LABEL_CLASS}>Residential Address</Label>
        <Input
          value={form.address || ''}
          onChange={(e) => update('address', e.target.value)}
          className={FIELD_INPUT}
        />
      </div>
    </div>
  );
}