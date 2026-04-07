import { useState } from 'react';
import { Clock, ListChecks } from 'lucide-react';

export default function PutawayTabs({ pendingLots, putawayHistory }) {
  const [tab, setTab] = useState('pending');

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-slate-200 mb-4">
        {[
          { id: 'pending', label: `Approved Lots — Pending (${pendingLots.length})`, icon: Clock },
          { id: 'history', label: `Recent Putaway History (${putawayHistory.length})`, icon: ListChecks },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {/* Pending Lots Tab */}
      {tab === 'pending' && (
        pendingLots.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No approved lots pending putaway.</p>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-xs">
                    <th className="text-left px-4 py-3 font-medium">Lot ID</th>
                    <th className="text-left px-4 py-3 font-medium">Item Name</th>
                    <th className="text-left px-4 py-3 font-medium">Supplier</th>
                    <th className="text-right px-4 py-3 font-medium">Quantity</th>
                    <th className="text-left px-4 py-3 font-medium">Unit</th>
                    <th className="text-left px-4 py-3 font-medium">Created Date</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingLots.map(lot => (
                    <tr key={lot.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-sm font-bold text-slate-800">{lot.lot_id}</td>
                      <td className="px-4 py-3 text-slate-800">{lot.item_name}</td>
                      <td className="px-4 py-3 text-slate-600">{lot.supplier_name || '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{lot.remaining_quantity ?? lot.quantity}</td>
                      <td className="px-4 py-3 text-slate-600">{lot.uom}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {lot.created_date ? new Date(lot.created_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Ready for putaway</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* History Tab */}
      {tab === 'history' && (
        putawayHistory.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No putaway history yet.</p>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-xs">
                    <th className="text-left px-4 py-3 font-medium">Lot</th>
                    <th className="text-left px-4 py-3 font-medium">Item</th>
                    <th className="text-left px-4 py-3 font-medium">Location</th>
                    <th className="text-right px-4 py-3 font-medium">Quantity</th>
                    <th className="text-left px-4 py-3 font-medium">Unit</th>
                    <th className="text-left px-4 py-3 font-medium">Done By</th>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {putawayHistory.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-sm font-bold text-slate-700">{p.lot_id}</td>
                      <td className="px-4 py-3 text-slate-800">{p.item_name}</td>
                      <td className="px-4 py-3 font-mono text-sm text-slate-600">{p.location_code}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{p.quantity}</td>
                      <td className="px-4 py-3 text-slate-600">{p.uom}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{p.putaway_by}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {p.putaway_at ? new Date(p.putaway_at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}