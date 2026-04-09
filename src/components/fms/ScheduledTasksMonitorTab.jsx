/**
 * Scheduled Tasks rows inside FMS Monitor — unified table format matching process instances.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, Loader2, Clock, AlertTriangle, UserCheck } from 'lucide-react';
import moment from 'moment';

const PRIORITY_STYLES = {
  HIGH: 'border-l-red-500',
  MEDIUM: 'border-l-yellow-400',
  LOW: 'border-l-green-400',
};

export default function ScheduledTasksMonitorTab({ instances, groups, user, onRefresh, search }) {
  const [completing, setCompleting] = useState(null);
  const [completeModal, setCompleteModal] = useState(null);
  const [note, setNote] = useState('');

  const isAdmin = user?.role === 'admin';

  // Admin sees all, coordinator sees their groups
  let visible = instances;
  if (!isAdmin) {
    const myCoordGroups = groups.filter(g => g.coordinator_email === user?.email).map(g => g.group_id);
    visible = instances.filter(i =>
      i.coordinator_email === user?.email || myCoordGroups.includes(i.group_id)
    );
  }

  // Only pending
  visible = visible.filter(i => i.status === 'PENDING');

  // Apply search filter
  if (search) {
    const q = search.toLowerCase();
    visible = visible.filter(i =>
      i.task_name?.toLowerCase().includes(q) ||
      i.assignee_name?.toLowerCase().includes(q) ||
      i.assignee_email?.toLowerCase().includes(q) ||
      i.group_name?.toLowerCase().includes(q)
    );
  }

  // Sort: overdue first
  visible.sort((a, b) => {
    const aOverdue = a.due_at && new Date(a.due_at) < new Date();
    const bOverdue = b.due_at && new Date(b.due_at) < new Date();
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    return new Date(a.due_at || 0) - new Date(b.due_at || 0);
  });

  const handleComplete = async () => {
    if (!completeModal) return;
    setCompleting(completeModal.id);
    await base44.entities.ScheduledTaskInstance.update(completeModal.id, {
      status: 'COMPLETED',
      completed_at: new Date().toISOString(),
      completed_by: user?.email,
      completion_note: note,
    });
    setCompleting(null);
    setCompleteModal(null);
    setNote('');
    onRefresh?.();
  };

  if (visible.length === 0) return null;

  const getDeadlineBadge = (dueAt) => {
    if (!dueAt) return <span className="text-slate-300 text-xs">—</span>;
    const now = moment();
    const due = moment(dueAt);
    const diff = due.diff(now);
    const isOverdue = diff < 0;

    if (isOverdue) {
      const ago = moment.duration(-diff);
      const label = ago.asDays() >= 1 ? `${Math.floor(ago.asDays())}d overdue` : `${Math.floor(ago.asHours())}h overdue`;
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
          <AlertTriangle className="w-3 h-3" /> {label}
        </span>
      );
    }
    const left = moment.duration(diff);
    const label = left.asDays() >= 1 ? `${Math.floor(left.asDays())}d left` : `${Math.floor(left.asHours())}h left`;
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="w-3 h-3" /> {label}
      </span>
    );
  };

  const rowBorder = (task) => {
    if (task.due_at && new Date(task.due_at) < new Date()) return 'border-l-4 border-l-red-500';
    return `border-l-4 ${PRIORITY_STYLES[task.priority] || 'border-l-yellow-400'}`;
  };

  // Find coordinator for a task's group
  const getCoordinator = (task) => {
    const group = groups.find(g => g.group_id === task.group_id);
    return group ? (group.coordinator_name || group.coordinator_email) : null;
  };

  return (
    <>
      <div className="divide-y divide-slate-100">
        {visible.map(task => {
          const canComplete = task.assignee_email === user?.email || isAdmin;
          const coordinator = getCoordinator(task);

          return (
            <div
              key={task.id}
              className={`grid grid-cols-1 sm:grid-cols-[2fr_1.5fr_1.5fr_1fr_1fr_1fr] gap-2 sm:gap-4 px-4 py-3.5 hover:bg-slate-50 transition-colors ${rowBorder(task)}`}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-slate-800 text-sm">{task.task_name}</p>
                  <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">Scheduled</span>
                </div>
                <p className="text-xs text-slate-400">{task.group_name || 'Ungrouped'} · {task.priority || 'MEDIUM'}</p>
              </div>
              <div className="flex items-center">
                <p className="text-sm text-slate-600">{task.description ? task.description.slice(0, 40) : '—'}</p>
              </div>
              <div className="flex items-center">
                <p className="text-sm text-slate-600">{task.assignee_name || task.assignee_email || '—'}</p>
              </div>
              <div className="flex items-center">
                {coordinator ? (
                  <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full">
                    <UserCheck className="w-3 h-3" /> {coordinator}
                  </span>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
              </div>
              <div className="flex items-center">
                {getDeadlineBadge(task.due_at)}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">{task.due_at ? moment(task.due_at).format('DD/MM/YYYY HH:mm') : '—'}</p>
                {canComplete && (
                  <Button size="sm" className="h-8 gap-1 bg-green-600 hover:bg-green-700 text-xs ml-2 shrink-0"
                    onClick={(e) => { e.stopPropagation(); setCompleteModal(task); setNote(''); }}>
                    <CheckCircle2 className="w-3 h-3" /> Complete
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!completeModal} onOpenChange={() => setCompleteModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Task</DialogTitle>
          </DialogHeader>
          {completeModal && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm font-semibold text-slate-900">{completeModal.task_name}</p>
                {completeModal.description && <p className="text-xs text-slate-500 mt-1">{completeModal.description}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Completion Note (optional)</label>
                <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Any notes..." className="h-11 md:h-9" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-11" onClick={() => setCompleteModal(null)}>Cancel</Button>
                <Button className="flex-1 h-11 bg-green-600 hover:bg-green-700 gap-2" onClick={handleComplete} disabled={completing === completeModal?.id}>
                  {completing === completeModal?.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Mark Complete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}