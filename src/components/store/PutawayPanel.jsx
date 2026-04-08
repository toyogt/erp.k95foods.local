import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { QrCode, ScanLine, Keyboard, CheckCircle2, AlertCircle, Search, MapPin, Package, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import QRScanner from '@/components/store/QRScanner';

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

function LotSelect({ lots, value, onChange, usedLotIds = [] }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = lots.find(l => l.lot_id === value);
  // Show all lots that still have remaining quantity (partial storage fix)
  const available = lots.filter(l => (l.remaining_quantity ?? l.quantity) > 0);
  const filtered = (query.trim()
    ? available.filter(l => l.lot_id?.toLowerCase().includes(query.toLowerCase()) || l.item_name?.toLowerCase().includes(query.toLowerCase()))
    : available
  ).filter(l => !usedLotIds.includes(l.lot_id) || l.lot_id === value);

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
                  <p className="text-xs text-slate-500">{l.item_name} · Available: {l.remaining_quantity ?? l.quantity} {l.uom}</p>
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
  const [mode, setMode] = useState('manual'); // 'scan' | 'manual'
  const [lots, setLots] = useState(externalLots || []);
  const [locations, setLocations] = useState(externalLocations || []);
  const [loading, setLoading] = useState(!externalLots || !externalLocations);
  const [saving, setSaving] = useState(false);

  // Multi-entry queue
  const [entries, setEntries] = useState([emptyEntry()]);

  // Scan mode state (single scan → add to queue)
  const [locationScan, setLocationScan] = useState('');
  const [lotScan, setLotScan] = useState('');
  const [scanQty, setScanQty] = useState('');
  const [scanNotes, setScanNotes] = useState('');
  const [scanQueue, setScanQueue] = useState([]);

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

  const usedLotIds = entries.map(e => e.lotId).filter(Boolean);

  // Scan mode resolve
  const scanLocation = locations.find(l => l.qr_code === locationScan.trim() || l.location_code === locationScan.trim()) || null;
  const scanLot = lots.find(l => l.qr_code === lotScan.trim() || l.lot_id === lotScan.trim()) || null;
  const scanMax = scanLot ? (scanLot.remaining_quantity ?? scanLot.quantity) : 0;

  function addToScanQueue() {
    if (!scanLot || !scanLocation || !scanQty) return;
    setScanQueue(prev => [...prev, { lot: scanLot, location: scanLocation, quantity: parseFloat(scanQty), notes: scanNotes }]);
    setLotScan(''); setScanQty(''); setScanNotes('');
  }

  async function processEntry(lot, location, qty, notes, user, now) {
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
    const maxQty = lot.remaining_quantity ?? lot.quantity;
    const remaining = maxQty - qty;
    // Keep lot 'approved' if still has remaining quantity so it stays in dropdown
    await base44.entities.StoreLot.update(lot.id, { status: remaining <= 0 ? 'putaway' : 'approved', remaining_quantity: Math.max(0, remaining) });
  }

  async function handleConfirmAll() {
    const toProcess = mode === 'scan' ? scanQueue : entries.filter(e => {
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

    setSaving(true);
    const user = await base44.auth.me();
    const now = new Date().toISOString();
    for (const item of toProcess) {
      await processEntry(item.lot, item.location, item.quantity, item.notes, user, now);
    }
    toast({ title: `${toProcess.length} putaway(s) confirmed!`, description: `Items successfully stored` });
    setEntries([emptyEntry()]);
    setScanQueue([]); setLocationScan(''); setLotScan(''); setScanQty(''); setScanNotes('');
    setSaving(false);
    if (onSuccess) onSuccess();
  }

  if (loading) return <div className="text-sm text-slate-400 py-4 text-center">Loading...</div>;

  return (
    <div className={`space-y-4`}>
      {/* Mode Toggle */}
      <div className="flex rounded-lg border border-slate-200 overflow-hidden">
        <button onClick={() => setMode('scan')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${mode === 'scan' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
          <ScanLine className="w-4 h-4" /> QR / Barcode Scan
        </button>
        <button onClick={() => setMode('manual')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${mode === 'manual' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
          <Keyboard className="w-4 h-4" /> Manual Entry
        </button>
      </div>

      {mode === 'manual' ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/70 shadow-sm p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-700">Putaway Entries ({entries.length})</p>

          {entries.map((entry, idx) => {
            const lot = lots.find(l => l.lot_id === entry.lotId);
            const location = locations.find(l => l.id === entry.locationId);
            const maxQty = lot ? (lot.remaining_quantity ?? lot.quantity) : 0;
            return (
              <div key={idx} className="border border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600">Lot {idx + 1}</p>
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
                  <div className="mt-1"><LotSelect lots={lots} value={entry.lotId} onChange={v => setEntry(idx, 'lotId', v)} usedLotIds={usedLotIds.filter((_, i) => i !== idx)} /></div>
                  {lot && <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{lot.item_name} · Available: {maxQty} {lot.uom}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Quantity *</Label>
                    <Input type="number" className="h-9 text-sm mt-1" value={entry.quantity} onChange={e => setEntry(idx, 'quantity', e.target.value)} placeholder={lot ? `Max: ${maxQty}` : '0'} min="0.01" max={maxQty} />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Notes</Label>
                    <Input className="h-9 text-sm mt-1" value={entry.notes} onChange={e => setEntry(idx, 'notes', e.target.value)} placeholder="Optional" />
                  </div>
                </div>
              </div>
            );
          })}

          <button onClick={addEntry} className="w-full border-2 border-dashed border-slate-300 rounded-lg py-3 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 flex items-center justify-center gap-2 transition-colors">
            <Plus className="w-4 h-4" /> Add More Lots
          </button>

          <Button className="w-full h-11 text-base" disabled={saving} onClick={handleConfirmAll}>
            {saving ? 'Saving...' : `Confirm Putaway (${entries.filter(e => e.lotId && e.locationId && e.quantity).length} entry/entries)`}
          </Button>
        </div>
      ) : (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/70 shadow-sm p-4 space-y-4">
          {/* Scan current lot */}
          <div>
            <Label className="text-xs font-medium text-slate-700 flex items-center gap-1"><QrCode className="w-3.5 h-3.5" /> Scan Location QR</Label>
            <div className="flex gap-2 mt-1">
              <Input className="h-11 text-base flex-1 font-mono" value={locationScan} onChange={e => setLocationScan(e.target.value)} placeholder="Scan or type location code" />
              <QRScanner onScan={setLocationScan} label="Location" />
            </div>
            {locationScan && (scanLocation
              ? <p className="mt-1 text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{scanLocation.location_code} — {scanLocation.display_name}</p>
              : <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Location not found</p>)}
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700 flex items-center gap-1"><QrCode className="w-3.5 h-3.5" /> Scan Lot QR</Label>
            <div className="flex gap-2 mt-1">
              <Input className="h-11 text-base flex-1 font-mono" value={lotScan} onChange={e => setLotScan(e.target.value)} placeholder="Scan or type Lot ID" />
              <QRScanner onScan={setLotScan} label="Lot" />
            </div>
            {lotScan && (scanLot
              ? <p className="mt-1 text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{scanLot.item_name} · Available: {scanMax} {scanLot.uom}</p>
              : <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Lot not found</p>)}
          </div>
          {scanLot && scanLocation && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-700">Quantity *</Label>
                <Input type="number" className="h-9 text-sm mt-1" value={scanQty} onChange={e => setScanQty(e.target.value)} placeholder={`Max: ${scanMax}`} />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Notes</Label>
                <Input className="h-9 text-sm mt-1" value={scanNotes} onChange={e => setScanNotes(e.target.value)} placeholder="Optional" />
              </div>
            </div>
          )}
          <Button variant="outline" className="w-full h-11" disabled={!scanLot || !scanLocation || !scanQty} onClick={addToScanQueue}>
            <Plus className="w-4 h-4 mr-2" /> Add to Queue
          </Button>

          {/* Queue display */}
          {scanQueue.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500">Queue ({scanQueue.length} lot(s) ready)</p>
              {scanQueue.map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{item.lot.item_name}</p>
                    <p className="text-xs text-slate-500 font-mono">{item.lot.lot_id} → {item.location.location_code}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-green-700">{item.quantity} {item.lot.uom}</span>
                    <button onClick={() => setScanQueue(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
              <Button className="w-full h-11 text-base" disabled={saving} onClick={handleConfirmAll}>
                {saving ? 'Saving...' : `Confirm All (${scanQueue.length} putaway(s))`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}