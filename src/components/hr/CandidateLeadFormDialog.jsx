import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import CreatableSelect from '@/components/ui/CreatableSelect';
import { Loader2 } from 'lucide-react';
import CandidateEmployeeLinker from './CandidateEmployeeLinker';

const SOURCE_TYPES = ['Market Visit', 'Walk-in', 'Incoming Call', 'Referral'];
const CONTACT_MODES = ['In-person', 'Phone', 'WhatsApp'];
const STATUSES = ['New', 'Contacted', 'Shortlisted', 'Interviewed', 'Hired', 'Rejected', 'On Hold', 'Terminated'];
const EXIT_TYPES = ['Resignation', 'Termination', 'Absconded', 'Retirement', 'End of Contract', 'Other'];

const EMPTY = {
  candidate_name: '',
  mobile_number: '',
  location_area: '',
  role_interested: '',
  source_type: '',
  source_details: '',
  first_contact_mode: '',
  first_contact_date: '',
  status: 'New',
  employee_id: '',
  employee_code: '',
  department: '',
  designation: '',
  enrollment_date: '',
  attrition_date: '',
  attrition_reason: '',
  exit_type: '',
  last_working_day: '',
  eligible_for_rehire: false,
  exit_feedback: '',
  remarks: '',
  is_active: true,
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(fromISO, toISO) {
  if (!fromISO || !toISO) return 0;
  const a = new Date(fromISO).getTime();
  const b = new Date(toISO).getTime();
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24)));
}

