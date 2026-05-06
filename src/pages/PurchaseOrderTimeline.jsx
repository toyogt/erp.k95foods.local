import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ArrowLeft, Search, Eye } from 'lucide-react';
import { PO_STATUS_COLOR, formatDateDDMMYYYY, formatINR } from '@/components/purchase/purchaseHelpers';
import POTimelineView from '@/components/purchase/POTimelineView';
import TablePagination from '@/components/store/TablePagination';

export default function PurchaseOrderTimeline() {
  const [selectedPOId, setSelectedPOId] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const urlParams = new URLSearchParams(window.location.search);
  const poParam = urlParams.get('po');

  const { data: pos = [], isLoading } = useQuery({
    queryKey: ['po-timeline-list'],
    queryFn: () => base44.entities.PurchaseOrder.list('-created_date', 500),
    staleTime: 60000,
  });

  const { data: allPOItems = [] } = useQuery({
    queryKey: ['po-timeline-items'],
    queryFn: () => base44.entities.PurchaseOrderItem.list('-created_date', 2000),
    staleTime: 60000,
  });

  // Auto-select from URL param
  useEffect(() => {
    if (poParam && pos.length > 0 && !selectedPOId) {
      const found = pos.find(p => p.po_id === poParam);
      if (found) setSelectedPOId(found.po_id);
    }
  }, [poParam, pos, selectedPOId]);

  // Group items by po_id
  const poItemsMap = {};
  allPOItems.forEach(it => {
    if (!poItemsMap[it.po_id]) poItemsMap[it.po_id] = [];
    poItemsMap[it.po_id].push(it);
  });

  const statuses = ['Draft', 'Sent to Supplier', 'Acknowledged', 'In Transit', 'Partially Received', 'Delivered', 'Cancelled'];

  const filtered = pos.filter(po => {
    if (statusFilter && po.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return po.po_id?.toLowerCase().includes(q) ||
        po.supplier_name?.toLowerCase().includes(q) ||
        po.pr_number?.toLowerCase().includes(q);
    }
    return true;
  });

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Detail view
  if (selectedPOId) {
    const po = pos.find(p => p.po_id === selectedPOId);
    return (
      <div className="max-w-5xl mx-auto space-y-4 pb-12">
        <button onClick={() => setSelectedPOId(null)}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 h-11 px-1 font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to Purchase Order Master
        </button>
        {po && <POTimelineView po={po} />}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Purchase Order Master</h1>
        <p className="text-sm text-slate-500">Complete purchase order master with all details and lifecycle tracking</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full border border-slate-200 rounded-xl pl-10 pr-4 h-11 md:h-9 text-sm bg-white"
            placeholder="Search by Purchase Order number, supplier, or request number..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="border border-slate-200 rounded-lg px-3 h-11 md:h-9 text-sm bg-white"
          value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(search || statusFilter) && (
          <button onClick={() => { setSearch(''); setStatusFilter(''); setPage(1); }}
            className="text-sm text-red-500 hover:text-red-700 font-medium px-3 h-11 md:h-9">
            Clear
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-slate-400 py-12">No purchase orders found.</p>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="md:hidden space-y-3">
            {paged.map(po => {
              const items = poItemsMap[po.po_id] || [];
              const totalOrdered = items.reduce((s, it) => s + (it.qty || 0), 0);
              const totalReceived = items.reduce((s, it) => s + (it.received_qty || 0), 0);
              const totalPending = totalOrdered - totalReceived;

              return (
                <button key={po.id} onClick={() => setSelectedPOId(po.po_id)}
                  className="w-full text-left bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md active:scale-[0.99] transition-all">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono font-bold text-slate-900 text-sm">{po.po_id}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${PO_STATUS_COLOR[po.status] || 'bg-slate-100 text-slate-600'}`}>
                      {po.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 truncate">{po.supplier_name || '—'}</p>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                    <div className="bg-slate-50 rounded-lg p-2 text-center">
                      <span className="block text-slate-400">Ordered</span>
                      <span className="font-bold text-slate-800">{totalOrdered > 0 ? totalOrdered.toFixed(0) : '0'}</span>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2 text-center">
                      <span className="block text-green-500">Received</span>
                      <span className="font-bold text-green-700">{totalReceived > 0 ? totalReceived.toFixed(0) : '0'}</span>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-2 text-center">
                      <span className="block text-amber-500">Pending</span>
                      <span className="font-bold text-amber-700">{totalPending > 0 ? totalPending.toFixed(0) : '0'}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                    <span>{formatDateDDMMYYYY(po.po_date)}</span>
                    <span className="font-bold text-slate-900">{formatINR(po.total_amount)}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-xs">
                    <th className="text-left px-3 py-3 font-medium">Purchase Order</th>
                    <th className="text-left px-3 py-3 font-medium">Supplier</th>
                    <th className="text-left px-3 py-3 font-medium">Status</th>
                    <th className="text-left px-3 py-3 font-medium">Order Date</th>
                    <th className="text-left px-3 py-3 font-medium">Due Date</th>
                    <th className="text-left px-3 py-3 font-medium">Source Request</th>
                    <th className="text-center px-3 py-3 font-medium">Items</th>
                    <th className="text-right px-3 py-3 font-medium">Ordered</th>
                    <th className="text-right px-3 py-3 font-medium">Received</th>
                    <th className="text-right px-3 py-3 font-medium">Pending</th>
                    <th className="text-right px-3 py-3 font-medium">Total</th>
                    <th className="text-center px-3 py-3 font-medium">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paged.map(po => {
                    const items = poItemsMap[po.po_id] || [];
                    const totalOrdered = items.reduce((s, it) => s + (it.qty || 0), 0);
                    const totalReceived = items.reduce((s, it) => s + (it.received_qty || 0), 0);
                    const totalPending = totalOrdered - totalReceived;

                    return (
                      <tr key={po.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedPOId(po.po_id)}>
                        <td className="px-3 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">{po.po_id}</td>
                        <td className="px-3 py-3 text-slate-700 max-w-[150px] truncate">{po.supplier_name || '—'}</td>
                        <td className="px-3 py-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${PO_STATUS_COLOR[po.status] || 'bg-slate-100 text-slate-600'}`}>
                            {po.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDateDDMMYYYY(po.po_date)}</td>
                        <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDateDDMMYYYY(po.due_date) || '—'}</td>
                        <td className="px-3 py-3 text-xs font-mono text-slate-500">{po.pr_number || '—'}</td>
                        <td className="px-3 py-3 text-center text-xs text-slate-600">{items.length}</td>
                        <td className="px-3 py-3 text-right text-xs font-medium">{totalOrdered > 0 ? totalOrdered.toFixed(1) : '—'}</td>
                        <td className="px-3 py-3 text-right text-xs">
                          <span className={totalReceived > 0 ? 'text-green-600 font-bold' : 'text-slate-400'}>{totalReceived > 0 ? totalReceived.toFixed(1) : '0'}</span>
                        </td>
                        <td className="px-3 py-3 text-right text-xs">
                          <span className={totalPending > 0 ? 'text-amber-600 font-bold' : 'text-green-600 font-bold'}>
                            {totalPending > 0 ? totalPending.toFixed(1) : '0'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-slate-900 whitespace-nowrap">{formatINR(po.total_amount)}</td>
                        <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <button onClick={() => setSelectedPOId(po.po_id)} className="p-1.5 rounded hover:bg-slate-100 text-blue-600" title="View Timeline">
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <TablePagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} />
        </>
      )}
    </div>
  );
}