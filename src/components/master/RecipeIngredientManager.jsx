import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Download, Upload, X, Loader2, Search } from 'lucide-react';

const EMPTY_FORM = {
  recipe_id: '', ingredient_code: '', ingredient_name: '', qty: '', uom: '', phase: 'MIX', notes: ''
};

const CSV_HEADERS = ['recipe_id', 'ingredient_code', 'ingredient_name', 'qty', 'uom', 'phase', 'notes'];
const PHASES = ['BREW', 'SYRUP', 'MIX', 'FLAVOR', 'COLOR', 'PRESERVATIVE', 'OTHER'];

export default function RecipeIngredientManager() {
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [recipeFilter, setRecipeFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const load = async () => {
    setLoading(true);
    const [ingrs, recs] = await Promise.all([
      base44.entities.RecipeIngredient.list('-created_date', 1000),
      base44.entities.RecipeMaster.list('-created_date', 500),
    ]);
    setIngredients(ingrs);
    setRecipes(recs);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditItem(null);
    setForm({ ...EMPTY_FORM, recipe_id: recipeFilter });
    setDialogOpen(true);
  };

  const openEdit = (ing) => {
    setEditItem(ing);
    setForm({ ...EMPTY_FORM, ...ing });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.recipe_id || !form.ingredient_code || !form.ingredient_name || !form.qty || !form.uom) {
      alert('Recipe ID, ingredient code/name, qty, and UOM are required.');
      return;
    }
    setSaving(true);
    const payload = { ...form, qty: Number(form.qty) };
    if (editItem) {
      await base44.entities.RecipeIngredient.update(editItem.id, payload);
    } else {
      await base44.entities.RecipeIngredient.create(payload);
    }
    setSaving(false);
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this ingredient?')) return;
    await base44.entities.RecipeIngredient.delete(id);
    load();
  };

  const downloadTemplate = () => {
    const sample = ['REC-001', 'ING-001', 'Mango Puree', '50', 'kg', 'SYRUP', 'High quality puree'];
    const csv = [CSV_HEADERS.join(','), sample.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'recipe_ingredient_template.csv';
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

      if (!row.recipe_id || !row.ingredient_code || !row.ingredient_name || !row.qty || !row.uom) {
        errors.push(`Row ${i + 1}: all required fields (recipe_id, ingredient_code, ingredient_name, qty, uom) needed`);
        continue;
      }

      const payload = {
        recipe_id: row.recipe_id,
        ingredient_code: row.ingredient_code,
        ingredient_name: row.ingredient_name,
        qty: Number(row.qty),
        uom: row.uom,
        phase: row.phase || 'MIX',
        notes: row.notes || ''
      };

      await base44.entities.RecipeIngredient.create(payload);
      created++;
    }

    setImportResult({ created, errors });
    setImporting(false);
    load();
  };

  const filtered = ingredients.filter(ing =>
    (!recipeFilter || ing.recipe_id === recipeFilter) &&
    (!search || ing.ingredient_code?.toLowerCase().includes(search.toLowerCase()) ||
      ing.ingredient_name?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <select
            value={recipeFilter}
            onChange={e => setRecipeFilter(e.target.value)}
            className="border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="">— All Recipes —</option>
            {recipes.map(r => <option key={r.id} value={r.recipe_id}>{r.recipe_id} - {r.recipe_name}</option>)}
          </select>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
            <Input className="pl-8 w-56 text-sm" placeholder="Search ingredients…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
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
            <Plus className="w-3.5 h-3.5" /> Add Ingredient
          </Button>
        </div>
      </div>

      {/* Import Result */}
      {importResult && (
        <div className={`p-3 rounded-lg text-sm flex justify-between items-start ${importResult.errors.length ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
          <div>
            <p className="font-medium">{importResult.created} ingredient(s) imported successfully.</p>
            {importResult.errors.map((e, i) => <p key={i} className="text-red-600 text-xs mt-1">{e}</p>)}
          </div>
          <button onClick={() => setImportResult(null)}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">No ingredients found. Add one or import via CSV.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Recipe ID</th>
                <th className="px-4 py-3 text-left">Ingredient Code</th>
                <th className="px-4 py-3 text-left">Ingredient Name</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-left">UOM</th>
                <th className="px-4 py-3 text-center">Phase</th>
                <th className="px-4 py-3 text-left">Notes</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(ing => (
                <tr key={ing.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{ing.recipe_id}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{ing.ingredient_code}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{ing.ingredient_name}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{ing.qty}</td>
                  <td className="px-4 py-3 text-slate-600">{ing.uom}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{ing.phase || 'MIX'}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs truncate max-w-xs">{ing.notes || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => openEdit(ing)} className="p-1 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-800">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(ing.id)} className="p-1 hover:bg-red-50 rounded-md text-slate-400 hover:text-red-600">
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
            <DialogTitle>{editItem ? 'Edit Ingredient' : 'Add Ingredient'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Recipe *</Label>
              <select
                value={form.recipe_id}
                onChange={e => setForm(f => ({ ...f, recipe_id: e.target.value }))}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="">— Select recipe —</option>
                {recipes.map(r => <option key={r.id} value={r.recipe_id}>{r.recipe_id} - {r.recipe_name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ingredient Code *</Label>
              <Input value={form.ingredient_code} onChange={e => setForm(f => ({ ...f, ingredient_code: e.target.value }))} className="text-sm" placeholder="e.g. ING-001" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ingredient Name *</Label>
              <Input value={form.ingredient_name} onChange={e => setForm(f => ({ ...f, ingredient_name: e.target.value }))} className="text-sm" placeholder="e.g. Mango Puree" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Qty *</Label>
                <Input type="number" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} className="text-sm" min="0" step="0.01" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">UOM *</Label>
                <Input value={form.uom} onChange={e => setForm(f => ({ ...f, uom: e.target.value }))} className="text-sm" placeholder="kg, ltr, pcs, etc." />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phase</Label>
              <select
                value={form.phase}
                onChange={e => setForm(f => ({ ...f, phase: e.target.value }))}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
              >
                {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                placeholder="Add notes…"
                rows="2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.recipe_id || !form.ingredient_code || !form.ingredient_name || !form.qty || !form.uom}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}