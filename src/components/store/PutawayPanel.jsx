import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { QrCode, ScanLine, Keyboard, CheckCircle2, AlertCircle, Search, MapPin, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import QRScanner from '@/components/store/QRScanner';

// Searchable dropdown for locations
function LocationSelect({ locations, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selected = locations.find(l => l.id === value);
  const filtered = query.trim()
    ? locations.filter(l =>
        l.location_code?.toLowerCase().includes(query.toLowerCase()) ||
        l.display_name?.toLowerCase().includes(query.toLowerCase())
      )
    : locations;

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div
        className="flex items-center h-11 border border-slate-200 rounded-md px-3 gap-2 cursor-pointer bg-white"
        onClick={() => { setOpen(true); setQuery(''); }}
      >
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
              <input
                autoFocus
                className="flex-1 text-sm outline-none"
                placeholder="Search location..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No locations found</p>
            ) : filtered.map(l => (
              <div
                key={l.id}
                className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 ${l.id === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                onClick={() => { onChange(l.id); setOpen(false); setQuery(''); }}
              >
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

// Searchable dropdown for lots
function LotSelect({ lots, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selected = lots.find(l => l.lot_id === value);
  const filtered = query.trim()
    ? lots.filter(l =>
        l.lot_id?.toLowerCase().includes(query.toLowerCase()) ||
        l.item_name?.toLowerCase().includes(query.toLowerCase()) ||
        l.item_code?.toLowerCase().includes(query.toLowerCase())
      )
    : lots;

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div
        className="flex items-center h-11 border border-slate-200 rounded-md px-3 gap-2 cursor-pointer bg-white"
        onClick={() => { setOpen(true); setQuery(''); }}
      >
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
              <input
                autoFocus
                className="flex-1 text-sm outline-none"
                placeholder="Search by Lot ID, Item name..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No lots found</p>
            ) : filtered.map(l => (
              <div
                key={l.lot_id}
                className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 ${l.lot_id === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                onClick={() => { onChange(l.lot_id); setOpen(false); setQuery(''); }}
              >
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

/**
 * PutawayPanel — reusable across GRN, Transfers, Returns, Adjustments
 * Props:
 *   lots: pre-filtered lot list (or null to load all approved)
 *   locations: pre-filtered location list (or null to load all)
 *   onSuccess: callback after successful putaway
 *   compact: boolean (smaller layout for embedded use)
 */
export default function PutawayPanel({ lots: externalLots, locations: externalLocations, onSuccess, compact = false }) {
  const { toast } = useToast();
  const [mode, setMode] = useState('scan'); // 'scan' | 'manual'

  const [lots, setLots] = useState(externalLots || []);
  const [locations, setLocations] = useState(externalLocations || []);
  const [loading, setLoading] = useState(!externalLots || !externalLocations);
  const [saving, setSaving] = useState(false);

  // Scan mode state
  const [locationScan, setLocationScan] = useState('');
  const [lotScan, setLotScan] = useState('');

  // Manual mode state
  const [selectedLotId, setSelectedLotId] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');

  // Shared state
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (externalLots && externalLocations) return;
    setLoading(true);
    Promise.all([
      externalLots ? Promise.resolve(externalLots) : base44.entities.StoreLot.filter({ status: 'approved' }),
      externalLocations ? Promise.resolve(externalLocations) : base44.entities.StoreLocation.filter({ is_active: true }),
    ]).then(([l, loc]) => { setLots(l); setLocations(loc); setLoading(false); });
  }, []);

  // Resolve from scan inputs
  const resolvedLocation = mode === 'scan'
    ? locations.find(l => l.qr_code === locationScan.trim() || l.location_code === locationScan.trim()) || null
    : locations.find(l => l.id === selectedLocationId) || null;

  const resolvedLot = mode === 'scan'
    ? lots.find(l => l.qr_code === lotScan.trim() || l.lot_id === lotScan.trim()) || null
    : lots.find(l => l.lot_id === selectedLotId) || null;

  const maxQty = resolvedLot ? (resolvedLot.remaining_quantity ?? resolvedLot.quantity) : 0;

  function resetForm() {
    setLocationScan(''); setLotScan('');
    setSelectedLotId(''); setSelectedLocationId('');
    setQuantity(''); setNotes('');
  }

  async function handleConfirm() {
    if (!resolvedLocation || !resolvedLot || !quantity) return;
    const qty = parseFloat(quantity);
    if (qty <= 0 || qty > maxQty) {
      toast({ title: 'Invalid quantity', description: `Maximum available: ${maxQty} ${resolvedLot.uom}`, variant: 'destructive' });
      return;
    }
    setSaving(true);
    const user = await base44.auth.me();
    const putawayId = `PUT-${Date.now()}`;
    const now = new Date().toISOString();

    await base44.entities.StorePutaway.create({
      putaway_id: putawayId,
      lot_id: resolvedLot.lot_id,
      location_id: resolvedLocation.id,
      location_code: resolvedLocation.location_code,
      item_code: resolvedLot.item_code,
      item_name: resolvedLot.item_name,
      uom: resolvedLot.uom,
      quantity: qty,
      putaway_by: user?.email,
      putaway_at: now,
      notes,
    });

    // Update stock balance
    const existing = await base44.entities.StoreStockBalance.filter({ lot_id: resolvedLot.lot_id, location_id: resolvedLocation.id });
    if (existing.length > 0) {
      await base44.entities.StoreStockBalance.update(existing[0].id, { quantity: (existing[0].quantity || 0) + qty });
    } else {
      await base44.entities.StoreStockBalance.create({
        location_id: resolvedLocation.id, location_code: resolvedLocation.location_code,
        lot_id: resolvedLot.lot_id, item_code: resolvedLot.item_code, item_name: resolvedLot.item_name,
        uom: resolvedLot.uom, quantity: qty,
        mfg_date: resolvedLot.mfg_date, expiry_date: resolvedLot.expiry_date,
        putaway_date: now, putaway_by: user?.email, putaway_id: putawayId,
      });
    }

    // Update lot remaining quantity and status
    const remaining = maxQty - qty;
    await base44.entities.StoreLot.update(resolvedLot.id, {
      status: remaining <= 0 ? 'putaway' : 'approved',
      remaining_quantity: remaining,
    });

    toast({
      title: 'Putaway confirmed!',
      description: `${qty} ${resolvedLot.uom} of ${resolvedLot.item_name} stored at ${resolvedLocation.location_code}`,
    });

    resetForm();
    setSaving(false);
    if (onSuccess) onSuccess();
  }

  if (loading) return <div className="text-sm text-slate-400 py-4 text-center">Loading...</div>;

  return (
    <div className={`space-y-4 ${compact ? '' : 'max-w-2xl mx-auto'}`}>
      {/* Mode Toggle */}
      <div className="flex rounded-lg border border-slate-200 overflow-hidden">
        <button
          onClick={() => { setMode('scan'); resetForm(); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${mode === 'scan' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
        >
          <ScanLine className="w-4 h-4" /> QR / Barcode Scan
        </button>
        <button
          onClick={() => { setMode('manual'); resetForm(); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${mode === 'manual' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
        >
          <Keyboard className="w-4 h-4" /> Manual Entry
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        {mode === 'scan' ? (
          <>
            {/* SCAN MODE */}
            <div>
              <Label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5" /> Step 1 — Scan Location QR
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  className="h-11 text-base flex-1 font-mono"
                  value={locationScan}
                  onChange={e => setLocationScan(e.target.value)}
                  placeholder="Scan or type location code"
                />
                <QRScanner onScan={setLocationScan} label="Location" />
              </div>
              {locationScan && (
                resolvedLocation
                  ? <div className="mt-1.5 flex items-center gap-2 text-green-600 text-xs"><CheckCircle2 className="w-3.5 h-3.5" />{resolvedLocation.location_code} — {resolvedLocation.display_name}</div>
                  : <div className="mt-1.5 flex items-center gap-2 text-red-500 text-xs"><AlertCircle className="w-3.5 h-3.5" />Location not found</div>
              )}
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5" /> Step 2 — Scan Lot QR
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  className="h-11 text-base flex-1 font-mono"
                  value={lotScan}
                  onChange={e => setLotScan(e.target.value)}
                  placeholder="Scan or type Lot ID"
                />
                <QRScanner onScan={setLotScan} label="Lot" />
              </div>
              {lotScan && (
                resolvedLot
                  ? <div className="mt-1.5 flex items-center gap-2 text-green-600 text-xs"><CheckCircle2 className="w-3.5 h-3.5" />{resolvedLot.item_name} · Available: {maxQty} {resolvedLot.uom}</div>
                  : <div className="mt-1.5 flex items-center gap-2 text-red-500 text-xs"><AlertCircle className="w-3.5 h-3.5" />Lot not found or not available for putaway</div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* MANUAL MODE */}
            <div>
              <Label className="text-xs font-medium text-slate-700">Step 1 — Select Location *</Label>
              <div className="mt-1">
                <LocationSelect
                  locations={locations}
                  value={selectedLocationId}
                  onChange={setSelectedLocationId}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Type to search by location code or name</p>
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700">Step 2 — Select Lot *</Label>
              <div className="mt-1">
                <LotSelect
                  lots={lots}
                  value={selectedLotId}
                  onChange={setSelectedLotId}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Type to search by Lot ID or item name</p>
              {resolvedLot && (
                <div className="mt-1.5 flex items-center gap-2 text-green-600 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {resolvedLot.item_name} · Supplier: {resolvedLot.supplier_name || '—'} · Available: {maxQty} {resolvedLot.uom}
                </div>
              )}
            </div>
          </>
        )}

        {/* Quantity + Notes — shared */}
        {resolvedLot && resolvedLocation && (
          <>
            <div>
              <Label className="text-xs font-medium text-slate-700">Quantity to Store *</Label>
              <Input
                type="number"
                className="h-11 text-base mt-1"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder={`Max: ${maxQty} ${resolvedLot.uom}`}
                min="0.01"
                max={maxQty}
              />
              <p className="text-xs text-slate-400 mt-1">Available in lot: {maxQty} {resolvedLot.uom}</p>
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700">Notes (optional)</Label>
              <Input className="h-9 text-sm mt-1" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any remarks..." />
            </div>

            {/* Summary */}
            {quantity && (
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs font-semibold text-slate-500 mb-2">Confirm Putaway</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Item</span><span className="font-medium">{resolvedLot.item_name}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Lot</span><span className="font-mono text-xs">{resolvedLot.lot_id}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Location</span><span className="font-mono text-xs">{resolvedLocation.location_code}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Quantity</span><span className="font-bold text-slate-900">{quantity} {resolvedLot.uom}</span></div>
                </div>
              </div>
            )}
          </>
        )}

        <Button
          className="w-full h-11 text-base"
          disabled={!resolvedLocation || !resolvedLot || !quantity || saving}
          onClick={handleConfirm}
        >
          {saving ? 'Saving...' : 'Confirm Putaway'}
        </Button>
      </div>
    </div>
  );
}