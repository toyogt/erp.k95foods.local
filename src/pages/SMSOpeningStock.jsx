import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

function emptyLine() {
  return { item_code: '', item_name: '', uom: '', quantity: '', location_code: '', mfg_date: '', expiry_date: '', supplier_name: '' };
}

export default function SMSOpeningStock() {
  const { toast } = useToast();
  const [lines, setLines] = useState([emptyLine()]);
  const [locations, setLocations] = useState([]);
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);

  async function loadData() {
    setLoadingHistory(true);
    const [locs, h] = await Promise.all([
      base44.entities.StoreLocation.filter({ is_active: true }),
      base44.entities.StoreOpeningStock.list('-created_date', 200),
    ]);
    setLocations(locs);
    setHistory(h);
    setLoadingHistory(false);
  }

  useEffect(() => { loadData(); }, []);

  function setLine(idx, k, v) { setLines(prev => prev.map((l, i) => i === idx ? { ...l, [k]: v } : l)); }
  function addLine() { setLines(prev => [...prev, emptyLine()]); }
  function removeLine(idx) { setLines(prev => prev.filter((_, i) => i !== idx)); }

  async function handleSubmit() {
    const valid = lines.filter(l => l.item_code && l.quantity && parseFloat(l.quantity) > 0 && l.location_code);
    if (valid.length === 0) {
      toast({ title: 'Please fill all required fields', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const user = await base44.auth.me();
    const sessionId = `OS-${Date.now()}`;
    const now = new Date().toISOString();

    for (const line of valid) {
      const loc = locations.find(l => l.location_code === line.location_code);
      if (!loc) continue;
      const lotId = `LOT-OS-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const qty = parseFloat(line.quantity);

      await base44.entities.StoreLot.create({
        lot_id: lotId, qr_code: lotId,
        item_code: line.item_code, item_name: line.item_name, uom: line.uom,
        quantity: qty, remaining_quantity: qty,
        mfg_date: line.mfg_date, expiry_date: line.expiry_date,
        supplier_name: line.supplier_name,
        status: 'approved',
        notes: 'Opening Stock Entry',
      });

      await base44.entities.StoreStockBalance.create({
        location_id: loc.id, location_code: loc.location_code,
        lot_id: lotId, item_code: line.item_code, item_name: line.item_name, uom: line.uom,
        quantity: qty, mfg_date: line.mfg_date, expiry_date: line.expiry_date,
        putaway_date: now, putaway_by: user?.email,
      });

      await base44.entities.StoreOpeningStock.create({
        entry_id: `OS-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        item_code: line.item_code, item_name: line.item_name, uom: line.uom,
        lot_id: lotId, quantity: qty,
        location_id: loc.id, location_code: loc.location_code,
        mfg_date: line.mfg_date, expiry_date: line.expiry_date,
        supplier_name: line.supplier_name,
        is_locked: false, entered_by: user?.email, session_id: sessionId,
      });
    }

    toast({ title: 'Opening stock recorded!', description: `${valid.length} item(s) added to inventory` });
    setLines([emptyLine()]);
    setSaving(false);
    loadData();
  }

  async function handleDelete(entry) {
    const confirm = window.confirm(`Delete entry for ${entry.item_name} (${entry.lot_id})? This will also remove the associated lot and stock balance.`);
    if (!confirm) return;

    // Remove stock balance entries for this lot
    const balances = await base44.entities.StoreStockBalance.filter({ lot_id: entry.lot_id });
    for (const b of balances) await base44.entities.StoreStockBalance.delete(b.id);

    // Remove the lot
    const lots = await base44.entities.StoreLot.filter({ lot_id: entry.lot_id });
    for (const l of lots) await base44.entities.StoreLot.delete(l.id);

    // Remove the opening stock record
    await base44.entities.StoreOpeningStock.delete(entry.id);

    toast({ title: 'Entry deleted', description: `${entry.item_name} removed from opening stock` });
    loadData();
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Opening Stock Entry</h1>
          <p className="text-sm text-slate-500">Add existing inventory to the system. Entries can be added or deleted at any time.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
        <p className="text-sm text-amber-700">
          Each entry creates a new lot and stock balance record. Deleting an entry also removes the associated lot and stock.
        </p>
      </div>

      {/* Entry form */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <p className="text-sm font-semibold text-slate-700">Add New Stock Entries</p>
        {lines.map((line, idx) => (
          <div key={idx} className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-700">Item {idx + 1}</p>
              {lines.length > 1 && (
                <button onClick={() => removeLine(idx)} className="text-red-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
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
                  {locations.map(l => <option key={l.id} value={l.location_code}>{l.location_code} — {l.display_name}</option>)}
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
        <Button variant="outline" className="w-full gap-2" onClick={addLine}>
          <Plus className="w-4 h-4" /> Add Another Item
        </Button>
        <Button className="w-full h-11 text-base" disabled={saving} onClick={handleSubmit}>
          {saving ? 'Submitting...' : 'Submit Opening Stock'}
        </Button>
      </div>

      {/* History */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Recorded Entries ({history.length})</p>
        </div>
        {loadingHistory ? (
          <p className="text-sm text-slate-400 text-center py-8">Loading...</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No opening stock entries yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-xs">
                  <th className="text-left px-4 py-3">Item</th>
                  <th className="text-left px-4 py-3">Lot ID</th>
                  <th className="text-right px-4 py-3">Quantity</th>
                  <th className="text-left px-4 py-3">Location</th>
                  <th className="text-left px-4 py-3">Supplier</th>
                  <th className="text-left px-4 py-3">Entered By</th>
                  <th className="text-left px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map(h => (
                  <tr key={h.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{h.item_name}</p>
                      <p className="text-xs text-slate-400">{h.item_code}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{h.lot_id}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{h.quantity} {h.uom}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{h.location_code}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{h.supplier_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{h.entered_by}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(h)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
                        title="Delete entry"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}