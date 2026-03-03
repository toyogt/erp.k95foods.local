import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Search, Loader2, ChevronDown, ChevronRight, ToggleLeft, ToggleRight, Printer, Trash2, ArrowLeftRight, AlertTriangle } from 'lucide-react';
import ReplaceWizard from './ReplaceWizard';

function normalize(name) {
  return (name || '').toLowerCase().replace(/[\s\-_.,\/#!$%^&*;:{}=`~()]/g, '');
}

function genIngredientId() { return 'ING-' + Date.now().toString(36).toUpperCase().slice(-5); }

function printIngredientSticker({ short_code, ingredient_name, barcode_value }) {
  const code = barcode_value || short_code;
  const win = window.open('', '_blank', 'width=400,height=300');
  win.document.write(`<!DOCTYPE html>
<html><head><title>Ingredient Sticker</title>
<style>
  @page { size: 4in 2in; margin: 0; }
  body { margin: 0; display: flex; align-items: center; justify-content: center; width: 4in; height: 2in; font-family: Arial, sans-serif; }
  .label { border: 2px solid #000; padding: 10px 16px; text-align: center; width: 90%; }
  .code { font-size: 28px; font-weight: 900; letter-spacing: 4px; font-family: monospace; }
  .name { font-size: 11px; color: #444; margin-top: 4px; }
  .barcode { font-family: 'Libre Barcode 128', monospace; font-size: 48px; line-height: 1; margin-top: 4px; }
  .barcode-txt { font-size: 10px; letter-spacing: 2px; font-family: monospace; color: #222; }
</style>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap">
</head><body>
  <div class="label">
    <div class="code">${short_code}</div>
    <div class="name">${ingredient_name}</div>
    <div class="barcode">${code}</div>
    <div class="barcode-txt">${code}</div>
  </div>
</body></html>`);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 800);
}

function DuplicateWarning({ name, allSpecs, currentId, onSelectExisting }) {
  if (!name || name.length < 2) return null;
  const norm = normalize(name);
  const exact = allSpecs.find(s => s.ingredient_id !== currentId && s.normalized_name === norm);
  const partials = allSpecs.filter(s => s.ingredient_id !== currentId && s.normalized_name !== norm &&
    (s.normalized_name?.includes(norm) || norm.includes(s.normalized_name || '')) && s.normalized_name?.length > 2
  ).slice(0, 5);

  if (exact) return (
    <div className="bg-red-50 border border-red-300 rounded-lg p-3 space-y-1">
      <p className="text-xs font-semibold text-red-700 flex items-center gap-1">
        <AlertTriangle className="w-3.5 h-3.5" /> Duplicate detected
      </p>
      <p className="text-xs text-red-600">
        Already exists: <span className="font-mono font-bold">{exact.short_code}</span> {exact.ingredient_name}
      </p>
      <button onClick={() => onSelectExisting(exact)} className="text-xs underline text-red-700 font-semibold">
        Use existing instead →
      </button>
    </div>
  );

  if (partials.length > 0) return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
      <p className="text-xs font-semibold text-amber-700">Similar ingredients found — did you mean:</p>
      {partials.map(s => (
        <button key={s.ingredient_id} onClick={() => onSelectExisting(s)}
          className="block text-xs text-amber-800 underline hover:no-underline">
          {s.short_code} — {s.ingredient_name}
        </button>
      ))}
    </div>
  );

  return null;
}

