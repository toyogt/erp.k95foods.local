import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { STATUS_COLOR, logPurchaseAudit } from './purchaseHelpers';
import ApprovalActionPanel from './ApprovalActionPanel';
import POSharePanel from './POSharePanel';
import WorkflowBanner from './WorkflowBanner';

export default function POList({ user, isManager }) {
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [items, setItems] = useState({});
  const [suppliers, setSuppliers] = useState({});
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

  async function loadSupplier(po) {
    if (!po.supplier_id || suppliers[po.supplier_id]) return;
    const supp = await base44.entities.Supplier.filter({ supplier_id: po.supplier_id });
    if (supp[0]) setSuppliers(prev => ({ ...prev, [po.supplier_id]: supp[0] }));
  }

  function toggleExpand(po) {
    if (expanded === po.po_id) { setExpanded(null); return; }
    setExpanded(po.po_id);
    loadItems(po.po_id);
    loadSupplier(po);
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
          <button onClick={() => toggleExpand(po)} className="w-full text-left p-4 flex items-center justify-between">
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
              {/* Workflow banner */}
              <WorkflowBanner docType="PO" status={po.status} />

              {/* Items */}
              {(items[po.po_id] || []).map((it, i) => (
                <div key={i} className="flex justify-between text-sm py-1.5 px-2 bg-slate-50 rounded-lg">
                  <span className="font-medium">{it.item_name || it.item_code}</span>
                  <span className="text-slate-500">{it.qty} {it.uom_code} @ ₹{it.rate} = ₹{it.amount}</span>
                </div>
              ))}
              {po.terms && <p className="text-xs text-slate-400 italic">{po.terms}</p>}
              {po.rejection_reason && <p className="text-xs text-red-600">Rejected: {po.rejection_reason}</p>}
              {po.supplier_override_reason && <p className="text-xs text-amber-600">Override: {po.supplier_override_reason}</p>}
              {po.approved_by && <p className="text-xs text-green-600">Approved by: {po.approved_by}</p>}

              {/* Share panel */}
              <POSharePanel
                po={po} poItems={items[po.po_id] || []}
                supplier={suppliers[po.supplier_id]}
                user={user}
                onStatusChanged={load}
              />

              {/* Approve/reject */}
              {isManager && po.status === 'SUBMITTED' && (
                <ApprovalActionPanel docType="PO" doc={po} user={user} onDone={load} />
              )}

              {/* Status progression */}
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