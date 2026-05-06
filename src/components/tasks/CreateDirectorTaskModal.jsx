import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Layers, ClipboardList, GitBranch, X } from 'lucide-react';
import { generateTaskNumber, logTaskAction, getEAsForDirector } from '@/lib/directorTaskHelpers';
import DatePickerField from '@/components/tasks/DatePickerField';
import AttachmentUploader from '@/components/tasks/AttachmentUploader';

/**
 * CreateDirectorTaskModal
 * Supports two modes:
 *   - Single: standalone task (existing behaviour)
 *   - Project Task: task linked to a project, with optional predecessor selection
 */
export default function CreateDirectorTaskModal({
  open, onClose, user, directorEmail, directorName, onCreated,
  // When opened from ProjectTaskBoard, pre-fill project
  defaultProjectId, defaultProjectName, existingProjectTasks,
}) {
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // task_type: 'single' | 'project'
  const [taskType, setTaskType] = useState(defaultProjectId ? 'project' : 'single');

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
    project_id: defaultProjectId || '',
    predecessor_task_ids: [],
    attachments: [],
  });

  useEffect(() => {
    if (open) {
      setLoading(true);
      Promise.all([
        base44.entities.User.list(),
        defaultProjectId
          ? Promise.resolve([])
          : base44.entities.Project.filter({ director_email: directorEmail }, '-created_date', 50),
      ]).then(([userList, projectList]) => {
        setUsers(userList.filter(x => x.email));
        setProjects(projectList);
        setLoading(false);
      });

      setTaskType(defaultProjectId ? 'project' : 'single');
      setForm({
        task_name: '', task_details: '', assigned_to_email: '',
        is_important: false, start_date: '', start_time: '',
        end_date: '', end_time: '', notification_time: '16:00',
        project_id: defaultProjectId || '',
        predecessor_task_ids: [],
        attachments: [],
      });
    }
  }, [open, directorEmail, defaultProjectId]);

  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  // Tasks available as predecessors = tasks in selected project (excluding current task)
  const selectedProjectTasks = defaultProjectId
    ? (existingProjectTasks || [])
    : projects.find(p => p.id === form.project_id)
      ? [] // We don't have them loaded here; predecessor select only available when opened from board
      : [];

  const togglePredecessor = (taskId) => {
    setForm(prev => {
      const ids = prev.predecessor_task_ids || [];
      return {
        ...prev,
        predecessor_task_ids: ids.includes(taskId)
          ? ids.filter(id => id !== taskId)
          : [...ids, taskId],
      };
    });
  };

  const selectedUser = users.find(u => u.email === form.assigned_to_email);
  const selectedProject = defaultProjectId
    ? { id: defaultProjectId, project_name: defaultProjectName }
    : projects.find(p => p.id === form.project_id);

  const handleSave = async () => {
    if (!form.task_name.trim() || !form.assigned_to_email || !form.end_date) return;
    if (taskType === 'project' && !form.project_id) return;
    setSaving(true);

    const taskNumber = await generateTaskNumber();
    const eaList = await getEAsForDirector(directorEmail);

    // Determine if this task is blocked (has predecessors that are not yet done)
    let initialStatus = 'open';
    if (taskType === 'project' && form.predecessor_task_ids?.length > 0) {
      const predecessors = (existingProjectTasks || []).filter(t => form.predecessor_task_ids.includes(t.id));
      const allDone = predecessors.every(p => p.status === 'completed');
      if (!allDone) initialStatus = 'blocked';
    }

    // Build predecessor display numbers
    const predecessorNumbers = (existingProjectTasks || [])
      .filter(t => form.predecessor_task_ids.includes(t.id))
      .map(t => t.task_number);

    const task = await base44.entities.DirectorTask.create({
      task_number: taskNumber,
      task_name: form.task_name.trim(),
      task_details: form.task_details.trim(),
      task_type: taskType,
      project_id: taskType === 'project' ? form.project_id : '',
      project_name: taskType === 'project' ? (selectedProject?.project_name || '') : '',
      predecessor_task_ids: taskType === 'project' ? (form.predecessor_task_ids || []) : [],
      predecessor_task_numbers: taskType === 'project' ? predecessorNumbers : [],
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
      status: initialStatus,
      overdue_notified: false,
      ea_emails: eaList.map(e => e.email),
      attachments: form.attachments || [],
    });

    await logTaskAction(task, 'created', user,
      `Task "${form.task_name}" assigned to ${selectedUser?.full_name || form.assigned_to_email}, due ${form.end_date}${form.end_time ? ' ' + form.end_time : ''}${taskType === 'project' ? ` [Project: ${selectedProject?.project_name}]` : ''}`
    );

    setSaving(false);
    onCreated?.(task);
    onClose();
  };

  const isValid = form.task_name.trim() && form.assigned_to_email && form.end_date &&
    (taskType === 'single' || form.project_id);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign New Task</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : (
          <div className="space-y-4 pt-2">

            {/* Task Type Toggle */}
            {!defaultProjectId && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTaskType('single')}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    taskType === 'single'
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  Single Task
                </button>
                <button
                  type="button"
                  onClick={() => setTaskType('project')}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    taskType === 'project'
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  Project Task
                </button>
              </div>
            )}

            {/* Project selector (only for project task, and only if not pre-filled) */}
            {taskType === 'project' && !defaultProjectId && (
              <div>
                <Label className="text-xs font-medium text-slate-700">Project <span className="text-red-500">*</span></Label>
                <Select value={form.project_id} onValueChange={v => setField('project_id', v)}>
                  <SelectTrigger className="mt-1 h-11 md:h-9">
                    <SelectValue placeholder="Select project…" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.length === 0 ? (
                      <SelectItem value="__none__" disabled>No projects found — create one first</SelectItem>
                    ) : (
                      projects.filter(p => p.status !== 'completed' && p.status !== 'cancelled').map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.project_number} — {p.project_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Pre-filled project badge (when opened from board) */}
            {taskType === 'project' && defaultProjectId && (
              <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                <Layers className="w-4 h-4 text-indigo-600" />
                <div>
                  <p className="text-xs font-medium text-indigo-700">Adding task to project</p>
                  <p className="text-sm text-indigo-900 font-semibold">{defaultProjectName}</p>
                </div>
              </div>
            )}

            {/* Predecessor selector (only for project tasks with existing tasks) */}
            {taskType === 'project' && selectedProjectTasks.length > 0 && (
              <div>
                <Label className="text-xs font-medium text-slate-700">
                  <GitBranch className="w-3.5 h-3.5 inline mr-1" />
                  Depends on (optional — task starts after these are done)
                </Label>
                <div className="mt-1.5 space-y-1.5 max-h-40 overflow-y-auto">
                  {selectedProjectTasks.map(t => {
                    const selected = form.predecessor_task_ids.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => togglePredecessor(t.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-all ${
                          selected
                            ? 'border-indigo-400 bg-indigo-50 text-indigo-800'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{t.task_number}</span>
                          <span className="truncate">{t.task_name}</span>
                        </span>
                        {selected && <X className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                {form.predecessor_task_ids.length > 0 && (
                  <p className="text-xs text-indigo-600 mt-1.5">
                    ⚠ This task will be <strong>Blocked</strong> until the selected tasks are completed.
                  </p>
                )}
              </div>
            )}

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
              <DatePickerField label="Start Date" value={form.start_date} onChange={v => setField('start_date', v)} placeholder="Optional" />
              <div>
                <Label className="text-xs font-medium text-slate-700">Start Time</Label>
                <Input type="time" value={form.start_time} onChange={e => setField('start_time', e.target.value)}
                  className="mt-1 h-11 md:h-9 md:text-sm" />
                <p className="text-xs text-slate-400 mt-0.5">Optional</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DatePickerField label="End Date" required value={form.end_date} onChange={v => setField('end_date', v)} placeholder="Select end date" />
              <div>
                <Label className="text-xs font-medium text-slate-700">End Time</Label>
                <Input type="time" value={form.end_time} onChange={e => setField('end_time', e.target.value)}
                  className="mt-1 h-11 md:h-9 md:text-sm" />
                <p className="text-xs text-slate-400 mt-0.5">Default: 4:00 PM</p>
              </div>
            </div>

            {form.is_important && (
              <div>
                <Label className="text-xs font-medium text-slate-700">Notification Time (if overdue)</Label>
                <Input type="time" value={form.notification_time} onChange={e => setField('notification_time', e.target.value)}
                  className="mt-1 h-11 md:h-9 md:text-sm" />
                <p className="text-xs text-slate-400 mt-0.5">Director & EA notified at this time on end date</p>
              </div>
            )}

            <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
              Assigning on behalf of: <strong>{directorName || directorEmail}</strong>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={onClose} className="flex-1 h-11">Cancel</Button>
              <Button onClick={handleSave} disabled={!isValid || saving} className="flex-1 h-11 gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Assign Task
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}