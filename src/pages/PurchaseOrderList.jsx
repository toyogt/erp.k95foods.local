import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Plus, Layers, Search, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { PO_STATUS_COLOR, formatDateDDMMYYYY, formatINR } from '@/components/purchase/purchaseHelpers';
import TablePagination from '@/components/store/TablePagination';

export default function PurchaseOrderList() {
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => { base44.auth.me().then(u => setUser(u)).catch(() => {}); }, []);

  const { data: pos = [], isLoading } = useQuery({
    queryKey: ['po-list'], queryFn: () => base44.entities.PurchaseOrder.list('-created_date', 500),
    staleTime: 30000, enabled: !!user,
  });

  const isManager = user?.role === 'admin' || user?.role === 'purchase_manager' || user?.role === 'production_manager';

  const filtered = pos.filter(po => {
    if (!search) return true;
    const q = search.toLowerCase();
    return po.po_id?.toLowerCase().includes(q) || po.supplier_name?.toLowerCase().includes(q) || po.mr_id?.toLowerCase().includes(q);
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
          <Link to="/PurchaseOrderCreate">
            <Button className="h-11 text-sm font-bold px-6"><Plus className="w-4 h-4 mr-2" /> New Purchase Order</Button>
          </Link>
          <Link to="/BulkPOCreate">
            <Button variant="outline" className="h-11 text-sm font-bold px-6"><Layers className="w-4 h-4 mr-2" /> Bulk Purchase Order</Button>
          </Link>
        </div>
      )}

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="w-full border border-slate-200 rounded-xl pl-10 pr-4 h-11 text-sm bg-white"
          placeholder="Search by PO number, supplier, or source request..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">No purchase orders found.</div>
      ) : (
        <>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-100 text-slate-700 text-xs">
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Purchase Order Number</th>
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Supplier</th>
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Status</th>
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Date</th>
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Due Date</th>
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Source Request</th>
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Payment Terms</th>
                  <th className="text-right px-3 py-3 font-medium whitespace-nowrap">Subtotal</th>
                  <th className="text-right px-3 py-3 font-medium whitespace-nowrap">GST</th>
                  <th className="text-right px-3 py-3 font-medium whitespace-nowrap">Total Amount</th>
                  <th className="text-right px-3 py-3 font-medium whitespace-nowrap">Freight</th>
                  <th className="text-center px-3 py-3 font-medium whitespace-nowrap">Action</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {paged.map(po => (
                    <tr key={po.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3 font-bold text-slate-900 whitespace-nowrap">{po.po_id}</td>
                      <td className="px-3 py-3 text-slate-700 whitespace-nowrap">{po.supplier_name || '—'}</td>
                      <td className="px-3 py-3 whitespace-nowrap"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PO_STATUS_COLOR[po.status] || 'bg-slate-100 text-slate-600'}`}>{po.status}</span></td>
                      <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{formatDateDDMMYYYY(po.po_date)}</td>
                      <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{formatDateDDMMYYYY(po.due_date)}</td>
                      <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap">{po.mr_id || '—'}</td>
                      <td className="px-3 py-3 text-xs text-slate-600 whitespace-nowrap max-w-[120px] truncate">{po.payment_terms || '—'}</td>
                      <td className="px-3 py-3 text-right text-xs whitespace-nowrap">{formatINR(po.subtotal)}</td>
                      <td className="px-3 py-3 text-right text-xs whitespace-nowrap">{formatINR(po.gst_amount)}</td>
                      <td className="px-3 py-3 text-right font-bold whitespace-nowrap">{formatINR(po.total_amount)}</td>
                      <td className="px-3 py-3 text-right text-xs whitespace-nowrap">
                        {po.total_freight_paid > 0 ? <span className="text-green-700">{formatINR(po.total_freight_paid)}</span> : '—'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Link to={`/PurchaseOrderTimeline?po=${po.po_id}`}>
                          <button className="p-1.5 rounded hover:bg-slate-100 text-slate-500"><Eye className="w-4 h-4" /></button>
                        </Link>
                      </td>
                    </tr>
                  ))}
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