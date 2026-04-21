import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, AlertTriangle } from 'lucide-react';
import { generateTaskNumber, logTaskAction, getEAsForDirector } from '@/lib/directorTaskHelpers';

export default function CreateDirectorTaskModal({ open, onClose, user, directorEmail, directorName, onCreated }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    task_name: '',
    task_details: '',
    assigned_to_email: '',
    is_important: false,
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    notification_time: '16:00',
  });

  useEffect(() => {
    if (open) {
      setLoading(true);
      base44.entities.User.list().then(u => {
        setUsers(u.filter(x => x.email));
        setLoading(false);
      });
      // Reset form
      setForm({
        task_name: '', task_details: '', assigned_to_email: '',
        is_important: false, start_date: '', start_time: '',
        end_date: '', end_time: '', notification_time: '16:00',
      });
    }
  }, [open]);

  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const selectedUser = users.find(u => u.email === form.assigned_to_email);

  const handleSave = async () => {
    if (!form.task_name.trim() || !form.assigned_to_email || !form.end_date) return;
    setSaving(true);

    const taskNumber = await generateTaskNumber();
    const eaList = await getEAsForDirector(directorEmail);

    const task = await base44.entities.DirectorTask.create({
      task_number: taskNumber,
      task_name: form.task_name.trim(),
      task_details: form.task_details.trim(),
      assigned_to_email: form.assigned_to_email,
      assigned_to_name: selectedUser?.full_name || form.assigned_to_email,
      assigned_by_email: user.email,
      assigned_by_name: user.full_name,
      director_email: directorEmail,
      director_name: directorName,
      is_important: form.is_important,
      start_date: form.start_date || '',
      start_time: form.start_time || '',
      end_date: form.end_date,
      end_time: form.end_time || '',
      notification_time: form.notification_time || '16:00',
      status: 'open',
      overdue_notified: false,
      ea_emails: eaList.map(e => e.email),
    });

    await logTaskAction(task, 'created', user,
      `Task "${form.task_name}" assigned to ${selectedUser?.full_name || form.assigned_to_email}, due ${form.end_date}${form.end_time ? ' ' + form.end_time : ''}`
    );

    setSaving(false);
    onCreated?.(task);
    onClose();
  };

  const isValid = form.task_name.trim() && form.assigned_to_email && form.end_date;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Task Name */}
            <div>
              <Label className="text-xs font-medium text-slate-700">Task Name <span className="text-red-500">*</span></Label>
              <Input value={form.task_name} onChange={e => setField('task_name', e.target.value)}
                placeholder="What needs to be done?" className="mt-1 h-11 text-base md:h-9 md:text-sm" />
            </div>

            {/* Details */}
            <div>
              <Label className="text-xs font-medium text-slate-700">Details</Label>
              <Textarea value={form.task_details} onChange={e => setField('task_details', e.target.value)}
                placeholder="Describe the task in detail…" className="mt-1 min-h-[80px]" />
            </div>

            {/* Assign To */}
            <div>
              <Label className="text-xs font-medium text-slate-700">Assign To <span className="text-red-500">*</span></Label>
              <Select value={form.assigned_to_email} onValueChange={v => setField('assigned_to_email', v)}>
                <SelectTrigger className="mt-1 h-11 md:h-9">
                  <SelectValue placeholder="Select person…" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.email} value={u.email}>
                      {u.full_name || u.email} — {u.role || 'user'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Important toggle */}
            <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <div>
                  <p className="text-sm font-medium text-red-700">Mark as Important</p>
                  <p className="text-xs text-red-500">Director & EA will be notified if overdue</p>
                </div>
              </div>
              <Switch checked={form.is_important} onCheckedChange={v => setField('is_important', v)} />
            </div>

            {/* Date fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-700">Start Date</Label>
                <Input type="text" value={form.start_date} onChange={e => setField('start_date', e.target.value)}
                  placeholder="DD/MM/YYYY" className="mt-1 h-11 md:h-9 md:text-sm" />
                <p className="text-xs text-slate-400 mt-0.5">Optional</p>
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Start Time</Label>
                <Input type="time" value={form.start_time} onChange={e => setField('start_time', e.target.value)}
                  className="mt-1 h-11 md:h-9 md:text-sm" />
                <p className="text-xs text-slate-400 mt-0.5">Optional</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-700">End Date <span className="text-red-500">*</span></Label>
                <Input type="text" value={form.end_date} onChange={e => setField('end_date', e.target.value)}
                  placeholder="DD/MM/YYYY" className="mt-1 h-11 md:h-9 md:text-sm" />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">End Time</Label>
                <Input type="time" value={form.end_time} onChange={e => setField('end_time', e.target.value)}
                  className="mt-1 h-11 md:h-9 md:text-sm" />
                <p className="text-xs text-slate-400 mt-0.5">Default: 4:00 PM</p>
              </div>
            </div>

            {/* Notification time (for important tasks) */}
            {form.is_important && (
              <div>
                <Label className="text-xs font-medium text-slate-700">Notification Time (if overdue)</Label>
                <Input type="time" value={form.notification_time} onChange={e => setField('notification_time', e.target.value)}
                  className="mt-1 h-11 md:h-9 md:text-sm" />
                <p className="text-xs text-slate-400 mt-0.5">Director & EA notified at this time on the end date if not completed</p>
              </div>
            )}

            <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
              Assigning on behalf of: <strong>{directorName || directorEmail}</strong>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={onClose} className="flex-1 h-11">Cancel</Button>
              <Button onClick={handleSave} disabled={!isValid || saving} className="flex-1 h-11 gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Task
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}