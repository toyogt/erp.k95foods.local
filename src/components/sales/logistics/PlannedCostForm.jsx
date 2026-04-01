import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { COST_HEADS } from './costHeads';
import { Save, Loader2 } from 'lucide-react';

export default function PlannedCostForm({ costRecord, onSave, saving }) {
  const [form, setForm] = useState({});

  useEffect(() => {
    if (costRecord) {
      const initial = {};
      COST_HEADS.forEach(h => { initial[h.key] = costRecord[`planned_${h.key}`] || ''; });
      setForm(initial);
    }
  }, [costRecord]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const total = COST_HEADS.reduce((s, h) => s + (Number(form[h.key]) || 0), 0);

  const handleSave = () => {
    const data = {};
    COST_HEADS.forEach(h => { data[`planned_${h.key}`] = Number(form[h.key]) || 0; });
    data.planned_total = total;
    onSave(data);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-slate-900">Planned Transportation Cost</span>
        <span className="text-xs text-slate-500">User-entered values</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {COST_HEADS.map(h => (
          <div key={h.key}>
            <Label className="text-xs font-medium text-slate-700">{h.label} (₹)</Label>
            <Input
              className="h-9 text-sm mt-1"
              type="number"
              value={form[h.key] || ''}
              onChange={e => set(h.key, e.target.value)}
              placeholder="0"
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
        <div>
          <span className="text-sm font-semibold text-slate-900">Planned Total: </span>
          <span className="text-sm font-bold text-slate-900">₹{total.toLocaleString('en-IN')}</span>
        </div>
        <Button className="h-11 text-sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
          Save Planned Cost
        </Button>
      </div>
    </div>
  );
}