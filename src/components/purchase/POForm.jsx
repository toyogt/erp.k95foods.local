import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle } from 'lucide-react';
import { genId, logPurchaseAudit } from './purchaseHelpers';

export default function POForm({ user, isAdmin, sourceMR, sourceItems, onDone, onCancel }) {
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [lines, setLines] = useState([]);
  const [terms, setTerms] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    base44.entities.Supplier.list('supplier_name', 200).then(setSuppliers).catch(() => {});
    if (sourceItems?.length) {
      setLines(sourceItems.map(it => ({
        item_code: it.item_code,
        item_name: it.item_name,
        uom_code: it.uom_code,
        qty: it.qty,
        rate: '',
        schedule_date: it.required_by || '',
        remarks: it.remarks || '',
      })));
    } else {
      setLines([{ item_code: '', item_name: '', uom_code: '', qty: '', rate: '', schedule_date: '', remarks: '' }]);
    }
  }, []);

  function updateLine(i, field, val) {
    setLines(prev => prev.map((l, idx) => {
      if (idx !== i) return l;
      const updated = { ...l, [field]: val };
      if (field === 'qty' || field === 'rate') {
        updated.amount = (Number(field === 'qty' ? val : l.qty) || 0) * (Number(field === 'rate' ? val : l.rate) || 0);
      }
      return updated;
    }));
  }

  const totalAmount = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const isNonApproved = selectedSupplier && selectedSupplier.approval_status !== 'APPROVED';
  const canSubmit = selectedSupplier && (!isNonApproved || (isAdmin && overrideReason.trim()));

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    const poId = genId('PO');
    const today = new Date().toISOString().split('T')[0];
    try {
      await base44.entities.PurchaseOrder.create({
        po_id: poId,
        supplier_id: selectedSupplier.supplier_id,
        supplier_name: selectedSupplier.supplier_name,
        mr_id: sourceMR?.mr_id || '',
        po_date: today,
        status: 'SUBMITTED',
        total_amount: totalAmount,
        terms,
        supplier_override_reason: isNonApproved ? overrideReason : '',
        erp_sync_status: 'NOT_SYNCED',
      });
      await Promise.all(lines.filter(l => l.item_code).map(l =>
        base44.entities.PurchaseOrderItem.create({
          po_id: poId,
          item_code: l.item_code,
          item_name: l.item_name,
          uom_code: l.uom_code,
          qty: Number(l.qty) || 0,
          rate: Number(l.rate) || 0,
          amount: Number(l.amount) || 0,
          schedule_date: l.schedule_date,
          remarks: l.remarks,
        })
      ));
      if (sourceMR?.id) {
        await base44.entities.PurchaseRequest.update(sourceMR.id, { status: 'ORDERED' });
      }
      const overrideNote = isNonApproved ? ` [OVERRIDE: ${overrideReason}]` : '';
      await logPurchaseAudit({
        action: `PO ${poId} created for supplier ${selectedSupplier.supplier_name}${overrideNote}`,
        entity_type: 'PurchaseOrder', entity_id: poId, user
      });
      onDone();
    } catch (e) { alert('Error: ' + e.message); }
    setLoading(false);
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <h3 className="font-bold text-slate-900">Create Purchase Order{sourceMR ? ` from ${sourceMR.mr_id}` : ''}</h3>

      {/* Supplier selection */}
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Supplier</label>
        <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1 bg-white"
          value={selectedSupplier?.supplier_id || ''}
          onChange={e => setSelectedSupplier(suppliers.find(s => s.supplier_id === e.target.value) || null)}>
          <option value="">Select supplier...</option>
          {suppliers.map(s => (
            <option key={s.id} value={s.supplier_id}>
              {s.supplier_name} {s.approval_status !== 'APPROVED' ? `[${s.approval_status}]` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Non-approved supplier warning */}
      {isNonApproved && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4" />
            Supplier is {selectedSupplier.approval_status} — not approved
          </div>
          {isAdmin ? (
            <input className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm bg-white"
              placeholder="Admin override reason (required)…"
              value={overrideReason} onChange={e => setOverrideReason(e.target.value)} />
          ) : (
            <p className="text-xs text-amber-700">Only admin can override. Select an APPROVED supplier.</p>
          )}
        </div>
      )}

      {/* Lines */}
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Items</label>
        <div className="mt-2 space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="bg-slate-50 rounded-xl p-3 grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <p className="text-sm font-medium text-slate-800">{l.item_name || l.item_code}</p>
                <p className="text-xs text-slate-400">{l.uom_code}</p>
              </div>
              <div className="text-right text-xs text-slate-400">{l.schedule_date}</div>
              <div>
                <label className="text-xs text-slate-400">Qty</label>
                <input type="number" className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                  value={l.qty} onChange={e => updateLine(i, 'qty', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-400">Rate (₹)</label>
                <input type="number" className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                  value={l.rate} onChange={e => updateLine(i, 'rate', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-400">Amount</label>
                <p className="text-sm font-bold text-slate-800 pt-2">₹{Number(l.amount || 0).toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-2">
          <p className="text-sm font-bold text-slate-800">Total: ₹{totalAmount.toFixed(2)}</p>
        </div>
      </div>

      {/* Terms */}
      <div>
        <label className="text-xs text-slate-500">Terms & Conditions (optional)</label>
        <textarea className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1" rows={2}
          value={terms} onChange={e => setTerms(e.target.value)} />
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button onClick={handleSubmit} disabled={loading || !canSubmit} className="flex-1 bg-blue-600 hover:bg-blue-700">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit PO'}
        </Button>
      </div>
    </div>
  );
}