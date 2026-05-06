import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, ChevronRight, MapPin, Phone, Mail, FileText, AlertTriangle, Package } from 'lucide-react';
import { PO_STATUS_COLOR, PO_STATUS_FLOW, getNextPOStatus, formatDateDDMMYYYY, formatINR, logPurchaseAudit } from './purchaseHelpers';
import POGRNHistory from './POGRNHistory';
import POFollowUpList from './POFollowUpList';
import { Link } from 'react-router-dom';

export default function PODetailView({ po, user, isManager, onBack, onRefresh }) {
  const [acting, setActing] = useState(null);
  const [showGRN, setShowGRN] = useState(false);
  const [showFollowUps, setShowFollowUps] = useState(false);
  const queryClient = useQueryClient();

  const { data: poItems = [] } = useQuery({
    queryKey: ['po-detail-items', po.po_id],
    queryFn: () => base44.entities.PurchaseOrderItem.filter({ po_id: po.po_id }, 'line_number', 100),
    staleTime: 20000,
  });

  const nextStatus = getNextPOStatus(po.status);
  const canAdvance = isManager && nextStatus && po.status !== 'Cancelled' && po.status !== 'Delivered';
  const canCancel = isManager && po.status !== 'Cancelled' && po.status !== 'Delivered';

  async function advanceStatus() {
    if (!nextStatus) return;
    setActing('advance');
    await base44.entities.PurchaseOrder.update(po.id, { status: nextStatus });
    await logPurchaseAudit({ action: `Purchase Order ${po.po_id} status changed to ${nextStatus}`, action_type: 'status_change', entity_type: 'PurchaseOrder', entity_id: po.po_id, user });
    setActing(null);
    if (onRefresh) onRefresh();
  }

  async function cancelPO() {
    if (!confirm('Are you sure you want to cancel this Purchase Order?')) return;
    setActing('cancel');
    await base44.entities.PurchaseOrder.update(po.id, { status: 'Cancelled' });
    await logPurchaseAudit({ action: `Purchase Order ${po.po_id} cancelled`, action_type: 'status_change', entity_type: 'PurchaseOrder', entity_id: po.po_id, user });
    setActing(null);
    if (onRefresh) onRefresh();
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-blue-600 font-medium text-sm flex items-center gap-1 hover:text-blue-700"><ArrowLeft className="w-4 h-4" /> Back to List</button>

      {/* Status Flow */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
          {PO_STATUS_FLOW.map((s, i) => {
            const idx = PO_STATUS_FLOW.indexOf(po.status);
            const isCurrent = s === po.status;
            const isPast = i < idx;
            const cls = isCurrent ? 'bg-blue-600 text-white' : isPast ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400';
            return (
              <div key={s} className="flex items-center shrink-0">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${cls}`}>{s}</span>
                {i < PO_STATUS_FLOW.length - 1 && <ChevronRight className="w-3 h-3 text-slate-300 mx-0.5" />}
              </div>
            );
          })}
          {po.status === 'Cancelled' && <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700 ml-2">Cancelled</span>}
        </div>
      </div>

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-xl font-bold text-slate-900">{po.po_id}</h2>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${PO_STATUS_COLOR[po.status] || 'bg-slate-100 text-slate-600'}`}>{po.status}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><span className="text-xs text-slate-500">Date</span><p className="font-medium">{formatDateDDMMYYYY(po.po_date)}</p></div>
          <div><span className="text-xs text-slate-500">Due Date</span><p className="font-medium">{formatDateDDMMYYYY(po.due_date)}</p></div>
          <div><span className="text-xs text-slate-500">Payment Terms</span><p className="font-medium">{po.payment_terms || '—'}</p></div>
          <div><span className="text-xs text-slate-500">Total</span><p className="font-bold text-lg">{formatINR(po.total_amount)}</p></div>
        </div>
        {po.ship_via && <p className="text-xs text-slate-500">Ship Via: {po.ship_via}</p>}
        {(po.estimated_freight > 0 || po.total_freight_paid > 0) && (
          <div className="flex gap-4 text-xs text-slate-500">
            {po.estimated_freight > 0 && <span>Est. Freight: {formatINR(po.estimated_freight)}</span>}
            {po.total_freight_paid > 0 && <span className="text-green-700">Paid Freight: {formatINR(po.total_freight_paid)}</span>}
          </div>
        )}
        {po.pr_number && <p className="text-xs text-slate-500">Source: <Link to={`/PurchaseRequestApprovals`} className="text-blue-600 font-medium">{po.pr_number}</Link></p>}
      </div>

      {/* Supplier Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
        <p className="text-sm font-semibold text-slate-900">Supplier: {po.supplier_name}</p>
        {po.supplier_address && <p className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{po.supplier_address}</p>}
        {po.supplier_gstin && <p className="text-xs text-slate-500">GSTIN: {po.supplier_gstin}</p>}
        {po.supplier_contact && <p className="text-xs text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" />{po.supplier_contact}</p>}
        {po.supplier_email && <p className="text-xs text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" />{po.supplier_email}</p>}
      </div>

      {/* Items Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 font-semibold text-sm text-slate-700">Line Items ({poItems.length})</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-xs text-slate-500">
              <th className="text-left px-3 py-2">Item</th>
              <th className="text-right px-3 py-2">Ordered</th>
              <th className="text-right px-3 py-2">Received</th>
              <th className="text-right px-3 py-2">Pending</th>
              <th className="text-left px-3 py-2">Unit</th>
              <th className="text-right px-3 py-2">Rate</th>
              <th className="text-right px-3 py-2">Amount</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {poItems.map((it, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{it.item_name || it.item_code}</td>
                  <td className="px-3 py-2 text-right">{it.qty || it.quantity || 0}</td>
                  <td className="px-3 py-2 text-right text-green-700 font-medium">{it.received_qty || 0}</td>
                  <td className="px-3 py-2 text-right text-amber-600 font-medium">{it.pending_qty || (it.qty || 0) - (it.received_qty || 0)}</td>
                  <td className="px-3 py-2">{it.uom_code || '—'}</td>
                  <td className="px-3 py-2 text-right">{formatINR(it.rate || it.unit_price)}</td>
                  <td className="px-3 py-2 text-right font-bold">{formatINR(it.amount || it.total_price || (it.rate || 0) * (it.qty || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-slate-50 flex justify-end gap-6 text-sm">
          <span className="text-slate-500">Subtotal: <strong>{formatINR(po.subtotal)}</strong></span>
          <span className="text-slate-500">GST: <strong>{formatINR(po.gst_amount)}</strong></span>
          <span className="font-bold text-slate-900">Total: {formatINR(po.total_amount)}</span>
        </div>
      </div>

      {/* Toggle Sections */}
      <div className="space-y-2">
        <button onClick={() => setShowGRN(!showGRN)} className="w-full text-left bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between hover:bg-slate-50">
          <span className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Package className="w-4 h-4" /> Goods Receipt History</span>
          <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${showGRN ? 'rotate-90' : ''}`} />
        </button>
        {showGRN && <div className="pl-2"><POGRNHistory poId={po.po_id} /></div>}

        <button onClick={() => setShowFollowUps(!showFollowUps)} className="w-full text-left bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between hover:bg-slate-50">
          <span className="text-sm font-semibold text-slate-700 flex items-center gap-2"><FileText className="w-4 h-4" /> Follow-Ups</span>
          <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${showFollowUps ? 'rotate-90' : ''}`} />
        </button>
        {showFollowUps && <div className="pl-2"><POFollowUpList poId={po.po_id} user={user} /></div>}
      </div>

      {/* Actions */}
      {(canAdvance || canCancel) && (
        <div className="flex gap-2">
          {canAdvance && (
            <Button className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 font-bold" onClick={advanceStatus} disabled={!!acting}>
              {acting === 'advance' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Move to: {nextStatus}
            </Button>
          )}
          {canCancel && (
            <Button variant="outline" className="h-11 border-red-300 text-red-600 hover:bg-red-50 font-bold px-6" onClick={cancelPO} disabled={!!acting}>
              {acting === 'cancel' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
              Cancel
            </Button>
          )}
        </div>
      )}
    </div>
  );
}