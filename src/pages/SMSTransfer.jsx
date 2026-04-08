import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, AlertCircle, ListChecks, ScanLine, Keyboard, Search, MapPin, Package } from 'lucide-react';
import ExportButton from '@/components/store/ExportButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import QRScanner from '@/components/store/QRScanner';
import TransferHistoryCards from '@/components/store/TransferHistoryCards';
import useDraftSave from '@/hooks/useDraftSave';

const DRAFT_INITIAL = { fromScan: '', toLotScan: '', toScan: '', quantity: '', reason: '' };

// Searchable location dropdown for manual mode
function LocationDropdown({ locations, value, onChange, placeholder }) {
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
          {selected ? `${selected.location_code} — ${selected.display_name}` : (placeholder || 'Select location...')}
        </span>
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg">
          <div className="p-2 border-b"><div className="flex items-center gap-2 px-2"><Search className="w-4 h-4 text-slate-400" /><input autoFocus className="flex-1 text-sm outline-none" placeholder="Search location..." value={query} onChange={e => setQuery(e.target.value)} /></div></div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? <p className="text-sm text-slate-400 text-center py-4">No locations found</p>
              : filtered.map(l => (
                <div key={l.id} className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 ${l.id === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                  onClick={() => { onChange(l); setOpen(false); setQuery(''); }}>
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

// Searchable lot dropdown for manual mode - filtered by location
function LotDropdown({ balances, value, onChange, placeholder }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = balances.find(b => b.lot_id === value);
  const filtered = query.trim()
    ? balances.filter(b => b.lot_id?.toLowerCase().includes(query.toLowerCase()) || b.item_name?.toLowerCase().includes(query.toLowerCase()))
    : balances;
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
          {selected ? `${selected.lot_id} — ${selected.item_name} (${selected.quantity} ${selected.uom})` : (placeholder || 'Select lot...')}
        </span>
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg">
          <div className="p-2 border-b"><div className="flex items-center gap-2 px-2"><Search className="w-4 h-4 text-slate-400" /><input autoFocus className="flex-1 text-sm outline-none" placeholder="Search lot or item..." value={query} onChange={e => setQuery(e.target.value)} /></div></div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? <p className="text-sm text-slate-400 text-center py-4">No lots found at this location</p>
              : filtered.map(b => (
                <div key={b.id} className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 ${b.lot_id === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                  onClick={() => { onChange(b); setOpen(false); setQuery(''); }}>
                  <p className="font-mono font-semibold text-slate-800">{b.lot_id}</p>
                  <p className="text-xs text-slate-500">{b.item_name} · Available: {b.quantity} {b.uom}</p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SMSTransfer() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('transfer');
  const [transferHistory, setTransferHistory] = useState([]);
  const [locations, setLocations] = useState([]);
  const [mode, setMode] = useState('manual');
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
  // Manual mode state
  const [manualFromLocId, setManualFromLocId] = useState('');
  const [manualToLocId, setManualToLocId] = useState('');
  const [manualLotId, setManualLotId] = useState('');
  const [manualResolvedStock, setManualResolvedStock] = useState(null);
  const [manualQuantity, setManualQuantity] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [locationBalances, setLocationBalances] = useState([]);

  useEffect(() => {
    Promise.all([
      base44.entities.StoreLocation.filter({ is_active: true }),
      base44.entities.StoreTransfer.list('-created_date', 100),
    ]).then(([locs, history]) => {
      setLocations(locs);
      setTransferHistory(history);
    });
  }, []);

  // Manual mode: load balances when source location selected
  useEffect(() => {
    if (!manualFromLocId) { setLocationBalances([]); return; }
    base44.entities.StoreStockBalance.filter({ location_id: manualFromLocId })
      .then(bals => setLocationBalances(bals.filter(b => (b.quantity || 0) > 0)));
  }, [manualFromLocId]);

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

      {activeTab === 'transfer' && <>
        {/* Mode toggle */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button onClick={() => setMode('manual')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${mode === 'manual' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
            <Keyboard className="w-4 h-4" /> Manual Entry
          </button>
          <button onClick={() => setMode('scan')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${mode === 'scan' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
            <ScanLine className="w-4 h-4" /> QR / Barcode Scan
          </button>
        </div>

        {hasDraft && mode === 'scan' && (
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <p className="text-xs text-amber-700 font-medium">You have an unsaved draft transfer</p>
            <button onClick={clearDraft} className="text-xs text-red-500 hover:text-red-700 font-medium">Clear Draft</button>
          </div>
        )}

        {/* Manual Entry Mode */}
        {mode === 'manual' && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/70 shadow-sm p-4 md:p-6 space-y-4">
            <p className="text-sm font-semibold text-slate-700">Transfer Details</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-slate-700">Source Location *</Label>
                <div className="mt-1">
                  <LocationDropdown locations={locations} value={manualFromLocId} onChange={loc => { setManualFromLocId(loc.id); setManualLotId(''); setManualResolvedStock(null); setManualQuantity(''); }} placeholder="Select source location" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Destination Location *</Label>
                <div className="mt-1">
                  <LocationDropdown locations={locations.filter(l => l.id !== manualFromLocId)} value={manualToLocId} onChange={loc => setManualToLocId(loc.id)} placeholder="Select destination location" />
                </div>
              </div>
            </div>
            {manualFromLocId && (
              <div>
                <Label className="text-xs font-medium text-slate-700">Select Lot *</Label>
                <div className="mt-1">
                  <LotDropdown balances={locationBalances} value={manualLotId} onChange={b => { setManualLotId(b.lot_id); setManualResolvedStock(b); setManualQuantity(''); }} placeholder="Select lot from this location" />
                </div>
              </div>
            )}
            {manualResolvedStock && manualToLocId && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-slate-700">Quantity *</Label>
                  <Input type="number" className="h-11 md:h-9 text-base md:text-sm mt-1" min="0.01" max={manualResolvedStock.quantity} value={manualQuantity} onChange={e => setManualQuantity(e.target.value)} placeholder={`Max: ${manualResolvedStock.quantity} ${manualResolvedStock.uom}`} />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-700">Reason *</Label>
                  <Input className="h-11 md:h-9 text-base md:text-sm mt-1" placeholder="Reason for transfer" value={manualReason} onChange={e => setManualReason(e.target.value)} />
                </div>
              </div>
            )}
            {manualResolvedStock && manualToLocId && manualQuantity && (
              <div className="bg-slate-50/80 backdrop-blur-sm rounded-lg p-3 md:p-4 border border-slate-200/70">
                <p className="text-xs font-semibold text-slate-500 mb-2">Transfer Summary</p>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                  <div className="text-center"><p className="text-xs text-slate-500">From</p><p className="font-mono text-sm font-bold text-slate-800">{locations.find(l => l.id === manualFromLocId)?.location_code}</p></div>
                  <ArrowRight className="w-5 h-5 text-slate-400 hidden sm:block" />
                  <div className="text-center"><p className="text-xs text-slate-500">To</p><p className="font-mono text-sm font-bold text-slate-800">{locations.find(l => l.id === manualToLocId)?.location_code}</p></div>
                  <div className="sm:ml-auto text-left sm:text-right"><p className="text-xs text-slate-500">Quantity</p><p className="text-sm font-bold text-slate-900">{manualQuantity} {manualResolvedStock.uom}</p></div>
                </div>
              </div>
            )}
            <Button className="w-full h-11 text-base" disabled={!manualFromLocId || !manualToLocId || !manualResolvedStock || !manualQuantity || !manualReason || saving || manualFromLocId === manualToLocId}
              onClick={async () => {
                const qty = parseFloat(manualQuantity);
                if (qty <= 0 || qty > manualResolvedStock.quantity) { toast({ title: 'Invalid quantity', variant: 'destructive' }); return; }
                setSaving(true);
                const user = await base44.auth.me();
                const now = new Date().toISOString();
                const transferId = `TRF-${Date.now()}`;
                const fromLocObj = locations.find(l => l.id === manualFromLocId);
                const toLocObj = locations.find(l => l.id === manualToLocId);
                await base44.entities.StoreTransfer.create({
                  transfer_id: transferId,
                  from_location_id: manualFromLocId, from_location_code: fromLocObj?.location_code,
                  to_location_id: manualToLocId, to_location_code: toLocObj?.location_code,
                  lot_id: manualResolvedStock.lot_id,
                  item_code: manualResolvedStock.item_code, item_name: manualResolvedStock.item_name, uom: manualResolvedStock.uom,
                  quantity: qty, reason: manualReason, status: 'completed',
                  transferred_by: user?.email, transferred_at: now,
                });
                const newQty = manualResolvedStock.quantity - qty;
                if (newQty <= 0) await base44.entities.StoreStockBalance.delete(manualResolvedStock.id);
                else await base44.entities.StoreStockBalance.update(manualResolvedStock.id, { quantity: newQty });
                const destExisting = await base44.entities.StoreStockBalance.filter({ lot_id: manualResolvedStock.lot_id, location_id: manualToLocId });
                if (destExisting.length > 0) {
                  await base44.entities.StoreStockBalance.update(destExisting[0].id, { quantity: destExisting[0].quantity + qty });
                } else {
                  await base44.entities.StoreStockBalance.create({
                    location_id: manualToLocId, location_code: toLocObj?.location_code,
                    lot_id: manualResolvedStock.lot_id, item_code: manualResolvedStock.item_code,
                    item_name: manualResolvedStock.item_name, uom: manualResolvedStock.uom, quantity: qty,
                    mfg_date: manualResolvedStock.mfg_date, expiry_date: manualResolvedStock.expiry_date,
                    putaway_date: now, putaway_by: user?.email, putaway_id: transferId,
                  });
                }
                toast({ title: 'Transfer completed!', description: `${qty} ${manualResolvedStock.uom} moved from ${fromLocObj?.location_code} → ${toLocObj?.location_code}` });
                setManualFromLocId(''); setManualToLocId(''); setManualLotId(''); setManualResolvedStock(null); setManualQuantity(''); setManualReason('');
                setSaving(false);
                base44.entities.StoreTransfer.list('-created_date', 100).then(setTransferHistory);
              }}>
              {saving ? 'Processing...' : 'Confirm Transfer'}
            </Button>
          </div>
        )}

        {/* QR Scan Mode */}
        {mode === 'scan' && <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/70 shadow-sm p-4 md:p-6 space-y-4">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-slate-700">Quantity *</Label>
                  <Input type="number" className="h-11 md:h-9 text-base md:text-sm mt-1" min="0.01" max={resolvedStock.quantity} value={quantity} onChange={e => setQuantity(e.target.value)} placeholder={`Max: ${resolvedStock.quantity} ${resolvedStock.uom}`} />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-700">Reason *</Label>
                  <Input className="h-11 md:h-9 text-base md:text-sm mt-1" placeholder="Reason for transfer" value={reason} onChange={e => setReason(e.target.value)} />
                </div>
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
      </>}
    </motion.div>
  );
}