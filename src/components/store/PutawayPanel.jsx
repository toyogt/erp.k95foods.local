import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { QrCode, ScanLine, Keyboard, CheckCircle2, AlertCircle, Search, MapPin, Package, Plus, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import QRScanner from '@/components/store/QRScanner';
import NumericInput from '@/components/ui/NumericInput';
import { showErrorAlert } from '@/lib/toastHelpers';


function LocationSelect({ locations, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = locations.find(l => l.id === value);
  const filtered = query.trim()
    ? locations.filter(l => l.location_code?.toLowerCase().includes(query.toLowerCase()) || l.display_name?.toLowerCase().includes(query.toLowerCase()))
    : locations;

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center h-11 border border-slate-200 rounded-md px-3 gap-2 cursor-pointer bg-white" onClick={() => { setOpen(true); setQuery(''); }}>
        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
        <span className={`flex-1 text-sm truncate ${selected ? 'text-slate-900' : 'text-slate-400'}`}>
          {selected ? `${selected.location_code} — ${selected.display_name}` : 'Type to search location...'}
        </span>
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg">
          <div className="p-2 border-b">
            <div className="flex items-center gap-2 px-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input autoFocus className="flex-1 text-sm outline-none" placeholder="Search location..." value={query} onChange={e => setQuery(e.target.value)} />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? <p className="text-sm text-slate-400 text-center py-4">No locations found</p>
              : filtered.map(l => (
                <div key={l.id} className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 ${l.id === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                  onClick={() => { onChange(l.id); setOpen(false); setQuery(''); }}>
                  <span className="font-mono font-semibold">{l.location_code}</span>
                  <span className="text-slate-400 ml-2">{l.display_name}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LotSelect({ lots, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = lots.find(l => l.lot_id === value);
  // Show lots that have pending-to-store qty > 0
  const available = lots.filter(l => (l._pendingToStore || (l.quantity || 0)) > 0);
  const filtered = query.trim()
    ? available.filter(l => l.lot_id?.toLowerCase().includes(query.toLowerCase()) || l.item_name?.toLowerCase().includes(query.toLowerCase()))
    : available;

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center h-11 border border-slate-200 rounded-md px-3 gap-2 cursor-pointer bg-white" onClick={() => { setOpen(true); setQuery(''); }}>
        <Package className="w-4 h-4 text-slate-400 shrink-0" />
        <span className={`flex-1 text-sm truncate ${selected ? 'text-slate-900' : 'text-slate-400'}`}>
          {selected ? `${selected.lot_id} — ${selected.item_name}` : 'Type to search lot...'}
        </span>
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg">
          <div className="p-2 border-b">
            <div className="flex items-center gap-2 px-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input autoFocus className="flex-1 text-sm outline-none" placeholder="Search by Lot ID, Item name..." value={query} onChange={e => setQuery(e.target.value)} />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? <p className="text-sm text-slate-400 text-center py-4">No lots found</p>
              : filtered.map(l => (
                <div key={l.lot_id} className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 ${l.lot_id === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                  onClick={() => { onChange(l.lot_id); setOpen(false); setQuery(''); }}>
                  <p className="font-mono font-semibold text-slate-800">{l.lot_id}</p>
                  <p className="text-xs text-slate-500">{l.item_name} · Pending to Store: {l._pendingToStore ?? l.quantity} {l.uom}</p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function emptyEntry() { return { lotId: '', locationId: '', quantity: '', notes: '' }; }

export default function PutawayPanel({ lots: externalLots, locations: externalLocations, onSuccess, compact = false }) {
  const { toast } = useToast();
  const [mode, setMode] = useState('manual'); 
  const [lots, setLots] = useState(externalLots || []);
  const [locations, setLocations] = useState(externalLocations || []);
  const [loading, setLoading] = useState(!externalLots || !externalLocations);
  const [saving, setSaving] = useState(false);

  const [entries, setEntries] = useState([emptyEntry()]);

  useEffect(() => {
    if (externalLots && externalLocations) return;
    Promise.all([
      externalLots ? Promise.resolve(externalLots) : base44.entities.StoreLot.filter({ status: 'approved' }),
      externalLocations ? Promise.resolve(externalLocations) : base44.entities.StoreLocation.filter({ is_active: true }),
    ]).then(([l, loc]) => { setLots(l); setLocations(loc); setLoading(false); });
  }, []);

  function setEntry(idx, key, val) {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [key]: val } : e));
  }
  function addEntry() { setEntries(prev => [...prev, emptyEntry()]); }
  function removeEntry(idx) { setEntries(prev => prev.filter((_, i) => i !== idx)); }

  async function processEntry(lot, location, qty, notes, user, now, cumulativeQtyForLot) {
    const putawayId = `PUT-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    await base44.entities.StorePutaway.create({
      putaway_id: putawayId, lot_id: lot.lot_id, location_id: location.id,
      location_code: location.location_code, item_code: lot.item_code, item_name: lot.item_name,
      uom: lot.uom, quantity: qty, putaway_by: user?.email, putaway_at: now, notes,
    });
    const existing = await base44.entities.StoreStockBalance.filter({ lot_id: lot.lot_id, location_id: location.id });
    if (existing.length > 0) {
      await base44.entities.StoreStockBalance.update(existing[0].id, { quantity: (existing[0].quantity || 0) + qty });
    } else {
      await base44.entities.StoreStockBalance.create({
        location_id: location.id, location_code: location.location_code,
        lot_id: lot.lot_id, item_code: lot.item_code, item_name: lot.item_name,
        uom: lot.uom, quantity: qty, mfg_date: lot.mfg_date, expiry_date: lot.expiry_date,
        putaway_date: now, putaway_by: user?.email, putaway_id: putawayId,
      });
    }
    // Use cumulative qty for this lot across all entries in this batch
    const pendingBefore = lot._pendingToStore ?? lot.quantity;
    const pendingAfter = pendingBefore - (cumulativeQtyForLot || qty);
    await base44.entities.StoreLot.update(lot.id, { 
      status: pendingAfter <= 0 ? 'putaway' : 'approved', 
      remaining_quantity: Math.max(0, pendingAfter) 
    });
  }

  async function handleConfirmAll() {
    const toProcess = entries.filter(e => {
      const lot = lots.find(l => l.lot_id === e.lotId);
      const loc = locations.find(l => l.id === e.locationId);
      return lot && loc && e.quantity && parseFloat(e.quantity) > 0;
    }).map(e => ({
      lot: lots.find(l => l.lot_id === e.lotId),
      location: locations.find(l => l.id === e.locationId),
      quantity: parseFloat(e.quantity),
      notes: e.notes,
    }));

    if (toProcess.length === 0) { toast({ title: 'No valid entries to submit', variant: 'destructive' }); return; }

    // Validate consolidated quantity per lot does not exceed available
    const lotTotals = {};
    for (const item of toProcess) {
      const key = item.lot.lot_id;
      lotTotals[key] = (lotTotals[key] || 0) + item.quantity;
    }
    for (const [lotId, total] of Object.entries(lotTotals)) {
      const lot = lots.find(l => l.lot_id === lotId);
      const maxQty = lot._pendingToStore ?? lot.quantity;
      if (total > maxQty) {
        showErrorAlert("Capacity Exceeded", `Total putaway for ${lot.item_name} (${lotId}) is ${total}, but only ${maxQty} ${lot.uom} pending to store.`);
        return;
      }
    }

    setSaving(true);
    const user = await base44.auth.me();
    const now = new Date().toISOString();
    try {
        // Group by lot to calculate cumulative putaway for status update
        const lotCumulativeQty = {};
        for (const item of toProcess) {
          const lotId = item.lot.lot_id;
          lotCumulativeQty[lotId] = (lotCumulativeQty[lotId] || 0) + item.quantity;
          await processEntry(item.lot, item.location, item.quantity, item.notes, user, now, lotCumulativeQty[lotId]);
        }
        Swal.fire({ icon: 'success', title: 'Putaway Confirmed', text: `${toProcess.length} lot(s) successfully stored`, timer: 2500, showConfirmButton: false });
        setEntries([emptyEntry()]);
        setSaving(false);
        if (onSuccess) onSuccess();
    } catch (error) {
        setSaving(false);
        showErrorAlert("Putaway Failed", error.message);
    }
  }

  if (loading) return <div className="text-sm text-slate-400 py-4 text-center">Loading...</div>;

  return (
    <div className="space-y-4">
       <div className="bg-white/50 backdrop-blur-xl border border-white/30 rounded-[28px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-700">Putaway Entries ({entries.length})</p>

          <div className="space-y-3">
          {entries.map((entry, idx) => {
            const lot = lots.find(l => l.lot_id === entry.lotId);
            // Calculate remaining available for this lot considering other entries
            const totalUsedByOthers = entries.reduce((sum, e, i) => {
              if (i !== idx && e.lotId === entry.lotId && e.quantity) return sum + parseFloat(e.quantity || 0);
              return sum;
            }, 0);
            const lotMax = lot ? (lot._pendingToStore ?? lot.quantity ?? 0) : 0;
            const maxQty = Math.max(0, lotMax - totalUsedByOthers);
            return (
              <div key={idx} className="border border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600">Entry {idx + 1}</p>
                  {entries.length > 1 && (
                    <button onClick={() => removeEntry(idx)} className="text-red-400 hover:text-red-600 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-700">Location *</Label>
                  <div className="mt-1"><LocationSelect locations={locations} value={entry.locationId} onChange={v => setEntry(idx, 'locationId', v)} /></div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-700">Lot *</Label>
                  <div className="mt-1"><LotSelect lots={lots} value={entry.lotId} onChange={v => setEntry(idx, 'lotId', v)} /></div>
                  {lot && <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{lot.item_name} · Available: {maxQty} {lot.uom}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Quantity *</Label>
                    <NumericInput className="h-9 text-sm mt-1" value={entry.quantity} onChange={e => setEntry(idx, 'quantity', e.target.value)} placeholder={lot ? `Max: ${maxQty}` : '0'} max={maxQty} />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Notes</Label>
                    <input className="h-9 text-sm mt-1 w-full border border-slate-200 rounded-md px-3" value={entry.notes} onChange={e => setEntry(idx, 'notes', e.target.value)} placeholder="Optional" />
                  </div>
                </div>
              </div>
            );
          })}
          </div>

          <button onClick={addEntry} className="w-full border-2 border-dashed border-slate-300 rounded-lg py-3 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 flex items-center justify-center gap-2 transition-colors">
            <Plus className="w-4 h-4" /> Add More Lots
          </button>

          <Button className="w-full h-11 text-base" disabled={saving} onClick={handleConfirmAll}>
            {saving ? 'Saving...' : `Confirm Putaway (${entries.filter(e => e.lotId && e.locationId && e.quantity).length} entry/entries)`}
          </Button>
        </div>
    </div>
  );
}