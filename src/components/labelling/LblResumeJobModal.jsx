import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PlayCircle, Loader2 } from 'lucide-react';

export default function LblResumeJobModal({ open, onOpenChange, job, onConfirm, isLoading }) {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (!reason.trim()) return;
    onConfirm(reason.trim());
  };

  const restoredStatus = job?.previous_status || 'pending';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-700">
            <PlayCircle className="w-5 h-5" />
            Resume On-Hold Job
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
            <p className="text-sm text-green-800 font-medium">
              Job: <span className="font-mono">{job?.job_id}</span>
            </p>
            <p className="text-sm text-green-700">{job?.product_name}</p>
            <p className="text-xs text-green-600 mt-1">
              Will be restored to status: <span className="font-semibold font-mono">{restoredStatus}</span>
            </p>
          </div>

          {job?.rejection_reason && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Original Hold Reason</p>
              <p className="text-sm text-slate-700">{job.rejection_reason}</p>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700">Reason for Resuming *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this job being resumed? (e.g., Equipment fixed, Issue resolved, Approved to continue, etc.)"
              className="min-h-[80px]"
            />
            <p className="text-xs text-slate-500">This reason will be recorded in the audit log.</p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="h-11 md:h-9 flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              className="h-11 md:h-9 flex-1 bg-green-600 hover:bg-green-700"
              onClick={handleConfirm}
              disabled={isLoading || !reason.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Resuming...
                </>
              ) : (
                'Resume Job'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}