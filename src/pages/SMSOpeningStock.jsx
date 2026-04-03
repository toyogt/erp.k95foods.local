import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, AlertTriangle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

function emptyLine() { return { item_code: '', item_name: '', uom: '', quantity: '', location_code: '', mfg_date: '', expiry_date: '', supplier_name: '' }; }

export default function SMSOpeningStock() {
  const { toast } = useToast();
  const [lines, setLines] = useState([emptyLine()]);
  const [locations, setLocations] = useState([]);
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    base44.entities.StoreLocation.filter({ is_active: true }).then(setLocations);
    base44.entities.StoreOpeningStock.list('-created_date', 100).then(h => { setHistory(h); if (h.length > 0 && h[0].is_locked) setSubmitted(true); });
  }, []);

  function setLine(idx, k, v) { setLines(prev => prev.map((l, i) => i === idx ? { ...l, [k]: v } : l)); }
  function addLine() { setLines(prev => [...prev, emptyLine()]); }
  function removeLine(idx) { setLines(prev => prev.filter((_, i) => i !== idx)); }

  async function handleSubmit() {
    const valid = lines.filter(l => l.item_code && l.quantity && parseFloat(l.quantity) > 0 && l.location_code);
    if (valid.length === 0) { toast({ title: 'Please fill all required fields', variant: 'destructive' }); return; }
    setSaving(true);
    const user = await base44.auth.me();
    const sessionId = `OS-${Date.now()}`;
    const now = new Date().toISOString();

    for (const line of valid) {
      const loc = locations.find(l => l.location_code === line.location_code);
      if (!loc) continue;
      const lotId = `LOT-OS-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const qty = parseFloat(line.quantity);

      // Create lot
      await base44.entities.StoreLot.create({
        lot_id: lotId, qr_code: lotId,
        item_code: line.item_code, item_name: line.item_name, uom: line.uom,
        quantity: qty, remaining_quantity: qty,
        mfg_date: line.mfg_date, expiry_date: line.expiry_date,
        supplier_name: line.supplier_name,
        status: 'approved',
        notes: 'Opening Stock Entry',
      });

      // Create stock balance
      await base44.entities.StoreStockBalance.create({
        location_id: loc.id, location_code: loc.location_code,
        lot_id: lotId, item_code: line.item_code, item_name: line.item_name, uom: line.uom,
        quantity: qty, mfg_date: line.mfg_date, expiry_date: line.expiry_date,
        putaway_date: now, putaway_by: user?.email,
      });

      // Record opening stock entry (locked)
      await base44.entities.StoreOpeningStock.create({
        entry_id: `OS-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        item_code: line.item_code, item_name: line.item_name, uom: line.uom,
        lot_id: lotId, quantity: qty,
        location_id: loc.id, location_code: loc.location_code,
        mfg_date: line.mfg_date, expiry_date: line.expiry_date,
        supplier_name: line.supplier_name,
        is_locked: true, entered_by: user?.email, session_id: sessionId,
      });
    }

    toast({ title: 'Opening stock recorded!', description: `${valid.length} item(s) added and locked` });
    setSubmitted(true);
    setSaving(false);
    base44.entities.StoreOpeningStock.list('-created_date', 100).then(setHistory);
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Opening Stock Entry</h1>
        <p className="text-sm text-slate-500">One-time entry to record existing stock. Cannot be edited after submission.</p>
      </div>

      <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Important — This entry is permanent</p>
          <p className="text-xs text-amber-600">Once submitted, opening stock entries are locked and cannot be edited or deleted. Lots and stock balances will be created automatically.</p>
        </div>
      </div>

      {!submitted ? (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          {lines.map((line, idx) => (
            <div key={idx} className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-700">Item {idx + 1}</p>
                {lines.length > 1 && <button onClick={() => removeLine(idx)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: 'item_code', label: 'Item Code *', placeholder: 'e.g. SKU001' },
                  { key: 'item_name', label: 'Item Name *', placeholder: 'Item description' },
                  { key: 'uom', label: 'Unit *', placeholder: 'Kg / Ltr / Nos' },
                  { key: 'supplier_name', label: 'Supplier', placeholder: 'Supplier name' },
                ].map(f => (
                  <div key={f.key}>
                    <Label className="text-xs font-medium text-slate-700">{f.label}</Label>
                    <Input className="h-9 text-sm mt-1" placeholder={f.placeholder} value={line[f.key]} onChange={e => setLine(idx, f.key, e.target.value)} />
                  </div>
                ))}
                <div>
                  <Label className="text-xs font-medium text-slate-700">Quantity *</Label>
                  <Input type="number" className="h-9 text-sm mt-1" value={line.quantity} onChange={e => setLine(idx, 'quantity', e.target.value)} placeholder="0" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-700">Location *</Label>
                  <select className="w-full h-9 border border-slate-200 rounded-md px-2 text-sm mt-1" value={line.location_code} onChange={e => setLine(idx, 'location_code', e.target.value)}>
                    <option value="">Select location</option>
                    {locations.map(l => <option key={l.id} value={l.location_code}>{l.location_code}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-700">Manufacture Date</Label>
                  <Input type="date" className="h-9 text-sm mt-1" value={line.mfg_date} onChange={e => setLine(idx, 'mfg_date', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-700">Expiry Date</Label>
                  <Input type="date" className="h-9 text-sm mt-1" value={line.expiry_date} onChange={e => setLine(idx, 'expiry_date', e.target.value)} />
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" className="w-full gap-2" onClick={addLine}><Plus className="w-4 h-4" /> Add Item</Button>
          <Button className="w-full h-11 text-base" disabled={saving} onClick={handleSubmit}>
            {saving ? 'Submitting...' : 'Submit Opening Stock (Locked)'}
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <Lock className="w-5 h-5 text-slate-400" />
            <p className="text-sm font-medium text-slate-600">Opening stock has been recorded and locked</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-100 text-slate-700 text-xs"><th className="text-left px-3 py-2">Item</th><th className="text-left px-3 py-2">Lot</th><th className="text-right px-3 py-2">Qty</th><th className="text-left px-3 py-2">Location</th><th className="text-left px-3 py-2">Entered By</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {history.map(h => <tr key={h.id} className="hover:bg-slate-50"><td className="px-3 py-2"><p className="font-medium text-slate-800">{h.item_name}</p><p className="text-xs text-slate-400">{h.item_code}</p></td><td className="px-3 py-2 font-mono text-xs">{h.lot_id}</td><td className="px-3 py-2 text-right font-bold">{h.quantity} {h.uom}</td><td className="px-3 py-2 font-mono text-xs">{h.location_code}</td><td className="px-3 py-2 text-xs text-slate-500">{h.entered_by}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}