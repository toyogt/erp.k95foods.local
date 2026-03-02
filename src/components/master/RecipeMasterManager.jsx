import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Download, Upload, X, Loader2, Search } from 'lucide-react';

const EMPTY_FORM = {
  recipe_id: '', recipe_name: '', version: 1, is_active: true, notes: ''
};

const CSV_HEADERS = ['recipe_id', 'recipe_name', 'version', 'is_active', 'notes'];

export default function RecipeMasterManager() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.RecipeMaster.list('-created_date', 500);
    setRecipes(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditItem(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (r) => { setEditItem(r); setForm({ ...EMPTY_FORM, ...r }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.recipe_id || !form.recipe_name) {
      alert('Recipe ID and Name are required.');
      return;
    }
    setSaving(true);
    const payload = { ...form };
    if (payload.version !== '') payload.version = Number(payload.version);
    if (editItem) {
      await base44.entities.RecipeMaster.update(editItem.id, payload);
    } else {
      await base44.entities.RecipeMaster.create(payload);
    }
    setSaving(false);
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this recipe?')) return;
    await base44.entities.RecipeMaster.delete(id);
    load();
  };

  const downloadTemplate = () => {
    const sample = ['REC-001', 'Mango Juice', '1', 'true', 'Base recipe for mango drinks'];
    const csv = [CSV_HEADERS.join(','), sample.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'recipe_master_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    setImportResult(null);

    const text = await file.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

    let created = 0, errors = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row = {};
      headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });

      if (!row.recipe_id || !row.recipe_name) {
        errors.push(`Row ${i + 1}: recipe_id and recipe_name are required`);
        continue;
      }

      const payload = { ...row, is_active: true };
      if (payload.version !== '' && !isNaN(payload.version)) payload.version = Number(payload.version);
      else if (payload.version === '') delete payload.version;

      await base44.entities.RecipeMaster.create(payload);
      created++;
    }

    setImportResult({ created, errors });
    setImporting(false);
    load();
  };

  const filtered = recipes.filter(r =>
    !search ||
    r.recipe_id?.toLowerCase().includes(search.toLowerCase()) ||
    r.recipe_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
          <Input className="pl-8 w-56 text-sm" placeholder="Search recipes…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" /> Template
          </Button>
          <label>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs cursor-pointer" asChild>
              <span>{importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Import CSV</span>
            </Button>
            <input type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} disabled={importing} />
          </label>
          <Button size="sm" onClick={openAdd} className="gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" /> Add Recipe
          </Button>
        </div>
      </div>

      {/* Import Result */}
      {importResult && (
        <div className={`p-3 rounded-lg text-sm flex justify-between items-start ${importResult.errors.length ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
          <div>
            <p className="font-medium">{importResult.created} recipe(s) imported successfully.</p>
            {importResult.errors.map((e, i) => <p key={i} className="text-red-600 text-xs mt-1">{e}</p>)}
          </div>
          <button onClick={() => setImportResult(null)}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">No recipes found. Add one or import via CSV.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Recipe ID</th>
                <th className="px-4 py-3 text-left">Recipe Name</th>
                <th className="px-4 py-3 text-center">Version</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-left">Notes</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{r.recipe_id}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{r.recipe_name}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{r.version || 1}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {r.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs truncate max-w-xs">{r.notes || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => openEdit(r)} className="p-1 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-800">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(r.id)} className="p-1 hover:bg-red-50 rounded-md text-slate-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit Recipe' : 'Add Recipe'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Recipe ID *</Label>
              <Input value={form.recipe_id} onChange={e => setForm(f => ({ ...f, recipe_id: e.target.value }))} className="text-sm" placeholder="e.g. REC-001" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Recipe Name *</Label>
              <Input value={form.recipe_name} onChange={e => setForm(f => ({ ...f, recipe_name: e.target.value }))} className="text-sm" placeholder="e.g. Mango Juice" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Version</Label>
              <Input type="number" value={form.version} onChange={e => setForm(f => ({ ...f, version: Number(e.target.value) }))} className="text-sm" min="1" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                placeholder="Add notes or description…"
                rows="3"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Active</Label>
              <select
                value={form.is_active ? 'true' : 'false'}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'true' }))}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.recipe_id || !form.recipe_name}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}