import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Search, Loader2, ChevronDown, ChevronRight, ToggleLeft, ToggleRight, Printer } from 'lucide-react';

function Badge({ ok }) {
  return ok
    ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">Active</span>
    : <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Inactive</span>;
}

function genIngredientId() {
  return 'ING-' + Date.now().toString(36).toUpperCase().slice(-5);
}

function printIngredientSticker({ short_code, ingredient_name, barcode_value }) {
  const code = barcode_value || short_code;
  const win = window.open('', '_blank', 'width=400,height=300');
  win.document.write(`<!DOCTYPE html>
<html>
<head>
<title>Ingredient Sticker</title>
<style>
  @page { size: 4in 2in; margin: 0; }
  body { margin: 0; display: flex; align-items: center; justify-content: center; width: 4in; height: 2in; font-family: Arial, sans-serif; }
  .label { border: 2px solid #000; padding: 10px 16px; text-align: center; width: 90%; }
  .code { font-size: 28px; font-weight: 900; letter-spacing: 4px; font-family: monospace; }
  .name { font-size: 11px; color: #444; margin-top: 4px; }
  .barcode { font-size: 10px; font-family: 'Libre Barcode 128', monospace; font-size: 48px; line-height: 1; margin-top: 4px; }
  .barcode-txt { font-size: 10px; letter-spacing: 2px; font-family: monospace; color: #222; }
</style>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap">
</head>
<body>
  <div class="label">
    <div class="code">${short_code}</div>
    <div class="name">${ingredient_name}</div>
    <div class="barcode">${code}</div>
    <div class="barcode-txt">${code}</div>
  </div>
</body>
</html>`);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 800);
}

