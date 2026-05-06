import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertTriangle, CheckCircle2, ClipboardList, Factory } from 'lucide-react';
import { generateTaskNumber, logTaskAction, getEAsForDirector, getDirectorsForEA } from '@/lib/directorTaskHelpers';
import DatePickerField from '@/components/tasks/DatePickerField';
import AttachmentUploader from '@/components/tasks/AttachmentUploader';

const ALLOWED_ROLES = ['admin', 'executive_assistant', 'director'];

export default function QuickAssignTask() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  // Director context
  const [directors, setDirectors] = useState([]);
  const [selectedDirectorEmail, setSelectedDirectorEmail] = useState('');

  // Form data
  const [users, setUsers] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);

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
    attachments: [],
  });

  // Auth + role check
  useEffect(() => {
    (async () => {
      const isAuthed = await base44.auth.isAuthenticated();
      if (!isAuthed) {
        base44.auth.redirectToLogin(window.location.pathname);
        return;
      }
      const me = await base44.auth.me();
      setUser(me);

      if (!ALLOWED_ROLES.includes(me.role)) {
        setAccessDenied(true);
        setAuthLoading(false);
        return;
      }

      // Load directors context
      let dirList = [];
      if (me.role === 'admin' || me.role === 'director') {
        dirList.push({ email: me.email, name: me.full_name });
      }
      if (me.role === 'admin' || me.role === 'executive_assistant') {
        const eaDirs = await getDirectorsForEA(me.email);
        eaDirs.forEach(d => {
          if (!dirList.find(x => x.email === d.email)) dirList.push(d);
        });
      }
      setDirectors(dirList);
      if (dirList.length > 0) setSelectedDirectorEmail(dirList[0].email);

      // Load assignable users
      const allUsers = await base44.entities.User.list();
      setUsers(allUsers.filter(u => u.email));

      setAuthLoading(false);
      setDataLoading(false);
    })();
  }, []);

  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const selectedUser = users.find(u => u.email === form.assigned_to_email);
  const selectedDirector = directors.find(d => d.email === selectedDirectorEmail);

  const isValid = form.task_name.trim() && form.assigned_to_email && form.end_date && selectedDirectorEmail;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);

    const taskNumber = await generateTaskNumber();
    const eaList = await getEAsForDirector(selectedDirectorEmail);

    const task = await base44.entities.DirectorTask.create({
      task_number: taskNumber,
      task_name: form.task_name.trim(),
      task_details: form.task_details.trim(),
      task_type: 'single',
      assigned_to_email: form.assigned_to_email,
      assigned_to_name: selectedUser?.full_name || form.assigned_to_email,
      assigned_by_email: user.email,
      assigned_by_name: user.full_name,
      director_email: selectedDirectorEmail,
      director_name: selectedDirector?.name || selectedDirectorEmail,
      is_important: form.is_important,
      start_date: form.start_date || '',
      start_time: form.start_time || '',
      end_date: form.end_date,
      end_time: form.end_time || '',
      notification_time: form.notification_time || '16:00',
      status: 'open',
      overdue_notified: false,
      ea_emails: eaList.map(e => e.email),
      attachments: form.attachments || [],
    });

    await logTaskAction(task, 'created', user,
      `Task "${form.task_name}" assigned to ${selectedUser?.full_name || form.assigned_to_email}, due ${form.end_date}${form.end_time ? ' ' + form.end_time : ''}`
    );

    setSuccess(task.task_number);
    setSaving(false);

    // Reset form after short delay
    setTimeout(() => {
      setForm({
        task_name: '', task_details: '', assigned_to_email: '',
        is_important: false, start_date: '', start_time: '',
        end_date: '', end_time: '', notification_time: '16:00',
        attachments: [],
      });
      setSuccess(null);
    }, 3000);
  };

  // Full-screen loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // Access denied
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 text-center max-w-sm w-full">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-sm text-slate-500">
            You do not have permission to assign tasks. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Minimal header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
          <Factory className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900">Quick Assign Task</h1>
          <p className="text-xs text-slate-400">K95 ERP</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 pb-16">
        {/* Success banner */}
        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">Task {success} Created!</p>
              <p className="text-xs text-green-600">The form will reset in a moment…</p>
            </div>
          </div>
        )}

        {dataLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : directors.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No Directors Assigned</p>
            <p className="text-slate-400 text-sm mt-1">Ask your admin to map you to a director</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
            {/* Director selector */}
            {directors.length > 1 && (
              <div>
                <Label className="text-xs font-medium text-slate-700">Assigning On Behalf Of <span className="text-red-500">*</span></Label>
                <Select value={selectedDirectorEmail} onValueChange={setSelectedDirectorEmail}>
                  <SelectTrigger className="mt-1 h-11">
                    <SelectValue placeholder="Select director…" />
                  </SelectTrigger>
                  <SelectContent>
                    {directors.map(d => (
                      <SelectItem key={d.email} value={d.email}>{d.name || d.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {directors.length === 1 && (
              <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
                Assigning on behalf of: <strong>{directors[0].name || directors[0].email}</strong>
              </div>
            )}

            {/* Task Name */}
            <div>
              <Label className="text-xs font-medium text-slate-700">Task Name <span className="text-red-500">*</span></Label>
              <Input value={form.task_name} onChange={e => setField('task_name', e.target.value)}
                placeholder="What needs to be done?" className="mt-1 h-11 text-base" />
            </div>

            {/* Details */}
            <div>
              <Label className="text-xs font-medium text-slate-700">Details</Label>
              <Textarea value={form.task_details} onChange={e => setField('task_details', e.target.value)}
                placeholder="Describe the task in detail…" className="mt-1 min-h-[80px] text-base" />
            </div>

            {/* Attachments */}
            <div>
              <Label className="text-xs font-medium text-slate-700">Attachments</Label>
              <div className="mt-1">
                <AttachmentUploader
                  attachments={form.attachments}
                  onChange={files => setField('attachments', files)}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Add photos or videos for reference</p>
            </div>

            {/* Assign To */}
            <div>
              <Label className="text-xs font-medium text-slate-700">Assign To <span className="text-red-500">*</span></Label>
              <Select value={form.assigned_to_email} onValueChange={v => setField('assigned_to_email', v)}>
                <SelectTrigger className="mt-1 h-11">
                  <SelectValue placeholder="Select person…" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.email} value={u.email}>
                      {u.full_name || u.email}
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
                  <p className="text-xs text-red-500">Notify if overdue</p>
                </div>
              </div>
              <Switch checked={form.is_important} onCheckedChange={v => setField('is_important', v)} />
            </div>

            {/* Date fields */}
            <div className="grid grid-cols-2 gap-3">
              <DatePickerField label="Start Date" value={form.start_date} onChange={v => setField('start_date', v)} placeholder="Optional" />
              <div>
                <Label className="text-xs font-medium text-slate-700">Start Time</Label>
                <Input type="time" value={form.start_time} onChange={e => setField('start_time', e.target.value)}
                  className="mt-1 h-11" />
                <p className="text-xs text-slate-400 mt-0.5">Optional</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DatePickerField label="End Date" required value={form.end_date} onChange={v => setField('end_date', v)} placeholder="Select end date" />
              <div>
                <Label className="text-xs font-medium text-slate-700">End Time</Label>
                <Input type="time" value={form.end_time} onChange={e => setField('end_time', e.target.value)}
                  className="mt-1 h-11" />
                <p className="text-xs text-slate-400 mt-0.5">Default: 4:00 PM</p>
              </div>
            </div>

            {form.is_important && (
              <div>
                <Label className="text-xs font-medium text-slate-700">Notification Time (if overdue)</Label>
                <Input type="time" value={form.notification_time} onChange={e => setField('notification_time', e.target.value)}
                  className="mt-1 h-11" />
              </div>
            )}

            {/* Submit */}
            <Button onClick={handleSave} disabled={!isValid || saving} className="w-full h-12 text-base gap-2 mt-2">
              {saving && <Loader2 className="w-5 h-5 animate-spin" />}
              Assign Task
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}