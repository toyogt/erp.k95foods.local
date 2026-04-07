import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { MapPin, Package, ArrowLeftRight, AlertTriangle, Layers, Search, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SkeletonTable } from '@/components/store/StoreSkeleton';

function exportToExcel(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map(r => headers.map(h => {
      const v = r[h] ?? '';
      return typeof v === 'string' && (v.includes(',') || v.includes('"')) ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(','))
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function WeekBadge({ weeks }) {
  if (!weeks || weeks <= 1) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Week 1</span>;
  if (weeks === 2) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Week 2</span>;
  if (weeks === 3) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Week 3</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Week {weeks}+</span>;
}

const TABS = [
  { key: 'item', label: 'Item Level Report', icon: Layers },
  { key: 'location', label: 'Stock by Location', icon: MapPin },
  { key: 'lot', label: 'Stock by Lot', icon: Package },
  { key: 'movements', label: 'Transfer History', icon: ArrowLeftRight },
  { key: 'reorder', label: 'Reorder Alerts', icon: AlertTriangle },
];

export default function SMSReports() {
  const [tab, setTab] = useState('item');
  const [stock, setStock] = useState([]);
  const [lots, setLots] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [reorderConfigs, setReorderConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [itemSearch, setItemSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      base44.entities.StoreStockBalance.list('-created_date', 1000),
      base44.entities.StoreLot.list('-created_date', 500),
      base44.entities.StoreTransfer.list('-created_date', 200),
      base44.entities.StoreReorderConfig.filter({ is_active: true }),
    ]).then(([s, l, t, r]) => {
      setStock(s); setLots(l); setTransfers(t); setReorderConfigs(r);
    }).finally(() => setLoading(false));
  }, []);

  // Derived data
  const byLocation = {};
  stock.forEach(s => {
    const key = s.location_code || s.location_id;
    if (!byLocation[key]) byLocation[key] = [];
    byLocation[key].push(s);
  });

  const stockByItem = {};
  stock.forEach(s => { stockByItem[s.item_code] = (stockByItem[s.item_code] || 0) + (s.quantity || 0); });

  const lowStock = reorderConfigs.filter(r => (stockByItem[r.item_code] || 0) <= r.reorder_level);

  if (loading) return (
    <div className="space-y-4">
      <div><div className="h-6 bg-slate-200 rounded w-40 animate-pulse mb-1" /><div className="h-4 bg-slate-100 rounded w-72 animate-pulse" /></div>
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">{[1,2,3,4,5].map(i => <div key={i} className="flex-1 h-9 bg-slate-200 rounded-lg animate-pulse" />)}</div>
      <SkeletonTable rows={6} cols={5} />
    </div>
  );

  // Item level report data
  const itemMap = {};
  stock.forEach(s => {
    if (!s.quantity || s.quantity <= 0) return;
    if (!itemMap[s.item_code]) itemMap[s.item_code] = { item_code: s.item_code, item_name: s.item_name, uom: s.uom, total: 0, entries: [] };
    itemMap[s.item_code].total += s.quantity;
    itemMap[s.item_code].entries.push(s);
  });
  const allItems = Object.values(itemMap);
  const allLocations = [...new Set(stock.map(s => s.location_code).filter(Boolean))].sort();
  const filteredItems = allItems
    .filter(i => !itemSearch || i.item_name?.toLowerCase().includes(itemSearch.toLowerCase()) || i.item_code?.toLowerCase().includes(itemSearch.toLowerCase()))
    .filter(i => !locationFilter || i.entries.some(e => e.location_code === locationFilter));

  const exportRows = filteredItems.flatMap(i =>
    i.entries
      .filter(e => !locationFilter || e.location_code === locationFilter)
      .map(e => ({
        'Item Code': i.item_code, 'Item Name': i.item_name, 'Unit': i.uom,
        'Location': e.location_code, 'Lot ID': e.lot_id,
        'Available Quantity': e.quantity, 'Expiry Date': e.expiry_date || '',
        'Putaway Date': e.putaway_date ? new Date(e.putaway_date).toLocaleDateString('en-IN') : '',
      }))
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Store Reports</h1>
        <p className="text-sm text-slate-500">Stock visibility, aging, movement history, and alerts</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 px-3 md:px-4 py-2.5 rounded-lg text-xs md:text-sm font-medium transition-all whitespace-nowrap shrink-0 ${tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
              <Icon className="w-4 h-4" /><span className="hidden sm:inline">{t.label}</span><span className="sm:hidden">{t.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Item Level Report */}
      {tab === 'item' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input className="pl-9 h-11 md:h-9 text-base md:text-sm" placeholder="Search item name or code..." value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
            </div>
            <select className="h-11 md:h-9 border border-slate-200 rounded-md px-3 text-base md:text-sm" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
              <option value="">All Locations</option>
              {allLocations.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <button
              onClick={() => exportToExcel(exportRows, 'item_level_stock_report')}
              className="flex items-center gap-2 h-9 px-4 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md"
            >
              <Download className="w-4 h-4" /> Export Excel
            </button>
          </div>
          <p className="text-xs text-slate-500">{filteredItems.length} item(s) · {exportRows.length} lot-location row(s)</p>
          {filteredItems.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/70 p-8 text-center text-slate-400">No stock data matches the filters</div>
          ) : filteredItems.map(item => {
            const visibleEntries = locationFilter ? item.entries.filter(e => e.location_code === locationFilter) : item.entries;
            return (
              <div key={item.item_code} className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/70 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{item.item_name}</p>
                    <p className="text-xs text-slate-400 font-mono">{item.item_code}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-blue-700">{item.total.toFixed(2)} <span className="text-xs font-normal text-slate-500">{item.uom}</span></p>
                    <p className="text-xs text-slate-400">Total Available</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-xs text-slate-600">
                        <th className="text-left px-4 py-2">Lot ID</th>
                        <th className="text-left px-4 py-2">Location</th>
                        <th className="text-right px-4 py-2">Available Quantity</th>
                        <th className="text-left px-4 py-2">Expiry Date</th>
                        <th className="text-left px-4 py-2">Stored On</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleEntries.map(e => (
                        <tr key={e.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-mono text-xs font-bold text-slate-700">{e.lot_id}</td>
                          <td className="px-4 py-2.5">
                            <span className="flex items-center gap-1 text-xs font-medium text-slate-700">
                              <MapPin className="w-3 h-3 text-slate-400" />{e.location_code}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-blue-700">{(e.quantity || 0).toFixed(2)} <span className="text-xs font-normal text-slate-400">{e.uom}</span></td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">{e.expiry_date || '—'}</td>
                          <td className="px-4 py-2.5 text-xs text-slate-400">{e.putaway_date ? new Date(e.putaway_date).toLocaleDateString('en-IN') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stock by Location */}
      {tab === 'location' && (
        <div className="space-y-3">
          {Object.entries(byLocation).length === 0 ? (
            <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/70 p-8 text-center text-slate-400">No stock data available</div>
          ) : Object.entries(byLocation).map(([locCode, entries]) => (
            <div key={locCode} className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/70 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                <p className="text-sm font-bold font-mono text-slate-800">{locCode}</p>
                <span className="ml-auto text-xs text-slate-500">{entries.length} lot(s)</span>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-slate-500 border-b"><th className="text-left px-4 py-2">Item</th><th className="text-left px-4 py-2">Lot ID</th><th className="text-right px-4 py-2">Quantity</th><th className="text-left px-4 py-2">Expiry</th><th className="text-left px-4 py-2">Stored At</th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {entries.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2"><p className="font-medium text-slate-800">{e.item_name}</p><p className="text-xs text-slate-400">{e.item_code}</p></td>
                      <td className="px-4 py-2 font-mono text-xs text-slate-600">{e.lot_id}</td>
                      <td className="px-4 py-2 text-right font-bold text-slate-800">{e.quantity} <span className="text-xs font-normal text-slate-400">{e.uom}</span></td>
                      <td className="px-4 py-2 text-slate-600 text-xs">{e.expiry_date || '—'}</td>
                      <td className="px-4 py-2 text-xs text-slate-400">{e.putaway_date ? new Date(e.putaway_date).toLocaleDateString('en-IN') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Stock by Lot */}
      {tab === 'lot' && (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/70 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-100 text-slate-700 text-xs"><th className="text-left px-4 py-3">Lot ID</th><th className="text-left px-4 py-3">Item</th><th className="text-left px-4 py-3">Supplier</th><th className="text-right px-4 py-3">Original Qty</th><th className="text-right px-4 py-3">Remaining</th><th className="text-left px-4 py-3">Manufacture</th><th className="text-left px-4 py-3">Expiry</th><th className="text-left px-4 py-3">Aging</th><th className="text-left px-4 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {lots.map(lot => (
                  <tr key={lot.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-800">{lot.lot_id}</td>
                    <td className="px-4 py-3"><p className="font-medium text-slate-800">{lot.item_name}</p><p className="text-xs text-slate-400">{lot.item_code}</p></td>
                    <td className="px-4 py-3 text-slate-600">{lot.supplier_name || '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">{lot.quantity} {lot.uom}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{lot.remaining_quantity ?? lot.quantity} {lot.uom}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{lot.mfg_date || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{lot.expiry_date || '—'}</td>
                    <td className="px-4 py-3"><WeekBadge weeks={lot.weeks_elapsed} /></td>
                    <td className="px-4 py-3"><span className="text-xs capitalize">{lot.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transfer History */}
      {tab === 'movements' && (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/70 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-100 text-slate-700 text-xs"><th className="text-left px-4 py-3">Transfer ID</th><th className="text-left px-4 py-3">Item / Lot</th><th className="text-left px-4 py-3">From</th><th className="text-left px-4 py-3">To</th><th className="text-right px-4 py-3">Quantity</th><th className="text-left px-4 py-3">Reason</th><th className="text-left px-4 py-3">By / At</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {transfers.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-400">No transfers yet</td></tr>
                ) : transfers.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-bold">{t.transfer_id}</td>
                    <td className="px-4 py-3"><p className="font-medium text-slate-800">{t.item_name}</p><p className="text-xs text-slate-400">{t.lot_id}</p></td>
                    <td className="px-4 py-3 font-mono text-xs">{t.from_location_code}</td>
                    <td className="px-4 py-3 font-mono text-xs">{t.to_location_code}</td>
                    <td className="px-4 py-3 text-right font-bold">{t.quantity} {t.uom}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{t.reason || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500"><p>{t.transferred_by}</p><p>{t.transferred_at ? new Date(t.transferred_at).toLocaleDateString('en-IN') : ''}</p></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reorder Alerts */}
      {tab === 'reorder' && (
        <div className="space-y-3">
          {lowStock.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center text-green-600 font-medium">All items are above reorder levels ✓</div>
          ) : lowStock.map(r => (
            <div key={r.item_code} className="bg-white/80 backdrop-blur-sm rounded-xl border border-red-200/70 shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div><p className="font-semibold text-slate-800">{r.item_name || r.item_code}</p><p className="text-xs text-slate-500">Code: {r.item_code} · Unit: {r.uom}</p></div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-red-600">{stockByItem[r.item_code] || 0} <span className="text-sm font-normal">{r.uom}</span></p>
                  <p className="text-xs text-slate-400">Reorder at: {r.reorder_level} {r.uom}</p>
                  {r.reorder_quantity && <p className="text-xs text-blue-600">Suggest order: {r.reorder_quantity} {r.uom}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}