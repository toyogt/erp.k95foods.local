import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Camera, Trash2, CheckCircle2, ChevronLeft, Plus, X, ZoomIn } from 'lucide-react';
import QRScanInput from './QRScanInput';
import StepBar from './StepBar';
import { genId, todayStr, fmtDate } from './whHelpers';

const CHANNELS = ['SHOPIFY', 'AMAZON', 'PICKLIST', 'SALES_ORDER', 'OTHER'];
const STEPS = [
  { id: 'details', label: 'Details' },
  { id: 'lots', label: 'Lots' },
];

function emptyLine() {
  return { lot_id: '', boxes_dispatched: '' };
}

export default function DispatchTab({ skus, lots, onRefresh, user, onBack }) {
  const [step, setStep] = useState('details');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastDispatch, setLastDispatch] = useState(null);
  const [viewPhoto, setViewPhoto] = useState(null);

  const [docPhotos, setDocPhotos] = useState([]);
  const [header, setHeader] = useState({ channel: 'OTHER', order_reference: '', notes: '' });
  const [lines, setLines] = useState([emptyLine()]);

  const addLine = () => setLines(l => [...l, emptyLine()]);
  const removeLine = (i) => setLines(l => l.filter((_, idx) => idx !== i));
  const updateLine = (i, patch) => setLines(l => l.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  const handlePhotoCapture = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setDocPhotos(p => [...p, file_url]);
    setUploading(false);
  };

  const handleLotScan = (i, scannedValue) => {
    const lot = lots.find(l => l.lot_id === scannedValue && l.status === 'ACTIVE');
    if (lot) {
      updateLine(i, { lot_id: scannedValue, boxes_dispatched: '' });
    } else {
      alert(`Lot "${scannedValue}" not found or not active.`);
    }
  };

  const handleSubmit = async () => {
    const validLines = lines.filter(l => l.lot_id && Number(l.boxes_dispatched) > 0);
    if (!validLines.length) { alert('Add at least one dispatch line with boxes.'); return; }

    for (const line of validLines) {
      const lot = lots.find(l => l.lot_id === line.lot_id);
      if (!lot) continue;
      if (Number(line.boxes_dispatched) > (lot.boxes_balance || 0)) {
        alert(`Not enough boxes in lot ${lot.lot_id}. Balance: ${lot.boxes_balance}`);
        return;
      }
    }

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

    for (const line of validLines) {
      const lot = lots.find(l => l.lot_id === line.lot_id);
      if (!lot) continue;
      const boxes = Number(line.boxes_dispatched);
      const ppb = lot.bottles_per_box || 1;
      const newBoxBal = (lot.boxes_balance || 0) - boxes;

      await base44.entities.WarehouseLot.update(lot.id, {
        boxes_balance: newBoxBal,
        status: newBoxBal <= 0 && (lot.loose_bottles_balance || 0) <= 0 ? 'EMPTY' : 'ACTIVE',
      });

      await base44.entities.WarehouseDispatchLine.create({
        dispatch_id,
        lot_id: line.lot_id,
        sku_code: lot.sku_code,
        product_name: lot.product_name,
        boxes_dispatched: boxes,
        loose_bottles_dispatched: 0,
        bottles_per_box: ppb,
        total_bottles: boxes * ppb,
      });
    }

    setSaving(false);
    setLastDispatch({ dispatch_id, lines: validLines });
    setStep('done');
    onRefresh();
  };

  const reset = () => {
    setHeader({ channel: 'OTHER', order_reference: '', notes: '' });
    setDocPhotos([]);
    setLines([emptyLine()]);
    setStep('details');
    setLastDispatch(null);
  };

  const goBack = () => {
    if (step === 'details') { onBack(); return; }
    if (step === 'lots') { setStep('details'); return; }
  };

  const activeLots = lots.filter(l => l.status === 'ACTIVE');

  const getFifoWarning = (lot_id) => {
    const lot = lots.find(l => l.lot_id === lot_id);
    if (!lot || !lot.lot_date) return null;
    const lotKey = (l) => (l.lot_date || '') + String(l.lot_seq || 0).padStart(4, '0');
    const older = lots.filter(l =>
      l.sku_code === lot.sku_code &&
      l.status === 'ACTIVE' &&
      l.lot_id !== lot.lot_id &&
      (l.boxes_balance || 0) > 0 &&
      l.lot_date &&
      lotKey(l) < lotKey(lot)
    );
    if (!older.length) return null;
    const oldest = [...older].sort((a, b) => (a.lot_date || '').localeCompare(b.lot_date || ''))[0];
    return `⚠️ FIFO: Older stock in lot ${oldest.lot_id} (${fmtDate(oldest.lot_date)}) — ${oldest.boxes_balance} boxes. Dispatch older lot first!`;
  };

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <p className="text-lg font-bold text-slate-900">Dispatch Confirmed!</p>
          <p className="text-sm text-slate-500">{lastDispatch?.dispatch_id}</p>
          <p className="text-sm text-slate-500 mt-1">{lastDispatch?.lines?.length} lot(s) dispatched.</p>
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

      {/* ── STEP 1: Dispatch Details ── */}
      {step === 'details' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
            <p className="text-sm font-bold text-slate-700">🚚 Dispatch Details</p>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Channel *</Label>
              <select
                value={header.channel}
                onChange={e => setHeader(h => ({ ...h, channel: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-base bg-white min-h-[48px]"
              >
                {CHANNELS.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Order / Reference No.</Label>
              <Input value={header.order_reference} onChange={e => setHeader(h => ({ ...h, order_reference: e.target.value }))} placeholder="e.g. SO-1234" className="h-11" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-500">
                Document Photos
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
              <Input value={header.notes} onChange={e => setHeader(h => ({ ...h, notes: e.target.value }))} className="h-11" />
            </div>
          </div>
          <Button className="w-full h-12 text-base font-bold" onClick={() => setStep('lots')}>
            Next: Select Lots →
          </Button>
        </div>
      )}

      {/* ── STEP 2: Select Lots ── */}
      {step === 'lots' && (
        <div className="space-y-4">
          <div className="space-y-3">
            {lines.map((line, i) => {
              const lot = lots.find(l => l.lot_id === line.lot_id);
              return (
                <div key={i} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-500 uppercase">Line {i + 1}</p>
                    {lines.length > 1 && (
                      <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600 min-w-[44px] min-h-[44px] flex items-center justify-center">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Scan Lot QR *</Label>
                    <QRScanInput onScan={(val) => handleLotScan(i, val)} placeholder="Scan lot QR or type lot ID…" />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Or select from list</Label>
                    <select
                      value={line.lot_id}
                      onChange={e => updateLine(i, { lot_id: e.target.value, boxes_dispatched: '' })}
                      className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm bg-white min-h-[48px]"
                    >
                      <option value="">— Select Lot —</option>
                      {activeLots.map(l => (
                        <option key={l.id} value={l.lot_id}>
                          {l.lot_id} · {l.product_name}{l.flavour ? ` (${l.flavour})` : ''} — {l.boxes_balance} boxes
                        </option>
                      ))}
                    </select>
                  </div>

                  {lot && (
                    <>
                      <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 text-xs text-green-800 space-y-0.5">
                        <p className="font-bold text-sm">{lot.product_name}{lot.flavour ? ` — ${lot.flavour}` : ''}</p>
                        {lot.brand_name && <p className="text-green-700 font-semibold">{lot.brand_name}</p>}
                        {lot.batch_code && <p>Batch: {lot.batch_code} &nbsp;|&nbsp; Exp: {fmtDate(lot.exp_date)}</p>}
                        <p>Balance: <strong>{lot.boxes_balance}</strong> boxes · {lot.bottles_per_box} bottles/box</p>
                      </div>
                      {getFifoWarning(line.lot_id) && (
                        <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 text-xs text-amber-800 font-medium">
                          {getFifoWarning(line.lot_id)}
                        </div>
                      )}
                      <div className="space-y-1">
                        <Label className="text-xs">Boxes to Dispatch *</Label>
                        <Input
                          type="text" inputMode="numeric" pattern="[0-9]*"
                          value={line.boxes_dispatched}
                          onChange={e => updateLine(i, { boxes_dispatched: e.target.value.replace(/\D/g, '') })}
                          className="h-12 text-xl font-bold text-center"
                          placeholder={`Max: ${lot.boxes_balance}`}
                        />
                        {line.boxes_dispatched && (
                          <p className="text-xs text-right text-slate-500">
                            = <strong>{Number(line.boxes_dispatched) * (lot.bottles_per_box || 1)}</strong> bottles
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            <button onClick={addLine} className="w-full border border-dashed border-slate-300 rounded-xl py-4 text-sm text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-2 min-h-[56px]">
              <Plus className="w-4 h-4" /> Add Another Lot
            </button>
          </div>

          <Button className="w-full h-14 text-base font-bold" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : '🚚 Confirm Dispatch'}
          </Button>
        </div>
      )}
    </div>
  );
}