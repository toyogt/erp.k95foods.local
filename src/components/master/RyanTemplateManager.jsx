import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Pencil, ToggleLeft, ToggleRight, Search, X } from 'lucide-react';

function genTemplateId() {
  return 'RYAN-' + Math.random().toString(36).slice(2, 7).toUpperCase();
}

const EMPTY_FORM = {
  ryan_template_id: '',
  description: '',
  is_active: true,
  placeholders: [], // local array, serialised to placeholders_json on save
};

export default function RyanTemplateManager({ user }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM, ryan_template_id: genTemplateId() });
  const [chipInput, setChipInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await base44.entities.RyanTemplate.list('-created_date', 200);
      setTemplates(r);
    } catch { /* offline */ }
    setLoading(false);
  }

  function parsePlaceholders(json) {
    if (!json) return [];
    try { const v = JSON.parse(json); return Array.isArray(v) ? v : []; } catch { return []; }
  }

  function openCreate() {
    setEditItem(null);
    setForm({ ...EMPTY_FORM, ryan_template_id: genTemplateId() });
    setChipInput('');
    setShowForm(true);
  }

  function openEdit(t) {
    setEditItem(t);
    setForm({
      ryan_template_id: t.ryan_template_id,
      description: t.description || '',
      is_active: t.is_active !== false,
      placeholders: parsePlaceholders(t.placeholders_json),
    });
    setChipInput('');
    setShowForm(true);
  }

  function addChip(raw) {
    const val = raw.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    if (!val) return;
    if (form.placeholders.includes(val)) { setChipInput(''); return; }
    setForm(f => ({ ...f, placeholders: [...f.placeholders, val] }));
    setChipInput('');
  }

  function removeChip(val) {
    setForm(f => ({ ...f, placeholders: f.placeholders.filter(p => p !== val) }));
  }

  function handleChipKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      addChip(chipInput);
    } else if (e.key === 'Backspace' && chipInput === '' && form.placeholders.length > 0) {
      setForm(f => ({ ...f, placeholders: f.placeholders.slice(0, -1) }));
    }
  }

  async function save() {
    if (!form.ryan_template_id.trim()) return;
    setSaving(true);
    const data = {
      ryan_template_id: form.ryan_template_id,
      description: form.description,
      is_active: form.is_active,
      placeholders_json: JSON.stringify(form.placeholders),
    };
    if (editItem) {
      await base44.entities.RyanTemplate.update(editItem.id, data);
    } else {
      await base44.entities.RyanTemplate.create(data);
    }
    setSaving(false);
    setShowForm(false);
    load();
  }

  async function toggle(item) {
    await base44.entities.RyanTemplate.update(item.id, { is_active: !item.is_active });
    load();
  }

  const filtered = templates.filter(t => {
    const q = search.toLowerCase();
    return !q ||
      (t.ryan_template_id || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q);
  });

  if (showForm) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">{editItem ? 'Edit Ryan Template' : 'New Ryan Template'}</h3>
          <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Template ID *</p>
            <input
              className={`w-full h-9 px-3 rounded-lg border border-slate-300 text-sm font-mono ${editItem ? 'bg-slate-50' : ''}`}
              value={form.ryan_template_id}
              readOnly={!!editItem}
              onChange={e => setForm(f => ({ ...f, ryan_template_id: e.target.value.trim() }))}
              placeholder="e.g. RYAN-MANGO-500"
            />
            {!editItem && <p className="text-xs text-slate-400">Must match the template ID in Ryan exactly.</p>}
          </div>

          <div className="space-y-1">
            <p className="text-xs text-slate-500">Description</p>
            <input
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm"
              placeholder="e.g. Mango 500ml front label"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          {/* Placeholder chips */}
          <div className="space-y-2">
            <p className="text-xs text-slate-500">Placeholders <span className="text-slate-400 font-normal">(type + Enter to add)</span></p>
            <div
              className="min-h-[40px] flex flex-wrap gap-1.5 items-center border border-slate-300 rounded-lg px-2 py-1.5 bg-white cursor-text"
              onClick={() => document.getElementById('chip-input')?.focus()}
            >
              {form.placeholders.map(p => (
                <span key={p} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs font-mono font-bold px-2 py-0.5 rounded-md">
                  {p}
                  <button type="button" onClick={(e) => { e.stopPropagation(); removeChip(p); }} className="hover:text-blue-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                id="chip-input"
                value={chipInput}
                onChange={e => setChipInput(e.target.value.toUpperCase())}
                onKeyDown={handleChipKeyDown}
                onBlur={() => chipInput && addChip(chipInput)}
                className="flex-1 min-w-[120px] outline-none text-xs font-mono bg-transparent py-0.5"
                placeholder={form.placeholders.length === 0 ? 'BATCH, MFG, EXP, MRP …' : ''}
              />
            </div>
            <p className="text-xs text-slate-400">Only letters, numbers, underscores. E.g.: BATCH, MFG_DATE, EXP_DATE, MRP</p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
            Active
          </label>

          <Button className="w-full" onClick={save} disabled={saving || !form.ryan_template_id.trim()}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editItem ? 'Save Changes' : 'Create Template'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-sm"
            placeholder="Search by ID or description…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1 shrink-0">
          <Plus className="w-4 h-4" /> New Template
        </Button>
      </div>

      {loading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}
      {!loading && filtered.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-8">No Ryan templates found. Create one first.</p>
      )}

      <div className="space-y-2">
        {filtered.map(t => {
          const placeholders = parsePlaceholders(t.placeholders_json);
          return (
            <div key={t.id} className={`bg-white rounded-2xl border p-4 flex items-start gap-3 ${t.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-mono font-bold text-slate-900">{t.ryan_template_id}</p>
                  {!t.is_active && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Inactive</span>}
                </div>
                {t.description && <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>}
                <div className="flex flex-wrap gap-1 mt-2">
                  {placeholders.length > 0
                    ? placeholders.map(p => (
                      <span key={p} className="bg-blue-50 text-blue-700 font-mono text-xs px-2 py-0.5 rounded-md font-semibold">{p}</span>
                    ))
                    : <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">No placeholders configured</span>
                  }
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => openEdit(t)} className="h-7 w-7 p-0">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <button onClick={() => toggle(t)} className="text-slate-400 hover:text-slate-600">
                  {t.is_active
                    ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                    : <ToggleLeft className="w-5 h-5" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}