import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { differenceInHours, isPast } from 'date-fns';

export default function FMSHealthDashboard() {
  const [user, setUser] = useState(null);
  const [instances, setInstances] = useState([]);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.auth.me(),
      base44.entities.FMSProcessInstance.filter({ status: 'active' }, '-triggered_at', 100),
      base44.entities.FMSStepInstance.filter({ status: ['active', 'pending'] }, '-activated_at', 200),
    ]).then(([me, instData, stepData]) => {
      setUser(me);
      setInstances(instData);
      setSteps(stepData);
      setLoading(false);
    });
  }, []);

  if (!loading && user?.role !== 'admin') {
    return <div className="flex items-center justify-center h-64 text-slate-400">Admin access required.</div>;
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const overdue = steps.filter(s => s.deadline && isPast(new Date(s.deadline)));
  const atRisk = steps.filter(s => s.deadline && differenceInHours(new Date(s.deadline), new Date()) < 4 && !isPast(new Date(s.deadline)));
  const escalated = steps.filter(s => s.status === 'escalated');
  const completed = steps.filter(s => s.status === 'completed').length;

  const bottlenecksByAssignee = steps.reduce((acc, s) => {
    const key = s.assignee_email || 'Unassigned';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const topBottlenecks = Object.entries(bottlenecksByAssignee)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-2">
        <Activity className="w-6 h-6 text-slate-700" />
        <h1 className="text-2xl font-bold text-slate-900">Process Health Dashboard</h1>
      </div>
      <p className="text-slate-600">Monitor active processes and identify bottlenecks</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-semibold mb-2">ACTIVE PROCESSES</p>
          <p className="text-3xl font-bold text-slate-900">{instances.length}</p>
          <p className="text-xs text-slate-500 mt-1">{instances.length} in progress</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 border-red-200">
          <p className="text-xs text-red-600 font-semibold mb-2">OVERDUE STEPS</p>
          <p className="text-3xl font-bold text-red-600">{overdue.length}</p>
          <p className="text-xs text-red-500 mt-1">Need immediate action</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 border-amber-200">
          <p className="text-xs text-amber-600 font-semibold mb-2">AT RISK (4H)</p>
          <p className="text-3xl font-bold text-amber-600">{atRisk.length}</p>
          <p className="text-xs text-amber-500 mt-1">Close to deadline</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 border-purple-200">
          <p className="text-xs text-purple-600 font-semibold mb-2">ESCALATED</p>
          <p className="text-3xl font-bold text-purple-600">{escalated.length}</p>
          <p className="text-xs text-purple-500 mt-1">Reassigned steps</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            Overdue Steps
          </h3>
          {overdue.length === 0 ? (
            <p className="text-sm text-slate-500">No overdue steps</p>
          ) : (
            <div className="space-y-2">
              {overdue.slice(0, 5).map(s => (
                <div key={s.id} className="text-sm p-2 rounded bg-red-50 border border-red-100">
                  <p className="font-medium text-slate-900">{s.step_name}</p>
                  <p className="text-xs text-slate-600">{s.assignee_name || s.assignee_email}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-slate-600" />
            Top Bottlenecks
          </h3>
          <div className="space-y-2">
            {topBottlenecks.map(([assignee, count]) => (
              <div key={assignee} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 truncate">{assignee === 'Unassigned' ? '—' : assignee}</span>
                <span className="font-semibold text-slate-900">{count} steps</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}