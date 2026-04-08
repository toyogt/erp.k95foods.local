import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, AlertCircle, ListChecks } from 'lucide-react';
import ExportButton from '@/components/store/ExportButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import QRScanner from '@/components/store/QRScanner';
import TransferHistoryCards from '@/components/store/TransferHistoryCards';
import useDraftSave from '@/hooks/useDraftSave';

const DRAFT_INITIAL = { fromScan: '', toLotScan: '', toScan: '', quantity: '', reason: '' };

export default function SMSTransfer() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('transfer');
  const [transferHistory, setTransferHistory] = useState([]);
  const [locations, setLocations] = useState([]);
  const [draft, setDraft, clearDraft, hasDraft] = useDraftSave('sms_transfer', DRAFT_INITIAL);
  const fromScan = draft.fromScan;
  const toLotScan = draft.toLotScan;
  const toScan = draft.toScan;
  const quantity = draft.quantity;
  const reason = draft.reason;
  const setFromScan = v => setDraft(prev => ({ ...prev, fromScan: v }));
  const setToLotScan = v => setDraft(prev => ({ ...prev, toLotScan: v }));
  const setToScan = v => setDraft(prev => ({ ...prev, toScan: v }));
  const setQuantity = v => setDraft(prev => ({ ...prev, quantity: v }));
  const setReason = v => setDraft(prev => ({ ...prev, reason: v }));
  const [saving, setSaving] = useState(false);
  const [fromLoc, setFromLoc] = useState(null);
  const [toLoc, setToLoc] = useState(null);
  const [resolvedStock, setResolvedStock] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.StoreLocation.filter({ is_active: true }),
      base44.entities.StoreTransfer.list('-created_date', 100),
    ]).then(([locs, history]) => {
      setLocations(locs);
      setTransferHistory(history);
    });
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
    clearDraft();
    setFromLoc(null); setToLoc(null); setResolvedStock(null);
    setSaving(false);
    // Refresh history
    base44.entities.StoreTransfer.list('-created_date', 100).then(setTransferHistory);
  }

  return (
    <motion.div className="space-y-4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div>
        <h1 className="text-xl font-bold text-slate-900">Internal Transfer</h1>
        <p className="text-sm text-slate-500">Move stock between locations</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {[
          { id: 'transfer', label: 'New Transfer', icon: ArrowRight },
          { id: 'history', label: `Transfer History (${transferHistory.length})`, icon: ListChecks },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === t.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {activeTab === 'history' && <TransferHistoryCards transfers={transferHistory} />}

      {activeTab === 'transfer' && <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/70 shadow-sm p-4 md:p-5 space-y-4 max-w-xl">
          {hasDraft && (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p className="text-xs text-amber-700 font-medium">You have an unsaved draft transfer</p>
              <button onClick={clearDraft} className="text-xs text-red-500 hover:text-red-700 font-medium">Clear Draft</button>
            </div>
          )}
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
                <Input type="number" className="h-11 md:h-9 text-base md:text-sm mt-1" min="0.01" max={resolvedStock.quantity} value={quantity} onChange={e => setQuantity(e.target.value)} placeholder={`Max: ${resolvedStock.quantity} ${resolvedStock.uom}`} />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Reason *</Label>
                <Input className="h-11 md:h-9 text-base md:text-sm mt-1" placeholder="Reason for transfer" value={reason} onChange={e => setReason(e.target.value)} />
              </div>
            </>
          )}

          {fromLoc && toLoc && resolvedStock && quantity && (
            <div className="bg-slate-50/80 backdrop-blur-sm rounded-lg p-3 md:p-4 border border-slate-200/70">
              <p className="text-xs font-semibold text-slate-500 mb-2">Transfer Summary</p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                <div className="text-center"><p className="text-xs text-slate-500">From</p><p className="font-mono text-sm font-bold text-slate-800">{fromLoc.location_code}</p></div>
                <ArrowRight className="w-5 h-5 text-slate-400 hidden sm:block" />
                <div className="text-center"><p className="text-xs text-slate-500">To</p><p className="font-mono text-sm font-bold text-slate-800">{toLoc.location_code}</p></div>
                <div className="sm:ml-auto text-left sm:text-right"><p className="text-xs text-slate-500">Quantity</p><p className="text-sm font-bold text-slate-900">{quantity} {resolvedStock.uom}</p></div>
              </div>
            </div>
          )}

          <Button className="w-full h-11 text-base" disabled={!fromLoc || !toLoc || !resolvedStock || !quantity || !reason || saving} onClick={handleTransfer}>
            {saving ? 'Processing...' : 'Confirm Transfer'}
          </Button>
      </div>}
    </motion.div>
  );
}