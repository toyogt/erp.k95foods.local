/**
 * LblQueueUpNext
 * Hero card — the single most important job right now.
 * Shows prominently at the top of the operator queue.
 */
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { JOB_STATUSES } from '@/lib/labellingHelpers';
import { ChevronRight, Zap, RotateCcw, Clock } from 'lucide-react';

const IN_PROGRESS_STATUSES = [
  'active', 'stock_transferred', 'demo_print_sent', 'demo_print_verified',
  'checklist_submitted', 'demo_pending_approval', 'demo_approved', 'demo_rejected',
  'bulk_printing', 'bulk_printing_awaiting_printer_reset',
];

export default function LblQueueUpNext({ job }) {
  const navigate = useNavigate();
  const st = JOB_STATUSES[job.status] || JOB_STATUSES.pending;

  const isInProgress = IN_PROGRESS_STATUSES.includes(job.status);
  const isPaused = job.status === 'paused';
  const isPending = job.status === 'pending';
  const isAwaiting = job.status === 'demo_pending_approval';

  const printed = job.current_printed_qty || 0;
  const planned = job.quantity_bottles_planned || 1;
  const pct = Math.min(100, Math.round((printed / planned) * 100));

  const bgClass = isPaused
    ? 'bg-orange-600'
    : isInProgress
    ? 'bg-blue-700'
    : 'bg-slate-800';

  const label = isPaused
    ? 'Paused — Resume this job'
    : isInProgress
    ? 'In Progress — Continue this job'
    : 'Up Next — Start this job';

  const btnIcon = isPaused ? <RotateCcw className="w-5 h-5" /> : isInProgress ? <Zap className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />;
  const btnLabel = isPaused ? 'Resume Job' : isInProgress ? 'Continue Job' : 'Start Job';

  return (
    <div className={`rounded-2xl overflow-hidden shadow-lg ${bgClass}`}>
      {/* Tag */}
      <div className="px-5 pt-4 pb-1">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white/70 uppercase tracking-widest">
          {isPaused ? <RotateCcw className="w-3 h-3" /> : isInProgress ? <Zap className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          {label}
        </span>
      </div>

      {/* Product Name */}
      <div className="px-5 pt-1 pb-3">
        <h2 className="text-2xl font-extrabold text-white leading-tight">{job.product_name}</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm text-white/75">
          <span>Priority #{job.priority_order}</span>
          {job.line_name && <span>· {job.line_name}</span>}
          <span>· {planned.toLocaleString()} bottles planned</span>
          {job.batch_no && <span>· Batch: <span className="font-mono font-semibold text-white">{job.batch_no}</span></span>}
        </div>

        {/* Status badge */}
        <div className="mt-2">
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold bg-white/15 text-white`}>
            {st.label}
          </span>
        </div>
      </div>

      {/* Progress bar (for printing / paused) */}
      {(isInProgress || isPaused) && (
        <div className="px-5 pb-3">
          <div className="flex justify-between text-xs text-white/70 mb-1.5">
            <span>{printed.toLocaleString()} printed</span>
            <span>{pct}% done</span>
          </div>
          <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-white transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="px-5 pb-5">
        {isAwaiting ? (
          <div className="w-full h-14 rounded-xl bg-amber-500/80 flex items-center justify-center gap-2 text-white font-bold text-base">
            <Clock className="w-5 h-5" />
            Waiting for Supervisor Approval
          </div>
        ) : (
          <Button
            className="w-full h-14 text-base font-bold gap-2 bg-white text-slate-900 hover:bg-slate-100 rounded-xl shadow-md"
            onClick={() => navigate(`/LblOperatorJob?jobId=${job.id}`)}
          >
            {btnIcon}
            {btnLabel}
          </Button>
        )}
      </div>
    </div>
  );
}