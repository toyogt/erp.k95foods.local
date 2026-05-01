import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  CheckCircle2, AlertTriangle, Calendar, User,
  Loader2, ChevronDown, ChevronUp, CalendarClock, MessageSquare,
  ScrollText, XCircle, Lock, Send
} from 'lucide-react';
import { TASK_STATUS_CONFIG, isTaskOverdue, getTaskUrgency, logTaskAction, formatTaskDate } from '@/lib/directorTaskHelpers';
import DirectorTaskLogPanel from '@/components/tasks/DirectorTaskLogPanel';
import DatePickerField from '@/components/tasks/DatePickerField';

export default function DirectorTaskCard({ task, user, viewMode, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState(false);
  const [showDateChange, setShowDateChange] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [dateChangeReason, setDateChangeReason] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [progressNote, setProgressNote] = useState('');
  const [showProgressInput, setShowProgressInput] = useState(false);

  const status = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.open;
  const urgency = getTaskUrgency(task);
  const overdue = isTaskOverdue(task);

  const borderColor = urgency === 'overdue' ? 'border-l-red-500'
    : urgency === 'due_today' ? 'border-l-orange-400'
    : urgency === 'due_soon' ? 'border-l-yellow-400'
    : task.status === 'completed' ? 'border-l-green-400'
    : 'border-l-blue-400';

  const bgColor = urgency === 'overdue' ? 'bg-red-50'
    : urgency === 'due_today' ? 'bg-orange-50'
    : 'bg-white';

  const handleMarkDone = async () => {
    setActing(true);
    await base44.entities.DirectorTask.update(task.id, {
      status: 'pending_verification',
      completed_at: new Date().toISOString(),
      completed_by_email: user.email,
    });
    await logTaskAction(task, 'marked_done', user, `Assignee marked task as done`);
    setActing(false);
    onRefresh?.();
  };

  const handleVerify = async () => {
    setActing(true);
    await base44.entities.DirectorTask.update(task.id, {
      status: 'completed',
      verified_at: new Date().toISOString(),
      verified_by_email: user.email,
      verified_by_name: user.full_name,
    });
    await logTaskAction(task, 'verified', user, `Task completion verified by ${user.full_name}`);
    setActing(false);
    onRefresh?.();
  };

  const handleReopen = async () => {
    setActing(true);
    await base44.entities.DirectorTask.update(task.id, {
      status: 'open',
      completed_at: '',
      completed_by_email: '',
      verified_at: '',
      verified_by_email: '',
      verified_by_name: '',
    });
    await logTaskAction(task, 'reopened', user, `Task reopened — not actually completed`);
    setActing(false);
    onRefresh?.();
  };

  const handleDateChangeRequest = async () => {
    if (!newDate || !dateChangeReason.trim()) return;
    setActing(true);
    await base44.entities.DirectorTask.update(task.id, {
      status: 'date_change_requested',
      date_change_reason: dateChangeReason.trim(),
      requested_new_date: newDate,
      requested_new_time: newTime || '',
    });
    await logTaskAction(task, 'date_change_requested', user,
      `Requested date change from ${task.end_date} to ${newDate}. Reason: ${dateChangeReason.trim()}`,
      task.end_date, newDate
    );
    setActing(false);
    setShowDateChange(false);
    onRefresh?.();
  };

  const handleApproveDateChange = async () => {
    setActing(true);
    const oldDate = task.end_date;
    await base44.entities.DirectorTask.update(task.id, {
      status: 'open',
      end_date: task.requested_new_date,
      end_time: task.requested_new_time || task.end_time,
      date_change_reason: '',
      requested_new_date: '',
      requested_new_time: '',
      overdue_notified: false,
    });
    await logTaskAction(task, 'date_change_approved', user,
      `Date change approved: ${oldDate} → ${task.requested_new_date}`,
      oldDate, task.requested_new_date
    );
    setActing(false);
    onRefresh?.();
  };

  const handleRejectDateChange = async () => {
    setActing(true);
    await base44.entities.DirectorTask.update(task.id, {
      status: 'open',
      date_change_reason: '',
      requested_new_date: '',
      requested_new_time: '',
    });
    await logTaskAction(task, 'date_change_rejected', user, `Date change request rejected`);
    setActing(false);
    onRefresh?.();
  };

  const handleCancel = async () => {
    setActing(true);
    await base44.entities.DirectorTask.update(task.id, { status: 'cancelled' });
    await logTaskAction(task, 'cancelled', user, `Task cancelled by ${user.full_name}`);
    setActing(false);
    onRefresh?.();
  };

  const handleProgressUpdate = async () => {
    if (!progressNote.trim()) return;
    setActing(true);
    await base44.entities.DirectorTask.update(task.id, {
      progress_note: progressNote.trim(),
      progress_updated_at: new Date().toISOString(),
    });
    await logTaskAction(task, 'edited', user, `Progress update: ${progressNote.trim()}`);
    setProgressNote('');
    setShowProgressInput(false);
    setActing(false);
    onRefresh?.();
  };

  const isAssignee = user?.email === task.assigned_to_email;
  const isEAOrDirector = viewMode === 'ea' || viewMode === 'director';

  return (
    <>
      <div className={`${bgColor} rounded-xl border border-slate-200 border-l-4 ${borderColor} shadow-sm overflow-hidden`}>
        {/* Card Header */}
        <div className="p-4 pb-3">
          {/* Status + urgency badges only */}
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${status.color}`}>
              {status.label}
            </span>
            {task.status === 'blocked' && (
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <Lock className="w-3 h-3" /> Blocked
              </span>
            )}
            {task.is_important && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Important
              </span>
            )}
            {overdue && task.status !== 'completed' && (
              <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-semibold animate-pulse">
                OVERDUE
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-semibold text-slate-900 text-base leading-snug">{task.task_name}</h3>

          {/* Only due date shown prominently */}
          <div className="flex items-center gap-1.5 mt-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className={`text-sm font-medium ${overdue ? 'text-red-500' : 'text-slate-500'}`}>
              Due: {formatTaskDate(task.end_date, task.end_time)}
            </span>
          </div>

          {/* Assignee line — only shown in EA/Director view (not assignee's own tasks) */}
          {!isAssignee && (
            <div className="flex items-center gap-1.5 mt-1">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-sm text-slate-600">{task.assigned_to_name || task.assigned_to_email}</span>
            </div>
          )}

          {/* Progress note preview */}
          {task.progress_note && !expanded && (
            <div className="mt-2 bg-blue-50 rounded-lg px-3 py-1.5 flex items-start gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700 line-clamp-1">{task.progress_note}</p>
            </div>
          )}

          {/* Date change request info */}
          {task.status === 'date_change_requested' && isEAOrDirector && (
            <div className="mt-2 bg-orange-50 border border-orange-100 rounded-lg p-2.5">
              <p className="text-xs font-semibold text-orange-700 mb-0.5">Date change requested</p>
              <p className="text-sm text-orange-600">{task.end_date} → {task.requested_new_date}</p>
              <p className="text-xs text-orange-500 mt-0.5">Reason: {task.date_change_reason}</p>
            </div>
          )}

          {/* Blocked indicator */}
          {isAssignee && task.status === 'blocked' && (
            <div className="mt-2 flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 text-sm text-purple-700">
              <Lock className="w-4 h-4 shrink-0" />
              Waiting for predecessor tasks to complete
            </div>
          )}
        </div>

        {/* Actions area */}
        <div className="px-4 pb-3 flex flex-col gap-2">
          {/* Primary action buttons */}
          <div className="flex gap-2 flex-wrap">
            {/* Assignee: Mark Done */}
            {isAssignee && task.status === 'open' && (
              <Button onClick={handleMarkDone} disabled={acting}
                className="flex-1 min-h-[44px] gap-2 bg-green-600 hover:bg-green-700 text-sm font-medium">
                {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Mark Done
              </Button>
            )}

            {/* Assignee: Update Progress */}
            {isAssignee && (task.status === 'open' || task.status === 'blocked') && !showProgressInput && (
              <Button variant="outline" onClick={() => setShowProgressInput(true)}
                className="flex-1 min-h-[44px] gap-2 text-sm font-medium">
                <MessageSquare className="w-4 h-4" /> Update Progress
              </Button>
            )}

            {/* Assignee: Request Date Change */}
            {isAssignee && task.status === 'open' && (
              <Button variant="outline" onClick={() => setShowDateChange(true)}
                className="flex-1 min-h-[44px] gap-2 text-sm font-medium">
                <CalendarClock className="w-4 h-4" /> Request Date Change
              </Button>
            )}

            {/* EA/Director: Verify completion */}
            {isEAOrDirector && task.status === 'pending_verification' && (
              <Button onClick={handleVerify} disabled={acting}
                className="flex-1 min-h-[44px] gap-2 bg-green-600 hover:bg-green-700 text-sm font-medium">
                {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirm Done
              </Button>
            )}
            {isEAOrDirector && task.status === 'pending_verification' && (
              <Button variant="outline" onClick={handleReopen} disabled={acting}
                className="flex-1 min-h-[44px] text-sm font-medium">
                Reopen
              </Button>
            )}

            {/* EA/Director: Approve/Reject Date Change */}
            {isEAOrDirector && task.status === 'date_change_requested' && (
              <>
                <Button onClick={handleApproveDateChange} disabled={acting}
                  className="flex-1 min-h-[44px] gap-2 bg-green-600 hover:bg-green-700 text-sm font-medium">
                  {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Approve
                </Button>
                <Button variant="outline" onClick={handleRejectDateChange} disabled={acting}
                  className="flex-1 min-h-[44px] text-sm font-medium">
                  Reject
                </Button>
              </>
            )}
          </div>

          {/* Progress input inline */}
          {showProgressInput && (
            <div className="flex gap-2">
              <Input value={progressNote} onChange={e => setProgressNote(e.target.value)}
                placeholder="What's the latest update?" className="flex-1 h-11 text-sm" />
              <Button size="icon" variant="ghost" className="h-11 w-11 shrink-0"
                onClick={() => setShowProgressInput(false)}>
                <XCircle className="w-4 h-4 text-slate-400" />
              </Button>
              <Button className="h-11 px-4 gap-2 bg-blue-600 hover:bg-blue-700 text-sm"
                onClick={handleProgressUpdate} disabled={!progressNote.trim() || acting}>
                {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send
              </Button>
            </div>
          )}

          {/* Bottom row: secondary actions + toggles */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {isEAOrDirector && (task.status === 'open' || task.status === 'date_change_requested') && (
                <button onClick={handleCancel} disabled={acting}
                  className="flex items-center gap-1 text-sm text-red-400 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors min-h-[40px]">
                  <XCircle className="w-4 h-4" /> Cancel Task
                </button>
              )}
            </div>
            <div className="flex gap-1">
              <button onClick={() => { setExpanded(e => !e); setShowLog(false); }}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-3 py-2 rounded-lg transition-colors min-h-[40px]">
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Details
              </button>
              <button onClick={() => { setShowLog(e => !e); setExpanded(false); }}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-3 py-2 rounded-lg transition-colors min-h-[40px]">
                <ScrollText className="w-4 h-4" /> Log
              </button>
            </div>
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="border-t border-slate-100 px-4 py-3 space-y-3 bg-slate-50">
            {/* Reference info as clean labelled rows */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-400 w-20 shrink-0">Task ID</span>
                <span className="text-sm text-slate-700 font-medium">{task.task_number}</span>
              </div>
              {task.task_type === 'project' && task.project_name && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-400 w-20 shrink-0">Project</span>
                  <span className="text-sm text-slate-700">{task.project_name}</span>
                </div>
              )}
              {(task.assigned_by_name || task.director_name) && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-400 w-20 shrink-0">Assigned by</span>
                  <span className="text-sm text-slate-700">{task.assigned_by_name || task.director_name}</span>
                </div>
              )}
            </div>

            {task.task_details && (
              <div className="bg-white rounded-lg p-3 border border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">What to do</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{task.task_details}</p>
              </div>
            )}
            {task.progress_note && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Latest Progress Update</p>
                <p className="text-sm text-blue-800 whitespace-pre-wrap">{task.progress_note}</p>
                {task.progress_updated_at && (
                  <p className="text-xs text-blue-400 mt-1">
                    {new Date(task.progress_updated_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            )}
            {task.predecessor_task_numbers?.length > 0 && (
              <div className="text-xs text-slate-500">
                Depends on: {task.predecessor_task_numbers.join(', ')}
              </div>
            )}
            <div className="space-y-1.5 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-400 w-20 shrink-0">Start</span>
                <span className="text-sm text-slate-600">{formatTaskDate(task.start_date, task.start_time) || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-400 w-20 shrink-0">End</span>
                <span className="text-sm text-slate-600">{formatTaskDate(task.end_date, task.end_time)}</span>
              </div>
              {!isAssignee && task.assigned_to_name && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-400 w-20 shrink-0">Assigned to</span>
                  <span className="text-sm text-slate-600">{task.assigned_to_name}</span>
                </div>
              )}
              {task.verified_by_name && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-400 w-20 shrink-0">Verified by</span>
                  <span className="text-sm text-slate-600">{task.verified_by_name}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Activity Log */}
        {showLog && (
          <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
            <DirectorTaskLogPanel taskId={task.id} />
          </div>
        )}
      </div>

      {/* Date Change Request Modal */}
      {showDateChange && (
        <Dialog open onOpenChange={() => setShowDateChange(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Request Date Change</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
                Current deadline: <strong>{formatTaskDate(task.end_date, task.end_time)}</strong>
              </div>
              <DatePickerField
                label="New End Date"
                required
                value={newDate}
                onChange={setNewDate}
                placeholder="Select new date"
              />
              <div>
                <label className="text-xs font-medium text-slate-700">New End Time</label>
                <Input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
                  className="mt-1 h-11 md:h-9" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">
                  Reason <span className="text-red-500">*</span>
                </label>
                <Textarea value={dateChangeReason} onChange={e => setDateChangeReason(e.target.value)}
                  placeholder="Why do you need more time?" className="mt-1 min-h-[80px]" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowDateChange(false)} className="flex-1 h-11">
                  Cancel
                </Button>
                <Button onClick={handleDateChangeRequest}
                  disabled={!newDate || !dateChangeReason.trim() || acting}
                  className="flex-1 h-11 gap-2">
                  {acting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit Request
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}