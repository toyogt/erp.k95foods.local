/**
 * Scheduled Tasks section embedded inside FMS Monitor.
 * Shows tasks assigned to coordinator or admin, with complete action.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, Loader2, Clock, AlertTriangle } from 'lucide-react';
import moment from 'moment';

const STATUS_STYLES = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  SKIPPED: 'bg-slate-100 text-slate-500',
};

const PRIORITY_STYLES = {
  HIGH: 'bg-red-100 text-red-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  LOW: 'bg-slate-100 text-slate-600',
};

export default function ScheduledTasksMonitorTab({ instances, groups, user, onRefresh }) {
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

  // Only show pending/overdue
  visible = visible.filter(i => i.status === 'PENDING');

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

  const overdueCount = visible.filter(i => i.due_at && new Date(i.due_at) < new Date()).length;

  if (visible.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          Scheduled Tasks
          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">{visible.length} pending</span>
          {overdueCount > 0 && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{overdueCount} overdue</span>
          )}
        </h3>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-100">
          {visible.map(task => {
            const isOverdue = task.due_at && new Date(task.due_at) < new Date();
            const canComplete = task.assignee_email === user?.email || isAdmin;
            const dueMoment = task.due_at ? moment(task.due_at) : null;

            return (
              <div key={task.id} className={`px-4 py-3 ${isOverdue ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-yellow-400'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {task.group_name && (
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">{task.group_name}</span>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.MEDIUM}`}>{task.priority}</span>
                      {isOverdue && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-red-100 text-red-700">OVERDUE</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-900 mt-1">{task.task_name}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-slate-400">
                      <span>Assigned: <strong className="text-slate-600">{task.assignee_name || task.assignee_email}</strong></span>
                      {dueMoment && (
                        <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
                          {isOverdue ? <AlertTriangle className="w-3 h-3 inline mr-0.5" /> : <Clock className="w-3 h-3 inline mr-0.5" />}
                          Due: {dueMoment.format('DD/MM/YYYY HH:mm')}
                          {isOverdue && ` (${dueMoment.fromNow()})`}
                        </span>
                      )}
                    </div>
                  </div>
                  {canComplete && (
                    <Button size="sm" className="h-11 md:h-9 gap-1.5 bg-green-600 hover:bg-green-700 shrink-0"
                      onClick={() => { setCompleteModal(task); setNote(''); }}>
                      <CheckCircle2 className="w-4 h-4" /> Complete
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
    </div>
  );
}