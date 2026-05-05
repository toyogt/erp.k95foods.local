import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';

const SOURCE_TYPES = ['Market Visit', 'Walk-in', 'Incoming Call', 'Referral'];
const CONTACT_MODES = ['In-person', 'Phone', 'WhatsApp'];
const STATUSES = ['New', 'Contacted', 'Shortlisted', 'Interviewed', 'Hired', 'Rejected', 'On Hold'];

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
  remarks: '',
  is_active: true,
};

export default function CandidateLeadFormDialog({ open, onOpenChange, candidate, onSubmit, saving }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setForm(candidate ? { ...EMPTY, ...candidate } : EMPTY);
      setErrors({});
    }
  }, [open, candidate]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.candidate_name?.trim()) e.candidate_name = 'Candidate name is required';
    if (!form.mobile_number?.trim()) e.mobile_number = 'Mobile number is required';
    else if (!/^[0-9+\-\s()]{6,20}$/.test(form.mobile_number.trim())) e.mobile_number = 'Invalid mobile number';
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
    };
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
            <Input
              value={form.location_area}
              onChange={(e) => set('location_area', e.target.value)}
              placeholder="e.g. Bahadurgarh, Nangloi, Tikri"
              className="h-11 md:h-9 text-base md:text-sm"
            />
          </Field>

          <Field label="Role Interested">
            <Input
              value={form.role_interested}
              onChange={(e) => set('role_interested', e.target.value)}
              placeholder="e.g. Helper, Packing, Loading, Operator"
              className="h-11 md:h-9 text-base md:text-sm"
            />
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