import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Plus, CheckCircle2, XCircle, X, Search } from 'lucide-react';
import { formatDateTime } from '@/lib/dateFormatter';
import ExportButton from '@/components/store/ExportButton';
import TablePagination from '@/components/store/TablePagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

function LotSearchDropdown({ lots, value, onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? lots.filter(l =>
        (l.lot_id || '').toLowerCase().includes(q) ||
        (l.item_name || '').toLowerCase().includes(q) ||
        (l.item_code || '').toLowerCase().includes(q) ||
        (l.batch_number || '').toLowerCase().includes(q)
      )
    : lots;

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          className="w-full h-11 pl-8 pr-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-teal-400 mt-1"
          placeholder="Search lots by ID, item name, or batch..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setQuery(''); setOpen(true); }}
        />
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto" style={{ zIndex: 9999 }}>
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-amber-600">No lots found.</div>
          ) : filtered.map(l => (
            <div key={l.id} className="px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-0"
              onClick={() => { setQuery(`${l.lot_id} — ${l.item_name}`); setOpen(false); onSelect(l); }}>
              <p className="font-medium text-slate-800">{l.item_name}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {l.lot_id}{l.batch_number ? ` · Batch: ${l.batch_number}` : ''} · {l.remaining_quantity ?? '?'} {l.uom || 'Nos'} remaining
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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

  const activeLots = lots.filter(l => !['consumed'].includes(l.status));
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
            <Label className="text-xs font-medium text-slate-700">Lot <span className="text-red-500">*</span></Label>
            <LotSearchDropdown lots={activeLots} value={form.lot_id} onSelect={l => set('lot_id', l.lot_id)} />
            {form.lot_id && (
              <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 mt-1.5">
                <div className="w-2 h-2 rounded-full bg-teal-500 shrink-0" />
                <span className="text-sm font-medium text-slate-800">{form.lot_id}</span>
                <span className="text-xs text-slate-500 ml-auto">Current stock: {totalQty.toFixed(2)} {selectedLotStock[0]?.uom}</span>
              </div>
            )}
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');

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

  const filtered = adjustments.filter(a => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (a.adjustment_id || '').toLowerCase().includes(q)
      || (a.item_name || '').toLowerCase().includes(q)
      || (a.lot_id || '').toLowerCase().includes(q)
      || (a.reason || '').toLowerCase().includes(q);
  });

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <motion.div className="space-y-4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Stock Adjustments</h1>
          <p className="text-sm text-slate-500">Request manual corrections — no direct deletion allowed</p>
        </div>
        <div className="flex gap-2">
          <ExportButton data={filtered} columns={[
            { key: 'adjustment_id', label: 'ID' }, { key: 'item_name', label: 'Item' }, { key: 'lot_id', label: 'Lot' },
            { key: 'adjustment_type', label: 'Type' }, { key: 'quantity_before', label: 'Before' },
            { key: 'adjustment_quantity', label: 'Adjustment' }, { key: 'quantity_after', label: 'After' },
            { key: 'reason', label: 'Reason' }, { key: 'status', label: 'Status' },
          ]} filename="adjustments" />
          <Button onClick={() => setShowModal(true)} className="gap-2 h-11 w-full sm:w-auto"><Plus className="w-4 h-4" />Request Adjustment</Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input className="pl-9 h-11 md:h-9 text-base md:text-sm" placeholder="Search by ID, item, lot, or reason…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white/50 backdrop-blur-xl border border-white/30 rounded-[28px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
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
              ) : paged.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-slate-400">No adjustments found</td></tr>
              ) : paged.map(a => (
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
                    {formatDateTime(a.created_date)}
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
        <TablePagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {loading ? (
          <div className="text-center py-8 text-slate-400">Loading...</div>
        ) : paged.length === 0 ? (
          <div className="text-center py-8 text-slate-400">No adjustments found</div>
        ) : paged.map(a => (
          <div key={a.id} className={`bg-white border border-slate-200 rounded-xl p-3 ${a.status === 'approved' ? (a.adjustment_type === 'increase' ? 'bg-green-50' : 'bg-red-50') : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs font-bold text-slate-500">{a.adjustment_id}</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{a.item_name}</p>
                <p className="text-xs text-slate-400">{a.lot_id}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : a.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {a.status}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.adjustment_type === 'decrease' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {a.adjustment_type === 'decrease' ? '↓ Decrease' : '↑ Increase'}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
              <span>Before: <strong className="text-slate-700">{a.quantity_before}</strong></span>
              <span>Adjustment: <strong className="text-slate-700">{a.adjustment_quantity}</strong></span>
              <span>After: <strong className="text-slate-700">{a.quantity_after}</strong></span>
            </div>
            {a.reason && <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{a.reason}</p>}
            {a.created_date && <p className="text-xs text-slate-400 mt-1">{formatDateTime(a.created_date)}</p>}
            {isAdmin && a.status === 'pending' && (
              <div className="flex gap-2 mt-3">
                <button onClick={() => approve(a, true)} className="flex-1 h-11 flex items-center justify-center gap-2 rounded-lg bg-green-50 border border-green-200 text-sm font-medium text-green-700"><CheckCircle2 className="w-4 h-4" /> Approve</button>
                <button onClick={() => approve(a, false)} className="flex-1 h-11 flex items-center justify-center gap-2 rounded-lg bg-red-50 border border-red-200 text-sm font-medium text-red-600"><XCircle className="w-4 h-4" /> Reject</button>
              </div>
            )}
          </div>
        ))}
        <TablePagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {showModal && <AdjModal onSave={() => { setShowModal(false); load(); }} onClose={() => setShowModal(false)} />}
    </motion.div>
  );
}