function IngredientSpecForm({ initial, groups, uoms, allSpecs, onSave, onCancel, saving }) {
  const isNew = !initial?.id;
  const [form, setForm] = useState(() => ({
    ingredient_id: initial?.ingredient_id || genIngredientId(),
    ingredient_name: initial?.ingredient_name || '',
    group_id: initial?.group_id || '',
    uom_id: initial?.uom_id || '',
    allow_substitution: initial?.allow_substitution !== false,
    notes: initial?.notes || '',
    is_active: initial?.is_active !== false,
    short_code: initial?.short_code || '',
    barcode_value: initial?.barcode_value || '',
  }));

  const selectedGroup = groups.find(g => g.group_id === form.group_id);
  const previewCode = selectedGroup && isNew
    ? `${selectedGroup.group_code}${String(selectedGroup.next_seq || 1).padStart(2, '0')}`
    : form.short_code;

  const norm = normalize(form.ingredient_name);
  const exactDup = isNew && allSpecs.find(s => s.normalized_name === norm && norm.length > 1);

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Ingredient ID</label>
          <input className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm font-mono bg-slate-100 text-slate-500" value={form.ingredient_id} readOnly />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Short Code (auto)</label>
          <input className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm font-mono bg-slate-100 text-slate-600 font-bold" value={previewCode || '—'} readOnly />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Ingredient Name *</label>
        <input
          className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
          placeholder="e.g. Citric Acid Monohydrate"
          value={form.ingredient_name}
          onChange={e => setForm(v => ({ ...v, ingredient_name: e.target.value }))}
        />
      </div>

      {isNew && (
        <DuplicateWarning
          name={form.ingredient_name}
          allSpecs={allSpecs}
          currentId={form.ingredient_id}
          onSelectExisting={(existing) => onCancel(existing)}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Ingredient Group *</label>
          <select className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500 bg-white" value={form.group_id} onChange={e => setForm(v => ({ ...v, group_id: e.target.value }))} disabled={!isNew}>
            <option value="">— Select Group —</option>
            {groups.map(g => <option key={g.group_id} value={g.group_id}>{g.group_code} — {g.group_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Default UOM *</label>
          <select className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500 bg-white" value={form.uom_id} onChange={e => setForm(v => ({ ...v, uom_id: e.target.value }))}>
            <option value="">— Select UOM —</option>
            {uoms.map(u => <option key={u.uom_id} value={u.uom_id}>{u.uom_code} — {u.uom_name}</option>)}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.allow_substitution} onChange={e => setForm(v => ({ ...v, allow_substitution: e.target.checked }))} className="w-4 h-4" />
        <span className="text-sm text-slate-700">Allow brand substitution</span>
        <span className="text-xs text-slate-400">(uncheck to force specific brand in recipes)</span>
      </label>

      {!isNew && (
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Barcode Value</label>
          <input className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:border-blue-500" placeholder="Defaults to short_code" value={form.barcode_value} onChange={e => setForm(v => ({ ...v, barcode_value: e.target.value }))} />
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
        <textarea className="w-full h-14 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500" value={form.notes} onChange={e => setForm(v => ({ ...v, notes: e.target.value }))} />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.is_active} onChange={e => setForm(v => ({ ...v, is_active: e.target.checked }))} className="w-4 h-4" />
        <span className="text-sm text-slate-700">Active</span>
      </label>

      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={() => onSave(form)} disabled={saving || !form.ingredient_name.trim() || !form.group_id || !form.uom_id || !!exactDup}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Spec'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onCancel(null)}>Cancel</Button>
      </div>
    </div>
  );
}

function WhereUsedPanel({ ingredient, recipeIngredients, recipes }) {
  const used = recipeIngredients.filter(ri => ri.ingredient_id === ingredient.ingredient_id || ri.ingredient_name === ingredient.ingredient_name);
  const grouped = used.reduce((acc, ri) => {
    const recipe = recipes.find(r => r.recipe_id === ri.recipe_id);
    if (!recipe) return acc;
    if (!acc[recipe.recipe_id]) acc[recipe.recipe_id] = { recipe, lines: [] };
    acc[recipe.recipe_id].lines.push(ri);
    return acc;
  }, {});
  const entries = Object.values(grouped);
  if (entries.length === 0) return <p className="text-sm text-slate-400 italic py-2">Not used in any recipe.</p>;
  return (
    <div className="space-y-2 mt-2">
      <p className="text-xs font-semibold text-slate-500">Used in {entries.length} recipe(s):</p>
      {entries.map(({ recipe, lines }) => (
        <div key={recipe.recipe_id} className="bg-white border border-slate-200 rounded-lg p-3">
          <p className="font-semibold text-sm text-slate-800">{recipe.recipe_name || recipe.recipe_id}</p>
          {lines.map((l, i) => (
            <p key={i} className="text-xs text-slate-600 mt-1">Phase: <span className="font-mono">{l.phase}</span> · {l.qty} {l.uom}</p>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function IngredientSpecTab({ user }) {
  const [items, setItems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [brandItems, setBrandItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [wizard, setWizard] = useState(null);
  const [migrating, setMigrating] = useState(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [ings, grps, uomList, recs, ris, bis] = await Promise.all([
      base44.entities.IngredientMaster.list('-created_date', 500),
      base44.entities.IngredientGroup.filter({ is_active: true }),
      base44.entities.UOMMaster.filter({ is_active: true }),
      base44.entities.RecipeMaster.list('-created_date', 200),
      base44.entities.RecipeIngredient.list('-created_date', 2000),
      base44.entities.IngredientItem.list('-created_date', 1000),
    ]);
    setItems(ings);
    setGroups(grps.sort((a, b) => a.group_code?.localeCompare(b.group_code)));
    setUoms(uomList.sort((a, b) => a.uom_code?.localeCompare(b.uom_code)));
    setRecipes(recs);
    setRecipeIngredients(ris);
    setBrandItems(bis);
    setLoading(false);
  }

  function usageOf(item) {
    return recipeIngredients.filter(ri => ri.ingredient_id === item.ingredient_id || ri.ingredient_name === item.ingredient_name).length;
  }

  async function save(form) {
    setSaving(true);
    const normalized_name = normalize(form.ingredient_name);
    if (editing === 'new') {
      const group = groups.find(g => g.group_id === form.group_id);
      if (!group) { setSaving(false); return; }
      const seq = group.next_seq || 1;
      const short_code = `${group.group_code}${String(seq).padStart(2, '0')}`;
      const barcode_value = short_code;
      const groupRec = await base44.entities.IngredientGroup.filter({ group_id: group.group_id });
      if (groupRec[0]) await base44.entities.IngredientGroup.update(groupRec[0].id, { next_seq: seq + 1 });
      await base44.entities.IngredientMaster.create({ ...form, short_code, barcode_value, normalized_name });
    } else {
      const rec = items.find(i => i.id === editing);
      if (rec) await base44.entities.IngredientMaster.update(rec.id, { ...form, normalized_name });
    }
    setEditing(null);
    await load();
    setSaving(false);
  }

  async function toggleActive(item) {
    await base44.entities.IngredientMaster.update(item.id, { is_active: !item.is_active });
    await load();
  }

  async function del(item) {
    const total = usageOf(item);
    if (total > 0) { alert(`Cannot delete: used in ${total} recipe line(s). Use "Replace with…" first.`); return; }
    if (!confirm(`Delete ingredient spec "${item.ingredient_name}"? This cannot be undone.`)) return;
    await base44.entities.IngredientMaster.delete(item.id);
    await load();
  }

  async function doReplace(oldItem, newIngId) {
    const newIng = items.find(i => i.ingredient_id === newIngId);
    const risToUpdate = recipeIngredients.filter(ri => ri.ingredient_id === oldItem.ingredient_id || ri.ingredient_name === oldItem.ingredient_name);
    await Promise.all(risToUpdate.map(ri => base44.entities.RecipeIngredient.update(ri.id, { ingredient_id: newIngId, ingredient_name: newIng?.ingredient_name || ri.ingredient_name })));
    // Re-assign brand items
    const itemsToUpdate = brandItems.filter(bi => bi.ingredient_id === oldItem.ingredient_id);
    await Promise.all(itemsToUpdate.map(bi => base44.entities.IngredientItem.update(bi.id, { ingredient_id: newIngId })));
    // Deactivate old spec
    const oldRec = items.find(i => i.ingredient_id === oldItem.ingredient_id);
    if (oldRec) await base44.entities.IngredientMaster.update(oldRec.id, { is_active: false });
    await base44.entities.AuditLog.create({
      action: 'INGREDIENT_SPEC_REPLACE',
      entity_type: 'IngredientMaster',
      entity_id: oldItem.ingredient_id,
      user_email: user?.email || '',
      user_name: user?.full_name || '',
      details: { old_id: oldItem.ingredient_id, new_id: newIngId, recipe_lines_updated: risToUpdate.length, brand_items_moved: itemsToUpdate.length },
    });
    await load();
    return `${risToUpdate.length} recipe line(s) and ${itemsToUpdate.length} brand item(s) moved to "${newIng?.ingredient_name}". Old spec deactivated.`;
  }

  async function runMigration() {
    if (!confirm('This will create IngredientItem records from existing legacy_brand_name fields. Continue?')) return;
    setMigrating(true);
    let created = 0;
    for (const ing of items) {
      const legacyBrand = ing.legacy_brand_name || ing.brand_name;
      if (!legacyBrand) continue;
      const existing = brandItems.find(bi => bi.ingredient_id === ing.ingredient_id);
      if (existing) continue;
      const item_id = 'ITM-' + Date.now().toString(36).toUpperCase().slice(-6) + created;
      await base44.entities.IngredientItem.create({
        item_id,
        ingredient_id: ing.ingredient_id,
        brand_name: legacyBrand,
        status: 'APPROVED',
        is_active: true,
      });
      // Mark normalized_name if missing
      if (!ing.normalized_name) {
        await base44.entities.IngredientMaster.update(ing.id, { normalized_name: normalize(ing.ingredient_name) });
      }
      created++;
    }
    setMigrating(false);
    await load();
    alert(`Migration complete. Created ${created} brand item(s).`);
  }

  const filtered = items.filter(i => {
    if (!showInactive && !i.is_active) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!i.ingredient_name?.toLowerCase().includes(q) &&
          !i.short_code?.toLowerCase().includes(q) &&
          !i.ingredient_id?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const needsMigration = isAdmin && items.some(i => (i.legacy_brand_name || i.brand_name) && !brandItems.find(bi => bi.ingredient_id === i.ingredient_id));

  return (
    <div className="space-y-3">
      {needsMigration && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center justify-between gap-3">
          <p className="text-xs text-amber-800 font-semibold">Some specs have legacy brand names not yet migrated to Brand Items.</p>
          <Button size="sm" variant="outline" onClick={runMigration} disabled={migrating} className="shrink-0 border-amber-400 text-amber-800">
            {migrating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Migrate Brand Items
          </Button>
        </div>
      )}

      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="w-full pl-9 h-9 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500" placeholder="Search by name or code…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none shrink-0">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="w-3.5 h-3.5" />
          Inactive
        </label>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={() => { setEditing('new'); setExpandedId(null); }}>
          <Plus className="w-4 h-4" /> New Spec
        </Button>
      </div>

      {editing === 'new' && (
        <IngredientSpecForm
          initial={null}
          groups={groups}
          uoms={uoms}
          allSpecs={items}
          onSave={save}
          onCancel={(existing) => {
            setEditing(null);
            if (existing) setExpandedId(existing.id);
          }}
          saving={saving}
        />
      )}

      {/* Header */}
      {filtered.length > 0 && (
        <div className="hidden sm:grid grid-cols-12 gap-2 px-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">
          <div className="col-span-1">Code</div>
          <div className="col-span-3">Name</div>
          <div className="col-span-2">Group</div>
          <div className="col-span-1">UOM</div>
          <div className="col-span-1">Subs.</div>
          <div className="col-span-1">Brands</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-2"></div>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(item => {
          const isExpanded = expandedId === item.id;
          const group = groups.find(g => g.group_id === item.group_id);
          const uom = uoms.find(u => u.uom_id === item.uom_id);
          const total = usageOf(item);
          const specBrands = brandItems.filter(bi => bi.ingredient_id === item.ingredient_id);
          const hasBlocked = specBrands.some(bi => bi.status === 'BLOCKED');

          return (
            <div key={item.id} className={`bg-white rounded-xl border ${hasBlocked ? 'border-red-300' : 'border-slate-200'}`}>
              {editing === item.id ? (
                <div className="p-3">
                  <IngredientSpecForm
                    initial={item}
                    groups={groups}
                    uoms={uoms}
                    allSpecs={items}
                    onSave={save}
                    onCancel={() => setEditing(null)}
                    saving={saving}
                  />
                </div>
              ) : (
                <div className="p-3">
                  {hasBlocked && (
                    <div className="mb-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-xs text-red-700 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Has BLOCKED brand item(s)
                    </div>
                  )}
                  <div className="sm:grid sm:grid-cols-12 sm:gap-2 sm:items-center flex flex-wrap gap-2">
                    <div className="col-span-1">
                      <span className="font-mono font-black text-base bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">{item.short_code || '—'}</span>
                    </div>
                    <div className="col-span-3">
                      <p className="font-semibold text-sm text-slate-800 truncate">{item.ingredient_name}</p>
                      <p className="text-xs text-slate-400 font-mono">{item.ingredient_id}</p>
                    </div>
                    <div className="col-span-2">
                      {group ? <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-mono">{group.group_code} {group.group_name}</span> : <span className="text-xs text-slate-400">—</span>}
                    </div>
                    <div className="col-span-1">
                      {uom ? <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-mono">{uom.uom_code}</span> : <span className="text-xs text-slate-400">—</span>}
                    </div>
                    <div className="col-span-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${item.allow_substitution !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}`}>
                        {item.allow_substitution !== false ? 'Any' : 'Fixed'}
                      </span>
                    </div>
                    <div className="col-span-1">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${specBrands.length > 0 ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-400'}`}>
                        {specBrands.length}
                      </span>
                    </div>
                    <div className="col-span-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${item.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {item.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="col-span-2 flex gap-1 justify-end items-center flex-wrap">
                      <button onClick={() => setExpandedId(isExpanded ? null : item.id)} className="flex items-center gap-0.5 text-xs text-slate-500 px-2 py-1.5 rounded-lg hover:bg-slate-100" title="Where used">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        <span className={total > 0 ? 'text-amber-600 font-semibold' : ''}>{total}</span>
                      </button>
                      {isAdmin && item.short_code && (
                        <button onClick={() => printIngredientSticker(item)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500" title="Print sticker">
                          <Printer className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => toggleActive(item)} className="p-1.5 rounded-lg hover:bg-slate-100" title={item.is_active ? 'Deactivate' : 'Activate'}>
                        {item.is_active ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                      </button>
                      <button onClick={() => { setEditing(item.id); setExpandedId(null); }} className="p-1.5 rounded-lg hover:bg-slate-100">
                        <Pencil className="w-4 h-4 text-slate-500" />
                      </button>
                      {isAdmin && total > 0 && (
                        <button onClick={() => setWizard(item)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200">
                          <ArrowLeftRight className="w-3.5 h-3.5" /> Merge
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => del(item)} className={`p-1.5 rounded-lg ${total > 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-red-50'}`} title={total > 0 ? `Used in ${total} place(s)` : 'Delete'}>
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <WhereUsedPanel ingredient={item} recipeIngredients={recipeIngredients} recipes={recipes} />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-slate-400 text-sm py-8">No ingredient specs found.</p>}
      </div>

      {wizard && (
        <ReplaceWizard
          title={`Merge Spec: ${wizard.ingredient_name}`}
          oldItem={{ label: `${wizard.short_code || ''} ${wizard.ingredient_name}`, id: wizard.ingredient_id }}
          options={items.filter(i => i.ingredient_id !== wizard.ingredient_id && i.is_active).map(i => ({ value: i.ingredient_id, label: `${i.short_code || ''} — ${i.ingredient_name}` }))}
          previewLines={(newId) => {
            const total = usageOf(wizard);
            const newIng = items.find(i => i.ingredient_id === newId);
            const bis = brandItems.filter(bi => bi.ingredient_id === wizard.ingredient_id);
            return [
              `${total} recipe line(s) → "${newIng?.ingredient_name}"`,
              `${bis.length} brand item(s) will be re-assigned`,
              `Old spec will be deactivated`,
            ];
          }}
          onConfirm={(newId) => doReplace(wizard, newId)}
          onClose={() => { setWizard(null); load(); }}
        />
      )}
    </div>
  );
}