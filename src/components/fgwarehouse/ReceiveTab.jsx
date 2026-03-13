import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Camera, CheckCircle2, ChevronLeft, X, ZoomIn, Plus, Trash2 } from 'lucide-react';
import QRScanInput from './QRScanInput';
import SKUSearchInput from './SKUSearchInput';
import BatchSearchInput from './BatchSearchInput';
import DateMaskInput, { focusNext } from './DateMaskInput';
import LotCardPrint from './LotCardPrint';
import StepBar from './StepBar';
import { genId, todayStr, formatLotId, getNextLotSeq, totalBottles, fmtDate } from './whHelpers';
import { useOffline } from '@/components/OfflineProvider';

const STEPS = [
  { id: 'doc', label: 'Document' },
  { id: 'product', label: 'Product' },
  { id: 'qty', label: 'Quantity' },
];
const RECEIVE_DRAFT_KEY = 'fgwh_receive_draft';

const newEntry = () => ({ boxes: '', loose: '', location: '', targetLot: null, scanError: '' });

export default function ReceiveTab({ skus, lots, onRefresh, user, onBack }) {
  const { isOnline } = useOffline();
  const [step, setStep] = useState('doc');
  const [hasDraft, setHasDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewPhoto, setViewPhoto] = useState(null);
  const readyToSaveRef = useRef(false);

  // Photos — background upload (no blocking spinner)
  const [docPhotos, setDocPhotos] = useState([]); // [{localUrl, serverUrl, uploading, error}]
  const uploadQueueRef = useRef({});

  const [header, setHeader] = useState({ doc_number: '', notes: '' });
  const [sku_code, setSku_code] = useState('');
  const [batch_code, setBatch_code] = useState('');
  const [batchLocked, setBatchLocked] = useState(false);
  const [mfg_date, setMfg_date] = useState('');
  const [exp_date, setExp_date] = useState('');

  // Single lot entry
  const [lotEntry, setLotEntry] = useState(newEntry());
  const [lastReceipt, setLastReceipt] = useState(null);
  const [newLots, setNewLots] = useState([]);

  // ── Draft ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const raw = localStorage.getItem(RECEIVE_DRAFT_KEY);
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (d.step && d.step !== 'done' && (d.sku_code || d.header?.doc_number || d.header?.notes)) {
          setHasDraft(true);
          return; // don't enable auto-save until user chooses Resume or Discard
        }
      } catch {
        localStorage.removeItem(RECEIVE_DRAFT_KEY);
      }
    }
    readyToSaveRef.current = true;
  }, []);

  // Clear draft on unmount ONLY if receipt was completed
  useEffect(() => {
    return () => {
      if (step === 'done') {
        localStorage.removeItem(RECEIVE_DRAFT_KEY);
      }
    };
  }, [step]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [step]);

  useEffect(() => {
    if (!readyToSaveRef.current || step === 'done') return;
    const hasMeaningfulData = step !== 'doc' || header.doc_number || header.notes || docPhotos.length > 0;
    if (!hasMeaningfulData) {
      localStorage.removeItem(RECEIVE_DRAFT_KEY);
      return;
    }
    localStorage.setItem(RECEIVE_DRAFT_KEY, JSON.stringify({
      step, header,
      docPhotos: docPhotos.filter(p => p.serverUrl).map(p => ({ localUrl: p.serverUrl, serverUrl: p.serverUrl, uploading: false })),
      sku_code, batch_code, batchLocked, mfg_date, exp_date,
      lotEntry: { boxes: lotEntry.boxes, loose: lotEntry.loose, location: lotEntry.location, targetLotId: lotEntry.targetLot?.lot_id || null },
    }));
  }, [step, header, docPhotos, sku_code, batch_code, batchLocked, mfg_date, exp_date, lotEntry]);

  const loadDraft = () => {
    const raw = localStorage.getItem(RECEIVE_DRAFT_KEY);
    if (!raw) { setHasDraft(false); readyToSaveRef.current = true; return; }
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
      if (d.lotEntry) {
        setLotEntry({
          ...d.lotEntry,
          targetLot: d.lotEntry.targetLotId ? lots.find(l => l.lot_id === d.lotEntry.targetLotId) || null : null,
          scanError: '',
        });
      }
      setHasDraft(false);
      readyToSaveRef.current = true;
    } catch {
      localStorage.removeItem(RECEIVE_DRAFT_KEY);
      setHasDraft(false);
      readyToSaveRef.current = true;
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const sku = skus.find(s => s.item_code === sku_code);
  const anyPhotoUploading = docPhotos.some(p => p.uploading);

  // All batches for this SKU — no date restriction so older batches still appear
  const allBatches = Object.values(
    lots
      .filter(l => l.sku_code === sku_code && l.batch_code)
      .reduce((acc, l) => {
        if (!acc[l.batch_code]) acc[l.batch_code] = { batch_code: l.batch_code, mfg_date: l.mfg_date || '', exp_date: l.exp_date || '' };
        return acc;
      }, {})
  );

  // All lots for existing batch — include EMPTY/CLOSED so user can add stock back to zero-balance lots
  const suggestedLots = batchLocked && batch_code
    ? lots.filter(l => l.sku_code === sku_code && l.batch_code === batch_code)
    : [];

  // ── Photo Upload ───────────────────────────────────────────────────────────
  const handlePhotoCapture = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    const localUrl = URL.createObjectURL(file);
    // Show preview immediately — upload in background
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

  // ── Product & Batch ────────────────────────────────────────────────────────
  const handleSkuChange = (code) => {
    setSku_code(code);
    setBatch_code('');
    setBatchLocked(false);
    setMfg_date('');
    setExp_date('');
    setLotEntry(newEntry());
  };

  const handleBatchSelect = (code, mfg, exp) => {
    setBatch_code(code);
    if (mfg && exp) {
      setMfg_date(mfg);
      setExp_date(exp);
      setBatchLocked(true);
    } else {
      setBatchLocked(false);
      setMfg_date('');
      setExp_date('');
    }
    setLotEntry(newEntry());
  };

  // ── Lot Entry ──────────────────────────────────────────────────────────────
  const handleLotScan = (scannedId) => {
    const lot = lots.find(l => l.lot_id === scannedId);
    if (!lot) { 
      setLotEntry(prev => ({ ...prev, scanError: 'Lot not found. Please scan a valid lot QR code.' })); 
      return; 
    }
    if (lot.sku_code !== sku_code) { 
      setLotEntry(prev => ({ ...prev, scanError: `Wrong product: "${lot.product_name || lot.sku_code}". Please scan the correct lot.` })); 
      return; 
    }
    if (lot.batch_code !== batch_code) { 
      setLotEntry(prev => ({ ...prev, scanError: `Wrong batch: "${lot.batch_code}". Expected: "${batch_code}". Please scan the correct lot.` })); 
      return; 
    }
    setLotEntry(prev => ({ ...prev, targetLot: lot, scanError: '' }));
  };

  // ── Guards ─────────────────────────────────────────────────────────────────
  const canGoToProduct = !!header.doc_number.trim() && docPhotos.length > 0;
  const canGoToQty = !!(sku_code && batch_code && mfg_date && exp_date);
  const canSubmit = isOnline && !anyPhotoUploading && !saving && 
    (Number(lotEntry.boxes) > 0 || Number(lotEntry.loose) > 0) && 
    (!batchLocked || lotEntry.targetLot);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSaving(true);
    const today = todayStr();
    const receipt_id = genId('RCV');
    const ppb = sku?.bottles_per_box || 1;
    const doc_photo = await resolvePhotoUrls();

    await base44.entities.WarehouseReceipt.create({
      receipt_id, receipt_date: today,
      received_by: user?.full_name || user?.email || '',
      doc_number: header.doc_number, doc_photo,
      notes: header.notes || '', status: 'CONFIRMED',
    });

    const createdLots = [];
    const boxes = Number(lotEntry.boxes) || 0;
    const loose = Number(lotEntry.loose) || 0;

    if (batchLocked && lotEntry.targetLot) {
      const lot = lotEntry.targetLot;
      await base44.entities.WarehouseLot.update(lot.id, {
        boxes_in: (lot.boxes_in || 0) + boxes,
        loose_bottles_in: (lot.loose_bottles_in || 0) + loose,
        boxes_balance: (lot.boxes_balance || 0) + boxes,
        loose_bottles_balance: (lot.loose_bottles_balance || 0) + loose,
        status: 'ACTIVE',
      });
      await base44.entities.WarehouseReceiptLine.create({
        receipt_id, lot_id: lot.lot_id, sku_code: sku.item_code, product_name: sku.product_name,
        boxes_received: boxes, loose_bottles_received: loose, bottles_per_box: ppb,
        total_bottles: totalBottles(boxes, loose, ppb),
      });
    } else {
      const seq = await getNextLotSeq(today);
      const lot_id = formatLotId(today, seq);
      const created = await base44.entities.WarehouseLot.create({
        lot_id, lot_date: today, lot_seq: seq,
        sku_code: sku.item_code, product_name: sku.product_name,
        brand_name: sku.brand_name || '', product_family: sku.product_family || '',
        flavour: sku.flavour || '', batch_code, mfg_date, exp_date,
        bottles_per_box: ppb, boxes_in: boxes, loose_bottles_in: loose,
        boxes_balance: boxes, loose_bottles_balance: loose,
        status: 'ACTIVE', is_trial_pack: sku.is_trial_pack || false,
        location: lotEntry.location || '',
      });
      await base44.entities.WarehouseReceiptLine.create({
        receipt_id, lot_id, sku_code: sku.item_code, product_name: sku.product_name,
        boxes_received: boxes, loose_bottles_received: loose, bottles_per_box: ppb,
        total_bottles: totalBottles(boxes, loose, ppb),
      });
      createdLots.push(created);
    }
    localStorage.removeItem(RECEIVE_DRAFT_KEY);
    setSaving(false);
    setLastReceipt({ receipt_id });
    setNewLots(createdLots);
    setStep('done');
    onRefresh();
  };

  const reset = () => {
    setSku_code(''); setBatch_code(''); setBatchLocked(false); setMfg_date(''); setExp_date('');
    setLotEntry(newEntry());
    setDocPhotos([]); uploadQueueRef.current = {};
    setHeader({ doc_number: '', notes: '' });
    setNewLots([]); setLastReceipt(null);
    localStorage.removeItem(RECEIVE_DRAFT_KEY);
    setHasDraft(false);
    readyToSaveRef.current = true;
    setStep('doc');
  };

  const goBack = () => {
    if (step === 'doc') { onBack(); return; }
    if (step === 'product') { setStep('doc'); return; }
    if (step === 'qty') { setStep('product'); return; }
  };

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="space-y-5 pb-8">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">Receipt Confirmed!</p>
            <p className="text-sm text-slate-500">{lastReceipt?.receipt_id}</p>
            <p className="text-sm text-slate-500 mt-1">Stock added successfully.</p>
          </div>
        </div>
        {newLots.length > 0 && (
          <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-4">
            <p className="text-sm font-semibold text-slate-700">🖨️ Print & attach new lot cards</p>
            {newLots.map(lot => <LotCardPrint key={lot.id} lot={lot} />)}
          </div>
        )}
        <Button onClick={reset} className="w-full h-14 text-base min-h-[56px]">📥 Record Another Receipt</Button>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-8">
      {viewPhoto && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setViewPhoto(null)}>
          <button className="absolute top-4 right-4 text-white bg-black/50 rounded-full w-12 h-12 flex items-center justify-center">
            <X className="w-6 h-6" />
          </button>
          <img src={viewPhoto} className="max-w-full max-h-full rounded-lg object-contain" alt="Document" />
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={goBack} className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors">
          <ChevronLeft className="w-6 h-6 text-slate-700" />
        </button>
        <h2 className="text-lg font-bold text-slate-900">Receive Stock</h2>
      </div>

      {/* Offline warning */}
      {!isOnline && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-semibold">
          📵 You're offline — your progress is auto-saved as draft. Connect to submit.
        </div>
      )}

      {hasDraft && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 space-y-3">
          <div>
            <p className="text-base font-bold text-amber-900">📝 Resume Draft Receipt?</p>
            <p className="text-sm text-amber-700 mt-1">You have an unsaved receipt in progress.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { localStorage.removeItem(RECEIVE_DRAFT_KEY); setHasDraft(false); readyToSaveRef.current = true; }} className="flex-1 h-14 text-base font-semibold min-h-[56px] border-2">
              Discard
            </Button>
            <Button onClick={loadDraft} className="flex-1 h-14 text-base font-bold min-h-[56px] bg-amber-600 hover:bg-amber-700">
              Resume
            </Button>
          </div>
        </div>
      )}

      <StepBar steps={STEPS} current={step} />

      {/* ── STEP 1: Document ─────────────────────────────────────────────── */}
      {step === 'doc' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
            <p className="text-sm font-bold text-slate-700">📄 Document Details</p>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">DC / Challan Number <span className="text-red-500">*</span></Label>
              <Input value={header.doc_number} onChange={e => setHeader(h => ({ ...h, doc_number: e.target.value }))} onKeyDown={focusNext} placeholder="e.g. DC-12345" className="h-12" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-500">
                Document Photos <span className="text-red-500">*</span>
                <span className="ml-1 text-slate-400">({docPhotos.length} added)</span>
              </Label>
              {docPhotos.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {docPhotos.map((p, idx) => (
                    <div key={idx} className="relative">
                      <img src={p.localUrl} onClick={() => !p.uploading && setViewPhoto(p.localUrl)} className="w-16 h-16 object-cover rounded-lg border border-slate-200 cursor-pointer active:opacity-80" alt="" />
                      {p.uploading && (
                        <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                        </div>
                      )}
                      {p.error && (
                        <div className="absolute inset-0 bg-red-500/50 rounded-lg flex items-center justify-center">
                          <span className="text-white text-xs font-bold">⚠</span>
                        </div>
                      )}
                      <button onClick={() => setDocPhotos(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow">
                        <X className="w-3 h-3" />
                      </button>
                      {!p.uploading && !p.error && (
                        <div className="absolute bottom-0.5 right-0.5 bg-black/40 rounded-full p-0.5">
                          <ZoomIn className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
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
                  <Loader2 className="w-3 h-3 animate-spin" /> Uploading in background — you can continue filling the form
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Notes (optional)</Label>
              <Input value={header.notes} onChange={e => setHeader(h => ({ ...h, notes: e.target.value }))} onKeyDown={focusNext} className="h-11" />
            </div>
          </div>
          <Button className="w-full h-14 text-base font-bold min-h-[56px]" onClick={() => setStep('product')} disabled={!canGoToProduct}>
            Next: Select Product →
          </Button>
          {!canGoToProduct && (
            <p className="text-xs text-center text-slate-400">Enter DC number and take at least one photo to continue</p>
          )}
        </div>
      )}

      {/* ── STEP 2: Product & Batch ──────────────────────────────────────── */}
      {step === 'product' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-bold text-slate-700">📦 Select Product (SKU)</p>
            <SKUSearchInput skus={skus} value={sku_code} onChange={handleSkuChange} />
          </div>

          {sku && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
              <p className="text-sm font-bold text-slate-700">🏭 Batch Information</p>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Batch Code *</Label>
                <BatchSearchInput
                  batches={allBatches}
                  value={batchLocked ? batch_code : ''}
                  onSelect={handleBatchSelect}
                  placeholder="Type new or select existing batch…"
                />
                {!batchLocked && batch_code && (
                  <p className="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-1.5">✏️ New batch: <strong>{batch_code}</strong> — enter dates below</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Mfg. Date * {batchLocked && <span className="text-green-600 ml-1">🔒 auto-filled</span>}</Label>
                {batchLocked ? (
                  <div className="flex h-11 w-full rounded-xl border border-slate-100 bg-slate-50 px-3 items-center text-base font-bold text-slate-700">{fmtDate(mfg_date)}</div>
                ) : (
                  <DateMaskInput key={sku_code + '_mfg'} value={mfg_date} onChange={setMfg_date} maxToday={true} />
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Expiry Date * {batchLocked && <span className="text-green-600 ml-1">🔒 auto-filled</span>}</Label>
                {batchLocked ? (
                  <div className="flex h-11 w-full rounded-xl border border-slate-100 bg-slate-50 px-3 items-center text-base font-bold text-slate-700">{fmtDate(exp_date)}</div>
                ) : (
                  <DateMaskInput key={sku_code + '_exp'} value={exp_date} onChange={setExp_date} minDate={mfg_date} />
                )}
              </div>

              {/* Show ALL lots for this batch (including EMPTY) */}
              {batchLocked && suggestedLots.length > 0 && (
                <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-600">All lots for batch <strong>{batch_code}</strong>:</p>
                  {suggestedLots.map(l => (
                    <div key={l.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-xs font-bold font-mono text-slate-800">{l.lot_id}</p>
                        {l.location && <p className="text-xs text-slate-500">📍 {l.location}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-700">{l.boxes_balance} boxes</p>
                        <p className={`text-xs font-medium ${l.status === 'ACTIVE' ? 'text-green-600' : 'text-slate-400'}`}>{l.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <Button className="w-full h-14 text-base font-bold min-h-[56px]" onClick={() => setStep('qty')} disabled={!canGoToQty}>
            Next: Enter Quantity →
          </Button>
        </div>
      )}

      {/* ── STEP 3: Quantity (single lot) ───────────────────────────────── */}
      {step === 'qty' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-1">
            <p className="text-xs text-blue-500 font-bold uppercase tracking-wide">Receiving for:</p>
            <p className="font-bold text-blue-900">{sku?.product_name}{sku?.flavour ? ` — ${sku.flavour}` : ''}</p>
            {sku?.brand_name && <p className="text-xs text-blue-700">{sku.brand_name}</p>}
            <p className="text-xs text-blue-700">Batch: <strong>{batch_code}</strong></p>
            <p className="text-xs text-blue-700">Mfg: {fmtDate(mfg_date)} &nbsp;·&nbsp; Exp: {fmtDate(exp_date)}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
            {batchLocked && lotEntry.targetLot && (
              <p className="text-sm font-bold text-slate-700">
                Lot Entry → <span className="text-xs font-mono text-green-700">{lotEntry.targetLot.lot_id}</span>
              </p>
            )}

            {/* Existing batch: ONLY QR scan (no click selection) */}
            {batchLocked && !lotEntry.targetLot && (
              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-amber-900 mb-2">📱 Instructions:</p>
                  <p className="text-sm text-amber-800">Please scan the lot QR card using the scanner below before putting the boxes</p>
                </div>
                
                <p className="text-xs text-slate-600 font-semibold">Available lots for batch <strong>{batch_code}</strong>:</p>
                {suggestedLots.map(l => (
                  <div key={l.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 pointer-events-none opacity-75">
                    <div>
                      <p className="text-xs font-bold font-mono text-slate-800">{l.lot_id}</p>
                      {l.location && <p className="text-xs text-slate-500">📍 {l.location}</p>}
                      <p className={`text-xs ${l.status === 'ACTIVE' ? 'text-green-600' : 'text-slate-400'}`}>{l.status}</p>
                    </div>
                    <p className="text-sm font-bold text-slate-700">{l.boxes_balance} boxes</p>
                  </div>
                ))}
                
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-slate-700">Scan Lot QR Code *</Label>
                  <QRScanInput onScan={handleLotScan} placeholder="Scan lot QR card to continue…" />
                </div>
                
                {lotEntry.scanError && (
                  <div className="bg-red-50 border-2 border-red-300 rounded-lg px-4 py-3">
                    <p className="text-sm font-bold text-red-800">{lotEntry.scanError}</p>
                  </div>
                )}
              </div>
            )}

            {batchLocked && lotEntry.targetLot && (
              <div className="flex items-start gap-3 bg-green-50 border border-green-300 rounded-xl px-4 py-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-green-800">Lot Confirmed ✓</p>
                  <p className="text-xs font-mono text-green-700 mt-0.5">{lotEntry.targetLot.lot_id}</p>
                  {lotEntry.targetLot.location && <p className="text-xs text-green-700">📍 {lotEntry.targetLot.location}</p>}
                  <p className="text-xs text-green-600 mt-0.5">Current balance: {lotEntry.targetLot.boxes_balance} boxes + {lotEntry.targetLot.loose_bottles_balance} loose bottles</p>
                  <button onClick={() => setLotEntry(prev => ({ ...prev, targetLot: null, scanError: '' }))} className="text-xs text-green-600 underline mt-1 min-h-[36px] block">
                    Change lot (scan again)
                  </button>
                </div>
              </div>
            )}

            {/* Qty inputs — show always for new batch, or after lot confirmed for existing batch */}
            {(!batchLocked || lotEntry.targetLot) && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Boxes</Label>
                    <Input type="text" inputMode="numeric" pattern="[0-9]*"
                      value={lotEntry.boxes}
                      onChange={e => setLotEntry(prev => ({ ...prev, boxes: e.target.value.replace(/\D/g, '') }))}
                      onKeyDown={focusNext} placeholder="0"
                      className="h-14 text-2xl font-bold text-center" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Loose Bottles</Label>
                    <Input type="text" inputMode="numeric" pattern="[0-9]*"
                      value={lotEntry.loose}
                      onChange={e => setLotEntry(prev => ({ ...prev, loose: e.target.value.replace(/\D/g, '') }))}
                      onKeyDown={focusNext} placeholder="0"
                      className="h-14 text-2xl font-bold text-center" />
                  </div>
                </div>

                {/* Location — only for new lots */}
                {!batchLocked && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">📍 Location (optional)</Label>
                    <Input value={lotEntry.location} onChange={e => setLotEntry(prev => ({ ...prev, location: e.target.value }))} onKeyDown={focusNext} placeholder="e.g. Rack A-3, Bay 2" className="h-11" />
                  </div>
                )}

                {(lotEntry.boxes || lotEntry.loose) && sku && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                    <p className="text-3xl font-black text-green-700">
                      {totalBottles(lotEntry.boxes, lotEntry.loose, sku.bottles_per_box).toLocaleString()}
                    </p>
                    <p className="text-sm text-green-600">total bottles</p>
                  </div>
                )}
              </>
            )}
          </div>

          {anyPhotoUploading && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <p className="text-xs text-blue-700 font-semibold">Photos still uploading — please wait before confirming…</p>
            </div>
          )}

          {!isOnline && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 font-semibold">
              📵 Offline — connect to internet to confirm receipt. Progress is auto-saved.
            </div>
          )}

          <Button className="w-full h-14 text-base font-bold min-h-[56px]" onClick={handleSubmit} disabled={!canSubmit}>
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : '✅ Confirm Receipt'}
          </Button>
        </div>
      )}
    </div>
  );
}