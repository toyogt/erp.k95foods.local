function formatDate(iso) {
  if (!iso) return '—';
  if (iso.includes('/')) return iso;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

const STATUS_STYLES = {
  posted: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  locked: 'bg-slate-100 text-slate-500',
};

const STATUS_LABELS = {
  posted: 'In Stock',
  pending: 'Pending',
  locked: 'Locked',
};

export default function OpeningStockLotsSubTable({ lots }) {
  if (!lots || lots.length === 0) return null;

  const sorted = [...lots].sort((a, b) => (a.fifo_rank || 99) - (b.fifo_rank || 99));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-100/80 text-slate-600">
            <th className="text-left px-3 py-2 font-semibold">FIFO #</th>
            <th className="text-left px-3 py-2 font-semibold">Batch Number</th>
            <th className="text-right px-3 py-2 font-semibold">Quantity</th>
            <th className="text-left px-3 py-2 font-semibold">Location</th>
            <th className="text-left px-3 py-2 font-semibold">Manufacture Date</th>
            <th className="text-left px-3 py-2 font-semibold">Expiry Date</th>
            <th className="text-left px-3 py-2 font-semibold">Supplier</th>
            <th className="text-left px-3 py-2 font-semibold">Lot ID</th>
            <th className="text-left px-3 py-2 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((lot, idx) => (
            <tr key={lot.id} className="hover:bg-white/80">
              <td className="px-3 py-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-teal-50 border border-teal-200 text-teal-700 font-bold text-xs">
                  {idx + 1}
                </span>
              </td>
              <td className="px-3 py-2 font-mono text-slate-700">{lot.batch_number || '—'}</td>
              <td className="px-3 py-2 text-right font-semibold text-slate-800">
                {lot.quantity} <span className="font-normal text-slate-500">{lot.uom}</span>
              </td>
              <td className="px-3 py-2 text-slate-600">{lot.location_code || '—'}</td>
              <td className="px-3 py-2 text-slate-600">{formatDate(lot.mfg_date)}</td>
              <td className="px-3 py-2">
                <span className={lot.expiry_date ? 'text-amber-700 font-medium' : 'text-slate-400'}>
                  {formatDate(lot.expiry_date)}
                </span>
              </td>
              <td className="px-3 py-2 text-slate-600">{lot.supplier_name || '—'}</td>
              <td className="px-3 py-2 font-mono text-slate-400">{lot.lot_id || '—'}</td>
              <td className="px-3 py-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[lot.status] || STATUS_STYLES.pending}`}>
                  {STATUS_LABELS[lot.status] || 'Pending'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}