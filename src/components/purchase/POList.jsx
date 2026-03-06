import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { STATUS_COLOR, logPurchaseAudit } from './purchaseHelpers';

const PO_STATUS_FLOW = ['DRAFT', 'SUBMITTED', 'APPROVED', 'SENT', 'PART_RECEIVED', 'CLOSED', 'CANCELLED'];

export default function POList({ user, isManager }) {
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [items, setItems] = useState({});
  const [rejectReason, setRejectReason] = useState('');
  const [acting, setActing] = useState(null);

  async function load() {
    setLoading(true);
    const data = await base44.entities.PurchaseOrder.list('-created_date', 100);
    setPos(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function loadItems(poId) {
    if (items[poId]) return;
    const its = await base44.entities.PurchaseOrderItem.filter({ po_id: poId });
    setItems(prev => ({ ...prev, [poId]: its }));
  }

  function toggleExpand(poId) {
    if (expanded === poId) { setExpanded(null); return; }
    setExpanded(poId);
    loadItems(poId);
  }

  async function handleApprove(po) {
    setActing(po.id);
    const now = new Date().toISOString();
    await base44.entities.PurchaseOrder.update(po.id, {
      status: 'APPROVED', approved_by: user?.email, approved_at: now
    });
    await logPurchaseAudit({ action: `PO ${po.po_id} APPROVED`, entity_type: 'PurchaseOrder', entity_id: po.po_id, user });
    setActing(null);
    load();
  }

  async function handleReject(po) {
    if (!rejectReason.trim()) { alert('Enter rejection reason'); return; }
    setActing(po.id);
    await base44.entities.PurchaseOrder.update(po.id, {
      status: 'CANCELLED', rejection_reason: rejectReason
    });
    await logPurchaseAudit({ action: `PO ${po.po_id} REJECTED — ${rejectReason}`, entity_type: 'PurchaseOrder', entity_id: po.po_id, user });
    setRejectReason('');
    setActing(null);
    load();
  }

  async function handleStatusChange(po, newStatus) {
    setActing(po.id);
    await base44.entities.PurchaseOrder.update(po.id, { status: newStatus });
    await logPurchaseAudit({ action: `PO ${po.po_id} → ${newStatus}`, entity_type: 'PurchaseOrder', entity_id: po.po_id, user });
    setActing(null);
    load();
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-3">
      {pos.length === 0 && <p className="text-center text-slate-400 py-8">No purchase orders yet.</p>}
      {pos.map(po => (
        <div key={po.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <button onClick={() => toggleExpand(po.po_id)} className="w-full text-left p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900">{po.po_id}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[po.status] || ''}`}>{po.status}</span>
                {po.mr_id && <span className="text-xs text-slate-400 font-mono">{po.mr_id}</span>}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{po.po_date} · {po.supplier_name} · ₹{Number(po.total_amount || 0).toFixed(0)}</p>
            </div>
            {expanded === po.po_id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {expanded === po.po_id && (
            <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
              {(items[po.po_id] || []).map((it, i) => (
                <div key={i} className="flex justify-between text-sm py-1.5 px-2 bg-slate-50 rounded-lg">
                  <span className="font-medium">{it.item_name || it.item_code}</span>
                  <span className="text-slate-500">{it.qty} {it.uom_code} @ ₹{it.rate} = ₹{it.amount}</span>
                </div>
              ))}
              {po.terms && <p className="text-xs text-slate-400 italic">{po.terms}</p>}
              {po.rejection_reason && <p className="text-xs text-red-600">Reason: {po.rejection_reason}</p>}
              {po.supplier_override_reason && <p className="text-xs text-amber-600">Override: {po.supplier_override_reason}</p>}
              {po.approved_by && <p className="text-xs text-green-600">Approved by: {po.approved_by}</p>}

              {/* Manager approve/reject */}
              {isManager && po.status === 'SUBMITTED' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button onClick={() => handleApprove(po)} disabled={!!acting} className="flex-1 bg-green-600 hover:bg-green-700 h-9">
                      {acting === po.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Approve'}
                    </Button>
                  </div>
                  <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="Rejection reason" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                  {rejectReason && (
                    <Button onClick={() => handleReject(po)} className="w-full bg-red-600 hover:bg-red-700 h-9">Confirm Reject</Button>
                  )}
                </div>
              )}

              {/* Status progression */}
              {isManager && po.status === 'APPROVED' && (
                <div className="flex gap-2">
                  <Button onClick={() => handleStatusChange(po, 'SENT')} disabled={!!acting} className="flex-1 bg-cyan-600 hover:bg-cyan-700 h-9">Mark Sent</Button>
                </div>
              )}
              {isManager && po.status === 'SENT' && (
                <div className="flex gap-2">
                  <Button onClick={() => handleStatusChange(po, 'PART_RECEIVED')} disabled={!!acting} className="flex-1 bg-amber-600 hover:bg-amber-700 h-9">Part Received</Button>
                  <Button onClick={() => handleStatusChange(po, 'CLOSED')} disabled={!!acting} className="flex-1 bg-slate-700 hover:bg-slate-800 h-9">Close PO</Button>
                </div>
              )}
              {isManager && po.status === 'PART_RECEIVED' && (
                <Button onClick={() => handleStatusChange(po, 'CLOSED')} disabled={!!acting} className="w-full bg-slate-700 hover:bg-slate-800 h-9">Mark Fully Received / Close</Button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}