import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { TAT_TYPE_LABELS, TAT_UNIT_LABELS, TAT_ANCHOR_LABELS } from '@/lib/fmsHelpers';
import { COMPLETE_EVENTS, groupEventsByCategory } from '@/lib/fmsAppEvents';

export default function StepForm({ step, processId, nextOrder, users, onClose, onSaved }) {
  const [form, setForm] = useState({
    process_id: processId,
    step_order: step?.step_order || nextOrder || 1,
    name: step?.name || '',
    description: step?.description || '',
    instructions: step?.instructions || '',
    assignee_email: step?.assignee_email || '',
    assignee_name: step?.assignee_name || '',
    tat_type: step?.tat_type || 'calendar_days',
    tat_unit: step?.tat_unit || 'day',
    tat_value: step?.tat_value || 2,
    tat_anchor_type: step?.tat_anchor_type || 'step_start',
    fixed_due_time: step?.fixed_due_time || '',
    completion_mode: step?.completion_mode || 'manual',
    auto_complete_event: step?.auto_complete_event || '',
    reminder_hours_before: step?.reminder_hours_before || 2,
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAssignee = (email) => {
    const u = users?.find(u => u.email === email);
    set('assignee_email', email);
    set('assignee_name', u?.full_name || email);
  };

  // When type is hours, force unit to hours
  const handleTatType = (v) => {
    set('tat_type', v);
    if (v === 'hours') set('tat_unit', 'hours');
    else if (form.tat_unit === 'hours') set('tat_unit', 'day');
  };

  const save = async () => {
    if (!form.name.trim() || !form.assignee_email) return;
    setSaving(true);
    const payload = { ...form };
    // Clean up unused fields
    if (!payload.fixed_due_time) delete payload.fixed_due_time;
    if (payload.completion_mode !== 'auto') delete payload.auto_complete_event;
    if (step?.id) {
      await base44.entities.FMSProcessStep.update(step.id, payload);
    } else {
      await base44.entities.FMSProcessStep.create(payload);
    }
    setSaving(false);
    onSaved();
  };

  const unitOptions = form.tat_type === 'hours'
    ? [{ k: 'hours', v: 'Hours' }]
    : Object.entries(TAT_UNIT_LABELS).filter(([k]) => k !== 'hours');

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{step ? 'Edit Step' : `Add Step ${form.step_order}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Step Order + Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Step Order</Label>
              <Input type="number" value={form.step_order} onChange={e => set('step_order', Number(e.target.value))} className="mt-1" min={1} />
            </div>
            <div>
              <Label>Step Name *</Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Manager Approval" className="mt-1" />
            </div>
          </div>

          {/* Description + Instructions */}
          <div>
            <Label>What to Do (Description)</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe the task clearly..." className="mt-1 h-20" />
          </div>
          <div>
            <Label>How to Do It (Instructions)</Label>
            <Textarea value={form.instructions} onChange={e => set('instructions', e.target.value)} placeholder="Step-by-step instructions..." className="mt-1 h-20" />
          </div>

          {/* Assignee */}
          <div>
            <Label>Assignee *</Label>
            {users && users.length > 0 ? (
              <Select value={form.assignee_email} onValueChange={handleAssignee}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select assignee…" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.email} value={u.email}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={form.assignee_email} onChange={e => set('assignee_email', e.target.value)} placeholder="assignee@company.com" className="mt-1" />
            )}
          </div>

          {/* TAT Section */}
          <div className="border border-slate-200 rounded-xl p-3 space-y-3 bg-slate-50">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Turnaround Time (TAT)</p>

            {/* TAT Type + Value + Unit */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Count Type</Label>
                <Select value={form.tat_type} onValueChange={handleTatType}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TAT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Value</Label>
                <Input type="number" value={form.tat_value} onChange={e => set('tat_value', Number(e.target.value))} className="mt-1 h-9" min={1} />
              </div>
              <div>
                <Label className="text-xs">Unit</Label>
                <Select value={form.tat_unit} onValueChange={v => set('tat_unit', v)} disabled={form.tat_type === 'hours'}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {unitOptions.map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* TAT Anchor */}
            <div>
              <Label className="text-xs">Calculated From (Anchor)</Label>
              <Select value={form.tat_anchor_type} onValueChange={v => set('tat_anchor_type', v)}>
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TAT_ANCHOR_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Optional fixed due time */}
            <div>
              <Label className="text-xs">Fixed Due Time (optional, e.g. 17:00)</Label>
              <Input type="time" value={form.fixed_due_time} onChange={e => set('fixed_due_time', e.target.value)} className="mt-1 h-9" placeholder="HH:MM" />
              <p className="text-xs text-slate-400 mt-1">Pins the deadline to a specific time of day</p>
            </div>

            {/* Preview */}
            {form.tat_value > 0 && (
              <div className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-600">
                <span className="font-medium">Due:</span> {form.tat_value} {TAT_UNIT_LABELS[form.tat_unit] || form.tat_unit} ({TAT_TYPE_LABELS[form.tat_type]}) after{' '}
                {TAT_ANCHOR_LABELS[form.tat_anchor_type]}{form.fixed_due_time ? ` at ${form.fixed_due_time}` : ''}
              </div>
            )}
          </div>

          {/* Completion Mode + Reminder */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Completion Mode</Label>
              <Select value={form.completion_mode} onValueChange={v => set('completion_mode', v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual (user marks done)</SelectItem>
                  <SelectItem value="auto">Auto (app event)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reminder (hours before)</Label>
              <Input type="number" value={form.reminder_hours_before} onChange={e => set('reminder_hours_before', Number(e.target.value))} className="mt-1" min={0} />
            </div>
          </div>

          {form.completion_mode === 'auto' && (
            <div>
              <Label>Auto-Complete Event</Label>
              <Select value={form.auto_complete_event} onValueChange={v => set('auto_complete_event', v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select the app event that completes this step…" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groupEventsByCategory(COMPLETE_EVENTS)).map(([cat, events]) => (
                    <div key={cat}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">{cat}</div>
                      {events.map(e => (
                        <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">This step auto-completes when the selected app event fires</p>
            </div>
          )}

          <div className="flex gap-2 pt-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.name.trim() || !form.assignee_email} className="min-w-[100px] min-h-[44px]">
              {saving ? 'Saving…' : 'Save Step'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}