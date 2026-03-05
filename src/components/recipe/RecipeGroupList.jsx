import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Search, Loader2 } from 'lucide-react';

function genId(prefix) { return prefix + '-' + Date.now().toString(36).toUpperCase().slice(-5); }

export default function RecipeGroupList({ groups, loading, selectedId, onSelect, onCreated, user }) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ recipe_name: '', notes: '' });
  const [saving, setSaving] = useState(false);

  async function createGroup() {
    if (!form.recipe_name.trim()) return;
    setSaving(true);
    // 1. Create RecipeGroup
    const grp = await base44.entities.RecipeGroup.create({
      recipe_group_id: genId('REC'),
      recipe_name: form.recipe_name.trim(),
      notes: form.notes.trim(),
      is_active: true,
    });
    // 2. Create PRIMARY option only — no version yet (version is created on first Save Version)
    await base44.entities.RecipeOption.create({
      option_id: genId('OPT'),
      recipe_group_id: grp.recipe_group_id,
      option_name: 'PRIMARY',
      is_default: true,
      is_active: true,
    });
    setForm({ recipe_name: '', notes: '' });
    setShowModal(false);
    setSaving(false);
    onCreated(grp);
  }

  const filtered = groups.filter(g =>
    !search ||
    g.recipe_name?.toLowerCase().includes(search.toLowerCase()) ||
    g.recipe_group_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Recipes</p>
        <Button size="sm" className="gap-1" onClick={() => setShowModal(true)}>
          <Plus className="w-3.5 h-3.5" /> New
        </Button>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          className="w-full pl-8 h-9 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-500"
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-1">
        {loading && <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>}
        {!loading && filtered.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-6">No recipes yet.</p>
        )}
        {filtered.map(g => (
          <button
            key={g.recipe_group_id}
            onClick={() => onSelect(g)}
            className={`w-full text-left px-3 py-3 rounded-xl text-sm transition-all ${
              selectedId === g.recipe_group_id
                ? 'bg-slate-900 text-white'
                : 'hover:bg-slate-100 text-slate-700'
            }`}
          >
            <p className="font-semibold truncate">{g.recipe_name}</p>
            <p className={`text-xs font-mono ${selectedId === g.recipe_group_id ? 'text-slate-300' : 'text-slate-400'}`}>
              {g.recipe_group_id}
            </p>
            {g.is_active === false && (
              <span className="text-xs text-slate-400 italic">Inactive</span>
            )}
          </button>
        ))}
      </div>

      {/* New Recipe Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">New Recipe</h2>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Recipe Name *</label>
              <input
                autoFocus
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
                placeholder="e.g. Apple Flavour Drink"
                value={form.recipe_name}
                onChange={e => setForm(v => ({ ...v, recipe_name: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') createGroup(); }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Notes (optional)</label>
              <textarea
                className="w-full h-20 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500 resize-none"
                placeholder="Internal notes…"
                value={form.notes}
                onChange={e => setForm(v => ({ ...v, notes: e.target.value }))}
              />
            </div>

            <div className="flex gap-3 pt-1">
              <Button
                className="flex-1"
                onClick={createGroup}
                disabled={saving || !form.recipe_name.trim()}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Recipe'}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setShowModal(false); setForm({ recipe_name: '', notes: '' }); }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}