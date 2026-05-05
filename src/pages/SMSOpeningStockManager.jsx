import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Loader2, PackageOpen, Search } from 'lucide-react';
import OpeningStockItemPanel from '@/components/store/OpeningStockItemPanel';

const CATEGORY_LABELS = {
  ingredient: 'Ingredient',
  box_type: 'Box Type',
  cap_type: 'Cap Type',
  container: 'Container',
  flavour: 'Flavour',
  label_artwork: 'Label Artwork',
  packaging: 'Packaging',
  other: 'Other',
};

export default function SMSOpeningStockManager() {
  const [items, setItems] = useState([]);
  const [allLots, setAllLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  async function loadAll() {
    setLoading(true);
    const [itemsData, lotsData] = await Promise.all([
      base44.entities.StoreItemMaster.filter({ is_active: true }, 'item_name', 500),
      base44.entities.StoreOpeningStock.list('fifo_rank', 1000),
    ]);
    setItems(itemsData);
    setAllLots(lotsData);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  const categories = ['all', ...Array.from(new Set(items.map(i => i.item_category).filter(Boolean)))];

  const filtered = items.filter(item => {
    const matchSearch = !search.trim()
      || item.item_name?.toLowerCase().includes(search.toLowerCase())
      || item.item_code?.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'all' || item.item_category === categoryFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <PackageOpen className="w-6 h-6 text-teal-600" />
          Opening Stock Management
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Assign opening stock lots per item — each batch can have a different expiry date, location, and quantity. FIFO is applied automatically.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            className="pl-9 h-9 text-sm"
            placeholder="Search by item name or code…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="h-9 border border-slate-200 rounded-md px-3 text-sm bg-white"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        >
          {categories.map(c => (
            <option key={c} value={c}>{c === 'all' ? 'All Categories' : (CATEGORY_LABELS[c] || c)}</option>
          ))}
        </select>
      </div>

      {/* Item list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          {search || categoryFilter !== 'all' ? 'No items match your filters.' : 'No active store items found. Create items first via Store Item Creator.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <OpeningStockItemPanel
              key={item.id}
              item={item}
              initialLots={allLots.filter(l => l.item_code === item.item_code)}
              onLotAdded={loadAll}
            />
          ))}
        </div>
      )}
    </div>
  );
}