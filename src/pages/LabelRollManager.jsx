import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Printer, Package } from 'lucide-react';
import { printReactComponent } from '@/components/printing/printLabel';
import RollBarcodeLabel from '@/components/labelling/RollBarcodeLabel';
import RollLookup from '@/components/labelling/RollLookup';

function genRollId() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  return `LR-${ymd}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
}
function genEventId() { return 'RLE-' + Date.now().toString(36).toUpperCase(); }

const STATUS_STYLE = {
  AVAILABLE: 'bg-blue-100 text-blue-800',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  LEFTOVER: 'bg-amber-100 text-amber-800',
  FINISHED: 'bg-slate-200 text-slate-700',
  QUARANTINED: 'bg-red-100 text-red-800',
};

export default function LabelRollManager() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('rolls');

  // Create roll form
  const [form, setForm] = useState({ label_variant_id: '', product_code: '', declared_qty_labels: '', notes: '' });
  const [newRollId, setNewRollId] = useState(genRollId());
  const [saving, setSaving] = useState(false);
  const [savedRoll, setSavedRoll] = useState(null);

  // Roll list
  const [rolls, setRolls] = useState([]);
  const [loadingRolls, setLoadingRolls] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    loadRolls();
  }, []);

  async function loadRolls() {
    setLoadingRolls(true);
    try {
      const r = await base44.entities.LabelRoll.list('-created_at', 100);
      setRolls(r);
    } catch { /* offline */ }
    setLoadingRolls(false);
  }

  async function createRoll() {
    setSaving(true);
    const now = new Date().toISOString();
    const roll = {
      roll_id: newRollId,
      label_variant_id: form.label_variant_id,
      product_code: form.product_code,
      declared_qty_labels: form.declared_qty_labels ? Number(form.declared_qty_labels) : undefined,
      status: 'AVAILABLE',
      created_at: now,
      created_by: user?.email || '',
      notes: form.notes,
    };
    await base44.entities.LabelRoll.create(roll);
    await base44.entities.LabelRollEvent.create({
      event_id: genEventId(),
      roll_id: newRollId,
      event_type: 'RECEIVED',
      qty_labels: form.declared_qty_labels ? Number(form.declared_qty_labels) : undefined,
      created_at: now,
      created_by: user?.email || '',
    });
    setSavedRoll(roll);
    setForm({ label_variant_id: '', product_code: '', declared_qty_labels: '', notes: '' });
    setNewRollId(genRollId());
    setSaving(false);
    loadRolls();
  }

  function printSticker(roll) {
    printReactComponent(RollBarcodeLabel, {
      roll_id: roll.roll_id,
      label_variant_id: roll.label_variant_id,
      product_code: roll.product_code,
      declared_qty_labels: roll.declared_qty_labels,
    });
  }

  const isSupervisor = user?.role === 'admin' || user?.role === 'labelling_supervisor' || user?.role === 'production_manager';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Label Roll Manager</h1>
        <p className="text-sm text-slate-500">Track rolls received, installed, waste, and leftover</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="rolls" className="flex-1">Rolls</TabsTrigger>
          <TabsTrigger value="create" className="flex-1">Create Roll</TabsTrigger>
          <TabsTrigger value="lookup" className="flex-1">Roll Lookup</TabsTrigger>
        </TabsList>

        {/* ---- ROLLS LIST ---- */}
        <TabsContent value="rolls" className="space-y-3 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">All Rolls</p>
            <Button size="sm" variant="outline" onClick={loadRolls} disabled={loadingRolls}>
              {loadingRolls ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
            </Button>
          </div>
          {rolls.length === 0 && !loadingRolls && (
            <p className="text-sm text-slate-400 text-center py-8">No rolls found. Create one first.</p>
          )}
          <div className="space-y-2">
            {rolls.map(r => (
              <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono font-bold text-slate-900 truncate">{r.roll_id}</p>
                  {r.product_code && <p className="text-xs text-slate-500 truncate">{r.product_code}</p>}
                  {r.label_variant_id && <p className="text-xs text-slate-400 truncate">Variant: {r.label_variant_id}</p>}
                  {r.declared_qty_labels != null && <p className="text-xs text-slate-400">Declared: {r.declared_qty_labels.toLocaleString()}</p>}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status] || 'bg-slate-100 text-slate-700'}`}>{r.status}</span>
                  <Button size="sm" variant="ghost" onClick={() => printSticker(r)} className="h-7 px-2 gap-1 text-xs text-slate-500">
                    <Printer className="w-3 h-3" /> Sticker
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ---- CREATE ROLL ---- */}
        <TabsContent value="create" className="space-y-4 mt-4">
          {savedRoll && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-800">Roll created: {savedRoll.roll_id}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => printSticker(savedRoll)} className="gap-1">
                <Printer className="w-4 h-4" /> Print Sticker
              </Button>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">New Roll</p>

            <div className="space-y-1">
              <p className="text-xs text-slate-500">Roll ID (auto-generated)</p>
              <div className="flex gap-2">
                <input
                  className="flex-1 h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono bg-slate-50"
                  value={newRollId}
                  onChange={e => setNewRollId(e.target.value)}
                />
                <Button variant="outline" size="sm" onClick={() => setNewRollId(genRollId())}>Regenerate</Button>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-slate-500">Product Code</p>
              <input
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
                placeholder="e.g. PRD-001"
                value={form.product_code}
                onChange={e => setForm(f => ({ ...f, product_code: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs text-slate-500">Label Variant / SKU</p>
              <input
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
                placeholder="e.g. LBL-500ML-MANGO"
                value={form.label_variant_id}
                onChange={e => setForm(f => ({ ...f, label_variant_id: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs text-slate-500">Declared Qty (labels on roll)</p>
              <input
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
                type="number"
                min="0"
                placeholder="e.g. 5000 (optional)"
                value={form.declared_qty_labels}
                onChange={e => setForm(f => ({ ...f, declared_qty_labels: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs text-slate-500">Notes (optional)</p>
              <input
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
                placeholder="e.g. Lot 2024-A"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <Button className="w-full h-11" onClick={createRoll} disabled={saving || !newRollId.trim()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-2" />Create Roll</>}
            </Button>
          </div>
        </TabsContent>

        {/* ---- ROLL LOOKUP ---- */}
        <TabsContent value="lookup" className="space-y-4 mt-4">
          <RollLookup />
        </TabsContent>
      </Tabs>
    </div>
  );
}