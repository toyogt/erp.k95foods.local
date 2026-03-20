import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Save, X, Search, Package } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const CATEGORY_LABELS = {
  INGREDIENT: 'Ingredient',
  PACKAGING_BOX: 'Packaging Box',
  CONTAINER: 'Container',
  CAP: 'Cap',
  CONSUMABLE: 'Consumable',
};

export default function ItemMasterPage() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    item_code: '', item_name: '', category: 'INGREDIENT', base_uom: '',
    barcode: '', specifications: {}, is_active: true, notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [u, itms, uomList] = await Promise.all([
      base44.auth.me().catch(() => null),
      base44.entities.ItemMaster.list('-created_date', 1000),
      base44.entities.UOMMaster.list('uom_name', 200).catch(() => []),
    ]);
    setUser(u);
    setItems(itms);
    setUoms(uomList);
    setLoading(false);
  }

  function openNew() {
    setEditingItem(null);
    setForm({ item_code: '', item_name: '', category: 'INGREDIENT', base_uom: '', barcode: '', specifications: {}, is_active: true, notes: '' });
    setDialogOpen(true);
  }

  function openEdit(item) {
    setEditingItem(item);
    setForm({ ...item, specifications: item.specifications || {} });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.item_code.trim() || !form.item_name.trim()) {
      alert('Item code and name are required');
      return;
    }
    setSaving(true);
    if (editingItem) {
      await base44.entities.ItemMaster.update(editingItem.id, form);
    } else {
      await base44.entities.ItemMaster.create(form);
    }
    setSaving(false);
    setDialogOpen(false);
    await loadData();
  }

  const filtered = items.filter(it => {
    const matchSearch = !searchQuery || 
      it.item_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      it.item_code?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = !categoryFilter || it.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  if (user?.role !== 'admin') return <div className="text-red-600 p-4">Admin access required</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Item Master</h1>
          <p className="text-sm text-slate-500">Unified catalog for all purchasable items</p>
        </div>
        <Button onClick={openNew} className="h-11 gap-2">
          <Plus className="w-4 h-4" /> Add Item
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search items..."
              className="pl-9 h-11"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="h-11 border border-slate-200 rounded-lg px-3 text-sm bg-white"
          >
            <option value="">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-500">
          Showing {filtered.length} of {items.length} items
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-100 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700">Item Code</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700">Item Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700">UOM</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-mono text-slate-900">{item.item_code}</td>
                  <td className="px-4 py-3 text-sm text-slate-900">{item.item_name}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-md font-medium">
                      {CATEGORY_LABELS[item.category]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{item.base_uom}</td>
                  <td className="px-4 py-3 text-xs">
                    {item.is_active ? (
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded-md font-medium">Active</span>
                    ) : (
                      <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded-md font-medium">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="outline" onClick={() => openEdit(item)} className="h-9">
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-12 text-center text-slate-400">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No items found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Item Code *</Label>
                <Input value={form.item_code} onChange={e => setForm(f => ({ ...f, item_code: e.target.value }))} placeholder="ING-001" className="h-11" />
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full h-11 border border-slate-200 rounded-lg px-3 text-sm bg-white">
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Item Name *</Label>
              <Input value={form.item_name} onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))} placeholder="White Sugar" className="h-11" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Base UOM *</Label>
                <select value={form.base_uom} onChange={e => setForm(f => ({ ...f, base_uom: e.target.value }))} className="w-full h-11 border border-slate-200 rounded-lg px-3 text-sm bg-white">
                  <option value="">Select UOM</option>
                  {uoms.map(u => <option key={u.id} value={u.uom_id}>{u.uom_name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Barcode</Label>
                <Input value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} placeholder="Optional" className="h-11" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4" />
              <Label className="cursor-pointer">Active</Label>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1 h-11">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 h-11">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}