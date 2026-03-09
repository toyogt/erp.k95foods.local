import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Camera, CheckCircle2, ChevronLeft, X, ZoomIn, MapPin } from 'lucide-react';
import QRScanInput from './QRScanInput';
import SKUSearchInput from './SKUSearchInput';
import BatchSearchInput from './BatchSearchInput';
import DateMaskInput, { focusNext } from './DateMaskInput';
import LotCardPrint from './LotCardPrint';
import { genId, todayStr, formatLotId, getNextLotSeq, totalBottles } from './whHelpers';

export default function ReceiveTab({ skus, lots, onRefresh, user, onBack }) {
  const [step, setStep] = useState('form'); // 'form' | 'location' | 'done'
  const [saving, setSaving] = useState(false);
  const [savingLoc, setSavingLoc] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [newLot, setNewLot] = useState(null);
  const [location, setLocation] = useState('');
  const [viewPhoto, setViewPhoto] = useState(null);

  const [sku_code, setSku_code] = useState('');
  const [batch_code, setBatch_code] = useState('');
  const [batchLocked, setBatchLocked] = useState(false); // true when selected from dropdown
  const [mfg_date, setMfg_date] = useState('');
  const [exp_date, setExp_date] = useState('');
  const [boxes_received, setBoxes_received] = useState('');
  const [loose_bottles_received, setLoose_bottles_received] = useState('');
  const [docPhotos, setDocPhotos] = useState([]);
  const [header, setHeader] = useState({ doc_number: '', notes: '' });

  const sku = skus.find(s => s.item_code === sku_code);

  // Recent batch codes for this SKU (last 2 days only)
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
  };

  const handleSubmit = async () => {
    if (!header.doc_number.trim()) { alert('DC / Challan Number is required'); return; }
    if (docPhotos.length === 0) { alert('At least one document photo is required'); return; }
    if (!sku_code) { alert('Select a SKU'); return; }
    if (!batch_code) { alert('Enter batch code'); return; }
    if (!mfg_date) { alert('Enter a valid manufacturing date (DD/MM/YYYY)'); return; }
    if (!exp_date) { alert('Enter a valid expiry date (DD/MM/YYYY)'); return; }
    if (exp_date <= mfg_date) { alert('Expiry date must be after manufacturing date'); return; }
    if (!boxes_received && !loose_bottles_received) { alert('Enter boxes or loose bottles received'); return; }

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
    setStep('location');
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

  const reset = () => {
    setSku_code(''); setBatch_code(''); setBatchLocked(false); setMfg_date(''); setExp_date('');
    setBoxes_received(''); setLoose_bottles_received('');
    setDocPhotos([]);
    setHeader({ doc_number: '', notes: '' });
    setLocation('');
    setNewLot(null);
    setLastReceipt(null);
    setStep('form');
  };

  // ── Location step ──────────────────────────────────────────────────────────
  if (step === 'location') {
    return (
      <div className="space-y-5 pb-8">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="font-bold text-slate-900">Lot Created!</p>
            <p className="text-xs text-slate-400 font-mono">{newLot?.lot_id}</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5 text-sm">
          <p className="font-semibold text-slate-700">{newLot?.product_name}</p>
          <p className="text-xs text-slate-500">Batch: {newLot?.batch_code} · {newLot?.boxes_in} boxes</p>
          <p className="text-xs text-slate-500">Mfg: {newLot?.mfg_date} · Exp: {newLot?.exp_date}</p>
        </div>

        <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-4 h-4 text-slate-500" />
            <p className="text-sm font-semibold text-slate-700">Set Warehouse Location</p>
          </div>
          <Input
            value={location}
            onChange={e => setLocation(e.target.value)}
            onKeyDown={focusNext}
            placeholder="e.g. Rack A-3, Bay 2"
            className="h-11"
            autoFocus
          />
          <p className="text-xs text-slate-400">Optional — you can skip and set later</p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 h-12 text-base" onClick={() => setStep('done')}>
            Skip & Print
          </Button>
          <Button className="flex-1 h-12 text-base" onClick={handleSaveLocation} disabled={savingLoc}>
            {savingLoc ? <Loader2 className="w-5 h-5 animate-spin" /> : '💾 Save & Print'}
          </Button>
        </div>
      </div>
    );
  }

  // ── Done step (show lot card for printing) ─────────────────────────────────
  if (step === 'done') {
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
          </div>
        </div>

        {lotForPrint && (
          <div className="border border-slate-200 rounded-xl p-4 bg-white">
            <p className="text-sm font-semibold text-slate-700 mb-3">Lot Card — Print & Attach to Stock</p>
            <LotCardPrint lot={lotForPrint} />
          </div>
        )}

        <Button onClick={reset} className="w-full h-12 text-base">📥 Record Another Receipt</Button>
      </div>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-8">
      {/* Full-screen photo viewer */}
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
        <button onClick={onBack} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors">
          <ChevronLeft className="w-6 h-6 text-slate-700" />
        </button>
        <h2 className="text-lg font-bold text-slate-900">Receive Stock</h2>
      </div>

      {/* Document Details */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
        <p className="text-sm font-semibold text-slate-700">Document Details <span className="text-red-500">*</span></p>
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-500">DC / Challan Number <span className="text-red-500">*</span></Label>
          <Input
            value={header.doc_number}
            onChange={e => setHeader(h => ({ ...h, doc_number: e.target.value }))}
            onKeyDown={focusNext}
            placeholder="e.g. DC-12345"
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-slate-500">Document Photos <span className="text-red-500">*</span> ({docPhotos.length} added)</Label>
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
          <label className="flex items-center gap-2 cursor-pointer border border-dashed border-slate-300 rounded-xl px-4 py-4 hover:bg-slate-100 w-full justify-center min-h-[56px]">
            {uploading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : <Camera className="w-5 h-5 text-slate-400" />}
            <span className="text-sm text-slate-500">{uploading ? 'Uploading…' : docPhotos.length > 0 ? 'Add Another Photo' : 'Take Photo'}</span>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} disabled={uploading} />
          </label>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-slate-500">Notes</Label>
          <Input value={header.notes} onChange={e => setHeader(h => ({ ...h, notes: e.target.value }))} onKeyDown={focusNext} className="h-11" />
        </div>
      </div>

      {/* SKU */}
      <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white">
        <p className="text-sm font-semibold text-slate-700">Product</p>
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-500">SKU *</Label>
          <SKUSearchInput skus={skus} value={sku_code} onChange={handleSkuChange} />
        </div>
        {sku && (
          <p className="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
            📦 {sku.bottles_per_box} bottles/box{sku.is_trial_pack ? ' · 🧪 Trial Pack' : ''}
            {sku.product_family ? ` · ${sku.product_family}` : ''}
          </p>
        )}
      </div>

      {/* Batch Information */}
      {sku && (
        <div className="border border-slate-200 rounded-xl p-4 space-y-4 bg-white">
          <p className="text-sm font-semibold text-slate-700">Batch Information</p>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Batch Code *</Label>
            <BatchSearchInput
              batches={recentBatches}
              value={batchLocked ? batch_code : ''}
              onSelect={handleBatchSelect}
              placeholder="Type new or select recent batch…"
            />
            {!batchLocked && batch_code && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5">✏️ New batch: <strong>{batch_code}</strong> — enter dates below</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">
              Mfg. Date * (DD/MM/YYYY)
              {batchLocked && <span className="ml-1 text-green-600">🔒 auto-filled</span>}
            </Label>
            {batchLocked ? (
              <div className="flex h-11 w-full rounded-xl border border-slate-100 bg-slate-50 px-3 items-center text-base text-slate-700">
                {mfg_date}
              </div>
            ) : (
              <DateMaskInput key={sku_code + '_mfg'} value={mfg_date} onChange={setMfg_date} maxToday={true} />
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">
              Expiry Date * (DD/MM/YYYY)
              {batchLocked && <span className="ml-1 text-green-600">🔒 auto-filled</span>}
            </Label>
            {batchLocked ? (
              <div className="flex h-11 w-full rounded-xl border border-slate-100 bg-slate-50 px-3 items-center text-base text-slate-700">
                {exp_date}
              </div>
            ) : (
              <DateMaskInput key={sku_code + '_exp'} value={exp_date} onChange={setExp_date} minDate={mfg_date} />
            )}
          </div>
        </div>
      )}

      {/* Quantity */}
      {sku && (
        <div className="border border-slate-200 rounded-xl p-4 space-y-4 bg-white">
          <p className="text-sm font-semibold text-slate-700">Quantity Received</p>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Boxes</Label>
            <Input type="text" inputMode="numeric" pattern="[0-9]*" value={boxes_received} onChange={e => setBoxes_received(e.target.value.replace(/\D/g, ''))} onKeyDown={focusNext} placeholder="0" className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Loose Bottles</Label>
            <Input type="text" inputMode="numeric" pattern="[0-9]*" value={loose_bottles_received} onChange={e => setLoose_bottles_received(e.target.value.replace(/\D/g, ''))} onKeyDown={focusNext} placeholder="0" className="h-11" />
          </div>
          {(boxes_received || loose_bottles_received) && (
            <p className="text-xs text-right text-slate-500">
              Total: <strong>{totalBottles(boxes_received, loose_bottles_received, sku.bottles_per_box)}</strong> bottles
            </p>
          )}
        </div>
      )}

      <Button className="w-full h-12 text-base" onClick={handleSubmit} disabled={saving || !sku_code}>
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : '✅ Confirm Receipt'}
      </Button>
    </div>
  );
}