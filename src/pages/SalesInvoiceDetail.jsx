/**
 * Sales Invoice Detail Page — dedicated page for a single Sales Invoice.
 * Full SI workflow rendered via EInvoicePanel.
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import EInvoicePanel from '@/components/sales/EInvoicePanel';
import SOItemsTable from '@/components/sales/SOItemsTable';

const STATE_COLORS = {
  draft:                   'bg-slate-100 text-slate-600',
  waiting_for_e_invoice:   'bg-amber-100 text-amber-800',
  waiting_for_dispatch:    'bg-blue-100 text-blue-800',
  waiting_for_bilty:       'bg-indigo-100 text-indigo-800',
  wait_to_deliver:         'bg-violet-100 text-violet-800',
  delivered:               'bg-green-100 text-green-700',
  return_pending_approval: 'bg-orange-100 text-orange-800',
  return_approved:         'bg-orange-100 text-orange-800',
  return_completed:        'bg-purple-100 text-purple-800',
  cancelled:               'bg-red-100 text-red-700',
};

const STATE_LABEL = {
  draft: 'Draft', waiting_for_e_invoice: 'Waiting for E-Invoice & E-Way Bill',
  waiting_for_dispatch: 'Waiting for Dispatch', waiting_for_bilty: 'Waiting for Bilty',
  wait_to_deliver: 'Wait to Deliver', delivered: 'Delivered',
  return_pending_approval: 'Return Pending Approval',
  return_approved: 'Return Approved', return_completed: 'Return Completed', cancelled: 'Cancelled',
};

export default function SalesInvoiceDetail() {
  const params = new URLSearchParams(window.location.search);
  const invId = params.get('id');

  const { data: invoice, isLoading, refetch } = useQuery({
    queryKey: ['inv_detail', invId],
    queryFn: () => base44.entities.SalesInvoice.filter({ id: invId }).then(r => r[0]),
    enabled: !!invId,
  });

  const { data: order } = useQuery({
    queryKey: ['so_for_inv', invoice?.sales_order_id],
    queryFn: () => base44.entities.SalesOrder.filter({ id: invoice.sales_order_id }).then(r => r[0]),
    enabled: !!invoice?.sales_order_id,
  });

  const { data: items = [] } = useQuery({
    queryKey: ['si_items', invoice?.sales_order_id],
    queryFn: () => base44.entities.SalesOrderItem.filter({ sales_order_id: invoice.sales_order_id }),
    enabled: !!invoice?.sales_order_id,
  });

  if (isLoading) return <div className="p-8 text-center text-slate-400">Loading...</div>;
  if (!invoice) return <div className="p-8 text-center text-slate-400">Invoice not found</div>;

  const wfState = invoice.workflow_state || 'draft';

  return (
    <div className="p-3 md:p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link to={`/SalesOrderDetail?id=${invoice.sales_order_id}`} className="mt-1 text-slate-500 hover:text-slate-900">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="w-5 h-5 text-slate-500" />
            <h1 className="text-xl font-bold text-slate-900">{invoice.invoice_number}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATE_COLORS[wfState]}`}>
              {STATE_LABEL[wfState] || wfState}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {invoice.customer_name} ·{' '}
            Sales Order: <Link to={`/SalesOrderDetail?id=${invoice.sales_order_id}`} className="text-blue-600 hover:underline">{invoice.so_number}</Link>
          </p>
        </div>
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Taxable Amount', value: invoice.taxable_amount ? `₹${invoice.taxable_amount.toLocaleString('en-IN')}` : '—' },
          { label: 'Tax Amount', value: invoice.tax_amount ? `₹${invoice.tax_amount.toLocaleString('en-IN')}` : '—' },
          { label: 'Grand Total', value: invoice.total_amount ? `₹${invoice.total_amount.toLocaleString('en-IN')}` : '—', bold: true },
        ].map(m => (
          <div key={m.label} className="bg-white border border-slate-200 rounded-xl p-3">
            <p className="text-xs text-slate-500 mb-1">{m.label}</p>
            <p className={`text-sm ${m.bold ? 'text-lg font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Invoice details */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          ['Invoice Date', invoice.invoice_date],
          ['Payment Terms', invoice.payment_terms],
          ['Due Date', invoice.due_date],
          ['Customer GSTIN', invoice.customer_gstin],
        ].filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="bg-white border border-slate-200 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">{k}</p>
            <p className="text-sm font-medium text-slate-900">{v}</p>
          </div>
        ))}
      </div>

      {/* EInvoice Workflow Panel */}
      <EInvoicePanel invoice={invoice} order={order} onUpdated={refetch} />

      {/* Items */}
      {items.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Invoice Items</h3>
          </div>
          <div className="p-4">
            <SOItemsTable items={items} order={order} />
          </div>
        </div>
      )}
    </div>
  );
}