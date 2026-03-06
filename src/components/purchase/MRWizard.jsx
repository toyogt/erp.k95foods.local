import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Trash2, ChevronRight, ChevronLeft } from 'lucide-react';
import { genId, logPurchaseAudit } from './purchaseHelpers';

export default function MRWizard({ user, onDone, onCancel }) {
  const [step, setStep] = useState(1);
  const [items, setItems] = useState([{ item_code: '', item_name: '', uom_code: '', qty: '', required_by: '', remarks: '' }]);
  const [notes, setNotes] = useState('');
  const [department, setDepartment] = useState('');
  const [uoms, setUoms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ingredients, setIngredients] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    base44.entities.UOMMaster.list('uom_name', 200).then(setUoms).catch(() => {});
    base44.entities.IngredientMaster.filter({ is_active: true }, 'ingredient_name', 500).then(setIngredients).catch(() => {});
  }, []);

  function addItem() {
    setItems(prev => [...prev, { item_code: '', item_name: '', uom_code: '', qty: '', required_by: '', remarks: '' }]);
  }

  function removeItem(i) {
    setItems(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateItem(i, field, val) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it));
  }

  function selectIngredient(i, ing) {
    setItems(prev => prev.map((it, idx) =>
      idx === i ? { ...it, item_code: ing.short_code || ing.ingredient_id, item_name: ing.ingredient_name } : it
    ));
    setSearch('');
  }

  const filteredIng = search.length > 1
    ? ingredients.filter(g =>
        g.ingredient_name?.toLowerCase().includes(search.toLowerCase()) ||
        g.short_code?.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8)
    : [];

  async function handleSubmit() {
    setLoading(true);
    const mrId = genId('MR');
    const today = new Date().toISOString().split('T')[0];
    try {
      await base44.entities.PurchaseRequest.create({
        mr_id: mrId,
        request_date: today,
        requested_by: user?.email || '',
        department,
        status: 'SUBMITTED',
        notes,
        erp_sync_status: 'NOT_SYNCED',
      });
      await Promise.all(items.filter(it => it.item_code).map(it =>
        base44.entities.PurchaseRequestItem.create({
          mr_id: mrId,
          item_code: it.item_code,
          item_name: it.item_name,
          uom_code: it.uom_code,
          qty: Number(it.qty) || 0,
          required_by: it.required_by,
          remarks: it.remarks,
        })
      ));
      await logPurchaseAudit({ action: `MR ${mrId} created and submitted`, entity_type: 'PurchaseRequest', entity_id: mrId, user });
      onDone();
    } catch (e) {
      alert('Error: ' + e.message);
    }
    setLoading(false);
  }

  const canNext1 = items.some(it => it.item_code.trim());
  const canNext2 = items.filter(it => it.item_code).every(it => it.qty > 0 && it.required_by);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
        {['Add Items', 'Qty & Dates', 'Confirm'].map((s, i) => (
          <span key={i} className={`${step === i + 1 ? 'text-blue-600' : ''}`}>
            {i + 1}. {s}{i < 2 ? ' ›' : ''}
          </span>
        ))}
      </div>

      {/* Step 1: Items */}
      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">Search and add items</p>
          {items.map((it, i) => (
            <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2">
              <div className="flex gap-2">
                <input
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="Search item..."
                  value={it.item_name || it.item_code}
                  onChange={e => { updateItem(i, 'item_name', e.target.value); setSearch(e.target.value); }}
                  onFocus={() => setSearch(it.item_name || '')}
                />
                <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {search.length > 1 && filteredIng.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm max-h-40 overflow-y-auto">
                  {filteredIng.map(ing => (
                    <button key={ing.id} onClick={() => selectIngredient(i, ing)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex justify-between">
                      <span>{ing.ingredient_name}</span>
                      <span className="text-slate-400 font-mono text-xs">{ing.short_code}</span>
                    </button>
                  ))}
                </div>
              )}
              {it.item_code && (
                <p className="text-xs text-green-600 font-mono">✓ {it.item_code}</p>
              )}
            </div>
          ))}
          <button onClick={addItem} className="flex items-center gap-2 text-blue-600 text-sm font-semibold hover:text-blue-800">
            <Plus className="w-4 h-4" /> Add another item
          </button>
        </div>
      )}

      {/* Step 2: Qty & Dates */}
      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">Enter quantities and required dates</p>
          {items.filter(it => it.item_code).map((it, i) => (
            <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2">
              <p className="text-sm font-bold text-slate-800">{it.item_name || it.item_code}</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500">Qty</label>
                  <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                    value={it.qty} onChange={e => updateItem(items.indexOf(it), 'qty', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-slate-500">UOM</label>
                  <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                    value={it.uom_code} onChange={e => updateItem(items.indexOf(it), 'uom_code', e.target.value)}>
                    <option value="">Select</option>
                    {uoms.map(u => <option key={u.id} value={u.uom_id}>{u.uom_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Required by</label>
                  <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                    value={it.required_by} onChange={e => updateItem(items.indexOf(it), 'required_by', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Remarks</label>
                  <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                    value={it.remarks} onChange={e => updateItem(items.indexOf(it), 'remarks', e.target.value)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">Review & Submit</p>
          <div className="bg-slate-50 rounded-xl p-3 space-y-1">
            {items.filter(it => it.item_code).map((it, i) => (
              <div key={i} className="flex justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                <span className="font-medium">{it.item_name || it.item_code}</span>
                <span className="text-slate-500">{it.qty} {it.uom_code} by {it.required_by}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500">Department</label>
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                value={department} onChange={e => setDepartment(e.target.value)} placeholder="Optional" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-500">Notes</label>
              <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white" rows={2}
                value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Nav buttons */}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={step === 1 ? onCancel : () => setStep(s => s - 1)} className="flex-1">
          <ChevronLeft className="w-4 h-4 mr-1" />{step === 1 ? 'Cancel' : 'Back'}
        </Button>
        {step < 3 ? (
          <Button onClick={() => setStep(s => s + 1)} disabled={step === 1 ? !canNext1 : !canNext2} className="flex-1 bg-blue-600 hover:bg-blue-700">
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={loading} className="flex-1 bg-green-600 hover:bg-green-700">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit MR'}
          </Button>
        )}
      </div>
    </div>
  );
}