import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Loader2, Search, Package } from 'lucide-react';
import TablePagination from '@/components/store/TablePagination';

function genBoxId() {
  return 'BOX-' + String(Date.now()).slice(-6).padStart(6, '0');
}

const EMPTY_FORM = {
  box_type_id: '', box_code: '', box_name: '', bottles_per_box: '',
  length_mm: '', width_mm: '', height_mm: '', empty_weight_kg: '',
  is_active: true, notes: ''
};

export default function BoxTypeManager({ user }) {
  const [boxTypes, setBoxTypes] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [editing, setEditing] = useState(null); // null | 'new' | record
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === 'admin';

  const load = async () => {
    setLoading(true);
    const [bts, prods] = await Promise.all([
      base44.entities.BoxType.list('-created_date', 200),
      base44.entities.ProductMaster.list('-created_date', 500),
    ]);
    setBoxTypes(bts);
    setProducts(prods);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const usageCount = (bt) => products.filter(p => p.box_type_id === bt.box_type_id).length;

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, box_type_id: genBoxId() });
    setEditing('new');
  };

  const openEdit = (bt) => {
    setForm({ ...EMPTY_FORM, ...bt });
    setEditing(bt);
  };

  const handleSave = async () => {
    if (!form.box_name.trim() || !form.bottles_per_box) return;
    setSaving(true);
    const payload = { ...form };
    ['bottles_per_box', 'length_mm', 'width_mm', 'height_mm', 'empty_weight_kg'].forEach(k => {
      if (payload[k] !== '' && payload[k] != null) payload[k] = Number(payload[k]);
      else delete payload[k];
    });
    if (editing === 'new') {
      await base44.entities.BoxType.create(payload);
    } else {
      await base44.entities.BoxType.update(editing.id, payload);
    }
    setSaving(false);
    setEditing(null);
    load();
  };

  const handleToggleActive = async (bt) => {
    await base44.entities.BoxType.update(bt.id, { is_active: !bt.is_active });
    load();
  };

  const handleDelete = async (bt) => {
    const count = usageCount(bt);
    if (count > 0) {
      alert(`Cannot delete: this Box Type is used by ${count} SKU(s). Deactivate it instead.`);
      return;
    }
    if (!window.confirm(`Delete "${bt.box_name}"?`)) return;
    await base44.entities.BoxType.delete(bt.id);
    load();
  };

  const filtered = boxTypes.filter(bt =>
    !search ||
    bt.box_name?.toLowerCase().includes(search.toLowerCase()) ||
    bt.box_code?.toLowerCase().includes(search.toLowerCase()) ||
    bt.box_type_id?.toLowerCase().includes(search.toLowerCase())
  );

  if (editing) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 max-w-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800">{editing === 'new' ? 'New Box Type' : 'Edit Box Type'}</h3>
          <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Box Type ID</Label>
            <Input value={form.box_type_id} readOnly className="text-sm font-mono bg-slate-50" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Box Code (e.g. BX6-250)</Label>
            <Input value={form.box_code} onChange={e => setForm(f => ({ ...f, box_code: e.target.value }))} className="text-sm" />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Box Name *</Label>
            <Input value={form.box_name} onChange={e => setForm(f => ({ ...f, box_name: e.target.value }))} className="text-sm" placeholder="e.g. 6-pack 250ml box" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bottles per Box *</Label>
            <Input type="number" min="1" value={form.bottles_per_box} onChange={e => setForm(f => ({ ...f, bottles_per_box: e.target.value }))} className="text-sm font-bold" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Empty Weight (kg)</Label>
            <Input type="number" min="0" step="0.001" value={form.empty_weight_kg} onChange={e => setForm(f => ({ ...f, empty_weight_kg: e.target.value }))} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Length (mm)</Label>
            <Input type="number" min="0" value={form.length_mm} onChange={e => setForm(f => ({ ...f, length_mm: e.target.value }))} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Width (mm)</Label>
            <Input type="number" min="0" value={form.width_mm} onChange={e => setForm(f => ({ ...f, width_mm: e.target.value }))} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Height (mm)</Label>
            <Input type="number" min="0" value={form.height_mm} onChange={e => setForm(f => ({ ...f, height_mm: e.target.value }))} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Active</Label>
            <select value={form.is_active ? 'true' : 'false'} onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'true' }))} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Notes</Label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="text-sm" />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={() => setEditing(null)} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.box_name.trim() || !form.bottles_per_box} className="flex-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
          <Input className="pl-8 w-56 text-sm" placeholder="Search box types…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openAdd} className="gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" /> Add Box Type
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">No box types found.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">ID / Code</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-center">Btls/Box</th>
                <th className="px-4 py-3 text-center">Dimensions (mm)</th>
                <th className="px-4 py-3 text-center">SKUs Using</th>
                <th className="px-4 py-3 text-center">Status</th>
                {isAdmin && <th className="px-4 py-3 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.slice((page - 1) * pageSize, page * pageSize).map(bt => {
                const count = usageCount(bt);
                const dims = [bt.length_mm, bt.width_mm, bt.height_mm].filter(Boolean);
                return (
                  <tr key={bt.id} className={`hover:bg-slate-50 ${!bt.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-semibold text-slate-700">{bt.box_type_id}</p>
                      {bt.box_code && <p className="text-xs text-slate-400">{bt.box_code}</p>}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{bt.box_name}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-base font-bold text-slate-800">{bt.bottles_per_box}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-slate-500">
                      {dims.length === 3 ? `${bt.length_mm} × ${bt.width_mm} × ${bt.height_mm}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${count > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                        {count} SKU{count !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${bt.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {bt.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1.5">
                          <button onClick={() => openEdit(bt)} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-800">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleActive(bt)}
                            title={bt.is_active ? 'Deactivate' : 'Activate'}
                            className={`px-2 py-1 rounded-md text-xs font-semibold border transition-colors ${bt.is_active ? 'border-slate-200 text-slate-500 hover:bg-slate-100' : 'border-green-200 text-green-700 hover:bg-green-50'}`}
                          >
                            {bt.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleDelete(bt)}
                            disabled={count > 0}
                            title={count > 0 ? `Cannot delete: used by ${count} SKU(s)` : 'Delete'}
                            className={`p-1.5 rounded-md transition-colors ${count > 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:bg-red-50 hover:text-red-600'}`}
                          >
                            <Package className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {count > 0 && (
                          <p className="text-xs text-slate-400 mt-0.5">Used by {count} SKU{count !== 1 ? 's' : ''}</p>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <TablePagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </div>
      )}
    </div>
  );
}