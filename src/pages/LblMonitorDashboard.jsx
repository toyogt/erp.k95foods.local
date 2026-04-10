import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { JOB_STATUSES } from '@/lib/labellingHelpers';
import { Loader2, Tag, Clock, CheckCircle2, Pause, Play } from 'lucide-react';
import moment from 'moment';

export default function LblMonitorDashboard() {
  const today = moment().format('DD/MM/YYYY');
  const { data: jobs = [], isLoading } = useQuery({ queryKey: ['lbl-monitor-jobs'], queryFn: () => base44.entities.LabellingJob.filter({ plan_date: today }), refetchInterval: 5000 });
  const { data: pendingApprovals = [] } = useQuery({ queryKey: ['lbl-monitor-approvals'], queryFn: () => base44.entities.LblChecklistSubmission.filter({ status: 'pending_approval' }), refetchInterval: 5000 });

  const active = jobs.filter(j => ['active', 'stock_transferred', 'demo_print_sent', 'demo_approved', 'bulk_printing'].includes(j.status));
  const paused = jobs.filter(j => j.status === 'paused');
  const completed = jobs.filter(j => j.status === 'completed');

  const byLine = {};
  jobs.forEach(j => { const k = j.line_name || j.line_id || 'Unassigned'; if (!byLine[k]) byLine[k] = []; byLine[k].push(j); });

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4">
      <div><h1 className="text-xl md:text-2xl font-bold text-slate-900">Live Monitoring</h1><p className="text-sm text-slate-500">{today} · {jobs.length} total jobs</p></div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-3"><p className="text-xs text-slate-500">Total</p><p className="text-2xl font-bold text-slate-900">{jobs.length}</p></div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3"><div className="flex items-center gap-1"><Play className="w-3 h-3 text-blue-600" /><p className="text-xs text-blue-600">Active</p></div><p className="text-2xl font-bold text-blue-700">{active.length}</p></div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3"><div className="flex items-center gap-1"><Pause className="w-3 h-3 text-orange-600" /><p className="text-xs text-orange-600">Paused</p></div><p className="text-2xl font-bold text-orange-700">{paused.length}</p></div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3"><div className="flex items-center gap-1"><Clock className="w-3 h-3 text-amber-600" /><p className="text-xs text-amber-600">Pending Approvals</p></div><p className="text-2xl font-bold text-amber-700">{pendingApprovals.length}</p></div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3"><div className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" /><p className="text-xs text-green-600">Completed</p></div><p className="text-2xl font-bold text-green-700">{completed.length}</p></div>
      </div>
      {Object.entries(byLine).map(([lineName, lineJobs]) => {
        const lineActive = lineJobs.find(j => ['active', 'stock_transferred', 'demo_print_sent', 'bulk_printing', 'paused'].includes(j.status));
        return (
          <div key={lineName} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 flex items-center justify-between"><div className="flex items-center gap-2"><Tag className="w-4 h-4 text-pink-600" /><span className="font-semibold text-slate-900 text-sm">{lineName}</span><span className="text-xs text-slate-400">{lineJobs.filter(j => j.status === 'completed').length}/{lineJobs.length} done</span></div>{lineActive && <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${JOB_STATUSES[lineActive.status]?.color}`}>{lineActive.product_name} — {JOB_STATUSES[lineActive.status]?.label}</span>}</div>
            <div className="divide-y divide-slate-100">
              {lineJobs.sort((a, b) => a.priority_order - b.priority_order).map(job => {
                const st = JOB_STATUSES[job.status] || JOB_STATUSES.pending;
                const pct = job.quantity_bottles_planned ? ((job.current_printed_qty || 0) / job.quantity_bottles_planned * 100) : 0;
                return (
                  <div key={job.id} className="px-4 py-3 flex items-center gap-4">
                    <span className="text-xs font-bold text-slate-400 w-6">#{job.priority_order}</span>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-900 truncate">{job.product_name}</p><p className="text-xs text-slate-500">{job.sku_code} · {job.quantity_bottles_planned?.toLocaleString()} bottles</p></div>
                    {(job.status === 'bulk_printing' || job.status === 'paused' || job.status === 'completed') && <div className="w-24"><div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden"><div className={`h-full rounded-full ${job.status === 'completed' ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, pct)}%` }} /></div><p className="text-xs text-slate-400 mt-0.5">{pct.toFixed(0)}%</p></div>}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${st.color}`}>{st.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}