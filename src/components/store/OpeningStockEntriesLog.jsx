import { useState } from 'react';
import { Input } from '@/components/ui/input';
import TablePagination from '@/components/store/TablePagination';
import { Search } from 'lucide-react';

function formatDate(iso) {
  if (!iso) return '—';
  if (iso.includes('/')) return iso;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function StatusBadge({ status }) {
  const cfg = {
    posted: 'bg-green-100 text-green-700',
    pending: 'bg-amber-100 text-amber-700',
    locked: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg[status] || cfg.pending}`}>
      {status === 'posted' ? 'Posted' : status === 'locked' ? 'Locked' : 'Pending'}
    </span>
  );
}

export default function OpeningStockEntriesLog({ entries }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const sorted = [...entries].sort((a, b) => {
    const da = a.posted_at || a.created_date || '';
    const db = b.posted_at || b.created_date || '';
    return db.localeCompare(da);
  });

  const filtered = sorted.filter(e => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.item_name?.toLowerCase().includes(q) ||
      e.item_code?.toLowerCase().includes(q) ||
      e.entry_id?.toLowerCase().includes(q) ||
      e.batch_number?.toLowerCase().includes(q) ||
      e.lot_id?.toLowerCase().includes(q) ||
      e.location_code?.toLowerCase().includes(q) ||
      e.supplier_name?.toLowerCase().includes(q)
    );
  });

  const total = filtered.length;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <Input
          className="pl-9 h-9 text-sm"
          placeholder="Search entries…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-xs">
                <th className="px-3 py-2.5 text-left font-semibold">Entry ID</th>
                <th className="px-3 py-2.5 text-left font-semibold">Item Code</th>
                <th className="px-3 py-2.5 text-left font-semibold min-w-[180px]">Item Name</th>
                <th className="px-3 py-2.5 text-left font-semibold">Batch Number</th>
                <th className="px-3 py-2.5 text-right font-semibold">Quantity</th>
                <th className="px-3 py-2.5 text-left font-semibold">UOM</th>
                <th className="px-3 py-2.5 text-left font-semibold">Location</th>
                <th className="px-3 py-2.5 text-left font-semibold">Manufacture Date</th>
                <th className="px-3 py-2.5 text-left font-semibold">Expiry Date</th>
                <th className="px-3 py-2.5 text-left font-semibold">Supplier</th>
                <th className="px-3 py-2.5 text-center font-semibold">FIFO Rank</th>
                <th className="px-3 py-2.5 text-center font-semibold">Status</th>
                <th className="px-3 py-2.5 text-left font-semibold">Posted At</th>
                <th className="px-3 py-2.5 text-left font-semibold">Entered By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.map(entry => (
                <tr key={entry.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-mono text-xs text-teal-700 whitespace-nowrap">{entry.entry_id}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{entry.item_code}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-900">{entry.item_name}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{entry.batch_number || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-slate-800">{entry.quantity}</td>
                  <td className="px-3 py-2.5 text-slate-600">{entry.uom || 'Nos'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{entry.location_code || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{formatDate(entry.mfg_date)}</td>
                  <td className="px-3 py-2.5 text-slate-600">{formatDate(entry.expiry_date)}</td>
                  <td className="px-3 py-2.5 text-slate-600">{entry.supplier_name || '—'}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="text-xs font-bold text-slate-500">#{entry.fifo_rank || '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <StatusBadge status={entry.status} />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{formatDateTime(entry.posted_at)}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{entry.entered_by || entry.created_by || '—'}</td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-3 py-12 text-center text-slate-400 text-sm">
                    {search ? 'No entries match your search.' : 'No opening stock entries recorded yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
}