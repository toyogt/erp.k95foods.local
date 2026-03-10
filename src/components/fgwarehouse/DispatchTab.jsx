import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { Loader2, Camera, CheckCircle2, ChevronLeft, X, AlertTriangle } from 'lucide-react';
import QRScanInput from './QRScanInput';
import StepBar from './StepBar';
import { genId, todayStr, fmtDate } from './whHelpers';

const CHANNELS = ['SHOPIFY', 'AMAZON', 'PICKLIST', 'SALES_ORDER', 'OTHER'];
const STEPS = [
  { id: 'details', label: 'Details' },
  { id: 'products', label: 'Products' },
  { id: 'review', label: 'Review' },
];

let _lineId = 0;
function newProductLine() {
  return { id: ++_lineId, sku_code: '', total_boxes: '', suggestions: [], shortage: 0 };
}

function computeSuggestions(sku_code, total_boxes, lots) {
  if (!sku_code || !total_boxes || Number(total_boxes) <= 0) return { suggestions: [], shortage: 0 };
  const skuLots = lots
    .filter(l => l.sku_code === sku_code && l.status === 'ACTIVE' && (l.boxes_balance || 0) > 0)
    .sort((a, b) => {
      const key = l => (l.lot_date || '') + String(l.lot_seq || 0).padStart(4, '0');
      return key(a).localeCompare(key(b));
    });
  const suggestions = [];
  let remaining = Number(total_boxes);
  for (const lot of skuLots) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, lot.boxes_balance || 0);
    suggestions.push({ lot_id: lot.lot_id, lot, boxes: take, verified: false });
    remaining -= take;
  }
  return { suggestions, shortage: remaining };
}

