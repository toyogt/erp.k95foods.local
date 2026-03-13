import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Pencil, ToggleLeft, ToggleRight, Search } from 'lucide-react';

function genArtworkId() {
  return 'ART-' + Math.random().toString(36).slice(2, 7).toUpperCase();
}

const EMPTY_FORM = {
  artwork_id: '',
  artwork_name: '',
  artwork_version: '',
  brand_logo_url: '',
  preview_url: '',
  nutritional_facts: {},
  ingredient_list: [],
  manufacturer_details: {},
  note_text: '',
  mrp_display_format: '',
  shelf_life_format: '',
  is_active: true,
  notes: '',
};

export default function LabelArtworkManager({ user }) {
  const [artworks, setArtworks] = useState([]);
  const [skus, setSkus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM, artwork_id: genArtworkId() });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await base44.entities.LabelArtwork.list('-created_date', 200);
      setArtworks(r);
    } catch { /* offline */ }
    setLoading(false);
  }

  function openCreate() {
    setEditItem(null);
    setForm({ ...EMPTY_FORM, artwork_id: genArtworkId() });
    setShowForm(true);
  }

  function openEdit(a) {
    setEditItem(a);
    setForm({
      artwork_id: a.artwork_id,
      artwork_name: a.artwork_name || '',
      artwork_version: a.artwork_version || '',
      brand_logo_url: a.brand_logo_url || '',
      preview_url: a.preview_url || '',
      nutritional_facts: a.nutritional_facts || {},
      ingredient_list: a.ingredient_list || [],
      manufacturer_details: a.manufacturer_details || {},
      note_text: a.note_text || '',
      mrp_display_format: a.mrp_display_format || '',
      shelf_life_format: a.shelf_life_format || '',
      is_active: a.is_active !== false,
      notes: a.notes || '',
    });
    setShowForm(true);
  }

  async function save() {
    if (!form.artwork_name) return;
    setSaving(true);
    const data = { ...form };
    if (editItem) {
      await base44.entities.LabelArtwork.update(editItem.id, data);
    } else {
      await base44.entities.LabelArtwork.create(data);
    }
    setSaving(false);
    setShowForm(false);
    load();
  }

  async function toggle(item) {
    await base44.entities.LabelArtwork.update(item.id, { is_active: !item.is_active });
    load();
  }

  const filtered = artworks.filter(a => {
    const q = search.toLowerCase();
    return !q ||
      (a.artwork_name || '').toLowerCase().includes(q) ||
      (a.artwork_id || '').toLowerCase().includes(q) ||
      (a.artwork_version || '').toLowerCase().includes(q);
  });

  if (showForm) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">{editItem ? 'Edit Artwork' : 'New Label Artwork'}</h3>
          <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Artwork ID (auto)</p>
            <input readOnly className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono bg-slate-50" value={form.artwork_id} />
          </div>

          <div className="space-y-1">
            <p className="text-xs text-slate-500">Artwork Name *</p>
            <input
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
              placeholder="e.g. Mango 500ml Standard"
              value={form.artwork_name}
              onChange={e => setForm(f => ({ ...f, artwork_name: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs text-slate-500">Version</p>
            <input
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
              placeholder="e.g. v1.0, v2.1"
              value={form.artwork_version}
              onChange={e => setForm(f => ({ ...f, artwork_version: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs text-slate-500">Brand Logo URL</p>
            <input
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
              placeholder="https://..."
              value={form.brand_logo_url}
              onChange={e => setForm(f => ({ ...f, brand_logo_url: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs text-slate-500">Preview Image URL</p>
            <input
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
              placeholder="https://..."
              value={form.preview_url}
              onChange={e => setForm(f => ({ ...f, preview_url: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs text-slate-500">Note Text (for label)</p>
            <input
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
              placeholder="e.g. See bottles for individual mfg date and batch no."
              value={form.note_text}
              onChange={e => setForm(f => ({ ...f, note_text: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-slate-500">MRP Display Format</p>
              <input
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                placeholder="e.g. MRP: ₹{mrp}"
                value={form.mrp_display_format}
                onChange={e => setForm(f => ({ ...f, mrp_display_format: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Shelf Life Format</p>
              <input
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                placeholder="e.g. {months} months from MFG"
                value={form.shelf_life_format}
                onChange={e => setForm(f => ({ ...f, shelf_life_format: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-slate-500">Nutritional Facts (JSON)</p>
            <Textarea
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
              placeholder='e.g. {"energy": "100 kcal", "protein": "5g", "carbs": "10g", "fat": "2g"}'
              value={typeof form.nutritional_facts === 'object' ? JSON.stringify(form.nutritional_facts, null, 2) : ''}
              onChange={e => {
                try {
                  const parsed = e.target.value ? JSON.parse(e.target.value) : {};
                  setForm(f => ({ ...f, nutritional_facts: parsed }));
                } catch {}
              }}
              rows={3}
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs text-slate-500">Ingredient List (JSON Array)</p>
            <Textarea
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
              placeholder='e.g. [{"name": "Water", "percentage": "60%"}, {"name": "Sugar", "allergen": true}]'
              value={Array.isArray(form.ingredient_list) ? JSON.stringify(form.ingredient_list, null, 2) : '[]'}
              onChange={e => {
                try {
                  const parsed = e.target.value ? JSON.parse(e.target.value) : [];
                  setForm(f => ({ ...f, ingredient_list: parsed }));
                } catch {}
              }}
              rows={3}
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs text-slate-500">Manufacturer Details (JSON)</p>
            <Textarea
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
              placeholder='e.g. {"name": "K95 Foods", "address": "...", "fssai": "12345", "contact": "..."}'
              value={typeof form.manufacturer_details === 'object' ? JSON.stringify(form.manufacturer_details, null, 2) : ''}
              onChange={e => {
                try {
                  const parsed = e.target.value ? JSON.parse(e.target.value) : {};
                  setForm(f => ({ ...f, manufacturer_details: parsed }));
                } catch {}
              }}
              rows={3}
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs text-slate-500">Notes (internal)</p>
            <input
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
              placeholder="Optional internal notes"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
            Active
          </label>

          <Button
            className="w-full h-11 min-h-[44px]"
            onClick={save}
            disabled={saving || !form.artwork_name}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editItem ? 'Save Changes' : 'Create Artwork'}
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
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-200 text-sm"
            placeholder="Search by name, ID, version…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1 shrink-0">
          <Plus className="w-4 h-4" /> New Artwork
        </Button>
      </div>

      {loading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}

      {!loading && filtered.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-8">No artworks found. Create one first.</p>
      )}

      <div className="space-y-2">
        {filtered.map(a => (
          <div key={a.id} className={`bg-white rounded-2xl border p-4 flex items-start gap-3 ${a.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
            {a.preview_url && (
              <img src={a.preview_url} alt="" className="w-12 h-12 object-contain rounded-lg border border-slate-100 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-slate-900 truncate">{a.artwork_name}</p>
                {a.artwork_version && (
                  <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">{a.artwork_version}</span>
                )}
                {!a.is_active && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Inactive</span>}
                </div>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">{a.artwork_id}</p>
                {a.note_text && <p className="text-xs text-slate-500 mt-1">{a.note_text}</p>}
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <Button size="sm" variant="ghost" onClick={() => openEdit(a)} className="h-7 w-7 p-0">
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <button onClick={() => toggle(a)} className="text-slate-400 hover:text-slate-600">
                {a.is_active
                  ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                  : <ToggleLeft className="w-5 h-5" />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}