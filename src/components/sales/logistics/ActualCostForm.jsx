import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { COST_HEADS } from './costHeads';
import { Save, Loader2, Plus, Trash2 } from 'lucide-react';

export default function ActualCostForm({ costRecord, onSave, saving }) {
  const [form, setForm] = useState({});
  const [extras, setExtras] = useState([]);

  useEffect(() => {
    if (costRecord) {
      const initial = {};
      COST_HEADS.forEach(h => { initial[h.key] = costRecord[`actual_${h.key}`] || ''; });
      setForm(initial);
      setExtras(costRecord.actual_extra_charges || []);
    }
  }, [costRecord]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const addExtra = () => setExtras(p => [...p, { charge_name: '', amount: '', notes: '' }]);
  const removeExtra = (idx) => setExtras(p => p.filter((_, i) => i !== idx));
  const updateExtra = (idx, k, v) => setExtras(p => {
    const next = [...p]; next[idx] = { ...next[idx], [k]: v }; return next;
  });

  const headTotal = COST_HEADS.reduce((s, h) => s + (Number(form[h.key]) || 0), 0);
  const extraTotal = extras.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const total = headTotal + extraTotal;

  const handleSave = () => {
    const data = {};
    COST_HEADS.forEach(h => { data[`actual_${h.key}`] = Number(form[h.key]) || 0; });
    data.actual_extra_charges = extras.filter(e => e.charge_name && Number(e.amount) > 0).map(e => ({
      charge_name: e.charge_name, amount: Number(e.amount) || 0, notes: e.notes || '',
    }));
    data.actual_total = total;
    onSave(data);
  };

  return (
    <div className="bg-white border-2 border-emerald-300 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-slate-900">Actual Transportation Cost</span>
        <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Post-Delivery</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {COST_HEADS.map(h => (
          <div key={h.key}>
            <Label className="text-xs font-medium text-slate-700">{h.label} (₹)</Label>
            <Input className="h-9 text-sm mt-1" type="number" value={form[h.key] || ''} onChange={e => set(h.key, e.target.value)} placeholder="0" />
          </div>
        ))}
      </div>

      {/* Unexpected extra charges */}
      {extras.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold text-slate-700">Additional / Unexpected Charges</p>
          {extras.map((ex, idx) => (
            <div key={idx} className="flex items-end gap-2">
              <div className="flex-1">
                <Input className="h-9 text-sm" value={ex.charge_name} onChange={e => updateExtra(idx, 'charge_name', e.target.value)} placeholder="Charge name" />
              </div>
              <div className="w-28">
                <Input className="h-9 text-sm" type="number" value={ex.amount} onChange={e => updateExtra(idx, 'amount', e.target.value)} placeholder="₹" />
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeExtra(idx)}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Button variant="outline" className="h-9 text-xs gap-1" onClick={addExtra}>
          <Plus className="w-3 h-3" /> Add Unexpected Charge
        </Button>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
        <div>
          <span className="text-sm font-semibold text-slate-900">Actual Total: </span>
          <span className="text-sm font-bold text-emerald-700">₹{total.toLocaleString('en-IN')}</span>
        </div>
        <Button className="h-11 text-sm bg-emerald-700 hover:bg-emerald-800 text-white" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
          Save Actual Cost
        </Button>
      </div>
    </div>
  );
}