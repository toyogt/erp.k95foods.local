import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { QrCode, CheckCircle2, Package, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import QRScanner from '@/components/store/QRScanner';
import ExportButton from '@/components/store/ExportButton';

function ScanField({ label, value, onChange, placeholder, hint, onQRScan }) {
  return (
    <div>
      <Label className="text-xs font-medium text-slate-700 flex items-center gap-1"><QrCode className="w-3.5 h-3.5" />{label}</Label>
      <div className="flex gap-2 mt-1">
        <Input className="h-11 text-base flex-1 font-mono" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
        <QRScanner onScan={onQRScan || onChange} label={label} />
      </div>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function SMSPutaway() {
  const { toast } = useToast();
  const [pendingLots, setPendingLots] = useState([]);
  const [locations, setLocations] = useState([]);
  const [putawayHistory, setPutawayHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [locationScan, setLocationScan] = useState('');
  const [lotScan, setLotScan] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');

  const [resolvedLocation, setResolvedLocation] = useState(null);
  const [resolvedLot, setResolvedLot] = useState(null);

  async function load() {
    setLoading(true);
    const [lots, locs, history] = await Promise.all([
      base44.entities.StoreLot.filter({ status: 'approved' }),
      base44.entities.StoreLocation.filter({ is_active: true }),
      base44.entities.StorePutaway.list('-created_date', 50),
    ]);
    setPendingLots(lots);
    setLocations(locs);
    setPutawayHistory(history);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!locationScan.trim()) { setResolvedLocation(null); return; }
    const found = locations.find(l => l.qr_code === locationScan.trim() || l.location_code === locationScan.trim());
    setResolvedLocation(found || null);
  }, [locationScan, locations]);

  useEffect(() => {
    if (!lotScan.trim()) { setResolvedLot(null); return; }
    const found = pendingLots.find(l => l.qr_code === lotScan.trim() || l.lot_id === lotScan.trim());
    setResolvedLot(found || null);
  }, [lotScan, pendingLots]);

  async function handleConfirm() {
    if (!resolvedLocation || !resolvedLot || !quantity) return;
    const qty = parseFloat(quantity);
    if (qty <= 0 || qty > (resolvedLot.remaining_quantity ?? resolvedLot.quantity)) {
      toast({ title: 'Invalid quantity', description: 'Quantity cannot exceed available lot quantity', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const user = await base44.auth.me();
    const putawayId = `PUT-${Date.now()}`;
    const now = new Date().toISOString();

    await base44.entities.StorePutaway.create({
      putaway_id: putawayId, lot_id: resolvedLot.lot_id,
      location_id: resolvedLocation.id, location_code: resolvedLocation.location_code,
      item_code: resolvedLot.item_code, item_name: resolvedLot.item_name, uom: resolvedLot.uom,
      quantity: qty, putaway_by: user?.email, putaway_at: now, notes,
    });

    const existing = await base44.entities.StoreStockBalance.filter({ lot_id: resolvedLot.lot_id, location_id: resolvedLocation.id });
    if (existing.length > 0) {
      await base44.entities.StoreStockBalance.update(existing[0].id, { quantity: (existing[0].quantity || 0) + qty });
    } else {
      await base44.entities.StoreStockBalance.create({
        location_id: resolvedLocation.id, location_code: resolvedLocation.location_code,
        lot_id: resolvedLot.lot_id, item_code: resolvedLot.item_code, item_name: resolvedLot.item_name,
        uom: resolvedLot.uom, quantity: qty, mfg_date: resolvedLot.mfg_date, expiry_date: resolvedLot.expiry_date,
        putaway_date: now, putaway_by: user?.email, putaway_id: putawayId,
      });
    }

    const remaining = (resolvedLot.remaining_quantity ?? resolvedLot.quantity) - qty;
    await base44.entities.StoreLot.update(resolvedLot.id, { status: remaining <= 0 ? 'putaway' : 'approved', remaining_quantity: remaining });

    toast({ title: 'Putaway confirmed!', description: `${qty} ${resolvedLot.uom} of ${resolvedLot.item_name} stored at ${resolvedLocation.location_code}` });
    setLocationScan(''); setLotScan(''); setQuantity(''); setNotes('');
    setResolvedLocation(null); setResolvedLot(null);
    setSaving(false);
    load();
  }

  const maxQty = resolvedLot ? (resolvedLot.remaining_quantity ?? resolvedLot.quantity) : 0;

  const exportColumns = [
    { key: 'putaway_id', label: 'Putaway ID' },
    { key: 'lot_id', label: 'Lot ID' },
    { key: 'item_name', label: 'Item' },
    { key: 'location_code', label: 'Location' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'uom', label: 'Unit' },
    { key: 'putaway_by', label: 'Done By' },
    { key: 'putaway_at', label: 'Date' },
  ];

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Putaway</h1>
          <p className="text-sm text-slate-500">Scan location QR + lot QR to store approved stock</p>
        </div>
        <ExportButton data={putawayHistory} columns={exportColumns} filename="putaway_history" />
      </div>

      {!loading && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center gap-3">
          <Package className="w-5 h-5 text-blue-500 shrink-0" />
          <p className="text-sm text-blue-700"><strong>{pendingLots.length}</strong> approved lot(s) awaiting putaway</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <ScanField label="Step 1 — Scan Location QR" value={locationScan} onChange={setLocationScan} onQRScan={setLocationScan} placeholder="Scan or type location code" hint="Point phone camera at rack QR code" />

        {locationScan && (
          resolvedLocation ? (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">{resolvedLocation.location_code}</p>
                <p className="text-xs text-green-600">{resolvedLocation.display_name} · {resolvedLocation.location_type}</p>
              </div>
            </div>
          ) : <div className="flex items-center gap-2 text-red-500 text-sm"><AlertCircle className="w-4 h-4" /> Location not found</div>
        )}

        <ScanField label="Step 2 — Scan Lot QR" value={lotScan} onChange={setLotScan} onQRScan={setLotScan} placeholder="Scan or type Lot ID" hint="Point phone camera at lot QR code" />

        {lotScan && (
          resolvedLot ? (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-800">{resolvedLot.lot_id}</p>
                <p className="text-xs text-green-600">{resolvedLot.item_name} · Available: {maxQty} {resolvedLot.uom}</p>
              </div>
            </div>
          ) : <div className="flex items-center gap-2 text-red-500 text-sm"><AlertCircle className="w-4 h-4" /> Lot not found or not approved</div>
        )}

        {resolvedLot && resolvedLocation && (
          <>
            <div>
              <Label className="text-xs font-medium text-slate-700">Quantity to Store *</Label>
              <Input type="number" className="h-11 text-base mt-1" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder={`Max: ${maxQty} ${resolvedLot.uom}`} min="0.01" max={maxQty} />
              <p className="text-xs text-slate-400 mt-1">Available in lot: {maxQty} {resolvedLot.uom}</p>
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-700">Notes (optional)</Label>
              <Input className="h-9 text-sm mt-1" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any remarks..." />
            </div>
          </>
        )}

        {resolvedLocation && resolvedLot && quantity && (
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

        <Button className="w-full h-11 text-base" disabled={!resolvedLocation || !resolvedLot || !quantity || saving} onClick={handleConfirm}>
          {saving ? 'Saving...' : 'Confirm Putaway'}
        </Button>
      </div>

      {/* Pending lots */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50">
          <p className="text-sm font-semibold text-slate-700">Approved Lots — Pending Putaway</p>
        </div>
        <div className="divide-y divide-slate-100">
          {pendingLots.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No lots pending putaway</p>
          ) : pendingLots.map(lot => (
            <div key={lot.id} className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50" onClick={() => setLotScan(lot.lot_id)}>
              <div>
                <p className="text-sm font-medium text-slate-800">{lot.lot_id}</p>
                <p className="text-xs text-slate-500">{lot.item_name} · {lot.supplier_name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-800">{lot.remaining_quantity ?? lot.quantity} {lot.uom}</p>
                <p className="text-xs text-blue-500">Tap to select</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}