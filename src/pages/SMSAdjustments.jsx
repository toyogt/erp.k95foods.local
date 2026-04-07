import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, CheckCircle2, XCircle, X } from 'lucide-react';
import ExportButton from '@/components/store/ExportButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

function AdjModal({ onSave, onClose }) {
  const { toast } = useToast();
  const [lots, setLots] = useState([]);
  const [stock, setStock] = useState([]);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({ lot_id: '', adjustment_type: 'decrease', adjustment_quantity: '', reason: '', location_id: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.StoreLot.list('-created_date', 200),
      base44.entities.StoreStockBalance.list('-created_date', 500),
      base44.entities.StoreLocation.filter({ is_active: true }),
    ]).then(([l, s, locs]) => { setLots(l); setStock(s); setLocations(locs); });
  }, []);

  const selectedLotStock = stock.filter(s => s.lot_id === form.lot_id);
  const totalQty = selectedLotStock.reduce((s, b) => s + (b.quantity || 0), 0);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.lot_id || !form.adjustment_quantity || !form.reason) return;
    const qty = parseFloat(form.adjustment_quantity);
    if (form.adjustment_type === 'decrease' && qty > totalQty) { toast({ title: 'Cannot exceed available stock', variant: 'destructive' }); return; }
    setSaving(true);
    const user = await base44.auth.me();
    const newQty = form.adjustment_type === 'increase' ? totalQty + qty : totalQty - qty;
    await base44.entities.StoreAdjustment.create({
      adjustment_id: `ADJ-${Date.now()}`,
      lot_id: form.lot_id,
      item_code: selectedLotStock[0]?.item_code,
      item_name: selectedLotStock[0]?.item_name,
      uom: selectedLotStock[0]?.uom,
      adjustment_type: form.adjustment_type,
      quantity_before: totalQty,
      adjustment_quantity: qty,
      quantity_after: newQty,
      reason: form.reason,
      status: 'pending',
      requested_by: user?.email,
    });
    toast({ title: 'Adjustment request submitted', description: 'Awaiting admin approval' });
    onSave();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-slate-900">Request Stock Adjustment</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <Label className="text-xs font-medium text-slate-700">Lot *</Label>
            <select className="w-full h-9 border border-slate-200 rounded-md px-2 text-sm mt-1" value={form.lot_id} onChange={e => set('lot_id', e.target.value)}>
              <option value="">Select lot...</option>
              {lots.filter(l => !['consumed'].includes(l.status)).map(l => <option key={l.id} value={l.lot_id}>{l.lot_id} — {l.item_name}</option>)}
            </select>
            {form.lot_id && <p className="text-xs text-slate-400 mt-1">Current stock: {totalQty.toFixed(2)} {selectedLotStock[0]?.uom}</p>}
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Adjustment Type *</Label>
            <select className="w-full h-9 border border-slate-200 rounded-md px-2 text-sm mt-1" value={form.adjustment_type} onChange={e => set('adjustment_type', e.target.value)}>
              <option value="decrease">Decrease (Damage / Loss)</option>
              <option value="increase">Increase (Found / Return)</option>
            </select>
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Quantity *</Label>
            <Input type="number" className="h-9 text-sm mt-1" min="0.01" value={form.adjustment_quantity} onChange={e => set('adjustment_quantity', e.target.value)} placeholder="Adjustment quantity" />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Location *</Label>
            <select className="w-full h-9 border border-slate-200 rounded-md px-2 text-sm mt-1" value={form.location_id} onChange={e => set('location_id', e.target.value)}>
              <option value="">Select location for adjustment...</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.location_code} — {l.display_name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Reason *</Label>
            <textarea className="w-full border border-slate-200 rounded-md p-2 text-sm mt-1 h-20" value={form.reason} onChange={e => set('reason', e.target.value)} placeholder="Enter reason for adjustment..." />
          </div>
          {form.lot_id && form.adjustment_quantity && (
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <p className="text-xs font-medium text-slate-500 mb-1">Preview:</p>
              <p className="text-slate-700">{totalQty} → <strong>{form.adjustment_type === 'increase' ? totalQty + parseFloat(form.adjustment_quantity || 0) : Math.max(0, totalQty - parseFloat(form.adjustment_quantity || 0))}</strong> {selectedLotStock[0]?.uom}</p>
            </div>
          )}
        </div>
        <div className="flex gap-3 px-5 py-4 border-t">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" disabled={saving || !form.lot_id || !form.adjustment_quantity || !form.reason || !form.location_id} onClick={handleSave}>{saving ? 'Submitting...' : 'Submit Request'}</Button>
        </div>
      </div>
    </div>
  );
}

