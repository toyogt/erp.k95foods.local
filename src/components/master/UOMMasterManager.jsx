import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Loader2, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';

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

export default function UOMMasterManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setItems(await base44.entities.UOMMaster.list('uom_code', 200));
    setLoading(false);
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
    if (!confirm(`Delete UOM "${item.uom_code} — ${item.uom_name}"? This cannot be undone.`)) return;
    await base44.entities.UOMMaster.delete(item.id);
    await load();
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
        {items.map(item => (
          <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-3">
            {editing === item.id ? (
              <UOMForm initial={item} onSave={save} onCancel={() => setEditing(null)} saving={saving} />
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-sm text-slate-800 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg min-w-[3rem] text-center">{item.uom_code}</span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{item.uom_name}</p>
                    <p className="text-xs text-slate-400 font-mono">{item.uom_id}</p>
                  </div>
                  <Badge ok={item.is_active} />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => toggleActive(item)} className="p-1.5 rounded-lg hover:bg-slate-100" title={item.is_active ? 'Deactivate' : 'Activate'}>
                    {item.is_active ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                  </button>
                  <button onClick={() => setEditing(item.id)} className="p-1.5 rounded-lg hover:bg-slate-100"><Pencil className="w-4 h-4 text-slate-500" /></button>
                  <button onClick={() => del(item)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-400" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-center text-slate-400 text-sm py-8">No UOMs defined yet.</p>}
      </div>
    </div>
  );
}