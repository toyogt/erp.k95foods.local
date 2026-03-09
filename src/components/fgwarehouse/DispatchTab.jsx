import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Camera, Trash2, CheckCircle2 } from 'lucide-react';
import { genId, todayStr, totalBottles } from './whHelpers';

const CHANNELS = ['SHOPIFY', 'AMAZON', 'PICKLIST', 'SALES_ORDER', 'OTHER'];

export default function DispatchTab({ skus, lots, onRefresh, user }) {
  const [step, setStep] = useState('form');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastDispatch, setLastDispatch] = useState(null);

  const [header, setHeader] = useState({ channel: 'OTHER', order_reference: '', doc_photo: '', notes: '' });
  const [lines, setLines] = useState([emptyLine()]);

  function emptyLine() {
    return { lot_id: '', boxes_dispatched: '', loose_bottles_dispatched: '' };
  }

  const addLine = () => setLines(l => [...l, emptyLine()]);
  const removeLine = (i) => setLines(l => l.filter((_, idx) => idx !== i));
  const updateLine = (i, patch) => setLines(l => l.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setHeader(h => ({ ...h, doc_photo: file_url }));
    setUploading(false);
  };

  const handleSubmit = async () => {
    const validLines = lines.filter(l => l.lot_id && (Number(l.boxes_dispatched) > 0 || Number(l.loose_bottles_dispatched) > 0));
    if (!validLines.length) { alert('Add at least one dispatch line with qty.'); return; }

    // Validate stock sufficiency
    for (const line of validLines) {
      const lot = lots.find(l => l.lot_id === line.lot_id);
      if (!lot) continue;
      const boxesReq = Number(line.boxes_dispatched) || 0;
      const looseReq = Number(line.loose_bottles_dispatched) || 0;
      if (boxesReq > (lot.boxes_balance || 0)) {
        alert(`Not enough boxes in lot ${lot.lot_id}. Balance: ${lot.boxes_balance}`);
        return;
      }
      if (looseReq > (lot.loose_bottles_balance || 0)) {
        alert(`Not enough loose bottles in lot ${lot.lot_id}. Balance: ${lot.loose_bottles_balance}`);
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
      const boxes = Number(line.boxes_dispatched) || 0;
      const loose = Number(line.loose_bottles_dispatched) || 0;
      const ppb = lot.bottles_per_box || 1;

      // Deduct from lot
      const newBoxBal = (lot.boxes_balance || 0) - boxes;
      const newLooseBal = (lot.loose_bottles_balance || 0) - loose;
      await base44.entities.WarehouseLot.update(lot.id, {
        boxes_balance: newBoxBal,
        loose_bottles_balance: newLooseBal,
        status: newBoxBal <= 0 && newLooseBal <= 0 ? 'EMPTY' : 'ACTIVE',
      });

      await base44.entities.WarehouseDispatchLine.create({
        dispatch_id,
        lot_id: line.lot_id,
        sku_code: lot.sku_code,
        product_name: lot.product_name,
        boxes_dispatched: boxes,
        loose_bottles_dispatched: loose,
        bottles_per_box: ppb,
        total_bottles: totalBottles(boxes, loose, ppb),
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
          <p className="text-sm text-slate-500 mt-1">{lastDispatch?.lines?.length} lot(s) dispatched. Stock updated.</p>
        </div>
        <Button onClick={reset} className="mt-2">Record Another Dispatch</Button>
      </div>
    );
  }

  const activeLots = lots.filter(l => l.status === 'ACTIVE');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-slate-700">Dispatch Details</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Channel *</Label>
            <select
              value={header.channel}
              onChange={e => setHeader(h => ({ ...h, channel: e.target.value }))}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
            >
              {CHANNELS.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Order / Reference No.</Label>
            <Input value={header.order_reference} onChange={e => setHeader(h => ({ ...h, order_reference: e.target.value }))} placeholder="SO-1234 / #4521" className="text-sm" />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Document Photo</Label>
            {header.doc_photo ? (
              <div className="flex items-center gap-2">
                <img src={header.doc_photo} className="w-16 h-16 object-cover rounded-lg border border-slate-200" alt="doc" />
                <button onClick={() => setHeader(h => ({ ...h, doc_photo: '' }))} className="text-xs text-red-500 underline">Remove</button>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer border border-dashed border-slate-300 rounded-lg px-4 py-3 hover:bg-slate-100 transition-colors w-full justify-center">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4 text-slate-400" />}
                <span className="text-sm text-slate-500">{uploading ? 'Uploading…' : 'Take / Upload Photo'}</span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
              </label>
            )}
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Notes</Label>
            <Input value={header.notes} onChange={e => setHeader(h => ({ ...h, notes: e.target.value }))} className="text-sm" />
          </div>
        </div>
      </div>

      {/* Lines */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-700">Items to Dispatch</p>
        {lines.map((line, i) => {
          const lot = lots.find(l => l.lot_id === line.lot_id);
          return (
            <div key={i} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">Line {i + 1}</p>
                {lines.length > 1 && (
                  <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Select Lot *</Label>
                <select
                  value={line.lot_id}
                  onChange={e => updateLine(i, { lot_id: e.target.value, boxes_dispatched: '', loose_bottles_dispatched: '' })}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
                >
                  <option value="">— Select Lot —</option>
                  {activeLots.map(l => (
                    <option key={l.id} value={l.lot_id}>
                      {l.lot_id} · {l.product_name} ({l.boxes_balance} boxes, {l.loose_bottles_balance} loose)
                    </option>
                  ))}
                </select>
              </div>
              {lot && (
                <>
                  <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5">
                    Balance: {lot.boxes_balance} boxes · {lot.loose_bottles_balance} loose bottles · {lot.bottles_per_box} btls/box
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Boxes to Dispatch</Label>
                      <Input type="number" min="0" max={lot.boxes_balance} value={line.boxes_dispatched} onChange={e => updateLine(i, { boxes_dispatched: e.target.value })} className="text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Loose Bottles</Label>
                      <Input type="number" min="0" max={lot.loose_bottles_balance} value={line.loose_bottles_dispatched} onChange={e => updateLine(i, { loose_bottles_dispatched: e.target.value })} className="text-sm" />
                    </div>
                  </div>
                  {(line.boxes_dispatched || line.loose_bottles_dispatched) && (
                    <p className="text-xs text-right text-slate-500">
                      Total: <strong>{totalBottles(line.boxes_dispatched, line.loose_bottles_dispatched, lot.bottles_per_box)}</strong> bottles
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })}
        <button onClick={addLine} className="w-full border border-dashed border-slate-300 rounded-xl py-3 text-sm text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Add Another Lot
        </button>
      </div>

      <Button className="w-full" onClick={handleSubmit} disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : '🚚 Confirm Dispatch'}
      </Button>
    </div>
  );
}