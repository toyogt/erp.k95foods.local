import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Loader2, ToggleLeft, ToggleRight, Trash2, ArrowLeftRight, Search } from 'lucide-react';
import ReplaceWizard from './ReplaceWizard';
import TablePagination from '@/components/store/TablePagination';

function genGroupId() { return 'GRP-' + Date.now().toString(36).toUpperCase().slice(-5); }

function Badge({ ok }) {
  return ok
    ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">Active</span>
    : <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Inactive</span>;
}

function GroupForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(() => ({
    group_id: initial?.group_id || genGroupId(),
    group_code: initial?.group_code || '',
    group_name: initial?.group_name || '',
    next_seq: initial?.next_seq || 1,
    is_active: initial?.is_active !== false,
    notes: initial?.notes || '',
  }));
  const isNew = !initial?.id;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Group ID</label>
          <input className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm font-mono bg-slate-100 text-slate-500" value={form.group_id} readOnly />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Group Code * (2 letters)</label>
          <input
            className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:border-blue-500 uppercase tracking-widest"
            placeholder="FL"
            maxLength={2}
            value={form.group_code}
            readOnly={!isNew}
            onChange={e => setForm(v => ({ ...v, group_code: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) }))}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Group Name *</label>
        <input
          className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
          placeholder="e.g. Flavour, Acid, Sweetener"
          value={form.group_name}
          onChange={e => setForm(v => ({ ...v, group_name: e.target.value }))}
        />
      </div>
      {!isNew && (
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Next Sequence (read-only)</label>
          <input className="w-24 h-9 px-3 rounded-lg border border-slate-200 text-sm font-mono bg-slate-100 text-slate-500" value={form.next_seq} readOnly />
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
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave(form)} disabled={saving || form.group_code.length !== 2 || !form.group_name.trim()}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export default function IngredientGroupManager({ user }) {
  const [items, setItems] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [wizard, setWizard] = useState(null);

  const isAdmin = user?.role === 'admin';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [grps, ings] = await Promise.all([
      base44.entities.IngredientGroup.list('group_code', 200),
      base44.entities.IngredientMaster.list('-created_date', 500),
    ]);
    setItems(grps);
    setIngredients(ings);
    setLoading(false);
  }

  function usageOf(item) {
    return ingredients.filter(i => i.group_id === item.group_id).length;
  }

  async function save(form) {
    setSaving(true);
    if (editing === 'new') {
      await base44.entities.IngredientGroup.create({ ...form, next_seq: 1 });
    } else {
      const rec = items.find(i => i.id === editing);
      if (rec) await base44.entities.IngredientGroup.update(rec.id, form);
    }
    setEditing(null);
    await load();
    setSaving(false);
  }

  async function toggleActive(item) {
    await base44.entities.IngredientGroup.update(item.id, { is_active: !item.is_active });
    await load();
  }

  async function del(item) {
    const total = usageOf(item);
    if (total > 0) { alert(`Cannot delete: ${total} ingredient(s) use this group. Use "Replace with…" first.`); return; }
    if (!confirm(`Delete group "${item.group_code} — ${item.group_name}"? This cannot be undone.`)) return;
    await base44.entities.IngredientGroup.delete(item.id);
    await load();
  }

  async function doReplace(oldItem, newGroupId) {
    const newGroup = items.find(i => i.group_id === newGroupId);
    const ingsToUpdate = ingredients.filter(i => i.group_id === oldItem.group_id);
    // Update group_id only — do NOT change short_code
    await Promise.all(ingsToUpdate.map(i => base44.entities.IngredientMaster.update(i.id, { group_id: newGroupId })));
    // Deactivate old group
    const oldRec = items.find(i => i.group_id === oldItem.group_id);
    if (oldRec) await base44.entities.IngredientGroup.update(oldRec.id, { is_active: false });
    // Audit log
    await base44.entities.AuditLog.create({
      action: 'GROUP_REPLACE',
      entity_type: 'IngredientGroup',
      entity_id: oldItem.group_id,
      user_email: user?.email || '',
      user_name: user?.full_name || '',
      details: { old_id: oldItem.group_id, new_id: newGroupId, ingredients_updated: ingsToUpdate.length },
    });
    await load();
    return `${ingsToUpdate.length} ingredient(s) moved to group "${newGroup?.group_code}". Short codes were NOT changed.`;
  }

  const filtered = items.filter(i => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (i.group_code || '').toLowerCase().includes(q) || (i.group_name || '').toLowerCase().includes(q);
  });
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="w-full pl-9 h-9 rounded-lg border border-slate-200 text-sm" placeholder="Search groups…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setEditing('new')}><Plus className="w-4 h-4" /> New Group</Button>
      </div>

      {editing === 'new' && <GroupForm initial={null} onSave={save} onCancel={() => setEditing(null)} saving={saving} />}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-xs">
                <th className="px-3 py-2.5 text-center font-semibold w-20">Code</th>
                <th className="px-3 py-2.5 text-left font-semibold">Group Name</th>
                <th className="px-3 py-2.5 text-center font-semibold">Next Sequence</th>
                <th className="px-3 py-2.5 text-center font-semibold">Ingredients</th>
                <th className="px-3 py-2.5 text-center font-semibold">Status</th>
                <th className="px-3 py-2.5 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.map(item => {
                const total = usageOf(item);
                if (editing === item.id) {
                  return (
                    <tr key={item.id}><td colSpan={6} className="p-3">
                      <GroupForm initial={item} onSave={save} onCancel={() => setEditing(null)} saving={saving} />
                    </td></tr>
                  );
                }
                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-center">
                      <span className="font-mono font-black text-base bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">{item.group_code}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-slate-800">{item.group_name}</p>
                      {item.notes && <p className="text-xs text-slate-400 mt-0.5">{item.notes}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="font-mono text-xs font-semibold text-slate-500">{item.group_code}{String(item.next_seq || 1).padStart(2, '0')}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${total > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>{total}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center"><Badge ok={item.is_active} /></td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex gap-1 items-center justify-center">
                        <button onClick={() => toggleActive(item)} className="p-1.5 rounded-lg hover:bg-slate-100" title={item.is_active ? 'Deactivate' : 'Activate'}>
                          {item.is_active ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                        </button>
                        <button onClick={() => setEditing(item.id)} className="p-1.5 rounded-lg hover:bg-slate-100"><Pencil className="w-4 h-4 text-slate-500" /></button>
                        {isAdmin && total > 0 && (
                          <button onClick={() => setWizard(item)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200">
                            <ArrowLeftRight className="w-3.5 h-3.5" /> Replace
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => del(item)} className={`p-1.5 rounded-lg ${total > 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-red-50'}`} title={total > 0 ? `Used by ${total} ingredient(s)` : 'Delete'}>
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paged.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400 text-sm">No groups found.</td></tr>}
            </tbody>
          </table>
        </div>
        <TablePagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {wizard && (
        <ReplaceWizard
          title={`Replace Group: ${wizard.group_code}`}
          oldItem={{ label: `${wizard.group_code} — ${wizard.group_name}`, id: wizard.group_id }}
          options={items
            .filter(i => i.group_id !== wizard.group_id && i.is_active)
            .map(i => ({ value: i.group_id, label: `${i.group_code} — ${i.group_name}` }))}
          previewLines={(newId) => {
            const total = usageOf(wizard);
            const newGrp = items.find(i => i.group_id === newId);
            return [
              `${total} ingredient(s) will be re-assigned to group "${newGrp?.group_code}"`,
              `Existing short_codes will NOT be changed (FL01 stays FL01)`,
              `Old group "${wizard.group_code}" will be deactivated`,
            ];
          }}
          onConfirm={(newId) => doReplace(wizard, newId)}
          onClose={() => { setWizard(null); load(); }}
        />
      )}
    </div>
  );
}