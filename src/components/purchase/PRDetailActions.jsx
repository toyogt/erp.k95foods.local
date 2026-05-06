import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, X } from 'lucide-react';

export default function PRDetailActions({ acting, onApprove, onReject }) {
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
      <p className="text-sm font-semibold text-slate-900">Full Request Actions</p>
      {showReject ? (
        <div className="space-y-2">
          <textarea
            className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm"
            placeholder="Reason for rejecting entire request..."
            rows={2} value={rejectReason} onChange={e => setRejectReason(e.target.value)} autoFocus
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 h-11" onClick={() => { setShowReject(false); setRejectReason(''); }}>Cancel</Button>
            <Button className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white font-bold"
              onClick={() => { onReject(rejectReason); setShowReject(false); setRejectReason(''); }}
              disabled={!rejectReason.trim() || !!acting}>
              Confirm Reject Request
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-white font-bold" onClick={onApprove} disabled={!!acting}>
            {acting === 'pr-approve' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Approve Entire Request
          </Button>
          <Button variant="outline" className="flex-1 h-11 border-red-300 text-red-600 hover:bg-red-50 font-bold" onClick={() => setShowReject(true)} disabled={!!acting}>
            <X className="w-4 h-4 mr-2" /> Reject Entire Request
          </Button>
        </div>
      )}
    </div>
  );
}