export default function DispatchTab({ skus, lots, onRefresh, user, onBack }) {
  const [step, setStep] = useState('details');
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [step]);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastDispatch, setLastDispatch] = useState(null);
  const [viewPhoto, setViewPhoto] = useState(null);
  const [docPhotos, setDocPhotos] = useState([]);
  const [header, setHeader] = useState({ channel: 'OTHER', order_reference: '', notes: '' });
  const [productLines, setProductLines] = useState([newProductLine()]);

  const updateLine = (id, patch) => {
    setProductLines(prev => prev.map(pl => {
      if (pl.id !== id) return pl;
      const updated = { ...pl, ...patch };
      if ('sku_code' in patch || 'total_boxes' in patch) {
        const { suggestions, shortage } = computeSuggestions(updated.sku_code, updated.total_boxes, lots);
        // Preserve verified state only if lot_id AND boxes match
        const prevSugs = pl.suggestions;
        const merged = suggestions.map(s => {
          const prev = prevSugs.find(p => p.lot_id === s.lot_id && p.boxes === s.boxes);
          return prev?.verified ? { ...s, verified: true } : s;
        });
        return { ...updated, suggestions: merged, shortage };
      }
      return updated;
    }));
  };

  const verifyScan = (lineId, lot_id) => {
    setProductLines(prev => prev.map(pl => {
      if (pl.id !== lineId) return pl;
      return { ...pl, suggestions: pl.suggestions.map(s => s.lot_id === lot_id ? { ...s, verified: true } : s) };
    }));
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

  const allVerified = productLines.length > 0 && productLines.every(pl =>
    pl.sku_code && Number(pl.total_boxes) > 0 &&
    pl.suggestions.length > 0 && pl.suggestions.every(s => s.verified)
  );

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

    for (const pl of productLines) {
      for (const s of pl.suggestions) {
        const { lot, boxes } = s;
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
    }

    setSaving(false);
    setLastDispatch({ dispatch_id, count: productLines.length });
    setStep('done');
    onRefresh();
  };

  const reset = () => {
    setHeader({ channel: 'OTHER', order_reference: '', notes: '' });
    setDocPhotos([]);
    setProductLines([newProductLine()]);
    setStep('details');
    setLastDispatch(null);
  };

  const goBack = () => {
    if (step === 'details') { onBack(); return; }
    if (step === 'products') { setStep('details'); return; }
    if (step === 'review') { setStep('products'); return; }
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
          <p className="text-sm text-slate-500 mt-1">{lastDispatch?.count} product(s) dispatched.</p>
        </div>
        <Button onClick={reset} className="mt-2 h-12 px-8 text-base">🚚 Record Another</Button>
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

      <StepBar steps={STEPS} current={step} />

      {/* ── STEP 1: Dispatch Details ─────────────────────────────────────────── */}
      {step === 'details' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
            <p className="text-sm font-bold text-slate-700">🚚 Dispatch Details</p>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Channel *</Label>
              <select value={header.channel} onChange={e => setHeader(h => ({ ...h, channel: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-base bg-white min-h-[48px]">
                {CHANNELS.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Order / Reference No.</Label>
              <Input value={header.order_reference} onChange={e => setHeader(h => ({ ...h, order_reference: e.target.value }))} placeholder="e.g. SO-1234" className="h-11" />
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
          <Button className="w-full h-12 text-base font-bold" onClick={() => setStep('products')}>
            Next: Add Products →
          </Button>
        </div>
      )}

      {/* ── STEP 2: Products ─────────────────────────────────────────────────── */}
      {step === 'products' && (
        <div className="space-y-4">
          {productLines.map((pl, idx) => (
            <ProductLineCard
              key={pl.id}
              pl={pl}
              idx={idx}
              skus={skus}
              lots={lots}
              onUpdate={(patch) => updateLine(pl.id, patch)}
              onVerify={(lot_id) => verifyScan(pl.id, lot_id)}
              onRemove={productLines.length > 1 ? () => setProductLines(prev => prev.filter(p => p.id !== pl.id)) : null}
            />
          ))}
          <button
            onClick={() => setProductLines(prev => [...prev, newProductLine()])}
            className="w-full border border-dashed border-slate-300 rounded-xl py-4 text-sm text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-2 min-h-[56px]"
          >
            + Add Another Product
          </button>
          <Button className="w-full h-12 text-base font-bold" onClick={() => setStep('review')} disabled={!allVerified}>
            Next: Review Dispatch →
          </Button>
          {!allVerified && (
            <p className="text-xs text-center text-slate-400">Select products, enter quantities, and scan all lots to continue</p>
          )}
        </div>
      )}

      {/* ── STEP 3: Review ───────────────────────────────────────────────────── */}
      {step === 'review' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm font-bold text-blue-800">📋 Review Dispatch</p>
            <p className="text-xs text-blue-600 mt-0.5">
              {header.channel.replace('_', ' ')}{header.order_reference ? ` · Ref: ${header.order_reference}` : ''}
            </p>
          </div>

          {productLines.map((pl) => {
            const sku = skus.find(s => s.item_code === pl.sku_code);
            const actualBoxes = pl.suggestions.reduce((sum, s) => sum + s.boxes, 0);
            const totalBottles = pl.suggestions.reduce((sum, s) => sum + s.boxes * (s.lot.bottles_per_box || 1), 0);
            return (
              <div key={pl.id} className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                <div className="p-4 flex items-center justify-between border-b border-slate-100">
                  <div>
                    {sku?.brand_name && <p className="text-xs font-semibold text-blue-600">{sku.brand_name}</p>}
                    <p className="font-bold text-slate-900">{sku?.product_name || pl.sku_code}</p>
                    {sku?.flavour && <p className="text-xs text-slate-400">{sku.flavour}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black text-slate-900">{actualBoxes}</p>
                    <p className="text-xs text-slate-400">boxes</p>
                    <p className="text-xs text-slate-500">{totalBottles.toLocaleString()} bottles</p>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  {pl.suggestions.map(s => (
                    <div key={s.lot_id} className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                      <div>
                        <p className="text-xs font-bold font-mono text-slate-800">{s.lot_id}</p>
                        {s.lot.location && <p className="text-xs text-slate-500">📍 {s.lot.location}</p>}
                        {s.lot.batch_code && <p className="text-xs text-slate-400">Batch: {s.lot.batch_code}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-800">{s.boxes} boxes</p>
                          <p className="text-xs text-slate-500">{s.boxes * (s.lot.bottles_per_box || 1)} btl</p>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                      </div>
                    </div>
                  ))}
                  {pl.shortage > 0 && (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <p className="text-xs text-amber-700 font-semibold">
                        {pl.shortage} boxes short — dispatching {actualBoxes} of {pl.total_boxes} requested
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Grand Total */}
          <div className="bg-slate-900 rounded-xl p-4 text-white">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Grand Total</p>
            <div className="flex justify-between items-center">
              <p className="text-sm text-slate-300">{productLines.length} Product(s)</p>
              <div className="text-right">
                <p className="text-3xl font-black">
                  {productLines.reduce((sum, pl) => sum + pl.suggestions.reduce((s2, s) => s2 + s.boxes, 0), 0)} boxes
                </p>
                <p className="text-sm text-slate-400">
                  {productLines.reduce((sum, pl) => sum + pl.suggestions.reduce((s2, s) => s2 + s.boxes * (s.lot.bottles_per_box || 1), 0), 0).toLocaleString()} bottles
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

// ── Product Line Card ─────────────────────────────────────────────────────────
function ProductLineCard({ pl, idx, skus, lots, onUpdate, onVerify, onRemove }) {
  const [scanErrors, setScanErrors] = useState({});

  const activeSku = skus.find(s => s.item_code === pl.sku_code);
  const totalAvailable = lots
    .filter(l => l.sku_code === pl.sku_code && l.status === 'ACTIVE')
    .reduce((sum, l) => sum + (l.boxes_balance || 0), 0);

  const handleScan = (lot_id, scannedId) => {
    if (scannedId === lot_id) {
      setScanErrors(e => ({ ...e, [lot_id]: '' }));
      onVerify(lot_id);
    } else {
      setScanErrors(e => ({ ...e, [lot_id]: `Wrong lot scanned! Expected: ${lot_id}` }));
    }
  };

  const activeSkus = skus.filter(s => s.is_active !== false);
  const boxesOver = pl.total_boxes && Number(pl.total_boxes) > totalAvailable;

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Product {idx + 1}</p>
          {onRemove && (
            <button onClick={onRemove} className="text-red-400 hover:text-red-600 min-w-[48px] min-h-[48px] flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* SKU Selector */}
        {!pl.sku_code ? (
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Select Product *</Label>
            <select
              value=""
              onChange={e => onUpdate({ sku_code: e.target.value, total_boxes: '' })}
              className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm bg-white min-h-[52px]"
            >
              <option value="">— Choose a product —</option>
              {activeSkus.map(s => (
                <option key={s.id} value={s.item_code}>
                  {s.product_name}{s.flavour ? ` (${s.flavour})` : ''}{s.brand_name ? ` · ${s.brand_name}` : ''}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-start justify-between bg-slate-50 rounded-xl px-4 py-3">
            <div>
              <p className="font-bold text-slate-900 text-sm">{activeSku?.product_name || pl.sku_code}</p>
              {activeSku?.flavour && <p className="text-xs text-slate-400">{activeSku.flavour}</p>}
              {activeSku?.brand_name && <p className="text-xs text-blue-600 font-semibold">{activeSku.brand_name}</p>}
              <p className="text-xs text-slate-500 mt-0.5">In stock: <strong>{totalAvailable}</strong> boxes</p>
            </div>
            <button onClick={() => onUpdate({ sku_code: '', total_boxes: '' })} className="text-xs text-blue-600 underline min-h-[44px] px-2 shrink-0">Change</button>
          </div>
        )}

        {/* Boxes Input */}
        {pl.sku_code && (
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Boxes to Dispatch *</Label>
            <Input
              type="text" inputMode="numeric" pattern="[0-9]*"
              value={pl.total_boxes}
              onChange={e => onUpdate({ total_boxes: e.target.value.replace(/\D/g, '') })}
              placeholder={`Enter boxes (${totalAvailable} available)`}
              className={`h-14 text-2xl font-bold text-center ${boxesOver ? 'border-red-400 bg-red-50' : ''}`}
              autoFocus
            />
            {boxesOver && (
              <p className="text-xs text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                ⚠️ Only {totalAvailable} boxes available — will dispatch what's in stock
              </p>
            )}
          </div>
        )}
      </div>

      {/* FIFO Lot Plan */}
      {pl.suggestions.length > 0 && (
        <div className="border-t border-slate-100 bg-blue-50/40 p-4 space-y-3">
          <p className="text-xs font-bold text-slate-700">📦 FIFO Lot Plan — Scan each lot to verify</p>
          {pl.suggestions.map(s => (
            <div key={s.lot_id} className={`rounded-xl border p-4 space-y-3 transition-colors ${s.verified ? 'bg-green-50 border-green-300' : 'bg-white border-slate-200'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold font-mono text-slate-900">{s.lot_id}</p>
                  {s.lot.location && <p className="text-xs text-slate-600 mt-0.5">📍 {s.lot.location}</p>}
                  {s.lot.batch_code && <p className="text-xs text-slate-400">Batch: {s.lot.batch_code} · Exp: {fmtDate(s.lot.exp_date)}</p>}
                  <p className="text-xs text-slate-400">Lot balance: {s.lot.boxes_balance} boxes</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="text-2xl font-black text-slate-900">{s.boxes}</p>
                    <p className="text-xs text-slate-400">boxes</p>
                  </div>
                  {s.verified && <CheckCircle2 className="w-6 h-6 text-green-600" />}
                </div>
              </div>
              {!s.verified ? (
                <div className="space-y-1.5">
                  <p className="text-xs text-slate-500">Scan the QR card on this lot to confirm:</p>
                  <QRScanInput onScan={(val) => handleScan(s.lot_id, val)} placeholder={`Scan QR for ${s.lot_id}…`} />
                  {scanErrors[s.lot_id] && (
                    <p className="text-xs text-red-600 font-semibold bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      ⚠️ {scanErrors[s.lot_id]}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-green-700 font-semibold">✅ Verified — ready to dispatch</p>
              )}
            </div>
          ))}
          {pl.shortage > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700 font-semibold">
                {pl.shortage} boxes short — only {Number(pl.total_boxes) - pl.shortage} boxes available in stock
              </p>
            </div>
          )}
        </div>
      )}

      {/* No stock warning */}
      {pl.sku_code && pl.total_boxes && Number(pl.total_boxes) > 0 && pl.suggestions.length === 0 && (
        <div className="border-t border-slate-100 bg-amber-50 px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700 font-semibold">No active stock available for this product</p>
        </div>
      )}
    </div>
  );
}