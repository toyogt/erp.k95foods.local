import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Loader2, Package, CheckCircle2 } from 'lucide-react';
import { genId, formatINR, logPurchaseAudit } from './purchaseHelpers';
import { fireFMSEvent } from '@/lib/useFMSAutoComplete';

export default function POPartialReceive({ po, user, onDone }) {
  const [receiving, setReceiving] = useState({});
  const [freightAmount, setFreightAmount] = useState('');
  const [freightNotes, setFreightNotes] = useState('');
  const [grnNotes, setGrnNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: poItems = [] } = useQuery({
    queryKey: ['po-receive-items', po.po_id],
    queryFn: () => base44.entities.PurchaseOrderItem.filter({ po_id: po.po_id }, 'line_number', 100),
    staleTime: 10000,
  });

  function setQty(itemId, val) {
    setReceiving(prev => ({ ...prev, [itemId]: val }));
  }

  const hasAnyQty = Object.values(receiving).some(v => Number(v) > 0);

  async function handleReceive() {
    if (!hasAnyQty) return;
    setLoading(true);
    const grnId = genId('GRN');
    const freight = Number(freightAmount || 0);

    // Determine if full or partial
    let allFull = true;
    const receivingItems = [];
    for (const it of poItems) {
      const recQty = Number(receiving[it.id] || 0);
      if (recQty <= 0) continue;
      const ordered = it.qty || it.quantity || 0;
      const prevReceived = it.received_qty || 0;
      const newReceived = prevReceived + recQty;
      if (newReceived < ordered) allFull = false;
      receivingItems.push({ ...it, recQty, newReceived, pending: ordered - newReceived });
    }
    if (receivingItems.length === 0) { setLoading(false); return; }

    // Check if ALL items are fully received
    const nonReceivedItems = poItems.filter(it => !receivingItems.find(r => r.id === it.id));
    if (nonReceivedItems.some(it => (it.pending_qty || ((it.qty || 0) - (it.received_qty || 0))) > 0)) allFull = false;

    // Create GRN Header
    await base44.entities.GRNHeader.create({
      grn_id: grnId, po_id: po.po_id, supplier_id: po.supplier_id, supplier_name: po.supplier_name,
      status: 'RECEIVED', received_at: new Date().toISOString(), received_by: user?.email || '',
      notes: grnNotes, freight_amount: freight, freight_notes: freightNotes,
    });

    // Create GRN Items + update PO Items
    await Promise.all(receivingItems.map(async (it) => {
      await base44.entities.GRNItem.create({
        grn_id: grnId, po_id: po.po_id, item_code: it.item_code, item_name: it.item_name,
        ordered_qty: it.qty || it.quantity || 0, received_qty: it.recQty,
      });
      await base44.entities.PurchaseOrderItem.update(it.id, {
        received_qty: it.newReceived, pending_qty: Math.max(0, it.pending),
      });
    }));

    // Update PO status + freight
    const newStatus = allFull ? 'Delivered' : 'Partially Received';
    await base44.entities.PurchaseOrder.update(po.id, {
      status: newStatus,
      total_freight_paid: (po.total_freight_paid || 0) + freight,
    });

    // FMS
    await fireFMSEvent('grn_received', po.id);

    // Audit
    const totalRec = receivingItems.reduce((s, r) => s + r.recQty, 0);
    await logPurchaseAudit({
      action: `${allFull ? 'Full' : 'Partial'} goods received for ${po.po_id} — Goods Receipt Note: ${grnId} (${totalRec} units)`,
      action_type: 'receive', entity_type: 'GRNHeader', entity_id: grnId, user,
    });

    setLoading(false);
    if (onDone) onDone();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-slate-900">Receive Goods for {po.po_id}</p>

      {poItems.map(it => {
        const ordered = it.qty || it.quantity || 0;
        const prevRec = it.received_qty || 0;
        const pending = it.pending_qty || Math.max(0, ordered - prevRec);
        if (pending <= 0) return (
          <div key={it.id} className="border border-green-200 bg-green-50 rounded-xl p-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-800">{it.item_name} — Fully received ({ordered})</span>
          </div>
        );
        return (
          <div key={it.id} className="border border-slate-200 rounded-xl p-3 space-y-2 bg-white">
            <p className="text-sm font-bold text-slate-900">{it.item_name || it.item_code}</p>
            <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">
              <div>Ordered: <strong className="text-slate-800">{ordered}</strong></div>
              <div>Received: <strong className="text-green-700">{prevRec}</strong></div>
              <div>Pending: <strong className="text-amber-600">{pending}</strong></div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Receiving Now</label>
              <input type="number" min="0" max={pending} className="w-full h-11 md:h-9 border border-slate-200 rounded-xl px-3 text-sm mt-1"
                value={receiving[it.id] || ''} onChange={e => setQty(it.id, Math.min(Number(e.target.value) || 0, pending))}
                placeholder={`Max: ${pending}`} />
            </div>
          </div>
        );
      })}

      <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-white">
        <p className="text-sm font-semibold text-slate-700">Freight</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-slate-700">Freight Amount (₹)</label>
            <input type="number" className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm mt-1" value={freightAmount} onChange={e => setFreightAmount(e.target.value)} />
            {po.estimated_freight > 0 && <p className="text-xs text-slate-400 mt-0.5">Estimated: {formatINR(po.estimated_freight)}</p>}
            {po.total_freight_paid > 0 && <p className="text-xs text-slate-400">Previously paid: {formatINR(po.total_freight_paid)}</p>}
          </div>
          <div><label className="text-xs font-medium text-slate-700">Freight Notes</label><input className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm mt-1" value={freightNotes} onChange={e => setFreightNotes(e.target.value)} placeholder="Transporter" /></div>
        </div>
      </div>

      <div><label className="text-xs font-medium text-slate-700">Goods Receipt Notes</label><textarea rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1 resize-none" value={grnNotes} onChange={e => setGrnNotes(e.target.value)} /></div>

      <Button onClick={handleReceive} disabled={loading || !hasAnyQty} className="w-full h-11 bg-green-600 hover:bg-green-700 font-bold">
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Package className="w-4 h-4 mr-2" />}
        {loading ? 'Processing...' : 'Confirm Receipt'}
      </Button>
    </div>
  );
}