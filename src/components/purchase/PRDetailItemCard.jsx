import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, X, Camera, MessageSquare, Image as ImageIcon, Upload, AlertTriangle } from 'lucide-react';
import { ITEM_STATUS_COLOR } from './PRDetailView';

export default function PRDetailItemCard({ item, index, canApprove, isRequester, acting, onAction, loadItems, user }) {
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [showClarification, setShowClarification] = useState(false);
  const [clarificationText, setClarificationText] = useState('');
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [uploading, setUploading] = useState(false);

  const it = item;
  const isPending = it.item_status === 'Pending' || !it.item_status;
  const needsAction = isRequester && (it.item_status === 'Sample Photo Requested' || it.item_status === 'Clarification Requested');
  const borderClass = needsAction ? 'border-2 border-amber-300 bg-amber-50/30' : 'border border-slate-200 bg-white';

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await onAction(it.id, { sample_image: file_url, item_status: 'Pending' });
    setUploading(false);
  }

  async function submitComment() {
    if (!comment.trim()) return;
    await onAction(it.id, { remarks: `${it.remarks ? it.remarks + ' | ' : ''}Comment: ${comment}` });
    setComment('');
    setShowComment(false);
  }

  return (
    <div className={`rounded-2xl p-4 space-y-3 ${borderClass}`}>
      {/* Action required flag */}
      {needsAction && (
        <div className="flex items-center gap-2 text-amber-700 text-sm font-semibold">
          <AlertTriangle className="w-4 h-4" />
          {it.item_status === 'Sample Photo Requested' ? 'Sample photo requested — please upload' : 'Clarification requested — please respond'}
        </div>
      )}

      {/* Item header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-900">#{it.line_number || index + 1}</span>
            <span className="text-sm font-bold text-slate-900">{it.item_name || it.item_code}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ITEM_STATUS_COLOR[it.item_status] || 'bg-slate-100 text-slate-600'}`}>
              {it.item_status || 'Pending'}
            </span>
          </div>
          {it.description && it.description !== it.item_name && (
            <p className="text-sm text-slate-500 mt-0.5">{it.description}</p>
          )}
          <p className="text-sm text-slate-600 mt-1">
            Quantity: <strong>{it.qty || it.quantity || 0}</strong> {it.unit || it.uom_code || 'piece'}
          </p>
          {it.estimated_rate > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">Estimated Rate: ₹{it.estimated_rate}</p>
          )}
        </div>
        {it.sample_image && (
          <a href={it.sample_image} target="_blank" rel="noopener noreferrer" className="shrink-0">
            <img src={it.sample_image} alt="Sample" className="w-14 h-14 rounded-lg object-cover border border-slate-200" />
          </a>
        )}
      </div>

      {/* Sample photo submitted indicator */}
      {it.sample_image && it.item_status !== 'Sample Photo Requested' && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-700 font-medium">Sample photo submitted</span>
          <a href={it.sample_image} target="_blank" rel="noopener noreferrer" className="ml-auto">
            <ImageIcon className="w-5 h-5 text-green-600" />
          </a>
        </div>
      )}

      {/* Requester upload area for sample photo */}
      {needsAction && it.item_status === 'Sample Photo Requested' && isRequester && (
        <div className="border-2 border-dashed border-purple-300 rounded-xl p-4 text-center bg-purple-50/50">
          <Camera className="w-6 h-6 text-purple-500 mx-auto mb-2" />
          <p className="text-sm text-purple-700 font-medium mb-2">Upload sample photo</p>
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium cursor-pointer hover:bg-purple-700">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Uploading...' : 'Choose Photo'}
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
          </label>
        </div>
      )}

      {/* Remarks */}
      {it.remarks && (
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">{it.remarks}</p>
      )}

      {/* ── Approver actions ── */}
      {canApprove && isPending && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" className="h-10 px-4 bg-green-600 hover:bg-green-700 text-white font-bold gap-1.5"
            onClick={() => onAction(it.id, { item_status: 'Approved' })} disabled={acting === it.id}>
            {acting === it.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Approve
          </Button>
          <Button size="sm" variant="outline" className="h-10 px-4 border-red-300 text-red-600 hover:bg-red-50 font-bold gap-1.5"
            onClick={() => setShowReject(true)} disabled={!!acting}>
            <X className="w-4 h-4" /> Reject
          </Button>
          <Button size="sm" variant="outline" className="h-10 px-4 border-orange-300 text-orange-600 hover:bg-orange-50 font-bold gap-1.5"
            onClick={() => onAction(it.id, { item_status: 'Sample Photo Requested' })} disabled={!!acting}>
            <Camera className="w-4 h-4" /> Request Sample Photo
          </Button>
          <Button size="sm" variant="outline" className="h-10 px-4 border-purple-300 text-purple-600 hover:bg-purple-50 font-bold gap-1.5"
            onClick={() => setShowClarification(true)} disabled={!!acting}>
            <MessageSquare className="w-4 h-4" /> Clarification
          </Button>
        </div>
      )}

      {/* Reject input */}
      {showReject && (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <textarea className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm" placeholder="Reason for rejection..."
            rows={2} value={rejectReason} onChange={e => setRejectReason(e.target.value)} autoFocus />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-10" onClick={() => { setShowReject(false); setRejectReason(''); }}>Cancel</Button>
            <Button size="sm" className="h-10 bg-red-600 hover:bg-red-700 text-white"
              onClick={() => { onAction(it.id, { item_status: 'Rejected', remarks: `${it.remarks ? it.remarks + ' | ' : ''}Rejected: ${rejectReason}` }); setShowReject(false); setRejectReason(''); }}
              disabled={!rejectReason.trim() || !!acting}>Confirm Reject</Button>
          </div>
        </div>
      )}

      {/* Clarification input */}
      {showClarification && (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <textarea className="w-full border border-purple-200 rounded-xl px-3 py-2 text-sm" placeholder="Enter clarification question..."
            rows={2} value={clarificationText} onChange={e => setClarificationText(e.target.value)} autoFocus />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-10" onClick={() => { setShowClarification(false); setClarificationText(''); }}>Cancel</Button>
            <Button size="sm" className="h-10 bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => { onAction(it.id, { item_status: 'Clarification Requested', remarks: `${it.remarks ? it.remarks + ' | ' : ''}Clarification: ${clarificationText}` }); setShowClarification(false); setClarificationText(''); }}
              disabled={!clarificationText.trim() || !!acting}>Send Clarification</Button>
          </div>
        </div>
      )}

      {/* Add comment link */}
      <div className="flex justify-end">
        {!showComment ? (
          <button onClick={() => setShowComment(true)} className="text-sm text-blue-600 font-medium flex items-center gap-1 hover:text-blue-700">
            <MessageSquare className="w-3.5 h-3.5" /> Add comment
          </button>
        ) : (
          <div className="w-full space-y-2 border-t border-slate-100 pt-2">
            <textarea className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" placeholder="Add a comment..."
              rows={2} value={comment} onChange={e => setComment(e.target.value)} autoFocus />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" className="h-9" onClick={() => { setShowComment(false); setComment(''); }}>Cancel</Button>
              <Button size="sm" className="h-9" onClick={submitComment} disabled={!comment.trim()}>Post Comment</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}