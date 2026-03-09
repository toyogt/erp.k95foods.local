import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Camera, CheckCircle2, ChevronLeft } from 'lucide-react';
import QRScanInput from './QRScanInput';
import SKUSearchInput from './SKUSearchInput';
import DateMaskInput from './DateMaskInput';
import { genId, todayStr, formatLotId, getNextLotSeq, totalBottles } from './whHelpers';

export default function ReceiveTab({ skus, lots, onRefresh, user, onBack }) {
  const [step, setStep] = useState('form');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);

  const [sku_code, setSku_code] = useState('');
  const [batch_code, setBatch_code] = useState('');
  const [mfg_date, setMfg_date] = useState('');
  const [exp_date, setExp_date] = useState('');
  const [boxes_received, setBoxes_received] = useState('');
  const [loose_bottles_received, setLoose_bottles_received] = useState('');
  const [create_new_lot, setCreate_new_lot] = useState(true);
  const [lot_id_selected, setLot_id_selected] = useState('');
  const [header, setHeader] = useState({ doc_number: '', doc_photo: '', notes: '' });

  const sku = skus.find(s => s.item_code === sku_code);

  // Recent batch codes for this SKU (last 2 days only)
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];
  const recentBatchCodes = [...new Set(
    lots
      .filter(l => l.sku_code === sku_code && l.batch_code && (l.lot_date || '') >= twoDaysAgoStr)
      .map(l => l.batch_code)
  )];

  // Existing active lots: same SKU + same batch
  const existingLots = lots.filter(l =>
    l.sku_code === sku_code &&
    l.status === 'ACTIVE' &&
    (!batch_code || l.batch_code === batch_code)
  );

  const handlePhotoCapture = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setHeader(h => ({ ...h, doc_photo: file_url }));
    setUploading(false);
  };

  const handleSkuChange = (code) => {
    setSku_code(code);
    setLot_id_selected('');
    setCreate_new_lot(true);
    setBatch_code('');
    setMfg_date('');
    setExp_date('');
  };

  const handleLotScan = (scannedValue) => {
    const found = lots.find(l => l.lot_id === scannedValue);
    if (!found) { alert(`Lot "${scannedValue}" not found.`); return; }
    if (found.sku_code !== sku_code) {
      alert(`Lot "${scannedValue}" belongs to a different product (${found.sku_code}). Cannot mix products in one lot.`);
      return;
    }
    if (batch_code && found.batch_code !== batch_code) {
      alert(`Lot "${scannedValue}" has batch ${found.batch_code}, but you entered ${batch_code}. Cannot mix batches.`);
      return;
    }
    setLot_id_selected(scannedValue);
    setCreate_new_lot(false);
  };

  const handleSubmit = async () => {
    if (!sku_code) { alert('Select a SKU'); return; }
    if (!batch_code) { alert('Enter batch code'); return; }
    if (!mfg_date) { alert('Enter manufacturing date in DD/MM/YYYY'); return; }
    if (!exp_date) { alert('Enter expiry date in DD/MM/YYYY'); return; }
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
      doc_number: header.doc_number || '',
      doc_photo: header.doc_photo || '',
      notes: header.notes || '',
      status: 'CONFIRMED',
    });

    let final_lot_id = lot_id_selected;

    if (create_new_lot || !final_lot_id) {
      const seq = await getNextLotSeq(today);
      final_lot_id = formatLotId(today, seq);
      await base44.entities.WarehouseLot.create({
        lot_id: final_lot_id,
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
      });
    } else {
      const existingLot = lots.find(l => l.lot_id === final_lot_id);
      if (existingLot) {
        await base44.entities.WarehouseLot.update(existingLot.id, {
          boxes_balance: (existingLot.boxes_balance || 0) + boxes,
          loose_bottles_balance: (existingLot.loose_bottles_balance || 0) + loose,
          boxes_in: (existingLot.boxes_in || 0) + boxes,
          loose_bottles_in: (existingLot.loose_bottles_in || 0) + loose,
        });
      }
    }

    await base44.entities.WarehouseReceiptLine.create({
      receipt_id,
      lot_id: final_lot_id,
      sku_code: sku.item_code,
      product_name: sku.product_name,
      boxes_received: boxes,
      loose_bottles_received: loose,
      bottles_per_box: ppb,
      total_bottles: totalBottles(boxes, loose, ppb),
    });

    setSaving(false);
    setLastReceipt({ receipt_id, lot_id: final_lot_id });
    setStep('done');
    onRefresh();
  };

  const reset = () => {
    setSku_code(''); setBatch_code(''); setMfg_date(''); setExp_date('');
    setBoxes_received(''); setLoose_bottles_received('');
    setCreate_new_lot(true); setLot_id_selected('');
    setHeader({ doc_number: '', doc_photo: '', notes: '' });
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
          <p className="text-xs text-slate-400 mt-1">Lot: {lastReceipt?.lot_id}</p>
        </div>
        <Button onClick={reset} className="mt-2 h-12 px-8 text-base">Record Another</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
          <ChevronLeft className="w-6 h-6 text-slate-700" />
        </button>
        <h2 className="text-lg font-bold text-slate-900">Receive Stock</h2>
      </div>

      {/* Document Details */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
        <p className="text-sm font-semibold text-slate-700">Document Details</p>
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-500">DC / Challan Number</Label>
          <Input value={header.doc_number} onChange={e => setHeader(h => ({ ...h, doc_number: e.target.value }))} placeholder="e.g. DC-12345" className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-500">Document Photo (Camera only)</Label>
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
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-500">Notes</Label>
          <Input value={header.notes} onChange={e => setHeader(h => ({ ...h, notes: e.target.value }))} className="h-11" />
        </div>
      </div>

      {/* SKU Selection */}
      <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white">
        <p className="text-sm font-semibold text-slate-700">Product</p>
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-500">SKU *</Label>
          <SKUSearchInput skus={skus} value={sku_code} onChange={handleSkuChange} />
        </div>
        {sku && (
          <p className="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
            📦 {sku.bottles_per_box} btls/box{sku.is_trial_pack ? ' · 🧪 Trial Pack' : ''}
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
            <input
              list="rcv-batch-suggestions"
              value={batch_code}
              onChange={e => { setBatch_code(e.target.value); setLot_id_selected(''); setCreate_new_lot(true); }}
              placeholder="e.g. B2603001"
              className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <datalist id="rcv-batch-suggestions">
              {recentBatchCodes.map(b => <option key={b} value={b} />)}
            </datalist>
            {recentBatchCodes.length > 0 && (
              <p className="text-xs text-slate-400">💡 {recentBatchCodes.length} recent batch(es) available — tap field to see suggestions</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Mfg. Date * (DD/MM/YYYY)</Label>
            <DateMaskInput key={sku_code + '_mfg'} value={mfg_date} onChange={setMfg_date} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Expiry Date * (DD/MM/YYYY)</Label>
            <DateMaskInput key={sku_code + '_exp'} value={exp_date} onChange={setExp_date} />
          </div>
        </div>
      )}

      {/* Quantity */}
      {sku && (
        <div className="border border-slate-200 rounded-xl p-4 space-y-4 bg-white">
          <p className="text-sm font-semibold text-slate-700">Quantity Received</p>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Boxes</Label>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={boxes_received}
              onChange={e => setBoxes_received(e.target.value.replace(/\D/g, ''))}
              placeholder="0"
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Loose Bottles</Label>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={loose_bottles_received}
              onChange={e => setLoose_bottles_received(e.target.value.replace(/\D/g, ''))}
              placeholder="0"
              className="h-11"
            />
          </div>
          {(boxes_received || loose_bottles_received) && (
            <p className="text-xs text-right text-slate-500">
              Total: <strong>{totalBottles(boxes_received, loose_bottles_received, sku.bottles_per_box)}</strong> bottles
            </p>
          )}
        </div>
      )}

      {/* Lot Assignment */}
      {sku && batch_code && (
        <div className="border border-slate-200 rounded-xl p-4 space-y-4 bg-white">
          <p className="text-sm font-semibold text-slate-700">Lot Assignment</p>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Assign to Lot</Label>
            <select
              value={create_new_lot ? 'new' : lot_id_selected}
              onChange={e => {
                if (e.target.value === 'new') { setCreate_new_lot(true); setLot_id_selected(''); }
                else { setCreate_new_lot(false); setLot_id_selected(e.target.value); }
              }}
              className="w-full border border-slate-200 rounded-xl px-3 py-3 text-base bg-white min-h-[48px]"
            >
              <option value="new">➕ Create New Lot</option>
              {existingLots.map(l => (
                <option key={l.id} value={l.lot_id}>
                  {l.lot_id} — batch: {l.batch_code} ({l.boxes_balance} boxes)
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Or Scan Existing Lot QR</Label>
            <QRScanInput onScan={handleLotScan} placeholder="Scan lot QR or type lot ID…" />
            {!create_new_lot && lot_id_selected && (
              <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5">✅ Lot selected: {lot_id_selected}</p>
            )}
          </div>
        </div>
      )}

      <Button className="w-full h-12 text-base" onClick={handleSubmit} disabled={saving || !sku_code}>
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : '✅ Confirm Receipt'}
      </Button>
    </div>
  );
}