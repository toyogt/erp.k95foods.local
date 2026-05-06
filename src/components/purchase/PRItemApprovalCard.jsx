import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, X, Camera, MessageSquare, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import PRSamplePhotoUploader from './PRSamplePhotoUploader';
import PRCommentThread from './PRCommentThread';
import { logPurchaseAudit } from './purchaseHelpers';
import { useQuery } from '@tanstack/react-query';

const ITEM_STATUS_COLOR = {
  Pending: 'bg-amber-100 text-amber-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  'Sample Photo Requested': 'bg-purple-100 text-purple-700',
  'Clarification Requested': 'bg-blue-100 text-blue-700',
};

export default function PRItemApprovalCard({ item, index, canApprove, isRequester, acting, onAction, loadItems, user, prNumber }) {
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [showSampleNote, setShowSampleNote] = useState(false);
  const [sampleNote, setSampleNote] = useState('');
  const [showCommentThread, setShowCommentThread] = useState(false);

  const { data: commentCount = 0 } = useQuery({
    queryKey: ['pr-comment-count', prNumber, item.line_number],
    queryFn: async () => {
      const comments = await base44.entities.PRComment.filter({ pr_number: prNumber, line_number: item.line_number }, '-created_date', 1);
      return comments.length;
    },
    staleTime: 30000,
    enabled: !!prNumber,
  });

  const it = item;
  const isPending = it.item_status === 'Pending' || !it.item_status;
  const isSampleRequested = it.item_status === 'Sample Photo Requested';
  const needsAction = isRequester && (isSampleRequested || it.item_status === 'Clarification Requested');
  const borderClass = needsAction ? 'border-2 border-amber-300 bg-amber-50/30' : 'border border-slate-200 bg-white';

  async function handleApprove() {
    await onAction(it.id, { item_status: 'Approved' });
    await logPurchaseAudit({ action: `Item "${it.item_name}" approved in ${prNumber}`, action_type: 'approve', entity_type: 'PurchaseRequestItem', entity_id: prNumber, user });
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;
    await onAction(it.id, { item_status: 'Rejected', rejection_reason: rejectReason });
    await logPurchaseAudit({ action: `Item "${it.item_name}" rejected in ${prNumber}: ${rejectReason}`, action_type: 'reject', entity_type: 'PurchaseRequestItem', entity_id: prNumber, user });
    setShowReject(false);
    setRejectReason('');
  }

  async function handleRequestSamplePhoto() {
    await onAction(it.id, { item_status: 'Sample Photo Requested', sample_photo_requested: true, sample_photo_request_note: sampleNote });
    await logPurchaseAudit({ action: `Sample photo requested for "${it.item_name}" in ${prNumber}`, action_type: 'status_change', entity_type: 'PurchaseRequestItem', entity_id: prNumber, user });
    setShowSampleNote(false);
    setSampleNote('');
  }

  async function handleRequestClarification() {
    await base44.entities.PRComment.create({
      pr_number: prNumber, line_number: it.line_number,
      comment_type: 'clarification_request', message: 'Clarification requested by approver',
      author_email: user?.email || '', author_name: user?.full_name || '',
    });
    await onAction(it.id, { item_status: 'Clarification Requested' });
    await logPurchaseAudit({ action: `Clarification requested for "${it.item_name}" in ${prNumber}`, action_type: 'status_change', entity_type: 'PurchaseRequestItem', entity_id: prNumber, user });
  }

  return (
    <div className={`rounded-2xl p-4 space-y-3 ${borderClass}`}>
      {needsAction && (
        <div className="flex items-center gap-2 text-amber-700 text-sm font-semibold">
          <AlertTriangle className="w-4 h-4" />
          {isSampleRequested ? 'Sample photo requested — please upload' : 'Clarification requested — please respond'}
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-900">#{it.line_number || index + 1}</span>
            <span className="text-sm font-bold text-slate-900">{it.item_name || it.item_code}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ITEM_STATUS_COLOR[it.item_status] || 'bg-slate-100 text-slate-600'}`}>
              {it.item_status || 'Pending'}
            </span>
          </div>
          {it.description && <p className="text-sm text-slate-500 mt-0.5">{it.description}</p>}
          <p className="text-sm text-slate-600 mt-1">
            Quantity: <strong>{it.qty || it.quantity || 0}</strong> {it.unit || it.uom_code || 'piece'}
          </p>
          {it.estimated_rate > 0 && <p className="text-xs text-slate-500">Estimated Rate: ₹{it.estimated_rate}</p>}
          {it.rejection_reason && (
            <p className="text-xs text-red-600 mt-1 bg-red-50 rounded px-2 py-1">Rejected: {it.rejection_reason}</p>
          )}
        </div>
        {it.sample_image && (
          <a href={it.sample_image} target="_blank" rel="noopener noreferrer" className="shrink-0">
            <img src={it.sample_image} alt="Sample" className="w-14 h-14 rounded-lg object-cover border border-slate-200" />
          </a>
        )}
      </div>

      {isRequester && <PRSamplePhotoUploader item={it} user={user} onUploaded={loadItems} />}

      {it.remarks && <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">{it.remarks}</p>}

      {canApprove && (isPending || isSampleRequested) && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" className="h-10 px-4 bg-green-600 hover:bg-green-700 text-white font-bold gap-1.5" onClick={handleApprove} disabled={acting === it.id}>
            {acting === it.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Approve
          </Button>
          <Button size="sm" variant="outline" className="h-10 px-4 border-red-300 text-red-600 hover:bg-red-50 font-bold gap-1.5" onClick={() => setShowReject(true)} disabled={!!acting}>
            <X className="w-4 h-4" /> Reject
          </Button>
          <Button size="sm" variant="outline" className="h-10 px-4 border-orange-300 text-orange-600 hover:bg-orange-50 font-bold gap-1.5" onClick={() => setShowSampleNote(true)} disabled={!!acting}>
            <Camera className="w-4 h-4" /> Request Sample Photo
          </Button>
          <Button size="sm" variant="outline" className="h-10 px-4 border-purple-300 text-purple-600 hover:bg-purple-50 font-bold gap-1.5" onClick={handleRequestClarification} disabled={!!acting}>
            <MessageSquare className="w-4 h-4" /> Clarification
          </Button>
        </div>
      )}

      {showReject && (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <textarea className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm" placeholder="Reason for rejection..." rows={2} value={rejectReason} onChange={e => setRejectReason(e.target.value)} autoFocus />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-10" onClick={() => { setShowReject(false); setRejectReason(''); }}>Cancel</Button>
            <Button size="sm" className="h-10 bg-red-600 hover:bg-red-700 text-white" onClick={handleReject} disabled={!rejectReason.trim() || !!acting}>Confirm Reject</Button>
          </div>
        </div>
      )}

      {showSampleNote && (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <textarea className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm" placeholder="Note for the requester (optional)..." rows={2} value={sampleNote} onChange={e => setSampleNote(e.target.value)} autoFocus />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-10" onClick={() => { setShowSampleNote(false); setSampleNote(''); }}>Cancel</Button>
            <Button size="sm" className="h-10 bg-orange-600 hover:bg-orange-700 text-white" onClick={handleRequestSamplePhoto} disabled={!!acting}>Send Request</Button>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={() => setShowCommentThread(true)} className="text-sm text-blue-600 font-medium flex items-center gap-1 hover:text-blue-700">
          <MessageSquare className="w-3.5 h-3.5" /> Comments{commentCount > 0 ? ` (${commentCount})` : ''}
        </button>
      </div>

      {showCommentThread && (
        <PRCommentThread prNumber={prNumber} lineNumber={it.line_number} user={user} onClose={() => setShowCommentThread(false)} />
      )}
    </div>
  );
}

export { ITEM_STATUS_COLOR };