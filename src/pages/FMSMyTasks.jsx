import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import FMSLayout from '@/components/fms/FMSLayout';
import TATBadge from '@/components/fms/TATBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, ClipboardList } from 'lucide-react';
import { formatDateTime, getTATStatus } from '@/lib/fmsHelpers';

function TaskCard({ step, onComplete, completing }) {
  const [expanded, setExpanded] = useState(false);
  const tatStatus = getTATStatus(step.deadline);

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
              <Button
                size="sm"
                onClick={() => onComplete(step)}
                disabled={completing === step.id}
                className="gap-1.5 min-h-[44px] min-w-[120px] bg-green-600 hover:bg-green-700"
              >
                {completing === step.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Mark Done
              </Button>
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

export default function FMSMyTasks() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(null);
  const [filter, setFilter] = useState('active'); // active | all

  const load = useCallback(async () => {
    const me = await base44.auth.me();
    setUser(me);

    const query = { assignee_email: me.email, status: 'active' };
    const allSteps = await base44.entities.FMSStepInstance.filter(query, '-deadline', 100);

    // Load instance names
    const instanceIds = [...new Set(allSteps.map(s => s.instance_id))];
    const instances = await Promise.all(instanceIds.map(id => base44.entities.FMSProcessInstance.filter({ id })));
    const instanceMap = {};
    instances.flat().forEach(inst => { instanceMap[inst.id] = inst; });

    const enriched = allSteps.map(s => ({
      ...s,
      _process_name: instanceMap[s.instance_id]?.process_name || s.process_id,
      _instance_title: instanceMap[s.instance_id]?.title || '',
    }));

    // Sort: overdue first, then at_risk, then on_time
    enriched.sort((a, b) => {
      const priority = { overdue: 0, at_risk: 1, on_time: 2, unknown: 3 };
      const pa = priority[getTATStatus(a.deadline)] ?? 3;
      const pb = priority[getTATStatus(b.deadline)] ?? 3;
      if (pa !== pb) return pa - pb;
      return new Date(a.deadline || 0) - new Date(b.deadline || 0);
    });

    setTasks(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const completeTask = async (step) => {
    const note = window.prompt(`Completion note for "${step.step_name}" (optional):`);
    if (note === null) return; // cancelled
    setCompleting(step.id);
    await base44.functions.invoke('fmsTriggerProcess', {
      action: 'complete_step',
      step_instance_id: step.id,
      completion_note: note || '',
    });
    setCompleting(null);
    load();
  };

  const overdue = tasks.filter(t => getTATStatus(t.deadline) === 'overdue');
  const atRisk = tasks.filter(t => getTATStatus(t.deadline) === 'at_risk');
  const onTime = tasks.filter(t => getTATStatus(t.deadline) === 'on_time');

  return (
    <FMSLayout user={user}>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">My Tasks</h1>
          <p className="text-slate-500 text-sm mt-1">Your pending assignments across all processes</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-20">
            <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No pending tasks</p>
            <p className="text-slate-300 text-sm mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{overdue.length}</p>
                <p className="text-xs text-red-400 font-medium mt-0.5">Overdue</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-yellow-600">{atRisk.length}</p>
                <p className="text-xs text-yellow-400 font-medium mt-0.5">At Risk</p>
              </div>
              <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{onTime.length}</p>
                <p className="text-xs text-green-400 font-medium mt-0.5">On Time</p>
              </div>
            </div>

            {overdue.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wider mb-3">⚠ Overdue ({overdue.length})</h2>
                <div className="space-y-3">
                  {overdue.map(t => <TaskCard key={t.id} step={t} onComplete={completeTask} completing={completing} />)}
                </div>
              </div>
            )}
            {atRisk.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-yellow-600 uppercase tracking-wider mb-3">⏰ Due Soon ({atRisk.length})</h2>
                <div className="space-y-3">
                  {atRisk.map(t => <TaskCard key={t.id} step={t} onComplete={completeTask} completing={completing} />)}
                </div>
              </div>
            )}
            {onTime.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-green-600 uppercase tracking-wider mb-3">✓ On Track ({onTime.length})</h2>
                <div className="space-y-3">
                  {onTime.map(t => <TaskCard key={t.id} step={t} onComplete={completeTask} completing={completing} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </FMSLayout>
  );
}