import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Camera, CheckCircle2, ChevronLeft, X, ZoomIn, MapPin, ScanLine } from 'lucide-react';
import QRScanInput from './QRScanInput';
import SKUSearchInput from './SKUSearchInput';
import BatchSearchInput from './BatchSearchInput';
import DateMaskInput, { focusNext } from './DateMaskInput';
import LotCardPrint from './LotCardPrint';
import StepBar from './StepBar';
import { genId, todayStr, formatLotId, getNextLotSeq, totalBottles, fmtDate } from './whHelpers';

const STEPS = [
  { id: 'doc', label: 'Document' },
  { id: 'product', label: 'Product' },
  { id: 'qty', label: 'Quantity' },
];
const RECEIVE_DRAFT_KEY = 'fgwh_receive_draft';

export default function ReceiveTab({ skus, lots, onRefresh, user, onBack }) {
  const [step, setStep] = useState('doc');
  const [hasDraft, setHasDraft] = useState(false);

  // Check for draft on mount
  useEffect(() => {
    const raw = localStorage.getItem(RECEIVE_DRAFT_KEY);
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (d.step && !['done', 'location'].includes(d.step)) setHasDraft(true);
      } catch (e) {}
    }
  }, []);

  // Scroll to top on every step change
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [step]);
  const [saving, setSaving] = useState(false);
  const [savingLoc, setSavingLoc] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [newLot, setNewLot] = useState(null);
  const [location, setLocation] = useState('');
  const [viewPhoto, setViewPhoto] = useState(null);

  // Doc step
  const [docPhotos, setDocPhotos] = useState([]);
  const [header, setHeader] = useState({ doc_number: '', notes: '' });

  // Product step
  const [sku_code, setSku_code] = useState('');
  const [batch_code, setBatch_code] = useState('');
  const [batchLocked, setBatchLocked] = useState(false); // true = existing batch
  const [mfg_date, setMfg_date] = useState('');
  const [exp_date, setExp_date] = useState('');

  // For existing batch: the verified target lot to ADD stock into
  const [targetLot, setTargetLot] = useState(null);
  const [lotScanError, setLotScanError] = useState('');

  // Qty step
  const [boxes_received, setBoxes_received] = useState('');
  const [loose_bottles_received, setLoose_bottles_received] = useState('');

  const sku = skus.find(s => s.item_code === sku_code);

  // Recent batches for this SKU (last 2 days)
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];
  const recentBatches = Object.values(
    lots
      .filter(l => l.sku_code === sku_code && l.batch_code && (l.lot_date || '') >= twoDaysAgoStr)
      .reduce((acc, l) => {
        if (!acc[l.batch_code]) acc[l.batch_code] = { batch_code: l.batch_code, mfg_date: l.mfg_date || '', exp_date: l.exp_date || '' };
        return acc;
      }, {})
  );

  // Suggested lots for existing batch (same sku + batch_code, ACTIVE)
  const suggestedLots = batchLocked && batch_code
    ? lots.filter(l => l.sku_code === sku_code && l.batch_code === batch_code && l.status === 'ACTIVE')
    : [];

  const handlePhotoCapture = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setDocPhotos(p => [...p, file_url]);
    setUploading(false);
  };

  const handleSkuChange = (code) => {
    setSku_code(code);
    setBatch_code('');
    setBatchLocked(false);
    setMfg_date('');
    setExp_date('');
    setTargetLot(null);
    setLotScanError('');
  };

  const handleBatchSelect = (code, mfg, exp) => {
    setBatch_code(code);
    setTargetLot(null);
    setLotScanError('');
    if (mfg && exp) {
      setMfg_date(mfg);
      setExp_date(exp);
      setBatchLocked(true);
    } else {
      setBatchLocked(false);
      setMfg_date('');
      setExp_date('');
    }
  };

  // Worker scans the QR of the lot they're standing at to confirm placement
  const handleLotPlacementScan = (scannedId) => {
    const lot = lots.find(l => l.lot_id === scannedId);
    if (!lot) {
      setLotScanError('Lot not found. Try scanning again.');
      return;
    }
    if (lot.sku_code !== sku_code) {
      setLotScanError(`Wrong product! This lot has: "${lot.product_name || lot.sku_code}". Expected: "${sku?.product_name || sku_code}"`);
      return;
    }
    if (lot.batch_code !== batch_code) {
      setLotScanError(`Wrong batch! This lot has batch: "${lot.batch_code}" but you selected: "${batch_code}"`);
      return;
    }
    setTargetLot(lot);
    setLotScanError('');
  };

  // NEW BATCH: creates a new lot → location → print
  // EXISTING BATCH: adds stock to the scanned targetLot → done (no location/print)
  const handleSubmit = async () => {
    setSaving(true);
    const today = todayStr();
    const receipt_id = genId('RCV');
    const ppb = sku?.bottles_per_box || 1;
    const boxes = Number(boxes_received) || 0;
    const loose = Number(loose_bottles_received) || 0;

    await base44.entities.WarehouseReceipt.create({
      receipt_id,
      receipt_date: today,
      received_by: user?.full_name || user?.email || '',
      doc_number: header.doc_number,
      doc_photo: docPhotos.join(','),
      notes: header.notes || '',
      status: 'CONFIRMED',
    });

    if (batchLocked && targetLot) {
      // ── EXISTING BATCH: add stock to existing lot ──
      await base44.entities.WarehouseLot.update(targetLot.id, {
        boxes_in: (targetLot.boxes_in || 0) + boxes,
        loose_bottles_in: (targetLot.loose_bottles_in || 0) + loose,
        boxes_balance: (targetLot.boxes_balance || 0) + boxes,
        loose_bottles_balance: (targetLot.loose_bottles_balance || 0) + loose,
        status: 'ACTIVE',
      });
      await base44.entities.WarehouseReceiptLine.create({
        receipt_id,
        lot_id: targetLot.lot_id,
        sku_code: sku.item_code,
        product_name: sku.product_name,
        boxes_received: boxes,
        loose_bottles_received: loose,
        bottles_per_box: ppb,
        total_bottles: totalBottles(boxes, loose, ppb),
      });
      setSaving(false);
      setLastReceipt({ receipt_id });
      setNewLot(null);
      localStorage.removeItem(RECEIVE_DRAFT_KEY);
      setStep('done');
    } else {
      // ── NEW BATCH: create new lot ──
      const seq = await getNextLotSeq(today);
      const lot_id = formatLotId(today, seq);
      const created = await base44.entities.WarehouseLot.create({
        lot_id,
        lot_date: today,
        lot_seq: seq,
        sku_code: sku.item_code,
        product_name: sku.product_name,
        brand_name: sku.brand_name || '',
        product_family: sku.product_family || '',
        flavour: sku.flavour || '',
        batch_code,
        mfg_date,
        exp_date,
        bottles_per_box: ppb,
        boxes_in: boxes,
        loose_bottles_in: loose,
        boxes_balance: boxes,
        loose_bottles_balance: loose,
        status: 'ACTIVE',
        is_trial_pack: sku.is_trial_pack || false,
        location: '',
      });
      await base44.entities.WarehouseReceiptLine.create({
        receipt_id,
        lot_id,
        sku_code: sku.item_code,
        product_name: sku.product_name,
        boxes_received: boxes,
        loose_bottles_received: loose,
        bottles_per_box: ppb,
        total_bottles: totalBottles(boxes, loose, ppb),
      });
      setSaving(false);
      setLastReceipt({ receipt_id });
      setNewLot(created);
      setStep('location'); // only for new batch
    }
    onRefresh();
  };

  const handleSaveLocation = async () => {
    if (!newLot) { setStep('done'); return; }
    setSavingLoc(true);
    await base44.entities.WarehouseLot.update(newLot.id, { location });
    setNewLot(l => ({ ...l, location }));
    setSavingLoc(false);
    setStep('done');
    onRefresh();
  };

  const loadDraft = () => {
    const raw = localStorage.getItem(RECEIVE_DRAFT_KEY);
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      setStep(d.step || 'doc');
      setHeader(d.header || { doc_number: '', notes: '' });
      setDocPhotos(d.docPhotos || []);
      setSku_code(d.sku_code || '');
      setBatch_code(d.batch_code || '');
      setBatchLocked(d.batchLocked || false);
      setMfg_date(d.mfg_date || '');
      setExp_date(d.exp_date || '');
      setBoxes_received(d.boxes_received || '');
      setLoose_bottles_received(d.loose_bottles_received || '');
      setTargetLot(null);
      setLotScanError('');
      setHasDraft(false);
    } catch (e) {}
  };

  // Auto-save draft on state changes
  useEffect(() => {
    if (['done', 'location'].includes(step)) return;
    localStorage.setItem(RECEIVE_DRAFT_KEY, JSON.stringify({
      step, header, docPhotos, sku_code, batch_code, batchLocked, mfg_date, exp_date,
      boxes_received, loose_bottles_received,
    }));
  }, [step, header, docPhotos, sku_code, batch_code, batchLocked, mfg_date, exp_date, boxes_received, loose_bottles_received]);

  const reset = () => {
    setSku_code(''); setBatch_code(''); setBatchLocked(false); setMfg_date(''); setExp_date('');
    setTargetLot(null); setLotScanError('');
    setBoxes_received(''); setLoose_bottles_received('');
    setDocPhotos([]);
    setHeader({ doc_number: '', notes: '' });
    setLocation('');
    setNewLot(null);
    setLastReceipt(null);
    localStorage.removeItem(RECEIVE_DRAFT_KEY);
    setHasDraft(false);
    setStep('doc');
  };

  const goBack = () => {
    if (step === 'doc') { onBack(); return; }
    if (step === 'product') { setStep('doc'); return; }
    if (step === 'qty') { setStep('product'); return; }
  };

  const canGoToProduct = !!header.doc_number.trim() && docPhotos.length > 0;
  // For existing batch: must have scanned a target lot. For new batch: just need mfg+exp dates.
  const canGoToQty = !!(sku_code && batch_code && mfg_date && exp_date && (!batchLocked || targetLot));
  const canSubmit = Number(boxes_received) > 0 || Number(loose_bottles_received) > 0;



  // ── Location step (new batch only) ────────────────────────────────────────
  if (step === 'location') {
    return (
      <div className="space-y-5 pb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="font-bold text-slate-900">New Lot Created!</p>
            <p className="text-xs text-slate-400 font-mono">{newLot?.lot_id}</p>
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1">
          <p className="font-semibold text-slate-700">{newLot?.product_name}</p>
          {newLot?.flavour && <p className="text-xs text-slate-500">{newLot.flavour}</p>}
          <p className="text-xs text-slate-500">Batch: {newLot?.batch_code} · {newLot?.boxes_in} boxes</p>
          <p className="text-xs text-slate-500">Mfg: {fmtDate(newLot?.mfg_date)} · Exp: {fmtDate(newLot?.exp_date)}</p>
        </div>
        <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-500" />
            <p className="text-sm font-semibold text-slate-700">Set Warehouse Location</p>
          </div>
          <Input value={location} onChange={e => setLocation(e.target.value)} onKeyDown={focusNext} placeholder="e.g. Rack A-3, Bay 2" className="h-11" autoFocus />
          <p className="text-xs text-slate-400">Optional — skip and set later</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 h-12 text-base" onClick={() => setStep('done')}>Skip & Print</Button>
          <Button className="flex-1 h-12 text-base" onClick={handleSaveLocation} disabled={savingLoc}>
            {savingLoc ? <Loader2 className="w-5 h-5 animate-spin" /> : '💾 Save & Print'}
          </Button>
        </div>
      </div>
    );
  }

  // ── Done step ──────────────────────────────────────────────────────────────
  if (step === 'done') {
    const isExistingBatch = batchLocked && !newLot;
    const lotForPrint = newLot ? { ...newLot, location } : null;
    return (
      <div className="space-y-5 pb-8">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">Receipt Confirmed!</p>
            <p className="text-sm text-slate-500">{lastReceipt?.receipt_id}</p>
            {isExistingBatch && targetLot && (
              <p className="text-sm text-slate-500 mt-1">
                Stock added to <strong>{targetLot.lot_id}</strong>
                {targetLot.location ? ` — 📍 ${targetLot.location}` : ''}
              </p>
            )}
          </div>
        </div>
        {/* Only show print for NEW lots */}
        {lotForPrint && (
          <div className="border border-slate-200 rounded-xl p-4 bg-white">
            <p className="text-sm font-semibold text-slate-700 mb-3">🖨️ Print & attach new lot card to stock</p>
            <LotCardPrint lot={lotForPrint} />
          </div>
        )}
        <Button onClick={reset} className="w-full h-12 text-base">📥 Record Another Receipt</Button>
      </div>
    );
  }

  // ── Form steps ─────────────────────────────────────────────────────────────
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
        <h2 className="text-lg font-bold text-slate-900">Receive Stock</h2>
      </div>

      {/* Draft resume banner */}
      {hasDraft && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-amber-800">📝 Resume Draft Receipt?</p>
            <p className="text-xs text-amber-600 mt-0.5">You have an unsaved receipt in progress.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => { localStorage.removeItem(RECEIVE_DRAFT_KEY); setHasDraft(false); }} className="h-10 text-sm">Discard</Button>
            <Button size="sm" onClick={loadDraft} className="h-10 text-sm bg-amber-600 hover:bg-amber-700">Resume</Button>
          </div>
        </div>
      )}

      <StepBar steps={STEPS} current={step} />

      {/* ── STEP 1: Document ── */}
      {step === 'doc' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
            <p className="text-sm font-bold text-slate-700">📄 Document Details</p>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">DC / Challan Number <span className="text-red-500">*</span></Label>
              <Input
                value={header.doc_number}
                onChange={e => setHeader(h => ({ ...h, doc_number: e.target.value }))}
                onKeyDown={focusNext}
                placeholder="e.g. DC-12345"
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-500">
                Document Photos <span className="text-red-500">*</span>
                <span className="ml-1 text-slate-400">({docPhotos.length} added)</span>
              </Label>
              {docPhotos.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {docPhotos.map((url, idx) => (
                    <div key={idx} className="relative">
                      <img src={url} onClick={() => setViewPhoto(url)} className="w-16 h-16 object-cover rounded-lg border border-slate-200 cursor-pointer active:opacity-80" alt={`doc ${idx + 1}`} />
                      <button onClick={() => setDocPhotos(p => p.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow">
                        <X className="w-3 h-3" />
                      </button>
                      <div className="absolute bottom-0.5 right-0.5 bg-black/40 rounded-full p-0.5">
                        <ZoomIn className="w-2.5 h-2.5 text-white" />
                      </div>
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
              <Input value={header.notes} onChange={e => setHeader(h => ({ ...h, notes: e.target.value }))} onKeyDown={focusNext} className="h-11" />
            </div>
          </div>
          <Button className="w-full h-12 text-base font-bold" onClick={() => setStep('product')} disabled={!canGoToProduct}>
            Next: Select Product →
          </Button>
          {!canGoToProduct && (
            <p className="text-xs text-center text-slate-400">Enter DC number and take at least one photo to continue</p>
          )}
        </div>
      )}

      {/* ── STEP 2: Product & Batch ── */}
      {step === 'product' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-bold text-slate-700">📦 Select Product (SKU)</p>
            {/* SKUSearchInput already shows selected product details inside it — no extra info box needed */}
            <SKUSearchInput skus={skus} value={sku_code} onChange={handleSkuChange} />
          </div>

          {sku && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
              <p className="text-sm font-bold text-slate-700">🏭 Batch Information</p>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Batch Code *</Label>
                <BatchSearchInput
                  batches={recentBatches}
                  value={batchLocked ? batch_code : ''}
                  onSelect={handleBatchSelect}
                  placeholder="Type new or select recent batch…"
                />
                {!batchLocked && batch_code && (
                  <p className="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-1.5">✏️ New batch: <strong>{batch_code}</strong> — enter dates below</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">
                  Mfg. Date * {batchLocked && <span className="text-green-600 ml-1">🔒 auto-filled</span>}
                </Label>
                {batchLocked ? (
                  <div className="flex h-11 w-full rounded-xl border border-slate-100 bg-slate-50 px-3 items-center text-base font-bold text-slate-700">
                    {fmtDate(mfg_date)}
                  </div>
                ) : (
                  <DateMaskInput key={sku_code + '_mfg'} value={mfg_date} onChange={setMfg_date} maxToday={true} />
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">
                  Expiry Date * {batchLocked && <span className="text-green-600 ml-1">🔒 auto-filled</span>}
                </Label>
                {batchLocked ? (
                  <div className="flex h-11 w-full rounded-xl border border-slate-100 bg-slate-50 px-3 items-center text-base font-bold text-slate-700">
                    {fmtDate(exp_date)}
                  </div>
                ) : (
                  <DateMaskInput key={sku_code + '_exp'} value={exp_date} onChange={setExp_date} minDate={mfg_date} />
                )}
              </div>

              {/* ── Existing batch: suggest lot & scan to confirm placement ── */}
              {batchLocked && !targetLot && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <ScanLine className="w-5 h-5 text-slate-600 shrink-0" />
                    <p className="text-sm font-bold text-slate-800">📍 Confirm Lot Location</p>
                  </div>
                  <p className="text-xs text-slate-500">
                    Scan the QR card of the lot <strong>where you are placing this stock</strong> to confirm you're at the right location.
                  </p>

                  {/* Suggested lots for this batch */}
                  {suggestedLots.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-slate-600">Existing lots for this batch:</p>
                      {suggestedLots.map(l => (
                        <div key={l.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2.5">
                          <div>
                            <p className="text-xs font-bold text-slate-800 font-mono">{l.lot_id}</p>
                            {l.location && <p className="text-xs text-slate-500">📍 {l.location}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-slate-700">{l.boxes_balance} boxes</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <QRScanInput onScan={handleLotPlacementScan} placeholder="Scan lot QR card…" />
                  {lotScanError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                      <p className="text-xs font-bold text-red-700">{lotScanError}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Confirmed target lot */}
              {batchLocked && targetLot && (
                <div className="flex items-start gap-3 bg-green-50 border border-green-300 rounded-xl px-4 py-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-green-800">Lot Confirmed ✓</p>
                    <p className="text-xs text-green-700 font-mono mt-0.5">{targetLot.lot_id}</p>
                    {targetLot.location && <p className="text-xs text-green-700">📍 {targetLot.location}</p>}
                    <p className="text-xs text-green-700 mt-0.5">Current balance: {targetLot.boxes_balance} boxes</p>
                    <button onClick={() => { setTargetLot(null); setLotScanError(''); }} className="text-xs text-green-600 underline mt-1">
                      Scan a different lot
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <Button className="w-full h-12 text-base font-bold" onClick={() => setStep('qty')} disabled={!canGoToQty}>
            Next: Enter Quantity →
          </Button>
          {sku && batchLocked && !targetLot && (
            <p className="text-xs text-center text-slate-400">Scan the lot QR card to confirm placement location</p>
          )}
        </div>
      )}

      {/* ── STEP 3: Quantity ── */}
      {step === 'qty' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-1">
            <p className="text-xs text-blue-500 font-bold uppercase tracking-wide">Receiving for:</p>
            <p className="font-bold text-blue-900 text-base">{sku?.product_name}{sku?.flavour ? ` — ${sku.flavour}` : ''}</p>
            {sku?.brand_name && <p className="text-xs text-blue-700">{sku.brand_name}</p>}
            <p className="text-xs text-blue-700 mt-1">Batch: <strong>{batch_code}</strong></p>
            <p className="text-xs text-blue-700">Mfg: {fmtDate(mfg_date)} &nbsp;·&nbsp; Exp: {fmtDate(exp_date)}</p>
            {targetLot && (
              <p className="text-xs text-blue-700 mt-1">
                📍 Adding to lot: <strong>{targetLot.lot_id}</strong>{targetLot.location ? ` — ${targetLot.location}` : ''}
              </p>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
            <p className="text-sm font-bold text-slate-700">📦 Quantity Received</p>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Number of Boxes</Label>
              <Input
                type="text" inputMode="numeric" pattern="[0-9]*"
                value={boxes_received}
                onChange={e => setBoxes_received(e.target.value.replace(/\D/g, ''))}
                onKeyDown={focusNext}
                placeholder="0"
                className="h-14 text-2xl font-bold text-center"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Loose Bottles</Label>
              <Input
                type="text" inputMode="numeric" pattern="[0-9]*"
                value={loose_bottles_received}
                onChange={e => setLoose_bottles_received(e.target.value.replace(/\D/g, ''))}
                onKeyDown={focusNext}
                placeholder="0"
                className="h-14 text-2xl font-bold text-center"
              />
            </div>
            {(boxes_received || loose_bottles_received) && sku && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                <p className="text-3xl font-black text-green-700">
                  {totalBottles(boxes_received, loose_bottles_received, sku.bottles_per_box).toLocaleString()}
                </p>
                <p className="text-sm text-green-600">total bottles</p>
              </div>
            )}
          </div>

          <Button className="w-full h-14 text-base font-bold" onClick={handleSubmit} disabled={saving || !canSubmit}>
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : '✅ Confirm Receipt'}
          </Button>
        </div>
      )}
    </div>
  );
}