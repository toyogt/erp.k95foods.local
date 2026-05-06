import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Plus, Layers, Search, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { PO_STATUS_COLOR, formatDateDDMMYYYY, formatINR } from '@/components/purchase/purchaseHelpers';
import PODetailView from '@/components/purchase/PODetailView';
import TablePagination from '@/components/store/TablePagination';

export default function PurchaseOrderList() {
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedPO, setSelectedPO] = useState(null);

  useEffect(() => { base44.auth.me().then(u => setUser(u)).catch(() => {}); }, []);

  const { data: pos = [], isLoading, refetch } = useQuery({
    queryKey: ['po-list'], queryFn: () => base44.entities.PurchaseOrder.list('-created_date', 500),
    staleTime: 30000, enabled: !!user,
  });

  const isManager = user?.role === 'admin' || user?.role === 'purchase_manager' || user?.role === 'production_manager';

  if (selectedPO) {
    return <PODetailView po={selectedPO} user={user} isManager={isManager} onBack={() => setSelectedPO(null)} onRefresh={() => { setSelectedPO(null); refetch(); }} />;
  }

  const filtered = pos.filter(po => {
    if (!search) return true;
    const q = search.toLowerCase();
    return po.po_id?.toLowerCase().includes(q) || po.supplier_name?.toLowerCase().includes(q) || po.mr_id?.toLowerCase().includes(q) || po.pr_number?.toLowerCase().includes(q);
  });

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Purchase Orders</h1>
          <p className="text-sm text-slate-500">Create and manage purchase orders</p>
        </div>
      </div>

      {isManager && (
        <div className="flex flex-wrap gap-2">
          <Link to="/PurchaseOrderCreate"><Button className="h-11 text-sm font-bold px-6"><Plus className="w-4 h-4 mr-2" /> New Purchase Order</Button></Link>
          <Link to="/BulkPOCreate"><Button variant="outline" className="h-11 text-sm font-bold px-6"><Layers className="w-4 h-4 mr-2" /> Bulk Purchase Order</Button></Link>
        </div>
      )}

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="w-full border border-slate-200 rounded-xl pl-10 pr-4 h-11 text-sm bg-white"
          placeholder="Search by Purchase Order number, supplier, or source request..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">No purchase orders found.</div>
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
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Source</th>
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Payment Terms</th>
                  <th className="text-right px-3 py-3 font-medium whitespace-nowrap">Total</th>
                  <th className="text-center px-3 py-3 font-medium whitespace-nowrap">Action</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {paged.map(po => (
                    <tr key={po.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedPO(po)}>
                      <td className="px-3 py-3 font-bold text-slate-900 whitespace-nowrap">{po.po_id}</td>
                      <td className="px-3 py-3 text-slate-700 whitespace-nowrap">{po.supplier_name || '—'}</td>
                      <td className="px-3 py-3 whitespace-nowrap"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PO_STATUS_COLOR[po.status] || 'bg-slate-100 text-slate-600'}`}>{po.status}</span></td>
                      <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{formatDateDDMMYYYY(po.po_date)}</td>
                      <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{formatDateDDMMYYYY(po.due_date)}</td>
                      <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{po.pr_number || po.mr_id || '—'}</td>
                      <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap max-w-[120px] truncate">{po.payment_terms || '—'}</td>
                      <td className="px-3 py-3 text-right font-bold whitespace-nowrap">{formatINR(po.total_amount)}</td>
                      <td className="px-3 py-3 text-center">
                        <button className="p-1.5 rounded hover:bg-slate-100 text-slate-500" onClick={e => { e.stopPropagation(); setSelectedPO(po); }}><Eye className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {paged.map(po => (
              <div key={po.id} onClick={() => setSelectedPO(po)} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 cursor-pointer active:bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{po.po_id}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PO_STATUS_COLOR[po.status] || 'bg-slate-100 text-slate-600'}`}>{po.status}</span>
                </div>
                <p className="text-sm text-slate-600">{po.supplier_name || '—'}</p>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{formatDateDDMMYYYY(po.po_date)}</span>
                  <span className="font-bold text-slate-900">{formatINR(po.total_amount)}</span>
                </div>
              </div>
            ))}
          </div>

          <TablePagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} />
        </>
      )}
    </div>
  );
}