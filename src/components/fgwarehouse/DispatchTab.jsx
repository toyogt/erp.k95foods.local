import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { Loader2, Camera, CheckCircle2, ChevronLeft, X, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { useOffline } from '@/components/OfflineProvider';
import QRScanInput from './QRScanInput';
import StepBar from './StepBar';
import { genId, todayStr, fmtDate } from './whHelpers';

const CHANNELS = ['SHOPIFY', 'AMAZON', 'PICKLIST', 'SALES_ORDER', 'OTHER'];
const STEPS = [
  { id: 'details', label: 'Details' },
  { id: 'product', label: 'Product' },
  { id: 'review', label: 'Review' },
];
const DISPATCH_DRAFT_KEY = 'fgwh_dispatch_draft';

function lotKey(l) {
  return (l.lot_date || '') + String(l.lot_seq || 0).padStart(4, '0');
}

function computeFifo(sku_code, total_boxes, lots) {
  if (!sku_code || !total_boxes || Number(total_boxes) <= 0) return [];
  const skuLots = lots
    .filter(l => l.sku_code === sku_code && l.status === 'ACTIVE' && (l.boxes_balance || 0) > 0)
    .sort((a, b) => lotKey(a).localeCompare(lotKey(b)));
  const entries = [];
  let remaining = Number(total_boxes);
  for (const lot of skuLots) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, lot.boxes_balance || 0);
    entries.push({ lot_id: lot.lot_id, boxes: take, verified: false });
    remaining -= take;
  }
  return entries;
}

