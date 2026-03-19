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
import StepChecklistBuilder from './StepChecklistBuilder';
import { Info } from 'lucide-react';

const ANCHOR_HINTS = {
  run_start: 'Timer starts from when the entire process was first triggered — useful for global deadlines across all steps (e.g. "must complete within 5 days of the PR being raised").',
  step_start: 'Timer starts the moment the previous step is marked done — the most common choice.',
};

const TYPE_HINTS = {
  calendar_days: 'Counts every day including weekends and holidays. e.g. "2 days" means exactly 2 × 24h.',
  working_days: 'Skips Saturdays and Sundays. e.g. "2 working days" after Friday = deadline on Tuesday.',
  hours: 'Time measured in hours (no day/weekend skipping). e.g. 48 hours = 2 days exactly.',
};

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
    completion_submode: step?.completion_submode || 'mark_done',
    step_checklist: step?.step_checklist || [],
    auto_complete_event: step?.auto_complete_event || '',
    reminder_hours_before: step?.reminder_hours_before || 2,
  });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic'); // basic | tat | completion

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAssignee = (email) => {
    const u = users?.find(u => u.email === email);
    set('assignee_email', email);
    set('assignee_name', u?.full_name || email);
  };

  const handleTatType = (v) => {
    set('tat_type', v);
    if (v === 'hours') set('tat_unit', 'hours');
    else if (form.tat_unit === 'hours') set('tat_unit', 'day');
  };

  const save = async () => {
    if (!form.name.trim() || !form.assignee_email) return;
    setSaving(true);
    const payload = { ...form };
    if (!payload.fixed_due_time) delete payload.fixed_due_time;
    if (payload.completion_mode !== 'auto') delete payload.auto_complete_event;
    if (payload.completion_submode !== 'checklist') delete payload.step_checklist;
    if (step?.id) {
      await base44.entities.FMSProcessStep.update(step.id, payload);
    } else {
      await base44.entities.FMSProcessStep.create(payload);
    }
    setSaving(false);
    onSaved();
  };

  const unitOptions = form.tat_type === 'hours'
    ? [['hours', 'Hours']]
    : Object.entries(TAT_UNIT_LABELS).filter(([k]) => k !== 'hours');

  // Build human-readable TAT preview
  const tatPreview = (() => {
    if (!form.tat_value) return null;
    const unit = TAT_UNIT_LABELS[form.tat_unit] || form.tat_unit;
    const type = TAT_TYPE_LABELS[form.tat_type] || form.tat_type;
    const anchor = TAT_ANCHOR_LABELS[form.tat_anchor_type] || form.tat_anchor_type;
    const time = form.fixed_due_time && form.tat_type !== 'hours' ? ` at ${form.fixed_due_time}` : '';
    return `${form.tat_value} ${unit} (${type}) after ${anchor}${time}`;
  })();

  const tabs = [
    { id: 'basic', label: 'Details' },
    { id: 'tat', label: 'TAT / Deadline' },
    { id: 'completion', label: 'Completion' },
  ];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{step ? 'Edit Step' : `Add Step ${form.step_order}`}</DialogTitle>
        </DialogHeader>

        {/* Tab nav */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${
                activeTab === t.id ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-4 pt-1">

          {/* ── TAB: BASIC DETAILS ── */}
          {activeTab === 'basic' && (
            <>
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
                <Label>Assignee *</Label>
                {users && users.length > 0 ? (
                  <Select value={form.assignee_email} onValueChange={handleAssignee}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select assignee…" /></SelectTrigger>
                    <SelectContent>
                      {users.map(u => <SelectItem key={u.email} value={u.email}>{u.full_name || u.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={form.assignee_email} onChange={e => set('assignee_email', e.target.value)} placeholder="assignee@company.com" className="mt-1" />
                )}
              </div>
              <div>
                <Label>What to Do (Description)</Label>
                <Textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe the task clearly..." className="mt-1 h-20" />
              </div>
              <div>
                <Label>How to Do It (Instructions)</Label>
                <Textarea value={form.instructions} onChange={e => set('instructions', e.target.value)} placeholder="Step-by-step instructions..." className="mt-1 h-20" />
              </div>
            </>
          )}

          {/* ── TAB: TAT / DEADLINE ── */}
          {activeTab === 'tat' && (
            <div className="space-y-4">
              {/* Count Type */}
              <div>
                <Label className="text-sm">Count Type — how is time measured?</Label>
                <Select value={form.tat_type} onValueChange={handleTatType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TAT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {TYPE_HINTS[form.tat_type] && (
                  <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mt-2 flex gap-2">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />{TYPE_HINTS[form.tat_type]}
                  </p>
                )}
              </div>

              {/* Value + Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Duration Value</Label>
                  <Input type="number" value={form.tat_value} onChange={e => set('tat_value', Number(e.target.value))} className="mt-1" min={1} />
                </div>
                <div>
                  <Label className="text-sm">Unit</Label>
                  <Select value={form.tat_unit} onValueChange={v => set('tat_unit', v)} disabled={form.tat_type === 'hours'}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {unitOptions.map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Anchor */}
              <div>
                <Label className="text-sm">Start Counting From (Anchor)</Label>
                <Select value={form.tat_anchor_type} onValueChange={v => set('tat_anchor_type', v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TAT_ANCHOR_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {ANCHOR_HINTS[form.tat_anchor_type] && (
                  <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mt-2 flex gap-2">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />{ANCHOR_HINTS[form.tat_anchor_type]}
                  </p>
                )}
              </div>

              {/* Fixed Due Time — hide for hours type */}
              {form.tat_type !== 'hours' && (
                <div>
                  <Label className="text-sm">Fixed Due Time <span className="text-slate-400 font-normal">(optional)</span></Label>
                  <Input type="time" value={form.fixed_due_time} onChange={e => set('fixed_due_time', e.target.value)} className="mt-1" />
                  <p className="text-xs text-slate-400 mt-1">
                    Pins the deadline to a specific clock time (e.g. 17:00 = 5pm). Leave blank to use time-of-day from when the step starts.
                  </p>
                </div>
              )}

              {/* Preview */}
              {tatPreview && (
                <div className="bg-slate-800 text-white rounded-xl px-4 py-3 text-sm">
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-1">Deadline Preview</p>
                  <p className="font-semibold">Due: {tatPreview}</p>
                </div>
              )}

              {/* Reminder */}
              <div>
                <Label className="text-sm">Send Reminder (hours before deadline)</Label>
                <Input type="number" value={form.reminder_hours_before} onChange={e => set('reminder_hours_before', Number(e.target.value))} className="mt-1" min={0} />
              </div>
            </div>
          )}

          {/* ── TAB: COMPLETION ── */}
          {activeTab === 'completion' && (
            <div className="space-y-4">
              {/* Completion Mode */}
              <div>
                <Label className="text-sm">How is this step completed?</Label>
                <Select value={form.completion_mode} onValueChange={v => set('completion_mode', v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual — user marks it done</SelectItem>
                    <SelectItem value="auto">Auto — triggered by an app event</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Manual sub-mode */}
              {form.completion_mode === 'manual' && (
                <div>
                  <Label className="text-sm">Manual Completion Type</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => set('completion_submode', 'mark_done')}
                      className={`border rounded-xl p-3 text-left transition ${
                        form.completion_submode === 'mark_done'
                          ? 'border-slate-800 bg-slate-800 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                      }`}
                    >
                      <p className="font-semibold text-sm">Mark Done</p>
                      <p className={`text-xs mt-1 ${form.completion_submode === 'mark_done' ? 'text-slate-300' : 'text-slate-400'}`}>
                        Simple one-tap completion. Optionally add a note.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => set('completion_submode', 'checklist')}
                      className={`border rounded-xl p-3 text-left transition ${
                        form.completion_submode === 'checklist'
                          ? 'border-slate-800 bg-slate-800 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                      }`}
                    >
                      <p className="font-semibold text-sm">With Checklist</p>
                      <p className={`text-xs mt-1 ${form.completion_submode === 'checklist' ? 'text-slate-300' : 'text-slate-400'}`}>
                        User fills a form (text, photos, videos, checkboxes) before marking done.
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {/* Checklist builder */}
              {form.completion_mode === 'manual' && form.completion_submode === 'checklist' && (
                <div>
                  <Label className="text-sm mb-2 block">Checklist Items</Label>
                  <StepChecklistBuilder
                    items={form.step_checklist}
                    onChange={items => set('step_checklist', items)}
                  />
                </div>
              )}

              {/* Auto event picker */}
              {form.completion_mode === 'auto' && (
                <div>
                  <Label className="text-sm">Auto-Complete Event</Label>
                  <Select value={form.auto_complete_event} onValueChange={v => set('auto_complete_event', v)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select the app event that completes this step…" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(groupEventsByCategory(COMPLETE_EVENTS)).map(([cat, events]) => (
                        <div key={cat}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">{cat}</div>
                          {events.map(e => <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>)}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">This step auto-completes when the selected app event fires</p>
                </div>
              )}
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