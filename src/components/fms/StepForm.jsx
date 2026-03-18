import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function StepForm({ step, processId, nextStepNumber, onSave, onCancel }) {
  const [form, setForm] = useState({
    process_id: processId,
    step_number: step?.step_number ?? nextStepNumber ?? 1,
    name: step?.name || '',
    description: step?.description || '',
    assignee_email: step?.assignee_email || '',
    assignee_name: step?.assignee_name || '',
    tat_type: step?.tat_type || 'fixed_hours',
    tat_hours: step?.tat_hours ?? 2,
    tat_business_days: step?.tat_business_days ?? 1,
    tat_fixed_time: step?.tat_fixed_time || '17:00',
    tat_eod_time: step?.tat_eod_time || '18:00',
    completion_type: step?.completion_type || 'manual',
    completion_webhook_field: step?.completion_webhook_field || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (step?.id) {
        await base44.entities.ProcessStep.update(step.id, form);
      } else {
        await base44.entities.ProcessStep.create(form);
      }
      onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm font-medium">Step Number</Label>
          <Input type="number" value={form.step_number} onChange={e => set('step_number', Number(e.target.value))}
            className="mt-1" min={1} required />
        </div>
        <div>
          <Label className="text-sm font-medium">Step Name *</Label>
          <Input value={form.name} onChange={e => set('name', e.target.value)} required
            className="mt-1" placeholder="e.g. Prepare PO" />
        </div>
      </div>
      <div>
        <Label className="text-sm font-medium">Description (the HOW)</Label>
        <Textarea value={form.description} onChange={e => set('description', e.target.value)}
          className="mt-1" rows={2} placeholder="Detailed instructions for this step" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm font-medium">Assignee Email</Label>
          <Input value={form.assignee_email} onChange={e => set('assignee_email', e.target.value)}
            className="mt-1" type="email" placeholder="who@company.com" />
        </div>
        <div>
          <Label className="text-sm font-medium">Assignee Name</Label>
          <Input value={form.assignee_name} onChange={e => set('assignee_name', e.target.value)}
            className="mt-1" placeholder="Display name" />
        </div>
      </div>
      <div>
        <Label className="text-sm font-medium">TAT Type</Label>
        <Select value={form.tat_type} onValueChange={v => set('tat_type', v)}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed_hours">Fixed Hours</SelectItem>
            <SelectItem value="end_of_day">End of Day</SelectItem>
            <SelectItem value="fixed_time">Fixed Time</SelectItem>
            <SelectItem value="business_days">Business Days</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {form.tat_type === 'fixed_hours' && (
        <div>
          <Label className="text-sm font-medium">Hours</Label>
          <Input type="number" value={form.tat_hours} onChange={e => set('tat_hours', Number(e.target.value))}
            className="mt-1" min={0.5} step={0.5} />
        </div>
      )}
      {form.tat_type === 'end_of_day' && (
        <div>
          <Label className="text-sm font-medium">End-of-Day Time (HH:MM)</Label>
          <Input value={form.tat_eod_time} onChange={e => set('tat_eod_time', e.target.value)}
            className="mt-1" placeholder="18:00" />
        </div>
      )}
      {form.tat_type === 'fixed_time' && (
        <div>
          <Label className="text-sm font-medium">Fixed Time (HH:MM)</Label>
          <Input value={form.tat_fixed_time} onChange={e => set('tat_fixed_time', e.target.value)}
            className="mt-1" placeholder="17:00" />
        </div>
      )}
      {form.tat_type === 'business_days' && (
        <div>
          <Label className="text-sm font-medium">Business Days</Label>
          <Input type="number" value={form.tat_business_days} onChange={e => set('tat_business_days', Number(e.target.value))}
            className="mt-1" min={1} />
        </div>
      )}
      <div>
        <Label className="text-sm font-medium">Completion Type</Label>
        <Select value={form.completion_type} onValueChange={v => set('completion_type', v)}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Manual — person marks it done</SelectItem>
            <SelectItem value="auto">Auto — external signal</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {form.completion_type === 'auto' && (
        <div>
          <Label className="text-sm font-medium">Completion Webhook Field</Label>
          <Input value={form.completion_webhook_field} onChange={e => set('completion_webhook_field', e.target.value)}
            className="mt-1" placeholder="Field that signals completion" />
        </div>
      )}
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving} className="flex-1 min-h-[48px]">
          {saving ? 'Saving…' : step?.id ? 'Update Step' : 'Add Step'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="min-h-[48px]">
          Cancel
        </Button>
      </div>
    </form>
  );
}