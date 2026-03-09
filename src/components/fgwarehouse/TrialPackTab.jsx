import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Trash2, CheckCircle2, ChevronLeft } from 'lucide-react';
import { formatLotId, getNextLotSeq, todayStr } from './whHelpers';

export default function TrialPackTab({ skus, lots, onRefresh, user, onBack }) {
  const [step, setStep] = useState('form');
  const [saving, setSaving] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const [trialSkuCode, setTrialSkuCode] = useState('');
  const [trialBoxes, setTrialBoxes] = useState('');
  const [components, setComponents] = useState([{ lot_id: '', bottles_to_use: '' }]);

  const trialSkus = skus.filter(s => s.is_trial_pack && s.is_active !== false);
  const activeLots = lots.filter(l => l.status === 'ACTIVE' && !skus.find(s => s.item_code === l.sku_code)?.is_trial_pack);

  const addComp = () => setComponents(c => [...c, { lot_id: '', bottles_to_use: '' }]);
  const removeComp = (i) => setComponents(c => c.filter((_, idx) => idx !== i));
  const updateComp = (i, patch) => setComponents(c => c.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  const trialSku = skus.find(s => s.item_code === trialSkuCode);
  const trialBottlesNeeded = (Number(trialBoxes) || 0) * (trialSku?.bottles_per_box || 1);
  const totalComponentBottles = components.reduce((s, c) => s + (Number(c.bottles_to_use) || 0), 0);

  const handleBuild = async () => {
    if (!trialSkuCode) { alert('Select a trial pack SKU.'); return; }
    if (!trialBoxes || Number(trialBoxes) <= 0) { alert('Enter number of trial pack boxes to build.'); return; }
    const validComps = components.filter(c => c.lot_id && Number(c.bottles_to_use) > 0);
    if (!validComps.length) { alert('Add at least one component lot.'); return; }

    for (const comp of validComps) {
      const lot = lots.find(l => l.lot_id === comp.lot_id);
      if (!lot) continue;
      const ppb = lot.bottles_per_box || 1;
      const availBottles = (lot.boxes_balance || 0) * ppb + (lot.loose_bottles_balance || 0);
      if (Number(comp.bottles_to_use) > availBottles) {
        alert(`Not enough bottles in lot ${lot.lot_id}. Available: ${availBottles}`);
        return;
      }
    }

    setSaving(true);
    const today = todayStr();
    const ppb = trialSku?.bottles_per_box || 1;
    const boxes = Number(trialBoxes);

    for (const comp of validComps) {
      const lot = lots.find(l => l.lot_id === comp.lot_id);
      if (!lot) continue;
      const lppb = lot.bottles_per_box || 1;
      let bottlesLeft = Number(comp.bottles_to_use);
      let newLooseBal = lot.loose_bottles_balance || 0;
      let newBoxBal = lot.boxes_balance || 0;

      if (bottlesLeft <= newLooseBal) {
        newLooseBal -= bottlesLeft;
      } else {
        bottlesLeft -= newLooseBal;
        newLooseBal = 0;
        const boxesToDeduct = Math.ceil(bottlesLeft / lppb);
        const remainderLoose = (boxesToDeduct * lppb) - bottlesLeft;
        newBoxBal = Math.max(0, newBoxBal - boxesToDeduct);
        newLooseBal = remainderLoose;
      }

      await base44.entities.WarehouseLot.update(lot.id, {
        boxes_balance: newBoxBal,
        loose_bottles_balance: newLooseBal,
        status: newBoxBal <= 0 && newLooseBal <= 0 ? 'EMPTY' : 'ACTIVE',
      });
    }

    const seq = await getNextLotSeq(today);
    const lot_id = formatLotId(today, seq);
    await base44.entities.WarehouseLot.create({
      lot_id,
      lot_date: today,
      lot_seq: seq,
      sku_code: trialSku.item_code,
      product_name: trialSku.product_name,
      brand_name: trialSku.brand_name || '',
      product_family: trialSku.product_family || '',
      flavour: trialSku.flavour || '',
      bottles_per_box: ppb,
      boxes_in: boxes,
      loose_bottles_in: 0,
      boxes_balance: boxes,
      loose_bottles_balance: 0,
      status: 'ACTIVE',
      is_trial_pack: true,
      notes: `Built from: ${validComps.map(c => c.lot_id).join(', ')}`,
    });

    setSaving(false);
    setLastResult({ lot_id, boxes, sku: trialSku.product_name });
    setStep('done');
    onRefresh();
  };

  const reset = () => {
    setTrialSkuCode('');
    setTrialBoxes('');
    setComponents([{ lot_id: '', bottles_to_use: '' }]);
    setStep('form');
    setLastResult(null);
  };

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-purple-600" />
        </div>
        <div>
          <p className="text-lg font-bold text-slate-900">Trial Pack Built!</p>
          <p className="text-sm text-slate-500">{lastResult?.boxes} boxes of {lastResult?.sku}</p>
          <p className="text-xs text-slate-400 mt-1">New Lot: {lastResult?.lot_id}</p>
        </div>
        <Button onClick={reset} className="mt-4 h-12 px-8 text-base">Build Another</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors">
          <ChevronLeft className="w-6 h-6 text-slate-700" />
        </button>
        <h2 className="text-lg font-bold text-slate-900">Trial Pack Builder</h2>
      </div>
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-700">
        🧪 Trial Pack builder deducts individual component bottles from source lots and creates a new trial pack lot.
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-700">Trial Pack Output</p>
        <div className="space-y-1">
          <Label className="text-xs">Trial Pack SKU *</Label>
          {trialSkus.length === 0 ? (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              No Trial Pack SKUs found. In SKU Setup, mark a SKU as "Is Trial Pack" first.
            </p>
          ) : (
            <select
              value={trialSkuCode}
              onChange={e => setTrialSkuCode(e.target.value)}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="">— Select Trial Pack SKU —</option>
              {trialSkus.map(s => (
                <option key={s.id} value={s.item_code}>{s.product_name} ({s.item_code})</option>
              ))}
            </select>
          )}
        </div>
        {trialSku && (
          <div className="space-y-1">
            <Label className="text-xs">Boxes to Build *</Label>
            <Input type="number" min="1" value={trialBoxes} onChange={e => setTrialBoxes(e.target.value)} placeholder="e.g. 10" className="text-sm" />
            {trialBoxes && (
              <p className="text-xs text-slate-500">= <strong>{trialBottlesNeeded}</strong> bottles needed ({trialSku.bottles_per_box} per box)</p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-700">Deduct From (Component Lots)</p>
        {components.map((comp, i) => {
          const lot = lots.find(l => l.lot_id === comp.lot_id);
          const lppb = lot?.bottles_per_box || 1;
          const availBottles = lot ? (lot.boxes_balance || 0) * lppb + (lot.loose_bottles_balance || 0) : 0;
          return (
            <div key={i} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">Component {i + 1}</p>
                {components.length > 1 && (
                  <button onClick={() => removeComp(i)} className="text-red-400 hover:text-red-600 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Source Lot</Label>
                <select
                  value={comp.lot_id}
                  onChange={e => updateComp(i, { lot_id: e.target.value, bottles_to_use: '' })}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
                >
                  <option value="">— Select Lot —</option>
                  {activeLots.map(l => {
                    const lpb = l.bottles_per_box || 1;
                    const avail = (l.boxes_balance || 0) * lpb + (l.loose_bottles_balance || 0);
                    return (
                      <option key={l.id} value={l.lot_id}>
                        {l.lot_id} · {l.product_name} · {avail} btls avail
                      </option>
                    );
                  })}
                </select>
              </div>
              {lot && (
                <>
                  <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5">
                    Available: {availBottles} bottles
                  </p>
                  <div className="space-y-1">
                    <Label className="text-xs">Bottles to Use</Label>
                    <Input type="number" min="1" max={availBottles} value={comp.bottles_to_use} onChange={e => updateComp(i, { bottles_to_use: e.target.value })} className="text-sm" />
                  </div>
                </>
              )}
            </div>
          );
        })}
        <button onClick={addComp} className="w-full border border-dashed border-slate-300 rounded-xl py-3 text-sm text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-2 min-h-[48px]">
          <Plus className="w-4 h-4" /> Add Another Source Lot
        </button>
        {totalComponentBottles > 0 && trialBottlesNeeded > 0 && (
          <div className={`text-xs px-3 py-2 rounded-lg font-semibold ${totalComponentBottles >= trialBottlesNeeded ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
            Components: {totalComponentBottles} / {trialBottlesNeeded} bottles needed
            {totalComponentBottles >= trialBottlesNeeded ? ' ✅' : ' ⚠️ Need more'}
          </div>
        )}
      </div>

      <Button className="w-full h-12 text-base bg-purple-700 hover:bg-purple-800" onClick={handleBuild} disabled={saving}>
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : '🧪 Build Trial Pack'}
      </Button>
    </div>
  );
}