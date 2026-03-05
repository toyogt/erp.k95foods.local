import { useState } from 'react';
import { Plus, Search, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const FILTERS = ['All', 'Active', 'Inactive', 'Missing Setup'];

function setupComplete(sku, mapping) {
  return !!(
    sku.recipe_group_id &&
    sku.default_recipe_option_id &&
    sku.bottle_type &&
    sku.box_type_id &&
    sku.shelf_life_days &&
    mapping?.ryan_template_id &&
    mapping?.batch_format_rule_id
  );
}

export default function SKUList({ skus, mappings, selected, onSelect, onNew }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const mappingBySku = {};
  mappings.forEach(m => { mappingBySku[m.sku_code || m.product_code] = m; });

  const filtered = skus.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.item_code?.toLowerCase().includes(q) || s.product_name?.toLowerCase().includes(q) || s.brand_name?.toLowerCase().includes(q);
    const mapping = mappingBySku[s.item_code];
    const complete = setupComplete(s, mapping);
    if (filter === 'Active' && !s.is_active) return false;
    if (filter === 'Inactive' && s.is_active) return false;
    if (filter === 'Missing Setup' && complete) return false;
    return matchSearch;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-slate-200 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
          <Input className="pl-8 text-sm h-9" placeholder="Search SKUs…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* New SKU button */}
      <div className="p-3 border-b border-slate-200">
        <Button className="w-full h-9 gap-2 text-sm" onClick={onNew}>
          <Plus className="w-4 h-4" /> New SKU
        </Button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">No SKUs found</div>
        ) : filtered.map(s => {
          const mapping = mappingBySku[s.item_code];
          const complete = setupComplete(s, mapping);
          const isSelected = selected?.id === s.id;
          return (
            <button key={s.id} onClick={() => onSelect(s)}
              className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{s.item_code}</p>
                  <p className="text-xs text-slate-500 truncate">{s.product_name}</p>
                  {s.brand_name && <p className="text-xs text-slate-400 truncate">{s.brand_name}</p>}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {s.is_active ? (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Active</span>
                  ) : (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">Inactive</span>
                  )}
                  {complete ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}