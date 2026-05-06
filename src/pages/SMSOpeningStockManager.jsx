import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OpeningStockItemsTable from '@/components/store/OpeningStockItemsTable';
import OpeningStockEntriesLog from '@/components/store/OpeningStockEntriesLog';
import { Loader2, PackageOpen, Search } from 'lucide-react';

const SOURCE_LABELS = {
  store: 'Store Items',
  purchase: 'Purchase Items',
  sales: 'Sales Products',
};

const CATEGORY_LABELS = {
  ingredient: 'Ingredient',
  box_type: 'Box Type',
  cap_type: 'Cap Type',
  container: 'Container',
  flavour: 'Flavour',
  label_artwork: 'Label Artwork',
  packaging: 'Packaging',
  other: 'Other',
  INGREDIENT: 'Ingredient',
  PACKAGING_BOX: 'Packaging Box',
  CONTAINER: 'Container',
  CAP: 'Cap',
  CONSUMABLE: 'Consumable',
  sales: 'Sales Product',
};

function normalizeItems(storeItems, masterItems, products) {
  const normalized = [];

  storeItems.forEach(i => {
    normalized.push({
      ...i,
      _source: 'store',
      _display_category: CATEGORY_LABELS[i.item_category] || i.item_category || 'Other',
    });
  });

  masterItems.forEach(i => {
    // Skip if already exists in store items (by item_code)
    if (storeItems.some(s => s.item_code === i.item_code)) return;
    normalized.push({
      id: i.id,
      item_code: i.item_code,
      item_name: i.item_name,
      item_category: i.category?.toLowerCase() || 'other',
      uom: i.base_uom || 'Nos',
      is_active: i.is_active !== false,
      batch_required: false,
      expiry_required: false,
      mfg_date_required: false,
      opening_stock: 0,
      _source: 'purchase',
      _display_category: CATEGORY_LABELS[i.category] || i.category || 'Other',
      _entity_type: 'ItemMaster',
    });
  });

  products.forEach(i => {
    if (storeItems.some(s => s.item_code === i.item_code)) return;
    if (masterItems.some(m => m.item_code === i.item_code)) return;
    normalized.push({
      id: i.id,
      item_code: i.item_code,
      item_name: i.product_name || i.item_code,
      item_category: 'sales',
      uom: 'Nos',
      is_active: i.is_active !== false,
      batch_required: false,
      expiry_required: false,
      mfg_date_required: false,
      opening_stock: 0,
      _source: 'sales',
      _display_category: 'Sales Product',
      _entity_type: 'ProductMaster',
    });
  });

  return normalized;
}

export default function SMSOpeningStockManager() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  const { data: storeItems = [], isLoading: loadingStore, refetch: refetchStore } = useQuery({
    queryKey: ['opening-stock-store'],
    queryFn: () => base44.entities.StoreItemMaster.filter({ is_active: true }, 'item_name', 500),
    staleTime: 60000,
  });

  const { data: masterItems = [], isLoading: loadingMaster } = useQuery({
    queryKey: ['opening-stock-master'],
    queryFn: () => base44.entities.ItemMaster.list('-created_date', 500).catch(() => []),
    staleTime: 60000,
  });

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['opening-stock-products'],
    queryFn: () => base44.entities.ProductMaster.list('-created_date', 500).catch(() => []),
    staleTime: 60000,
  });

  const { data: allLots = [], isLoading: loadingLots, refetch: refetchLots } = useQuery({
    queryKey: ['opening-stock-lots'],
    queryFn: () => base44.entities.StoreOpeningStock.list('fifo_rank', 1000),
    staleTime: 60000,
  });

  const { data: locations = [], isLoading: loadingLocations } = useQuery({
    queryKey: ['opening-stock-locations'],
    queryFn: () => base44.entities.StoreLocation.filter({ is_active: true }, 'location_code', 200),
    staleTime: 60000,
  });

  const loading = loadingStore || loadingMaster || loadingProducts || loadingLots || loadingLocations;

  const allItems = normalizeItems(storeItems, masterItems, products);

  const categories = ['all', ...Array.from(new Set(allItems.map(i => i.item_category).filter(Boolean)))];
  const sources = ['all', ...Array.from(new Set(allItems.map(i => i._source).filter(Boolean)))];

  const filtered = allItems.filter(item => {
    const matchSearch = !search.trim()
      || item.item_name?.toLowerCase().includes(search.toLowerCase())
      || item.item_code?.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'all' || item.item_category === categoryFilter;
    const matchSource = sourceFilter === 'all' || item._source === sourceFilter;
    return matchSearch && matchCat && matchSource;
  });

  function handleLotAdded() {
    refetchStore();
    refetchLots();
  }

  return (
    <div className="space-y-4 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <PackageOpen className="w-6 h-6 text-teal-600" />
          Opening Stock Management
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Items are fetched from All Items module (Store Items, Purchase Items, Sales Products). Assign opening stock lots per item.
        </p>
      </div>

      <Tabs defaultValue="items" className="w-full">
        <TabsList className="inline-flex h-10 rounded-xl bg-slate-100 p-1">
          <TabsTrigger value="items" className="rounded-lg text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">
            Items ({filtered.length})
          </TabsTrigger>
          <TabsTrigger value="entries" className="rounded-lg text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">
            Entries Log ({allLots.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="mt-4 space-y-3">
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
              className="h-9 border border-slate-200 rounded-md px-3 text-sm bg-white min-w-[140px]"
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
            >
              {sources.map(s => (
                <option key={s} value={s}>{s === 'all' ? 'All Sources' : (SOURCE_LABELS[s] || s)}</option>
              ))}
            </select>
            <select
              className="h-9 border border-slate-200 rounded-md px-3 text-sm bg-white min-w-[140px]"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
            >
              {categories.map(c => (
                <option key={c} value={c}>{c === 'all' ? 'All Categories' : (CATEGORY_LABELS[c] || c)}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
            </div>
          ) : (
            <OpeningStockItemsTable
              items={filtered}
              allLots={allLots}
              locations={locations}
              onLotAdded={handleLotAdded}
            />
          )}
        </TabsContent>

        <TabsContent value="entries" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
            </div>
          ) : (
            <OpeningStockEntriesLog entries={allLots} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}