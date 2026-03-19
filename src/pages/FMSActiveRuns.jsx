import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import StartInstanceForm from '@/components/fms/StartInstanceForm';
import InstanceDetail from '@/components/fms/InstanceDetail';
import TATBadge from '@/components/fms/TATBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Search, Loader2, PlayCircle, ChevronRight } from 'lucide-react';
import { formatDateTime, getTATStatus } from '@/lib/fmsHelpers';

const STATUS_COLORS = {
  active: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-slate-100 text-slate-500',
  on_hold: 'bg-yellow-100 text-yellow-700',
};

export default function FMSActiveRuns() {
  const [user, setUser] = useState(null);
  const [instances, setInstances] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [activeSteps, setActiveSteps] = useState({});
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterProcess, setFilterProcess] = useState('all');
  const [showStart, setShowStart] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const load = useCallback(async () => {
    const [me, procs, userList] = await Promise.all([
      base44.auth.me(),
      base44.entities.FMSProcess.list('-created_date', 100),
      base44.entities.User.list(),
    ]);
    setUser(me);
    setProcesses(procs);
    setUsers(userList);

    const query = filterStatus === 'all' ? {} : { status: filterStatus };
    const insts = await base44.entities.FMSProcessInstance.list('-triggered_at', 200);
    const filtered = filterStatus === 'all' ? insts : insts.filter(i => i.status === filterStatus);
    setInstances(filtered);

    // Load active steps for all active instances
    const activeInsts = filtered.filter(i => i.status === 'active');
    const stepMap = {};
    await Promise.all(activeInsts.map(async (inst) => {
      const steps = await base44.entities.FMSStepInstance.filter({ instance_id: inst.id, status: 'active' });
      if (steps[0]) stepMap[inst.id] = steps[0];
    }));
    setActiveSteps(stepMap);
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  const filtered = instances.filter(inst => {
    if (filterProcess !== 'all' && inst.process_id !== filterProcess) return false;
    if (search && !inst.title?.toLowerCase().includes(search.toLowerCase()) &&
        !inst.process_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const activeProcesses = processes.filter(p => p.is_active && p.trigger_type === 'manual');

  return (
    <FMSLayout user={user}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Active Runs</h1>
            <p className="text-slate-500 text-sm mt-1">All running process instances</p>
          </div>
          {activeProcesses.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {activeProcesses.map(p => (
                <Button key={p.id} onClick={() => setShowStart(p)} className="gap-2 min-h-[44px]">
                  <Play className="w-4 h-4" /> Start {p.name}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search instances…" className="pl-9" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterProcess} onValueChange={setFilterProcess}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Processes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Processes</SelectItem>
              {processes.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <PlayCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No instances found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(inst => {
              const activeStep = activeSteps[inst.id];
              return (
                <div
                  key={inst.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
                  onClick={() => setDetailId(inst.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[inst.status] || 'bg-slate-100 text-slate-500'}`}>
                          {inst.status}
                        </span>
                        <span className="text-xs text-slate-400">{inst.process_name}</span>
                        {inst.total_steps > 0 && (
                          <span className="text-xs text-slate-400">
                            Step {inst.current_step_order}/{inst.total_steps}
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-slate-800 mt-1">{inst.title || inst.process_name}</p>
                      {activeStep && (
                        <p className="text-sm text-slate-500 mt-0.5">
                          Current: <span className="font-medium">{activeStep.step_name}</span>
                          <span className="text-slate-400"> → {activeStep.assignee_name || activeStep.assignee_email}</span>
                        </p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">Started {formatDateTime(inst.triggered_at)} by {inst.triggered_by}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {activeStep && <TATBadge deadline={activeStep.deadline} />}
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showStart && (
        <StartInstanceForm
          process={showStart}
          onClose={() => setShowStart(null)}
          onStarted={(id) => { setShowStart(null); setDetailId(id); load(); }}
        />
      )}

      {detailId && (
        <InstanceDetail
          instanceId={detailId}
          user={user}
          users={users}
          onClose={() => setDetailId(null)}
          onUpdated={load}
        />
      )}
    </FMSLayout>
  );
}