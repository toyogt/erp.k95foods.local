import { Layers } from 'lucide-react';

function formatDate(iso) {
  if (!iso) return '—';
  if (iso.includes('/')) return iso;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function StatusBadge({ status }) {
  const cfg = {
    posted: 'bg-green-100 text-green-700',
    pending: 'bg-amber-100 text-amber-700',
    locked: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg[status] || cfg.pending}`}>
      {status === 'posted' ? 'In Stock' : status === 'locked' ? 'Locked' : 'Pending'}
    </span>
  );
}

export default function OpeningStockLotsSubTable({ lots }) {
  if (!lots || lots.length === 0) {
    return (
      <div className="text-center py-6 text-slate-400 text-sm">
        No lots added yet. Click <strong>Add Lot</strong> to record opening stock batches.
      </div>
    );
  }

  const sorted = [...lots].sort((a, b) => (a.fifo_rank || 99) - (b.fifo_rank || 99));

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
        <Layers className="w-3.5 h-3.5" /> {lots.length} lot{lots.length !== 1 ? 's' : ''} — FIFO order (oldest first)
      </p>
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-600">
              <th className="px-2.5 py-2 text-center font-semibold w-10">#</th>
              <th className="px-2.5 py-2 text-right font-semibold">Quantity</th>
              <th className="px-2.5 py-2 text-left font-semibold">Batch Number</th>
              <th className="px-2.5 py-2 text-left font-semibold">Location</th>
              <th className="px-2.5 py-2 text-left font-semibold">Manufacture Date</th>
              <th className="px-2.5 py-2 text-left font-semibold">Expiry Date</th>
              <th className="px-2.5 py-2 text-left font-semibold">Supplier</th>
              <th className="px-2.5 py-2 text-center font-semibold">Status</th>
              <th className="px-2.5 py-2 text-left font-semibold">Lot ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((lot, idx) => (
              <tr key={lot.id} className="hover:bg-slate-50/50">
                <td className="px-2.5 py-2 text-center">
                  <span className="w-5 h-5 inline-flex items-center justify-center rounded bg-teal-50 border border-teal-200 text-teal-700 font-bold text-xs">
                    {idx + 1}
                  </span>
                </td>
                <td className="px-2.5 py-2 text-right font-bold text-slate-800">
                  {lot.quantity} <span className="font-normal text-slate-500">{lot.uom}</span>
                </td>
                <td className="px-2.5 py-2 font-mono text-slate-600">{lot.batch_number || '—'}</td>
                <td className="px-2.5 py-2 text-slate-600">{lot.location_code || '—'}</td>
                <td className="px-2.5 py-2 text-slate-600">{formatDate(lot.mfg_date)}</td>
                <td className="px-2.5 py-2 text-slate-600">{formatDate(lot.expiry_date)}</td>
                <td className="px-2.5 py-2 text-slate-600">{lot.supplier_name || '—'}</td>
                <td className="px-2.5 py-2 text-center"><StatusBadge status={lot.status} /></td>
                <td className="px-2.5 py-2 font-mono text-slate-400">{lot.lot_id || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}