import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PLAN_STATUSES, canManagePlans, generateJobId } from '@/lib/labellingHelpers';
import { logLabellingEvent } from '@/lib/labellingEventLogger';
import { toast } from '@/components/ui/use-toast';
import LblJobCard from '@/components/labelling/LblJobCard';
import LblDraggableJobCards from '@/components/labelling/LblDraggableJobCards';
import LblJobEditModal from '@/components/labelling/LblJobEditModal';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { SHIFT_TYPES } from '@/lib/labellingHelpers';
import { ArrowLeft, Lock, Unlock, Loader2, Save, Trash2, Plus, Pencil } from 'lucide-react';
import moment from 'moment';

export default function LblPlanDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const planId = new URLSearchParams(window.location.search).get('planId');
  const [user, setUser] = useState(null);
  const [acting, setActing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reorderedJobs, setReorderedJobs] = useState(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [addingJob, setAddingJob] = useState(false);
  const [editingHeader, setEditingHeader] = useState(false);
  const [headerForm, setHeaderForm] = useState({});
  const [savingHeader, setSavingHeader] = useState(false);

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const { data: plan, isLoading: planLoading } = useQuery({
    queryKey: ['labelling-plan', planId],
    queryFn: async () => { const p = await base44.entities.LabellingShiftPlan.filter({ id: planId }); return p[0] || null; },
    enabled: !!planId,
  });
  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['labelling-jobs', planId],
    queryFn: () => base44.entities.LabellingJob.filter({ plan_id: planId }),
    enabled: !!planId,
  });
  const { data: machines = [] } = useQuery({
    queryKey: ['labelling-machines'],
    queryFn: () => base44.entities.Machine.filter({ machine_type: 'LABEL-LINE', is_active: true }),
  });
  const { data: products = [] } = useQuery({
    queryKey: ['product-master-list'],
    queryFn: () => base44.entities.ProductMaster.list('-created_date', 500),
  });

  const sortedJobs = reorderedJobs || [...jobs].sort((a, b) => a.priority_order - b.priority_order);
  const isManager = canManagePlans(user?.role);
  const isDraft = plan?.status === 'draft';
  const canReorder = isManager && isDraft;
  const hasOrderChanged = reorderedJobs !== null;

  useEffect(() => { setReorderedJobs(null); }, [jobs]);

  useEffect(() => {
    if (plan) {
      setHeaderForm({
        plan_date: plan.plan_date ? moment(plan.plan_date, 'DD/MM/YYYY').format('YYYY-MM-DD') : '',
        shift_type: plan.shift_type || 'day',
        line_id: plan.line_id || '',
        notes: plan.notes || '',
      });
    }
  }, [plan]);

  const handleSaveHeader = async () => {
    setSavingHeader(true);
    const fd = moment(headerForm.plan_date).format('DD/MM/YYYY');
    const selectedMachine = machines.find(m => m.id === headerForm.line_id);
    await base44.entities.LabellingShiftPlan.update(plan.id, {
      plan_date: fd,
      shift_type: headerForm.shift_type,
      line_id: headerForm.line_id,
      line_name: selectedMachine?.display_name || headerForm.line_id,
      notes: headerForm.notes,
    });
    await logLabellingEvent({ action_type: 'plan_updated', plan_id: plan.id, description: `Plan ${plan.plan_id} header updated`, user });
    queryClient.invalidateQueries({ queryKey: ['labelling-plan', planId] });
    toast({ title: 'Plan Updated' });
    setEditingHeader(false);
    setSavingHeader(false);
  };

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

  const handleDeletePlan = async () => {
    if (!plan) return;
    setDeleting(true);
    for (const j of jobs) {
      await base44.entities.LabellingJob.delete(j.id);
    }
    await base44.entities.LabellingShiftPlan.delete(plan.id);
    await logLabellingEvent({ action_type: 'plan_cancelled', plan_id: plan.id, description: `Plan ${plan.plan_id} deleted`, user });
    queryClient.invalidateQueries({ queryKey: ['labelling-plans'] });
    toast({ title: 'Plan Deleted', description: `${plan.plan_id} and its ${jobs.length} job(s) have been deleted` });
    navigate('/LblPlanningDashboard');
  };

  const handleAddJob = async (form) => {
    const nextPriority = sortedJobs.length + 1;
    const mfgFormatted = form.manufacturing_date ? moment(form.manufacturing_date).format('DD/MM/YYYY') : plan.plan_date;
    const newJob = {
      job_id: generateJobId(),
      plan_id: plan.id,
      sku_code: form.sku_code,
      product_name: form.product_name,
      bottle_type: form.bottle_type,
      mrp: String(form.mrp || ''),
      manufacturing_date: mfgFormatted,
      batch_no: form.batch_no || '',
      quantity_bottles_planned: form.quantity_bottles_planned,
      quantity_cases_planned: form.quantity_cases_planned,
      priority_order: nextPriority,
      line_id: plan.line_id,
      line_name: plan.line_name,
      shift_type: plan.shift_type,
      plan_date: plan.plan_date,
      status: 'pending',
    };
    await base44.entities.LabellingJob.create(newJob);
    await base44.entities.LabellingShiftPlan.update(plan.id, { total_jobs: nextPriority });
    await logLabellingEvent({ action_type: 'job_added', plan_id: plan.id, description: `Product ${form.product_name} added to plan ${plan.plan_id}`, user });
    queryClient.invalidateQueries({ queryKey: ['labelling-jobs', planId] });
    toast({ title: 'Product Added', description: `${form.product_name} added to plan` });
  };

  const handleEditJob = async (form) => {
    if (!editingJob) return;
    const mfgFormatted = form.manufacturing_date ? moment(form.manufacturing_date).format('DD/MM/YYYY') : editingJob.manufacturing_date;
    await base44.entities.LabellingJob.update(editingJob.id, {
      sku_code: form.sku_code,
      product_name: form.product_name,
      bottle_type: form.bottle_type,
      mrp: String(form.mrp || ''),
      manufacturing_date: mfgFormatted,
      batch_no: form.batch_no || '',
      quantity_bottles_planned: form.quantity_bottles_planned,
      quantity_cases_planned: form.quantity_cases_planned,
    });
    await logLabellingEvent({ action_type: 'job_updated', plan_id: plan.id, description: `Job ${editingJob.job_id} updated`, user });
    queryClient.invalidateQueries({ queryKey: ['labelling-jobs', planId] });
    toast({ title: 'Job Updated' });
  };

  const handleRemoveJob = async (job) => {
    await base44.entities.LabellingJob.delete(job.id);
    const remaining = sortedJobs.filter(j => j.id !== job.id);
    for (let i = 0; i < remaining.length; i++) {
      await base44.entities.LabellingJob.update(remaining[i].id, { priority_order: i + 1 });
    }
    await base44.entities.LabellingShiftPlan.update(plan.id, { total_jobs: remaining.length });
    await logLabellingEvent({ action_type: 'job_removed', plan_id: plan.id, description: `Job ${job.job_id} removed from plan ${plan.plan_id}`, user });
    queryClient.invalidateQueries({ queryKey: ['labelling-jobs', planId] });
    toast({ title: 'Product Removed', description: `${job.product_name} removed from plan` });
  };

  const handleUnlockPlan = async () => {
    setActing(true);
    await base44.entities.LabellingShiftPlan.update(plan.id, { status: 'draft' });
    await logLabellingEvent({ action_type: 'plan_unlocked', plan_id: plan.id, description: `Plan ${plan.plan_id} unlocked for editing`, user });
    queryClient.invalidateQueries({ queryKey: ['labelling-plan', planId] });
    toast({ title: 'Plan Unlocked', description: 'Plan reverted to draft for editing' });
    setActing(false);
  };

  const handleLockPlan = async () => {
    const priorities = sortedJobs.map(j => j.priority_order);
    const uniquePriorities = new Set(priorities);
    if (uniquePriorities.size !== sortedJobs.length) {
      toast({ title: 'Priority Conflict', description: 'Two or more jobs share the same priority number. Fix before locking.', variant: 'destructive' });
      return;
    }
    const sorted = [...priorities].sort((a, b) => a - b);
    const isSequential = sorted.every((p, i) => p === i + 1);
    if (!isSequential) {
      toast({ title: 'Priority Gap', description: 'Priority numbers must be sequential starting from 1. Save the correct order first.', variant: 'destructive' });
      return;
    }
    if (hasOrderChanged) {
      toast({ title: 'Unsaved Changes', description: 'Save the priority order before locking the plan.', variant: 'destructive' });
      return;
    }
    if (sortedJobs.length === 0) {
      toast({ title: 'No Jobs', description: 'Cannot lock a plan with no jobs.', variant: 'destructive' });
      return;
    }
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
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900">{plan.plan_id}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
          </div>
          <p className="text-sm text-slate-500">{plan.plan_date} · {plan.shift_type} Shift · {plan.line_name || plan.line_id}</p>
          {plan.supervisor_name && <p className="text-xs text-slate-400">Supervisor: {plan.supervisor_name}</p>}
        </div>

        {/* Draft actions */}
        {isManager && isDraft && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" className="h-11 md:h-9 gap-2" onClick={() => setAddingJob(true)}>
              <Plus className="w-4 h-4" /> Add Product
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="h-11 md:h-9 gap-2 text-red-600 border-red-200 hover:bg-red-50" disabled={deleting}>
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Plan {plan.plan_id}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this plan and all {jobs.length} associated job(s). This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="h-11 md:h-9">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeletePlan} className="h-11 md:h-9 bg-red-600 hover:bg-red-700">Delete Plan</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button className="h-11 md:h-9 gap-2" onClick={handleLockPlan} disabled={acting}>
              {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Lock Plan
            </Button>
          </div>
        )}

        {/* Locked — unlock button */}
        {isManager && plan.status === 'locked' && (
          <Button variant="outline" className="h-11 md:h-9 gap-2 text-amber-600 border-amber-200 hover:bg-amber-50" onClick={handleUnlockPlan} disabled={acting}>
            {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
            Unlock to Edit
          </Button>
        )}
      </div>

      {/* Plan Header — editable in draft mode */}
      {isDraft && editingHeader ? (
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Plan Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Plan Date</Label>
              <Input type="date" value={headerForm.plan_date} onChange={e => setHeaderForm(f => ({ ...f, plan_date: e.target.value }))} className="h-11 md:h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Shift</Label>
              <Select value={headerForm.shift_type} onValueChange={v => setHeaderForm(f => ({ ...f, shift_type: v }))}>
                <SelectTrigger className="h-11 md:h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{SHIFT_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Labelling Line</Label>
              <Select value={headerForm.line_id} onValueChange={v => setHeaderForm(f => ({ ...f, line_id: v }))}>
                <SelectTrigger className="h-11 md:h-9"><SelectValue placeholder="Select line" /></SelectTrigger>
                <SelectContent>{machines.map(m => <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700">Notes</Label>
            <Textarea value={headerForm.notes} onChange={e => setHeaderForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional plan notes..." className="min-h-[60px]" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-9" onClick={() => setEditingHeader(false)}>Cancel</Button>
            <Button className="h-9 gap-2" onClick={handleSaveHeader} disabled={savingHeader}>
              {savingHeader ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Details
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-900">Plan Details</h2>
            {isDraft && isManager && (
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setEditingHeader(true)}>
                <Pencil className="w-3 h-3" /> Edit Details
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><p className="text-xs text-slate-500">Date</p><p className="font-medium text-slate-900">{plan.plan_date}</p></div>
            <div><p className="text-xs text-slate-500">Shift</p><p className="font-medium text-slate-900 capitalize">{plan.shift_type} Shift</p></div>
            <div><p className="text-xs text-slate-500">Line</p><p className="font-medium text-slate-900">{plan.line_name || plan.line_id}</p></div>
            {plan.supervisor_name && <div><p className="text-xs text-slate-500">Supervisor</p><p className="font-medium text-slate-900">{plan.supervisor_name}</p></div>}
          </div>
          {plan.notes && <p className="mt-2 text-sm text-amber-700 bg-amber-50 rounded p-2">{plan.notes}</p>}
        </div>
      )}

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

        {sortedJobs.length === 0 ? (
          <div className="text-center py-8 text-slate-400">No products added yet</div>
        ) : canReorder ? (
          <div className="space-y-1">
            {sortedJobs.map((job, idx) => (
              <div key={job.id} className="space-y-1">
                <LblDraggableJobCards
                  jobs={[job]}
                  planLocked={false}
                  onReorder={(from, to) => handleReorder(idx + from, idx + to)}
                />
                <div className="flex gap-2 px-1 pb-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs"
                    onClick={() => setEditingJob({ ...job, manufacturing_date: job.manufacturing_date ? moment(job.manufacturing_date, 'DD/MM/YYYY').format('YYYY-MM-DD') : '' })}
                  >
                    <Pencil className="w-3 h-3" /> Edit Job #{job.priority_order}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className="h-8 gap-1 text-xs text-red-600 border-red-200 hover:bg-red-50">
                        <Trash2 className="w-3 h-3" /> Remove
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove {job.product_name}?</AlertDialogTitle>
                        <AlertDialogDescription>This product will be removed from the plan. Remaining jobs will be resequenced.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="h-11 md:h-9">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleRemoveJob(job)} className="h-11 md:h-9 bg-red-600 hover:bg-red-700">Remove Product</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
            {/* Full list drag support */}
            {sortedJobs.length > 1 && (
              <div className="mt-2">
                <LblDraggableJobCards jobs={sortedJobs} planLocked={false} onReorder={handleReorder} />
              </div>
            )}
          </div>
        ) : (
          sortedJobs.map((job, idx) => (
            <LblJobCard key={job.id} job={job} isFirst={idx === sortedJobs.findIndex(j => j.status === 'pending')} planLocked={plan.status !== 'draft'} />
          ))
        )}
      </div>

      {/* Add Product Modal */}
      <LblJobEditModal
        open={addingJob}
        onClose={() => setAddingJob(false)}
        job={null}
        products={products}
        planDate={plan?.plan_date}
        onSave={handleAddJob}
        mode="add"
      />

      {/* Edit Job Modal */}
      {editingJob && (
        <LblJobEditModal
          open={!!editingJob}
          onClose={() => setEditingJob(null)}
          job={editingJob}
          products={products}
          planDate={plan?.plan_date}
          onSave={handleEditJob}
          mode="edit"
        />
      )}
    </div>
  );
}