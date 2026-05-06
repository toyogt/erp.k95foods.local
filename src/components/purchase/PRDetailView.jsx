import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, CheckCircle2, X, Camera, MessageSquare, Image } from 'lucide-react';
import { PR_STATUS_COLOR, PRIORITY_COLOR, formatDateDDMMYYYY, logPurchaseAudit } from './purchaseHelpers';

const ITEM_STATUS_COLOR = {
  Pending: 'bg-amber-100 text-amber-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  'Sample Photo Requested': 'bg-purple-100 text-purple-700',
  'Clarification Requested': 'bg-blue-100 text-blue-700',
};

export default function PRDetailView({ pr, user, isManager, onBack, onRefresh, showApprovalActions }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingItemId, setRejectingItemId] = useState(null);
  const [clarificationItemId, setClarificationItemId] = useState(null);
  const [clarificationText, setClarificationText] = useState('');

  const loadItems = useCallback(async () => {
    const prKey = pr.pr_number || pr.mr_id;
    if (!prKey) { setLoading(false); return; }
    const [byPr, byMr] = await Promise.all([
      pr.pr_number ? base44.entities.PurchaseRequestItem.filter({ pr_number: pr.pr_number }, 'line_number', 100).catch(() => []) : Promise.resolve([]),
      pr.mr_id ? base44.entities.PurchaseRequestItem.filter({ mr_id: pr.mr_id }, 'line_number', 100).catch(() => []) : Promise.resolve([]),
    ]);
    setItems(byPr.length > 0 ? byPr : byMr);
    setLoading(false);
  }, [pr]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const isPending = pr.status === 'Pending Approval' || pr.status === 'SUBMITTED';
  const canApprove = showApprovalActions && isManager && isPending;

  async function approveItem(item) {
    setActing(item.id);
    await base44.entities.PurchaseRequestItem.update(item.id, { item_status: 'Approved' });
    await loadItems();
    setActing(null);
  }

  async function rejectItem(item) {
    if (!rejectReason.trim()) return;
    setActing(item.id);
    await base44.entities.PurchaseRequestItem.update(item.id, { item_status: 'Rejected', remarks: `${item.remarks ? item.remarks + ' | ' : ''}Rejected: ${rejectReason}` });
    setRejectingItemId(null);
    setRejectReason('');
    await loadItems();
    setActing(null);
  }

  async function requestSamplePhoto(item) {
    setActing(item.id);
    await base44.entities.PurchaseRequestItem.update(item.id, { item_status: 'Sample Photo Requested' });
    await loadItems();
    setActing(null);
  }

  async function sendClarification(item) {
    if (!clarificationText.trim()) return;
    setActing(item.id);
    await base44.entities.PurchaseRequestItem.update(item.id, {
      item_status: 'Clarification Requested',
      remarks: `${item.remarks ? item.remarks + ' | ' : ''}Clarification: ${clarificationText}`,
    });
    setClarificationItemId(null);
    setClarificationText('');
    await loadItems();
    setActing(null);
  }

  async function approvePR() {
    setActing('pr-approve');
    await base44.entities.PurchaseRequest.update(pr.id, {
      status: 'Approved',
      approved_by: user?.email || '',
      approved_at: new Date().toISOString(),
    });
    await logPurchaseAudit({ action: `Purchase Request ${pr.pr_number || pr.mr_id} approved`, entity_type: 'PurchaseRequest', entity_id: pr.pr_number || pr.mr_id, user });
    setActing(null);
    if (onRefresh) onRefresh();
  }

  async function rejectPR() {
    if (!rejectReason.trim()) { setRejectingItemId('pr'); return; }
    setActing('pr-reject');
    await base44.entities.PurchaseRequest.update(pr.id, {
      status: 'Rejected',
      rejection_reason: rejectReason,
      rejected_by: user?.email || '',
      rejected_at: new Date().toISOString(),
    });
    await logPurchaseAudit({ action: `Purchase Request ${pr.pr_number || pr.mr_id} rejected: ${rejectReason}`, entity_type: 'PurchaseRequest', entity_id: pr.pr_number || pr.mr_id, user });
    setRejectingItemId(null);
    setRejectReason('');
    setActing(null);
    if (onRefresh) onRefresh();
  }

  return (
    <div className="space-y-4">
      {/* Back link */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <button onClick={onBack} className="text-blue-600 font-medium text-sm flex items-center gap-1 hover:text-blue-700">
          <ArrowLeft className="w-4 h-4" /> Back to List
        </button>

        {/* Header */}
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold text-slate-900">{pr.pr_number || pr.mr_id}</h2>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${PR_STATUS_COLOR[pr.status] || 'bg-slate-100 text-slate-600'}`}>
            {pr.status}
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_COLOR[pr.priority] || 'bg-slate-100 text-slate-600'}`}>
            {pr.priority || 'Medium'}
          </span>
        </div>
        <p className="text-sm text-slate-600">{pr.title || '—'}</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-xs text-slate-500 font-medium">Date</span>
            <p className="font-medium text-slate-900">{formatDateDDMMYYYY(pr.request_date)}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Department</span>
            <p className="font-medium text-slate-900">{pr.department || '—'}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Requested By</span>
            <p className="font-medium text-slate-900">{pr.requested_by_name || pr.requested_by || '—'}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Required By</span>
            <p className="font-medium text-slate-900">{formatDateDDMMYYYY(pr.required_by_date)}</p>
          </div>
        </div>

        {pr.overall_remarks && (
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Remarks</p>
            <p className="text-sm text-slate-700">{pr.overall_remarks}</p>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div>
        <h3 className="font-semibold text-slate-900 mb-3">Line Items ({items.length})</h3>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm bg-white border border-slate-200 rounded-2xl">No items found</div>
        ) : (
          <div className="space-y-3">
            {items.map((it, i) => (
              <div key={it.id || i} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                {/* Item header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900">#{it.line_number || i + 1}</span>
                      <span className="text-sm font-bold text-slate-900">{it.item_name || it.item_code}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ITEM_STATUS_COLOR[it.item_status] || 'bg-slate-100 text-slate-600'}`}>
                        {it.item_status || 'Pending'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">
                      Quantity: <strong>{it.qty || it.quantity || 0}</strong> {it.unit || it.uom_code || 'piece'}
                    </p>
                    {it.estimated_rate > 0 && (
                      <p className="text-xs text-slate-500 mt-0.5">Estimated Rate: ₹{it.estimated_rate}</p>
                    )}
                  </div>
                  {it.sample_image && (
                    <a href={it.sample_image} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      <img src={it.sample_image} alt="Sample" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
                    </a>
                  )}
                </div>

                {/* Sample photo submitted indicator */}
                {it.sample_image && (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-700 font-medium">Sample photo submitted</span>
                    <a href={it.sample_image} target="_blank" rel="noopener noreferrer" className="ml-auto">
                      <Image className="w-5 h-5 text-green-600" />
                    </a>
                  </div>
                )}

                {/* Remarks */}
                {it.remarks && (
                  <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">{it.remarks}</p>
                )}

                {/* Action buttons per item */}
                {canApprove && (it.item_status === 'Pending' || !it.item_status) && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="h-10 px-4 bg-green-600 hover:bg-green-700 text-white font-bold gap-1.5"
                      onClick={() => approveItem(it)}
                      disabled={acting === it.id}
                    >
                      {acting === it.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-10 px-4 border-red-300 text-red-600 hover:bg-red-50 font-bold gap-1.5"
                      onClick={() => setRejectingItemId(it.id)}
                      disabled={!!acting}
                    >
                      <X className="w-4 h-4" /> Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-10 px-4 border-orange-300 text-orange-600 hover:bg-orange-50 font-bold gap-1.5"
                      onClick={() => requestSamplePhoto(it)}
                      disabled={!!acting}
                    >
                      <Camera className="w-4 h-4" /> Request Sample Photo
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-10 px-4 border-purple-300 text-purple-600 hover:bg-purple-50 font-bold gap-1.5"
                      onClick={() => setClarificationItemId(it.id)}
                      disabled={!!acting}
                    >
                      <MessageSquare className="w-4 h-4" /> Clarification
                    </Button>
                  </div>
                )}

                {/* Reject reason input */}
                {rejectingItemId === it.id && (
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <textarea
                      className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm"
                      placeholder="Reason for rejection..."
                      rows={2} value={rejectReason} onChange={e => setRejectReason(e.target.value)} autoFocus
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="h-10" onClick={() => { setRejectingItemId(null); setRejectReason(''); }}>Cancel</Button>
                      <Button size="sm" className="h-10 bg-red-600 hover:bg-red-700 text-white" onClick={() => rejectItem(it)} disabled={!rejectReason.trim() || !!acting}>
                        Confirm Reject
                      </Button>
                    </div>
                  </div>
                )}

                {/* Clarification input */}
                {clarificationItemId === it.id && (
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <textarea
                      className="w-full border border-purple-200 rounded-xl px-3 py-2 text-sm"
                      placeholder="Enter clarification question..."
                      rows={2} value={clarificationText} onChange={e => setClarificationText(e.target.value)} autoFocus
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="h-10" onClick={() => { setClarificationItemId(null); setClarificationText(''); }}>Cancel</Button>
                      <Button size="sm" className="h-10 bg-purple-600 hover:bg-purple-700 text-white" onClick={() => sendClarification(it)} disabled={!clarificationText.trim() || !!acting}>
                        Send Clarification
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PR-Level Approve / Reject */}
      {canApprove && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-900">Full Request Actions</p>
          {rejectingItemId === 'pr' ? (
            <div className="space-y-2">
              <textarea
                className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm"
                placeholder="Reason for rejecting entire request..."
                rows={2} value={rejectReason} onChange={e => setRejectReason(e.target.value)} autoFocus
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-11" onClick={() => { setRejectingItemId(null); setRejectReason(''); }}>Cancel</Button>
                <Button className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white font-bold" onClick={rejectPR} disabled={!rejectReason.trim() || !!acting}>
                  Confirm Reject Request
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-white font-bold" onClick={approvePR} disabled={!!acting}>
                {acting === 'pr-approve' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Approve Entire Request
              </Button>
              <Button variant="outline" className="flex-1 h-11 border-red-300 text-red-600 hover:bg-red-50 font-bold" onClick={() => setRejectingItemId('pr')} disabled={!!acting}>
                <X className="w-4 h-4 mr-2" /> Reject Entire Request
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}