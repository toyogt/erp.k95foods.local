import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Pencil, ToggleLeft, ToggleRight, Search } from 'lucide-react';
import TablePagination from '@/components/store/TablePagination';

function genArtworkId() {
  return 'ART-' + Math.random().toString(36).slice(2, 7).toUpperCase();
}

const EMPTY_FORM = {
  artwork_id: '',
  artwork_name: '',
  artwork_version: '',
  label_size: '',
  preview_url: '',
  open_file_url: '',
  approved_file_url: '',
  nutritional_facts: {},
  ingredient_list: [],
  manufacturer_id: '',
  net_quantity_format: '',
  expiry_format: '',
  note_text: '',
  mrp_display_format: '',
  approval_status: 'DRAFT',
  approved_by: '',
  approved_date: '',
  version_notes: '',
  is_active: true,
  notes: '',
};

const EMPTY_NUTRI = { energy: '', protein: '', carbs: '', fat: '', fiber: '', sugar: '', sodium: '' };
const EMPTY_INGREDIENT = { name: '', percentage: '', allergen: false };

export default function LabelArtworkManager({ user }) {
  const [artworks, setArtworks] = useState([]);
  const [skus, setSkus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM, artwork_id: genArtworkId() });
  const [saving, setSaving] = useState(false);
  const [nutriFields, setNutriFields] = useState({ ...EMPTY_NUTRI });
  const [ingredients, setIngredients] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [artList, mfgList] = await Promise.all([
        base44.entities.LabelArtwork.list('-created_date', 200),
        base44.entities.ManufacturerMaster.filter({ is_active: true })
      ]);
      setArtworks(artList);
      setManufacturers(mfgList);
    } catch { /* offline */ }
    setLoading(false);
  }

  function openCreate() {
    setEditItem(null);
    setForm({ ...EMPTY_FORM, artwork_id: genArtworkId() });
    setNutriFields({ ...EMPTY_NUTRI });
    setIngredients([]);
    setShowForm(true);
  }

  function openEdit(a) {
    setEditItem(a);
    setForm({
      artwork_id: a.artwork_id,
      artwork_name: a.artwork_name || '',
      artwork_version: a.artwork_version || '',
      label_size: a.label_size || '',
      preview_url: a.preview_url || '',
      open_file_url: a.open_file_url || '',
      approved_file_url: a.approved_file_url || '',
      nutritional_facts: a.nutritional_facts || {},
      ingredient_list: a.ingredient_list || [],
      manufacturer_id: a.manufacturer_id || '',
      net_quantity_format: a.net_quantity_format || '',
      expiry_format: a.expiry_format || '',
      note_text: a.note_text || '',
      mrp_display_format: a.mrp_display_format || '',
      approval_status: a.approval_status || 'DRAFT',
      approved_by: a.approved_by || '',
      approved_date: a.approved_date || '',
      version_notes: a.version_notes || '',
      is_active: a.is_active !== false,
      notes: a.notes || '',
    });
    setNutriFields({ ...EMPTY_NUTRI, ...(a.nutritional_facts || {}) });
    setIngredients(Array.isArray(a.ingredient_list) ? a.ingredient_list : []);
    setShowForm(true);
  }

  async function save() {
    if (!form.artwork_name) return;
    setSaving(true);
    const data = {
      ...form,
      nutritional_facts: nutriFields,
      ingredient_list: ingredients,
    };
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

          <div className="grid grid-cols-2 gap-3">
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
              <p className="text-xs text-slate-500">Label Size</p>
              <input
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                placeholder="e.g. 90mm x 60mm"
                value={form.label_size}
                onChange={e => setForm(f => ({ ...f, label_size: e.target.value }))}
              />
            </div>
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
            <p className="text-xs text-slate-500">Label Open File URL</p>
            <input
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
              placeholder="https://... (AI, PSD, editable design file)"
              value={form.open_file_url}
              onChange={e => setForm(f => ({ ...f, open_file_url: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs text-slate-500">Label Approved File URL</p>
            <input
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
              placeholder="https://... (PDF, print-ready file)"
              value={form.approved_file_url}
              onChange={e => setForm(f => ({ ...f, approved_file_url: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs text-slate-500">Manufacturer</p>
            <select
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
              value={form.manufacturer_id}
              onChange={e => setForm(f => ({ ...f, manufacturer_id: e.target.value }))}
            >
              <option value="">Select manufacturer...</option>
              {manufacturers.map(m => (
                <option key={m.id} value={m.manufacturer_id}>{m.manufacturer_name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Net Quantity Format</p>
              <input
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                placeholder="e.g. 500 ml, {volume} ml"
                value={form.net_quantity_format}
                onChange={e => setForm(f => ({ ...f, net_quantity_format: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Expiry Format</p>
              <input
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                placeholder="e.g. {months} months from MFG"
                value={form.expiry_format}
                onChange={e => setForm(f => ({ ...f, expiry_format: e.target.value }))}
              />
            </div>
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

          <div className="space-y-1">
            <p className="text-xs text-slate-500">MRP Display Format</p>
            <input
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
              placeholder="e.g. MRP: ₹{mrp}"
              value={form.mrp_display_format}
              onChange={e => setForm(f => ({ ...f, mrp_display_format: e.target.value }))}
            />
          </div>

          <div className="border-t border-slate-200 pt-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Nutritional Facts</p>
            <div className="grid grid-cols-2 gap-3">
              <input className="h-10 px-3 rounded-lg border border-slate-300 text-sm" placeholder="Energy (e.g. 100 kcal)" value={nutriFields.energy} onChange={e => setNutriFields(n => ({ ...n, energy: e.target.value }))} />
              <input className="h-10 px-3 rounded-lg border border-slate-300 text-sm" placeholder="Protein (e.g. 5g)" value={nutriFields.protein} onChange={e => setNutriFields(n => ({ ...n, protein: e.target.value }))} />
              <input className="h-10 px-3 rounded-lg border border-slate-300 text-sm" placeholder="Carbs (e.g. 10g)" value={nutriFields.carbs} onChange={e => setNutriFields(n => ({ ...n, carbs: e.target.value }))} />
              <input className="h-10 px-3 rounded-lg border border-slate-300 text-sm" placeholder="Fat (e.g. 2g)" value={nutriFields.fat} onChange={e => setNutriFields(n => ({ ...n, fat: e.target.value }))} />
              <input className="h-10 px-3 rounded-lg border border-slate-300 text-sm" placeholder="Fiber (e.g. 1g)" value={nutriFields.fiber} onChange={e => setNutriFields(n => ({ ...n, fiber: e.target.value }))} />
              <input className="h-10 px-3 rounded-lg border border-slate-300 text-sm" placeholder="Sugar (e.g. 8g)" value={nutriFields.sugar} onChange={e => setNutriFields(n => ({ ...n, sugar: e.target.value }))} />
              <input className="col-span-2 h-10 px-3 rounded-lg border border-slate-300 text-sm" placeholder="Sodium (e.g. 150mg)" value={nutriFields.sodium} onChange={e => setNutriFields(n => ({ ...n, sodium: e.target.value }))} />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Ingredient List</p>
              <Button size="sm" variant="outline" onClick={() => setIngredients([...ingredients, { ...EMPTY_INGREDIENT }])} className="h-8 min-h-[32px]">
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>
            {ingredients.map((ing, i) => (
              <div key={i} className="flex gap-2 items-start">
                <input className="flex-1 h-10 px-3 rounded-lg border border-slate-300 text-sm" placeholder="Ingredient name" value={ing.name} onChange={e => { const copy = [...ingredients]; copy[i].name = e.target.value; setIngredients(copy); }} />
                <input className="w-24 h-10 px-3 rounded-lg border border-slate-300 text-sm" placeholder="%" value={ing.percentage} onChange={e => { const copy = [...ingredients]; copy[i].percentage = e.target.value; setIngredients(copy); }} />
                <label className="flex items-center gap-1 text-xs whitespace-nowrap h-10 px-2">
                  <input type="checkbox" checked={ing.allergen} onChange={e => { const copy = [...ingredients]; copy[i].allergen = e.target.checked; setIngredients(copy); }} />
                  Allergen
                </label>
                <Button size="sm" variant="ghost" onClick={() => setIngredients(ingredients.filter((_, idx) => idx !== i))} className="h-10 w-10 p-0 text-red-500">×</Button>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 pt-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Approval & Versioning</p>
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Approval Status</p>
              <select
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                value={form.approval_status}
                onChange={e => setForm(f => ({ ...f, approval_status: e.target.value }))}
              >
                <option value="DRAFT">Draft</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Version Notes</p>
              <Textarea
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                placeholder="What changed in this version?"
                value={form.version_notes}
                onChange={e => setForm(f => ({ ...f, version_notes: e.target.value }))}
                rows={2}
              />
            </div>
            {form.approved_by && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-700">
                Approved by {form.approved_by} on {form.approved_date ? new Date(form.approved_date).toLocaleDateString() : 'N/A'}
              </div>
            )}
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

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const APPROVAL_COLORS = {
    DRAFT: 'bg-slate-100 text-slate-600',
    PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
    APPROVED: 'bg-green-100 text-green-700',
    ARCHIVED: 'bg-slate-100 text-slate-500',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-sm"
            placeholder="Search by name, ID, version…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1 shrink-0">
          <Plus className="w-4 h-4" /> New Artwork
        </Button>
      </div>

      {loading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}

      {!loading && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-xs">
                  <th className="px-3 py-2.5 text-left font-semibold">Artwork ID</th>
                  <th className="px-3 py-2.5 text-left font-semibold min-w-[200px]">Artwork Name</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Version</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Label Size</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Approval</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Status</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.map(a => (
                  <tr key={a.id} className={`hover:bg-slate-50 ${!a.is_active ? 'opacity-60' : ''}`}>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{a.artwork_id}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {a.preview_url && <img src={a.preview_url} alt="" className="w-8 h-8 object-contain rounded border border-slate-100 shrink-0" />}
                        <span className="font-medium text-slate-900">{a.artwork_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {a.artwork_version ? <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">{a.artwork_version}</span> : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 text-xs">{a.label_size || '—'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${APPROVAL_COLORS[a.approval_status] || APPROVAL_COLORS.DRAFT}`}>
                        {(a.approval_status || 'DRAFT').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {a.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex gap-1 items-center justify-center">
                        <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg hover:bg-slate-100"><Pencil className="w-4 h-4 text-slate-500" /></button>
                        <button onClick={() => toggle(a)} className="p-1.5 rounded-lg hover:bg-slate-100">
                          {a.is_active ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paged.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate-400 text-sm">No artworks found.</td></tr>}
              </tbody>
            </table>
          </div>
          <TablePagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </div>
      )}
    </div>
  );
}