export default function CandidateLeadFormDialog({ open, onOpenChange, candidate, onSubmit, saving }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const queryClient = useQueryClient();

  // Master lists for smart dropdowns (auto-grow when user adds new values)
  const { data: locations = [], isLoading: locationsLoading } = useQuery({
    queryKey: ['candidate-locations'],
    queryFn: () => base44.entities.CandidateLocation.filter({ is_active: true }, 'location_name', 500),
    enabled: open,
  });
  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['candidate-roles'],
    queryFn: () => base44.entities.CandidateRole.filter({ is_active: true }, 'role_name', 500),
    enabled: open,
  });

  const locationOptions = locations.map((l) => ({ value: l.location_name, label: l.location_name }));
  const roleOptions = roles.map((r) => ({ value: r.role_name, label: r.role_name }));

  // Create-new handlers (case-insensitive duplicate guard)
  const createLocation = async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return '';
    const dup = locations.find((l) => l.location_name.toLowerCase() === trimmed.toLowerCase());
    if (dup) return dup.location_name;
    await base44.entities.CandidateLocation.create({ location_name: trimmed, is_active: true });
    queryClient.invalidateQueries({ queryKey: ['candidate-locations'] });
    return trimmed;
  };
  const createRole = async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return '';
    const dup = roles.find((r) => r.role_name.toLowerCase() === trimmed.toLowerCase());
    if (dup) return dup.role_name;
    await base44.entities.CandidateRole.create({ role_name: trimmed, is_active: true });
    queryClient.invalidateQueries({ queryKey: ['candidate-roles'] });
    return trimmed;
  };

  useEffect(() => {
    if (open) {
      setForm(candidate ? { ...EMPTY, ...candidate } : EMPTY);
      setErrors({});
    }
  }, [open, candidate]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Auto-fill enrollment_date when status flips to Hired
  useEffect(() => {
    if (form.status === 'Hired' && !form.enrollment_date) {
      set('enrollment_date', todayISO());
    }
    if (form.status === 'Terminated' && !form.attrition_date) {
      set('attrition_date', todayISO());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.status]);

  const isHired = form.status === 'Hired' || form.status === 'Terminated';
  const isTerminated = form.status === 'Terminated';

  const validate = () => {
    const e = {};
    if (!form.candidate_name?.trim()) e.candidate_name = 'Candidate name is required';
    if (!form.mobile_number?.trim()) e.mobile_number = 'Mobile number is required';
    else if (!/^[0-9+\-\s()]{6,20}$/.test(form.mobile_number.trim())) e.mobile_number = 'Invalid mobile number';
    if (isHired && !form.employee_id) e.employee_id = 'Link an employee when status is Hired or Terminated';
    if (isHired && !form.enrollment_date) e.enrollment_date = 'Enrollment date is required';
    if (isTerminated && !form.attrition_date) e.attrition_date = 'Attrition date is required';
    if (isTerminated && form.enrollment_date && form.attrition_date && form.attrition_date < form.enrollment_date) {
      e.attrition_date = 'Attrition date cannot be before enrollment date';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const payload = {
      ...form,
      candidate_name: form.candidate_name.trim(),
      mobile_number: form.mobile_number.trim(),
      location_area: form.location_area?.trim() || '',
      role_interested: form.role_interested?.trim() || '',
      source_details: form.source_details?.trim() || '',
      remarks: form.remarks?.trim() || '',
      attrition_reason: form.attrition_reason?.trim() || '',
      // Compute days_employed if both dates present
      days_employed:
        form.enrollment_date && form.attrition_date
          ? daysBetween(form.enrollment_date, form.attrition_date)
          : undefined,
    };
    // Strip undefined to avoid wiping
    if (payload.days_employed === undefined) delete payload.days_employed;
    onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{candidate ? 'Edit Candidate Lead' : 'New Candidate Lead'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
          <Field label="Candidate Name *" error={errors.candidate_name}>
            <Input
              value={form.candidate_name}
              onChange={(e) => set('candidate_name', e.target.value)}
              placeholder="e.g. Ramesh Kumar"
              className="h-11 md:h-9 text-base md:text-sm"
            />
          </Field>

          <Field label="Mobile Number *" error={errors.mobile_number}>
            <Input
              value={form.mobile_number}
              onChange={(e) => set('mobile_number', e.target.value)}
              placeholder="e.g. 98XXXXXXXX"
              className="h-11 md:h-9 text-base md:text-sm"
            />
          </Field>

          <Field label="Location / Area">
            <CreatableSelect
              value={form.location_area}
              onChange={(v) => set('location_area', v)}
              options={locationOptions}
              onCreate={createLocation}
              loading={locationsLoading}
              placeholder="Select or add (e.g. Bahadurgarh, Nangloi, Tikri)"
            />
            <p className="text-xs text-slate-500 mt-1">Type to search or add new</p>
          </Field>

          <Field label="Role Interested">
            <CreatableSelect
              value={form.role_interested}
              onChange={(v) => set('role_interested', v)}
              options={roleOptions}
              onCreate={createRole}
              loading={rolesLoading}
              placeholder="Select or add (e.g. Helper, Packing, Operator)"
            />
            <p className="text-xs text-slate-500 mt-1">Type to search or add new</p>
          </Field>

          <Field label="Source Type">
            <Select value={form.source_type || ''} onValueChange={(v) => set('source_type', v)}>
              <SelectTrigger className="h-11 md:h-9 text-base md:text-sm">
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field label="First Contact Mode">
            <Select value={form.first_contact_mode || ''} onValueChange={(v) => set('first_contact_mode', v)}>
              <SelectTrigger className="h-11 md:h-9 text-base md:text-sm">
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_MODES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Source Details" full>
            <Input
              value={form.source_details}
              onChange={(e) => set('source_details', e.target.value)}
              placeholder="e.g. Labour chowk near factory gate, referred by Suresh"
              className="h-11 md:h-9 text-base md:text-sm"
            />
          </Field>

          <Field label="First Contact Date">
            <Input
              type="date"
              value={form.first_contact_date || ''}
              onChange={(e) => set('first_contact_date', e.target.value)}
              className="h-11 md:h-9 text-base md:text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">Will be displayed as DD/MM/YYYY</p>
          </Field>

          <Field label="Status">
            <Select value={form.status || 'New'} onValueChange={(v) => set('status', v)}>
              <SelectTrigger className="h-11 md:h-9 text-base md:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          {/* Hired / Terminated section */}
          {isHired && (
            <div className="md:col-span-2 border border-slate-200 rounded-md p-3 bg-slate-50 space-y-3">
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Conversion & Tenure
              </div>

              <CandidateEmployeeLinker
                employeeId={form.employee_id}
                employeeCode={form.employee_code}
                candidateMobile={form.mobile_number}
                onLink={(id, code) => {
                  set('employee_id', id || '');
                  set('employee_code', code || '');
                }}
              />
              {errors.employee_id && <p className="text-xs text-red-600">{errors.employee_id}</p>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Enrollment Date *" error={errors.enrollment_date}>
                  <Input
                    type="date"
                    value={form.enrollment_date || ''}
                    onChange={(e) => set('enrollment_date', e.target.value)}
                    className="h-11 md:h-9 text-base md:text-sm"
                  />
                </Field>

                {isTerminated && (
                  <Field label="Attrition Date *" error={errors.attrition_date}>
                    <Input
                      type="date"
                      value={form.attrition_date || ''}
                      onChange={(e) => set('attrition_date', e.target.value)}
                      className="h-11 md:h-9 text-base md:text-sm"
                    />
                    {form.enrollment_date && form.attrition_date && (
                      <p className="text-xs text-slate-500 mt-1">
                        Tenure: {daysBetween(form.enrollment_date, form.attrition_date)} days
                      </p>
                    )}
                  </Field>
                )}
              </div>

              {isTerminated && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Exit Type">
                      <Select value={form.exit_type || ''} onValueChange={(v) => set('exit_type', v)}>
                        <SelectTrigger className="h-11 md:h-9 text-base md:text-sm">
                          <SelectValue placeholder="Select exit type" />
                        </SelectTrigger>
                        <SelectContent>
                          {EXIT_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field label="Last Working Day">
                      <Input
                        type="date"
                        value={form.last_working_day || ''}
                        onChange={(e) => set('last_working_day', e.target.value)}
                        className="h-11 md:h-9 text-base md:text-sm"
                      />
                    </Field>
                  </div>

                  <Field label="Attrition Reason" full>
                    <Input
                      value={form.attrition_reason}
                      onChange={(e) => set('attrition_reason', e.target.value)}
                      placeholder="e.g. Absconded, Resigned, Personal reasons, Better opportunity"
                      className="h-11 md:h-9 text-base md:text-sm"
                    />
                  </Field>

                  <Field label="Exit Feedback / Interview Notes" full>
                    <Textarea
                      value={form.exit_feedback || ''}
                      onChange={(e) => set('exit_feedback', e.target.value)}
                      placeholder="Reason for leaving, work environment feedback, suggestions, etc."
                      rows={3}
                      className="text-base md:text-sm"
                    />
                  </Field>

                  <div className="flex items-center justify-between border border-slate-200 rounded-md px-3 py-2 bg-white">
                    <div>
                      <Label className="text-xs font-medium text-slate-700">Eligible for Rehire</Label>
                      <p className="text-xs text-slate-500">Mark if this employee can be considered for rehire in future</p>
                    </div>
                    <Switch
                      checked={!!form.eligible_for_rehire}
                      onCheckedChange={(v) => set('eligible_for_rehire', v)}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <Field label="Remarks" full>
            <Textarea
              value={form.remarks}
              onChange={(e) => set('remarks', e.target.value)}
              placeholder="Any additional notes about the candidate..."
              rows={3}
              className="text-base md:text-sm"
            />
          </Field>

          <div className="md:col-span-2 flex items-center justify-between border border-slate-200 rounded-md px-3 py-2">
            <div>
              <Label className="text-xs font-medium text-slate-700">Active</Label>
              <p className="text-xs text-slate-500">Inactive leads are hidden by default</p>
            </div>
            <Switch checked={!!form.is_active} onCheckedChange={(v) => set('is_active', v)} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-11 md:h-9" disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="h-11 md:h-9" disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {candidate ? 'Update' : 'Create'} Lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, children, full }) {
  return (
    <div className={`space-y-1 ${full ? 'md:col-span-2' : ''}`}>
      <Label className="text-xs font-medium text-slate-700">{label}</Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}