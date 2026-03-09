import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Package } from 'lucide-react';

export default function StockTab({ skus, lots }) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState('sku'); // 'sku' | 'lot'

  // SKU-level summary
  const skuSummary = skus.map(sku => {
    const skuLots = lots.filter(l => l.sku_code === sku.item_code && l.status === 'ACTIVE');
    const totalBoxes = skuLots.reduce((s, l) => s + (l.boxes_balance || 0), 0);
    const totalLoose = skuLots.reduce((s, l) => s + (l.loose_bottles_balance || 0), 0);
    const ppb = sku.bottles_per_box || 1;
    const totalBottles = totalBoxes * ppb + totalLoose;
    return { ...sku, totalBoxes, totalLoose, totalBottles, lotCount: skuLots.length };
  }).filter(s => s.lotCount > 0 || s.totalBoxes > 0);

  const filteredSku = skuSummary.filter(s =>
    !search ||
    s.item_code?.toLowerCase().includes(search.toLowerCase()) ||
    s.product_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.brand_name?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredLots = lots.filter(l =>
    l.status === 'ACTIVE' && (
      !search ||
      l.lot_id?.toLowerCase().includes(search.toLowerCase()) ||
      l.sku_code?.toLowerCase().includes(search.toLowerCase()) ||
      l.product_name?.toLowerCase().includes(search.toLowerCase())
    )
  );

  return (
    <div className="space-y-4">
      {/* Toggle + Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
          <Input className="pl-8 text-sm" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold">
          <button onClick={() => setView('sku')} className={`px-3 py-2 transition-colors ${view === 'sku' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
            By SKU
          </button>
          <button onClick={() => setView('lot')} className={`px-3 py-2 transition-colors ${view === 'lot' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
            By Lot
          </button>
        </div>
      </div>

      {view === 'sku' ? (
        filteredSku.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">No stock on hand.</div>
        ) : (
          <div className="space-y-2">
            {filteredSku.map(sku => (
              <div key={sku.id} className="border border-slate-200 rounded-xl p-4 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{sku.product_name}</p>
                    <p className="text-xs text-slate-400">{sku.item_code} · {[sku.brand_name, sku.flavour].filter(Boolean).join(' · ')}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{sku.lotCount} active lot(s)</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-slate-900">{sku.totalBottles.toLocaleString()}</p>
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
          <div className="text-center py-12 text-slate-400 text-sm">No active lots.</div>
        ) : (
          <div className="space-y-2">
            {filteredLots.map(lot => {
              const ppb = lot.bottles_per_box || 1;
              const total = (lot.boxes_balance || 0) * ppb + (lot.loose_bottles_balance || 0);
              return (
                <div key={lot.id} className="border border-slate-200 rounded-xl p-4 bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-mono font-bold text-slate-400">{lot.lot_id}</p>
                      <p className="font-semibold text-slate-900 text-sm">{lot.product_name || lot.sku_code}</p>
                      <p className="text-xs text-slate-400">{[lot.brand_name, lot.flavour].filter(Boolean).join(' · ')}</p>
                      {lot.location && <p className="text-xs text-slate-400">📍 {lot.location}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-slate-900">{total.toLocaleString()}</p>
                      <p className="text-xs text-slate-400">bottles</p>
                      <p className="text-xs text-slate-500">{lot.boxes_balance} boxes + {lot.loose_bottles_balance} loose</p>
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