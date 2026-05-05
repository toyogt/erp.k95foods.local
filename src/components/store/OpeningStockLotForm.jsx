import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, MapPin } from 'lucide-react';

export default function OpeningStockLotForm({ item, locations = [], existingLotsCount = 0, onSaved, onCancel }) {
  const [form, setForm] = useState({
    batch_number: '',
    quantity: '',
    location_id: '',
    location_code: '',
    mfg_date: '',
    expiry_date: '',
    supplier_name: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setField(k, v) {
    setForm(prev => ({ ...prev, [k]: v }));
    if (error) setError('');
  }

  function handleLocationChange(locationId) {
    const loc = locations.find(l => l.id === locationId);
    setField('location_id', loc?.id || '');
    setForm(prev => ({ ...prev, location_id: loc?.id || '', location_code: loc?.location_code || '' }));
  }

  const batchRequired = !!item.batch_required;
  const expiryRequired = !!item.expiry_required;
  const mfgDateRequired = !!item.mfg_date_required;

  async function handleSave() {
    if (!form.quantity || Number(form.quantity) <= 0) { setError('Quantity must be greater than 0'); return; }
    if (!form.location_id) { setError('Location is required'); return; }
    if (batchRequired && !form.batch_number.trim()) { setError('Batch Number is required for this item'); return; }
    if (expiryRequired && !form.expiry_date.trim()) { setError('Expiry Date is required for this item'); return; }
    if (mfgDateRequired && !form.mfg_date.trim()) { setError('Manufacture Date is required for this item'); return; }

    setSaving(true);
    setError('');

    // Generate entry ID
    const entryId = `OPEN-${Date.now().toString(36).toUpperCase()}`;
    const lotId = `LOT-OPEN-${item.item_code}-${Date.now().toString(36).toUpperCase()}`;

    // FIFO rank derived from already-loaded count — no extra API call needed
    const fifoRank = existingLotsCount + 1;

    // Create StoreLot
    await base44.entities.StoreLot.create({
      lot_id: lotId,
      qr_code: lotId,
      item_code: item.item_code,
      item_name: item.item_name,
      uom: item.uom || 'Nos',
      original_quantity: Number(form.quantity),
      quantity: Number(form.quantity),
      remaining_quantity: Number(form.quantity),
      mismatch_type: 'none',
      batch_number: form.batch_number || '',
      mfg_date: form.mfg_date ? toISODate(form.mfg_date) : undefined,
      expiry_date: form.expiry_date ? toISODate(form.expiry_date) : undefined,
      supplier_name: form.supplier_name || 'Opening Stock',
      status: 'putaway',
      notes: form.notes || 'Opening stock entry',
    });

    // Create StoreStockBalance
    await base44.entities.StoreStockBalance.create({
      location_id: form.location_id,
      location_code: form.location_code,
      lot_id: lotId,
      item_code: item.item_code,
      item_name: item.item_name,
      uom: item.uom || 'Nos',
      quantity: Number(form.quantity),
      mfg_date: form.mfg_date ? toISODate(form.mfg_date) : undefined,
      expiry_date: form.expiry_date ? toISODate(form.expiry_date) : undefined,
      putaway_date: new Date().toISOString(),
      putaway_by: 'opening-stock',
    });

    // Create StoreOpeningStock record
    const entry = await base44.entities.StoreOpeningStock.create({
      entry_id: entryId,
      item_code: item.item_code,
      item_name: item.item_name,
      uom: item.uom || 'Nos',
      lot_id: lotId,
      batch_number: form.batch_number || '',
      quantity: Number(form.quantity),
      location_id: form.location_id,
      location_code: form.location_code,
      mfg_date: form.mfg_date || '',
      expiry_date: form.expiry_date || '',
      supplier_name: form.supplier_name || '',
      fifo_rank: fifoRank,
      status: 'posted',
      notes: form.notes || '',
      posted_at: new Date().toISOString(),
    });

    // Update opening_stock on StoreItemMaster (accumulate)
    const newOpeningTotal = (item.opening_stock || 0) + Number(form.quantity);
    await base44.entities.StoreItemMaster.update(item.id, { opening_stock: newOpeningTotal });

    setSaving(false);
    if (onSaved) onSaved(entry);
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
        <span className="font-semibold text-slate-800">{item.item_name}</span>
        <span className="text-slate-500 ml-2 font-mono text-xs">{item.item_code}</span>
      </div>

      {/* Item rules indicator */}
      {(batchRequired || expiryRequired || mfgDateRequired) && (
        <div className="flex flex-wrap gap-1.5">
          {batchRequired && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Batch Required</span>}
          {mfgDateRequired && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Manufacture Date Required</span>}
          {expiryRequired && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">Expiry Date Required</span>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-700">Batch Number {batchRequired ? '*' : ''}</label>
          <Input className="h-9 text-sm mt-1" value={form.batch_number} onChange={e => setField('batch_number', e.target.value)} placeholder="e.g. BN-2024-001" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700">Quantity *</label>
          <div className="flex items-center gap-2 mt-1">
            <Input className="h-9 text-sm" type="number" min="0.01" step="0.01" value={form.quantity} onChange={e => setField('quantity', e.target.value)} placeholder="0" />
            <span className="text-sm text-slate-500 shrink-0">{item.uom || 'Nos'}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-700">Manufacture Date (DD/MM/YYYY) {mfgDateRequired ? '*' : ''}</label>
          <Input className="h-9 text-sm mt-1" value={form.mfg_date} onChange={e => setField('mfg_date', e.target.value)} placeholder="DD/MM/YYYY" maxLength={10} />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700">Expiry Date (DD/MM/YYYY) {expiryRequired ? '*' : ''}</label>
          <Input className="h-9 text-sm mt-1" value={form.expiry_date} onChange={e => setField('expiry_date', e.target.value)} placeholder="DD/MM/YYYY" maxLength={10} />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-700">Location * <MapPin className="w-3 h-3 inline" /></label>
        <select
          className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm mt-1 h-9 bg-white"
          value={form.location_id}
          onChange={e => handleLocationChange(e.target.value)}
        >
          <option value="">— Select location —</option>
          {locations.map(l => (
            <option key={l.id} value={l.id}>{l.display_name || l.location_code}</option>
          ))}
        </select>
        <p className="text-xs text-slate-400 mt-0.5">FIFO rank is auto-assigned — older batches will be issued first</p>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-700">Supplier Name</label>
        <Input className="h-9 text-sm mt-1" value={form.supplier_name} onChange={e => setField('supplier_name', e.target.value)} placeholder="Optional" />
      </div>

      <div>
        <label className="text-xs font-medium text-slate-700">Notes</label>
        <textarea rows={2} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm mt-1 resize-none" value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Optional notes" />
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onCancel} className="flex-1 h-11 text-sm">Cancel</Button>
        <Button onClick={handleSave} disabled={saving} className="flex-1 h-11 bg-teal-700 hover:bg-teal-800 text-sm gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Adding Lot…' : 'Add Lot'}
        </Button>
      </div>
    </div>
  );
}

// Convert DD/MM/YYYY to ISO date YYYY-MM-DD for entity storage
function toISODate(ddmmyyyy) {
  if (!ddmmyyyy || !ddmmyyyy.includes('/')) return ddmmyyyy;
  const [d, m, y] = ddmmyyyy.split('/');
  if (!d || !m || !y) return ddmmyyyy;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}