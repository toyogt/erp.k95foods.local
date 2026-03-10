import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useEffect, useRef } from 'react';
import { Loader2, Camera, CheckCircle2, ChevronLeft, X, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { useOffline } from '@/components/OfflineProvider';
import QRScanInput from './QRScanInput';
import StepBar from './StepBar';
import { genId, todayStr, fmtDate } from './whHelpers';

const CHANNELS = ['SHOPIFY', 'AMAZON', 'PICKLIST', 'SALES_ORDER', 'OTHER'];
const STEPS = [
  { id: 'details', label: 'Details' },
  { id: 'products', label: 'Products' },
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

// products array shape:
// [{ sku_code, total_boxes, lotEntries: [{lot_id, boxes, verified}], scanErrors: {}, addingLot: false }]

export default function DispatchTab({ skus, lots, onRefresh, user, onBack }) {
  const { isOnline } = useOffline();
  const [step, setStep] = useState('details');
  const [saving, setSaving] = useState(false);
  const [lastDispatch, setLastDispatch] = useState(null);
  const [viewPhoto, setViewPhoto] = useState(null);
  const [hasDraft, setHasDraft] = useState(false);
  const uploadQueueRef = useRef({});

  const [header, setHeader] = useState({ channel: 'OTHER', order_reference: '', notes: '' });
  const [docPhotos, setDocPhotos] = useState([]); // [{localUrl, serverUrl, uploading}]
  const [products, setProducts] = useState([]); // multi-SKU
  const [addingProduct, setAddingProduct] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(DISPATCH_DRAFT_KEY);
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (d.step && d.step !== 'done') setHasDraft(true);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (step === 'done') return;
    const hasMeaningfulData = step !== 'details' || header.order_reference || header.notes || docPhotos.length > 0 || products.length > 0;
    if (!hasMeaningfulData) {
      localStorage.removeItem(DISPATCH_DRAFT_KEY);
      return;
    }
    localStorage.setItem(DISPATCH_DRAFT_KEY, JSON.stringify({
      step, header,
      docPhotos: docPhotos.filter(p => p.serverUrl).map(p => ({ localUrl: p.serverUrl, serverUrl: p.serverUrl, uploading: false })),
      products: products.map(p => ({ ...p, scanErrors: {}, addingLot: false })),
    }));
  }, [step, header, docPhotos, products]);

  // Clear draft when navigating away (tab switch). Draft only persists across page refresh/browser close.
  useEffect(() => {
    return () => { localStorage.removeItem(DISPATCH_DRAFT_KEY); };
  }, []);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [step]);

  const loadDraft = () => {
    const raw = localStorage.getItem(DISPATCH_DRAFT_KEY);
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      setStep(d.step || 'details');
      setHeader(d.header || { channel: 'OTHER', order_reference: '', notes: '' });
      setDocPhotos(d.docPhotos || []);
      setProducts(d.products || []);
      setHasDraft(false);
    } catch (e) {}
  };

  // ── Grand total across all products ──────────────────────────────────────
  const grandTotalBoxes = products.reduce((sum, p) =>
    sum + p.lotEntries.reduce((s, e) => s + Number(e.boxes || 0), 0), 0);

  // ── All-valid check ───────────────────────────────────────────────────────
  const allProductsValid = products.length > 0 && products.every(p => {
    if (!p.sku_code || !p.total_boxes || Number(p.total_boxes) <= 0) return false;
    if (p.lotEntries.length === 0) return false;
    if (!p.lotEntries.every(e => e.verified)) return false;
    const totalSelected = p.lotEntries.reduce((s, e) => s + Number(e.boxes || 0), 0);
    if (totalSelected > Number(p.total_boxes)) return false;
    if (p.lotEntries.some(e => {
      const lot = lots.find(l => l.lot_id === e.lot_id);
      return lot && Number(e.boxes) > (lot.boxes_balance || 0);
    })) return false;
    return true;
  });

  const usedSkus = products.map(p => p.sku_code);
  const availableSkusToAdd = skus.filter(s => s.is_active !== false && !usedSkus.includes(s.item_code));

  // ── Product helpers ───────────────────────────────────────────────────────
  const addProduct = (sku_code) => {
    if (!sku_code || usedSkus.includes(sku_code)) return;
    setProducts(prev => [...prev, { sku_code, total_boxes: '', lotEntries: [], scanErrors: {}, addingLot: false }]);
    setAddingProduct(false);
  };

  const removeProduct = (sku_code) => {
    setProducts(prev => prev.filter(p => p.sku_code !== sku_code));
  };

  const updateProductField = (sku_code, field, value) => {
    setProducts(prev => prev.map(p => p.sku_code === sku_code ? { ...p, [field]: value } : p));
  };

  const recomputeFifoForProduct = (sku_code, total_boxes) => {
    const entries = computeFifo(sku_code, total_boxes, lots);
    setProducts(prev => prev.map(p =>
      p.sku_code === sku_code ? { ...p, total_boxes, lotEntries: entries, scanErrors: {}, addingLot: false } : p
    ));
  };

  const removeLotFromProduct = (sku_code, lot_id) => {
    setProducts(prev => prev.map(p =>
      p.sku_code === sku_code ? { ...p, lotEntries: p.lotEntries.filter(e => e.lot_id !== lot_id) } : p
    ));
  };

  const updateLotEntry = (sku_code, lot_id, patch) => {
    setProducts(prev => prev.map(p =>
      p.sku_code === sku_code
        ? { ...p, lotEntries: p.lotEntries.map(e => e.lot_id === lot_id ? { ...e, ...patch } : e) }
        : p
    ));
  };

  const addLotToProduct = (sku_code, lot_id) => {
    if (!lot_id) return;
    setProducts(prev => prev.map(p => {
      if (p.sku_code !== sku_code) return p;
      if (p.lotEntries.some(e => e.lot_id === lot_id)) return p;
      return { ...p, lotEntries: [...p.lotEntries, { lot_id, boxes: '', verified: false }], addingLot: false };
    }));
  };

  const setScanError = (sku_code, lot_id, msg) => {
    setProducts(prev => prev.map(p =>
      p.sku_code === sku_code ? { ...p, scanErrors: { ...p.scanErrors, [lot_id]: msg } } : p
    ));
  };

  const handleScanForProduct = (sku_code, lot_id, scanned) => {
    if (scanned === lot_id) {
      setScanError(sku_code, lot_id, '');
      updateLotEntry(sku_code, lot_id, { verified: true });
    } else {
      setScanError(sku_code, lot_id, `Wrong lot! Expected ${lot_id}`);
    }
  };

  // ── Photos ────────────────────────────────────────────────────────────────
  const anyPhotoUploading = docPhotos.some(p => p.uploading);

  const handlePhotoCapture = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    const localUrl = URL.createObjectURL(file);
    setDocPhotos(p => [...p, { localUrl, serverUrl: null, uploading: true }]);
    const promise = base44.integrations.Core.UploadFile({ file })
      .then(({ file_url }) => {
        setDocPhotos(p => p.map(ph => ph.localUrl === localUrl ? { ...ph, serverUrl: file_url, uploading: false } : ph));
        return file_url;
      })
      .catch(() => {
        setDocPhotos(p => p.map(ph => ph.localUrl === localUrl ? { ...ph, uploading: false, error: true } : ph));
        return null;
      });
    uploadQueueRef.current[localUrl] = promise;
  };

  const resolvePhotoUrls = async () => {
    const urls = await Promise.all(
      docPhotos.map(p => uploadQueueRef.current[p.localUrl] || Promise.resolve(p.serverUrl))
    );
    return urls.filter(Boolean).join(',');
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSaving(true);
    const today = todayStr();
    const dispatch_id = genId('DSP');
    const doc_photo = await resolvePhotoUrls();

    await base44.entities.WarehouseDispatch.create({
      dispatch_id,
      dispatch_date: today,
      dispatched_by: user?.full_name || user?.email || '',
      channel: header.channel,
      order_reference: header.order_reference || '',
      doc_photo,
      notes: header.notes || '',
      status: 'CONFIRMED',
    });

    for (const product of products) {
      for (const entry of product.lotEntries) {
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
    }

    localStorage.removeItem(DISPATCH_DRAFT_KEY);
    setSaving(false);
    setLastDispatch({ dispatch_id, total_boxes: grandTotalBoxes, sku_count: products.length });
    setStep('done');
    onRefresh();
  };

  const reset = () => {
    setHeader({ channel: 'OTHER', order_reference: '', notes: '' });
    setDocPhotos([]);
    uploadQueueRef.current = {};
    setProducts([]);
    setAddingProduct(false);
    setLastDispatch(null);
    localStorage.removeItem(DISPATCH_DRAFT_KEY);
    setHasDraft(false);
    setStep('details');
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
          <p className="text-sm text-slate-500 mt-1">
            {lastDispatch?.total_boxes} boxes · {lastDispatch?.sku_count} SKU(s) dispatched.
          </p>
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
        <button onClick={goBack} className="min-w-[52px] min-h-[52px] flex items-center justify-center rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors">
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
            <Button size="sm" variant="outline" onClick={() => { localStorage.removeItem(DISPATCH_DRAFT_KEY); setHasDraft(false); }} className="h-11 text-sm px-4">Discard</Button>
            <Button size="sm" onClick={loadDraft} className="h-11 text-sm px-4 bg-amber-600 hover:bg-amber-700">Resume</Button>
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
                  {docPhotos.map((p, idx) => (
                    <div key={idx} className="relative">
                      <img src={p.localUrl} onClick={() => !p.uploading && setViewPhoto(p.localUrl)} className="w-16 h-16 object-cover rounded-lg border border-slate-200 cursor-pointer" alt="" />
                      {p.uploading && (
                        <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                        </div>
                      )}
                      <button onClick={() => setDocPhotos(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer border border-dashed border-slate-300 rounded-xl px-4 py-4 hover:bg-slate-50 w-full justify-center min-h-[56px]">
                <Camera className="w-5 h-5 text-slate-400" />
                <span className="text-sm text-slate-500 font-medium">
                  {docPhotos.length > 0 ? '+ Add Another Photo' : '📷 Take / Upload Photo'}
                </span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
              </label>
              {anyPhotoUploading && (
                <p className="text-xs text-blue-600 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Uploading in background — you can continue
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Notes (optional)</Label>
              <Input value={header.notes} onChange={e => setHeader(h => ({ ...h, notes: e.target.value }))} className="h-11" />
            </div>
          </div>
          <Button className="w-full h-14 text-base font-bold" onClick={() => setStep('products')}>
            Next: Select Products →
          </Button>
        </div>
      )}

      {/* ── STEP 2: Products + Lots ─────────────────────────────────────────── */}
      {step === 'products' && (
        <div className="space-y-4">

          {products.map(product => {
            const sku = skus.find(s => s.item_code === product.sku_code);
            const activeLots = lots.filter(l => l.sku_code === product.sku_code && l.status === 'ACTIVE' && (l.boxes_balance || 0) > 0);
            const selectedLotIds = product.lotEntries.map(e => e.lot_id);
            const availableLots = activeLots.filter(l => !selectedLotIds.includes(l.lot_id));
            const totalBoxesSelected = product.lotEntries.reduce((s, e) => s + Number(e.boxes || 0), 0);
            const remaining = Number(product.total_boxes || 0) - totalBoxesSelected;
            const exceededTotal = product.total_boxes && totalBoxesSelected > Number(product.total_boxes);

            return (
              <div key={product.sku_code} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {/* Product header */}
                <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3 bg-slate-50 border-b border-slate-100">
                  <div>
                    {sku?.brand_name && <p className="text-xs font-semibold text-blue-600">{sku.brand_name}</p>}
                    <p className="font-bold text-slate-900">{sku?.product_name || product.sku_code}</p>
                    {sku?.flavour && <p className="text-xs text-slate-400">{sku.flavour}</p>}
                    <p className="text-xs text-slate-500 mt-0.5">
                      In stock: <strong>{activeLots.reduce((s, l) => s + (l.boxes_balance || 0), 0)}</strong> boxes
                    </p>
                  </div>
                  <button
                    onClick={() => removeProduct(product.sku_code)}
                    className="text-red-400 hover:text-red-600 min-w-[48px] min-h-[48px] flex items-center justify-center shrink-0"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  {/* Total boxes needed */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">How many boxes to dispatch? *</Label>
                    <Input
                      type="text" inputMode="numeric" pattern="[0-9]*"
                      value={product.total_boxes}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, '');
                        recomputeFifoForProduct(product.sku_code, v);
                      }}
                      placeholder="Enter total boxes"
                      className="h-14 text-2xl font-bold text-center"
                    />
                  </div>

                  {/* Lot entries */}
                  {product.lotEntries.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">FIFO Lots</p>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                          exceededTotal ? 'bg-red-100 text-red-700' :
                          remaining === 0 ? 'bg-green-100 text-green-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {totalBoxesSelected}/{product.total_boxes || 0} boxes
                          {remaining > 0 && ` · ${remaining} left`}
                          {exceededTotal && ` · ${totalBoxesSelected - Number(product.total_boxes)} over!`}
                        </span>
                      </div>

                      {exceededTotal && (
                        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                          <p className="text-xs text-red-700 font-semibold">
                            Total in lots ({totalBoxesSelected}) exceeds dispatch qty ({product.total_boxes}). Reduce lot quantities.
                          </p>
                        </div>
                      )}

                      {product.lotEntries.map(entry => {
                        const lot = lots.find(l => l.lot_id === entry.lot_id);
                        if (!lot) return null;
                        const overLot = Number(entry.boxes) > (lot.boxes_balance || 0);
                        return (
                          <div key={entry.lot_id} className={`rounded-xl border p-4 space-y-3 ${entry.verified ? 'bg-green-50 border-green-300' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-bold font-mono text-slate-900">{entry.lot_id}</p>
                                {lot.location && <p className="text-xs text-slate-500 mt-0.5">📍 {lot.location}</p>}
                                {lot.batch_code && <p className="text-xs text-slate-400">Batch: {lot.batch_code} · Exp: {fmtDate(lot.exp_date)}</p>}
                                <p className="text-xs text-slate-400">Available: <strong>{lot.boxes_balance}</strong> boxes</p>
                                {/* Remaining for this dispatch */}
                                {product.total_boxes && Number(product.total_boxes) > 0 && (
                                  <p className={`text-xs font-semibold mt-0.5 ${remaining < 0 ? 'text-red-600' : remaining === 0 ? 'text-green-600' : 'text-amber-600'}`}>
                                    {remaining > 0 ? `${remaining} boxes still needed` : remaining === 0 ? '✅ Qty matched' : `${Math.abs(remaining)} boxes over limit`}
                                  </p>
                                )}
                              </div>
                              <button onClick={() => removeLotFromProduct(product.sku_code, entry.lot_id)} className="text-red-400 hover:text-red-600 min-w-[48px] min-h-[48px] flex items-center justify-center">
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs text-slate-500">Boxes to take from this lot *</Label>
                              <Input
                                type="text" inputMode="numeric" pattern="[0-9]*"
                                value={entry.boxes}
                                onChange={e => {
                                  updateLotEntry(product.sku_code, entry.lot_id, { boxes: e.target.value.replace(/\D/g, ''), verified: false });
                                  setScanError(product.sku_code, entry.lot_id, '');
                                }}
                                className={`h-12 text-xl font-bold text-center ${overLot ? 'border-red-400 bg-red-50' : ''}`}
                                placeholder="0"
                              />
                              {overLot && <p className="text-xs text-red-600 font-semibold">⚠️ Exceeds lot balance! Max: {lot.boxes_balance}</p>}
                            </div>

                            {!entry.verified ? (
                              <div className="space-y-1.5">
                                <p className="text-xs text-slate-500">Scan the lot QR card to verify:</p>
                                <QRScanInput onScan={(val) => handleScanForProduct(product.sku_code, entry.lot_id, val)} placeholder={`Scan QR for ${entry.lot_id}…`} />
                                {product.scanErrors[entry.lot_id] && (
                                  <p className="text-xs text-red-600 font-semibold bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                    ⚠️ {product.scanErrors[entry.lot_id]}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                <p className="text-xs text-green-700 font-semibold">✅ Verified — ready to dispatch</p>
                                <button onClick={() => updateLotEntry(product.sku_code, entry.lot_id, { verified: false })} className="text-xs text-slate-400 underline ml-auto min-h-[44px] px-2">Re-scan</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* No lots yet message */}
                  {product.total_boxes && Number(product.total_boxes) > 0 && product.lotEntries.length === 0 && (
                    activeLots.length === 0 ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <p className="text-xs text-amber-700 font-semibold">No active stock available for this product</p>
                      </div>
                    ) : (
                      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-blue-500 shrink-0" />
                        <p className="text-xs text-blue-700 font-semibold">Add a lot below to continue</p>
                      </div>
                    )
                  )}

                  {/* Add another lot button — only when remaining > 0 */}
                  {product.total_boxes && Number(product.total_boxes) > 0 && remaining > 0 && availableLots.length > 0 && (
                    product.addingLot ? (
                      <div className="bg-white border border-dashed border-slate-300 rounded-xl p-4 space-y-2">
                        <p className="text-xs font-semibold text-slate-600">
                          Select a lot to add: <span className="text-amber-700 font-bold">({remaining} boxes still needed)</span>
                        </p>
                        <select
                          defaultValue=""
                          onChange={e => addLotToProduct(product.sku_code, e.target.value)}
                          className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm bg-white min-h-[52px]"
                        >
                          <option value="">— Select a lot —</option>
                          {availableLots.sort((a, b) => lotKey(a).localeCompare(lotKey(b))).map(l => (
                            <option key={l.id} value={l.lot_id}>
                              {l.lot_id}{l.location ? ` · 📍 ${l.location}` : ''} — {l.boxes_balance} boxes avail.
                            </option>
                          ))}
                        </select>
                        <button onClick={() => updateProductField(product.sku_code, 'addingLot', false)} className="text-xs text-slate-400 underline min-h-[44px] px-2">Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => updateProductField(product.sku_code, 'addingLot', true)}
                        className="w-full border border-dashed border-slate-300 rounded-xl py-4 text-sm text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-2 min-h-[56px]"
                      >
                        <Plus className="w-4 h-4" />
                        Add Another Lot
                        <span className="text-amber-600 font-semibold">({remaining} boxes remaining)</span>
                      </button>
                    )
                  )}

                  {/* All allocated confirmation */}
                  {product.total_boxes && Number(product.total_boxes) > 0 && remaining === 0 && product.lotEntries.length > 0 && !exceededTotal && (
                    <p className="text-xs text-green-700 font-semibold text-center py-1">✅ All {product.total_boxes} boxes allocated across lots</p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add Product button */}
          {addingProduct ? (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-bold text-slate-700">📦 Select Product to Add</p>
              {availableSkusToAdd.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-2">All active products already added</p>
              ) : (
                <select
                  defaultValue=""
                  onChange={e => addProduct(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm bg-white min-h-[52px]"
                >
                  <option value="">— Choose a product —</option>
                  {availableSkusToAdd.map(s => (
                    <option key={s.id} value={s.item_code}>
                      {s.product_name}{s.flavour ? ` (${s.flavour})` : ''}{s.brand_name ? ` · ${s.brand_name}` : ''}
                    </option>
                  ))}
                </select>
              )}
              <button onClick={() => setAddingProduct(false)} className="text-xs text-slate-400 underline min-h-[44px] px-2">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setAddingProduct(true)}
              className="w-full border-2 border-dashed border-blue-300 rounded-xl py-5 text-sm text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-2 min-h-[60px] font-semibold"
            >
              <Plus className="w-5 h-5" /> Add Product to Dispatch
            </button>
          )}

          <Button className="w-full h-14 text-base font-bold" onClick={() => setStep('review')} disabled={!allProductsValid}>
            Next: Review Dispatch →
          </Button>
          {!allProductsValid && products.length > 0 && (
            <p className="text-xs text-center text-slate-400">Scan all lots and fix quantity errors to continue</p>
          )}
          {products.length === 0 && (
            <p className="text-xs text-center text-slate-400">Add at least one product to continue</p>
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

          {products.map(product => {
            const sku = skus.find(s => s.item_code === product.sku_code);
            const totalSelected = product.lotEntries.reduce((s, e) => s + Number(e.boxes || 0), 0);
            const totalBottles = product.lotEntries.reduce((s, e) => {
              const lot = lots.find(l => l.lot_id === e.lot_id);
              return s + Number(e.boxes) * (lot?.bottles_per_box || 1);
            }, 0);
            return (
              <div key={product.sku_code} className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                <div className="p-4 flex items-center justify-between border-b border-slate-100">
                  <div>
                    {sku?.brand_name && <p className="text-xs font-semibold text-blue-600">{sku.brand_name}</p>}
                    <p className="font-bold text-slate-900">{sku?.product_name || product.sku_code}</p>
                    {sku?.flavour && <p className="text-xs text-slate-400">{sku.flavour}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black text-slate-900">{totalSelected}</p>
                    <p className="text-xs text-slate-400">boxes</p>
                    <p className="text-xs text-slate-500">{totalBottles.toLocaleString()} bottles</p>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  {product.lotEntries.map(entry => {
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
                            <p className="text-xs text-slate-500">{Number(entry.boxes) * (lot?.bottles_per_box || 1)} bottles</p>
                          </div>
                          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="bg-slate-900 rounded-xl p-4 text-white">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Total Dispatch</p>
            <div className="flex justify-between items-center">
              <p className="text-sm text-slate-300">{products.length} SKU(s) · {products.reduce((s, p) => s + p.lotEntries.length, 0)} Lot(s)</p>
              <div className="text-right">
                <p className="text-3xl font-black">{grandTotalBoxes} boxes</p>
                <p className="text-sm text-slate-400">
                  {products.reduce((sum, product) =>
                    sum + product.lotEntries.reduce((s, e) => {
                      const lot = lots.find(l => l.lot_id === e.lot_id);
                      return s + Number(e.boxes) * (lot?.bottles_per_box || 1);
                    }, 0)
                  , 0).toLocaleString()} bottles
                </p>
              </div>
            </div>
          </div>

          <Button className="w-full h-14 text-base font-bold" onClick={handleSubmit} disabled={saving || !isOnline}>
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : '✅ Confirm Dispatch'}
          </Button>
          {!isOnline && <p className="text-xs text-center text-red-500">You are offline — connect to confirm dispatch</p>}
        </div>
      )}
    </div>
  );
}