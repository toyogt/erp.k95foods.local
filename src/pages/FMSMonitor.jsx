import { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import InstanceDetail from '@/components/fms/InstanceDetail';
import TATBadge from '@/components/fms/TATBadge';
import ScheduledTasksMonitorTab from '@/components/fms/ScheduledTasksMonitorTab';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, Loader2, MonitorDot, AlertCircle, Clock, CheckCircle2, RefreshCw } from 'lucide-react';
import { getTATStatus, formatDateTime } from '@/lib/fmsHelpers';

export default function FMSMonitor() {
  const [search, setSearch] = useState('');
  const [filterProcess, setFilterProcess] = useState('all');
  const [filterTAT, setFilterTAT] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');

  const [detailId, setDetailId] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['current-user-monitor'],
    queryFn: () => base44.auth.me(),
    staleTime: 300000,
  });

  const { data: processes = [] } = useQuery({
    queryKey: ['fms-processes-monitor'],
    queryFn: () => base44.entities.FMSProcess.list(),
    staleTime: 60000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['all-users-monitor'],
    queryFn: () => base44.entities.User.list(),
    staleTime: 120000,
  });

  const { data: instances = [], isLoading: instancesLoading, refetch: refetchInstances } = useQuery({
    queryKey: ['fms-instances-active'],
    queryFn: () => base44.entities.FMSProcessInstance.filter({ status: 'active' }, '-triggered_at', 300),
    staleTime: 30000,
  });

  const { data: activeStepsRaw = [], isLoading: stepsLoading, refetch: refetchSteps } = useQuery({
    queryKey: ['fms-active-steps-monitor'],
    queryFn: () => base44.entities.FMSStepInstance.filter({ status: 'active' }, '-activated_at', 500),
    staleTime: 30000,
  });

  // Scheduled tasks for coordinator view
  const { data: scheduledTasks = [], refetch: refetchTasks } = useQuery({
    queryKey: ['scheduled-tasks-monitor'],
    queryFn: () => base44.entities.ScheduledTaskInstance.list('-created_date', 200),
    staleTime: 30000,
  });

  const { data: taskGroups = [] } = useQuery({
    queryKey: ['task-groups-monitor'],
    queryFn: () => base44.entities.ScheduledTaskGroup.list(),
    staleTime: 120000,
  });

  const loading = instancesLoading || stepsLoading;

  // Build step map: instance_id -> active step
  const activeSteps = {};
  activeStepsRaw.forEach(step => {
    if (!activeSteps[step.instance_id]) activeSteps[step.instance_id] = step;
  });

  // Build coordinator map: process_id -> coordinator_email
  const coordinatorMap = {};
  processes.forEach(p => {
    if (p.coordinator_email) coordinatorMap[p.id] = p.coordinator_email;
  });



  const isAdmin = user?.role === 'admin';
  const myEmail = user?.email;

  // Coordinator filter: if not admin, only show processes where user is coordinator
  let visibleInstances = instances;
  if (!isAdmin && myEmail) {
    const myProcessIds = processes.filter(p => p.coordinator_email === myEmail).map(p => p.id);
    visibleInstances = instances.filter(inst => myProcessIds.includes(inst.process_id));
  }

  // Get unique assignees for filter dropdown
  const assigneeMap = {};
  activeStepsRaw.forEach(step => {
    if (step.assignee_email) {
      assigneeMap[step.assignee_email] = step.assignee_name || step.assignee_email;
    }
  });
  const assigneeOptions = Object.entries(assigneeMap).map(([email, name]) => ({ email, name }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // Apply filters
  const filtered = visibleInstances.filter(inst => {
    const step = activeSteps[inst.id];
    if (filterProcess !== 'all' && inst.process_id !== filterProcess) return false;

    if (filterAssignee !== 'all') {
      if (!step || step.assignee_email !== filterAssignee) return false;
    }

    if (filterTAT !== 'all') {
      if (!step) return filterTAT === 'unknown';
      if (getTATStatus(step.deadline) !== filterTAT) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!inst.title?.toLowerCase().includes(q) &&
          !inst.process_name?.toLowerCase().includes(q) &&
          !step?.assignee_name?.toLowerCase().includes(q) &&
          !step?.assignee_email?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Sort by TAT status
  const sortOrder = { overdue: 0, at_risk: 1, on_time: 2, unknown: 3 };
  filtered.sort((a, b) => {
    const sa = getTATStatus(activeSteps[a.id]?.deadline);
    const sb = getTATStatus(activeSteps[b.id]?.deadline);
    return (sortOrder[sa] ?? 3) - (sortOrder[sb] ?? 3);
  });

  // Compute stats from filtered
  let overdue = 0, at_risk = 0, on_time = 0;
  filtered.forEach(inst => {
    const step = activeSteps[inst.id];
    if (!step) return;
    const s = getTATStatus(step.deadline);
    if (s === 'overdue') overdue++;
    else if (s === 'at_risk') at_risk++;
    else on_time++;
  });

  const rowColor = (inst) => {
    const step = activeSteps[inst.id];
    if (!step) return '';
    const s = getTATStatus(step.deadline);
    if (s === 'overdue') return 'border-l-4 border-l-red-500';
    if (s === 'at_risk') return 'border-l-4 border-l-yellow-400';
    return 'border-l-4 border-l-green-400';
  };

  const handleRefresh = () => {
    refetchInstances();
    refetchSteps();
    refetchTasks();
  };

  return (
    <>
    <div className="p-3 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Process Monitor</h1>
            <p className="text-slate-500 text-sm mt-1">
              {isAdmin
                ? 'Real-time view of all active process instances and scheduled tasks'
                : `Monitoring processes assigned to you as coordinator`}
            </p>
          </div>
          <Button variant="outline" className="h-11 md:h-9 gap-1.5" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
            <p className="text-3xl font-bold text-slate-700">{filtered.length}</p>
            <p className="text-xs text-slate-400 font-medium mt-1">Total Active</p>
          </div>
          <div className="bg-red-50 rounded-xl border border-red-100 p-4 text-center shadow-sm">
            <p className="text-3xl font-bold text-red-600">{overdue}</p>
            <p className="text-xs text-red-400 font-medium mt-1">Overdue</p>
          </div>
          <div className="bg-yellow-50 rounded-xl border border-yellow-100 p-4 text-center shadow-sm">
            <p className="text-3xl font-bold text-yellow-600">{at_risk}</p>
            <p className="text-xs text-yellow-400 font-medium mt-1">At Risk</p>
          </div>
          <div className="bg-green-50 rounded-xl border border-green-100 p-4 text-center shadow-sm">
            <p className="text-3xl font-bold text-green-600">{on_time}</p>
            <p className="text-xs text-green-400 font-medium mt-1">On Time</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, assignee…" className="pl-9 h-11 md:h-9" />
          </div>
          <Select value={filterProcess} onValueChange={setFilterProcess}>
            <SelectTrigger className="w-48 h-11 md:h-9">
              <SelectValue placeholder="All Processes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Processes</SelectItem>
              {processes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="w-48 h-11 md:h-9">
              <SelectValue placeholder="All Assignees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignees</SelectItem>
              {assigneeOptions.map(a => <SelectItem key={a.email} value={a.email}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterTAT} onValueChange={setFilterTAT}>
            <SelectTrigger className="w-36 h-11 md:h-9">
              <SelectValue placeholder="All TAT" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="at_risk">At Risk</SelectItem>
              <SelectItem value="on_time">On Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Scheduled Tasks + Process Instances — unified table */}

        {/* Process Instances Table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <MonitorDot className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No active process instances</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[2fr_1.5fr_1.5fr_1fr_1fr] gap-4 px-4 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Instance</span>
              <span>Current Step</span>
              <span>Assignee</span>
              <span>Deadline</span>
              <span>Started</span>
            </div>
            <div className="divide-y divide-slate-100">
              {/* Scheduled Tasks — same row format */}
              <ScheduledTasksMonitorTab
                instances={scheduledTasks}
                groups={taskGroups}
                user={user}
                onRefresh={refetchTasks}
                search={search}
              />
              {/* Process Instances */}
              {filtered.map(inst => {
                const step = activeSteps[inst.id];
                return (
                  <div
                    key={inst.id}
                    className={`grid grid-cols-1 sm:grid-cols-[2fr_1.5fr_1.5fr_1fr_1fr] gap-2 sm:gap-4 px-4 py-3.5 cursor-pointer hover:bg-slate-50 transition-colors ${rowColor(inst)}`}
                    onClick={() => setDetailId(inst.id)}
                  >
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{inst.title || inst.process_name}</p>
                      <p className="text-xs text-slate-400">{inst.process_name} · Step {inst.current_step_order}/{inst.total_steps}</p>
                    </div>
                    <div className="flex items-center">
                      <p className="text-sm text-slate-600">{step?.step_name || '—'}</p>
                    </div>
                    <div className="flex items-center">
                      <p className="text-sm text-slate-600">{step?.assignee_name || step?.assignee_email || '—'}</p>
                    </div>
                    <div className="flex items-center">
                      {step ? <TATBadge deadline={step.deadline} /> : <span className="text-slate-300 text-xs">—</span>}
                    </div>
                    <div className="flex items-center">
                      <p className="text-xs text-slate-400">{formatDateTime(inst.triggered_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {detailId && (
        <InstanceDetail
          instanceId={detailId}
          user={user}
          users={users}
          onClose={() => setDetailId(null)}
          onUpdated={handleRefresh}
        />
      )}
    </>
  );
}