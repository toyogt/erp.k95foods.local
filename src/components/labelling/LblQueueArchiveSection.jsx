/**
 * LblQueueArchiveSection
 * Collapsible section for On Hold, Completed, and Cancelled jobs.
 * Kept out of the way so operators focus on active work.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, CheckCircle2, XCircle, PauseCircle, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

function ArchiveGroup({ icon: Icon, title, jobs, iconColor, navigateFn, showResume, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  if (!jobs || jobs.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
        <span className="flex-1 text-left text-sm font-semibold text-slate-700">{title}</span>
        <span className="text-xs text-slate-400 font-medium mr-2">{jobs.length} job{jobs.length !== 1 ? 's' : ''}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="divide-y divide-slate-100 border-t border-slate-100">
          {jobs.map(job => (
            <div
              key={job.id}
              onClick={() => navigateFn(`/LblOperatorJob?jobId=${job.id}`)}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 active:bg-slate-100 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{job.product_name}</p>
                <div className="flex gap-3 text-xs text-slate-400 mt-0.5 flex-wrap">
                  <span>{(job.quantity_bottles_planned || 0).toLocaleString()} bottles</span>
                  {job.batch_no && <span>· Batch: <span className="font-mono">{job.batch_no}</span></span>}
                  {job.line_name && <span>· {job.line_name}</span>}
                  {showResume && job.previous_status && <span>· Paused at: <span className="font-mono">{job.previous_status}</span></span>}
                </div>
              </div>
              {showResume ? (
                <Button
                  size="sm"
                  className="h-9 gap-1.5 bg-green-600 hover:bg-green-700 text-white shrink-0"
                  onClick={(e) => { e.stopPropagation(); navigateFn(`/LblOperatorJob?jobId=${job.id}`); }}
                >
                  <PlayCircle className="w-4 h-4" />
                  Resume
                </Button>
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-300 -rotate-90" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LblQueueArchiveSection({ onHold, completed, cancelled }) {
  const navigate = useNavigate();
  const hasAny = (onHold?.length + completed?.length + cancelled?.length) > 0;
  if (!hasAny) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Archive</h3>
      <ArchiveGroup
        icon={PauseCircle}
        title="On Hold"
        jobs={onHold}
        iconColor="text-amber-500"
        navigateFn={navigate}
        showResume
        defaultOpen
      />
      <ArchiveGroup
        icon={CheckCircle2}
        title="Completed"
        jobs={completed}
        iconColor="text-green-500"
        navigateFn={navigate}
      />
      <ArchiveGroup
        icon={XCircle}
        title="Cancelled"
        jobs={cancelled}
        iconColor="text-red-400"
        navigateFn={navigate}
      />
    </div>
  );
}