import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Search, ChevronLeft, SlidersHorizontal } from 'lucide-react';
import { fmtDate } from './whHelpers';

export default function StockTab({ skus, lots, onBack }) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState('sku');
  const [showFilters, setShowFilters] = useState(false);
  const [filterBrand, setFilterBrand] = useState('');
  const [filterFamily, setFilterFamily] = useState('');
  const [filterFlavour, setFilterFlavour] = useState('');
  const [filterSku, setFilterSku] = useState('');

  // A lot is "effectively EMPTY" if both balances are 0, regardless of stored status
  const effectiveStatus = (l) =>
    l.status === 'ACTIVE' && (l.boxes_balance || 0) <= 0 && (l.loose_bottles_balance || 0) <= 0 ? 'EMPTY' : l.status;

  // Always show only ACTIVE lots (by effective status)
  const activeLots = lots.filter(l => effectiveStatus(l) === 'ACTIVE');

  const brands = [...new Set(activeLots.map(l => l.brand_name).filter(Boolean))].sort();
  const families = [...new Set(activeLots.map(l => l.product_family).filter(Boolean))].sort();
  const flavours = [...new Set(activeLots.map(l => l.flavour).filter(Boolean))].sort();
  const skuCodes = [...new Set(activeLots.map(l => l.sku_code).filter(Boolean))].sort();

  const matchesSearch = (str) => !search || str?.toLowerCase().includes(search.toLowerCase());

  const filteredLots = activeLots.filter(l => {
    if (filterBrand && l.brand_name !== filterBrand) return false;
    if (filterFamily && l.product_family !== filterFamily) return false;
    if (filterFlavour && l.flavour !== filterFlavour) return false;
    if (filterSku && l.sku_code !== filterSku) return false;
    return (
      matchesSearch(l.lot_id) ||
      matchesSearch(l.sku_code) ||
      matchesSearch(l.product_name) ||
      matchesSearch(l.brand_name) ||
      matchesSearch(l.batch_code) ||
      matchesSearch(l.flavour)
    );
  });

  const skuMap = {};
  filteredLots.forEach(lot => {
    if (!skuMap[lot.sku_code]) {
      const sku = skus.find(s => s.item_code === lot.sku_code);
      skuMap[lot.sku_code] = {
        sku_code: lot.sku_code,
        product_name: lot.product_name,
        brand_name: lot.brand_name,
        flavour: lot.flavour,
        bottles_per_box: lot.bottles_per_box || sku?.bottles_per_box || 1,
        totalBoxes: 0,
        totalLoose: 0,
        lotCount: 0,
      };
    }
    skuMap[lot.sku_code].totalBoxes += lot.boxes_balance || 0;
    skuMap[lot.sku_code].totalLoose += lot.loose_bottles_balance || 0;
    skuMap[lot.sku_code].lotCount += 1;
  });
  const skuSummary = Object.values(skuMap).map(s => ({
    ...s,
    totalBottles: s.totalBoxes * s.bottles_per_box + s.totalLoose,
  }));

  const activeFilterCount = [filterBrand, filterFamily, filterFlavour, filterSku].filter(Boolean).length;

  const resetFilters = () => {
    setFilterBrand(''); setFilterFamily(''); setFilterFlavour(''); setFilterSku('');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
          <ChevronLeft className="w-6 h-6 text-slate-700" />
        </button>
        <h2 className="text-lg font-bold text-slate-900">Stock View</h2>
      </div>

      {/* Search + Filter toggle + View toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
          <Input className="pl-8" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button
          onClick={() => setShowFilters(v => !v)}
          className={`flex items-center justify-center gap-1 px-3 py-2 rounded-xl border text-sm font-semibold min-h-[44px] min-w-[44px] transition-colors ${showFilters ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {activeFilterCount > 0 && <span className="bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{activeFilterCount}</span>}
        </button>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold">
          <button onClick={() => setView('sku')} className={`px-3 py-2 min-h-[44px] transition-colors ${view === 'sku' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
            By SKU
          </button>
          <button onClick={() => setView('lot')} className={`px-3 py-2 min-h-[44px] transition-colors ${view === 'lot' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
            By Lot
          </button>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">Filters</p>
            <button onClick={resetFilters} className="text-xs text-blue-600 min-h-[36px] px-2">Reset</button>
          </div>
          {skuCodes.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-slate-500">SKU</p>
              <select value={filterSku} onChange={e => setFilterSku(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white">
                <option value="">All SKUs</option>
                {skuCodes.map(c => {
                  const lot = activeLots.find(l => l.sku_code === c);
                  return <option key={c} value={c}>{lot?.product_name || c} ({c})</option>;
                })}
              </select>
            </div>
          )}
          {brands.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Brand</p>
              <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white">
                <option value="">All Brands</option>
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          )}
          {families.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Product Family</p>
              <select value={filterFamily} onChange={e => setFilterFamily(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white">
                <option value="">All Families</option>
                {families.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          )}
          {flavours.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Flavour</p>
              <select value={filterFlavour} onChange={e => setFilterFlavour(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white">
                <option value="">All Flavours</option>
                {flavours.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {view === 'sku' ? (
        skuSummary.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">No active stock found.</div>
        ) : (
          <div className="space-y-2">
            {skuSummary.map(sku => (
              <div key={sku.sku_code} className="border border-slate-200 rounded-xl p-4 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {sku.brand_name && <p className="text-xs font-semibold text-blue-600">{sku.brand_name}</p>}
                    <p className="font-semibold text-slate-900 text-sm leading-snug">{sku.product_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{sku.sku_code}{sku.flavour ? ` · ${sku.flavour}` : ''}</p>
                    <p className="text-xs text-slate-400">{sku.lotCount} lot(s)</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-bold text-slate-900">{sku.totalBottles.toLocaleString()}</p>
                    <p className="text-xs text-slate-400">bottles</p>
                    <p className="text-xs text-slate-500">{sku.totalBoxes} boxes + {sku.totalLoose} loose</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        filteredLots.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">No lots found.</div>
        ) : (
          <div className="space-y-2">
            {filteredLots.map(lot => {
              const ppb = lot.bottles_per_box || 1;
              const total = (lot.boxes_balance || 0) * ppb + (lot.loose_bottles_balance || 0);
              return (
                <div key={lot.id} className="border border-slate-200 rounded-xl p-4 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-mono font-bold text-slate-400">{lot.lot_id}</p>
                      {lot.brand_name && <p className="text-xs font-semibold text-blue-600">{lot.brand_name}</p>}
                      <p className="font-semibold text-slate-900 text-sm leading-snug">{lot.product_name || lot.sku_code}</p>
                      {lot.flavour && <p className="text-xs text-slate-400">{lot.flavour}</p>}
                      {lot.batch_code && <p className="text-xs text-slate-400">Batch: {lot.batch_code}</p>}
                      {(lot.mfg_date || lot.exp_date) && <p className="text-xs text-slate-400">Mfg: {fmtDate(lot.mfg_date)} · Exp: {fmtDate(lot.exp_date)}</p>}
                      {lot.location && <p className="text-xs text-slate-400">📍 {lot.location}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-slate-900">{total.toLocaleString()}</p>
                      <p className="text-xs text-slate-400">bottles</p>
                      <p className="text-xs text-slate-500">{lot.boxes_balance} boxes</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}