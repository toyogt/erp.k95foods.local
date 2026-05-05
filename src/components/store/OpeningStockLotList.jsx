import { Package, MapPin, CalendarDays, Hash, Layers } from 'lucide-react';

function formatDate(iso) {
  if (!iso) return '—';
  // Handle stored DD/MM/YYYY passthrough
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

export default function OpeningStockLotList({ lots }) {
  if (!lots || lots.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400 text-sm">
        No lots added yet. Click <strong>Add Lot</strong> to record opening stock batches.
      </div>
    );
  }

  // Sort by FIFO rank
  const sorted = [...lots].sort((a, b) => (a.fifo_rank || 99) - (b.fifo_rank || 99));

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
        <Layers className="w-3.5 h-3.5" /> {lots.length} lot{lots.length !== 1 ? 's' : ''} — FIFO order (oldest first)
      </p>
      {sorted.map((lot, idx) => (
        <div key={lot.id} className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-teal-700">#{idx + 1}</span>
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-800">
                  {lot.quantity} <span className="font-normal text-slate-500">{lot.uom}</span>
                </span>
                {lot.batch_number && (
                  <span className="flex items-center gap-1 text-xs text-slate-500 font-mono">
                    <Hash className="w-3 h-3" />{lot.batch_number}
                  </span>
                )}
                <StatusBadge status={lot.status} />
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                {lot.location_code && (
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{lot.location_code}</span>
                )}
                {lot.mfg_date && (
                  <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />Mfg: {formatDate(lot.mfg_date)}</span>
                )}
                {lot.expiry_date && (
                  <span className="flex items-center gap-1 text-amber-600"><CalendarDays className="w-3 h-3" />Exp: {formatDate(lot.expiry_date)}</span>
                )}
                {lot.supplier_name && (
                  <span className="flex items-center gap-1"><Package className="w-3 h-3" />{lot.supplier_name}</span>
                )}
              </div>
              {lot.lot_id && (
                <p className="text-xs text-slate-400 font-mono">{lot.lot_id}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}