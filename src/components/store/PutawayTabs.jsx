import { useState } from 'react';
import { Clock, ListChecks } from 'lucide-react';
import { SkeletonTable } from '@/components/store/StoreSkeleton';
import PutawayHistoryCards from '@/components/store/PutawayHistoryCards';
import TablePagination from '@/components/store/TablePagination';
import { formatDateTime } from '@/lib/dateFormatter';

export default function PutawayTabs({ pendingLots, putawayHistory, loading }) {
  const [tab, setTab] = useState('pending');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-slate-200 mb-4 overflow-x-auto">
        {[
          { id: 'pending', label: `Pending (${pendingLots.length})`, fullLabel: `Approved Lots — Pending (${pendingLots.length})`, icon: Clock },
          { id: 'history', label: `History (${putawayHistory.length})`, fullLabel: `Recent Putaway History (${putawayHistory.length})`, icon: ListChecks },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              tab === t.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="w-4 h-4" /><span className="hidden sm:inline">{t.fullLabel}</span><span className="sm:hidden">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Pending Lots Tab */}
      {tab === 'pending' && (
        loading ? (
          <SkeletonTable rows={5} cols={7} headers={['Lot ID', 'Item Name', 'Supplier', 'Quantity', 'Unit', 'Created Date', 'Status']} />
        ) : pendingLots.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No approved lots pending putaway.</p>
        ) : (
          <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white/50 backdrop-blur-xl border border-white/30 rounded-[28px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
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
                  {pendingLots.slice((page - 1) * pageSize, page * pageSize).map(lot => (
                    <tr key={lot.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-sm font-bold text-slate-800">{lot.lot_id}</td>
                      <td className="px-4 py-3 text-slate-800">{lot.item_name}</td>
                      <td className="px-4 py-3 text-slate-600">{lot.supplier_name || '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{lot.remaining_quantity ?? lot.quantity}</td>
                      <td className="px-4 py-3 text-slate-600">{lot.uom}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {formatDateTime(lot.created_date)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Ready for putaway</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination total={pendingLots.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </div>
          {/* Mobile Cards */}
          <div className="md:hidden space-y-2">
            {pendingLots.slice((page - 1) * pageSize, page * pageSize).map(lot => (
              <div key={lot.id} className="bg-white border border-slate-200 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-bold text-slate-500">{lot.lot_id}</p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">{lot.item_name}</p>
                    {lot.supplier_name && <p className="text-xs text-slate-500">{lot.supplier_name}</p>}
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 shrink-0">Ready</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                  <span>Quantity: <strong className="text-slate-700">{lot.remaining_quantity ?? lot.quantity} {lot.uom}</strong></span>
                  {lot.created_date && <span>{formatDateTime(lot.created_date)}</span>}
                </div>
              </div>
            ))}
          </div>
          </>
        )
      )}

      {/* History Tab */}
      {tab === 'history' && (
        loading ? (
          <SkeletonTable rows={5} cols={7} headers={['Lot', 'Item', 'Location', 'Quantity', 'Unit', 'Done By', 'Date']} />
        ) : (
          <PutawayHistoryCards history={putawayHistory} />
        )
      )}
    </div>
  );
}