import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Loader2, Search } from 'lucide-react';

export default function SKUBOMEditor({ sku, bomLines, items, onSaved }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [form, setForm] = useState({ item_code: '', qty_per_unit: '', uom: '', notes: '' });

  const skuLines = bomLines.filter(l => l.sku_code === sku?.item_code);

  const filteredItems = items.filter(i =>
    i.is_active !== false &&
    (itemSearch === '' ||
      i.item_name?.toLowerCase().includes(itemSearch.toLowerCase()) ||
      i.item_code?.toLowerCase().includes(itemSearch.toLowerCase()))
  );

  const selectItem = (item) => {
    setForm(f => ({
      ...f,
      item_code: item.item_code,
      uom: item.base_uom || '',
    }));
    setItemSearch('');
  };

  const handleAdd = async () => {
    if (!form.item_code || !form.qty_per_unit || !form.uom) return;
    const item = items.find(i => i.item_code === form.item_code);
    if (!item) return;

    // Check duplicate
    if (skuLines.some(l => l.item_code === form.item_code)) {
      alert(`${item.item_name} is already in the BOM for this SKU.`);
      return;
    }

    setSaving(true);
    await base44.entities.SKUBOMLine.create({
      sku_code: sku.item_code,
      sku_name: sku.product_name,
      item_code: item.item_code,
      item_name: item.item_name,
      category: item.category,
      qty_per_unit: Number(form.qty_per_unit),
      uom: form.uom,
      notes: form.notes,
      is_active: true,
    });
    setForm({ item_code: '', qty_per_unit: '', uom: '', notes: '' });
    setSaving(false);
    onSaved?.();
  };

  const handleDelete = async (lineId) => {
    if (!confirm('Remove this material from BOM?')) return;
    await base44.entities.SKUBOMLine.delete(lineId);
    onSaved?.();
  };

  if (!sku) return null;

  const selectedItem = items.find(i => i.item_code === form.item_code);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Bill of Materials</h3>
          <p className="text-xs text-slate-500">{skuLines.length} material{skuLines.length !== 1 ? 's' : ''} configured</p>
        </div>
        <Button size="sm" className="h-11 md:h-9 text-sm gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" /> Add Material
        </Button>
      </div>

      {/* BOM Lines Table */}
      {skuLines.length > 0 ? (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-700">Material</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-700">Category</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-700">Quantity / Unit</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-700">UOM</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-700 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {skuLines.map(line => (
                <tr key={line.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <p className="text-sm font-medium text-slate-900">{line.item_name}</p>
                    <p className="text-xs text-slate-400 font-mono">{line.item_code}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                      {line.category?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-semibold text-slate-900">
                    {line.qty_per_unit}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-slate-600">{line.uom}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => handleDelete(line.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center">
          <p className="text-sm text-slate-500">No materials configured for this SKU yet.</p>
          <p className="text-xs text-slate-400 mt-1">Add materials to define what this product needs for production.</p>
        </div>
      )}

      {/* Add Material Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Material to BOM</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Item Search */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Material (from Item Master)</Label>
              {selectedItem ? (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{selectedItem.item_name}</p>
                    <p className="text-xs text-slate-500 font-mono">{selectedItem.item_code} · {selectedItem.category?.replace('_', ' ')}</p>
                  </div>
                  <button onClick={() => setForm(f => ({ ...f, item_code: '', uom: '' }))} className="text-slate-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={itemSearch}
                      onChange={e => setItemSearch(e.target.value)}
                      placeholder="Search by name or code..."
                      className="h-11 md:h-9 pl-10"
                    />
                  </div>
                  {itemSearch.length > 0 && (
                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {filteredItems.slice(0, 20).map(item => (
                        <button
                          key={item.id}
                          onClick={() => selectItem(item)}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors"
                        >
                          <p className="text-sm font-medium text-slate-900">{item.item_name}</p>
                          <p className="text-xs text-slate-500">{item.item_code} · {item.category?.replace('_', ' ')} · {item.base_uom}</p>
                        </button>
                      ))}
                      {filteredItems.length === 0 && (
                        <p className="px-3 py-4 text-sm text-slate-400 text-center">No items found</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quantity */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Quantity per Unit</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.qty_per_unit}
                  onChange={e => setForm(f => ({ ...f, qty_per_unit: e.target.value.replace(/[^0-9.]/g, '') }))}
                  placeholder="e.g. 1, 0.2"
                  className="h-11 md:h-9"
                />
                <p className="text-xs text-slate-400">Per single bottle/unit</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">UOM</Label>
                <Input
                  value={form.uom}
                  onChange={e => setForm(f => ({ ...f, uom: e.target.value }))}
                  placeholder="PCS, KG, LTR..."
                  className="h-11 md:h-9"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Notes (optional)</Label>
              <Input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any notes..."
                className="h-11 md:h-9"
              />
            </div>

            <Button
              className="w-full h-11 text-sm"
              onClick={handleAdd}
              disabled={!form.item_code || !form.qty_per_unit || !form.uom || saving}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Add to Bill of Materials
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}