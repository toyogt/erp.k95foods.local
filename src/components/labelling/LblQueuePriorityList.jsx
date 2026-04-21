/**
 * LblQueuePriorityList
 * Numbered list of upcoming/pending jobs in priority order.
 * Clean and simple — each row shows what the job is and how many bottles.
 */
import { useNavigate } from 'react-router-dom';
import { JOB_STATUSES } from '@/lib/labellingHelpers';
import { ChevronRight, ListOrdered } from 'lucide-react';

const IN_PROGRESS_STATUSES = [
  'active', 'stock_transferred', 'demo_print_sent', 'demo_print_verified',
  'checklist_submitted', 'demo_pending_approval', 'demo_approved', 'demo_rejected',
  'bulk_printing', 'bulk_printing_awaiting_printer_reset',
];

export default function LblQueuePriorityList({ jobs }) {
  const navigate = useNavigate();
  if (!jobs || jobs.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ListOrdered className="w-4 h-4 text-slate-500" />
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
          Coming Up ({jobs.length})
        </h3>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
        {jobs.map((job, idx) => {
          const st = JOB_STATUSES[job.status] || JOB_STATUSES.pending;
          const isInProgress = IN_PROGRESS_STATUSES.includes(job.status);
          const isAwaiting = job.status === 'demo_pending_approval';

          return (
            <div
              key={job.id}
              onClick={() => !isAwaiting && navigate(`/LblOperatorJob?jobId=${job.id}`)}
              className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${
                isAwaiting ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50 active:bg-slate-100'
              }`}
            >
              {/* Priority number */}
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                {idx + 2}
              </div>

              {/* Job info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm leading-tight truncate">{job.product_name}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0 mt-0.5 text-xs text-slate-500">
                  <span>{(job.quantity_bottles_planned || 0).toLocaleString()} bottles</span>
                  {job.line_name && <span>· {job.line_name}</span>}
                  {job.manufacturing_date && <span>· Manufactured: {job.manufacturing_date}</span>}
                </div>
              </div>

              {/* Status badge */}
              <div className="flex items-center gap-2 shrink-0">
                {isAwaiting ? (
                  <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                    Awaiting Approval
                  </span>
                ) : isInProgress ? (
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${st.color}`}>
                    {st.label}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 font-medium">Pending</span>
                )}
                {!isAwaiting && <ChevronRight className="w-4 h-4 text-slate-300" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}