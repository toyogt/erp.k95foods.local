import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { genId, logPurchaseAudit } from './purchaseHelpers';
import { fireFMSEvent, findFMSInstanceByRef, linkFMSRef } from '@/lib/useFMSAutoComplete';

export default function POForm({ user, isAdmin, sourceMR, sourceItems, onDone, onCancel }) {
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [lines, setLines] = useState([]);
  const [terms, setTerms] = useState('');
  const [loading, setLoading] = useState(false);
  const [ingredients, setIngredients] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [searches, setSearches] = useState({});
  const [focused, setFocused] = useState({});

  useEffect(() => {
    base44.entities.Supplier.list('supplier_name', 200).then(setSuppliers).catch(() => {});
    base44.entities.ItemMaster.filter({ is_active: true }, 'item_name', 500).then(setIngredients).catch(() => {});
    base44.entities.UOMMaster.list('uom_name', 200).then(setUoms).catch(() => {});
    if (sourceItems?.length) {
      setLines(sourceItems.map(it => ({
        item_code: it.item_code,
        item_name: it.item_name,
        uom_code: it.uom_code,
        qty: it.qty,
        rate: '',
        amount: 0,
        schedule_date: it.required_by || '',
        remarks: it.remarks || '',
      })));
    } else {
      setLines([{ item_code: '', item_name: '', uom_code: '', qty: '', rate: '', amount: 0, schedule_date: '', remarks: '' }]);
    }
  }, []);

  function setSearch(i, val) { setSearches(prev => ({ ...prev, [i]: val })); }

  function getFiltered(i) {
    const q = searches[i] || '';
    if (!q) return ingredients.slice(0, 10);
    return ingredients.filter(g =>
      g.item_name?.toLowerCase().includes(q.toLowerCase()) ||
      g.item_code?.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 10);
  }

  function selectIngredient(i, ing) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, item_code: ing.item_code, item_name: ing.item_name } : l));
    setSearch(i, '');
  }

  function addLine() {
    setLines(prev => [...prev, { item_code: '', item_name: '', uom_code: '', qty: '', rate: '', amount: 0, schedule_date: '', remarks: '' }]);
  }

  function removeLine(i) {
    setLines(prev => prev.filter((_, idx) => idx !== i));
  }

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
  const hasItems = lines.some(l => l.item_code);
  const canSubmit = selectedSupplier && hasItems && (!isNonApproved || (isAdmin && overrideReason.trim()));

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    const poId = genId('PO');
    const today = new Date().toISOString().split('T')[0];
    try {
      const po = await base44.entities.PurchaseOrder.create({
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

      // FMS: fire event using PR's id (already in ref_chain), then link PO into chain
      if (sourceMR?.id) {
        await fireFMSEvent('purchase_order_created', sourceMR.id);
        const instances = await findFMSInstanceByRef(sourceMR.id);
        for (const inst of instances) {
          await linkFMSRef(inst.id, po.id);
        }
      }

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
        {!hasItems && <p className="text-xs text-red-500 mt-1">At least one item must be selected.</p>}
        <div className="mt-2 space-y-3">
          {lines.map((l, i) => {
            const filtered = getFiltered(i);
            const q = searches[i] || '';
            return (
              <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2">
                {/* Item search */}
                <div className="relative">
                  <input
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                    placeholder="Click to select or type to search..."
                    value={l.item_code ? (l.item_name || l.item_code) : q}
                    onFocus={() => setFocused(prev => ({ ...prev, [i]: true }))}
                    onBlur={() => setTimeout(() => setFocused(prev => ({ ...prev, [i]: false })), 150)}
                    onChange={e => {
                      if (l.item_code) { updateLine(i, 'item_code', ''); updateLine(i, 'item_name', ''); }
                      setSearch(i, e.target.value);
                    }}
                  />
                  {focused[i] && !l.item_code && filtered.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto mt-1">
                      {filtered.map(ing => (
                        <button key={ing.id} onMouseDown={() => selectIngredient(i, ing)}
                          className="w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 flex justify-between items-center border-b border-slate-50 last:border-0">
                          <span className="font-medium">{ing.item_name}</span>
                          <span className="text-slate-400 font-mono text-xs">{ing.item_code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {focused[i] && !l.item_code && q.length > 1 && filtered.length === 0 && (
                    <div className="absolute z-10 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 px-3 py-2.5 text-sm text-slate-400">
                      No items found
                    </div>
                  )}
                </div>
                {l.item_code && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-green-600 font-mono">✓ {l.item_code}</p>
                    <button className="text-xs text-slate-400 hover:text-red-500" onClick={() => { updateLine(i, 'item_code', ''); updateLine(i, 'item_name', ''); setSearch(i, ''); }}>Change</button>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
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
                    <label className="text-xs text-slate-400">UOM</label>
                    <select className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                      value={l.uom_code} onChange={e => updateLine(i, 'uom_code', e.target.value)}>
                      <option value="">—</option>
                      {uoms.map(u => <option key={u.id} value={u.uom_id}>{u.uom_name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">Amount: <span className="font-bold text-slate-800">₹{Number(l.amount || 0).toFixed(2)}</span></p>
                  {lines.length > 1 && (
                    <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={addLine} className="flex items-center gap-1 text-blue-600 text-sm font-semibold mt-2 hover:text-blue-800">
          <Plus className="w-4 h-4" /> Add another item
        </button>
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