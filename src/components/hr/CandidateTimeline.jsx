import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, Circle, CheckCircle2, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const STATUS_COLOR = {
  New: 'bg-slate-100 text-slate-700',
  Contacted: 'bg-blue-100 text-blue-700',
  Shortlisted: 'bg-amber-100 text-amber-700',
  Interviewed: 'bg-violet-100 text-violet-700',
  Hired: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  'On Hold': 'bg-slate-100 text-slate-600',
  Terminated: 'bg-red-100 text-red-700',
};

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function formatDuration(minutes) {
  if (minutes == null || isNaN(minutes) || minutes < 0) return null;
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} hr`;
  const days = hours / 24;
  return `${days.toFixed(1)} days`;
}

export default function CandidateTimeline({ candidateLeadId }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['candidate-status-log', candidateLeadId],
    queryFn: () =>
      base44.entities.CandidateLeadStatusLog.filter(
        { candidate_lead_id: candidateLeadId },
        'changed_at',
        500
      ),
    enabled: !!candidateLeadId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!logs.length) {
    return (
      <div className="text-center py-8 text-sm text-slate-500">
        No status changes recorded yet for this candidate.
      </div>
    );
  }

  const sorted = [...logs].sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at));

  return (
    <div className="relative">
      <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-slate-200" aria-hidden="true" />

      <ol className="space-y-4">
        {sorted.map((log, idx) => {
          const isLast = idx === sorted.length - 1;
          const isHired = log.new_status === 'Hired';
          const isTerminated = log.new_status === 'Terminated';
          const Icon = isHired || isTerminated ? CheckCircle2 : Circle;
          const iconColor = isHired
            ? 'text-green-600 bg-green-50'
            : isTerminated
            ? 'text-red-600 bg-red-50'
            : isLast
            ? 'text-blue-600 bg-blue-50'
            : 'text-slate-500 bg-white';

          const duration = formatDuration(log.duration_in_previous_status_minutes);

          return (
            <li key={log.id} className="relative pl-12">
              <div
                className={`absolute left-0 top-0 w-8 h-8 rounded-full border-2 border-slate-200 flex items-center justify-center ${iconColor}`}
              >
                <Icon className="w-4 h-4" />
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2 flex-wrap">
                  {log.old_status ? (
                    <>
                      <Badge className={STATUS_COLOR[log.old_status] || STATUS_COLOR.New}>
                        {log.old_status}
                      </Badge>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </>
                  ) : (
                    <span className="text-xs text-slate-500">Created as</span>
                  )}
                  <Badge className={STATUS_COLOR[log.new_status] || STATUS_COLOR.New}>
                    {log.new_status}
                  </Badge>
                </div>

                <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
                  <div className="text-xs font-mono text-slate-600">
                    {formatDateTime(log.changed_at)}
                  </div>
                  {duration && (
                    <div className="text-xs text-slate-500">
                      Time in previous stage: <span className="font-medium text-slate-700">{duration}</span>
                    </div>
                  )}
                </div>

                {log.changed_by && (
                  <div className="mt-1 text-xs text-slate-500">
                    by <span className="font-medium text-slate-700">{log.changed_by}</span>
                  </div>
                )}

                {log.remarks && (
                  <div className="mt-2 text-xs text-slate-600 bg-slate-50 rounded px-2 py-1.5 border border-slate-100">
                    {log.remarks}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}