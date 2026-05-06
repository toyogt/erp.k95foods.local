import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OpeningStockItemsTable from '@/components/store/OpeningStockItemsTable';
import OpeningStockEntriesLog from '@/components/store/OpeningStockEntriesLog';
import { Loader2, PackageOpen, Search } from 'lucide-react';
import { fetchAllSystemItems, CATEGORY_LABELS } from '@/lib/allItemsFetcher';

export default function SMSOpeningStockManager() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Fetch directly from All Items module source entities
  const { data: systemItems = [], isLoading: loadingItems } = useQuery({
    queryKey: ['opening-stock-system-items'],
    queryFn: fetchAllSystemItems,
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

  const loading = loadingItems || loadingLots || loadingLocations;

  const categories = ['all', ...Array.from(new Set(systemItems.map(i => i.item_category).filter(Boolean)))];

  const filtered = systemItems.filter(item => {
    const matchSearch = !search.trim()
      || item.item_name?.toLowerCase().includes(search.toLowerCase())
      || item.item_code?.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'all' || item.item_category === categoryFilter;
    return matchSearch && matchCat;
  });

  function handleLotAdded() {
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
          Showing all items directly from the All Items module. Adding stock here assigns it immediately to the selected location.
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
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <PackageOpen className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-slate-500 text-sm">No items found.</p>
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