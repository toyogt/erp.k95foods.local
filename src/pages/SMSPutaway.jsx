import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Package } from 'lucide-react';
import ExportButton from '@/components/store/ExportButton';
import PutawayPanel from '@/components/store/PutawayPanel';

export default function SMSPutaway() {
  const [pendingLots, setPendingLots] = useState([]);
  const [locations, setLocations] = useState([]);
  const [putawayHistory, setPutawayHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [lots, locs, history] = await Promise.all([
      base44.entities.StoreLot.filter({ status: 'approved' }),
      base44.entities.StoreLocation.filter({ is_active: true }),
      base44.entities.StorePutaway.list('-created_date', 50),
    ]);
    setPendingLots(lots);
    setLocations(locs);
    setPutawayHistory(history);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const exportColumns = [
    { key: 'putaway_id', label: 'Putaway ID' },
    { key: 'lot_id', label: 'Lot ID' },
    { key: 'item_name', label: 'Item' },
    { key: 'location_code', label: 'Location' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'uom', label: 'Unit' },
    { key: 'putaway_by', label: 'Done By' },
    { key: 'putaway_at', label: 'Date' },
  ];

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Putaway</h1>
          <p className="text-sm text-slate-500">Store approved stock into locations — scan QR or select manually</p>
        </div>
        <ExportButton data={putawayHistory} columns={exportColumns} filename="putaway_history" />
      </div>

      {!loading && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center gap-3">
          <Package className="w-5 h-5 text-blue-500 shrink-0" />
          <p className="text-sm text-blue-700">
            <strong>{pendingLots.length}</strong> approved lot(s) awaiting putaway
          </p>
        </div>
      )}

      {/* Core Putaway Panel — supports both Scan and Manual modes */}
      {!loading && (
        <PutawayPanel
          lots={pendingLots}
          locations={locations}
          onSuccess={load}
        />
      )}

      {/* Pending lots quick-list */}
      {pendingLots.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50">
            <p className="text-sm font-semibold text-slate-700">Approved Lots — Pending Putaway</p>
          </div>
          <div className="divide-y divide-slate-100">
            {pendingLots.map(lot => (
              <div key={lot.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">{lot.lot_id}</p>
                  <p className="text-xs text-slate-500">{lot.item_name} · {lot.supplier_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-800">{lot.remaining_quantity ?? lot.quantity} {lot.uom}</p>
                  <p className="text-xs text-green-600">Ready for putaway</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent history */}
      {putawayHistory.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50">
            <p className="text-sm font-semibold text-slate-700">Recent Putaway History</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 text-xs text-slate-600">
                  <th className="text-left px-4 py-2">Lot</th>
                  <th className="text-left px-4 py-2">Item</th>
                  <th className="text-left px-4 py-2">Location</th>
                  <th className="text-right px-4 py-2">Quantity</th>
                  <th className="text-left px-4 py-2">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {putawayHistory.slice(0, 10).map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-slate-700">{p.lot_id}</td>
                    <td className="px-4 py-2.5 text-slate-800">{p.item_name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{p.location_code}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-800">{p.quantity} {p.uom}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{p.putaway_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}