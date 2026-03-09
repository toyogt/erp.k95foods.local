import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Search, Package } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import LotCardPrint from './LotCardPrint';
import { genId, todayStr, formatLotId, getNextLotSeq, totalBottles } from './whHelpers';

export default function LotTab({ skus, lots, onRefresh, user }) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedLot, setSelectedLot] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    sku_code: '', boxes_in: '', loose_bottles_in: '', location: '', notes: '',
  });

  const activeSku = skus.find(s => s.item_code === form.sku_code);

  const filtered = lots.filter(l =>
    !search ||
    l.lot_id?.toLowerCase().includes(search.toLowerCase()) ||
    l.sku_code?.toLowerCase().includes(search.toLowerCase()) ||
    l.product_name?.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setForm({ sku_code: '', boxes_in: '', loose_bottles_in: '', location: '', notes: '' });
    setSelectedLot(null);
    setShowForm(true);
  };

  const handleCreate = async () => {
    if (!form.sku_code) { alert('Select a SKU'); return; }
    setSaving(true);
    const sku = skus.find(s => s.item_code === form.sku_code);
    const today = todayStr();
    const seq = await getNextLotSeq(today);
    const lot_id = formatLotId(today, seq);
    const boxes = Number(form.boxes_in) || 0;
    const loose = Number(form.loose_bottles_in) || 0;
    const ppb = sku?.bottles_per_box || 1;

    const newLot = await base44.entities.WarehouseLot.create({
      lot_id,
      lot_date: today,
      lot_seq: seq,
      sku_code: sku.item_code,
      product_name: sku.product_name,
      brand_name: sku.brand_name || '',
      product_family: sku.product_family || '',
      flavour: sku.flavour || '',
      bottles_per_box: ppb,
      boxes_in: boxes,
      loose_bottles_in: loose,
      boxes_balance: boxes,
      loose_bottles_balance: loose,
      location: form.location || '',
      notes: form.notes || '',
      status: 'ACTIVE',
      is_trial_pack: sku.is_trial_pack || false,
    });
    setSaving(false);
    setShowForm(false);
    setSelectedLot(newLot);
    onRefresh();
  };

  const statusColor = {
    ACTIVE: 'bg-green-100 text-green-700',
    EMPTY: 'bg-slate-100 text-slate-500',
    CLOSED: 'bg-red-100 text-red-500',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
          <Input className="pl-8 text-sm" placeholder="Search lots…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5">
          <Plus className="w-4 h-4" /> New Lot
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">No lots yet. Create a new lot card to get started.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(lot => (
            <button
              key={lot.id}
              onClick={() => setSelectedLot(lot)}
              className="w-full text-left border border-slate-200 rounded-xl p-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-mono font-bold text-slate-500">{lot.lot_id}</p>
                  <p className="font-semibold text-slate-900 text-sm">{lot.product_name || lot.sku_code}</p>
                  <p className="text-xs text-slate-400">{[lot.brand_name, lot.flavour].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[lot.status] || 'bg-slate-100 text-slate-500'}`}>
                    {lot.status}
                  </span>
                  <span className="text-xs text-slate-500">
                    {lot.boxes_balance ?? lot.boxes_in} boxes · {lot.loose_bottles_balance ?? lot.loose_bottles_in} loose
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Lot card view + print */}
      <Dialog open={!!selectedLot && !showForm} onOpenChange={open => !open && setSelectedLot(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Lot Card</DialogTitle></DialogHeader>
          {selectedLot && <LotCardPrint lot={selectedLot} />}
        </DialogContent>
      </Dialog>

      {/* Create lot form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create New Lot</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs">SKU *</Label>
              <select
                value={form.sku_code}
                onChange={e => setForm(f => ({ ...f, sku_code: e.target.value }))}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="">— Select SKU —</option>
                {skus.filter(s => s.is_active !== false).map(s => (
                  <option key={s.id} value={s.item_code}>{s.product_name} ({s.item_code})</option>
                ))}
              </select>
            </div>
            {activeSku && (
              <p className="text-xs bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-blue-700">
                📦 {activeSku.bottles_per_box} bottles/box
                {activeSku.is_trial_pack && ' · 🧪 Trial Pack'}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Boxes In</Label>
                <Input type="number" min="0" value={form.boxes_in} onChange={e => setForm(f => ({ ...f, boxes_in: e.target.value }))} className="text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Loose Bottles</Label>
                <Input type="number" min="0" value={form.loose_bottles_in} onChange={e => setForm(f => ({ ...f, loose_bottles_in: e.target.value }))} className="text-sm" />
              </div>
            </div>
            {activeSku && (form.boxes_in || form.loose_bottles_in) && (
              <p className="text-xs text-slate-500 text-right">
                Total: <strong>{totalBottles(form.boxes_in, form.loose_bottles_in, activeSku.bottles_per_box)}</strong> bottles
              </p>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Location (optional)</Label>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Rack A-3" className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleCreate} disabled={saving || !form.sku_code}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create & Print'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}