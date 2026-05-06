import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Search, Loader2, ChevronDown, ChevronRight, ToggleLeft, ToggleRight, Printer, Trash2, ArrowLeftRight, AlertTriangle } from 'lucide-react';
import ReplaceWizard from './ReplaceWizard';
import TablePagination from '@/components/store/TablePagination';

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
    batch_required: true,
    expiry_required: true,
    mfg_date_required: true,
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

      {/* Store Validation Rules */}
      <div className="border border-slate-200 rounded-xl p-3 space-y-2">
        <p className="text-xs font-semibold text-slate-600">Store Validation Rules</p>
        {[
          { key: 'batch_required', label: 'Batch Number Required' },
          { key: 'expiry_required', label: 'Expiry Date Required' },
          { key: 'mfg_date_required', label: 'Manufacture Date Required' },
        ].map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded" checked={!!form[key]} onChange={e => setForm(v => ({ ...v, [key]: e.target.checked }))} />
            <span className="text-sm text-slate-700">{label}</span>
          </label>
        ))}
      </div>

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

function WhereUsedPanel({ ingredient, recipeVersionIngredients, recipeVersions, recipeOptions, recipeGroups }) {
  // Filter only rows for this ingredient in ACTIVE versions
  const activeVersionIds = new Set(recipeVersions.filter(v => v.is_active).map(v => v.version_id));
  const used = recipeVersionIngredients.filter(ri =>
    ri.ingredient_id === ingredient.ingredient_id && activeVersionIds.has(ri.version_id)
  );

  // Group by RecipeGroup (distinct recipes)
  const grouped = used.reduce((acc, ri) => {
    const version = recipeVersions.find(v => v.version_id === ri.version_id);
    if (!version) return acc;
    const option = recipeOptions.find(o => o.option_id === version.option_id);
    if (!option) return acc;
    const group = recipeGroups.find(g => g.recipe_group_id === option.recipe_group_id);
    if (!group) return acc;
    const key = group.recipe_group_id;
    if (!acc[key]) acc[key] = { group, lines: [] };
    acc[key].lines.push({ ri, option, version });
    return acc;
  }, {});

  const entries = Object.values(grouped);
  if (entries.length === 0) return <p className="text-sm text-slate-400 italic py-2">Not used in any active recipe version.</p>;
  return (
    <div className="space-y-2 mt-2">
      <p className="text-xs font-semibold text-slate-500">Used in {entries.length} recipe(s):</p>
      {entries.map(({ group, lines }) => (
        <div key={group.recipe_group_id} className="bg-white border border-slate-200 rounded-lg p-3">
          <p className="font-semibold text-sm text-slate-800">{group.recipe_name}</p>
          {lines.map(({ ri, option, version }, i) => (
            <p key={i} className="text-xs text-slate-600 mt-1">
              <span className="font-mono font-semibold">{option.option_name}</span>
              {' '} v{version.version_no} · {ri.qty}
            </p>
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
  const [recipeVersionIngredients, setRecipeVersionIngredients] = useState([]);
  const [recipeVersions, setRecipeVersions] = useState([]);
  const [recipeOptions, setRecipeOptions] = useState([]);
  const [recipeGroups, setRecipeGroups] = useState([]);
  const [brandItems, setBrandItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [wizard, setWizard] = useState(null);
  const [migrating, setMigrating] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const isAdmin = user?.role === 'admin';

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [ings, grps, uomList, rvis, rvs, ropts, rgrps, bis] = await Promise.all([
      base44.entities.IngredientMaster.list('-created_date', 500),
      base44.entities.IngredientGroup.filter({ is_active: true }),
      base44.entities.UOMMaster.filter({ is_active: true }),
      base44.entities.RecipeVersionIngredient.list('-created_date', 3000),
      base44.entities.RecipeVersion.list('-created_date', 1000),
      base44.entities.RecipeOption.list('-created_date', 500),
      base44.entities.RecipeGroup.list('-created_date', 200),
      base44.entities.IngredientItem.list('-created_date', 1000),
    ]);
    setItems(ings);
    setGroups(grps.sort((a, b) => a.group_code?.localeCompare(b.group_code)));
    setUoms(uomList.sort((a, b) => a.uom_code?.localeCompare(b.uom_code)));
    setRecipeVersionIngredients(rvis);
    setRecipeVersions(rvs);
    setRecipeOptions(ropts);
    setRecipeGroups(rgrps);
    setBrandItems(bis);
    setLoading(false);
  }

  function usageOf(item) {
    // Count distinct RecipeGroups that have this ingredient in an active version
    const activeVersionIds = new Set(recipeVersions.filter(v => v.is_active).map(v => v.version_id));
    const usedVersionIds = new Set(
      recipeVersionIngredients
        .filter(ri => ri.ingredient_id === item.ingredient_id && activeVersionIds.has(ri.version_id))
        .map(ri => ri.version_id)
    );
    const groupIds = new Set();
    usedVersionIds.forEach(vid => {
      const ver = recipeVersions.find(v => v.version_id === vid);
      if (!ver) return;
      const opt = recipeOptions.find(o => o.option_id === ver.option_id);
      if (opt) groupIds.add(opt.recipe_group_id);
    });
    return groupIds.size;
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
      const created = await base44.entities.IngredientMaster.create({ ...form, short_code, barcode_value, normalized_name });

      // Auto-create Store Item Master entry with validation rules from spec form
      const uomObj = uoms.find(u => u.uom_id === form.uom_id);
      await base44.entities.StoreItemMaster.create({
        item_name: `${form.ingredient_name} (${short_code})`,
        item_code: form.ingredient_id || short_code,
        item_category: 'ingredient',
        source_entity: 'IngredientMaster',
        source_id: created.id,
        uom: uomObj?.uom_code || 'Kg',
        is_active: true,
        batch_required: !!form.batch_required,
        expiry_required: !!form.expiry_required,
        mfg_date_required: !!form.mfg_date_required,
      });
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
    const total = recipeVersionIngredients.filter(ri => ri.ingredient_id === item.ingredient_id).length;
    if (total > 0) { alert(`Cannot delete: used in ${total} recipe version line(s). Use "Merge" first.`); return; }
    if (!confirm(`Delete ingredient spec "${item.ingredient_name}"? This cannot be undone.`)) return;
    await base44.entities.IngredientMaster.delete(item.id);
    await load();
  }

  async function doReplace(oldItem, newIngId) {
    const newIng = items.find(i => i.ingredient_id === newIngId);
    // Update RecipeVersionIngredient rows
    const rvIsToUpdate = recipeVersionIngredients.filter(ri => ri.ingredient_id === oldItem.ingredient_id);
    await Promise.all(rvIsToUpdate.map(ri => base44.entities.RecipeVersionIngredient.update(ri.id, { ingredient_id: newIngId })));
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
      details: { old_id: oldItem.ingredient_id, new_id: newIngId, recipe_lines_updated: rvIsToUpdate.length, brand_items_moved: itemsToUpdate.length },
    });
    await load();
    return `${rvIsToUpdate.length} recipe line(s) and ${itemsToUpdate.length} brand item(s) moved to "${newIng?.ingredient_name}". Old spec deactivated.`;
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
          <input className="w-full pl-9 h-9 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500" placeholder="Search by name or code…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
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

      {/* Table with pagination */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-xs">
                <th className="px-3 py-2.5 text-left font-semibold w-20">Code</th>
                <th className="px-3 py-2.5 text-left font-semibold min-w-[180px]">Name</th>
                <th className="px-3 py-2.5 text-left font-semibold">Group</th>
                <th className="px-3 py-2.5 text-center font-semibold">UOM</th>
                <th className="px-3 py-2.5 text-center font-semibold">Substitution</th>
                <th className="px-3 py-2.5 text-center font-semibold">Brands</th>
                <th className="px-3 py-2.5 text-center font-semibold">Status</th>
                <th className="px-3 py-2.5 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
        {filtered.slice((page - 1) * pageSize, page * pageSize).map(item => {
          const isExpanded = expandedId === item.id;
          const group = groups.find(g => g.group_id === item.group_id);
          const uom = uoms.find(u => u.uom_id === item.uom_id);
          const total = usageOf(item);
          const specBrands = brandItems.filter(bi => bi.ingredient_id === item.ingredient_id);
          const hasBlocked = specBrands.some(bi => bi.status === 'BLOCKED');

          if (editing === item.id) {
            return (
              <tr key={item.id}><td colSpan={8} className="p-3">
                <IngredientSpecForm initial={item} groups={groups} uoms={uoms} allSpecs={items} onSave={save} onCancel={() => setEditing(null)} saving={saving} />
              </td></tr>
            );
          }
          return (
            <>
              <tr key={item.id} className={`hover:bg-slate-50 ${hasBlocked ? 'bg-red-50/30' : ''}`}>
                <td className="px-3 py-2.5">
                  <span className="font-mono font-black text-sm bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">{item.short_code || '—'}</span>
                </td>
                <td className="px-3 py-2.5">
                  <p className="font-semibold text-slate-800">{item.ingredient_name}</p>
                  <p className="text-xs text-slate-400 font-mono">{item.ingredient_id}</p>
                </td>
                <td className="px-3 py-2.5">
                  {group ? <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-mono">{group.group_code} {group.group_name}</span> : <span className="text-xs text-slate-400">—</span>}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {uom ? <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-mono">{uom.uom_code}</span> : <span className="text-xs text-slate-400">—</span>}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${item.allow_substitution !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}`}>
                    {item.allow_substitution !== false ? 'Any' : 'Fixed'}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${specBrands.length > 0 ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-400'}`}>
                    {specBrands.length}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${item.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <div className="flex gap-1 items-center justify-center flex-wrap">
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
                </td>
              </tr>
              {isExpanded && (
                <tr><td colSpan={8} className="bg-slate-50/50 px-4 py-3 border-t border-slate-100">
                  <WhereUsedPanel ingredient={item} recipeVersionIngredients={recipeVersionIngredients} recipeVersions={recipeVersions} recipeOptions={recipeOptions} recipeGroups={recipeGroups} />
                </td></tr>
              )}
            </>
          );
        })}
        {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-slate-400 text-sm">No ingredient specs found.</td></tr>}
            </tbody>
          </table>
        </div>
        <TablePagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {wizard && (
        <ReplaceWizard
          title={`Merge Spec: ${wizard.ingredient_name}`}
          oldItem={{ label: `${wizard.short_code || ''} ${wizard.ingredient_name}`, id: wizard.ingredient_id }}
          options={items.filter(i => i.ingredient_id !== wizard.ingredient_id && i.is_active).map(i => ({ value: i.ingredient_id, label: `${i.short_code || ''} — ${i.ingredient_name}` }))}
          previewLines={(newId) => {
            const rvLines = recipeVersionIngredients.filter(ri => ri.ingredient_id === wizard.ingredient_id);
            const newIng = items.find(i => i.ingredient_id === newId);
            const bis = brandItems.filter(bi => bi.ingredient_id === wizard.ingredient_id);
            return [
              `${rvLines.length} recipe version line(s) → "${newIng?.ingredient_name}"`,
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