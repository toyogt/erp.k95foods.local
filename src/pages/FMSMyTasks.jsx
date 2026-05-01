import { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import TATBadge from '@/components/fms/TATBadge';
import StepChecklistRunner from '@/components/fms/StepChecklistRunner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, ClipboardList, ClipboardCheck, Clock, AlertTriangle, Search, X } from 'lucide-react';
import { formatDateTime, getTATStatus } from '@/lib/fmsHelpers';
import { Input } from '@/components/ui/input';
import moment from 'moment';
import DirectorTaskCard from '@/components/tasks/DirectorTaskCard';
import { isTaskOverdue } from '@/lib/directorTaskHelpers';

function TaskCard({ step, onComplete, onOpenChecklist, completing }) {
  const [expanded, setExpanded] = useState(false);
  const tatStatus = getTATStatus(step.deadline);
  const isChecklist = step.completion_mode !== 'auto' && step.completion_submode === 'checklist';

  const borderColor = tatStatus === 'overdue' ? 'border-l-red-500' : tatStatus === 'at_risk' ? 'border-l-yellow-400' : 'border-l-green-400';

  return (
    <div className={`bg-white rounded-xl border border-slate-200 border-l-4 ${borderColor} shadow-sm`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                {step._process_name || 'Process'}
              </span>
              {step.completion_mode === 'auto' && (
                <span className="text-xs bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full">Auto-complete</span>
              )}
              {isChecklist && (
                <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ClipboardCheck className="w-3 h-3" /> Checklist required
                </span>
              )}
            </div>
            <h3 className="font-semibold text-slate-800 mt-1 text-base">{step.step_name}</h3>
            {step.description && (
              <p className="text-sm text-slate-500 mt-1 line-clamp-2">{step.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <TATBadge deadline={step.deadline} />
              <span className="text-xs text-slate-400">Activated {formatDateTime(step.activated_at)}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end shrink-0">
            {step.completion_mode !== 'auto' && (
              isChecklist ? (
                <Button
                  size="sm"
                  onClick={() => onOpenChecklist(step)}
                  disabled={completing === step.id}
                  className="gap-1.5 min-h-[44px] min-w-[130px] bg-purple-600 hover:bg-purple-700"
                >
                  {completing === step.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                  Fill & Complete
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => onComplete(step)}
                  disabled={completing === step.id}
                  className="gap-1.5 min-h-[44px] min-w-[120px] bg-green-600 hover:bg-green-700"
                >
                  {completing === step.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Mark Done
                </Button>
              )
            )}
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-xs min-h-[36px] px-2"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {expanded ? 'Less' : 'Instructions'}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            {step.instructions ? (
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">How to do it</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{step.instructions}</p>
              </div>
            ) : (
              <p className="text-xs text-slate-400">No instructions provided.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Simple mark-done modal with note
function MarkDoneModal({ step, onConfirm, onCancel, loading }) {
  const [note, setNote] = useState('');
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-slate-800 text-base">{step.step_name}</h3>
        <p className="text-sm text-slate-500 mt-0.5">Mark this step as completed.</p>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600">Completion Note (optional)</label>
        <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Any notes…" className="mt-1" />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} className="flex-1 min-h-[44px]">Cancel</Button>
        <Button onClick={() => onConfirm({ note })} disabled={loading} className="flex-1 min-h-[44px] bg-green-600 hover:bg-green-700 gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Mark Done
        </Button>
      </div>
    </div>
  );
}

// Scheduled Task Card for My Tasks
function ScheduledTaskCard({ task, user, onComplete }) {
  const [completing, setCompleting] = useState(false);
  const [note, setNote] = useState('');
  const [showComplete, setShowComplete] = useState(false);
  const isOverdue = task.due_at && new Date(task.due_at) < new Date();
  const dueMoment = task.due_at ? moment(task.due_at) : null;
  const borderColor = isOverdue ? 'border-l-red-500' : 'border-l-blue-400';

  const handleComplete = async () => {
    setCompleting(true);
    await base44.entities.ScheduledTaskInstance.update(task.id, {
      status: 'COMPLETED', completed_at: new Date().toISOString(),
      completed_by: user?.email, completion_note: note,
    });
    setCompleting(false);
    setShowComplete(false);
    onComplete?.();
  };

  return (
    <div className={`bg-white rounded-xl border border-slate-200 border-l-4 ${borderColor} shadow-sm`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" /> Scheduled Task
              </span>
              {task.group_name && (
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">{task.group_name}</span>
              )}
            </div>
            <h3 className="font-semibold text-slate-800 mt-1 text-base">{task.task_name}</h3>
            {task.description && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{task.description}</p>}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {dueMoment && (
                <span className={`text-xs font-medium flex items-center gap-1 ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
                  {isOverdue ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  Due: {dueMoment.format('DD/MM/YYYY HH:mm')}
                  {isOverdue && ` (${dueMoment.fromNow()})`}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end shrink-0">
            {!showComplete ? (
              <Button size="sm" onClick={() => setShowComplete(true)}
                className="gap-1.5 min-h-[44px] min-w-[120px] bg-green-600 hover:bg-green-700">
                <CheckCircle2 className="w-4 h-4" /> Mark Done
              </Button>
            ) : (
              <div className="space-y-2 w-56">
                <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" className="h-9 text-sm" />
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="flex-1 h-9" onClick={() => setShowComplete(false)}>Cancel</Button>
                  <Button size="sm" className="flex-1 h-9 bg-green-600 hover:bg-green-700" onClick={handleComplete} disabled={completing}>
                    {completing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Done'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FMSMyTasks() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [scheduledTasks, setScheduledTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [directorTasks, setDirectorTasks] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(null); // null | 'overdue' | 'at_risk' | 'on_time'
  const [typeFilter, setTypeFilter] = useState('all');    // 'all' | 'process' | 'assigned' | 'scheduled'

  const load = useCallback(async () => {
    const me = await base44.auth.me();
    setUser(me);
    const [allSteps, myScheduled, myDirectorTasks] = await Promise.all([
      base44.entities.FMSStepInstance.filter({ assignee_email: me.email, status: 'active' }, '-deadline', 100).catch(() => []),
      base44.entities.ScheduledTaskInstance.filter({ assignee_email: me.email, status: 'PENDING' }, '-due_at', 100).catch(() => []),
      base44.entities.DirectorTask.filter({ assigned_to_email: me.email }, '-created_date', 100).catch(() => []),
    ]);
    const instanceIds = [...new Set((allSteps || []).map(s => s.instance_id).filter(Boolean))];
    const instances = instanceIds.length
      ? await Promise.all(instanceIds.map(id => base44.entities.FMSProcessInstance.filter({ id }).catch(() => [])))
      : [];
    const instanceMap = {};
    instances.flat().forEach(inst => { instanceMap[inst.id] = inst; });
    const enriched = (allSteps || []).map(s => ({
      ...s,
      _process_name: instanceMap[s.instance_id]?.process_name || s.process_id,
      _instance_title: instanceMap[s.instance_id]?.title || '',
    }));
    enriched.sort((a, b) => {
      const priority = { overdue: 0, at_risk: 1, on_time: 2, unknown: 3 };
      const pa = priority[getTATStatus(a.deadline)] ?? 3;
      const pb = priority[getTATStatus(b.deadline)] ?? 3;
      if (pa !== pb) return pa - pb;
      return new Date(a.deadline || 0) - new Date(b.deadline || 0);
    });
    setTasks(enriched);
    // Sort scheduled: overdue first
    const sorted = [...myScheduled].sort((a, b) => {
      const aOD = a.due_at && new Date(a.due_at) < new Date();
      const bOD = b.due_at && new Date(b.due_at) < new Date();
      if (aOD && !bOD) return -1;
      if (!aOD && bOD) return 1;
      return new Date(a.due_at || 0) - new Date(b.due_at || 0);
    });
    setScheduledTasks(sorted);
    // Director tasks: show open + pending_verification + date_change_requested
    const activeDT = (myDirectorTasks || []).filter(t => ['open', 'pending_verification', 'date_change_requested'].includes(t.status));
    activeDT.sort((a, b) => {
      const aOD = isTaskOverdue(a) ? 0 : 1;
      const bOD = isTaskOverdue(b) ? 0 : 1;
      if (aOD !== bOD) return aOD - bOD;
      const aImp = a.is_important ? 0 : 1;
      const bImp = b.is_important ? 0 : 1;
      return aImp - bImp;
    });
    setDirectorTasks(activeDT);
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const doComplete = async (step, { note, checklist_responses }) => {
    setCompleting(step.id);
    await base44.functions.invoke('fmsTriggerProcess', {
      action: 'complete_step',
      step_instance_id: step.id,
      completion_note: note || '',
      checklist_responses: checklist_responses || null,
    });
    setCompleting(null);
    setActiveModal(null);
    load();
  };

  const handleMarkDone = (step) => setActiveModal({ step, type: 'markdone' });
  const handleOpenChecklist = (step) => setActiveModal({ step, type: 'checklist' });

  const overdue = tasks.filter(t => getTATStatus(t.deadline) === 'overdue');
  const atRisk = tasks.filter(t => getTATStatus(t.deadline) === 'at_risk');
  const onTime = tasks.filter(t => getTATStatus(t.deadline) === 'on_time');
  const dtOverdue = directorTasks.filter(t => isTaskOverdue(t));
  const totalPending = tasks.length + scheduledTasks.length + directorTasks.length;

  // Filtered lists applying search + statusFilter + typeFilter
  const filteredTasks = useMemo(() => {
    if (typeFilter === 'assigned' || typeFilter === 'scheduled') return [];
    let list = tasks;
    if (statusFilter === 'overdue') list = list.filter(t => getTATStatus(t.deadline) === 'overdue');
    else if (statusFilter === 'at_risk') list = list.filter(t => getTATStatus(t.deadline) === 'at_risk');
    else if (statusFilter === 'on_time') list = list.filter(t => getTATStatus(t.deadline) === 'on_time');
    if (search) list = list.filter(t => (t.step_name || '').toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [tasks, statusFilter, typeFilter, search]);

  const filteredDirectorTasks = useMemo(() => {
    if (typeFilter === 'process' || typeFilter === 'scheduled') return [];
    let list = directorTasks;
    if (statusFilter === 'overdue') list = list.filter(t => isTaskOverdue(t));
    else if (statusFilter === 'at_risk' || statusFilter === 'on_time') list = [];
    if (search) list = list.filter(t => (t.task_name || '').toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [directorTasks, statusFilter, typeFilter, search]);

  const filteredScheduledTasks = useMemo(() => {
    if (typeFilter === 'process' || typeFilter === 'assigned') return [];
    let list = scheduledTasks;
    if (statusFilter === 'overdue') list = list.filter(t => t.due_at && new Date(t.due_at) < new Date());
    else if (statusFilter === 'at_risk' || statusFilter === 'on_time') list = [];
    if (search) list = list.filter(t => (t.task_name || '').toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [scheduledTasks, statusFilter, typeFilter, search]);

  const hasAnyResults = filteredTasks.length > 0 || filteredDirectorTasks.length > 0 || filteredScheduledTasks.length > 0;

  const clearFilters = () => { setSearch(''); setStatusFilter(null); setTypeFilter('all'); };

  return (
    <>
    <div className="p-3 md:p-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-slate-900">My Tasks</h1>
          <p className="text-slate-500 text-sm mt-0.5">Your pending assignments across all processes</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : tasks.length === 0 && scheduledTasks.length === 0 && directorTasks.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
            <ClipboardList className="w-14 h-14 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 font-semibold text-lg">All caught up!</p>
            <p className="text-slate-400 text-sm mt-1">No pending tasks right now.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Summary counter cards — clickable to filter */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={() => setStatusFilter(null)}
                className={`rounded-2xl p-4 text-center border transition-all ${statusFilter === null ? 'bg-slate-800 border-slate-800 text-white ring-2 ring-slate-400' : 'bg-slate-50 border-slate-200 hover:border-slate-400'}`}
              >
                <p className={`text-3xl font-bold ${statusFilter === null ? 'text-white' : 'text-slate-700'}`}>{totalPending}</p>
                <p className={`text-sm font-medium mt-1 ${statusFilter === null ? 'text-slate-300' : 'text-slate-500'}`}>Total Pending</p>
              </button>
              <button
                onClick={() => setStatusFilter(prev => prev === 'overdue' ? null : 'overdue')}
                className={`rounded-2xl p-4 text-center border transition-all ${statusFilter === 'overdue' ? 'bg-red-600 border-red-600 ring-2 ring-red-300' : 'bg-red-50 border-red-100 hover:border-red-300'}`}
              >
                <p className={`text-3xl font-bold ${statusFilter === 'overdue' ? 'text-white' : 'text-red-600'}`}>{overdue.length + dtOverdue.length}</p>
                <p className={`text-sm font-medium mt-1 ${statusFilter === 'overdue' ? 'text-red-100' : 'text-red-400'}`}>Overdue</p>
              </button>
              <button
                onClick={() => setStatusFilter(prev => prev === 'at_risk' ? null : 'at_risk')}
                className={`rounded-2xl p-4 text-center border transition-all ${statusFilter === 'at_risk' ? 'bg-yellow-500 border-yellow-500 ring-2 ring-yellow-300' : 'bg-yellow-50 border-yellow-100 hover:border-yellow-300'}`}
              >
                <p className={`text-3xl font-bold ${statusFilter === 'at_risk' ? 'text-white' : 'text-yellow-600'}`}>{atRisk.length}</p>
                <p className={`text-sm font-medium mt-1 ${statusFilter === 'at_risk' ? 'text-yellow-100' : 'text-yellow-500'}`}>At Risk</p>
              </button>
              <button
                onClick={() => setStatusFilter(prev => prev === 'on_time' ? null : 'on_time')}
                className={`rounded-2xl p-4 text-center border transition-all ${statusFilter === 'on_time' ? 'bg-green-600 border-green-600 ring-2 ring-green-300' : 'bg-green-50 border-green-100 hover:border-green-300'}`}
              >
                <p className={`text-3xl font-bold ${statusFilter === 'on_time' ? 'text-white' : 'text-green-600'}`}>{onTime.length}</p>
                <p className={`text-sm font-medium mt-1 ${statusFilter === 'on_time' ? 'text-green-100' : 'text-green-500'}`}>On Time</p>
              </button>
            </div>

            {/* Search + Type filter */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search tasks…"
                  className="pl-9 h-11 text-sm"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'process', label: 'Process Steps' },
                  { key: 'assigned', label: 'Assigned' },
                  { key: 'scheduled', label: 'Scheduled' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setTypeFilter(opt.key)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all min-h-[44px] ${typeFilter === opt.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Active filter indicator */}
            {(statusFilter || search || typeFilter !== 'all') && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>Filtering active</span>
                <button onClick={clearFilters} className="text-blue-600 hover:underline font-medium">Clear all</button>
              </div>
            )}

            {/* No results after filter */}
            {!hasAnyResults && (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
                <p className="text-slate-500 font-semibold">No tasks match your filters</p>
                <button onClick={clearFilters} className="text-blue-600 text-sm mt-2 hover:underline">Clear filters</button>
              </div>
            )}

            {/* Process Step sections */}
            {filteredTasks.filter(t => getTATStatus(t.deadline) === 'overdue').length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wide">Overdue ({filteredTasks.filter(t => getTATStatus(t.deadline) === 'overdue').length})</h2>
                </div>
                <div className="space-y-3">
                  {filteredTasks.filter(t => getTATStatus(t.deadline) === 'overdue').map(t => <TaskCard key={t.id} step={t} onComplete={handleMarkDone} onOpenChecklist={handleOpenChecklist} completing={completing} />)}
                </div>
              </div>
            )}
            {filteredTasks.filter(t => getTATStatus(t.deadline) === 'at_risk').length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-yellow-500" />
                  <h2 className="text-sm font-semibold text-yellow-600 uppercase tracking-wide">Due Soon ({filteredTasks.filter(t => getTATStatus(t.deadline) === 'at_risk').length})</h2>
                </div>
                <div className="space-y-3">
                  {filteredTasks.filter(t => getTATStatus(t.deadline) === 'at_risk').map(t => <TaskCard key={t.id} step={t} onComplete={handleMarkDone} onOpenChecklist={handleOpenChecklist} completing={completing} />)}
                </div>
              </div>
            )}
            {filteredTasks.filter(t => getTATStatus(t.deadline) === 'on_time').length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <h2 className="text-sm font-semibold text-green-600 uppercase tracking-wide">On Track ({filteredTasks.filter(t => getTATStatus(t.deadline) === 'on_time').length})</h2>
                </div>
                <div className="space-y-3">
                  {filteredTasks.filter(t => getTATStatus(t.deadline) === 'on_time').map(t => <TaskCard key={t.id} step={t} onComplete={handleMarkDone} onOpenChecklist={handleOpenChecklist} completing={completing} />)}
                </div>
              </div>
            )}

            {/* Director Assigned Tasks Section */}
            {filteredDirectorTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  <h2 className="text-sm font-semibold text-indigo-600 uppercase tracking-wide">Assigned Tasks ({filteredDirectorTasks.length})</h2>
                </div>
                <div className="space-y-3">
                  {filteredDirectorTasks.map(t => (
                    <DirectorTaskCard key={t.id} task={t} user={user} viewMode="assignee" onRefresh={load} />
                  ))}
                </div>
              </div>
            )}

            {/* Scheduled Tasks Section */}
            {filteredScheduledTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <h2 className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Scheduled Tasks ({filteredScheduledTasks.length})</h2>
                </div>
                <div className="space-y-3">
                  {filteredScheduledTasks.map(t => <ScheduledTaskCard key={t.id} task={t} user={user} onComplete={load} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Completion Modal */}
      {activeModal && (
        <Dialog open onOpenChange={() => setActiveModal(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {activeModal.type === 'checklist' ? 'Complete Step Checklist' : 'Complete Step'}
              </DialogTitle>
            </DialogHeader>
            {activeModal.type === 'checklist' ? (
              <StepChecklistRunner
                step={activeModal.step}
                onComplete={(data) => doComplete(activeModal.step, data)}
                onCancel={() => setActiveModal(null)}
              />
            ) : (
              <MarkDoneModal
                step={activeModal.step}
                loading={completing === activeModal.step.id}
                onConfirm={(data) => doComplete(activeModal.step, data)}
                onCancel={() => setActiveModal(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}