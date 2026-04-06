import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import ExportButton from '@/components/store/ExportButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import QRScanner from '@/components/store/QRScanner';
import PutawayPanel from '@/components/store/PutawayPanel';

export default function SMSTransfer() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('transfer'); // 'transfer' | 'putaway'
  const [locations, setLocations] = useState([]);
  const [putawayLots, setPutawayLots] = useState([]);
  const [fromScan, setFromScan] = useState('');
  const [toLotScan, setToLotScan] = useState('');
  const [toScan, setToScan] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [fromLoc, setFromLoc] = useState(null);
  const [toLoc, setToLoc] = useState(null);
  const [resolvedStock, setResolvedStock] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.StoreLocation.filter({ is_active: true }),
      base44.entities.StoreLot.filter({ status: 'approved' }),
    ]).then(([locs, lots]) => { setLocations(locs); setPutawayLots(lots); });
  }, []);

  useEffect(() => {
    const found = locations.find(l => l.qr_code === fromScan.trim() || l.location_code === fromScan.trim());
    setFromLoc(found || null);
    setResolvedStock(null);
    setToLotScan('');
  }, [fromScan, locations]);

  useEffect(() => {
    const found = locations.find(l => l.qr_code === toScan.trim() || l.location_code === toScan.trim());
    setToLoc(found || null);
  }, [toScan, locations]);

  useEffect(() => {
    if (!fromLoc || !toLotScan.trim()) { setResolvedStock(null); return; }
    base44.entities.StoreStockBalance.filter({ location_id: fromLoc.id, lot_id: toLotScan.trim() })
      .then(results => setResolvedStock(results[0] || null));
  }, [fromLoc, toLotScan]);

  async function handleTransfer() {
    if (!fromLoc || !toLoc || !resolvedStock || !quantity) return;
    const qty = parseFloat(quantity);
    if (qty <= 0 || qty > resolvedStock.quantity) {
      toast({ title: 'Invalid quantity', variant: 'destructive' }); return;
    }
    if (fromLoc.id === toLoc.id) {
      toast({ title: 'Source and destination cannot be the same', variant: 'destructive' }); return;
    }
    setSaving(true);
    const user = await base44.auth.me();
    const now = new Date().toISOString();
    const transferId = `TRF-${Date.now()}`;

    await base44.entities.StoreTransfer.create({
      transfer_id: transferId,
      from_location_id: fromLoc.id, from_location_code: fromLoc.location_code,
      to_location_id: toLoc.id, to_location_code: toLoc.location_code,
      lot_id: resolvedStock.lot_id,
      item_code: resolvedStock.item_code, item_name: resolvedStock.item_name, uom: resolvedStock.uom,
      quantity: qty, reason, status: 'completed',
      transferred_by: user?.email, transferred_at: now,
    });

    // Deduct from source
    const newQty = resolvedStock.quantity - qty;
    if (newQty <= 0) await base44.entities.StoreStockBalance.delete(resolvedStock.id);
    else await base44.entities.StoreStockBalance.update(resolvedStock.id, { quantity: newQty });

    // Add to destination
    const destExisting = await base44.entities.StoreStockBalance.filter({ lot_id: resolvedStock.lot_id, location_id: toLoc.id });
    if (destExisting.length > 0) {
      await base44.entities.StoreStockBalance.update(destExisting[0].id, { quantity: destExisting[0].quantity + qty });
    } else {
      await base44.entities.StoreStockBalance.create({
        location_id: toLoc.id, location_code: toLoc.location_code,
        lot_id: resolvedStock.lot_id, item_code: resolvedStock.item_code,
        item_name: resolvedStock.item_name, uom: resolvedStock.uom, quantity: qty,
        mfg_date: resolvedStock.mfg_date, expiry_date: resolvedStock.expiry_date,
        putaway_date: now, putaway_by: user?.email, putaway_id: transferId,
      });
    }

    toast({ title: 'Transfer completed!', description: `${qty} ${resolvedStock.uom} moved from ${fromLoc.location_code} → ${toLoc.location_code}` });
    setFromScan(''); setToScan(''); setToLotScan(''); setQuantity(''); setReason('');
    setFromLoc(null); setToLoc(null); setResolvedStock(null);
    setSaving(false);
  }

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Internal Transfer</h1>
        <p className="text-sm text-slate-500">Move stock between locations or initiate putaway after receipt</p>
      </div>

      {/* Tab toggle */}
      <div className="flex rounded-lg border border-slate-200 overflow-hidden">
        <button
          onClick={() => setActiveTab('transfer')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${activeTab === 'transfer' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
        >
          Internal Transfer
        </button>
        <button
          onClick={() => setActiveTab('putaway')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${activeTab === 'putaway' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
        >
          Putaway After Receipt
        </button>
      </div>

      {activeTab === 'transfer' ? (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          {/* Source */}
          <div>
            <Label className="text-xs font-medium text-slate-700">Step 1 — Source Location QR *</Label>
            <div className="flex gap-2 mt-1">
              <Input className="h-11 text-base flex-1 font-mono" placeholder="Scan or type source location code" value={fromScan} onChange={e => setFromScan(e.target.value)} />
              <QRScanner onScan={setFromScan} label="Source Location" />
            </div>
            {fromScan && (fromLoc ? (
              <div className="mt-1 flex items-center gap-2 text-green-600 text-xs"><CheckCircle2 className="w-3.5 h-3.5" />{fromLoc.location_code} — {fromLoc.display_name}</div>
            ) : <div className="mt-1 flex items-center gap-2 text-red-500 text-xs"><AlertCircle className="w-3.5 h-3.5" />Location not found</div>)}
          </div>

          {/* Lot */}
          <div>
            <Label className="text-xs font-medium text-slate-700">Step 2 — Lot QR *</Label>
            <div className="flex gap-2 mt-1">
              <Input className="h-11 text-base flex-1 font-mono" placeholder="Scan or type Lot ID" value={toLotScan} onChange={e => setToLotScan(e.target.value)} disabled={!fromLoc} />
              {fromLoc && <QRScanner onScan={setToLotScan} label="Lot QR" />}
            </div>
            {toLotScan && (resolvedStock ? (
              <div className="mt-1 flex items-center gap-2 text-green-600 text-xs"><CheckCircle2 className="w-3.5 h-3.5" />{resolvedStock.item_name} — Available: {resolvedStock.quantity} {resolvedStock.uom}</div>
            ) : fromLoc && <div className="mt-1 flex items-center gap-2 text-red-500 text-xs"><AlertCircle className="w-3.5 h-3.5" />Lot not found at this location</div>)}
          </div>

          {/* Destination */}
          <div>
            <Label className="text-xs font-medium text-slate-700">Step 3 — Destination Location QR *</Label>
            <div className="flex gap-2 mt-1">
              <Input className="h-11 text-base flex-1 font-mono" placeholder="Scan or type destination location code" value={toScan} onChange={e => setToScan(e.target.value)} disabled={!resolvedStock} />
              {resolvedStock && <QRScanner onScan={setToScan} label="Destination" />}
            </div>
            {toScan && (toLoc ? (
              <div className="mt-1 flex items-center gap-2 text-green-600 text-xs"><CheckCircle2 className="w-3.5 h-3.5" />{toLoc.location_code} — {toLoc.display_name}</div>
            ) : <div className="mt-1 flex items-center gap-2 text-red-500 text-xs"><AlertCircle className="w-3.5 h-3.5" />Destination not found</div>)}
          </div>

          {resolvedStock && toLoc && (
            <>
              <div>
                <Label className="text-xs font-medium text-slate-700">Quantity *</Label>
                <Input type="number" className="h-9 text-sm mt-1" min="0.01" max={resolvedStock.quantity} value={quantity} onChange={e => setQuantity(e.target.value)} placeholder={`Max: ${resolvedStock.quantity} ${resolvedStock.uom}`} />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Reason *</Label>
                <Input className="h-9 text-sm mt-1" placeholder="Reason for transfer" value={reason} onChange={e => setReason(e.target.value)} />
              </div>
            </>
          )}

          {fromLoc && toLoc && resolvedStock && quantity && (
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 mb-2">Transfer Summary</p>
              <div className="flex items-center gap-3">
                <div className="text-center"><p className="text-xs text-slate-500">From</p><p className="font-mono text-sm font-bold text-slate-800">{fromLoc.location_code}</p></div>
                <ArrowRight className="w-5 h-5 text-slate-400" />
                <div className="text-center"><p className="text-xs text-slate-500">To</p><p className="font-mono text-sm font-bold text-slate-800">{toLoc.location_code}</p></div>
                <div className="ml-auto text-right"><p className="text-xs text-slate-500">Quantity</p><p className="text-sm font-bold text-slate-900">{quantity} {resolvedStock.uom}</p></div>
              </div>
            </div>
          )}

          <Button className="w-full h-11 text-base" disabled={!fromLoc || !toLoc || !resolvedStock || !quantity || !reason || saving} onClick={handleTransfer}>
            {saving ? 'Processing...' : 'Confirm Transfer'}
          </Button>
        </div>
      ) : (
        <PutawayPanel
          lots={putawayLots}
          locations={locations}
          onSuccess={() => base44.entities.StoreLot.filter({ status: 'approved' }).then(setPutawayLots)}
          compact
        />
      )}
    </div>
  );
}