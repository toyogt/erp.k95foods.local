import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { TAT_TYPE_LABELS } from '@/lib/fmsHelpers';

export default function StepForm({ step, processId, nextOrder, users, onClose, onSaved }) {
  const [form, setForm] = useState({
    process_id: processId,
    step_order: step?.step_order || nextOrder || 1,
    name: step?.name || '',
    description: step?.description || '',
    instructions: step?.instructions || '',
    assignee_email: step?.assignee_email || '',
    assignee_name: step?.assignee_name || '',
    tat_type: step?.tat_type || 'fixed_hours',
    tat_value: step?.tat_value || 24,
    tat_time: step?.tat_time || '18:00',
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

  const save = async () => {
    if (!form.name.trim() || !form.assignee_email) return;
    setSaving(true);
    if (step?.id) {
      await base44.entities.FMSProcessStep.update(step.id, form);
    } else {
      await base44.entities.FMSProcessStep.create(form);
    }
    setSaving(false);
    onSaved();
  };

  const showTatValue = ['fixed_hours', 'business_days'].includes(form.tat_type);
  const showTatTime = ['end_of_day', 'fixed_clock_time'].includes(form.tat_type);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{step ? 'Edit Step' : `Add Step ${form.step_order}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
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
          <div>
            <Label>What to Do (Description)</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe the task clearly..." className="mt-1 h-20" />
          </div>
          <div>
            <Label>How to Do It (Instructions)</Label>
            <Textarea value={form.instructions} onChange={e => set('instructions', e.target.value)} placeholder="Step-by-step instructions..." className="mt-1 h-20" />
          </div>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>TAT Type</Label>
              <Select value={form.tat_type} onValueChange={v => set('tat_type', v)}>
                <SelectTrigger className="mt-1">
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
              {showTatValue && (
                <>
                  <Label>{form.tat_type === 'business_days' ? 'Business Days' : 'Hours'}</Label>
                  <Input type="number" value={form.tat_value} onChange={e => set('tat_value', Number(e.target.value))} className="mt-1" min={1} />
                </>
              )}
              {showTatTime && (
                <>
                  <Label>Time (HH:MM)</Label>
                  <Input type="time" value={form.tat_time} onChange={e => set('tat_time', e.target.value)} className="mt-1" />
                </>
              )}
            </div>
          </div>
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
              <Label>Auto-Complete Event Key</Label>
              <Input value={form.auto_complete_event} onChange={e => set('auto_complete_event', e.target.value)} placeholder="e.g. grn_received, po_approved" className="mt-1" />
              <p className="text-xs text-slate-500 mt-1">App fires this event to auto-complete this step</p>
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