import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Search, Loader2, ChevronDown, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react';

function genIngredientId() {
  return 'ING-' + Date.now().toString(36).toUpperCase().slice(-5);
}

function Badge({ ok }) {
  return ok
    ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">Active</span>
    : <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Inactive</span>;
}

function IngredientForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(() => ({
    ingredient_id: initial?.ingredient_id || genIngredientId(),
    ingredient_name: initial?.ingredient_name || '',
    default_uom: initial?.default_uom || '',
    is_active: initial?.is_active !== false,
    notes: initial?.notes || '',
  }));

  const isNew = !initial?.id;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Ingredient ID</label>
          <input
            className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm font-mono bg-slate-100 text-slate-500"
            value={form.ingredient_id}
            readOnly
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Default UOM</label>
          <input
            className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
            placeholder="kg, L, g, mL…"
            value={form.default_uom}
            onChange={e => setForm(v => ({ ...v, default_uom: e.target.value }))}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Ingredient Name *</label>
        <input
          className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
          placeholder="e.g., Citric Acid"
          value={form.ingredient_name}
          onChange={e => setForm(v => ({ ...v, ingredient_name: e.target.value }))}
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
        <textarea
          className="w-full h-16 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
          placeholder="Optional notes…"
          value={form.notes}
          onChange={e => setForm(v => ({ ...v, notes: e.target.value }))}
        />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={e => setForm(v => ({ ...v, is_active: e.target.checked }))}
          className="w-4 h-4"
        />
        <span className="text-sm text-slate-700">Active</span>
      </label>
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={() => onSave(form)} disabled={saving || !form.ingredient_name.trim()}>
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
    const key = recipe.recipe_id;
    if (!acc[key]) acc[key] = { recipe, lines: [] };
    acc[key].lines.push(ri);
    return acc;
  }, {});

  const entries = Object.values(grouped);

  if (entries.length === 0) {
    return <p className="text-sm text-slate-400 italic py-2">Not used in any recipe.</p>;
  }

  return (
    <div className="space-y-2 mt-2">
      <p className="text-xs font-semibold text-slate-500">Used in {entries.length} recipe(s):</p>
      {entries.map(({ recipe, lines }) => (
        <div key={recipe.recipe_id} className="bg-white border border-slate-200 rounded-lg p-3">
          <p className="font-semibold text-sm text-slate-800">{recipe.recipe_name || recipe.recipe_id}</p>
          <p className="text-xs text-slate-500 font-mono">{recipe.recipe_id}</p>
          {lines.map((l, i) => (
            <p key={i} className="text-xs text-slate-600 mt-1">
              Phase: <span className="font-mono">{l.phase}</span> · {l.qty} {l.uom}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function IngredientMasterManager() {
  const [items, setItems] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | record.id
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [ings, recs, ris] = await Promise.all([
      base44.entities.IngredientMaster.list('-created_date', 500),
      base44.entities.RecipeMaster.list('-created_date', 200),
      base44.entities.RecipeIngredient.list('-created_date', 2000),
    ]);
    setItems(ings);
    setRecipes(recs);
    setRecipeIngredients(ris);
    setLoading(false);
  }

  async function save(form) {
    setSaving(true);
    if (editing === 'new') {
      await base44.entities.IngredientMaster.create(form);
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
    if (search && !i.ingredient_name?.toLowerCase().includes(search.toLowerCase()) &&
        !i.ingredient_id?.toLowerCase().includes(search.toLowerCase())) return false;
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
            placeholder="Search ingredients…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none shrink-0">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="w-3.5 h-3.5" />
          Show inactive
        </label>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={() => { setEditing('new'); setExpandedId(null); }}>
          <Plus className="w-4 h-4" /> New
        </Button>
      </div>

      {editing === 'new' && (
        <IngredientForm initial={null} onSave={save} onCancel={() => setEditing(null)} saving={saving} />
      )}

      <div className="space-y-2">
        {filtered.map(item => {
          const isExpanded = expandedId === item.id;
          const usageCount = recipeIngredients.filter(
            ri => ri.ingredient_code === item.ingredient_id || ri.ingredient_name === item.ingredient_name
          ).length;

          return (
            <div key={item.id} className="bg-white rounded-xl border border-slate-200">
              {editing === item.id ? (
                <div className="p-3">
                  <IngredientForm initial={item} onSave={save} onCancel={() => setEditing(null)} saving={saving} />
                </div>
              ) : (
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-slate-800">{item.ingredient_name}</p>
                        <Badge ok={item.is_active} />
                        {item.default_uom && (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-mono">{item.default_uom}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{item.ingredient_id}</p>
                      {item.notes && <p className="text-xs text-slate-500 mt-0.5">{item.notes}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0 items-center">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="flex items-center gap-1 text-xs text-slate-500 px-2 py-1.5 rounded-lg hover:bg-slate-100"
                        title="Where used"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <span>{usageCount} use{usageCount !== 1 ? 's' : ''}</span>
                      </button>
                      <button
                        onClick={() => toggleActive(item)}
                        className="p-1.5 rounded-lg hover:bg-slate-100"
                        title={item.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {item.is_active
                          ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                          : <ToggleLeft className="w-5 h-5 text-slate-400" />}
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
        {filtered.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-8">No ingredients found.</p>
        )}
      </div>
    </div>
  );
}