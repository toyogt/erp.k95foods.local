import { Input } from '@/components/ui/input';
import { Search, PackageOpen, ImageIcon } from 'lucide-react';

const CATEGORIES = [
  { value: 'ingredient', label: 'Ingredient' },
  { value: 'box_type', label: 'Box Type' },
  { value: 'cap_type', label: 'Cap Type' },
  { value: 'container', label: 'Container / Bottle' },
  { value: 'flavour', label: 'Flavour' },
  { value: 'label_artwork', label: 'Label Artwork' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'other', label: 'Other' },
];

export default function StoreItemList({ items, loading, search, onSearchChange, categoryFilter, onCategoryChange }) {
  const filtered = items.filter(i => {
    const matchSearch = i.item_name?.toLowerCase().includes(search.toLowerCase()) ||
      i.item_category?.toLowerCase().includes(search.toLowerCase()) ||
      i.item_code?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === 'all' || i.item_category === categoryFilter;
    return matchSearch && matchCategory;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input className="pl-9 h-9" placeholder="Search items…" value={search} onChange={e => onSearchChange(e.target.value)} />
        </div>
        <select
          className="h-9 border border-slate-200 rounded-md px-3 text-sm bg-white"
          value={categoryFilter}
          onChange={e => onCategoryChange(e.target.value)}
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <PackageOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-slate-400 text-sm">No items found.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-700 text-xs">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Item Name</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Category</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Unit</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Rules</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.material_photo ? (
                          <img src={item.material_photo} alt="" className="w-8 h-8 rounded object-cover border border-slate-200" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center">
                            <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        )}
                        <div>
                          <span className="font-medium text-slate-900">{item.item_name}</span>
                          {item.item_code && (
                            <p className="text-xs text-slate-400">{item.item_code}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="capitalize text-slate-600">{item.item_category?.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{item.uom || 'Nos'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {item.batch_required && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Batch</span>}
                        {item.expiry_required && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">Expiry</span>}
                        {item.mfg_date_required && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Manufacture Date</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {item.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 font-medium">
            {filtered.length} item(s)
          </div>
        </div>
      )}
    </div>
  );
}