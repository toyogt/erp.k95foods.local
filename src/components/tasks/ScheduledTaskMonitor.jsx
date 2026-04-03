import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, Loader2, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
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

export default function ScheduledTaskMonitor({ instances, groups, user, onRefresh }) {
  const [completing, setCompleting] = useState(null);
  const [completeModal, setCompleteModal] = useState(null);
  const [note, setNote] = useState('');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('PENDING');

  const isAdmin = user?.role === 'admin';
  const isCoordinator = groups.some(g => g.coordinator_email === user?.email);

  // Filter: coordinators see their groups, assignees see their tasks, admins see all
  let visible = instances;
  if (!isAdmin) {
    const myCoordGroups = groups.filter(g => g.coordinator_email === user?.email).map(g => g.group_id);
    visible = instances.filter(i =>
      i.assignee_email === user?.email || myCoordGroups.includes(i.group_id)
    );
  }

  if (groupFilter !== 'ALL') visible = visible.filter(i => i.group_id === groupFilter);
  if (statusFilter !== 'ALL') visible = visible.filter(i => {
    if (statusFilter === 'PENDING') {
      const isOverdue = i.status === 'PENDING' && i.due_at && new Date(i.due_at) < new Date();
      return i.status === 'PENDING' && !isOverdue;
    }
    if (statusFilter === 'OVERDUE') {
      return i.status === 'PENDING' && i.due_at && new Date(i.due_at) < new Date();
    }
    return i.status === statusFilter;
  });

  // Sort: overdue first, then by due_at
  visible.sort((a, b) => {
    const aOverdue = a.status === 'PENDING' && a.due_at && new Date(a.due_at) < new Date();
    const bOverdue = b.status === 'PENDING' && b.due_at && new Date(b.due_at) < new Date();
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

  const pendingCount = instances.filter(i => i.status === 'PENDING').length;
  const overdueCount = instances.filter(i => i.status === 'PENDING' && i.due_at && new Date(i.due_at) < new Date()).length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-yellow-600">{pendingCount - overdueCount}</p>
          <p className="text-xs text-yellow-500 font-medium">Pending</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
          <p className="text-xs text-red-500 font-medium">Overdue</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{instances.filter(i => i.status === 'COMPLETED').length}</p>
          <p className="text-xs text-green-500 font-medium">Completed</p>
        </div>
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-slate-600">{instances.length}</p>
          <p className="text-xs text-slate-400 font-medium">Total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="h-9 px-3 border border-slate-200 rounded-lg text-sm bg-white">
          <option value="ALL">All Groups</option>
          {groups.map(g => <option key={g.group_id} value={g.group_id}>{g.group_name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 px-3 border border-slate-200 rounded-lg text-sm bg-white">
          <option value="PENDING">Pending</option>
          <option value="OVERDUE">Overdue</option>
          <option value="COMPLETED">Completed</option>
          <option value="ALL">All</option>
        </select>
        <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={onRefresh}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Task List */}
      {visible.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center">
          <Clock className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No tasks match your filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(task => {
            const isOverdue = task.status === 'PENDING' && task.due_at && new Date(task.due_at) < new Date();
            const canComplete = task.status === 'PENDING' && (task.assignee_email === user?.email || isAdmin);
            const dueMoment = task.due_at ? moment(task.due_at) : null;

            return (
              <div key={task.id} className={`bg-white border rounded-xl p-4 ${isOverdue ? 'border-red-300 border-l-4 border-l-red-500' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {task.group_name && (
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">{task.group_name}</span>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.MEDIUM}`}>{task.priority}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${isOverdue ? 'bg-red-100 text-red-700' : STATUS_STYLES[task.status] || ''}`}>
                        {isOverdue ? 'OVERDUE' : task.status}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 mt-1">{task.task_name}</p>
                    {task.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{task.description}</p>}
                    <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-slate-400">
                      <span>Assigned to: <strong className="text-slate-600">{task.assignee_name || task.assignee_email}</strong></span>
                      {dueMoment && (
                        <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
                          {isOverdue ? <AlertTriangle className="w-3 h-3 inline mr-0.5" /> : <Clock className="w-3 h-3 inline mr-0.5" />}
                          Due: {dueMoment.format('DD/MM/YYYY HH:mm')}
                          {isOverdue && ` (${dueMoment.fromNow()})`}
                        </span>
                      )}
                      {task.completed_at && (
                        <span className="text-green-600">Completed: {moment(task.completed_at).format('DD/MM/YYYY HH:mm')}</span>
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
      )}

      {/* Complete Dialog */}
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