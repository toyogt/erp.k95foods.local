import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Download, Upload, X, Loader2, Search } from 'lucide-react';

const EMPTY_FORM = {
  item_code: '', brand_name: '', product_name: '', flavour: '',
  ml_per_bottle: '', bottles_per_box: '', box_type_id: '', product_barcode: '', mrp_box: '',
  gross_weight_kg: '', fssai_no: '', manufacturer_name: '', address_1: '',
  address_2: '', customer_care_email: '', customer_care_phone: '',
  shelf_life_days: '', is_trial_pack: false, is_active: true,
  bottle_type: '', recipe_id: '', batch_prefix: ''
};

const CSV_HEADERS = [
  'item_code','brand_name','product_name','flavour','ml_per_bottle',
  'bottles_per_box','product_barcode','mrp_box','gross_weight_kg',
  'fssai_no','manufacturer_name','address_1','address_2',
  'customer_care_email','customer_care_phone','shelf_life_days','is_trial_pack',
  'bottle_type','recipe_id','batch_prefix'
];

export default function ProductMasterManager() {
  const [products, setProducts] = useState([]);
  const [bottleTypes, setBottleTypes] = useState([]);
  const [boxTypes, setBoxTypes] = useState([]);
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
    const [data, bts, boxs, recs] = await Promise.all([
      base44.entities.ProductMaster.list('-created_date', 500),
      base44.entities.BottleType.list('-created_date', 100).catch(() => []),
      base44.entities.BoxType.filter({ is_active: true }, '-created_date', 200).catch(() => []),
      base44.entities.RecipeMaster.filter({ is_active: true }, '-created_date', 500).catch(() => []),
    ]);
    setProducts(data);
    setBottleTypes(bts);
    setBoxTypes(boxs);
    setRecipes(recs);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditItem(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (p) => { setEditItem(p); setForm({ ...EMPTY_FORM, ...p }); setDialogOpen(true); };

  const missingSetup = (f) => f.is_active && (!f.bottle_type || !f.recipe_id || !f.box_type_id);

  const handleToggleActive = async (p) => {
    const next = !p.is_active;
    if (next && (!p.bottle_type || !p.recipe_id)) {
      alert('Cannot activate: bottle_type and recipe_id are required for active SKUs.');
      return;
    }
    if (next && !p.box_type_id) {
      alert('Cannot activate: Box Type is required for active SKUs.');
      return;
    }
    const bt = boxTypes.find(b => b.box_type_id === p.box_type_id);
    if (next && bt && !bt.is_active) {
      alert('Cannot activate: the linked Box Type is inactive. Please update the Box Type first.');
      return;
    }
    await base44.entities.ProductMaster.update(p.id, { is_active: next });
    load();
  };

  const handleSave = async () => {
    if (form.is_active && !form.box_type_id) {
      alert('Box Type is required for active SKUs.');
      return;
    }
    if (form.is_active && (!form.bottle_type || !form.recipe_id)) {
      alert('Cannot set active: bottle_type and recipe_id are required for active SKUs.');
      return;
    }
    const bt = boxTypes.find(b => b.box_type_id === form.box_type_id);
    if (form.is_active && bt && !bt.is_active) {
      alert('Cannot activate: the linked Box Type is inactive.');
      return;
    }
    setSaving(true);
    const payload = { ...form };
    // Derive bottles_per_box from box type
    if (bt) payload.bottles_per_box = bt.bottles_per_box;
    ['ml_per_bottle','bottles_per_box','mrp_box','gross_weight_kg','shelf_life_days'].forEach(k => {
      if (payload[k] !== '') payload[k] = Number(payload[k]);
      else delete payload[k];
    });
    if (editItem) {
      await base44.entities.ProductMaster.update(editItem.id, payload);
    } else {
      await base44.entities.ProductMaster.create(payload);
    }
    setSaving(false);
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this SKU?')) return;
    await base44.entities.ProductMaster.delete(id);
    load();
  };

  const downloadTemplate = () => {
    const sample = [
      'PROD001','BrandX','Mango Drink','Mango','200','24','8901234567890',
      '120.00','5.5','12345678901234','ABC Beverages Pvt Ltd',
      '123 Industrial Area','Phase 2, Delhi - 110001',
      'care@abc.com','1800-123-456','365'
    ];
    const csv = [CSV_HEADERS.join(','), sample.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = 'product_master_template.csv'; a.click();
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

      if (!row.item_code || !row.product_name) {
        errors.push(`Row ${i + 1}: item_code and product_name are required`);
        continue;
      }

      const payload = { ...row, is_active: true };
      ['ml_per_bottle','bottles_per_box','mrp_box','gross_weight_kg','shelf_life_days'].forEach(k => {
        if (payload[k] !== '' && !isNaN(payload[k])) payload[k] = Number(payload[k]);
        else if (payload[k] === '') delete payload[k];
      });
      payload.is_trial_pack = payload.is_trial_pack === 'true' || payload.is_trial_pack === true;

      await base44.entities.ProductMaster.create(payload);
      created++;
    }

    setImportResult({ created, errors });
    setImporting(false);
    load();
  };

  const filtered = products.filter(p =>
    !search ||
    p.item_code?.toLowerCase().includes(search.toLowerCase()) ||
    p.product_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.brand_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
          <Input className="pl-8 w-56 text-sm" placeholder="Search SKUs…" value={search} onChange={e => setSearch(e.target.value)} />
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
            <Plus className="w-3.5 h-3.5" /> Add SKU
          </Button>
        </div>
      </div>

      {/* Import Result */}
      {importResult && (
        <div className={`p-3 rounded-lg text-sm flex justify-between items-start ${importResult.errors.length ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
          <div>
            <p className="font-medium">{importResult.created} SKU(s) imported successfully.</p>
            {importResult.errors.map((e, i) => <p key={i} className="text-red-600 text-xs mt-1">{e}</p>)}
          </div>
          <button onClick={() => setImportResult(null)}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">No SKUs found. Add one or import via CSV.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">SKU Code</th>
                <th className="px-4 py-3 text-left">Brand</th>
                <th className="px-4 py-3 text-left">SKU Name</th>
                <th className="px-4 py-3 text-left">Bottle Type</th>
                <th className="px-4 py-3 text-left">Recipe ID</th>
                <th className="px-4 py-3 text-left">Batch Prefix</th>
                <th className="px-4 py-3 text-right">ML</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{p.item_code}</td>
                  <td className="px-4 py-3 text-slate-600">{p.brand_name || '—'}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{p.product_name}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{p.bottle_type || <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs font-mono">{p.recipe_id || <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs font-mono">{p.batch_prefix || <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{p.ml_per_bottle || '—'}</td>
                  <td className="px-4 py-3 text-center">
                   <div className="flex flex-col items-center gap-1">
                     <button
                       onClick={() => handleToggleActive(p)}
                       className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${p.is_active !== false ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                     >
                       {p.is_active !== false ? 'Active' : 'Inactive'}
                     </button>
                     {p.is_active && missingSetup(p) && (
                       <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Missing Setup</span>
                     )}
                     {p.is_trial_pack && (
                       <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">Trial</span>
                     )}
                   </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => openEdit(p)} className="p-1 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-800">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-1 hover:bg-red-50 rounded-md text-slate-400 hover:text-red-600">
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit SKU' : 'Add SKU'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            {[
              { key: 'item_code', label: 'SKU Code (item_code) *', type: 'text' },
              { key: 'product_name', label: 'SKU Name *', type: 'text' },
              { key: 'brand_name', label: 'Brand Name', type: 'text' },
              { key: 'flavour', label: 'Flavour', type: 'text' },
              { key: 'ml_per_bottle', label: 'ML per Bottle', type: 'number' },
              { key: 'product_barcode', label: 'Product Barcode', type: 'text' },
              { key: 'mrp_box', label: 'MRP per Box (₹)', type: 'number' },
              { key: 'gross_weight_kg', label: 'Gross Weight (kg)', type: 'number' },
              { key: 'shelf_life_days', label: 'Shelf Life (days)', type: 'number' },
              { key: 'fssai_no', label: 'FSSAI No', type: 'text' },
              { key: 'manufacturer_name', label: 'Manufacturer Name', type: 'text' },
              { key: 'batch_prefix', label: 'Batch Prefix (optional)', type: 'text' },
            ].map(({ key, label, type }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="text-sm" />
              </div>
            ))}

            {/* Box Type dropdown */}
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Box Type {form.is_active ? '*' : ''}</Label>
              {boxTypes.length > 0 ? (
                <select
                  value={form.box_type_id}
                  onChange={e => {
                    const bt = boxTypes.find(b => b.box_type_id === e.target.value);
                    setForm(f => ({
                      ...f,
                      box_type_id: e.target.value,
                      bottles_per_box: bt ? bt.bottles_per_box : f.bottles_per_box,
                    }));
                  }}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
                >
                  <option value="">— Select box type —</option>
                  {boxTypes.map(b => (
                    <option key={b.id} value={b.box_type_id}>
                      {b.box_name}{b.box_code ? ` (${b.box_code})` : ''} — {b.bottles_per_box} btls/box
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">No active Box Types found. Add one in Master Data → Box Types first.</p>
              )}
              {/* Show derived bottles_per_box + dimensions read-only */}
              {form.box_type_id && (() => {
                const bt = boxTypes.find(b => b.box_type_id === form.box_type_id);
                if (!bt) return null;
                const dims = [bt.length_mm, bt.width_mm, bt.height_mm].filter(Boolean);
                return (
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                    <span>📦 <strong className="text-slate-700">{bt.bottles_per_box}</strong> bottles/box</span>
                    {dims.length === 3 && <span>📐 {bt.length_mm} × {bt.width_mm} × {bt.height_mm} mm</span>}
                    {bt.empty_weight_kg && <span>⚖️ {bt.empty_weight_kg} kg empty</span>}
                  </div>
                );
              })()}
            </div>

            {/* Bottles per box — read-only, derived */}
            <div className="space-y-1">
              <Label className="text-xs">Bottles per Box (auto from Box Type)</Label>
              <Input
                type="number"
                value={form.bottles_per_box}
                readOnly
                className="text-sm bg-slate-50 font-bold"
                placeholder="Set by Box Type"
              />
            </div>

            {/* Bottle Type dropdown */}
            <div className="space-y-1">
              <Label className="text-xs">Bottle Type {form.is_active ? '*' : ''}</Label>
              {bottleTypes.length > 0 ? (
                <select
                  value={form.bottle_type}
                  onChange={e => setForm(f => ({ ...f, bottle_type: e.target.value }))}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
                >
                  <option value="">— Select bottle type —</option>
                  {bottleTypes.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
              ) : (
                <Input value={form.bottle_type} onChange={e => setForm(f => ({ ...f, bottle_type: e.target.value }))} className="text-sm" placeholder="Bottle type" />
              )}
            </div>
            {/* Recipe ID dropdown */}
            <div className="space-y-1">
              <Label className="text-xs">Recipe ID {form.is_active ? '*' : ''}</Label>
              {recipes.length > 0 ? (
                <select
                  value={form.recipe_id}
                  onChange={e => setForm(f => ({ ...f, recipe_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
                >
                  <option value="">— Select recipe —</option>
                  {recipes.map(r => <option key={r.id} value={r.recipe_id}>{r.recipe_id} - {r.recipe_name}</option>)}
                </select>
              ) : (
                <Input value={form.recipe_id} onChange={e => setForm(f => ({ ...f, recipe_id: e.target.value }))} className="text-sm" placeholder="e.g. REC-001" />
              )}
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Address Line 1</Label>
              <Input value={form.address_1} onChange={e => setForm(f => ({ ...f, address_1: e.target.value }))} className="text-sm" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Address Line 2</Label>
              <Input value={form.address_2} onChange={e => setForm(f => ({ ...f, address_2: e.target.value }))} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Customer Care Email</Label>
              <Input value={form.customer_care_email} onChange={e => setForm(f => ({ ...f, customer_care_email: e.target.value }))} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Customer Care Phone</Label>
              <Input value={form.customer_care_phone} onChange={e => setForm(f => ({ ...f, customer_care_phone: e.target.value }))} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Is Trial Pack?</Label>
              <select
                value={form.is_trial_pack ? 'true' : 'false'}
                onChange={e => setForm(f => ({ ...f, is_trial_pack: e.target.value === 'true' }))}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="false">No</option>
                <option value="true">Yes — Trial Pack</option>
              </select>
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
            <Button onClick={handleSave} disabled={saving || !form.item_code || !form.product_name}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}