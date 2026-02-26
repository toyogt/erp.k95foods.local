import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = key(item);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

function exportCSV(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

export default function BoxStockDashboard() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [byProduct, setByProduct] = useState([]);
  const [byLocation, setByLocation] = useState([]);
  const [recentMovements, setRecentMovements] = useState([]);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [serialBoxes, legacyLots, legacyMoves, recentLabels] = await Promise.all([
      base44.entities.BoxLabel.filter({ status: 'IN_STOCK' }, 'item_code', 1000),
      base44.entities.LegacyStockLot.filter({}, 'item_code', 500),
      base44.entities.LegacyStockMove.list('-moved_at', 30),
      base44.entities.BoxLabel.filter({}, '-updated_date', 50),
    ]);

    // --- By Product + Batch ---
    const productAgg = {};
    for (const b of serialBoxes) {
      const key = `${b.item_code}||${b.batch_no}`;
      if (!productAgg[key]) productAgg[key] = { item_code: b.item_code, batch_no: b.batch_no, serialized_qty: 0, legacy_qty: 0 };
      productAgg[key].serialized_qty++;
    }
    for (const l of legacyLots) {
      if (l.qty_boxes <= 0) continue;
      const key = `${l.item_code}||${l.batch_no}`;
      if (!productAgg[key]) productAgg[key] = { item_code: l.item_code, batch_no: l.batch_no, serialized_qty: 0, legacy_qty: 0 };
      productAgg[key].legacy_qty += l.qty_boxes;
    }
    const byProd = Object.values(productAgg).map(r => ({ ...r, total: r.serialized_qty + r.legacy_qty }))
      .sort((a, b) => b.total - a.total);
    setByProduct(byProd);

    // --- By Location ---
    const locAgg = {};
    for (const b of serialBoxes) {
      const loc = b.current_location || 'Unknown';
      if (!locAgg[loc]) locAgg[loc] = { location: loc, serialized_qty: 0, legacy_qty: 0 };
      locAgg[loc].serialized_qty++;
    }
    for (const l of legacyLots) {
      if (l.qty_boxes <= 0) continue;
      const loc = l.current_location || 'Unknown';
      if (!locAgg[loc]) locAgg[loc] = { location: loc, serialized_qty: 0, legacy_qty: 0 };
      locAgg[loc].legacy_qty += l.qty_boxes;
    }
    const byLoc = Object.values(locAgg).map(r => ({ ...r, total: r.serialized_qty + r.legacy_qty }))
      .sort((a, b) => b.total - a.total);
    setByLocation(byLoc);

    // --- Recent Movements ---
    const moves = [
      ...recentLabels.map(l => ({
        time: l.updated_date,
        type: 'serialized',
        box_serial: l.box_serial,
        item_code: l.item_code || '',
        batch_no: l.batch_no || '',
        location: l.current_location || '',
        status: l.status,
        ref: '',
      })),
      ...legacyMoves.map(m => ({
        time: m.moved_at,
        type: 'legacy',
        box_serial: '',
        item_code: m.item_code || '',
        batch_no: m.batch_no || '',
        location: '',
        status: m.direction,
        ref: m.reference_doc_no || '',
      })),
    ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 50);
    setRecentMovements(moves);

    setLoading(false);
  }

  const TABS = ['By Product', 'By Location', 'Recent Movements'];

  const totalSerial = byProduct.reduce((s, r) => s + r.serialized_qty, 0);
  const totalLegacy = byProduct.reduce((s, r) => s + r.legacy_qty, 0);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Box Stock Dashboard</h2>
          <p className="text-sm text-slate-500">Live stock view across all SKUs and locations.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Summary chips */}
      <div className="flex gap-3 flex-wrap">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <p className="text-xs text-emerald-600 font-semibold uppercase">Serialized IN_STOCK</p>
          <p className="text-2xl font-black text-emerald-800">{totalSerial.toLocaleString()}</p>
          <p className="text-xs text-emerald-600">boxes</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <p className="text-xs text-blue-600 font-semibold uppercase">Legacy Stock</p>
          <p className="text-2xl font-black text-blue-800">{totalLegacy.toLocaleString()}</p>
          <p className="text-xs text-blue-600">boxes</p>
        </div>
        <div className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-3">
          <p className="text-xs text-slate-500 font-semibold uppercase">Total</p>
          <p className="text-2xl font-black text-slate-900">{(totalSerial + totalLegacy).toLocaleString()}</p>
          <p className="text-xs text-slate-500">boxes</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <p className="text-xs text-slate-500 font-semibold uppercase">SKUs</p>
          <p className="text-2xl font-black text-slate-900">{new Set(byProduct.map(r => r.item_code)).size}</p>
          <p className="text-xs text-slate-500">in stock</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {TABS.map((label, i) => (
          <button key={i} onClick={() => setActiveTab(i)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === i ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* By Product */}
      {activeTab === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
            <p className="text-sm font-semibold text-slate-700">Stock by Product & Batch ({byProduct.length} groups)</p>
            <Button size="sm" variant="outline" onClick={() => exportCSV(byProduct, 'stock_by_product.csv')} className="gap-1">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                  <th className="text-left px-4 py-3">Item Code</th>
                  <th className="text-left px-4 py-3">Batch</th>
                  <th className="text-right px-4 py-3">Serialized</th>
                  <th className="text-right px-4 py-3">Legacy</th>
                  <th className="text-right px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {byProduct.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-800">{row.item_code || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{row.batch_no || '—'}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{row.serialized_qty.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-blue-700">{row.legacy_qty.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{row.total.toLocaleString()}</td>
                  </tr>
                ))}
                {byProduct.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No stock found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* By Location */}
      {activeTab === 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
            <p className="text-sm font-semibold text-slate-700">Stock by Location ({byLocation.length} locations)</p>
            <Button size="sm" variant="outline" onClick={() => exportCSV(byLocation, 'stock_by_location.csv')} className="gap-1">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                  <th className="text-left px-4 py-3">Location</th>
                  <th className="text-right px-4 py-3">Serialized</th>
                  <th className="text-right px-4 py-3">Legacy</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-left px-4 py-3">Visual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {byLocation.map((row, i) => {
                  const maxTotal = Math.max(...byLocation.map(r => r.total), 1);
                  const pct = Math.round((row.total / maxTotal) * 100);
                  return (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-800">{row.location}</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{row.serialized_qty.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-blue-700">{row.legacy_qty.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">{row.total.toLocaleString()}</td>
                      <td className="px-4 py-3 w-32">
                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-700 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {byLocation.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No data.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Movements */}
      {activeTab === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
            <p className="text-sm font-semibold text-slate-700">Recent Movements (last 50)</p>
            <Button size="sm" variant="outline" onClick={() => exportCSV(recentMovements, 'recent_movements.csv')} className="gap-1">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                  <th className="text-left px-4 py-3">Time</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Item / Serial</th>
                  <th className="text-left px-4 py-3">Batch</th>
                  <th className="text-left px-4 py-3">Status / Dir</th>
                  <th className="text-left px-4 py-3">Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentMovements.map((m, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500 text-xs">{m.time ? new Date(m.time).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.type === 'serialized' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                        {m.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{m.box_serial || m.item_code}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{m.batch_no || '—'}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-800">{m.status}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{m.ref || '—'}</td>
                  </tr>
                ))}
                {recentMovements.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No movements yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}