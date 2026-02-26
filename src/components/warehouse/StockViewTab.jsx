import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';

export default function StockViewTab({ products }) {
  const [serialStock, setSerialStock] = useState([]);
  const [legacyStock, setLegacyStock] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterItem, setFilterItem] = useState('');
  const [filterBatch, setFilterBatch] = useState('');
  const [filterLoc, setFilterLoc] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => { loadStock(); }, []);

  async function loadStock() {
    setLoading(true);
    const query = { status: 'IN_STOCK' };
    if (filterItem) query.item_code = filterItem;
    if (filterBatch) query.batch_no = filterBatch;
    if (filterLoc) query.current_location = filterLoc;

    const [boxes, legacyLots] = await Promise.all([
      base44.entities.BoxLabel.filter(query, 'item_code', 500),
      base44.entities.LegacyStockLot.filter({}, 'item_code', 200),
    ]);

    // Aggregate serialized stock
    const agg = {};
    for (const b of boxes) {
      const key = `${b.item_code}|${b.batch_no}|${b.current_location}`;
      if (!agg[key]) agg[key] = { item_code: b.item_code, batch_no: b.batch_no, location: b.current_location, count: 0, type: 'serialized' };
      agg[key].count++;
    }
    const aggArr = Object.values(agg);

    // Apply client-side filters for legacy
    const filteredLegacy = legacyLots.filter(l => {
      if (l.qty_boxes <= 0) return false;
      if (filterItem && l.item_code !== filterItem) return false;
      if (filterBatch && !l.batch_no?.toLowerCase().includes(filterBatch.toLowerCase())) return false;
      if (filterLoc && l.current_location !== filterLoc) return false;
      return true;
    });

    setSerialStock(aggArr);
    setLegacyStock(filteredLegacy);
    setLoading(false);
    setPage(0);
  }

  const allRows = [
    ...serialStock.map(r => ({ ...r, type: 'serialized', qty: r.count })),
    ...legacyStock.map(r => ({ item_code: r.item_code, batch_no: r.batch_no, location: r.current_location, qty: r.qty_boxes, type: 'legacy', exp_date: r.exp_date })),
  ].sort((a, b) => (a.item_code || '').localeCompare(b.item_code || ''));

  const pageRows = allRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(allRows.length / PAGE_SIZE);

  const totalSerial = serialStock.reduce((s, r) => s + r.count, 0);
  const totalLegacy = legacyStock.reduce((s, r) => s + r.qty_boxes, 0);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Product</label>
          <select className="h-9 px-3 text-sm rounded-xl border border-slate-300 focus:outline-none"
            value={filterItem} onChange={e => setFilterItem(e.target.value)}>
            <option value="">All</option>
            {products.map(p => <option key={p.item_code} value={p.item_code}>{p.item_code} – {p.product_name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Batch</label>
          <input className="h-9 px-3 text-sm rounded-xl border border-slate-300 focus:outline-none"
            placeholder="Filter…" value={filterBatch} onChange={e => setFilterBatch(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Location</label>
          <input className="h-9 px-3 text-sm rounded-xl border border-slate-300 focus:outline-none"
            placeholder="Filter…" value={filterLoc} onChange={e => setFilterLoc(e.target.value)} />
        </div>
        <Button onClick={loadStock} disabled={loading} className="gap-2 h-9">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RefreshCw className="w-4 h-4" /> Apply</>}
        </Button>
      </div>

      {/* Summary chips */}
      <div className="flex gap-3 flex-wrap">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
          <p className="text-xs text-emerald-600 font-semibold">Serialized IN_STOCK</p>
          <p className="text-xl font-black text-emerald-800">{totalSerial.toLocaleString()} boxes</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2">
          <p className="text-xs text-blue-600 font-semibold">Legacy Stock</p>
          <p className="text-xl font-black text-blue-800">{totalLegacy.toLocaleString()} boxes</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2">
          <p className="text-xs text-slate-500 font-semibold">Total</p>
          <p className="text-xl font-black text-slate-800">{(totalSerial + totalLegacy).toLocaleString()} boxes</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-xs text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Item Code</th>
                <th className="text-left px-4 py-3">Batch</th>
                <th className="text-left px-4 py-3">Location</th>
                <th className="text-right px-4 py-3">Boxes</th>
                <th className="text-left px-4 py-3">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-800">{row.item_code || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{row.batch_no || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{row.location || '—'}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">{row.qty?.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${row.type === 'serialized' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                      {row.type}
                    </span>
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400 text-sm">No stock found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-xs text-slate-500">{allRows.length} rows · Page {page + 1}/{totalPages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Prev</Button>
              <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}