export default function DispatchTab({ skus, lots, onRefresh, user, onBack }) {
  const [step, setStep] = useState('details');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastDispatch, setLastDispatch] = useState(null);
  const [viewPhoto, setViewPhoto] = useState(null);
  const [hasDraft, setHasDraft] = useState(false);

  const [header, setHeader] = useState({ channel: 'OTHER', order_reference: '', notes: '' });
  const [docPhotos, setDocPhotos] = useState([]);
  const [sku_code, setSkuCode] = useState('');
  const [total_boxes, setTotalBoxes] = useState('');
  const [lotEntries, setLotEntries] = useState([]); // [{ lot_id, boxes, verified }]
  const [scanErrors, setScanErrors] = useState({});
  const [addingLot, setAddingLot] = useState(false);

  // Check for existing draft on mount
  useEffect(() => {
    const raw = localStorage.getItem(DISPATCH_DRAFT_KEY);
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (d.step && d.step !== 'done') setHasDraft(true);
      } catch (e) {}
    }
  }, []);

  // Auto-save draft on every meaningful state change
  useEffect(() => {
    if (step === 'done') return;
    localStorage.setItem(DISPATCH_DRAFT_KEY, JSON.stringify({
      step, header, docPhotos, sku_code, total_boxes, lotEntries,
    }));
  }, [step, header, docPhotos, sku_code, total_boxes, lotEntries]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [step]);

  const loadDraft = () => {
    const raw = localStorage.getItem(DISPATCH_DRAFT_KEY);
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      setStep(d.step || 'details');
      setHeader(d.header || { channel: 'OTHER', order_reference: '', notes: '' });
      setDocPhotos(d.docPhotos || []);
      setSkuCode(d.sku_code || '');
      setTotalBoxes(d.total_boxes || '');
      setLotEntries(d.lotEntries || []);
      setScanErrors({});
      setHasDraft(false);
    } catch (e) {}
  };

  const sku = skus.find(s => s.item_code === sku_code);
  const activeLots = lots.filter(l => l.sku_code === sku_code && l.status === 'ACTIVE' && (l.boxes_balance || 0) > 0);
  const selectedLotIds = lotEntries.map(e => e.lot_id);
  const availableLots = activeLots.filter(l => !selectedLotIds.includes(l.lot_id));
  const totalBoxesSelected = lotEntries.reduce((sum, e) => sum + Number(e.boxes || 0), 0);
  const allVerified = lotEntries.length > 0 && lotEntries.every(e => e.verified);
  const exceedingEntries = lotEntries.filter(e => {
    const lot = lots.find(l => l.lot_id === e.lot_id);
    return lot && Number(e.boxes) > (lot.boxes_balance || 0);
  });
  const canReview = sku_code && lotEntries.length > 0 && allVerified && exceedingEntries.length === 0;

  const recomputeFifo = (code, boxes) => {
    const entries = computeFifo(code, boxes, lots);
    setLotEntries(entries);
    setScanErrors({});
  };

  const updateEntry = (lot_id, patch) => {
    setLotEntries(prev => prev.map(e => e.lot_id === lot_id ? { ...e, ...patch } : e));
  };

  const removeEntry = (lot_id) => {
    setLotEntries(prev => prev.filter(e => e.lot_id !== lot_id));
  };

  const addLot = (lot_id) => {
    if (!lot_id || selectedLotIds.includes(lot_id)) return;
    setLotEntries(prev => [...prev, { lot_id, boxes: 1, verified: false }]);
    setAddingLot(false);
  };

  const handleScan = (lot_id, scanned) => {
    if (scanned === lot_id) {
      setScanErrors(e => ({ ...e, [lot_id]: '' }));
      updateEntry(lot_id, { verified: true });
    } else {
      setScanErrors(e => ({ ...e, [lot_id]: `Wrong lot! Expected ${lot_id}` }));
    }
  };

  const handlePhotoCapture = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setDocPhotos(p => [...p, file_url]);
    setUploading(false);
  };

  const handleSubmit = async () => {
    setSaving(true);
    const today = todayStr();
    const dispatch_id = genId('DSP');

    await base44.entities.WarehouseDispatch.create({
      dispatch_id,
      dispatch_date: today,
      dispatched_by: user?.full_name || user?.email || '',
      channel: header.channel,
      order_reference: header.order_reference || '',
      doc_photo: docPhotos.join(','),
      notes: header.notes || '',
      status: 'CONFIRMED',
    });

    for (const entry of lotEntries) {
      const lot = lots.find(l => l.lot_id === entry.lot_id);
      if (!lot) continue;
      const boxes = Number(entry.boxes || 0);
      const ppb = lot.bottles_per_box || 1;
      const newBoxBal = (lot.boxes_balance || 0) - boxes;
      await base44.entities.WarehouseLot.update(lot.id, {
        boxes_balance: newBoxBal,
        status: newBoxBal <= 0 && (lot.loose_bottles_balance || 0) <= 0 ? 'EMPTY' : 'ACTIVE',
      });
      await base44.entities.WarehouseDispatchLine.create({
        dispatch_id,
        lot_id: lot.lot_id,
        sku_code: lot.sku_code,
        product_name: lot.product_name,
        boxes_dispatched: boxes,
        loose_bottles_dispatched: 0,
        bottles_per_box: ppb,
        total_bottles: boxes * ppb,
      });
    }

    localStorage.removeItem(DISPATCH_DRAFT_KEY);
    setSaving(false);
    setLastDispatch({ dispatch_id, total_boxes: totalBoxesSelected });
    setStep('done');
    onRefresh();
  };

  const reset = () => {
    setHeader({ channel: 'OTHER', order_reference: '', notes: '' });
    setDocPhotos([]);
    setSkuCode('');
    setTotalBoxes('');
    setLotEntries([]);
    setScanErrors({});
    setAddingLot(false);
    setLastDispatch(null);
    localStorage.removeItem(DISPATCH_DRAFT_KEY);
    setHasDraft(false);
    setStep('details');
  };

  const goBack = () => {
    if (step === 'details') { onBack(); return; }
    if (step === 'product') { setStep('details'); return; }
    if (step === 'review') { setStep('product'); return; }
  };

  // ── Done ─────────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <p className="text-lg font-bold text-slate-900">Dispatch Confirmed!</p>
          <p className="text-sm text-slate-500">{lastDispatch?.dispatch_id}</p>
          <p className="text-sm text-slate-500 mt-1">{lastDispatch?.total_boxes} boxes dispatched.</p>
        </div>
        <Button onClick={reset} className="mt-2 h-14 px-8 text-base min-w-[200px]">🚚 New Dispatch</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      {/* Photo viewer */}
      {viewPhoto && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setViewPhoto(null)}>
          <button className="absolute top-4 right-4 text-white bg-black/50 rounded-full w-12 h-12 flex items-center justify-center">
            <X className="w-6 h-6" />
          </button>
          <img src={viewPhoto} className="max-w-full max-h-full rounded-lg object-contain" alt="Document" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2">
        <button onClick={goBack} className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors">
          <ChevronLeft className="w-6 h-6 text-slate-700" />
        </button>
        <h2 className="text-lg font-bold text-slate-900">Dispatch Stock</h2>
      </div>

      {/* Draft resume banner */}
      {hasDraft && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-amber-800">📝 Resume Draft Dispatch?</p>
            <p className="text-xs text-amber-600 mt-0.5">You have an unsaved dispatch in progress.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => { localStorage.removeItem(DISPATCH_DRAFT_KEY); setHasDraft(false); }} className="h-10 text-sm">Discard</Button>
            <Button size="sm" onClick={loadDraft} className="h-10 text-sm bg-amber-600 hover:bg-amber-700">Resume</Button>
          </div>
        </div>
      )}

      <StepBar steps={STEPS} current={step} />

      {/* ── STEP 1: Dispatch Details ────────────────────────────────────────── */}
      {step === 'details' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
            <p className="text-sm font-bold text-slate-700">🚚 Dispatch Details</p>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Channel *</Label>
              <select value={header.channel} onChange={e => setHeader(h => ({ ...h, channel: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-base bg-white min-h-[52px]">
                {CHANNELS.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Order / Reference No.</Label>
              <Input value={header.order_reference} onChange={e => setHeader(h => ({ ...h, order_reference: e.target.value }))} placeholder="e.g. SO-1234" className="h-12" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-500">
                Document Photos <span className="text-slate-400">({docPhotos.length} added)</span>
              </Label>
              {docPhotos.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {docPhotos.map((url, idx) => (
                    <div key={idx} className="relative">
                      <img src={url} onClick={() => setViewPhoto(url)} className="w-16 h-16 object-cover rounded-lg border border-slate-200 cursor-pointer" alt="" />
                      <button onClick={() => setDocPhotos(p => p.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer border border-dashed border-slate-300 rounded-xl px-4 py-4 hover:bg-slate-50 w-full justify-center min-h-[56px]">
                {uploading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : <Camera className="w-5 h-5 text-slate-400" />}
                <span className="text-sm text-slate-500 font-medium">
                  {uploading ? 'Uploading…' : docPhotos.length > 0 ? '+ Add Another Photo' : '📷 Take / Upload Photo'}
                </span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} disabled={uploading} />
              </label>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Notes (optional)</Label>
              <Input value={header.notes} onChange={e => setHeader(h => ({ ...h, notes: e.target.value }))} className="h-11" />
            </div>
          </div>
          <Button className="w-full h-14 text-base font-bold" onClick={() => setStep('product')}>
            Next: Select Product →
          </Button>
        </div>
      )}

      {/* ── STEP 2: Product + Lots ─────────────────────────────────────────── */}
      {step === 'product' && (
        <div className="space-y-4">
          {/* SKU Selector */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-bold text-slate-700">📦 Select Product</p>
            {!sku_code ? (
              <select
                value=""
                onChange={e => {
                  setSkuCode(e.target.value);
                  setTotalBoxes('');
                  setLotEntries([]);
                  setScanErrors({});
                }}
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm bg-white min-h-[52px]"
              >
                <option value="">— Choose a product —</option>
                {skus.filter(s => s.is_active !== false).map(s => (
                  <option key={s.id} value={s.item_code}>
                    {s.product_name}{s.flavour ? ` (${s.flavour})` : ''}{s.brand_name ? ` · ${s.brand_name}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-start justify-between bg-slate-50 rounded-xl px-4 py-3">
                <div>
                  <p className="font-bold text-slate-900">{sku?.product_name || sku_code}</p>
                  {sku?.flavour && <p className="text-xs text-slate-400">{sku.flavour}</p>}
                  {sku?.brand_name && <p className="text-xs text-blue-600 font-semibold">{sku.brand_name}</p>}
                  <p className="text-xs text-slate-500 mt-0.5">
                    In stock: <strong>{activeLots.reduce((sum, l) => sum + (l.boxes_balance || 0), 0)}</strong> boxes
                  </p>
                </div>
                <button
                  onClick={() => { setSkuCode(''); setTotalBoxes(''); setLotEntries([]); setScanErrors({}); }}
                  className="text-xs text-blue-600 underline min-h-[44px] px-2 shrink-0"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Total boxes needed */}
          {sku_code && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-bold text-slate-700">🔢 How many boxes to dispatch?</p>
              <Input
                type="text" inputMode="numeric" pattern="[0-9]*"
                value={total_boxes}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '');
                  setTotalBoxes(v);
                  recomputeFifo(sku_code, v);
                }}
                placeholder="Enter total boxes needed"
                className="h-14 text-2xl font-bold text-center"
              />
            </div>
          )}

          {/* FIFO Lot Entries */}
          {lotEntries.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-700">📦 FIFO Lot Plan</p>
                <span className="text-xs text-slate-400">{totalBoxesSelected} boxes · {lotEntries.length} lot(s)</span>
              </div>
              {lotEntries.map(entry => {
                const lot = lots.find(l => l.lot_id === entry.lot_id);
                if (!lot) return null;
                const over = Number(entry.boxes) > (lot.boxes_balance || 0);
                return (
                  <div key={entry.lot_id} className={`rounded-xl border p-4 space-y-3 ${entry.verified ? 'bg-green-50 border-green-300' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold font-mono text-slate-900">{entry.lot_id}</p>
                        {lot.location && <p className="text-xs text-slate-500 mt-0.5">📍 {lot.location}</p>}
                        {lot.batch_code && <p className="text-xs text-slate-400">Batch: {lot.batch_code} · Exp: {fmtDate(lot.exp_date)}</p>}
                        <p className="text-xs text-slate-400">Available: <strong>{lot.boxes_balance}</strong> boxes</p>
                      </div>
                      <button onClick={() => removeEntry(entry.lot_id)} className="text-red-400 hover:text-red-600 min-w-[44px] min-h-[44px] flex items-center justify-center">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Editable qty */}
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Boxes to take from this lot *</Label>
                      <Input
                        type="text" inputMode="numeric" pattern="[0-9]*"
                        value={entry.boxes}
                        onChange={e => {
                          updateEntry(entry.lot_id, { boxes: e.target.value.replace(/\D/g, ''), verified: false });
                          setScanErrors(prev => ({ ...prev, [entry.lot_id]: '' }));
                        }}
                        className={`h-12 text-xl font-bold text-center ${over ? 'border-red-400 bg-red-50' : ''}`}
                        placeholder="0"
                      />
                      {over && <p className="text-xs text-red-600 font-semibold">⚠️ Exceeds balance! Max: {lot.boxes_balance}</p>}
                    </div>

                    {/* Scan to verify */}
                    {!entry.verified ? (
                      <div className="space-y-1.5">
                        <p className="text-xs text-slate-500">Scan the lot QR card to verify:</p>
                        <QRScanInput onScan={(val) => handleScan(entry.lot_id, val)} placeholder={`Scan QR for ${entry.lot_id}…`} />
                        {scanErrors[entry.lot_id] && (
                          <p className="text-xs text-red-600 font-semibold bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            ⚠️ {scanErrors[entry.lot_id]}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <p className="text-xs text-green-700 font-semibold">✅ Verified — ready to dispatch</p>
                        <button onClick={() => updateEntry(entry.lot_id, { verified: false })} className="text-xs text-slate-400 underline ml-auto min-h-[44px] px-2">Re-scan</button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add another lot */}
              {availableLots.length > 0 && (
                addingLot ? (
                  <div className="bg-white border border-dashed border-slate-300 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-slate-600">Select a lot to add:</p>
                    <select
                      defaultValue=""
                      onChange={e => addLot(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm bg-white min-h-[52px]"
                    >
                      <option value="">— Select a lot —</option>
                      {availableLots.sort((a, b) => lotKey(a).localeCompare(lotKey(b))).map(l => (
                        <option key={l.id} value={l.lot_id}>
                          {l.lot_id}{l.location ? ` · 📍 ${l.location}` : ''} — {l.boxes_balance} boxes avail.
                        </option>
                      ))}
                    </select>
                    <button onClick={() => setAddingLot(false)} className="text-xs text-slate-400 underline min-h-[44px] px-2">Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingLot(true)}
                    className="w-full border border-dashed border-slate-300 rounded-xl py-4 text-sm text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-2 min-h-[56px]"
                  >
                    <Plus className="w-4 h-4" /> Add Another Lot
                  </button>
                )
              )}
            </div>
          )}

          {/* No stock warning */}
          {sku_code && total_boxes && Number(total_boxes) > 0 && lotEntries.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700 font-semibold">No active stock available for this product</p>
            </div>
          )}

          <Button className="w-full h-14 text-base font-bold" onClick={() => setStep('review')} disabled={!canReview}>
            Next: Review Dispatch →
          </Button>
          {!canReview && lotEntries.length > 0 && (
            <p className="text-xs text-center text-slate-400">
              {!allVerified ? 'Scan all lots to continue' : exceedingEntries.length > 0 ? 'Fix quantities exceeding lot balance' : ''}
            </p>
          )}
        </div>
      )}

      {/* ── STEP 3: Review ─────────────────────────────────────────────────── */}
      {step === 'review' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm font-bold text-blue-800">📋 Review Dispatch</p>
            <p className="text-xs text-blue-600 mt-0.5">
              {header.channel.replace('_', ' ')}{header.order_reference ? ` · Ref: ${header.order_reference}` : ''}
            </p>
          </div>

          <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b border-slate-100">
              <div>
                {sku?.brand_name && <p className="text-xs font-semibold text-blue-600">{sku.brand_name}</p>}
                <p className="font-bold text-slate-900">{sku?.product_name || sku_code}</p>
                {sku?.flavour && <p className="text-xs text-slate-400">{sku.flavour}</p>}
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-slate-900">{totalBoxesSelected}</p>
                <p className="text-xs text-slate-400">boxes</p>
                <p className="text-xs text-slate-500">
                  {lotEntries.reduce((sum, e) => {
                    const lot = lots.find(l => l.lot_id === e.lot_id);
                    return sum + Number(e.boxes) * (lot?.bottles_per_box || 1);
                  }, 0).toLocaleString()} bottles
                </p>
              </div>
            </div>
            <div className="p-3 space-y-2">
              {lotEntries.map(entry => {
                const lot = lots.find(l => l.lot_id === entry.lot_id);
                return (
                  <div key={entry.lot_id} className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                    <div>
                      <p className="text-xs font-bold font-mono text-slate-800">{entry.lot_id}</p>
                      {lot?.location && <p className="text-xs text-slate-500">📍 {lot.location}</p>}
                      {lot?.batch_code && <p className="text-xs text-slate-400">Batch: {lot.batch_code}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-800">{entry.boxes} boxes</p>
                        <p className="text-xs text-slate-500">{Number(entry.boxes) * (lot?.bottles_per_box || 1)} btl</p>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl p-4 text-white">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Total Dispatch</p>
            <div className="flex justify-between items-center">
              <p className="text-sm text-slate-300">{lotEntries.length} Lot(s)</p>
              <div className="text-right">
                <p className="text-3xl font-black">{totalBoxesSelected} boxes</p>
                <p className="text-sm text-slate-400">
                  {lotEntries.reduce((sum, e) => {
                    const lot = lots.find(l => l.lot_id === e.lot_id);
                    return sum + Number(e.boxes) * (lot?.bottles_per_box || 1);
                  }, 0).toLocaleString()} bottles
                </p>
              </div>
            </div>
          </div>

          <Button className="w-full h-14 text-base font-bold" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : '✅ Confirm Dispatch'}
          </Button>
        </div>
      )}
    </div>
  );
}