import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit2, Power, Loader2, Clock, Calendar } from 'lucide-react';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PRIORITY_COLORS = { HIGH: 'bg-red-100 text-red-700', MEDIUM: 'bg-yellow-100 text-yellow-700', LOW: 'bg-slate-100 text-slate-600' };

function ScheduleLabel({ tmpl }) {
  if (tmpl.schedule_type === 'daily') return <span>Daily at {tmpl.schedule_time}</span>;
  if (tmpl.schedule_type === 'weekly') {
    const days = (tmpl.schedule_days_of_week || []).map(d => DAY_LABELS[d]).join(', ');
    return <span>Every {days} at {tmpl.schedule_time}</span>;
  }
  if (tmpl.schedule_type === 'monthly') return <span>Monthly on day {tmpl.schedule_day_of_month} at {tmpl.schedule_time}</span>;
  return <span>{tmpl.schedule_type}</span>;
}

export default function TaskTemplateManager({ templates, groups, users, onSaved }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [form, setForm] = useState({
    task_name: '', description: '', group_id: '', assignee_email: '',
    schedule_type: 'daily', schedule_time: '09:00', schedule_days_of_week: [1],
    schedule_day_of_month: 1, due_hours: 24, priority: 'MEDIUM',
  });

  const openNew = () => {
    setEditing(null);
    setForm({
      task_name: '', description: '', group_id: groups[0]?.group_id || '', assignee_email: '',
      schedule_type: 'daily', schedule_time: '09:00', schedule_days_of_week: [1],
      schedule_day_of_month: 1, due_hours: 24, priority: 'MEDIUM',
    });
    setOpen(true);
  };

  const openEdit = (t) => {
    setEditing(t);
    setForm({
      task_name: t.task_name, description: t.description || '', group_id: t.group_id,
      assignee_email: t.assignee_email, schedule_type: t.schedule_type,
      schedule_time: t.schedule_time || '09:00',
      schedule_days_of_week: t.schedule_days_of_week || [1],
      schedule_day_of_month: t.schedule_day_of_month || 1,
      due_hours: t.due_hours || 24, priority: t.priority || 'MEDIUM',
    });
    setOpen(true);
  };

  const toggleDay = (day) => {
    setForm(f => {
      const days = f.schedule_days_of_week || [];
      return { ...f, schedule_days_of_week: days.includes(day) ? days.filter(d => d !== day) : [...days, day].sort() };
    });
  };

  const handleSave = async () => {
    if (!form.task_name.trim() || !form.group_id || !form.assignee_email) return;
    setSaving(true);
    const group = groups.find(g => g.group_id === form.group_id);
    const assigneeUser = users.find(u => u.email === form.assignee_email);
    const payload = {
      ...form,
      group_name: group?.group_name || '',
      assignee_name: assigneeUser?.full_name || form.assignee_email,
      due_hours: Number(form.due_hours) || 24,
      schedule_day_of_month: Number(form.schedule_day_of_month) || 1,
    };

    if (editing) {
      await base44.entities.ScheduledTaskTemplate.update(editing.id, payload);
    } else {
      const templateId = `STT-${Date.now().toString(36).toUpperCase()}`;
      await base44.entities.ScheduledTaskTemplate.create({ ...payload, template_id: templateId, is_active: true });
    }
    setSaving(false);
    setOpen(false);
    onSaved?.();
  };

  const toggleActive = async (t) => {
    await base44.entities.ScheduledTaskTemplate.update(t.id, { is_active: !t.is_active });
    onSaved?.();
  };

  const filtered = groupFilter === 'ALL' ? templates : templates.filter(t => t.group_id === groupFilter);

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Recurring Tasks</h3>
          <p className="text-xs text-slate-500">{templates.length} task template{templates.length !== 1 ? 's' : ''} configured</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="h-9 px-3 border border-slate-200 rounded-lg text-sm bg-white">
            <option value="ALL">All Groups</option>
            {groups.map(g => <option key={g.group_id} value={g.group_id}>{g.group_name}</option>)}
          </select>
          <Button size="sm" className="h-11 md:h-9 gap-1.5 text-sm" onClick={openNew}>
            <Plus className="w-4 h-4" /> New Task
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center">
          <Clock className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No recurring tasks yet.</p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-700">Task</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-700 hidden md:table-cell">Group</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-700">Assignee</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-700 hidden md:table-cell">Schedule</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-700 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(t => (
                <tr key={t.id} className={`hover:bg-slate-50 ${!t.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-900">{t.task_name}</p>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium mt-0.5 ${PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.MEDIUM}`}>{t.priority}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 hidden md:table-cell">{t.group_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{t.assignee_name || t.assignee_email}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell"><ScheduleLabel tmpl={t} /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(t)} className="p-2 text-slate-400 hover:text-blue-600"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => toggleActive(t)} className={`p-2 ${t.is_active ? 'text-slate-400 hover:text-red-600' : 'text-slate-400 hover:text-green-600'}`}><Power className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Recurring Task' : 'New Recurring Task'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Task Name *</Label>
              <Input value={form.task_name} onChange={e => setForm(f => ({ ...f, task_name: e.target.value }))} placeholder="e.g. Submit daily GST summary" className="h-11 md:h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Description / Instructions</Label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detailed instructions..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[80px]" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Group *</Label>
                <select value={form.group_id} onChange={e => setForm(f => ({ ...f, group_id: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm h-11 md:h-9 bg-white">
                  <option value="">— Select Group —</option>
                  {groups.filter(g => g.is_active).map(g => <option key={g.group_id} value={g.group_id}>{g.group_name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Assign To *</Label>
                <select value={form.assignee_email} onChange={e => setForm(f => ({ ...f, assignee_email: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm h-11 md:h-9 bg-white">
                  <option value="">— Select User —</option>
                  {users.map(u => <option key={u.id} value={u.email}>{u.full_name || u.email}</option>)}
                </select>
              </div>
            </div>

            {/* Schedule */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-blue-800 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Schedule</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-700">Frequency</Label>
                  <select value={form.schedule_type} onChange={e => setForm(f => ({ ...f, schedule_type: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm h-11 md:h-9 bg-white">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-700">Time</Label>
                  <Input type="time" value={form.schedule_time} onChange={e => setForm(f => ({ ...f, schedule_time: e.target.value }))} className="h-11 md:h-9" />
                </div>
              </div>
              {form.schedule_type === 'weekly' && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-700">Days of Week</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {DAY_LABELS.map((label, idx) => (
                      <button key={idx} type="button" onClick={() => toggleDay(idx)}
                        className={`h-9 w-11 rounded-lg text-xs font-bold transition-all ${(form.schedule_days_of_week || []).includes(idx) ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {form.schedule_type === 'monthly' && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-700">Day of Month</Label>
                  <Input type="number" min="1" max="31" value={form.schedule_day_of_month} onChange={e => setForm(f => ({ ...f, schedule_day_of_month: e.target.value }))} className="h-11 md:h-9 w-24" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Due In (hours)</Label>
                <Input type="number" min="1" value={form.due_hours} onChange={e => setForm(f => ({ ...f, due_hours: e.target.value }))} className="h-11 md:h-9" />
                <p className="text-xs text-slate-400">Hours after task is created to complete</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Priority</Label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm h-11 md:h-9 bg-white">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
            </div>

            <Button className="w-full h-11 text-sm" onClick={handleSave} disabled={saving || !form.task_name.trim() || !form.group_id || !form.assignee_email}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editing ? 'Update Task' : 'Create Task'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}