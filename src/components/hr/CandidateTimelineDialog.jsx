import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import CandidateTimeline from './CandidateTimeline';
import { Activity } from 'lucide-react';

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

export default function CandidateTimelineDialog({ open, onOpenChange, candidate }) {
  if (!candidate) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-slate-700" />
            Candidate Journey
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="text-base font-semibold text-slate-900">{candidate.candidate_name}</div>
                <div className="text-xs text-slate-500 font-mono">{candidate.mobile_number}</div>
              </div>
              <Badge className={STATUS_COLOR[candidate.status] || STATUS_COLOR.New}>
                Current: {candidate.status || 'New'}
              </Badge>
            </div>
            {(candidate.role_interested || candidate.location_area) && (
              <div className="mt-2 text-xs text-slate-600">
                {candidate.role_interested}
                {candidate.role_interested && candidate.location_area && ' · '}
                {candidate.location_area}
              </div>
            )}
          </div>

          <CandidateTimeline candidateLeadId={candidate.id} />
        </div>
      </DialogContent>
    </Dialog>
  );
}