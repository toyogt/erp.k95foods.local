import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, CheckCircle2, X, ArrowRight, AlertTriangle } from 'lucide-react';
import { PR_STATUS_COLOR, PRIORITY_COLOR, formatDateDDMMYYYY, logPurchaseAudit } from './purchaseHelpers';
import PRItemApprovalCard from './PRItemApprovalCard';
import PRQuotationPanel from './PRQuotationPanel';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

export default function PRDetailView({ pr, user, isManager, onBack, onRefresh, showApprovalActions }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [expectedDelivery, setExpectedDelivery] = useState(pr.expected_delivery_date || '');
  const [urgencyOverride, setUrgencyOverride] = useState(pr.urgency_override || '');
  const [internalNotes, setInternalNotes] = useState(pr.internal_notes || '');
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

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

  // Check for existing Purchase Order
  const prKey = pr.pr_number || pr.mr_id;
  const { data: existingPOs = [] } = useQuery({
    queryKey: ['pr-existing-po', prKey],
    queryFn: () => base44.entities.PurchaseOrder.filter({ pr_number: prKey }, '-created_date', 5).catch(() => []),
    staleTime: 30000, enabled: !!prKey,
  });
  const hasPO = existingPOs.length > 0;

  const isPending = pr.status === 'Pending Approval' || pr.status === 'SUBMITTED';
  const isApproved = ['Approved', 'APPROVED', 'Partially Approved'].includes(pr.status);
  const canApprove = showApprovalActions && isManager && isPending;
  const isRequester = pr.requested_by === user?.email;

  const actionRequiredItems = items.filter(it => it.item_status === 'Sample Photo Requested' || it.item_status === 'Clarification Requested');
  const hasActionRequired = isRequester && actionRequiredItems.length > 0;

  async function handleItemAction(itemId, updates) {
    setActing(itemId);
    await base44.entities.PurchaseRequestItem.update(itemId, updates);
    await loadItems();
    setActing(null);
  }

  async function saveManagerFields() {
    const updates = {};
    if (expectedDelivery) updates.expected_delivery_date = expectedDelivery;
    if (urgencyOverride) updates.urgency_override = urgencyOverride;
    if (internalNotes) updates.internal_notes = internalNotes;
    if (Object.keys(updates).length > 0) {
      await base44.entities.PurchaseRequest.update(pr.id, updates);
    }
  }

  async function approveAll() {
    setActing('pr-approve');
    await saveManagerFields();
    await Promise.all(items.filter(it => it.item_status === 'Pending' || !it.item_status).map(it =>
      base44.entities.PurchaseRequestItem.update(it.id, { item_status: 'Approved' })
    ));
    await base44.entities.PurchaseRequest.update(pr.id, { status: 'Approved', approved_by: user?.email || '', approved_at: new Date().toISOString() });
    await logPurchaseAudit({ action: `Purchase Request ${prKey} approved (all items)`, action_type: 'approve', entity_type: 'PurchaseRequest', entity_id: prKey, user });
    setActing(null);
    if (onRefresh) onRefresh();
  }

  async function partiallyApprove() {
    setActing('pr-partial');
    await saveManagerFields();
    await base44.entities.PurchaseRequest.update(pr.id, { status: 'Partially Approved', approved_by: user?.email || '', approved_at: new Date().toISOString() });
    await logPurchaseAudit({ action: `Purchase Request ${prKey} partially approved`, action_type: 'approve', entity_type: 'PurchaseRequest', entity_id: prKey, user });
    setActing(null);
    if (onRefresh) onRefresh();
  }

  async function rejectAll() {
    if (!rejectReason.trim()) return;
    setActing('pr-reject');
    await saveManagerFields();
    await base44.entities.PurchaseRequest.update(pr.id, { status: 'Rejected', rejection_reason: rejectReason, rejected_by: user?.email || '', rejected_at: new Date().toISOString() });
    await logPurchaseAudit({ action: `Purchase Request ${prKey} rejected: ${rejectReason}`, action_type: 'reject', entity_type: 'PurchaseRequest', entity_id: prKey, user, extra: rejectReason });
    setActing(null);
    setShowReject(false);
    if (onRefresh) onRefresh();
  }

  const approvalStamp = pr.approved_by && pr.approved_at
    ? `Approved by ${pr.approved_by} — ${formatDateDDMMYYYY(pr.approved_at)}`
    : pr.rejected_by && pr.rejected_at
      ? `Rejected by ${pr.rejected_by} — ${formatDateDDMMYYYY(pr.rejected_at)}`
      : null;

  return (
    <div className="space-y-5">
      {hasActionRequired && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800">Action Required</p>
            <p className="text-sm text-amber-700">{actionRequiredItems.length} item(s) need your response — sample photo or clarification requested by the approver.</p>
          </div>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <button onClick={onBack} className="text-blue-600 font-medium text-sm flex items-center gap-1 hover:text-blue-700"><ArrowLeft className="w-4 h-4" /> Back to List</button>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold text-slate-900">{prKey}</h2>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${PR_STATUS_COLOR[pr.status] || 'bg-slate-100 text-slate-600'}`}>{pr.status}</span>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${PRIORITY_COLOR[pr.priority] || 'bg-slate-100 text-slate-600'}`}>{pr.priority || 'Medium'}</span>
        </div>
        <p className="text-sm text-slate-600">{pr.title || '—'}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-xs text-slate-500 font-medium">Date</span><p className="font-medium text-slate-900">{formatDateDDMMYYYY(pr.request_date)}</p></div>
          <div><span className="text-xs text-slate-500 font-medium">Department</span><p className="font-medium text-slate-900">{pr.department || '—'}</p></div>
          <div><span className="text-xs text-slate-500 font-medium">Requested By</span><p className="font-medium text-slate-900">{pr.requested_by_name || pr.requested_by || '—'}</p></div>
          <div><span className="text-xs text-slate-500 font-medium">Required By</span><p className="font-medium text-slate-900">{formatDateDDMMYYYY(pr.required_by_date)}</p></div>
        </div>
        {approvalStamp && <p className={`text-xs font-medium ${pr.rejected_by ? 'text-red-600' : 'text-green-600'}`}>{approvalStamp}</p>}
        {pr.rejection_reason && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2"><p className="text-xs text-red-500 mb-0.5">Rejection Reason</p><p className="text-sm text-red-700">{pr.rejection_reason}</p></div>
        )}
        {pr.overall_remarks && (
          <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500 mb-1">Remarks</p><p className="text-sm text-slate-700">{pr.overall_remarks}</p></div>
        )}
        {pr.supporting_documents?.length > 0 && (
          <div className="flex flex-wrap gap-2">{pr.supporting_documents.map((doc, i) => <a key={i} href={doc} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">Document {i + 1}</a>)}</div>
        )}
      </div>

      {/* Manager Fields */}
      {canApprove && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-700">Manager Review Fields</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label className="text-xs font-medium text-slate-700">Expected Delivery Date</label><input type="date" className="w-full h-11 md:h-9 border border-slate-200 rounded-xl px-3 text-sm mt-1" value={expectedDelivery} onChange={e => setExpectedDelivery(e.target.value)} /></div>
            <div><label className="text-xs font-medium text-slate-700">Urgency Override</label><select className="w-full h-11 md:h-9 border border-slate-200 rounded-xl px-3 text-sm bg-white mt-1" value={urgencyOverride} onChange={e => setUrgencyOverride(e.target.value)}><option value="">No Override</option><option value="Normal">Normal</option><option value="Expedite">Expedite</option><option value="Critical">Critical</option></select></div>
          </div>
          <div><label className="text-xs font-medium text-slate-700">Internal Notes</label><textarea rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1 resize-none" value={internalNotes} onChange={e => setInternalNotes(e.target.value)} placeholder="Internal notes (not visible to requester)" /></div>
        </div>
      )}

      {/* Line Items */}
      <div className="space-y-3">
        <h3 className="font-semibold text-slate-900">Line Items ({items.length})</h3>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm bg-white border border-slate-200 rounded-2xl">No items found</div>
        ) : (
          <div className="space-y-3">
            {items.map((it, i) => (
              <PRItemApprovalCard key={it.id || i} item={it} index={i} canApprove={canApprove} isRequester={isRequester}
                acting={acting} onAction={handleItemAction} loadItems={loadItems} user={user} prNumber={prKey} />
            ))}
          </div>
        )}
      </div>

      {/* Quotation Panel */}
      {showApprovalActions && isApproved && items.length > 0 && (
        <PRQuotationPanel prNumber={prKey} items={items} user={user} />
      )}

      {/* Continue to Purchase Order */}
      {isApproved && !hasPO && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <Link to={`/PurchaseOrderCreate?pr=${prKey}`}>
            <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base gap-2">
              Continue to Purchase Order <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      )}

      {/* Approve / Reject Actions */}
      {canApprove && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-900">Full Request Actions</p>
          {showReject ? (
            <div className="space-y-2">
              <textarea className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm" placeholder="Reason for rejecting entire request..." rows={2} value={rejectReason} onChange={e => setRejectReason(e.target.value)} autoFocus />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-11" onClick={() => { setShowReject(false); setRejectReason(''); }}>Cancel</Button>
                <Button className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white font-bold" onClick={rejectAll} disabled={!rejectReason.trim() || !!acting}>Confirm Reject</Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <Button className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-white font-bold" onClick={approveAll} disabled={!!acting}>
                {acting === 'pr-approve' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} Approve All
              </Button>
              <Button variant="outline" className="h-11 font-bold" onClick={partiallyApprove} disabled={!!acting}>
                Partially Approve
              </Button>
              <Button variant="outline" className="h-11 border-red-300 text-red-600 hover:bg-red-50 font-bold" onClick={() => setShowReject(true)} disabled={!!acting}>
                <X className="w-4 h-4 mr-2" /> Reject All
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}