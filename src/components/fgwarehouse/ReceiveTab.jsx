import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Camera, Trash2, CheckCircle2 } from 'lucide-react';
import { genId, todayStr, formatLotId, getNextLotSeq, totalBottles } from './whHelpers';

export default function ReceiveTab({ skus, lots, onRefresh, user }) {
  const [step, setStep] = useState('form'); // 'form' | 'done'
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);

  const [header, setHeader] = useState({ doc_number: '', doc_photo: '', notes: '' });
  const [lines, setLines] = useState([emptyLine()]);

  function emptyLine() {
    return { sku_code: '', boxes_received: '', loose_bottles_received: '', create_new_lot: true, lot_id: '' };
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
    const validLines = lines.filter(l => l.sku_code && (Number(l.boxes_received) > 0 || Number(l.loose_bottles_received) > 0));
    if (!validLines.length) { alert('Add at least one line with qty.'); return; }

    setSaving(true);
    const today = todayStr();
    const receipt_id = genId('RCV');

    // Create receipt header
    const receipt = await base44.entities.WarehouseReceipt.create({
      receipt_id,
      receipt_date: today,
      received_by: user?.full_name || user?.email || '',
      doc_number: header.doc_number || '',
      doc_photo: header.doc_photo || '',
      notes: header.notes || '',
      status: 'CONFIRMED',
    });

    // Process each line
    for (const line of validLines) {
      const sku = skus.find(s => s.item_code === line.sku_code);
      const ppb = sku?.bottles_per_box || 1;
      const boxes = Number(line.boxes_received) || 0;
      const loose = Number(line.loose_bottles_received) || 0;

      let lot_id = line.lot_id;

      if (line.create_new_lot || !lot_id) {
        // Create new lot
        const seq = await getNextLotSeq(today);
        lot_id = formatLotId(today, seq);
        await base44.entities.WarehouseLot.create({
          lot_id,
          lot_date: today,
          lot_seq: seq,
          sku_code: sku.item_code,
          product_name: sku.product_name,
          brand_name: sku.brand_name || '',
          product_family: sku.product_family || '',
          flavour: sku.flavour || '',
          bottles_per_box: ppb,
          boxes_in: boxes,
          loose_bottles_in: loose,
          boxes_balance: boxes,
          loose_bottles_balance: loose,
          status: 'ACTIVE',
          is_trial_pack: sku.is_trial_pack || false,
        });
      } else {
        // Add to existing lot
        const existingLot = lots.find(l => l.lot_id === lot_id);
        if (existingLot) {
          await base44.entities.WarehouseLot.update(existingLot.id, {
            boxes_balance: (existingLot.boxes_balance || 0) + boxes,
            loose_bottles_balance: (existingLot.loose_bottles_balance || 0) + loose,
            boxes_in: (existingLot.boxes_in || 0) + boxes,
            loose_bottles_in: (existingLot.loose_bottles_in || 0) + loose,
          });
        }
      }

      // Create receipt line
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
    }

    setSaving(false);
    setLastReceipt({ receipt_id, lines: validLines });
    setStep('done');
    onRefresh();
  };

  const reset = () => {
    setHeader({ doc_number: '', doc_photo: '', notes: '' });
    setLines([emptyLine()]);
    setStep('form');
    setLastReceipt(null);
  };

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <p className="text-lg font-bold text-slate-900">Receipt Confirmed!</p>
          <p className="text-sm text-slate-500">{lastReceipt?.receipt_id}</p>
          <p className="text-sm text-slate-500 mt-1">{lastReceipt?.lines?.length} SKU(s) received & lots created.</p>
        </div>
        <Button onClick={reset} className="mt-2">Record Another Receipt</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-slate-700">Receipt Details</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Document Number (DC / Challan)</Label>
            <Input value={header.doc_number} onChange={e => setHeader(h => ({ ...h, doc_number: e.target.value }))} placeholder="e.g. DC-12345" className="text-sm" />
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
        <p className="text-sm font-semibold text-slate-700">Items Received</p>
        {lines.map((line, i) => {
          const sku = skus.find(s => s.item_code === line.sku_code);
          const existingLots = lots.filter(l => l.sku_code === line.sku_code && l.status === 'ACTIVE');
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
                <Label className="text-xs">SKU *</Label>
                <select
                  value={line.sku_code}
                  onChange={e => updateLine(i, { sku_code: e.target.value, lot_id: '', create_new_lot: true })}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
                >
                  <option value="">— Select SKU —</option>
                  {skus.filter(s => s.is_active !== false).map(s => (
                    <option key={s.id} value={s.item_code}>{s.product_name} ({s.item_code})</option>
                  ))}
                </select>
              </div>
              {sku && (
                <>
                  <p className="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-1.5">📦 {sku.bottles_per_box} btls/box</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Boxes</Label>
                      <Input type="number" min="0" value={line.boxes_received} onChange={e => updateLine(i, { boxes_received: e.target.value })} className="text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Loose Bottles</Label>
                      <Input type="number" min="0" value={line.loose_bottles_received} onChange={e => updateLine(i, { loose_bottles_received: e.target.value })} className="text-sm" />
                    </div>
                  </div>
                  {(line.boxes_received || line.loose_bottles_received) && (
                    <p className="text-xs text-right text-slate-500">
                      Total: <strong>{totalBottles(line.boxes_received, line.loose_bottles_received, sku.bottles_per_box)}</strong> bottles
                    </p>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs">Lot Assignment</Label>
                    <select
                      value={line.create_new_lot ? 'new' : line.lot_id}
                      onChange={e => {
                        if (e.target.value === 'new') updateLine(i, { create_new_lot: true, lot_id: '' });
                        else updateLine(i, { create_new_lot: false, lot_id: e.target.value });
                      }}
                      className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
                    >
                      <option value="new">➕ Create New Lot</option>
                      {existingLots.map(l => (
                        <option key={l.id} value={l.lot_id}>{l.lot_id} ({l.boxes_balance} boxes remaining)</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          );
        })}
        <button onClick={addLine} className="w-full border border-dashed border-slate-300 rounded-xl py-3 text-sm text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Add Another SKU
        </button>
      </div>

      <Button className="w-full" onClick={handleSubmit} disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : '✅ Confirm Receipt'}
      </Button>
    </div>
  );
}