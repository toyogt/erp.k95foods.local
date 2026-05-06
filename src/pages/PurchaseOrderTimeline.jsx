import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search, Eye } from 'lucide-react';
import { PO_STATUS_COLOR, formatDateDDMMYYYY, formatINR } from '@/components/purchase/purchaseHelpers';
import TablePagination from '@/components/store/TablePagination';
import { Link } from 'react-router-dom';

export default function PurchaseOrderTimeline() {
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => { base44.auth.me().then(u => setUser(u)).catch(() => {}); }, []);

  const urlParams = new URLSearchParams(window.location.search);
  const selectedPoId = urlParams.get('po');

  const { data: pos = [], isLoading } = useQuery({
    queryKey: ['po-timeline'], queryFn: () => base44.entities.PurchaseOrder.list('-created_date', 500),
    staleTime: 30000, enabled: !!user,
  });

  const { data: poItems = [] } = useQuery({
    queryKey: ['po-items-all'], queryFn: () => base44.entities.PurchaseOrderItem.list('-created_date', 2000).catch(() => []),
    staleTime: 30000, enabled: !!user,
  });

  const { data: grnItems = [] } = useQuery({
    queryKey: ['grn-items-all'], queryFn: () => base44.entities.GRNItem.list('-created_date', 2000).catch(() => []),
    staleTime: 30000, enabled: !!user,
  });

  const filtered = pos.filter(po => {
    if (!search) return true;
    const q = search.toLowerCase();
    return po.po_id?.toLowerCase().includes(q) || po.supplier_name?.toLowerCase().includes(q);
  });

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  function getPoStats(poId) {
    const items = poItems.filter(i => i.po_id === poId);
    const totalOrdered = items.reduce((s, i) => s + (i.qty || i.quantity || 0), 0);
    const received = grnItems.filter(g => g.po_id === poId).reduce((s, g) => s + (g.received_qty || 0), 0);
    return { itemCount: items.length, ordered: totalOrdered, received, pending: Math.max(0, totalOrdered - received) };
  }

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Purchase Order Master</h1>
        <p className="text-sm text-slate-500">Track orders, deliveries, and quantities</p>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="w-full border border-slate-200 rounded-xl pl-10 pr-4 h-11 text-sm bg-white"
          placeholder="Search by PO number or supplier..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-100 text-slate-700 text-xs">
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Purchase Order</th>
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Supplier</th>
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Status</th>
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Date</th>
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Due Date</th>
                  <th className="text-right px-3 py-3 font-medium whitespace-nowrap">Items</th>
                  <th className="text-right px-3 py-3 font-medium whitespace-nowrap">Ordered</th>
                  <th className="text-right px-3 py-3 font-medium whitespace-nowrap">Received</th>
                  <th className="text-right px-3 py-3 font-medium whitespace-nowrap">Pending</th>
                  <th className="text-right px-3 py-3 font-medium whitespace-nowrap">Total</th>
                  <th className="text-center px-3 py-3 font-medium whitespace-nowrap">Action</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {paged.map(po => {
                    const stats = getPoStats(po.po_id);
                    return (
                      <tr key={po.id} className="hover:bg-slate-50">
                        <td className="px-3 py-3 font-bold text-slate-900 whitespace-nowrap">{po.po_id}</td>
                        <td className="px-3 py-3 text-slate-700 whitespace-nowrap">{po.supplier_name || '—'}</td>
                        <td className="px-3 py-3 whitespace-nowrap"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PO_STATUS_COLOR[po.status] || 'bg-slate-100 text-slate-600'}`}>{po.status}</span></td>
                        <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{formatDateDDMMYYYY(po.po_date)}</td>
                        <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{formatDateDDMMYYYY(po.due_date)}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">{stats.itemCount}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">{stats.ordered}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap text-green-700 font-medium">{stats.received}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap text-amber-600 font-medium">{stats.pending}</td>
                        <td className="px-3 py-3 text-right font-bold whitespace-nowrap">{formatINR(po.total_amount)}</td>
                        <td className="px-3 py-3 text-center">
                          <Link to={`/PurchaseOrderTimeline?po=${po.po_id}`}>
                            <button className="p-1.5 rounded hover:bg-slate-100 text-slate-500"><Eye className="w-4 h-4" /></button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {paged.map(po => {
              const stats = getPoStats(po.po_id);
              return (
                <Link key={po.id} to={`/PurchaseOrderTimeline?po=${po.po_id}`} className="block bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{po.po_id}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PO_STATUS_COLOR[po.status] || 'bg-slate-100 text-slate-600'}`}>{po.status}</span>
                  </div>
                  <p className="text-sm text-slate-600">{po.supplier_name || '—'}</p>
                  <div className="flex gap-3 text-xs">
                    <span className="text-slate-500">Ordered: <strong className="text-slate-800">{stats.ordered}</strong></span>
                    <span className="text-green-600">Received: <strong>{stats.received}</strong></span>
                    <span className="text-amber-600">Pending: <strong>{stats.pending}</strong></span>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{formatINR(po.total_amount)}</p>
                </Link>
              );
            })}
          </div>

          <TablePagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} />
        </>
      )}
    </div>
  );
}