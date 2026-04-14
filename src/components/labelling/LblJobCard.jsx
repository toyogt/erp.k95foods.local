import { Link } from 'react-router-dom';
import { JOB_STATUSES, getNextOperatorAction } from '@/lib/labellingHelpers';
import { Button } from '@/components/ui/button';
import { ChevronRight, Lock, CheckCircle2 } from 'lucide-react';

export default function LblJobCard({ job, isFirst, planLocked }) {
  const st = JOB_STATUSES[job.status] || JOB_STATUSES.pending;
  const nextAction = getNextOperatorAction(job.status);
  const isCompleted = job.status === 'completed';
  const isCancelled = job.status === 'cancelled';
  const isPending = job.status === 'pending';
  // Non-pending jobs (active, bulk_printing, paused, etc.) are always actionable directly
  // Pending jobs are only actionable if they are the first in queue (isFirst)
  const isActionable = planLocked && !isCompleted && !isCancelled && (!isPending || isFirst);
  const isLocked = planLocked && isPending && !isFirst;

  return (
    <div className={`border rounded-lg p-4 transition-all ${
      isCompleted ? 'border-green-200 bg-green-50/50' :
      isLocked ? 'border-slate-200 bg-slate-50 opacity-60' :
      isActionable ? 'border-blue-200 bg-white shadow-sm' : 'border-slate-200 bg-white'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-500">#{job.priority_order}</span>
            <span className="font-semibold text-slate-900 text-sm truncate">{job.product_name}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
          </div>
          <div className="flex gap-4 mt-1 text-xs text-slate-500 flex-wrap">
            <span>Code: {job.sku_code}</span>
            <span>Planned: {job.quantity_bottles_planned?.toLocaleString()} bottles</span>
            {job.quantity_cases_planned > 0 && <span>{job.quantity_cases_planned} cases</span>}
            {job.manufacturing_date && <span>Manufacturing Date: {job.manufacturing_date}</span>}
            {job.batch_no && <span>Batch {job.batch_no}</span>}
          </div>
          {(job.status === 'bulk_printing' || job.status === 'paused' || isCompleted) && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>Printed: {job.current_printed_qty?.toLocaleString() || 0}</span>
                <span>Target: {job.quantity_bottles_planned?.toLocaleString()}</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${isCompleted ? 'bg-green-500' : 'bg-indigo-500'}`}
                  style={{ width: `${Math.min(100, ((job.current_printed_qty || 0) / (job.quantity_bottles_planned || 1)) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isLocked && <Lock className="w-4 h-4 text-slate-300" />}
          {isCompleted && <CheckCircle2 className="w-5 h-5 text-green-500" />}
          {isActionable && nextAction && (
            <Link to={`/LblOperatorJob?jobId=${job.id}`}>
              <Button size="sm" className={`h-9 gap-1 text-white ${nextAction.buttonColor}`}>
                {nextAction.action} <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          )}
          {isActionable && !nextAction && job.status === 'demo_pending_approval' && (
            <span className="text-xs text-amber-600 font-medium">Awaiting Supervisor</span>
          )}
        </div>
      </div>
    </div>
  );
}