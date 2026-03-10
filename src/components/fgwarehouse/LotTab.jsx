import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Search, ChevronLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import LotCardPrint from './LotCardPrint';
import QRScanInput from './QRScanInput';
import SKUSearchInput from './SKUSearchInput';
import { todayStr, formatLotId, getNextLotSeq, totalBottles, fmtDate } from './whHelpers';
import DateMaskInput, { focusNext } from './DateMaskInput';

export default function LotTab({ skus, lots, onRefresh, user, onBack }) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ACTIVE');
  const [showForm, setShowForm] = useState(false);
  const [selectedLot, setSelectedLot] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    sku_code: '', batch_code: '', mfg_date: '', exp_date: '',
    boxes_in: '', loose_bottles_in: '', location: '', notes: '',
  });

  const activeSku = skus.find(s => s.item_code === form.sku_code);

  // A lot is "effectively EMPTY" if both balances are 0, regardless of the stored status field
  const effectiveStatus = (l) => {
    if (l.status === 'ACTIVE' && (l.boxes_balance || 0) <= 0 && (l.loose_bottles_balance || 0) <= 0) return 'EMPTY';
    return l.status;
  };

  const filtered = lots.filter(l => {
    if (filterStatus && effectiveStatus(l) !== filterStatus) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.lot_id?.toLowerCase().includes(q) ||
      l.sku_code?.toLowerCase().includes(q) ||
      l.product_name?.toLowerCase().includes(q) ||
      l.batch_code?.toLowerCase().includes(q) ||
      l.brand_name?.toLowerCase().includes(q)
    );
  });

  const openNew = () => {
    setForm({ sku_code: '', batch_code: '', mfg_date: '', exp_date: '', boxes_in: '', loose_bottles_in: '', location: '', notes: '' });
    setSelectedLot(null);
    setShowForm(true);
  };

  const handleQRScan = (scannedValue) => {
    const lot = lots.find(l => l.lot_id === scannedValue);
    if (lot) setSelectedLot(lot);
    else alert(`Lot "${scannedValue}" not found.`);
  };

  const handleCreate = async () => {
    if (!form.sku_code) { alert('Select a SKU'); return; }
    if (!form.batch_code) { alert('Enter batch code'); return; }
    if (!form.mfg_date) { alert('Enter manufacturing date'); return; }
    if (!form.exp_date) { alert('Enter expiry date'); return; }
    if (form.exp_date <= form.mfg_date) { alert('Expiry date must be after manufacturing date'); return; }
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
      batch_code: form.batch_code,
      mfg_date: form.mfg_date,
      exp_date: form.exp_date,
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

  const statusOptions = [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'EMPTY', label: 'Empty' },
    { value: '', label: 'All' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors">
          <ChevronLeft className="w-6 h-6 text-slate-700" />
        </button>
        <h2 className="text-lg font-bold text-slate-900">Manage Lots</h2>
      </div>

      {/* Search + New */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
          <Input className="pl-8" placeholder="Search lots…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button onClick={openNew} className="gap-1.5 min-h-[44px] px-4">
          <Plus className="w-4 h-4" /> New
        </Button>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2">
        {statusOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilterStatus(opt.value)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors min-h-[44px] ${filterStatus === opt.value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* QR Scan - always visible */}
      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
        <p className="text-xs text-slate-500 mb-2 font-semibold">Scan Lot QR to view:</p>
        <QRScanInput onScan={handleQRScan} placeholder="Scan lot QR or type lot ID…" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">No lots found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(lot => (
            <button
              key={lot.id}
              onClick={() => setSelectedLot(lot)}
              className="w-full text-left border border-slate-200 rounded-xl p-4 hover:bg-slate-50 active:bg-slate-100 transition-colors min-h-[80px]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-mono font-bold text-slate-500">{lot.lot_id}</p>
                  <p className="font-semibold text-slate-900 text-sm leading-snug">{lot.product_name || lot.sku_code}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {[lot.brand_name, lot.flavour, lot.batch_code ? `Batch: ${lot.batch_code}` : ''].filter(Boolean).join(' · ')}
                  </p>
                  {(lot.mfg_date || lot.exp_date) && (
                    <p className="text-xs text-slate-400">Mfg: {fmtDate(lot.mfg_date)} · Exp: {fmtDate(lot.exp_date)}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[effectiveStatus(lot)] || 'bg-slate-100 text-slate-500'}`}>
                    {effectiveStatus(lot)}
                  </span>
                  <span className="text-xs text-slate-500">{lot.boxes_balance ?? lot.boxes_in} boxes</span>
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
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create New Lot</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">SKU *</Label>
              <SKUSearchInput skus={skus} value={form.sku_code} onChange={v => setForm(f => ({ ...f, sku_code: v }))} />
            </div>
            {activeSku && (
              <p className="text-xs bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-blue-700">
                📦 {activeSku.bottles_per_box} bottles/box{activeSku.is_trial_pack ? ' · 🧪 Trial Pack' : ''}
              </p>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Batch Code *</Label>
              <Input value={form.batch_code} onChange={e => setForm(f => ({ ...f, batch_code: e.target.value.toUpperCase() }))} onKeyDown={focusNext} placeholder="e.g. B2603001" className="uppercase tracking-wider" />
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Mfg. Date * (DD/MM/YYYY)</Label>
                <DateMaskInput key={form.sku_code + '_mfg'} value={form.mfg_date} onChange={v => setForm(f => ({ ...f, mfg_date: v }))} maxToday={true} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Expiry Date * (DD/MM/YYYY)</Label>
                <DateMaskInput key={form.sku_code + '_exp'} value={form.exp_date} onChange={v => setForm(f => ({ ...f, exp_date: v }))} minDate={form.mfg_date} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Boxes In</Label>
                <Input type="text" inputMode="numeric" pattern="[0-9]*" value={form.boxes_in} onChange={e => setForm(f => ({ ...f, boxes_in: e.target.value.replace(/\D/g, '') }))} onKeyDown={focusNext} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Loose Bottles</Label>
                <Input type="text" inputMode="numeric" pattern="[0-9]*" value={form.loose_bottles_in} onChange={e => setForm(f => ({ ...f, loose_bottles_in: e.target.value.replace(/\D/g, '') }))} onKeyDown={focusNext} />
              </div>
            </div>
            {activeSku && (form.boxes_in || form.loose_bottles_in) && (
              <p className="text-xs text-slate-500 text-right">
                Total: <strong>{totalBottles(form.boxes_in, form.loose_bottles_in, activeSku.bottles_per_box)}</strong> bottles
              </p>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Location (optional)</Label>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} onKeyDown={focusNext} placeholder="e.g. Rack A-3" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} onKeyDown={focusNext} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1 h-12" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button className="flex-1 h-12" onClick={handleCreate} disabled={saving || !form.sku_code}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create & Print'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}