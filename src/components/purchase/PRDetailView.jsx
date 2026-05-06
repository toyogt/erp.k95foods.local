import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, CheckCircle2, X, Camera, MessageSquare, Image as ImageIcon, ArrowRight, AlertTriangle, Upload } from 'lucide-react';
import { PR_STATUS_COLOR, PRIORITY_COLOR, formatDateDDMMYYYY, logPurchaseAudit } from './purchaseHelpers';
import PRDetailItemCard from './PRDetailItemCard';
import PRDetailActions from './PRDetailActions';
import { Link } from 'react-router-dom';

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
  const isApproved = ['Approved', 'APPROVED', 'Partially Approved'].includes(pr.status);
  const canApprove = showApprovalActions && isManager && isPending;
  const isRequester = pr.requested_by === user?.email;

  // Check if any items need action from the requester
  const actionRequiredItems = items.filter(it =>
    it.item_status === 'Sample Photo Requested' || it.item_status === 'Clarification Requested'
  );
  const hasActionRequired = isRequester && actionRequiredItems.length > 0;

  // Item-level action handlers
  async function handleItemAction(itemId, updates) {
    setActing(itemId);
    await base44.entities.PurchaseRequestItem.update(itemId, updates);
    await loadItems();
    setActing(null);
  }

  // PR-level action handlers
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

  async function rejectPR(reason) {
    setActing('pr-reject');
    await base44.entities.PurchaseRequest.update(pr.id, {
      status: 'Rejected',
      rejection_reason: reason,
      rejected_by: user?.email || '',
      rejected_at: new Date().toISOString(),
    });
    await logPurchaseAudit({ action: `Purchase Request ${pr.pr_number || pr.mr_id} rejected: ${reason}`, entity_type: 'PurchaseRequest', entity_id: pr.pr_number || pr.mr_id, user });
    setActing(null);
    if (onRefresh) onRefresh();
  }

  const approvalStamp = pr.approved_by && pr.approved_at
    ? `Approved by ${pr.approved_by} — ${formatDateDDMMYYYY(pr.approved_at)}${pr.approved_at?.includes('T') ? ' ' + new Date(pr.approved_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}`
    : pr.rejected_by && pr.rejected_at
      ? `Rejected by ${pr.rejected_by} — ${formatDateDDMMYYYY(pr.rejected_at)}`
      : null;

  return (
    <div className="space-y-5">
      {/* Action Required Banner */}
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
        <button onClick={onBack} className="text-blue-600 font-medium text-sm flex items-center gap-1 hover:text-blue-700">
          <ArrowLeft className="w-4 h-4" /> Back to List
        </button>

        {/* Title row */}
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold text-slate-900">{pr.pr_number || pr.mr_id}</h2>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${PR_STATUS_COLOR[pr.status] || 'bg-slate-100 text-slate-600'}`}>
            {pr.status}
          </span>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${PRIORITY_COLOR[pr.priority] || 'bg-slate-100 text-slate-600'}`}>
            {pr.priority || 'Medium'}
          </span>
        </div>

        {/* Requester name */}
        <p className="text-sm text-slate-600">{pr.title || '—'}</p>

        {/* Metadata grid */}
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

        {/* Approval / rejection stamp */}
        {approvalStamp && (
          <p className={`text-xs font-medium ${pr.rejected_by ? 'text-red-600' : 'text-green-600'}`}>
            {approvalStamp}
          </p>
        )}

        {/* Rejection reason */}
        {pr.rejection_reason && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <p className="text-xs text-red-500 mb-0.5">Rejection Reason</p>
            <p className="text-sm text-red-700">{pr.rejection_reason}</p>
          </div>
        )}

        {/* Overall remarks */}
        {pr.overall_remarks && (
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Remarks</p>
            <p className="text-sm text-slate-700">{pr.overall_remarks}</p>
          </div>
        )}
      </div>

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
              <PRDetailItemCard
                key={it.id || i}
                item={it}
                index={i}
                canApprove={canApprove}
                isRequester={isRequester}
                acting={acting}
                onAction={handleItemAction}
                loadItems={loadItems}
                user={user}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quotation & Sample Stage + Continue to PO */}
      {isApproved && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Quotation & Sample Stage</h3>
            <Button variant="outline" size="sm" className="h-9 text-sm" disabled>
              Manage Quotations
            </Button>
          </div>
          <Link to={`/PurchaseOrderCreate?pr=${pr.pr_number || pr.mr_id}`}>
            <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base gap-2">
              Continue to Purchase Order <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      )}

      {/* PR-Level Approve / Reject */}
      {canApprove && (
        <PRDetailActions
          acting={acting}
          onApprove={approvePR}
          onReject={rejectPR}
        />
      )}
    </div>
  );
}

export { ITEM_STATUS_COLOR };