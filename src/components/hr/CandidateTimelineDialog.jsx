import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock, ArrowRight } from 'lucide-react';

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function formatDuration(mins) {
  if (mins == null || mins < 0) return '—';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

const STATUS_COLORS = {
  New: 'bg-slate-100 text-slate-700',
  Contacted: 'bg-blue-100 text-blue-700',
  Shortlisted: 'bg-amber-100 text-amber-700',
  Interviewed: 'bg-purple-100 text-purple-700',
  Hired: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  'On Hold': 'bg-slate-100 text-slate-600',
  Terminated: 'bg-red-100 text-red-700',
};

export default function CandidateTimelineDialog({ open, onOpenChange, candidate }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['candidate-status-log', candidate?.id],
    queryFn: () =>
      base44.entities.CandidateLeadStatusLog.filter(
        { candidate_lead_id: candidate.id },
        'changed_at',
        500
      ),
    enabled: !!candidate?.id && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Candidate Timeline {candidate && <span className="text-slate-500 font-normal">— {candidate.candidate_name}</span>}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        )}

        {!isLoading && logs.length === 0 && (
          <div className="text-center text-sm text-slate-500 py-10">
            No status changes recorded yet.
          </div>
        )}

        {!isLoading && logs.length > 0 && (
          <div className="space-y-3 py-2">
            {logs.map((log, idx) => (
              <div
                key={log.id}
                className="flex gap-3 border border-slate-200 rounded-lg p-3 bg-white"
              >
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-700">
                    {idx + 1}
                  </div>
                  {idx < logs.length - 1 && (
                    <div className="w-px flex-1 bg-slate-200 mt-1" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {log.old_status ? (
                      <>
                        <Badge className={STATUS_COLORS[log.old_status] || 'bg-slate-100 text-slate-700'}>
                          {log.old_status}
                        </Badge>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      </>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-600">Created</Badge>
                    )}
                    <Badge className={STATUS_COLORS[log.new_status] || 'bg-slate-100 text-slate-700'}>
                      {log.new_status}
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-1 text-xs text-slate-600">
                    <div>
                      <span className="text-slate-500">When:</span>{' '}
                      <span className="font-medium text-slate-900">{formatDateTime(log.changed_at)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">By:</span>{' '}
                      <span className="font-medium text-slate-900 truncate">{log.changed_by || '—'}</span>
                    </div>
                    {log.duration_in_previous_status_minutes != null && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span className="text-slate-500">Duration:</span>{' '}
                        <span className="font-medium text-slate-900">{formatDuration(log.duration_in_previous_status_minutes)}</span>
                      </div>
                    )}
                  </div>
                  {log.remarks && (
                    <div className="mt-2 text-xs text-slate-600 bg-slate-50 rounded p-2">
                      {log.remarks}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}