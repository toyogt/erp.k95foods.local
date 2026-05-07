/**
 * LblQueuePausedSection
 * Shows all paused jobs (except the hero) with a prominent Resume button.
 */
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { RotateCcw, Pause } from 'lucide-react';

export default function LblQueuePausedSection({ jobs }) {
  const navigate = useNavigate();
  if (!jobs || jobs.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Pause className="w-4 h-4 text-orange-500" />
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
          Paused Jobs ({jobs.length})
        </h3>
      </div>

      <div className="space-y-2">
        {jobs.map(job => {
          const printed = job.current_printed_qty || 0;
          const planned = job.quantity_bottles_planned || 1;
          const pct = Math.min(100, Math.round((printed / planned) * 100));
          const remaining = planned - printed;

          return (
            <div
              key={job.id}
              className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 text-base leading-tight">{job.product_name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-sm text-slate-600">
                    <span>Priority #{job.priority_order}</span>
                    {job.line_name && <span>· {job.line_name}</span>}
                    {job.batch_no && <span>· Batch: <span className="font-mono">{job.batch_no}</span></span>}
                  </div>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">
                  <Pause className="w-3 h-3" /> Paused
                </span>
              </div>

              {/* Progress */}
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>{printed.toLocaleString()} printed · <strong className="text-orange-700">{remaining.toLocaleString()} remaining</strong></span>
                  <span>{pct}%</span>
                </div>
                <div className="w-full h-2.5 bg-orange-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-orange-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <Button
                className="w-full h-12 text-sm font-bold gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl"
                onClick={() => navigate(`/LblOperatorJob?jobId=${job.id}`)}
              >
                <RotateCcw className="w-4 h-4" />
                Resume — {remaining.toLocaleString()} bottles remaining
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}