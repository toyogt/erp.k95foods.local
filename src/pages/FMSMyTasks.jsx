import { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import TATBadge from '@/components/fms/TATBadge';
import StepChecklistRunner from '@/components/fms/StepChecklistRunner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, ClipboardList, ClipboardCheck, Clock, AlertTriangle, Search, X, SlidersHorizontal, Calendar } from 'lucide-react';
import { formatDateTime, getTATStatus } from '@/lib/fmsHelpers';
import { Input } from '@/components/ui/input';
import moment from 'moment';
import DirectorTaskCard from '@/components/tasks/DirectorTaskCard';
import TaskLanguageToggle from '@/components/tasks/TaskLanguageToggle';
import { isTaskOverdue } from '@/lib/directorTaskHelpers';

function TaskCard({ step, onComplete, onOpenChecklist, completing }) {
  const [expanded, setExpanded] = useState(false);
  const tatStatus = getTATStatus(step.deadline);
  const isChecklist = step.completion_mode !== 'auto' && step.completion_submode === 'checklist';

  const accentBg = tatStatus === 'overdue' ? 'bg-red-500' : tatStatus === 'at_risk' ? 'bg-amber-400' : 'bg-emerald-400';
  const cardBg = tatStatus === 'overdue' ? 'bg-red-50/40' : tatStatus === 'at_risk' ? 'bg-amber-50/40' : 'bg-white';

  return (
    <div className={`rounded-2xl border border-slate-200 overflow-hidden shadow-sm ${cardBg}`}>
      {/* Top accent strip */}
      <div className={`h-1 w-full ${accentBg}`} />
      <div className="p-4">
        {/* Meta tags row */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <span className="text-xs bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-medium">
            {step._process_name || 'Process'}
          </span>
          {isChecklist && (
            <span className="text-xs bg-purple-50 border border-purple-200 text-purple-600 px-2 py-0.5 rounded-full flex items-center gap-1">
              <ClipboardCheck className="w-3 h-3" /> Checklist
            </span>
          )}
          {step.completion_mode === 'auto' && (
            <span className="text-xs bg-blue-50 border border-blue-200 text-blue-600 px-2 py-0.5 rounded-full">Auto</span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-slate-900 text-base leading-snug">{step.step_name}</h3>
        {step.description && (
          <p className="text-sm text-slate-500 mt-1 line-clamp-2">{step.description}</p>
        )}

        {/* Deadline row */}
        <div className="flex items-center gap-3 mt-2.5 flex-wrap">
          <TATBadge deadline={step.deadline} />
          <span className="text-xs text-slate-400">Started {formatDateTime(step.activated_at)}</span>
        </div>

        {/* Action row */}
        {step.completion_mode !== 'auto' && (
          <div className="mt-3 flex gap-2">
            {isChecklist ? (
              <Button
                onClick={() => onOpenChecklist(step)}
                disabled={completing === step.id}
                className="flex-1 min-h-[44px] gap-2 bg-purple-600 hover:bg-purple-700 text-sm font-medium"
              >
                {completing === step.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                Fill Checklist & Complete
              </Button>
            ) : (
              <Button
                onClick={() => onComplete(step)}
                disabled={completing === step.id}
                className="flex-1 min-h-[44px] gap-2 bg-green-600 hover:bg-green-700 text-sm font-medium"
              >
                {completing === step.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Mark Done
              </Button>
            )}
            <button
              onClick={() => setExpanded(e => !e)}
              className="px-3 min-h-[44px] rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:border-slate-300 flex items-center gap-1.5 text-sm transition-all"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <span className="hidden sm:inline">{expanded ? 'Less' : 'Instructions'}</span>
            </button>
          </div>
        )}

        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            {step.instructions ? (
              <div className="bg-white rounded-xl border border-slate-100 p-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Instructions</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{step.instructions}</p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No instructions provided.</p>
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
    <div className={`rounded-2xl border overflow-hidden shadow-sm bg-white ${isOverdue ? 'border-red-200' : 'border-slate-200'}`}>
      <div className={`h-1 w-full ${isOverdue ? 'bg-red-500' : 'bg-blue-400'}`} />
      <div className="p-4">
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <span className="text-xs bg-blue-50 border border-blue-200 text-blue-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
            <Clock className="w-3 h-3" /> Scheduled
          </span>
          {task.group_name && (
            <span className="text-xs bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-medium">{task.group_name}</span>
          )}
          {isOverdue && (
            <span className="text-xs bg-red-50 border border-red-200 text-red-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Overdue
            </span>
          )}
        </div>

        <h3 className="font-semibold text-slate-900 text-base leading-snug">{task.task_name}</h3>
        {task.description && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{task.description}</p>}

        {dueMoment && (
          <div className={`flex items-center gap-1.5 mt-2.5 text-xs font-medium ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
            <Calendar className="w-3.5 h-3.5" />
            Due: {dueMoment.format('DD/MM/YYYY HH:mm')}
            {isOverdue && <span className="text-red-400">({dueMoment.fromNow()})</span>}
          </div>
        )}

        <div className="mt-3">
          {!showComplete ? (
            <Button onClick={() => setShowComplete(true)}
              className="w-full min-h-[44px] gap-2 bg-green-600 hover:bg-green-700 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" /> Mark Done
            </Button>
          ) : (
            <div className="space-y-2">
              <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Completion note (optional)" className="h-11 text-sm" />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 min-h-[44px]" onClick={() => setShowComplete(false)}>Cancel</Button>
                <Button className="flex-1 min-h-[44px] bg-green-600 hover:bg-green-700 gap-2" onClick={handleComplete} disabled={completing}>
                  {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Confirm Done
                </Button>
              </div>
            </div>
          )}
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
  const [dateFilter, setDateFilter] = useState('all');    // 'all' | 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'this_month'
  const [taskLang, setTaskLang] = useState('english');
  const [taskTranslations, setTaskTranslations] = useState({}); // { [taskId]: { task_name, task_details } }

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

  // Date filter helper — returns true if a date string (ISO or DD/MM/YYYY) falls in the selected window
  const matchesDateFilter = useCallback((dateStr) => {
    if (dateFilter === 'all' || !dateStr) return true;
    const now = moment();
    // Parse both ISO (for FMS/scheduled) and DD/MM/YYYY (for director tasks)
    const d = moment(dateStr, ['YYYY-MM-DDTHH:mm:ss', 'YYYY-MM-DD', 'DD/MM/YYYY'], true);
    if (!d.isValid()) return true;
    if (dateFilter === 'today') return d.isSame(now, 'day');
    if (dateFilter === 'tomorrow') return d.isSame(moment().add(1, 'day'), 'day');
    if (dateFilter === 'this_week') return d.isSame(now, 'week');
    if (dateFilter === 'next_week') return d.isSame(moment().add(1, 'week'), 'week');
    if (dateFilter === 'this_month') return d.isSame(now, 'month');
    return true;
  }, [dateFilter]);

  // Filtered lists applying search + statusFilter + typeFilter
  const filteredTasks = useMemo(() => {
    if (typeFilter === 'assigned' || typeFilter === 'scheduled') return [];
    let list = tasks;
    if (statusFilter === 'overdue') list = list.filter(t => getTATStatus(t.deadline) === 'overdue');
    else if (statusFilter === 'at_risk') list = list.filter(t => getTATStatus(t.deadline) === 'at_risk');
    else if (statusFilter === 'on_time') list = list.filter(t => getTATStatus(t.deadline) === 'on_time');
    list = list.filter(t => matchesDateFilter(t.deadline));
    if (search) list = list.filter(t => (t.step_name || '').toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [tasks, statusFilter, typeFilter, search, matchesDateFilter]);

  const filteredDirectorTasks = useMemo(() => {
    if (typeFilter === 'process' || typeFilter === 'scheduled') return [];
    let list = directorTasks;
    if (statusFilter === 'overdue') list = list.filter(t => isTaskOverdue(t));
    else if (statusFilter === 'at_risk' || statusFilter === 'on_time') list = [];
    list = list.filter(t => matchesDateFilter(t.end_date));
    if (search) list = list.filter(t => (t.task_name || '').toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [directorTasks, statusFilter, typeFilter, search, matchesDateFilter]);

  const filteredScheduledTasks = useMemo(() => {
    if (typeFilter === 'process' || typeFilter === 'assigned') return [];
    let list = scheduledTasks;
    if (statusFilter === 'overdue') list = list.filter(t => t.due_at && new Date(t.due_at) < new Date());
    else if (statusFilter === 'at_risk' || statusFilter === 'on_time') list = [];
    list = list.filter(t => matchesDateFilter(t.due_at));
    if (search) list = list.filter(t => (t.task_name || '').toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [scheduledTasks, statusFilter, typeFilter, search, matchesDateFilter]);

  const hasAnyResults = filteredTasks.length > 0 || filteredDirectorTasks.length > 0 || filteredScheduledTasks.length > 0;

  const clearFilters = () => { setSearch(''); setStatusFilter(null); setTypeFilter('all'); setDateFilter('all'); };

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
            <div className="grid grid-cols-4 gap-2">
              {[
                { key: null, label: 'Total', count: totalPending, active: 'bg-slate-900 text-white border-slate-900', inactive: 'bg-white border-slate-200 hover:border-slate-300', numActive: 'text-white', numInactive: 'text-slate-800', labelActive: 'text-slate-300', labelInactive: 'text-slate-500', onClick: () => setStatusFilter(null) },
                { key: 'overdue', label: 'Overdue', count: overdue.length + dtOverdue.length, active: 'bg-red-600 text-white border-red-600', inactive: 'bg-red-50 border-red-100 hover:border-red-300', numActive: 'text-white', numInactive: 'text-red-600', labelActive: 'text-red-100', labelInactive: 'text-red-400', onClick: () => setStatusFilter(p => p === 'overdue' ? null : 'overdue') },
                { key: 'at_risk', label: 'At Risk', count: atRisk.length, active: 'bg-amber-500 text-white border-amber-500', inactive: 'bg-amber-50 border-amber-100 hover:border-amber-300', numActive: 'text-white', numInactive: 'text-amber-600', labelActive: 'text-amber-100', labelInactive: 'text-amber-500', onClick: () => setStatusFilter(p => p === 'at_risk' ? null : 'at_risk') },
                { key: 'on_time', label: 'On Time', count: onTime.length, active: 'bg-emerald-600 text-white border-emerald-600', inactive: 'bg-emerald-50 border-emerald-100 hover:border-emerald-300', numActive: 'text-white', numInactive: 'text-emerald-600', labelActive: 'text-emerald-100', labelInactive: 'text-emerald-500', onClick: () => setStatusFilter(p => p === 'on_time' ? null : 'on_time') },
              ].map(card => {
                const isActive = statusFilter === card.key;
                return (
                  <button key={String(card.key)} onClick={card.onClick}
                    className={`rounded-2xl p-3 text-center border transition-all shadow-sm ${isActive ? card.active : card.inactive}`}>
                    <p className={`text-2xl font-bold leading-none ${isActive ? card.numActive : card.numInactive}`}>{card.count}</p>
                    <p className={`text-xs font-medium mt-1.5 leading-tight ${isActive ? card.labelActive : card.labelInactive}`}>{card.label}</p>
                  </button>
                );
              })}
            </div>

            {/* Filters panel */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search tasks…"
                  className="pl-9 h-11 text-sm bg-slate-50 border-slate-200 rounded-xl"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Type filter */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3 h-3" /> Type
                </p>
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
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all min-h-[36px] ${typeFilter === opt.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-white'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date filter */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> Due Date
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'today', label: 'Today' },
                    { key: 'tomorrow', label: 'Tomorrow' },
                    { key: 'this_week', label: 'This Week' },
                    { key: 'next_week', label: 'Next Week' },
                    { key: 'this_month', label: 'This Month' },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setDateFilter(opt.key)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all min-h-[36px] ${dateFilter === opt.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-white'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clear all */}
              {(statusFilter || search || typeFilter !== 'all' || dateFilter !== 'all') && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <span className="text-xs text-slate-500">Filters active</span>
                  <button onClick={clearFilters} className="text-xs text-indigo-600 hover:underline font-semibold">Clear all</button>
                </div>
              )}
            </div>

            {/* No results after filter */}
            {!hasAnyResults && (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
                <p className="text-slate-500 font-semibold">No tasks match your filters</p>
                <button onClick={clearFilters} className="text-blue-600 text-sm mt-2 hover:underline">Clear filters</button>
              </div>
            )}

            {/* Process Step sections */}
            {[
              { status: 'overdue', label: 'Overdue', dot: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
              { status: 'at_risk', label: 'Due Soon', dot: 'bg-amber-400', text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
              { status: 'on_time', label: 'On Track', dot: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            ].map(({ status, label, dot, text, bg, border }) => {
              const group = filteredTasks.filter(t => getTATStatus(t.deadline) === status);
              if (!group.length) return null;
              return (
                <div key={status}>
                  <div className={`flex items-center gap-2 mb-2.5 px-3 py-1.5 rounded-xl ${bg} border ${border} w-fit`}>
                    <span className={`w-2 h-2 rounded-full ${dot}`} />
                    <h2 className={`text-xs font-bold uppercase tracking-wider ${text}`}>{label} · {group.length}</h2>
                  </div>
                  <div className="space-y-3">
                    {group.map(t => <TaskCard key={t.id} step={t} onComplete={handleMarkDone} onOpenChecklist={handleOpenChecklist} completing={completing} />)}
                  </div>
                </div>
              );
            })}

            {/* Director Assigned Tasks Section */}
            {filteredDirectorTasks.length > 0 && (
              <div>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2.5">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 w-fit">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-600">Assigned Tasks · {filteredDirectorTasks.length}</h2>
                  </div>
                  <TaskLanguageToggle
                    language={taskLang}
                    onLanguageChange={setTaskLang}
                    tasks={filteredDirectorTasks}
                    onTranslationsReady={setTaskTranslations}
                  />
                </div>
                <div className="space-y-3">
                  {filteredDirectorTasks.map(t => {
                    const translated = taskLang !== 'english' && taskTranslations[t.id]
                      ? { ...t, task_name: taskTranslations[t.id].task_name || t.task_name, task_details: taskTranslations[t.id].task_details || t.task_details }
                      : t;
                    return <DirectorTaskCard key={t.id} task={translated} user={user} viewMode="assignee" onRefresh={load} />;
                  })}
                </div>
              </div>
            )}

            {/* Scheduled Tasks Section */}
            {filteredScheduledTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-100 w-fit">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600">Scheduled Tasks · {filteredScheduledTasks.length}</h2>
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