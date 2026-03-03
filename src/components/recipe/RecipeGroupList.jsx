import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Search, Loader2 } from 'lucide-react';

function genGroupId() { return 'REC-' + Date.now().toString(36).toUpperCase().slice(-5); }

export default function RecipeGroupList({ groups, loading, selectedId, onSelect, onCreated }) {
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  async function createGroup() {
    if (!newName.trim()) return;
    setSaving(true);
    const grp = await base44.entities.RecipeGroup.create({
      recipe_group_id: genGroupId(),
      recipe_name: newName.trim(),
      is_active: true,
    });
    // Also create the PRIMARY option
    await base44.entities.RecipeOption.create({
      option_id: 'OPT-' + Date.now().toString(36).toUpperCase().slice(-5),
      recipe_group_id: grp.recipe_group_id,
      option_name: 'PRIMARY',
      is_default: true,
      is_active: true,
    });
    setNewName('');
    setCreating(false);
    setSaving(false);
    onCreated();
  }

  const filtered = groups.filter(g =>
    !search || g.recipe_name?.toLowerCase().includes(search.toLowerCase()) || g.recipe_group_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Recipes</p>
        <Button size="sm" className="gap-1" onClick={() => setCreating(true)}><Plus className="w-3.5 h-3.5" />New</Button>
      </div>

      {creating && (
        <div className="mb-3 bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
          <input
            autoFocus
            className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
            placeholder="Recipe name…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createGroup(); if (e.key === 'Escape') setCreating(false); }}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={createGroup} disabled={saving || !newName.trim()}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Create'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setNewName(''); }}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          className="w-full pl-8 h-8 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-blue-500"
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-1">
        {loading && <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>}
        {!loading && filtered.length === 0 && <p className="text-xs text-slate-400 text-center py-6">No recipes yet.</p>}
        {filtered.map(g => (
          <button
            key={g.recipe_group_id}
            onClick={() => onSelect(g)}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all ${selectedId === g.recipe_group_id ? 'bg-slate-900 text-white' : 'hover:bg-slate-100 text-slate-700'}`}
          >
            <p className="font-semibold truncate">{g.recipe_name}</p>
            <p className={`text-xs font-mono ${selectedId === g.recipe_group_id ? 'text-slate-300' : 'text-slate-400'}`}>{g.recipe_group_id}</p>
          </button>
        ))}
      </div>
    </div>
  );
}