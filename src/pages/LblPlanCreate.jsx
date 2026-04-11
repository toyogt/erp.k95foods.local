import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SHIFT_TYPES, generatePlanId, generateJobId } from '@/lib/labellingHelpers';
import { logLabellingEvent } from '@/lib/labellingEventLogger';
import LblDraggableJobList from '@/components/labelling/LblDraggableJobList';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, Save, Lock, Plus, Loader2 } from 'lucide-react';
import moment from 'moment';

export default function LblPlanCreate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [planDate, setPlanDate] = useState(moment().format('YYYY-MM-DD'));
  const [shiftType, setShiftType] = useState('day');
  const [lineId, setLineId] = useState('');
  const [notes, setNotes] = useState('');
  const [jobs, setJobs] = useState([]);

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const { data: machines = [] } = useQuery({ queryKey: ['labelling-machines'], queryFn: () => base44.entities.Machine.filter({ machine_type: 'LABEL-LINE', is_active: true }) });
  const { data: products = [] } = useQuery({ queryKey: ['product-master-list'], queryFn: () => base44.entities.ProductMaster.list('-created_date', 500) });

  const selectedMachine = machines.find(m => m.id === lineId);

  const addJob = () => setJobs(prev => [...prev, { _key: Date.now(), sku_code: '', product_name: '', bottle_type: '', mrp: '', manufacturing_date: '', batch_no: '', quantity_bottles_planned: 0, quantity_cases_planned: 0, priority_order: prev.length + 1 }]);
  const updateJob = (idx, field, value) => setJobs(prev => prev.map((j, i) => i === idx ? { ...j, [field]: value } : j));
  const removeJob = (idx) => setJobs(prev => prev.filter((_, i) => i !== idx).map((j, i) => ({ ...j, priority_order: i + 1 })));
  const reorderJobs = (fromIdx, toIdx) => {
    setJobs(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIdx, 1);
      updated.splice(toIdx, 0, moved);
      return updated.map((j, i) => ({ ...j, priority_order: i + 1 }));
    });
  };

  const handleSave = async (lockAfterSave = false) => {
    const fd = moment(planDate).format('DD/MM/YYYY');
    if (!planDate || !shiftType || !lineId) { toast({ title: 'Missing Fields', description: 'Date, shift, and line are required', variant: 'destructive' }); return; }
    if (jobs.length === 0) { toast({ title: 'No Jobs', description: 'Add at least one product job', variant: 'destructive' }); return; }

    // Validate all jobs have a product selected
    const incompleteJobs = jobs.filter(j => !j.sku_code);
    if (incompleteJobs.length > 0) {
      toast({ title: 'Incomplete Jobs', description: `${incompleteJobs.length} job(s) have no product selected. Remove empty rows or select a product.`, variant: 'destructive' });
      return;
    }

    // Validate all jobs have planned bottle quantity > 0
    const zeroQtyJobs = jobs.filter(j => !j.quantity_bottles_planned || j.quantity_bottles_planned <= 0);
    if (zeroQtyJobs.length > 0) {
      toast({ title: 'Missing Quantities', description: `${zeroQtyJobs.length} job(s) have zero planned bottles. Enter a quantity for each product.`, variant: 'destructive' });
      return;
    }

    // Validate priority sequence is continuous (no gaps, no duplicates)
    const priorities = jobs.map(j => j.priority_order);
    const uniquePriorities = new Set(priorities);
    if (uniquePriorities.size !== jobs.length) {
      toast({ title: 'Priority Conflict', description: 'Two or more jobs share the same priority number. Drag to reorder and fix.', variant: 'destructive' });
      return;
    }
    const sorted = [...priorities].sort((a, b) => a - b);
    const isSequential = sorted.every((p, i) => p === i + 1);
    if (!isSequential) {
      toast({ title: 'Priority Gap', description: 'Priority numbers must be sequential starting from 1. Drag to reorder.', variant: 'destructive' });
      return;
    }

    // Validate no duplicate product + batch within the same plan
    const combos = jobs.filter(j => j.batch_no).map(j => `${j.sku_code}::${j.batch_no}`);
    const seen = new Set();
    const internalDupes = [];
    for (const c of combos) {
      if (seen.has(c)) internalDupes.push(c.replace('::', ' / Batch '));
      seen.add(c);
    }
    if (internalDupes.length > 0) {
      toast({ title: 'Duplicate Within Plan', description: `Same product + batch appears more than once in this plan: ${internalDupes.join('; ')}`, variant: 'destructive' });
      return;
    }

    // Check for duplicate plan (same date + shift + line)
    const jobsWithBatch = jobs.filter(j => j.sku_code && j.batch_no);
    if (jobsWithBatch.length > 0) {
      const allDayJobs = await base44.entities.LabellingJob.filter({ plan_date: fd });
      const activeJobs = allDayJobs.filter(j => j.status !== 'cancelled');
      const duplicates = [];
      for (const j of jobsWithBatch) {
        const match = activeJobs.find(ej => ej.sku_code === j.sku_code && ej.batch_no === j.batch_no);
        if (match) duplicates.push(`${j.product_name || j.sku_code} / Batch ${j.batch_no} (already in job ${match.job_id})`);
      }
      if (duplicates.length > 0) {
        toast({ title: 'Duplicate Product + Batch', description: `These product-batch combinations already exist today: ${duplicates.join('; ')}`, variant: 'destructive' });
        return;
      }
    }
    // Block if a plan already exists for same date + shift + line
    const existingPlans = await base44.entities.LabellingShiftPlan.filter({ plan_date: fd, shift_type: shiftType, line_id: lineId });
    const activePlan = existingPlans.find(p => p.status !== 'cancelled');
    if (activePlan) {
      toast({
        title: 'Plan Already Exists',
        description: `A ${shiftType} shift plan for ${fd} on ${selectedMachine?.display_name || lineId} already exists (${activePlan.plan_id}). Please edit that plan to add more products.`,
        variant: 'destructive',
      });
      setSaving(false);
      navigate(`/LblPlanDetail?planId=${activePlan.id}`);
      return;
    }

    setSaving(true);
    const pid = generatePlanId();
    const plan = {
      plan_id: pid,
      plan_date: fd,
      shift_type: shiftType,
      line_id: lineId,
      line_name: selectedMachine?.display_name || lineId,
      notes,
      status: lockAfterSave ? 'locked' : 'draft',
      total_jobs: jobs.length,
    };
    const createdPlan = await base44.entities.LabellingShiftPlan.create(plan);
    const jobRecords = jobs.map((j, i) => {
      const mfgRaw = j.manufacturing_date || planDate;
      const mfgFormatted = mfgRaw ? moment(mfgRaw).format('DD/MM/YYYY') : fd;
      return { job_id: generateJobId(), plan_id: createdPlan.id, sku_code: j.sku_code, product_name: j.product_name, bottle_type: j.bottle_type, mrp: String(j.mrp || ''), manufacturing_date: mfgFormatted, batch_no: j.batch_no || '', quantity_bottles_planned: j.quantity_bottles_planned, quantity_cases_planned: j.quantity_cases_planned, priority_order: i + 1, line_id: lineId, line_name: selectedMachine?.display_name || lineId, shift_type: shiftType, plan_date: fd, status: 'pending' };
    });
    await base44.entities.LabellingJob.bulkCreate(jobRecords);
    await logLabellingEvent({ action_type: lockAfterSave ? 'plan_locked' : 'plan_created', plan_id: createdPlan.id, description: `Plan ${pid} ${lockAfterSave ? 'created and locked' : 'created'}`, user });
    queryClient.invalidateQueries({ queryKey: ['labelling-plans'] });
    toast({ title: 'Plan Created', description: `${pid} saved successfully` });
    navigate('/LblPlanningDashboard');
    setSaving(false);
  };

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-3"><Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /></Button><div><h1 className="text-xl font-bold text-slate-900">Create Shift Plan</h1><p className="text-sm text-slate-500">Set up labelling jobs for a shift</p></div></div>
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Plan Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1"><Label className="text-xs font-medium text-slate-700">Plan Date</Label><Input type="date" value={planDate} onChange={e => setPlanDate(e.target.value)} className="h-11 md:h-9" /></div>
          <div className="space-y-1"><Label className="text-xs font-medium text-slate-700">Shift</Label><Select value={shiftType} onValueChange={setShiftType}><SelectTrigger className="h-11 md:h-9"><SelectValue /></SelectTrigger><SelectContent>{SHIFT_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label className="text-xs font-medium text-slate-700">Labelling Line</Label><Select value={lineId} onValueChange={setLineId}><SelectTrigger className="h-11 md:h-9"><SelectValue placeholder="Select line" /></SelectTrigger><SelectContent>{machines.map(m => <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="space-y-1"><Label className="text-xs font-medium text-slate-700">Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional plan notes..." className="min-h-[60px]" /></div>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-900">Product Jobs ({jobs.length})</h2><Button variant="outline" size="sm" className="h-9 gap-1" onClick={addJob}><Plus className="w-3.5 h-3.5" /> Add Product</Button></div>
        {jobs.length === 0 ? <div className="text-center py-8 text-slate-400 text-sm">No products added yet. Click "Add Product" to begin.</div> : (
          <LblDraggableJobList jobs={jobs} products={products} planDate={planDate} onUpdate={updateJob} onRemove={removeJob} onReorder={reorderJobs} />
        )}
      </div>
      <div className="flex flex-col md:flex-row gap-3">
        <Button variant="outline" className="h-11 flex-1 gap-2" onClick={() => handleSave(false)} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save as Draft</Button>
        <Button className="h-11 flex-1 gap-2" onClick={() => handleSave(true)} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}Save & Lock Plan</Button>
      </div>
    </div>
  );
}