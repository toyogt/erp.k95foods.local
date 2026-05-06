import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search, PackageSearch } from 'lucide-react';
import TablePagination from '@/components/store/TablePagination';

const CATEGORIES = [
  { key: 'all', label: 'All Items' },
  { key: 'store', label: 'Store Items' },
  { key: 'purchase', label: 'Purchase Items' },
  { key: 'production', label: 'Production Items' },
  { key: 'sales', label: 'Sales Products' },
];

export default function CentralItemHub() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => { base44.auth.me().then(u => setUser(u)).catch(() => {}); }, []);

  const { data: storeItems = [], isLoading: loadingStore } = useQuery({
    queryKey: ['hub-store'], queryFn: () => base44.entities.StoreItemMaster.list('-created_date', 500).catch(() => []),
    staleTime: 60000, enabled: !!user,
  });

  const { data: masterItems = [], isLoading: loadingMaster } = useQuery({
    queryKey: ['hub-master'], queryFn: () => base44.entities.ItemMaster.list('-created_date', 500).catch(() => []),
    staleTime: 60000, enabled: !!user,
  });

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['hub-products'], queryFn: () => base44.entities.ProductMaster.list('-created_date', 500).catch(() => []),
    staleTime: 60000, enabled: !!user,
  });

  const loading = loadingStore || loadingMaster || loadingProducts;

  const allItems = [
    ...storeItems.map(i => ({ ...i, _source: 'store', _category: i.item_category || 'store' })),
    ...masterItems.map(i => ({ ...i, _source: 'purchase', _category: i.category || 'purchase' })),
    ...products.map(i => ({ ...i, _source: 'sales', _category: 'sales', item_name: i.product_name, item_code: i.item_code })),
  ];

  const filtered = allItems.filter(item => {
    if (tab !== 'all' && item._source !== tab) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(item.item_name?.toLowerCase().includes(q) || item.item_code?.toLowerCase().includes(q) || item.product_name?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const categoryCounts = {
    all: allItems.length,
    store: storeItems.length,
    purchase: masterItems.length,
    production: 0,
    sales: products.length,
  };

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Central Item Hub</h1>
        <p className="text-sm text-slate-500">Unified view of all items across the system</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {CATEGORIES.map(c => (
          <button key={c.key} onClick={() => { setTab(c.key); setPage(1); }}
            className={`border rounded-xl p-3 text-center transition-colors ${tab === c.key ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
            <p className="text-lg font-bold">{categoryCounts[c.key]}</p>
            <p className="text-xs">{c.label}</p>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="w-full border border-slate-200 rounded-xl pl-10 pr-4 h-11 text-sm bg-white"
          placeholder="Search items..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <PackageSearch className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-slate-400 text-sm">No items found.</p>
        </div>
      ) : (
        <>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-100 text-slate-700 text-xs">
                  <th className="text-left px-3 py-3 font-medium">Item Name</th>
                  <th className="text-left px-3 py-3 font-medium">Code</th>
                  <th className="text-left px-3 py-3 font-medium">Source</th>
                  <th className="text-left px-3 py-3 font-medium">Category</th>
                  <th className="text-left px-3 py-3 font-medium">Status</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {paged.map((item, i) => (
                    <tr key={item.id || i} className="hover:bg-slate-50">
                      <td className="px-3 py-3 font-medium text-slate-900">{item.item_name || item.product_name || '—'}</td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-600">{item.item_code || '—'}</td>
                      <td className="px-3 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item._source === 'store' ? 'bg-teal-100 text-teal-700' : item._source === 'sales' ? 'bg-rose-100 text-rose-700' : 'bg-violet-100 text-violet-700'}`}>{item._source}</span></td>
                      <td className="px-3 py-3 text-xs text-slate-600 capitalize">{item._category?.replace(/_/g, ' ') || '—'}</td>
                      <td className="px-3 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${item.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{item.is_active !== false ? 'Active' : 'Inactive'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <TablePagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} />
        </>
      )}
    </div>
  );
}