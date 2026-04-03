import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit2, Power, Users, Loader2 } from 'lucide-react';

export default function TaskGroupManager({ groups, users, onSaved }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ group_name: '', description: '', coordinator_email: '' });

  const openNew = () => {
    setEditing(null);
    setForm({ group_name: '', description: '', coordinator_email: '' });
    setOpen(true);
  };

  const openEdit = (g) => {
    setEditing(g);
    setForm({ group_name: g.group_name, description: g.description || '', coordinator_email: g.coordinator_email });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.group_name.trim() || !form.coordinator_email) return;
    setSaving(true);
    const coordUser = users.find(u => u.email === form.coordinator_email);
    const payload = {
      ...form,
      coordinator_name: coordUser?.full_name || form.coordinator_email,
    };

    if (editing) {
      await base44.entities.ScheduledTaskGroup.update(editing.id, payload);
    } else {
      const groupId = `TG-${Date.now().toString(36).toUpperCase()}`;
      await base44.entities.ScheduledTaskGroup.create({ ...payload, group_id: groupId, is_active: true });
    }
    setSaving(false);
    setOpen(false);
    onSaved?.();
  };

  const toggleActive = async (g) => {
    await base44.entities.ScheduledTaskGroup.update(g.id, { is_active: !g.is_active });
    onSaved?.();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Task Groups</h3>
          <p className="text-xs text-slate-500">Organise tasks and assign a Process Coordinator to each group</p>
        </div>
        <Button size="sm" className="h-11 md:h-9 gap-1.5 text-sm" onClick={openNew}>
          <Plus className="w-4 h-4" /> New Group
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center">
          <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No task groups yet. Create one to start organising recurring tasks.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {groups.map(g => (
            <div key={g.id} className={`border rounded-xl p-4 ${g.is_active ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900">{g.group_name}</p>
                  {g.description && <p className="text-xs text-slate-500 mt-0.5">{g.description}</p>}
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-xs text-slate-400">Coordinator:</span>
                    <span className="text-xs font-medium text-slate-700">{g.coordinator_name || g.coordinator_email}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(g)} className="p-2 text-slate-400 hover:text-blue-600"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => toggleActive(g)} className={`p-2 ${g.is_active ? 'text-slate-400 hover:text-red-600' : 'text-slate-400 hover:text-green-600'}`}>
                    <Power className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Task Group' : 'New Task Group'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Group Name *</Label>
              <Input value={form.group_name} onChange={e => setForm(f => ({ ...f, group_name: e.target.value }))} placeholder="e.g. Accounts Tasks" className="h-11 md:h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Description</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What this group covers..." className="h-11 md:h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Process Coordinator *</Label>
              <select
                value={form.coordinator_email}
                onChange={e => setForm(f => ({ ...f, coordinator_email: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm h-11 md:h-9 bg-white"
              >
                <option value="">— Select Coordinator —</option>
                {users.map(u => (
                  <option key={u.id} value={u.email}>{u.full_name || u.email}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400">This person will monitor all tasks in this group</p>
            </div>
            <Button className="w-full h-11 text-sm" onClick={handleSave} disabled={saving || !form.group_name.trim() || !form.coordinator_email}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editing ? 'Update Group' : 'Create Group'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}