function IngredientForm({ initial, groups, uoms, onSave, onCancel, saving }) {
  const isNew = !initial?.id;
  const [form, setForm] = useState(() => ({
    ingredient_id: initial?.ingredient_id || genIngredientId(),
    ingredient_name: initial?.ingredient_name || '',
    group_id: initial?.group_id || '',
    uom_id: initial?.uom_id || '',
    brand_name: initial?.brand_name || '',
    notes: initial?.notes || '',
    is_active: initial?.is_active !== false,
    short_code: initial?.short_code || '',
    barcode_value: initial?.barcode_value || '',
  }));

  const selectedGroup = groups.find(g => g.group_id === form.group_id);
  const previewCode = selectedGroup && isNew
    ? `${selectedGroup.group_code}${String(selectedGroup.next_seq || 1).padStart(2, '0')}`
    : form.short_code;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Ingredient ID</label>
          <input className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm font-mono bg-slate-100 text-slate-500" value={form.ingredient_id} readOnly />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Short Code (auto)</label>
          <input
            className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm font-mono bg-slate-100 text-slate-600 font-bold"
            value={previewCode || '—'}
            readOnly
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Ingredient Name *</label>
        <input
          className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
          placeholder="e.g. Citric Acid"
          value={form.ingredient_name}
          onChange={e => setForm(v => ({ ...v, ingredient_name: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Ingredient Group *</label>
          <select
            className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500 bg-white"
            value={form.group_id}
            onChange={e => setForm(v => ({ ...v, group_id: e.target.value }))}
            disabled={!isNew}
          >
            <option value="">— Select Group —</option>
            {groups.map(g => <option key={g.group_id} value={g.group_id}>{g.group_code} — {g.group_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Default UOM *</label>
          <select
            className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500 bg-white"
            value={form.uom_id}
            onChange={e => setForm(v => ({ ...v, uom_id: e.target.value }))}
          >
            <option value="">— Select UOM —</option>
            {uoms.map(u => <option key={u.uom_id} value={u.uom_id}>{u.uom_code} — {u.uom_name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Brand Name</label>
        <input
          className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
          placeholder="Optional brand or vendor name"
          value={form.brand_name}
          onChange={e => setForm(v => ({ ...v, brand_name: e.target.value }))}
        />
      </div>

      {!isNew && (
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Barcode Value</label>
          <input
            className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:border-blue-500"
            placeholder="Defaults to short_code"
            value={form.barcode_value}
            onChange={e => setForm(v => ({ ...v, barcode_value: e.target.value }))}
          />
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
        <textarea
          className="w-full h-14 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
          value={form.notes}
          onChange={e => setForm(v => ({ ...v, notes: e.target.value }))}
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.is_active} onChange={e => setForm(v => ({ ...v, is_active: e.target.checked }))} className="w-4 h-4" />
        <span className="text-sm text-slate-700">Active</span>
      </label>

      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          onClick={() => onSave(form)}
          disabled={saving || !form.ingredient_name.trim() || !form.group_id || !form.uom_id}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function WhereUsedPanel({ ingredient, recipeIngredients, recipes }) {
  const used = recipeIngredients.filter(
    ri => ri.ingredient_code === ingredient.ingredient_id || ri.ingredient_name === ingredient.ingredient_name
  );
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
          <p className="text-xs text-slate-400 font-mono">{recipe.recipe_id}</p>
          {lines.map((l, i) => (
            <p key={i} className="text-xs text-slate-600 mt-1">Phase: <span className="font-mono">{l.phase}</span> · {l.qty} {l.uom}</p>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function IngredientMasterManager({ user }) {
  const [items, setItems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [ings, grps, uomList, recs, ris] = await Promise.all([
      base44.entities.IngredientMaster.list('-created_date', 500),
      base44.entities.IngredientGroup.filter({ is_active: true }),
      base44.entities.UOMMaster.filter({ is_active: true }),
      base44.entities.RecipeMaster.list('-created_date', 200),
      base44.entities.RecipeIngredient.list('-created_date', 2000),
    ]);
    setItems(ings);
    setGroups(grps.sort((a, b) => a.group_code?.localeCompare(b.group_code)));
    setUoms(uomList.sort((a, b) => a.uom_code?.localeCompare(b.uom_code)));
    setRecipes(recs);
    setRecipeIngredients(ris);
    setLoading(false);
  }

  async function save(form) {
    setSaving(true);
    if (editing === 'new') {
      // Generate short_code from group
      const group = groups.find(g => g.group_id === form.group_id);
      if (!group) { setSaving(false); return; }
      const seq = group.next_seq || 1;
      const short_code = `${group.group_code}${String(seq).padStart(2, '0')}`;
      const barcode_value = short_code;
      // Increment group next_seq
      const groupRec = await base44.entities.IngredientGroup.filter({ group_id: group.group_id });
      if (groupRec[0]) await base44.entities.IngredientGroup.update(groupRec[0].id, { next_seq: seq + 1 });
      await base44.entities.IngredientMaster.create({ ...form, short_code, barcode_value });
    } else {
      const rec = items.find(i => i.id === editing);
      if (rec) await base44.entities.IngredientMaster.update(rec.id, form);
    }
    setEditing(null);
    await load();
    setSaving(false);
  }

  async function toggleActive(item) {
    await base44.entities.IngredientMaster.update(item.id, { is_active: !item.is_active });
    await load();
  }

  const filtered = items.filter(i => {
    if (!showInactive && !i.is_active) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!i.ingredient_name?.toLowerCase().includes(q) &&
          !i.short_code?.toLowerCase().includes(q) &&
          !i.ingredient_id?.toLowerCase().includes(q) &&
          !i.brand_name?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full pl-9 h-9 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
            placeholder="Search by name, code, brand…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none shrink-0">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="w-3.5 h-3.5" />
          Inactive
        </label>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={() => { setEditing('new'); setExpandedId(null); }}>
          <Plus className="w-4 h-4" /> New
        </Button>
      </div>

      {editing === 'new' && (
        <IngredientForm initial={null} groups={groups} uoms={uoms} onSave={save} onCancel={() => setEditing(null)} saving={saving} />
      )}

      {/* Header row */}
      {filtered.length > 0 && (
        <div className="hidden sm:grid grid-cols-12 gap-2 px-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">
          <div className="col-span-1">Code</div>
          <div className="col-span-3">Name</div>
          <div className="col-span-2">Group</div>
          <div className="col-span-2">Brand</div>
          <div className="col-span-1">UOM</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-2"></div>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(item => {
          const isExpanded = expandedId === item.id;
          const group = groups.find(g => g.group_id === item.group_id);
          const uom = uoms.find(u => u.uom_id === item.uom_id);
          const usageCount = recipeIngredients.filter(
            ri => ri.ingredient_code === item.ingredient_id || ri.ingredient_name === item.ingredient_name
          ).length;

          return (
            <div key={item.id} className="bg-white rounded-xl border border-slate-200">
              {editing === item.id ? (
                <div className="p-3">
                  <IngredientForm initial={item} groups={groups} uoms={uoms} onSave={save} onCancel={() => setEditing(null)} saving={saving} />
                </div>
              ) : (
                <div className="p-3">
                  <div className="sm:grid sm:grid-cols-12 sm:gap-2 sm:items-center flex flex-wrap gap-2">
                    {/* Short code */}
                    <div className="col-span-1">
                      <span className="font-mono font-black text-base text-slate-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">{item.short_code || '—'}</span>
                    </div>
                    {/* Name */}
                    <div className="col-span-3">
                      <p className="font-semibold text-sm text-slate-800 truncate">{item.ingredient_name}</p>
                      <p className="text-xs text-slate-400 font-mono">{item.ingredient_id}</p>
                    </div>
                    {/* Group */}
                    <div className="col-span-2">
                      {group
                        ? <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-mono">{group.group_code} {group.group_name}</span>
                        : <span className="text-xs text-slate-400">—</span>}
                    </div>
                    {/* Brand */}
                    <div className="col-span-2">
                      <p className="text-xs text-slate-600 truncate">{item.brand_name || '—'}</p>
                    </div>
                    {/* UOM */}
                    <div className="col-span-1">
                      {uom
                        ? <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-mono">{uom.uom_code}</span>
                        : <span className="text-xs text-slate-400">{item.default_uom || '—'}</span>}
                    </div>
                    {/* Status */}
                    <div className="col-span-1">
                      <Badge ok={item.is_active} />
                    </div>
                    {/* Actions */}
                    <div className="col-span-2 flex gap-1 justify-end items-center">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="flex items-center gap-0.5 text-xs text-slate-500 px-2 py-1.5 rounded-lg hover:bg-slate-100"
                        title="Where used"
                      >
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        <span>{usageCount}</span>
                      </button>
                      {isAdmin && item.short_code && (
                        <button
                          onClick={() => printIngredientSticker(item)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500"
                          title="Print sticker"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => toggleActive(item)} className="p-1.5 rounded-lg hover:bg-slate-100" title={item.is_active ? 'Deactivate' : 'Activate'}>
                        {item.is_active ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                      </button>
                      <button onClick={() => { setEditing(item.id); setExpandedId(null); }} className="p-1.5 rounded-lg hover:bg-slate-100">
                        <Pencil className="w-4 h-4 text-slate-500" />
                      </button>
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
        {filtered.length === 0 && <p className="text-center text-slate-400 text-sm py-8">No ingredients found.</p>}
      </div>
    </div>
  );
}