import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Camera, Trash2, CheckCircle2, ChevronLeft, Plus } from 'lucide-react';
import QRScanInput from './QRScanInput';
import { genId, todayStr, totalBottles } from './whHelpers';

const CHANNELS = ['SHOPIFY', 'AMAZON', 'PICKLIST', 'SALES_ORDER', 'OTHER'];

export default function DispatchTab({ skus, lots, onRefresh, user, onBack }) {
  const [step, setStep] = useState('form');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastDispatch, setLastDispatch] = useState(null);

  const [header, setHeader] = useState({ channel: 'OTHER', order_reference: '', doc_photo: '', notes: '' });
  const [lines, setLines] = useState([emptyLine()]);

  function emptyLine() {
    return { lot_id: '', boxes_dispatched: '' };
  }

  const addLine = () => setLines(l => [...l, emptyLine()]);
  const removeLine = (i) => setLines(l => l.filter((_, idx) => idx !== i));
  const updateLine = (i, patch) => setLines(l => l.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  const handlePhotoCapture = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setHeader(h => ({ ...h, doc_photo: file_url }));
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
      doc_photo: header.doc_photo || '',
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
    setHeader({ channel: 'OTHER', order_reference: '', doc_photo: '', notes: '' });
    setLines([emptyLine()]);
    setStep('form');
    setLastDispatch(null);
  };

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
        <Button onClick={reset} className="mt-2 h-12 px-8 text-base">Record Another</Button>
      </div>
    );
  }

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
    return `⚠️ FIFO: Older stock in lot ${oldest.lot_id} (${oldest.lot_date}) — ${oldest.boxes_balance} boxes. Dispatch older lot first!`;
  };

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors">
          <ChevronLeft className="w-6 h-6 text-slate-700" />
        </button>
        <h2 className="text-lg font-bold text-slate-900">Dispatch Stock</h2>
      </div>

      {/* Dispatch details */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-slate-700">Dispatch Details</p>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Channel *</Label>
            <select
              value={header.channel}
              onChange={e => setHeader(h => ({ ...h, channel: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-3 text-base bg-white min-h-[48px]"
            >
              {CHANNELS.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Order / Ref No.</Label>
            <Input value={header.order_reference} onChange={e => setHeader(h => ({ ...h, order_reference: e.target.value }))} placeholder="SO-1234" className="h-11" />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Document Photo (Camera only)</Label>
          {header.doc_photo ? (
            <div className="flex items-center gap-3">
              <img src={header.doc_photo} className="w-16 h-16 object-cover rounded-lg border border-slate-200" alt="doc" />
              <button onClick={() => setHeader(h => ({ ...h, doc_photo: '' }))} className="text-xs text-red-500 underline">Remove</button>
            </div>
          ) : (
            <label className="flex items-center gap-2 cursor-pointer border border-dashed border-slate-300 rounded-xl px-4 py-4 hover:bg-slate-100 w-full justify-center min-h-[56px]">
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5 text-slate-400" />}
              <span className="text-sm text-slate-500">{uploading ? 'Uploading…' : 'Take Photo'}</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} disabled={uploading} />
            </label>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Notes</Label>
          <Input value={header.notes} onChange={e => setHeader(h => ({ ...h, notes: e.target.value }))} className="text-sm" />
        </div>
      </div>

      {/* Lines */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-700">Lots to Dispatch</p>
        {lines.map((line, i) => {
          const lot = lots.find(l => l.lot_id === line.lot_id);
          return (
            <div key={i} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">Line {i + 1}</p>
                {lines.length > 1 && (
                  <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600 p-1 min-w-[40px] min-h-[40px] flex items-center justify-center">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Scan or Select Lot *</Label>
                <QRScanInput onScan={(val) => handleLotScan(i, val)} placeholder="Scan lot QR or type lot ID…" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Or pick from list</Label>
                <select
                  value={line.lot_id}
                  onChange={e => updateLine(i, { lot_id: e.target.value, boxes_dispatched: '' })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm bg-white"
                >
                  <option value="">— Select Lot —</option>
                  {activeLots.map(l => (
                    <option key={l.id} value={l.lot_id}>
                      {l.lot_id} · {l.product_name} ({l.boxes_balance} boxes)
                    </option>
                  ))}
                </select>
              </div>

              {lot && (
                <>
                  <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-800 space-y-0.5">
                    <p className="font-semibold">{lot.product_name}</p>
                    {lot.batch_code && <p>Batch: {lot.batch_code} | Exp: {lot.exp_date || '—'}</p>}
                    <p>Balance: {lot.boxes_balance} boxes · {lot.bottles_per_box} bottles/box</p>
                  </div>
                  {getFifoWarning(line.lot_id) && (
                    <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 text-xs text-amber-800 font-medium">
                      {getFifoWarning(line.lot_id)}
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs">Boxes to Dispatch *</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={line.boxes_dispatched}
                      onChange={e => updateLine(i, { boxes_dispatched: e.target.value.replace(/\D/g, '') })}
                      className="text-sm h-11"
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

      <Button className="w-full h-12 text-base" onClick={handleSubmit} disabled={saving}>
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : '🚚 Confirm Dispatch'}
      </Button>
    </div>
  );
}