export default function SMSAdjustments() {
  const { toast } = useToast();
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [user, setUser] = useState(null);

  async function load() {
    setLoading(true);
    const [adjs, u] = await Promise.all([base44.entities.StoreAdjustment.list('-created_date', 200), base44.auth.me()]);
    setAdjustments(adjs); setUser(u);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function approve(adj, approved) {
    await base44.entities.StoreAdjustment.update(adj.id, {
      status: approved ? 'approved' : 'rejected',
      approved_by: user?.email, approved_at: new Date().toISOString(),
    });
    if (approved) {
      const balances = await base44.entities.StoreStockBalance.filter({ lot_id: adj.lot_id });
      const remaining = adj.adjustment_quantity;
      if (adj.adjustment_type === 'increase') {
        // Add stock to first balance record or create new one
        if (balances.length > 0) {
          await base44.entities.StoreStockBalance.update(balances[0].id, { quantity: balances[0].quantity + remaining });
        } else {
          // No balance exists — create one (recovery scenario)
          const lots = await base44.entities.StoreLot.filter({ lot_id: adj.lot_id });
          const lot = lots[0];
          if (lot) {
            await base44.entities.StoreStockBalance.create({
              lot_id: adj.lot_id, item_code: lot.item_code, item_name: lot.item_name,
              uom: lot.uom, quantity: remaining, location_code: 'UNASSIGNED',
            });
          }
        }
      } else {
        // Decrease: deduct proportionally from balances
        let toDeduct = remaining;
        for (const bal of balances) {
          if (toDeduct <= 0) break;
          const deduct = Math.min(toDeduct, bal.quantity);
          toDeduct -= deduct;
          const newQty = bal.quantity - deduct;
          if (newQty <= 0) await base44.entities.StoreStockBalance.delete(bal.id);
          else await base44.entities.StoreStockBalance.update(bal.id, { quantity: newQty });
        }
      }
      // Recompute lot remaining_quantity and status from actual balances
      const updatedBalances = await base44.entities.StoreStockBalance.filter({ lot_id: adj.lot_id });
      const actualRemaining = updatedBalances.reduce((s, b) => s + (b.quantity || 0), 0);
      const lots = await base44.entities.StoreLot.filter({ lot_id: adj.lot_id });
      if (lots.length > 0) {
        await base44.entities.StoreLot.update(lots[0].id, {
          remaining_quantity: actualRemaining,
          status: actualRemaining <= 0 ? 'consumed' : 'putaway',
        });
      }
    }
    toast({ title: approved ? 'Adjustment approved' : 'Adjustment rejected' });
    load();
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Stock Adjustments</h1>
          <p className="text-sm text-slate-500">Request manual corrections — no direct deletion allowed</p>
        </div>
        <div className="flex gap-2">
          <ExportButton data={adjustments} columns={[
            { key: 'adjustment_id', label: 'ID' }, { key: 'item_name', label: 'Item' }, { key: 'lot_id', label: 'Lot' },
            { key: 'adjustment_type', label: 'Type' }, { key: 'quantity_before', label: 'Before' },
            { key: 'adjustment_quantity', label: 'Adjustment' }, { key: 'quantity_after', label: 'After' },
            { key: 'reason', label: 'Reason' }, { key: 'status', label: 'Status' },
          ]} filename="adjustments" />
          <Button onClick={() => setShowModal(true)} className="gap-2 h-11"><Plus className="w-4 h-4" />Request Adjustment</Button>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-xs">
                <th className="text-left px-4 py-3">Adjustment ID</th>
                <th className="text-left px-4 py-3">Item / Lot</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-right px-4 py-3">Before</th>
                <th className="text-right px-4 py-3">Adjustment</th>
                <th className="text-right px-4 py-3">After</th>
                <th className="text-left px-4 py-3">Reason</th>
                <th className="text-left px-4 py-3">Requested Date</th>
                <th className="text-left px-4 py-3">Status</th>
                {isAdmin && <th className="text-left px-4 py-3">Approve</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={9} className="text-center py-8 text-slate-400">Loading...</td></tr>
              ) : adjustments.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-slate-400">No adjustments yet</td></tr>
              ) : adjustments.map(a => (
                <tr key={a.id} className={`hover:bg-slate-50 ${a.status === 'approved' ? (a.adjustment_type === 'increase' ? 'bg-green-50' : 'bg-red-50') : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs font-bold">{a.adjustment_id}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{a.item_name}</p>
                    <p className="text-xs text-slate-400">{a.lot_id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.adjustment_type === 'decrease' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {a.adjustment_type === 'decrease' ? '↓ Decrease' : '↑ Increase'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{a.quantity_before}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{a.adjustment_quantity} {a.uom}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{a.quantity_after}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">{a.reason}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {a.created_date ? new Date(a.created_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : a.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {a.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      {a.status === 'pending' && (
                        <div className="flex gap-1">
                          <button onClick={() => approve(a, true)} className="p-1.5 rounded hover:bg-green-100 text-green-600"><CheckCircle2 className="w-4 h-4" /></button>
                          <button onClick={() => approve(a, false)} className="p-1.5 rounded hover:bg-red-100 text-red-500"><XCircle className="w-4 h-4" /></button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showModal && <AdjModal onSave={() => { setShowModal(false); load(); }} onClose={() => setShowModal(false)} />}
    </div>
  );
}