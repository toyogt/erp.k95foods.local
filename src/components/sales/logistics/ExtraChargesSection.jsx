import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Plus, Trash2, CheckCircle2 } from 'lucide-react';

export default function ExtraChargesSection({ charges = [], confirmed, onSave, saving }) {
  const [items, setItems] = useState(charges.length > 0 ? charges : []);
  const [markedNone, setMarkedNone] = useState(confirmed && charges.length === 0);

  const addCharge = () => setItems(p => [...p, { charge_name: '', amount: '', notes: '' }]);
  const removeCharge = (idx) => setItems(p => p.filter((_, i) => i !== idx));
  const updateCharge = (idx, k, v) => setItems(p => {
    const next = [...p];
    next[idx] = { ...next[idx], [k]: v };
    return next;
  });

  const handleSaveCharges = () => {
    const cleaned = items.filter(i => i.charge_name && Number(i.amount) > 0).map(i => ({
      charge_name: i.charge_name,
      amount: Number(i.amount) || 0,
      notes: i.notes || '',
    }));
    onSave({ extra_charges: cleaned, extra_charges_confirmed: true });
  };

  const handleMarkNone = () => {
    setMarkedNone(true);
    setItems([]);
    onSave({ extra_charges: [], extra_charges_confirmed: true });
  };

  if (confirmed && markedNone) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-green-600" />
        <span className="text-sm text-green-800 font-medium">No extra charges — confirmed</span>
      </div>
    );
  }

  const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-900">Extra Charges</p>
          <p className="text-xs text-amber-700">Please mention if there are any extra charges, or explicitly close this section.</p>
        </div>
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs text-slate-700">Charge Name</Label>
                <Input className="h-9 text-sm mt-0.5" value={item.charge_name} onChange={e => updateCharge(idx, 'charge_name', e.target.value)} placeholder="e.g. Detention" />
              </div>
              <div className="w-28">
                <Label className="text-xs text-slate-700">Amount (₹)</Label>
                <Input className="h-9 text-sm mt-0.5" type="number" value={item.amount} onChange={e => updateCharge(idx, 'amount', e.target.value)} placeholder="0" />
              </div>
              <div className="flex-1">
                <Label className="text-xs text-slate-700">Notes</Label>
                <Input className="h-9 text-sm mt-0.5" value={item.notes || ''} onChange={e => updateCharge(idx, 'notes', e.target.value)} placeholder="Optional" />
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeCharge(idx)}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          ))}
          {total > 0 && (
            <p className="text-xs font-medium text-amber-800">Extra Charges Total: ₹{total.toLocaleString('en-IN')}</p>
          )}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" className="h-11 text-sm gap-1" onClick={addCharge}>
          <Plus className="w-4 h-4" /> Add Extra Charge
        </Button>
        <Button className="h-11 text-sm bg-amber-700 hover:bg-amber-800 text-white" onClick={handleSaveCharges} disabled={saving}>
          Save Extra Charges
        </Button>
        {items.length === 0 && !confirmed && (
          <Button variant="outline" className="h-11 text-sm border-green-300 text-green-700 hover:bg-green-50" onClick={handleMarkNone} disabled={saving}>
            <CheckCircle2 className="w-4 h-4 mr-1" /> No Extra Charges
          </Button>
        )}
      </div>
    </div>
  );
}