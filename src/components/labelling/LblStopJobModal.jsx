import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { AlertTriangle, Loader2 } from 'lucide-react';

export default function LblStopJobModal({ open, onOpenChange, job, onConfirm, isLoading }) {
  const [status, setStatus] = useState('cancelled');
  const [remarks, setRemarks] = useState('');

  const handleConfirm = () => {
    if (!remarks.trim()) {
      alert('Please enter a reason/remark');
      return;
    }
    onConfirm(status, remarks.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            Stop Job & Move to Next
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700 font-medium">
              Job: <span className="font-mono">{job?.job_id}</span>
            </p>
            <p className="text-sm text-red-600">{job?.product_name}</p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700">Job Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-11 md:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cancelled">Cancelled (Will not resume)</SelectItem>
                <SelectItem value="on_hold">On Hold (May resume later)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700">Reason / Remarks *</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Why is this job being stopped? (e.g., Equipment issue, Quality concern, Operator request, etc.)"
              className="min-h-[80px]"
            />
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
              className="h-11 md:h-9 flex-1 bg-red-600 hover:bg-red-700"
              onClick={handleConfirm}
              disabled={isLoading || !remarks.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                'Stop & Next'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}