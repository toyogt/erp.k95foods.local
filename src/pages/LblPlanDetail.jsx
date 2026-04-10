import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PLAN_STATUSES, canManagePlans } from '@/lib/labellingHelpers';
import { logLabellingEvent } from '@/lib/labellingEventLogger';
import { toast } from '@/components/ui/use-toast';
import LblJobCard from '@/components/labelling/LblJobCard';
import LblDraggableJobCards from '@/components/labelling/LblDraggableJobCards';
import { ArrowLeft, Lock, Loader2, Save } from 'lucide-react';

export default function LblPlanDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const planId = new URLSearchParams(window.location.search).get('planId');
  const [user, setUser] = useState(null);
  const [acting, setActing] = useState(false);

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const { data: plan, isLoading: planLoading } = useQuery({ queryKey: ['labelling-plan', planId], queryFn: async () => { const p = await base44.entities.LabellingShiftPlan.filter({ id: planId }); return p[0] || null; }, enabled: !!planId });
  const { data: jobs = [], isLoading: jobsLoading } = useQuery({ queryKey: ['labelling-jobs', planId], queryFn: () => base44.entities.LabellingJob.filter({ plan_id: planId }), enabled: !!planId });

  const [reorderedJobs, setReorderedJobs] = useState(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const sortedJobs = reorderedJobs || [...jobs].sort((a, b) => a.priority_order - b.priority_order);
  const isManager = canManagePlans(user?.role);
  const isDraft = plan?.status === 'draft';
  const canReorder = isManager && isDraft;
  const hasOrderChanged = reorderedJobs !== null;

  // Reset reordered state when jobs data changes from server
  useEffect(() => { setReorderedJobs(null); }, [jobs]);

  const handleReorder = (fromIdx, toIdx) => {
    const current = [...sortedJobs];
    const [moved] = current.splice(fromIdx, 1);
    current.splice(toIdx, 0, moved);
    setReorderedJobs(current.map((j, i) => ({ ...j, priority_order: i + 1 })));
  };

  const handleSaveOrder = async () => {
    if (!reorderedJobs) return;
    setSavingOrder(true);
    for (const j of reorderedJobs) {
      await base44.entities.LabellingJob.update(j.id, { priority_order: j.priority_order });
    }
    queryClient.invalidateQueries({ queryKey: ['labelling-jobs', planId] });
    setReorderedJobs(null);
    toast({ title: 'Priority Updated', description: 'Job execution order has been saved' });
    setSavingOrder(false);
  };

  const handleLockPlan = async () => {
    if (!plan) return;
    setActing(true);
    await base44.entities.LabellingShiftPlan.update(plan.id, { status: 'locked' });
    await logLabellingEvent({ action_type: 'plan_locked', plan_id: plan.id, description: `Plan ${plan.plan_id} locked`, user });
    queryClient.invalidateQueries({ queryKey: ['labelling-plan', planId] });
    toast({ title: 'Plan Locked' });
    setActing(false);
  };

  if (planLoading || jobsLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!plan) return <div className="p-6 text-center text-slate-500">Plan not found</div>;

  const st = PLAN_STATUSES[plan.status] || PLAN_STATUSES.draft;

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/LblPlanningDashboard')}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap"><h1 className="text-xl font-bold text-slate-900">{plan.plan_id}</h1><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span></div>
          <p className="text-sm text-slate-500">{plan.plan_date} · {plan.shift_type} Shift · {plan.line_name || plan.line_id}</p>
          {plan.supervisor_name && <p className="text-xs text-slate-400">Supervisor: {plan.supervisor_name}</p>}
        </div>
        {isManager && plan.status === 'draft' && <Button className="h-11 md:h-9 gap-2" onClick={handleLockPlan} disabled={acting}>{acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}Lock Plan</Button>}
      </div>
      {plan.notes && <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">{plan.notes}</div>}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Jobs ({sortedJobs.length})</h2>
          {canReorder && hasOrderChanged && (
            <Button size="sm" className="h-9 gap-2" onClick={handleSaveOrder} disabled={savingOrder}>
              {savingOrder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Priority Order
            </Button>
          )}
        </div>
        {canReorder && <p className="text-xs text-slate-500">Drag jobs to change execution priority. Save after reordering.</p>}
        {sortedJobs.length === 0 ? <div className="text-center py-8 text-slate-400">No jobs</div> : (
          canReorder ? (
            <LblDraggableJobCards jobs={sortedJobs} planLocked={plan.status !== 'draft'} onReorder={handleReorder} />
          ) : (
            sortedJobs.map((job, idx) => (
              <LblJobCard key={job.id} job={job} isFirst={idx === sortedJobs.findIndex(j => j.status === 'pending')} planLocked={plan.status !== 'draft'} />
            ))
          )
        )}
      </div>
    </div>
  );
}