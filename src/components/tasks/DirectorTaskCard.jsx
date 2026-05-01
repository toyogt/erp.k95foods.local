import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  CheckCircle2, AlertTriangle, Clock, Calendar, User,
  Loader2, ChevronDown, ChevronUp, CalendarClock, MessageSquare, ScrollText, XCircle,
  Layers, Lock, Send
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

  // Assignee marks as done
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

  // EA/Director verifies completion
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

  // EA/Director reopens task
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

  // Assignee requests date change
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

  // EA/Director approves date change
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

  // EA/Director rejects date change
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

  // EA/Director cancels task
  const handleCancel = async () => {
    setActing(true);
    await base44.entities.DirectorTask.update(task.id, { status: 'cancelled' });
    await logTaskAction(task, 'cancelled', user, `Task cancelled by ${user.full_name}`);
    setActing(false);
    onRefresh?.();
  };

  // Send progress update
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
      <div className={`bg-white rounded-xl border border-slate-200 border-l-4 ${borderColor} shadow-sm`}>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* Tags row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                  {task.task_number}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                  {status.label}
                </span>
                {task.task_type === 'project' && task.project_name && (
                  <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <Layers className="w-3 h-3" /> {task.project_name}
                  </span>
                )}
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
                  <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-semibold">
                    OVERDUE
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 className="font-semibold text-slate-800 mt-1.5 text-base">{task.task_name}</h3>

              {/* Meta */}
              <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {isAssignee ? 'You' : task.assigned_to_name || task.assigned_to_email}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Due: {formatTaskDate(task.end_date, task.end_time)}
                </span>
                {task.director_name && (
                  <span className="flex items-center gap-1 text-slate-400">
                    From: {task.director_name}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 items-end shrink-0">
              {/* Blocked indicator */}
              {isAssignee && task.status === 'blocked' && (
                <div className="flex items-center gap-1.5 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 text-xs text-purple-700">
                  <Lock className="w-3.5 h-3.5" />
                  Waiting for predecessor tasks
                </div>
              )}

              {/* Assignee: Mark Done */}
              {isAssignee && task.status === 'open' && (
                <Button size="sm" onClick={handleMarkDone} disabled={acting}
                  className="gap-1.5 min-h-[44px] min-w-[120px] bg-green-600 hover:bg-green-700">
                  {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Mark Done
                </Button>
              )}

              {/* Assignee: Send progress update */}
              {isAssignee && (task.status === 'open' || task.status === 'blocked') && (
                !showProgressInput ? (
                  <Button size="sm" variant="outline" onClick={() => setShowProgressInput(true)}
                    className="gap-1.5 min-h-[36px] text-xs">
                    <MessageSquare className="w-3.5 h-3.5" /> Update Progress
                  </Button>
                ) : (
                  <div className="space-y-1.5 w-full md:w-48">
                    <Input value={progressNote} onChange={e => setProgressNote(e.target.value)}
                      placeholder="What's the update?" className="h-9 text-sm" />
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => setShowProgressInput(false)}>Cancel</Button>
                      <Button size="sm" className="flex-1 h-8 text-xs gap-1 bg-blue-600 hover:bg-blue-700"
                        onClick={handleProgressUpdate} disabled={!progressNote.trim() || acting}>
                        <Send className="w-3 h-3" /> Send
                      </Button>
                    </div>
                  </div>
                )
              )}

              {/* Assignee: Request Date Change */}
              {isAssignee && (task.status === 'open') && (
                <Button size="sm" variant="outline" onClick={() => setShowDateChange(true)}
                  className="gap-1.5 min-h-[36px] text-xs">
                  <CalendarClock className="w-3.5 h-3.5" /> Request Date Change
                </Button>
              )}

              {/* EA/Director: Verify or Reopen */}
              {isEAOrDirector && task.status === 'pending_verification' && (
                <div className="flex gap-1.5">
                  <Button size="sm" onClick={handleVerify} disabled={acting}
                    className="gap-1.5 min-h-[44px] bg-green-600 hover:bg-green-700">
                    {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Confirm Done
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleReopen} disabled={acting}
                    className="min-h-[44px]">
                    Reopen
                  </Button>
                </div>
              )}

              {/* EA/Director: Approve/Reject Date Change */}
              {isEAOrDirector && task.status === 'date_change_requested' && (
                <div className="space-y-1.5">
                  <div className="bg-orange-50 border border-orange-100 rounded-lg p-2 text-xs">
                    <p className="font-medium text-orange-700">Date change requested</p>
                    <p className="text-orange-600 mt-0.5">{task.end_date} → {task.requested_new_date}</p>
                    <p className="text-orange-500 mt-0.5">Reason: {task.date_change_reason}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" onClick={handleApproveDateChange} disabled={acting}
                      className="flex-1 min-h-[40px] bg-green-600 hover:bg-green-700 text-xs">
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleRejectDateChange} disabled={acting}
                      className="flex-1 min-h-[40px] text-xs">
                      Reject
                    </Button>
                  </div>
                </div>
              )}

              {/* Cancel — only for EA/Director on open tasks */}
              {isEAOrDirector && (task.status === 'open' || task.status === 'date_change_requested') && (
                <Button size="sm" variant="ghost" onClick={handleCancel} disabled={acting}
                  className="gap-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 min-h-[32px]">
                  <XCircle className="w-3.5 h-3.5" /> Cancel
                </Button>
              )}

              {/* Toggle buttons row */}
              <div className="flex gap-1">
                <button onClick={() => setExpanded(e => !e)}
                  className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-xs min-h-[36px] px-2">
                  {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {expanded ? 'Less' : 'Details'}
                </button>
                <button onClick={() => setShowLog(e => !e)}
                  className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-xs min-h-[36px] px-2">
                  <ScrollText className="w-3.5 h-3.5" /> Log
                </button>
              </div>
            </div>
          </div>

          {/* Expanded details */}
          {expanded && (
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
              {task.task_details && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">What to do</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{task.task_details}</p>
                </div>
              )}
              {task.progress_note && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-600 uppercase mb-1">Latest Progress Update</p>
                  <p className="text-sm text-blue-800 whitespace-pre-wrap">{task.progress_note}</p>
                  {task.progress_updated_at && (
                    <p className="text-xs text-blue-400 mt-1">
                      {new Date(task.progress_updated_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              )}
              {task.predecessor_task_numbers?.length > 0 && (
                <div className="text-xs text-slate-400">
                  Depends on: {task.predecessor_task_numbers.join(', ')}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                <div>Start: {formatTaskDate(task.start_date, task.start_time) || 'Not set'}</div>
                <div>End: {formatTaskDate(task.end_date, task.end_time)}</div>
                <div>Assigned by: {task.assigned_by_name || task.assigned_by_email}</div>
                {task.verified_by_name && <div>Verified by: {task.verified_by_name}</div>}
              </div>
            </div>
          )}

          {/* Activity Log */}
          {showLog && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <DirectorTaskLogPanel taskId={task.id} />
            </div>
          )}
        </div>
      </div>

      {/* Date Change Request Modal */}
      {showDateChange && (
        <Dialog open onOpenChange={() => setShowDateChange(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Request Date Change</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2">
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
                <label className="text-xs font-medium text-slate-700">Reason <span className="text-red-500">*</span></label>
                <Textarea value={dateChangeReason} onChange={e => setDateChangeReason(e.target.value)}
                  placeholder="Why do you need more time?" className="mt-1 min-h-[60px]" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowDateChange(false)} className="flex-1 h-11">Cancel</Button>
                <Button onClick={handleDateChangeRequest} disabled={!newDate || !dateChangeReason.trim() || acting}
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