export default function TransferHistory({ transfers }) {
  if (!transfers || transfers.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">No transfer history yet.</p>;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-700 text-xs">
              <th className="text-left px-4 py-3 font-medium">Transfer ID</th>
              <th className="text-left px-4 py-3 font-medium">Item</th>
              <th className="text-left px-4 py-3 font-medium">Lot</th>
              <th className="text-left px-4 py-3 font-medium">From</th>
              <th className="text-left px-4 py-3 font-medium">To</th>
              <th className="text-right px-4 py-3 font-medium">Quantity</th>
              <th className="text-left px-4 py-3 font-medium">Reason</th>
              <th className="text-left px-4 py-3 font-medium">Transferred By</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transfers.map(t => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-sm font-bold text-slate-800">{t.transfer_id}</td>
                <td className="px-4 py-3 text-slate-700">{t.item_name || '—'}</td>
                <td className="px-4 py-3 font-mono text-sm text-slate-600">{t.lot_id || '—'}</td>
                <td className="px-4 py-3 font-mono text-sm text-slate-600">{t.from_location_code || '—'}</td>
                <td className="px-4 py-3 font-mono text-sm text-slate-600">{t.to_location_code || '—'}</td>
                <td className="px-4 py-3 text-right font-bold text-slate-800">{t.quantity} {t.uom}</td>
                <td className="px-4 py-3 text-sm text-slate-500 max-w-xs truncate">{t.reason || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{t.transferred_by || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  {t.transferred_at ? new Date(t.transferred_at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}