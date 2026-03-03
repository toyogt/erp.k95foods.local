import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Loader2, ToggleLeft, ToggleRight, Trash2, ArrowLeftRight } from 'lucide-react';
import ReplaceWizard from './ReplaceWizard';

function genUomId() { return 'UOM-' + Date.now().toString(36).toUpperCase().slice(-5); }

function Badge({ ok }) {
  return ok
    ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">Active</span>
    : <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Inactive</span>;
}

function UOMForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(() => ({
    uom_id: initial?.uom_id || genUomId(),
    uom_code: initial?.uom_code || '',
    uom_name: initial?.uom_name || '',
    is_active: initial?.is_active !== false,
  }));

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">UOM ID</label>
          <input className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm font-mono bg-slate-100 text-slate-500" value={form.uom_id} readOnly />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">UOM Code *</label>
          <input
            className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:border-blue-500 uppercase"
            placeholder="KG, G, L, ML…"
            value={form.uom_code}
            onChange={e => setForm(v => ({ ...v, uom_code: e.target.value.toUpperCase() }))}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">UOM Name *</label>
        <input
          className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
          placeholder="e.g. Kilogram, Litre, Millilitre"
          value={form.uom_name}
          onChange={e => setForm(v => ({ ...v, uom_name: e.target.value }))}
        />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.is_active} onChange={e => setForm(v => ({ ...v, is_active: e.target.checked }))} className="w-4 h-4" />
        <span className="text-sm text-slate-700">Active</span>
      </label>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave(form)} disabled={saving || !form.uom_code.trim() || !form.uom_name.trim()}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export default function UOMMasterManager({ user }) {
  const [items, setItems] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [wizard, setWizard] = useState(null); // item being replaced

  const isAdmin = user?.role === 'admin';

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [uoms, ings, ris] = await Promise.all([
      base44.entities.UOMMaster.list('uom_code', 200),
      base44.entities.IngredientMaster.list('-created_date', 500),
      base44.entities.RecipeIngredient.list('-created_date', 2000),
    ]);
    setItems(uoms);
    setIngredients(ings);
    setRecipeIngredients(ris);
    setLoading(false);
  }

  function usageOf(item) {
    const ingCount = ingredients.filter(i => i.uom_id === item.uom_id).length;
    const recipeCount = recipeIngredients.filter(ri => ri.uom_id === item.uom_id).length;
    return { ingCount, recipeCount, total: ingCount + recipeCount };
  }

  async function save(form) {
    setSaving(true);
    if (editing === 'new') {
      await base44.entities.UOMMaster.create(form);
    } else {
      const rec = items.find(i => i.id === editing);
      if (rec) await base44.entities.UOMMaster.update(rec.id, form);
    }
    setEditing(null);
    await load();
    setSaving(false);
  }

  async function toggleActive(item) {
    await base44.entities.UOMMaster.update(item.id, { is_active: !item.is_active });
    await load();
  }

  async function del(item) {
    const { total } = usageOf(item);
    if (total > 0) { alert(`Cannot delete: used in ${total} place(s). Use "Replace with…" first.`); return; }
    if (!confirm(`Delete UOM "${item.uom_code}"? This cannot be undone.`)) return;
    await base44.entities.UOMMaster.delete(item.id);
    await load();
  }

  async function doReplace(oldItem, newUomId) {
    const newUom = items.find(i => i.uom_id === newUomId);
    // Update ingredients
    const ingsToUpdate = ingredients.filter(i => i.uom_id === oldItem.uom_id);
    await Promise.all(ingsToUpdate.map(i => base44.entities.IngredientMaster.update(i.id, { uom_id: newUomId })));
    // Update recipe ingredients
    const risToUpdate = recipeIngredients.filter(ri => ri.uom_id === oldItem.uom_id);
    await Promise.all(risToUpdate.map(ri => base44.entities.RecipeIngredient.update(ri.id, { uom_id: newUomId })));
    // Deactivate old
    const oldRec = items.find(i => i.uom_id === oldItem.uom_id);
    if (oldRec) await base44.entities.UOMMaster.update(oldRec.id, { is_active: false });
    // Audit log
    const me = user;
    await base44.entities.AuditLog.create({
      action: 'UOM_REPLACE',
      entity_type: 'UOMMaster',
      entity_id: oldItem.uom_id,
      user_email: me?.email || '',
      user_name: me?.full_name || '',
      details: { old_id: oldItem.uom_id, new_id: newUomId, ingredients_updated: ingsToUpdate.length, recipe_lines_updated: risToUpdate.length },
    });
    await load();
    return `Updated ${ingsToUpdate.length} ingredient(s) and ${risToUpdate.length} recipe line(s) → ${newUom?.uom_code}.`;
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">Define standard units of measure used across recipes and ingredients.</p>
        <Button size="sm" className="gap-1.5" onClick={() => setEditing('new')}><Plus className="w-4 h-4" /> New UOM</Button>
      </div>

      {editing === 'new' && <UOMForm initial={null} onSave={save} onCancel={() => setEditing(null)} saving={saving} />}

      <div className="space-y-2">
        {items.map(item => {
          const { ingCount, recipeCount, total } = usageOf(item);
          return (
            <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-3">
              {editing === item.id ? (
                <UOMForm initial={item} onSave={save} onCancel={() => setEditing(null)} saving={saving} />
              ) : (
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg min-w-[3rem] text-center">{item.uom_code}</span>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{item.uom_name}</p>
                      <p className="text-xs text-slate-400 font-mono">{item.uom_id}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Used by: <span className="font-semibold">{ingCount}</span> ingredient(s) · <span className="font-semibold">{recipeCount}</span> recipe line(s)
                        {total > 0 && <span className="ml-1 text-amber-600 font-semibold">({total} total)</span>}
                      </p>
                    </div>
                    <Badge ok={item.is_active} />
                  </div>
                  <div className="flex gap-1 items-center">
                    <button onClick={() => toggleActive(item)} className="p-1.5 rounded-lg hover:bg-slate-100" title={item.is_active ? 'Deactivate' : 'Activate'}>
                      {item.is_active ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                    </button>
                    <button onClick={() => setEditing(item.id)} className="p-1.5 rounded-lg hover:bg-slate-100"><Pencil className="w-4 h-4 text-slate-500" /></button>
                    {isAdmin && total > 0 && (
                      <button
                        onClick={() => setWizard(item)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200"
                        title="Replace with…"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" /> Replace
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => del(item)}
                        className={`p-1.5 rounded-lg ${total > 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-red-50'}`}
                        title={total > 0 ? `Used in ${total} place(s) — replace first` : 'Delete'}
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {items.length === 0 && <p className="text-center text-slate-400 text-sm py-8">No UOMs defined yet.</p>}
      </div>

      {wizard && (
        <ReplaceWizard
          title={`Replace UOM: ${wizard.uom_code}`}
          oldItem={{ label: `${wizard.uom_code} — ${wizard.uom_name}`, id: wizard.uom_id }}
          options={items
            .filter(i => i.uom_id !== wizard.uom_id && i.is_active)
            .map(i => ({ value: i.uom_id, label: `${i.uom_code} — ${i.uom_name}` }))}
          previewLines={(newId) => {
            const { ingCount, recipeCount } = usageOf(wizard);
            const newUom = items.find(i => i.uom_id === newId);
            return [
              `${ingCount} ingredient(s) will be updated to ${newUom?.uom_code}`,
              `${recipeCount} recipe line(s) will be updated to ${newUom?.uom_code}`,
              `Old UOM "${wizard.uom_code}" will be deactivated`,
            ];
          }}
          onConfirm={(newId) => doReplace(wizard, newId)}
          onClose={() => { setWizard(null); load(); }}
        />
      )}
    </div>
  );
}