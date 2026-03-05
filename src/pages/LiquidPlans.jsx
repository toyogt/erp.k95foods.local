import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Plus, Loader2, Search, ChevronDown, ChevronRight, Trash2, Info, AlertTriangle
} from 'lucide-react';

// ── helpers ────────────────────────────────────────────────
function genPlanId() {
  return 'LP-' + Math.random().toString(36).slice(2, 7).toUpperCase();
}
function genAllocId() {
  return 'AL-' + Math.random().toString(36).slice(2, 7).toUpperCase();
}
function computeRequired(bottles, bpb) {
  const tb = Number(bottles) || 0;
  const b  = Number(bpb)     || 1;
  const boxes = Math.ceil(tb / b);
  return boxes * b;
}

const STATUS_COLORS = {
  DRAFT:     'bg-slate-100 text-slate-700',
  RELEASED:  'bg-blue-100 text-blue-700',
  STARTED:   'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CLOSED:    'bg-slate-200 text-slate-600',
};
const ALLOC_TYPE_COLORS = {
  FIXED:     'bg-purple-100 text-purple-700',
  UP_TO:     'bg-cyan-100 text-cyan-700',
  REMAINDER: 'bg-orange-100 text-orange-700',
};

// ── Allocation row editor ───────────────────────────────────
function AllocRow({ alloc, products, boxTypes, onRemove, onChange }) {
  const sku = products.find(p => p.item_code === alloc.sku_code);
  const bpb = (() => {
    if (!sku) return null;
    if (sku.bottles_per_box) return sku.bottles_per_box;
    if (sku.box_type_id) {
      const bt = boxTypes.find(b => b.box_type_id === sku.box_type_id);
      return bt?.bottles_per_box || null;
    }
    return null;
  })();
  const required = bpb && alloc.target_bottles_requested
    ? computeRequired(alloc.target_bottles_requested, bpb) : null;
  const roundingUp = required && Number(alloc.target_bottles_requested)
    ? required - Number(alloc.target_bottles_requested) : 0;

  return (
    <div className="flex flex-wrap gap-2 items-start bg-slate-50 border border-slate-200 rounded-lg p-3">
      <div className="flex-1 min-w-[140px]">
        <p className="text-xs text-slate-500 mb-0.5">SKU</p>
        <p className="font-mono text-xs font-bold text-slate-800">{alloc.sku_code}</p>
        {sku && <p className="text-xs text-slate-500">{sku.product_name}</p>}
      </div>
      <div className="min-w-[110px]">
        <p className="text-xs text-slate-500 mb-0.5">Type</p>
        <select
          value={alloc.allocation_type}
          onChange={e => onChange({ ...alloc, allocation_type: e.target.value })}
          className="w-full border border-slate-200 rounded-md px-2 py-1 text-xs bg-white h-8"
        >
          <option value="FIXED">FIXED</option>
          <option value="UP_TO">UP_TO</option>
          <option value="REMAINDER">REMAINDER</option>
        </select>
      </div>
      <div className="min-w-[110px]">
        <p className="text-xs text-slate-500 mb-0.5">Target Bottles</p>
        <Input
          type="number" min="1"
          value={alloc.target_bottles_requested}
          onChange={e => onChange({ ...alloc, target_bottles_requested: e.target.value })}
          className="h-8 text-xs"
          disabled={alloc.allocation_type === 'REMAINDER'}
          placeholder={alloc.allocation_type === 'REMAINDER' ? 'Auto' : ''}
        />
      </div>
      <div className="min-w-[80px]">
        <p className="text-xs text-slate-500 mb-0.5">Required</p>
        <p className="text-xs font-semibold text-slate-800 mt-1.5">
          {alloc.allocation_type === 'REMAINDER' ? '—' : (required ?? '—')}
        </p>
        {roundingUp > 0 && alloc.allocation_type !== 'REMAINDER' && (
          <p className="text-xs text-amber-600 flex items-center gap-0.5 mt-0.5">
            <Info className="w-3 h-3" />+{roundingUp}
          </p>
        )}
      </div>
      <button onClick={onRemove} className="mt-5 p-1.5 rounded hover:bg-red-50">
        <Trash2 className="w-4 h-4 text-red-400" />
      </button>
    </div>
  );
}

