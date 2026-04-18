import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { JOB_STATUSES } from '@/lib/labellingHelpers';
import { logLabellingEvent } from '@/lib/labellingEventLogger';
import LblStockTransferStep from '@/components/labelling/LblStockTransferStep';
import LblDemoPrintStep from '@/components/labelling/LblDemoPrintStep';
import LblDemoPrintVerificationStep from '@/components/labelling/LblDemoPrintVerificationStep';
import LblChecklistStep from '@/components/labelling/LblChecklistStep';
import LblBulkPrintStep from '@/components/labelling/LblBulkPrintStep';
import LblCompletionStep from '@/components/labelling/LblCompletionStep';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, Loader2, Play, RotateCcw } from 'lucide-react';

export default function LblOperatorJob() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const jobId = new URLSearchParams(window.location.search).get('jobId');
  const [user, setUser] = useState(null);
  const [acting, setActing] = useState(false);

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const { data: job, isLoading } = useQuery({
    queryKey: ['labelling-job', jobId],
    queryFn: async () => { const j = await base44.entities.LabellingJob.filter({ id: jobId }); return j[0] || null; },
    enabled: !!jobId,
  });
  const refreshJob = () => queryClient.invalidateQueries({ queryKey: ['labelling-job', jobId] });

  const handleStartJob = async () => {
    setActing(true);
    await base44.entities.LabellingJob.update(job.id, { status: 'active', started_at: new Date().toISOString(), started_by: user?.email });
    await logLabellingEvent({ action_type: 'job_started', job_id: job.id, plan_id: job.plan_id, description: `Job ${job.job_id} started`, user });
    toast({ title: 'Job Started' });
    refreshJob();
    setActing(false);
  };

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!job) return <div className="p-6 text-center text-slate-500">Job not found</div>;

  const st = JOB_STATUSES[job.status] || JOB_STATUSES.pending;
  const steps = ['Start', 'Stock Transfer', 'Demo Print', 'Verify Demo', 'Checklist', 'Approval', 'Bulk Print', 'Complete'];
  const currentStep = st.step >= 0 ? Math.min(st.step, steps.length - 1) : 0;

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap"><h1 className="text-lg font-bold text-slate-900">{job.product_name}</h1><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span></div>
          <p className="text-sm text-slate-500">Job: {job.job_id} · Priority #{job.priority_order} · {job.quantity_bottles_planned?.toLocaleString()} bottles</p>
          {(job.manufacturing_date || job.batch_no) && (
            <div className="flex gap-3 mt-1 text-xs text-slate-500">
              {job.manufacturing_date && <span>Manufacturing Date: {job.manufacturing_date}</span>}
              {job.batch_no && <span className="font-medium text-slate-700">Batch {job.batch_no}</span>}
            </div>
          )}
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg p-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-1 shrink-0">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < currentStep ? 'bg-green-500 text-white' : i === currentStep ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{i + 1}</div>
              <span className={`text-xs whitespace-nowrap ${i === currentStep ? 'font-medium text-slate-900' : 'text-slate-400'}`}>{s}</span>
              {i < steps.length - 1 && <div className={`w-4 h-0.5 ${i < currentStep ? 'bg-green-400' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>
      </div>
      {job.status === 'pending' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 text-center space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Ready to Start</h2>
          <p className="text-sm text-slate-500">Begin this labelling job to record stock transfer and initiate demo printing.</p>
          <Button className="h-11 gap-2 w-full md:w-auto" onClick={handleStartJob} disabled={acting}>{acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}Start Job</Button>
        </div>
      )}
      {job.status === 'active' && <LblStockTransferStep job={job} user={user} onComplete={refreshJob} />}
      {job.status === 'stock_transferred' && <LblDemoPrintStep job={job} user={user} onComplete={refreshJob} />}
      {job.status === 'demo_print_sent' && <LblDemoPrintVerificationStep job={job} user={user} onComplete={refreshJob} />}
      {(job.status === 'demo_print_verified' || job.status === 'demo_rejected') && <LblChecklistStep job={job} user={user} onComplete={refreshJob} />}
      {job.status === 'demo_pending_approval' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center space-y-4">
          <h2 className="text-lg font-semibold text-amber-800">Waiting for Supervisor Approval</h2>
          <p className="text-sm text-amber-600">Your checklist and demo sample have been submitted for review.</p>
          <Button
            variant="outline"
            className="h-11 gap-2 border-amber-300 text-amber-700 hover:bg-amber-100"
            disabled={acting}
            onClick={async () => {
              setActing(true);
              await base44.entities.LabellingJob.update(job.id, { status: 'demo_print_verified', approval_status: 'not_required' });
              await logLabellingEvent({ action_type: 'checklist_withdrawn', job_id: job.id, plan_id: job.plan_id, description: `Checklist submission withdrawn for job ${job.job_id} — re-opening for edit`, user });
              toast({ title: 'Submission Withdrawn', description: 'You can now re-fill and re-submit the checklist.' });
              refreshJob();
              setActing(false);
            }}
          >
            {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            Withdraw &amp; Redo Checklist
          </Button>
        </div>
      )}
      {job.status === 'demo_approved' && <LblBulkPrintStep job={job} user={user} onComplete={refreshJob} mode="start" />}
      {(job.status === 'bulk_printing' || job.status === 'paused') && <LblBulkPrintStep job={job} user={user} onComplete={refreshJob} mode="control" />}
      {job.status === 'completed' && <LblCompletionStep job={job} />}
      {(job.status === 'bulk_printing' || job.status === 'paused') && job.current_printed_qty >= job.quantity_bottles_planned && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 text-center space-y-4">
          <h2 className="text-lg font-semibold text-green-700">Bulk Printing Complete</h2>
          <p className="text-sm text-slate-500">All {job.quantity_bottles_planned?.toLocaleString()} labels have been printed successfully.</p>
          <Button
            className="h-11 gap-2 w-full md:w-auto bg-green-600 hover:bg-green-700"
            onClick={async () => {
              setActing(true);
              await base44.entities.LabellingJob.update(job.id, {
                status: 'completed',
                completed_at: new Date().toISOString(),
                completed_by: user?.email,
              });
              await logLabellingEvent({
                action_type: 'job_completed',
                job_id: job.id,
                plan_id: job.plan_id,
                description: `Job ${job.job_id} completed — all ${job.quantity_bottles_planned} bottles printed`,
                user,
              });
              toast({ title: 'Job Completed', description: 'Labelling job finished successfully.' });
              refreshJob();
              setActing(false);
            }}
            disabled={acting}
          >
            {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Mark as Complete
          </Button>
        </div>
      )}
    </div>
  );
}