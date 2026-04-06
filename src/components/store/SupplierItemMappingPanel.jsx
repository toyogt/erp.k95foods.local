import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Loader2, Link2 } from 'lucide-react';

export default function SupplierItemMappingPanel({ supplierId, supplierName }) {
  const [mappings, setMappings] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, [supplierId]);

  async function load() {
    setLoading(true);
    const [maps, allItems] = await Promise.all([
      base44.entities.SupplierItemMapping.filter({ supplier_id: supplierId }, '-created_date', 200),
      base44.entities.StoreItemMaster.filter({ is_active: true }, 'item_name', 500),
    ]);
    setMappings(maps);
    setItems(allItems);
    setLoading(false);
  }

  const mappedItemIds = new Set(mappings.map(m => m.item_id));
  const availableItems = items.filter(i => !mappedItemIds.has(i.id));

  async function addMapping() {
    if (!selectedItem) return;
    const item = items.find(i => i.id === selectedItem);
    if (!item) return;

    setSaving(true);
    await base44.entities.SupplierItemMapping.create({
      supplier_id: supplierId,
      supplier_name: supplierName,
      item_id: item.id,
      item_code: item.item_code || '',
      item_name: item.item_name,
      is_active: true,
    });
    setSelectedItem('');
    await load();
    setSaving(false);
  }

  async function removeMapping(mapping) {
    await base44.entities.SupplierItemMapping.delete(mapping.id);
    load();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link2 className="w-4 h-4 text-teal-600" />
        <h3 className="font-semibold text-slate-900 text-sm">Item Mapping</h3>
        <span className="text-xs text-slate-400">{mappings.length} items mapped</span>
      </div>

      {/* Add new mapping */}
      <div className="flex gap-2">
        <select
          className="flex-1 h-11 border border-slate-200 rounded-xl px-3 text-sm bg-white"
          value={selectedItem}
          onChange={e => setSelectedItem(e.target.value)}
        >
          <option value="">Select an item to map…</option>
          {availableItems.map(i => (
            <option key={i.id} value={i.id}>
              {i.item_name} ({i.item_category?.replace('_', ' ')})
            </option>
          ))}
        </select>
        <Button
          onClick={addMapping}
          disabled={!selectedItem || saving}
          className="h-11 bg-teal-600 hover:bg-teal-700 gap-1"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add
        </Button>
      </div>

      {/* Mapped items list */}
      {mappings.length === 0 ? (
        <div className="text-center py-6 text-slate-400 text-sm">
          No items mapped to this supplier yet.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="divide-y divide-slate-100">
            {mappings.map(m => (
              <div key={m.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-900">{m.item_name}</p>
                  {m.item_code && <p className="text-xs text-slate-400">{m.item_code}</p>}
                </div>
                <button
                  onClick={() => removeMapping(m)}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}