// ── Add-SKU picker (filtered by recipe_group) ───────────────
function AddAllocPicker({ products, boxTypes, recipeGroupId, existingSkus, onAdd }) {
  const [sku, setSku] = useState('');
  const [type, setType] = useState('FIXED');
  const [bottles, setBottles] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function h(e) { if (!ref.current?.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const eligible = products.filter(p =>
    p.recipe_group_id === recipeGroupId && !existingSkus.includes(p.item_code)
  );
  const filtered = eligible.filter(p => {
    if (!q) return true;
    return `${p.item_code} ${p.product_name || ''} ${p.brand_name || ''}`.toLowerCase().includes(q.toLowerCase());
  }).slice(0, 30);

  const selectedP = products.find(p => p.item_code === sku);
  const bpb = (() => {
    if (!selectedP) return null;
    if (selectedP.bottles_per_box) return selectedP.bottles_per_box;
    if (selectedP.box_type_id) {
      const bt = boxTypes.find(b => b.box_type_id === selectedP.box_type_id);
      return bt?.bottles_per_box || null;
    }
    return null;
  })();

  const required = bpb && bottles && type !== 'REMAINDER'
    ? computeRequired(bottles, bpb) : null;

  function addRow() {
    if (!sku) return;
    if (type !== 'REMAINDER' && !bottles) return;
    onAdd({
      _localId: Math.random().toString(36).slice(2),
      sku_code: sku,
      allocation_type: type,
      target_bottles_requested: type === 'REMAINDER' ? 0 : Number(bottles),
      required_bottles: type === 'REMAINDER' ? 0 : (required || Number(bottles)),
      bpb,
    });
    setSku(''); setBottles(''); setType('FIXED'); setQ('');
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
      <p className="text-xs font-semibold text-blue-800">Add SKU Allocation</p>
      {eligible.length === 0 && (
        <p className="text-xs text-amber-700 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          No active SKUs linked to this recipe group.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* SKU picker */}
        <div className="relative sm:col-span-2" ref={ref}>
          <button
            type="button"
            onClick={() => { setOpen(o => !o); setQ(''); }}
            className="w-full flex items-center justify-between border border-slate-200 rounded-md px-3 py-1.5 text-xs bg-white text-left h-8"
          >
            <span className={sku ? 'font-mono font-bold text-slate-900' : 'text-slate-400'}>
              {sku ? `${sku} — ${selectedP?.product_name || ''}` : '— Select SKU (filtered by recipe group) —'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
          {open && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg">
              <div className="p-1.5 border-b border-slate-100">
                <input autoFocus className="w-full px-2 py-1 text-xs border border-slate-200 rounded outline-none"
                  placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />
              </div>
              <div className="max-h-44 overflow-y-auto">
                {filtered.length === 0 && <p className="text-xs text-slate-400 text-center py-3">No SKUs</p>}
                {filtered.map(p => (
                  <button key={p.id} type="button" onClick={() => { setSku(p.item_code); setOpen(false); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-xs">
                    <span className="font-mono font-bold">{p.item_code}</span>
                    <span className="text-slate-500 ml-2">{p.product_name}{p.brand_name ? ` · ${p.brand_name}` : ''}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div>
          <select value={type} onChange={e => setType(e.target.value)}
            className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs bg-white h-8">
            <option value="FIXED">FIXED</option>
            <option value="UP_TO">UP_TO</option>
            <option value="REMAINDER">REMAINDER</option>
          </select>
        </div>
      </div>
      {type !== 'REMAINDER' && (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input type="number" min="1" placeholder="Target bottles" value={bottles}
              onChange={e => setBottles(e.target.value)} className="h-8 text-xs" />
          </div>
          {required && Number(bottles) && required !== Number(bottles) && (
            <p className="text-xs text-amber-600 pb-1 flex items-center gap-0.5">
              <Info className="w-3 h-3" /> Required: {required} (+{required - Number(bottles)})
            </p>
          )}
        </div>
      )}
      <Button size="sm" className="text-xs h-7" onClick={addRow} disabled={!sku || (type !== 'REMAINDER' && !bottles)}>
        <Plus className="w-3 h-3 mr-1" /> Add Row
      </Button>
    </div>
  );
}

// ── Create Plan Dialog ─────────────────────────────────────
function CreatePlanDialog({ open, onClose, products, boxTypes, recipeGroups, recipeOptions, onCreated }) {
  const [recipeGroupId, setRecipeGroupId] = useState('');
  const [optionId, setOptionId] = useState('');
  const [notes, setNotes] = useState('');
  const [allocs, setAllocs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) { setRecipeGroupId(''); setOptionId(''); setNotes(''); setAllocs([]); setError(''); }
  }, [open]);

  // When group changes, default to PRIMARY option
  useEffect(() => {
    if (!recipeGroupId) return;
    const opts = recipeOptions.filter(o => o.recipe_group_id === recipeGroupId && o.is_active !== false);
    const primary = opts.find(o => o.is_default) || opts[0];
    setOptionId(primary?.option_id || '');
    setAllocs([]);
  }, [recipeGroupId]);

  const groupOptions = recipeOptions.filter(o => o.recipe_group_id === recipeGroupId && o.is_active !== false);
  const remainderCount = allocs.filter(a => a.allocation_type === 'REMAINDER').length;

  async function save() {
    setError('');
    if (!recipeGroupId) { setError('Select a recipe group.'); return; }
    if (!optionId)      { setError('Select a recipe option.'); return; }
    if (allocs.length === 0) { setError('Add at least one SKU allocation.'); return; }
    if (remainderCount > 1) { setError('Only one REMAINDER allocation allowed per plan.'); return; }

    setSaving(true);
    const planId = genPlanId();
    await base44.entities.LiquidBatchPlan.create({
      plan_id: planId,
      recipe_id: recipeGroupId,
      recipe_name: recipeGroups.find(g => g.recipe_group_id === recipeGroupId)?.recipe_name || recipeGroupId,
      status: 'RELEASED',
      notes,
    });

    let seq = 1;
    for (const a of allocs) {
      const allocId = genAllocId();
      const product = products.find(p => p.item_code === a.sku_code);
      await base44.entities.SKUAllocation.create({
        allocation_id: allocId,
        plan_id: planId,
        sku_code: a.sku_code,
        allocation_type: a.allocation_type,
        target_bottles_requested: a.target_bottles_requested,
        required_bottles: a.required_bottles,
        produced_bottles_packed: 0,
        status: 'RELEASED',
      });

      // Auto-create one PackingWO per allocation
      const woId = `WO-${planId}-${seq}`;
      await base44.entities.PackingWO.create({
        wo_id: woId,
        plan_id: planId,
        allocation_id: allocId,
        sku_code: a.sku_code,
        product: product?.product_name || a.sku_code,
        product_code: a.sku_code,
        label_sku_code: a.sku_code,
        bottle_type: product?.bottle_type || '',
        target_bottles: a.required_bottles,
        required_bottles: a.required_bottles,
        assigned_line: '',
        status: 'RELEASED',
        priority: seq,
        batch_id: '',
      });
      seq++;
    }
    setSaving(false);
    onCreated(planId);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Liquid Batch Plan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {/* Recipe Group */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Recipe Group *</Label>
              <select value={recipeGroupId} onChange={e => setRecipeGroupId(e.target.value)}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white h-9">
                <option value="">— Select group —</option>
                {recipeGroups.filter(g => g.is_active !== false).map(g => (
                  <option key={g.id} value={g.recipe_group_id}>{g.recipe_name} ({g.recipe_group_id})</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Recipe Option *</Label>
              <select value={optionId} onChange={e => setOptionId(e.target.value)}
                disabled={!recipeGroupId}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white h-9 disabled:opacity-50">
                <option value="">— Select option —</option>
                {groupOptions.map(o => (
                  <option key={o.id} value={o.option_id}>
                    {o.option_name}{o.is_default ? ' (PRIMARY)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm" rows="2" />
          </div>

          {/* Allocations */}
          {recipeGroupId && (
            <>
              <p className="text-sm font-semibold text-slate-700">SKU Allocations</p>
              {allocs.map((a, i) => (
                <AllocRow key={a._localId} alloc={a} products={products} boxTypes={boxTypes}
                  onRemove={() => setAllocs(arr => arr.filter((_, j) => j !== i))}
                  onChange={updated => setAllocs(arr => arr.map((x, j) => j === i ? { ...x, ...updated } : x))} />
              ))}
              <AddAllocPicker
                products={products} boxTypes={boxTypes}
                recipeGroupId={recipeGroupId}
                existingSkus={allocs.map(a => a.sku_code)}
                onAdd={row => setAllocs(arr => [...arr, row])} />
              {remainderCount > 1 && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Only 1 REMAINDER allowed per plan.
                </p>
              )}
            </>
          )}

          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function LiquidPlans() {
  const [user, setUser]           = useState(null);
  const [plans, setPlans]         = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [products, setProducts]   = useState([]);
  const [boxTypes, setBoxTypes]   = useState([]);
  const [recipeGroups, setRecipeGroups] = useState([]);
  const [recipeOptions, setRecipeOptions] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [expandedPlan, setExpandedPlan] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); loadData(); });
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [pls, alcs, prods, bts, rgs, opts, packedEvents] = await Promise.all([
      base44.entities.LiquidBatchPlan.list('-created_date', 500),
      base44.entities.SKUAllocation.list('-created_date', 1000),
      base44.entities.ProductMaster.filter({ is_active: true }, '-created_date', 500),
      base44.entities.BoxType.list('-created_date', 200).catch(() => []),
      base44.entities.RecipeGroup.list('-created_date', 200).catch(() => []),
      base44.entities.RecipeOption.list('-created_date', 500).catch(() => []),
      base44.entities.PackedOutputEvent.filter({ status: 'ACTIVE' }, '-created_date', 5000).catch(() => []),
    ]);
    for (const a of alcs) {
      const events = packedEvents.filter(e => e.allocation_id === a.allocation_id);
      a.produced_bottles_packed = events.reduce((s, e) => s + (e.packed_bottles || 0), 0);
    }
    setPlans(pls); setAllocations(alcs); setProducts(prods);
    setBoxTypes(bts); setRecipeGroups(rgs); setRecipeOptions(opts);
    setLoading(false);
  };

  const getAllocsByPlan = (planId) => allocations.filter(a => a.plan_id === planId);

  const filteredPlans = plans.filter(p =>
    !search ||
    (p.plan_id || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.recipe_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.recipe_id || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!user) return <div className="text-center py-12 text-slate-500">Unauthorized</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Liquid Batch Plans</h1>
        <p className="text-sm text-slate-500">Recipe-level plans with SKU allocations (FIXED / UP_TO / REMAINDER)</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
          <Input className="pl-8 w-56 text-sm" placeholder="Search plans…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5 text-xs">
          <Plus className="w-3.5 h-3.5" /> New Plan
        </Button>
      </div>

      <div className="space-y-3">
        {filteredPlans.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">No plans found</div>
        ) : filteredPlans.map(plan => {
          const planAllocs = getAllocsByPlan(plan.plan_id);
          const totalProduced = planAllocs.reduce((s, a) => s + (a.produced_bottles_packed || 0), 0);
          const totalRequired = planAllocs.filter(a => a.allocation_type !== 'REMAINDER').reduce((s, a) => s + (a.required_bottles || 0), 0);
          const isExpanded = expandedPlan === plan.id;
          const pct = totalRequired > 0 ? Math.round((totalProduced / totalRequired) * 100) : 0;

          return (
            <div key={plan.id} className="border border-slate-200 rounded-xl bg-white">
              <div className="p-4 flex justify-between items-start cursor-pointer hover:bg-slate-50 rounded-xl"
                onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}>
                <div className="flex items-start gap-2">
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-mono font-bold text-slate-900">{plan.plan_id}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[plan.status] || STATUS_COLORS.DRAFT}`}>
                        {plan.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Recipe: <span className="font-mono font-semibold">{plan.recipe_id}</span>
                      {plan.recipe_name && plan.recipe_name !== plan.recipe_id && ` — ${plan.recipe_name}`}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Allocations: {planAllocs.length} | Produced: <b className="text-green-700">{totalProduced}</b> / {totalRequired} btl
                      {totalRequired > 0 && ` (${pct}%)`}
                    </p>
                    {plan.notes && <p className="text-xs text-slate-500 mt-0.5">{plan.notes}</p>}
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-100 p-4 space-y-3 bg-slate-50 rounded-b-xl">
                  {planAllocs.length === 0 ? (
                    <p className="text-sm text-slate-500">No allocations</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100 text-slate-600 uppercase tracking-wide">
                          <tr>
                            <th className="px-3 py-2 text-left">SKU</th>
                            <th className="px-3 py-2 text-left">Type</th>
                            <th className="px-3 py-2 text-right">Requested</th>
                            <th className="px-3 py-2 text-right">Required</th>
                            <th className="px-3 py-2 text-right">Produced</th>
                            <th className="px-3 py-2 text-right">Pending</th>
                            <th className="px-3 py-2 text-center">Status</th>
                            <th className="px-3 py-2 text-center">Order</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {planAllocs.map(a => {
                            const prod = products.find(p => p.item_code === a.sku_code);
                            const pending = Math.max(0, (a.required_bottles || 0) - (a.produced_bottles_packed || 0));
                            return (
                              <tr key={a.id} className="hover:bg-slate-50">
                                <td className="px-3 py-2">
                                  <p className="font-mono font-bold">{a.sku_code}</p>
                                  {prod && <p className="text-slate-500 font-normal">{prod.product_name}</p>}
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 rounded-full font-medium ${ALLOC_TYPE_COLORS[a.allocation_type] || ''}`}>
                                    {a.allocation_type}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right">{a.target_bottles_requested ?? '—'}</td>
                                <td className="px-3 py-2 text-right font-semibold">{a.allocation_type === 'REMAINDER' ? '—' : a.required_bottles}</td>
                                <td className="px-3 py-2 text-right font-semibold text-green-700">{a.produced_bottles_packed || 0}</td>
                                <td className="px-3 py-2 text-right font-semibold text-orange-600">{a.allocation_type === 'REMAINDER' ? '—' : pending}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`px-2 py-0.5 rounded-full font-medium ${
                                    a.status === 'DONE' ? 'bg-green-100 text-green-700' :
                                    a.status === 'RUNNING' ? 'bg-amber-100 text-amber-700' :
                                    'bg-slate-100 text-slate-600'}`}>{a.status}</span>
                                </td>
                                <td className="px-3 py-2 text-center font-mono text-slate-500">{a.order_id || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Progress bar */}
                  {totalRequired > 0 && (
                    <div className="bg-white border border-slate-200 rounded-lg p-3">
                      <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                        <span>Progress</span>
                        <span>{totalProduced} / {totalRequired} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <CreatePlanDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        products={products}
        boxTypes={boxTypes}
        recipeGroups={recipeGroups}
        recipeOptions={recipeOptions}
        onCreated={() => { setCreateOpen(false); loadData(); }}
      />
    </div>
  );
}