import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, ClipboardCheck } from 'lucide-react';
import { logPurchaseAudit } from './purchaseHelpers';
import { fireFMSEvent, findFMSInstanceByRef, linkFMSRef } from '@/lib/useFMSAutoComplete';

/**
 * Reusable approve/reject panel — actions driven by DocumentApprovalRule entity.
 * Props: docType (entity name e.g. "PurchaseRequest"), doc, user, onDone()
 */
export default function ApprovalActionPanel({ docType, doc, user, onDone }) {
  const [actions, setActions] = useState([]);
  const [acting, setActing] = useState(null); // toState being processed
  const [reason, setReason] = useState('');
  const [pendingAction, setPendingAction] = useState(null); // action awaiting reason
  const [checklistDone, setChecklistDone] = useState(false);
  const [checklistConfig, setChecklistConfig] = useState(null);
  const [loadingActions, setLoadingActions] = useState(true);

  // Legacy docType short codes → entity names
  const resolvedDocType = docType === 'MR' ? 'PurchaseRequest' : docType === 'PO' ? 'PurchaseOrder' : docType;
  const idField = docType === 'MR' ? 'mr_id' : docType === 'PO' ? 'po_id' : 'id';
  const currentState = doc?.status;

  useEffect(() => {
    if (!user || !currentState) { setLoadingActions(false); return; }

    Promise.all([
      base44.entities.DocumentApprovalRule.filter({
        doc_type: resolvedDocType,
        from_state: currentState,
        is_active: true,
      }),
      base44.entities.WorkflowChecklistConfig.filter({ doc_type: docType, step: 'APPROVAL', is_active: true }).catch(() => []),
    ]).then(([rules, checklists]) => {
      // Filter to only what user's role can do (admin always can)
      const allowed = user.role === 'admin'
        ? rules
        : rules.filter(r => (r.allowed_roles || []).includes(user.role));
      setActions(allowed.sort((a, b) => (a.sort_order || 10) - (b.sort_order || 10)));
      setChecklistConfig(checklists[0] || null);
      setLoadingActions(false);
    });
  }, [user, resolvedDocType, currentState, docType]);

  async function performAction(action) {
    if (action.require_reason && !reason.trim()) {
      setPendingAction(action);
      return;
    }
    setActing(action.to_state);
    const now = new Date().toISOString();
    const Entity = resolvedDocType === 'PurchaseRequest'
      ? base44.entities.PurchaseRequest
      : resolvedDocType === 'PurchaseOrder'
      ? base44.entities.PurchaseOrder
      : null;

    const updatePayload = {
      status: action.to_state,
      ...(action.to_state === 'APPROVED' ? { approved_by: user?.email, approved_at: now } : {}),
      ...(action.to_state === 'REJECTED' ? { rejection_reason: reason, rejected_by: user?.email, rejected_at: now } : {}),
    };

    if (Entity) {
      await Entity.update(doc.id, updatePayload);
      await logPurchaseAudit({
        action: `${docType} ${doc[idField]} → ${action.to_state}${reason ? ' — ' + reason : ''}`,
        entity_type: resolvedDocType,
        entity_id: doc[idField],
        user,
      });
    }

    // FMS events
    if (resolvedDocType === 'PurchaseOrder' && action.to_state === 'APPROVED') {
      await fireFMSEvent('purchase_order_approved', doc.id);
    }

    setActing(null);
    setPendingAction(null);
    setReason('');
    onDone();
  }

  const needsChecklist = checklistConfig && !checklistDone;

  if (loadingActions) return <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-slate-300" /></div>;

  if (actions.length === 0) {
    return (
      <p className="text-xs text-slate-400 italic">
        No actions available for your role on this document.
      </p>
    );
  }

  const ACTION_CLS = {
    approve: 'flex-1 bg-green-600 hover:bg-green-700 text-white h-11 font-bold',
    reject:  'flex-1 bg-red-600 hover:bg-red-700 text-white h-11 font-bold',
    neutral: 'flex-1 border border-slate-300 text-slate-700 h-11 font-bold',
  };

  return (
    <div className="space-y-2">
      {/* Checklist gate */}
      {checklistConfig && !checklistDone && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-700 text-sm font-semibold">
            <ClipboardCheck className="w-4 h-4" />
            Checklist required before approval
          </div>
          <Button size="sm" onClick={() => setChecklistDone(true)} className="bg-blue-600 hover:bg-blue-700 h-8 text-xs">
            Mark Done
          </Button>
        </div>
      )}

      {/* Reason input (shown when an action requiring reason is clicked) */}
      {pendingAction && (
        <div className="space-y-2">
          <textarea
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            placeholder={`Reason required for "${pendingAction.action_label}"…`}
            rows={2} value={reason} onChange={e => setReason(e.target.value)} autoFocus
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 h-11" onClick={() => { setPendingAction(null); setReason(''); }}>Cancel</Button>
            <Button
              className={`flex-1 h-11 font-bold ${pendingAction.action_style === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
              onClick={() => performAction(pendingAction)}
              disabled={!reason.trim() || !!acting}
            >
              {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : `Confirm ${pendingAction.action_label}`}
            </Button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!pendingAction && (
        <div className="flex gap-2 flex-wrap">
          {actions.map(action => (
            <Button
              key={action.to_state}
              className={ACTION_CLS[action.action_style] || ACTION_CLS.neutral}
              disabled={!!acting || needsChecklist}
              onClick={() => performAction(action)}
            >
              {acting === action.to_state
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : action.action_label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}