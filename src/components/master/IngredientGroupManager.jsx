import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Loader2, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';

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

export default function IngredientGroupManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setItems(await base44.entities.IngredientGroup.list('group_code', 200));
    setLoading(false);
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

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">Groups define the 2-letter prefix used in ingredient short codes (e.g. FL01).</p>
        <Button size="sm" className="gap-1.5" onClick={() => setEditing('new')}><Plus className="w-4 h-4" /> New Group</Button>
      </div>

      {editing === 'new' && <GroupForm initial={null} onSave={save} onCancel={() => setEditing(null)} saving={saving} />}

      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-3">
            {editing === item.id ? (
              <GroupForm initial={item} onSave={save} onCancel={() => setEditing(null)} saving={saving} />
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-black text-lg text-slate-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg w-14 text-center">{item.group_code}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.group_name}</p>
                    <p className="text-xs text-slate-400">Next: <span className="font-mono font-semibold">{item.group_code}{String(item.next_seq || 1).padStart(2, '0')}</span> · seq={item.next_seq || 1}</p>
                    {item.notes && <p className="text-xs text-slate-500 mt-0.5">{item.notes}</p>}
                  </div>
                  <Badge ok={item.is_active} />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => toggleActive(item)} className="p-1.5 rounded-lg hover:bg-slate-100" title={item.is_active ? 'Deactivate' : 'Activate'}>
                    {item.is_active ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                  </button>
                  <button onClick={() => setEditing(item.id)} className="p-1.5 rounded-lg hover:bg-slate-100"><Pencil className="w-4 h-4 text-slate-500" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-center text-slate-400 text-sm py-8">No groups defined yet. Add groups like FL (Flavour), AC (Acid), SW (Sweetener).</p>}
      </div>
    </div>
  );
}