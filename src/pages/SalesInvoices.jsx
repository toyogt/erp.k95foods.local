/**
 * Invoices Listing Page — shows all sales invoices with search, filter, and links.
 */
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, FileText, Receipt, ChevronRight } from 'lucide-react';
import { EInvoiceStatusBadge, EWayBillStatusBadge } from '@/components/sales/compliance/ComplianceStatusBadges';
import { Input } from '@/components/ui/input';
import usePagination from '@/hooks/usePagination';
import TablePagination from '@/components/sales/TablePagination';

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'partially_paid', label: 'Partially Paid' },
  { key: 'paid', label: 'Paid' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'cancelled', label: 'Cancelled' },
];

const WORKFLOW_COLORS = {
  draft: 'bg-slate-100 text-slate-600',
  waiting_for_e_invoice: 'bg-amber-100 text-amber-800',
  waiting_for_dispatch: 'bg-blue-100 text-blue-800',
  waiting_for_bilty: 'bg-indigo-100 text-indigo-800',
  wait_to_deliver: 'bg-violet-100 text-violet-800',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function SalesInvoices() {
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['all_invoices'],
    queryFn: () => base44.entities.SalesInvoice.list('-created_date', 500),
    staleTime: 120000,
    cacheTime: 600000,
    refetchOnWindowFocus: false,
  });

  const filtered = useMemo(() => invoices.filter(inv => {
    const matchTab = activeTab === 'all' || inv.status === activeTab;
    const matchSearch = !search ||
      inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      inv.so_number?.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer_name?.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  }), [invoices, activeTab, search]);

  const pagination = usePagination(filtered, 25);

  const fmt = (d) => {
    if (!d) return '—';
    const p = d.split('-');
    if (p.length === 3 && p[0].length === 4) return `${p[2]}/${p[1]}/${p[0]}`;
    return d;
  };

  const totalValue = invoices.reduce((s, i) => s + (i.total_amount || 0), 0);
  const paidCount = invoices.filter(i => i.status === 'paid').length;

  return (
    <motion.div className="p-3 md:p-6 space-y-5 mx-auto" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div>
        <h1 className="text-xl font-bold text-slate-900">Sales Invoices</h1>
        <p className="text-sm text-slate-500">All invoices across sales orders</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Invoices', count: invoices.length, color: 'text-slate-600' },
          { label: 'Paid', count: paidCount, color: 'text-green-600' },
          { label: 'Pending', count: invoices.filter(i => !['paid', 'cancelled'].includes(i.status)).length, color: 'text-amber-600' },
          { label: 'Total Value', count: `₹${(totalValue / 1000).toFixed(1)}K`, color: 'text-blue-600' },
        ].map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.06 }}
            className="bg-white/50 backdrop-blur-xl border border-white/30 rounded-[20px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-4 hover:shadow-md transition-shadow">
            <span className="text-xs text-slate-500 font-medium">{k.label}</span>
            <p className={`text-2xl font-bold ${k.color}`}>{k.count}</p>
          </motion.div>
        ))}
      </div>

      <div className="bg-white/50 backdrop-blur-xl border border-white/30 rounded-[28px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="flex gap-1 p-2 border-b border-slate-100 overflow-x-auto">
          {STATUS_TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === t.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}>
              {t.label}
              {t.key !== 'all' && <span className="ml-1 text-xs opacity-70">{invoices.filter(i => i.status === t.key).length}</span>}
            </button>
          ))}
        </div>

        <div className="p-3 border-b border-slate-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search invoice, order, customer..." value={search}
              onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No invoices found</p>
          </div>
        ) : (
          <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-700 text-xs font-medium">
                  <th className="px-4 py-3 text-left">Invoice Number</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Sales Order</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-right">Total (INR)</th>
                  <th className="px-4 py-3 text-left">Workflow</th>
                  <th className="px-4 py-3 text-left">Compliance</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagination.paged.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => window.location.href = `/SalesInvoiceDetail?id=${inv.id}`}>
                    <td className="px-4 py-3 font-medium">
                      <span className="text-blue-600">{inv.invoice_number}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{inv.customer_name || '—'}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <Link to={`/SalesOrderDetail?id=${inv.sales_order_id}`} className="text-blue-600 hover:underline text-xs">{inv.so_number}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{fmt(inv.invoice_date)}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {inv.total_amount ? `₹${inv.total_amount.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${WORKFLOW_COLORS[inv.workflow_state] || 'bg-slate-100 text-slate-600'}`}>
                        {(inv.workflow_state || 'draft').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <EInvoiceStatusBadge status={inv.einvoice_status} />
                        <EWayBillStatusBadge status={inv.ewb_status} />
                      </div>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <Link to={`/SalesInvoiceDetail?id=${inv.id}`} className="text-blue-600 hover:underline text-xs font-medium">Open →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {pagination.paged.map(inv => (
              <Link key={inv.id} to={`/SalesInvoiceDetail?id=${inv.id}`} className="block px-4 py-3.5 active:bg-slate-50">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900">{inv.invoice_number}</p>
                    <p className="text-sm text-slate-600 mt-0.5 truncate">{inv.customer_name || '—'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : inv.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{inv.status}</span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-500">
                  <span className="text-slate-600">{fmt(inv.invoice_date)}</span>
                  {inv.total_amount && <span className="font-medium text-slate-700">₹{inv.total_amount.toLocaleString('en-IN')}</span>}
                  <span className={`px-2 py-0.5 rounded-full font-medium ${WORKFLOW_COLORS[inv.workflow_state] || 'bg-slate-100 text-slate-600'}`}>
                    {(inv.workflow_state || 'draft').replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <EInvoiceStatusBadge status={inv.einvoice_status} />
                  <EWayBillStatusBadge status={inv.ewb_status} />
                </div>
              </Link>
            ))}
          </div>

          <TablePagination {...pagination} />
          </>
        )}
      </div>
    </motion.div>
  );
}