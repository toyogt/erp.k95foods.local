import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Trash2, ToggleLeft, ToggleRight, Save, Upload, AlertTriangle, History } from 'lucide-react';
import IngredientGrid from './IngredientGrid';
import SaveVersionModal from './SaveVersionModal';
import ImportCSVModal from './ImportCSVModal';
import VersionHistoryModal from './VersionHistoryModal';

function genId(prefix) { return prefix + '-' + Date.now().toString(36).toUpperCase().slice(-5); }

const OPTION_NAMES = ['PRIMARY', 'FALLBACK_1', 'FALLBACK_2', 'FALLBACK_3'];

export default function RecipeEditor({ group, specs, uoms, brandItems, user, onGroupUpdated }) {
  // specs is passed in but needed inside saveVersion closure — keep ref
  const [options, setOptions] = useState([]);
  const [versions, setVersions] = useState([]);
  const [versionIngredients, setVersionIngredients] = useState([]);
  const [activeOptionId, setActiveOptionId] = useState(null);
  const [draftRows, setDraftRows] = useState([]);
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editingGroup, setEditingGroup] = useState(false);
  const [groupForm, setGroupForm] = useState({ recipe_name: group.recipe_name, notes: group.notes || '', is_active: group.is_active !== false });
  const [savingGroup, setSavingGroup] = useState(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    setGroupForm({ recipe_name: group.recipe_name, notes: group.notes || '', is_active: group.is_active !== false });
    loadOptions();
  }, [group.recipe_group_id]);

  async function loadOptions() {
    setLoading(true);
    const opts = await base44.entities.RecipeOption.filter({ recipe_group_id: group.recipe_group_id });
    setOptions(opts.sort((a, b) => OPTION_NAMES.indexOf(a.option_name) - OPTION_NAMES.indexOf(b.option_name)));
    const firstOpt = opts.find(o => o.is_default) || opts[0];
    if (firstOpt) {
      setActiveOptionId(firstOpt.option_id);
      await loadVersionData(firstOpt.option_id);
    }
    setLoading(false);
  }

  async function loadVersionData(optionId) {
    const vers = await base44.entities.RecipeVersion.filter({ option_id: optionId });
    const sorted = vers.sort((a, b) => (b.version_no || 0) - (a.version_no || 0));
    setVersions(sorted);
    const active = sorted.find(v => v.is_active);
    if (active) {
      const ings = await base44.entities.RecipeVersionIngredient.filter({ version_id: active.version_id });
      const rows = ings.map(r => ({ ...r, _key: r.id }));
      setDraftRows(rows);
    } else {
      setDraftRows([]);
    }
    setIsDirty(false);
  }

  async function selectOption(optId) {
    if (isDirty && !confirm('You have unsaved changes. Discard them?')) return;
    setActiveOptionId(optId);
    setLoading(true);
    await loadVersionData(optId);
    setLoading(false);
  }

  async function addOption() {
    const usedNames = options.map(o => o.option_name);
    const nextName = OPTION_NAMES.find(n => !usedNames.includes(n));
    if (!nextName) { alert('Maximum options reached.'); return; }
    const newOpt = await base44.entities.RecipeOption.create({
      option_id: genId('OPT'),
      recipe_group_id: group.recipe_group_id,
      option_name: nextName,
      is_default: false,
      is_active: true,
    });
    await loadOptions();
    setActiveOptionId(newOpt.option_id);
  }

  async function removeOption(opt) {
    if (options.length <= 1) { alert('Cannot remove the last option.'); return; }
    if (!confirm(`Remove option "${opt.option_name}"? All its versions will be deleted.`)) return;
    // Delete all versions + their ingredients
    const vers = await base44.entities.RecipeVersion.filter({ option_id: opt.option_id });
    for (const v of vers) {
      const ings = await base44.entities.RecipeVersionIngredient.filter({ version_id: v.version_id });
      await Promise.all(ings.map(i => base44.entities.RecipeVersionIngredient.delete(i.id)));
      await base44.entities.RecipeVersion.delete(v.id);
    }
    await base44.entities.RecipeOption.delete(opt.id);
    await loadOptions();
  }

  async function setDefault(opt) {
    await Promise.all(options.map(o => base44.entities.RecipeOption.update(o.id, { is_default: o.option_id === opt.option_id })));
    await loadOptions();
  }

  async function toggleOptionActive(opt) {
    await base44.entities.RecipeOption.update(opt.id, { is_active: !opt.is_active });
    await loadOptions();
  }

  async function saveVersion({ changeNote, versionName }) {
    const hasBlocked = draftRows.some(r => {
      const item = brandItems.find(bi => bi.item_id === r.ingredient_item_id);
      return r.lock_brand && item?.status === 'BLOCKED';
    });
    if (hasBlocked) { alert('Cannot save: one or more rows have a BLOCKED brand item locked.'); return; }

    const allVersions = await base44.entities.RecipeVersion.filter({ option_id: activeOptionId });
    const maxVer = allVersions.reduce((m, v) => Math.max(m, v.version_no || 0), 0);

    // Deactivate old
    await Promise.all(allVersions.filter(v => v.is_active).map(v => base44.entities.RecipeVersion.update(v.id, { is_active: false })));

    // Create new version
    const newVer = await base44.entities.RecipeVersion.create({
      version_id: genId('RV'),
      option_id: activeOptionId,
      version_no: maxVer + 1,
      version_name: versionName || '',
      change_note: changeNote,
      created_at: new Date().toISOString(),
      created_by: user?.email || '',
      is_active: true,
    });

    // Write ingredients — auto-fill uom from spec, force phase=MIX
    await Promise.all(draftRows.filter(r => r.ingredient_id).map(r => {
    const spec = specs ? specs.find(s => s.ingredient_id === r.ingredient_id) : null;
    return base44.entities.RecipeVersionIngredient.create({
      version_id: newVer.version_id,
      ingredient_id: r.ingredient_id,
      qty: parseFloat(r.qty) || 0,
      uom_id: spec?.uom_id || r.uom_id || '',
      phase: 'MIX',
        notes: r.notes || '',
        lock_brand: r.lock_brand || false,
        ingredient_item_id: r.lock_brand ? (r.ingredient_item_id || '') : '',
      });
    }));

    await base44.entities.AuditLog.create({
      action: 'RECIPE_VERSION_SAVED',
      entity_type: 'RecipeVersion',
      entity_id: newVer.version_id,
      user_email: user?.email || '',
      user_name: user?.full_name || '',
      details: { recipe_group_id: group.recipe_group_id, option_id: activeOptionId, version_no: maxVer + 1, change_note: changeNote },
    });

    setShowSaveModal(false);
    await loadVersionData(activeOptionId);
  }

  async function handleImport(rows, changeNote) {
    setDraftRows(rows.map(r => ({ ...r, _key: r._key || Date.now() + Math.random() })));
    setIsDirty(true);
    setShowImport(false);
    await saveVersion({ changeNote, versionName: 'CSV Import' });
  }

  async function saveGroupHeader() {
    setSavingGroup(true);
    await base44.entities.RecipeGroup.update(group.id, groupForm);
    setSavingGroup(false);
    setEditingGroup(false);
    onGroupUpdated();
  }

  const activeVersion = versions.find(v => v.is_active);
  const activeOption = options.find(o => o.option_id === activeOptionId);
  const blockedRows = draftRows.filter(r => {
    const item = brandItems.find(bi => bi.item_id === r.ingredient_item_id);
    return r.lock_brand && item?.status === 'BLOCKED';
  });

  if (loading && options.length === 0) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-4">
      {/* Group Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        {editingGroup ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Recipe Name *</label>
                <input className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500" value={groupForm.recipe_name} onChange={e => setGroupForm(v => ({ ...v, recipe_name: e.target.value }))} />
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 cursor-pointer pb-1">
                  <input type="checkbox" checked={groupForm.is_active} onChange={e => setGroupForm(v => ({ ...v, is_active: e.target.checked }))} className="w-4 h-4" />
                  <span className="text-sm">Active</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
              <textarea className="w-full h-12 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500" value={groupForm.notes} onChange={e => setGroupForm(v => ({ ...v, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveGroupHeader} disabled={savingGroup || !groupForm.recipe_name.trim()}>
                {savingGroup ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Header'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingGroup(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">{group.recipe_name}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${group.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {group.is_active !== false ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{group.recipe_group_id}</p>
              {group.notes && <p className="text-sm text-slate-500 mt-1">{group.notes}</p>}
              <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                <span>Ingredients: <strong className="text-slate-700">{draftRows.filter(r => r.ingredient_id).length}</strong></span>
                <span>Options: <strong className="text-slate-700">{options.length}</strong></span>
              </div>
            </div>
            {isAdmin && <Button size="sm" variant="outline" onClick={() => setEditingGroup(true)}>Edit</Button>}
          </div>
        )}
      </div>

      {/* Options Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {options.map(opt => (
          <div key={opt.option_id} className={`flex items-center gap-1 rounded-xl border transition-all ${activeOptionId === opt.option_id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <button onClick={() => selectOption(opt.option_id)} className="px-3 py-2 text-xs font-semibold">
              {opt.option_name}
              {opt.is_default && <span className="ml-1 text-xs opacity-60">(default)</span>}
            </button>
            {isAdmin && activeOptionId === opt.option_id && (
              <div className="flex items-center gap-0.5 pr-1">
                {!opt.is_default && (
                  <button onClick={() => setDefault(opt)} className="text-xs px-1.5 py-1 rounded-lg text-blue-300 hover:text-blue-100" title="Set as default">★</button>
                )}
                <button onClick={() => toggleOptionActive(opt)} className="p-1 rounded-lg hover:bg-white/20" title={opt.is_active ? 'Deactivate' : 'Activate'}>
                  {opt.is_active ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4 opacity-50" />}
                </button>
                {options.length > 1 && (
                  <button onClick={() => removeOption(opt)} className="p-1 rounded-lg hover:bg-red-500/20" title="Remove option">
                    <Trash2 className="w-3.5 h-3.5 text-red-300" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {isAdmin && options.length < OPTION_NAMES.length && (
          <button onClick={addOption} className="flex items-center gap-1 px-3 py-2 rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-500 hover:bg-slate-50">
            <Plus className="w-3.5 h-3.5" /> Add Fallback
          </button>
        )}
      </div>

      {/* Active Version Info */}
      {activeVersion && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">Active: Version {activeVersion.version_no}</span>
              {activeVersion.version_name && <span className="text-xs text-slate-500">— {activeVersion.version_name}</span>}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeVersion.change_note} · {activeVersion.created_by} · {activeVersion.created_at ? new Date(activeVersion.created_at).toLocaleDateString() : ''}
            </p>
          </div>
          <span className="text-xs text-slate-400">{versions.length} version(s) total</span>
        </div>
      )}

      {/* Blocked brand warning */}
      {blockedRows.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700 font-semibold">{blockedRows.length} row(s) have a BLOCKED brand item — fix before saving.</p>
        </div>
      )}

      {/* Ingredient Grid */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-slate-700">
              Ingredient Grid <span className="text-slate-400 font-normal">— {activeOption?.option_name}</span>
            </p>
            {isAdmin && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowImport(true)}>
                  <Upload className="w-3.5 h-3.5" /> Import CSV
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={!isDirty && draftRows.length === 0}
                  onClick={() => setShowSaveModal(true)}
                >
                  <Save className="w-3.5 h-3.5" /> Save Version
                </Button>
              </div>
            )}
          </div>
          {isDirty && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 font-semibold">
              Unsaved changes — click "Save Version" to commit.
            </div>
          )}
          <IngredientGrid
            rows={draftRows}
            onChange={rows => { setDraftRows(rows); setIsDirty(true); }}
            specs={specs.filter(s => s.is_active)}
            uoms={uoms}
            brandItems={brandItems}
            isAdmin={isAdmin}
          />
        </div>
      )}

      {showSaveModal && (
        <SaveVersionModal
          currentVersionNo={activeVersion?.version_no || 0}
          onSave={saveVersion}
          onCancel={() => setShowSaveModal(false)}
        />
      )}

      {showImport && (
        <ImportCSVModal
          specs={specs}
          uoms={uoms}
          brandItems={brandItems}
          onImport={handleImport}
          onCancel={() => setShowImport(false)}
        />
      )}
    </div>
  );
}