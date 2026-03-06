import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, ClipboardCheck } from 'lucide-react';
import { logPurchaseAudit } from './purchaseHelpers';

/**
 * Reusable approve/reject panel used in both Inbox and detail views.
 * Props: docType (MR/PO), doc (record), user, onDone()
 */
export default function ApprovalActionPanel({ docType, doc, user, onDone }) {
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [acting, setActing] = useState(false);
  const [checklistConfig, setChecklistConfig] = useState(null);
  const [checklistDone, setChecklistDone] = useState(false);

  useEffect(() => {
    base44.entities.WorkflowChecklistConfig.filter({ doc_type: docType, step: 'APPROVAL', is_active: true })
      .then(r => setChecklistConfig(r[0] || null))
      .catch(() => {});
  }, [docType]);

  async function approve() {
    setActing(true);
    const now = new Date().toISOString();
    const Entity = docType === 'MR' ? base44.entities.PurchaseRequest : base44.entities.PurchaseOrder;
    const idField = docType === 'MR' ? 'mr_id' : 'po_id';
    await Entity.update(doc.id, { status: 'APPROVED', approved_by: user?.email, approved_at: now });
    await logPurchaseAudit({
      action: `${docType} ${doc[idField]} APPROVED`,
      entity_type: docType === 'MR' ? 'PurchaseRequest' : 'PurchaseOrder',
      entity_id: doc[idField], user,
    });
    setActing(false);
    onDone();
  }

  async function reject() {
    if (!rejectReason.trim()) return;
    setActing(true);
    const now = new Date().toISOString();
    const Entity = docType === 'MR' ? base44.entities.PurchaseRequest : base44.entities.PurchaseOrder;
    const idField = docType === 'MR' ? 'mr_id' : 'po_id';
    await Entity.update(doc.id, {
      status: 'REJECTED',
      rejection_reason: rejectReason,
      rejected_by: user?.email,
      rejected_at: now,
    });
    await logPurchaseAudit({
      action: `${docType} ${doc[idField]} REJECTED — ${rejectReason}`,
      entity_type: docType === 'MR' ? 'PurchaseRequest' : 'PurchaseOrder',
      entity_id: doc[idField], user, extra: rejectReason,
    });
    setActing(false);
    onDone();
  }

  const needsChecklist = checklistConfig && !checklistDone;

  return (
    <div className="space-y-2">
      {/* Checklist gate */}
      {checklistConfig && !checklistDone && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-700 text-sm font-semibold">
            <ClipboardCheck className="w-4 h-4" />
            Checklist required before approval
          </div>
          <Button size="sm" onClick={() => setChecklistDone(true)} className="bg-blue-600 hover:bg-blue-700 h-7 text-xs">
            Mark Done
          </Button>
        </div>
      )}

      {!showReject ? (
        <div className="flex gap-2">
          <Button onClick={approve} disabled={acting || needsChecklist}
            className="flex-1 bg-green-600 hover:bg-green-700 h-10 font-bold">
            {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : '✓ Approve'}
          </Button>
          <Button variant="outline" onClick={() => setShowReject(true)}
            className="flex-1 border-red-200 text-red-600 h-10 font-bold hover:bg-red-50">
            ✗ Reject
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            placeholder="Rejection reason (mandatory)…" rows={2}
            value={rejectReason} onChange={e => setRejectReason(e.target.value)} autoFocus
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setShowReject(false); setRejectReason(''); }} className="flex-1 h-9">Cancel</Button>
            <Button onClick={reject} disabled={acting || !rejectReason.trim()} className="flex-1 bg-red-600 hover:bg-red-700 h-9 font-bold">
              {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Reject'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}