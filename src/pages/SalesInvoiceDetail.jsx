/**
 * Sales Invoice Detail Page — full compliance lifecycle view
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Trash2 } from 'lucide-react';
import { EInvoiceStatusBadge, EWayBillStatusBadge } from '@/components/sales/compliance/ComplianceStatusBadges';
import EInvoiceSection from '@/components/sales/compliance/EInvoiceSection';
import EWayBillSection from '@/components/sales/compliance/EWayBillSection';
import ComplianceLogTabs from '@/components/sales/compliance/ComplianceLogTabs';
import EInvoicePanel from '@/components/sales/EInvoicePanel';
import DeleteWithRemarks from '@/components/sales/DeleteWithRemarks';
import SOItemsTable from '@/components/sales/SOItemsTable';

const STATE_COLORS = {
  draft: 'bg-slate-100 text-slate-600',
  waiting_for_e_invoice: 'bg-amber-100 text-amber-800',
  waiting_for_dispatch: 'bg-blue-100 text-blue-800',
  waiting_for_bilty: 'bg-indigo-100 text-indigo-800',
  wait_to_deliver: 'bg-violet-100 text-violet-800',
  delivered: 'bg-green-100 text-green-700',
  return_pending_approval: 'bg-orange-100 text-orange-800',
  return_approved: 'bg-orange-100 text-orange-800',
  return_completed: 'bg-purple-100 text-purple-800',
  cancelled: 'bg-red-100 text-red-700',
};

const STATE_LABEL = {
  draft: 'Draft', waiting_for_e_invoice: 'Waiting for E-Invoice & E-Way Bill',
  waiting_for_dispatch: 'Waiting for Dispatch', waiting_for_bilty: 'Waiting for Bilty',
  wait_to_deliver: 'Wait to Deliver', delivered: 'Delivered',
  return_pending_approval: 'Return Pending Approval',
  return_approved: 'Return Approved', return_completed: 'Return Completed', cancelled: 'Cancelled',
};

function fmtDate(d) {
  if (!d) return '—';
  const p = d.split('-');
  if (p.length === 3 && p[0].length === 4) return `${p[2]}/${p[1]}/${p[0]}`;
  return d;
}

export default function SalesInvoiceDetail() {
  const params = new URLSearchParams(window.location.search);
  const invId = params.get('id');
  const { user } = useAuth();

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

  const [showDelete, setShowDelete] = useState(false);

  if (isLoading) return <div className="p-8 text-center text-slate-400">Loading...</div>;
  if (!invoice) return <div className="p-8 text-center text-slate-400">Invoice not found</div>;

  const wfState = invoice.workflow_state || 'draft';

  return (
    <div className="p-3 md:p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link to="/SalesInvoices" className="mt-1 text-slate-500 hover:text-slate-900">
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
            {invoice.customer_name}
            {invoice.sales_order_id && (
              <> · Sales Order: <Link to={`/SalesOrderDetail?id=${invoice.sales_order_id}`} className="text-blue-600 hover:underline">{invoice.so_number}</Link></>
            )}
          </p>
        </div>
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Taxable Amount', value: (invoice.total_taxable_value || invoice.taxable_amount) ? `₹${(invoice.total_taxable_value || invoice.taxable_amount).toLocaleString('en-IN')}` : '—' },
          { label: 'Tax Amount', value: (invoice.total_tax || invoice.tax_amount) ? `₹${(invoice.total_tax || invoice.tax_amount).toLocaleString('en-IN')}` : '—' },
          { label: 'Grand Total', value: (invoice.total_invoice_value || invoice.total_amount) ? `₹${(invoice.total_invoice_value || invoice.total_amount).toLocaleString('en-IN')}` : '—', bold: true },
        ].map(m => (
          <div key={m.label} className="bg-white border border-slate-200 rounded-xl p-3">
            <p className="text-xs text-slate-500 mb-1">{m.label}</p>
            <p className={`text-sm ${m.bold ? 'text-lg font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Compliance Status Badges */}
      <div className="flex flex-wrap gap-2">
        <EInvoiceStatusBadge status={invoice.einvoice_status} />
        <EWayBillStatusBadge status={invoice.ewb_status} />
      </div>

      {/* Invoice details */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          ['Invoice Date', fmtDate(invoice.invoice_date)],
          ['Payment Terms', invoice.payment_terms],
          ['Due Date', fmtDate(invoice.due_date)],
          ['Customer GSTIN', invoice.customer_gstin],
          ['Billing Address', invoice.billing_address],
          ['Shipping Address', invoice.shipping_address],
          ['Transporter', invoice.transporter_name],
          ['Vehicle Number', invoice.vehicle_no],
          ['Distance (km)', invoice.distance],
        ].filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="bg-white border border-slate-200 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">{k}</p>
            <p className="text-sm font-medium text-slate-900">{v}</p>
          </div>
        ))}
      </div>

      {/* E-Invoice Section (GST Compliance) */}
      <EInvoiceSection invoice={invoice} onUpdated={refetch} />

      {/* E-Way Bill Section (GST Compliance) */}
      <EWayBillSection invoice={invoice} onUpdated={refetch} />

      {/* Workflow Panel (existing — dispatch/bilty/tally) */}
      <EInvoicePanel invoice={invoice} order={order} onUpdated={refetch} />

      {/* Compliance Logs */}
      <ComplianceLogTabs invoiceId={invoice.id} />

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

      {/* Invoice Line Items (from entity) */}
      {invoice.items && invoice.items.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Invoice Line Items</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-100 text-slate-700 text-xs font-medium">
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-left">HSN</th>
                <th className="px-3 py-2 text-right">Quantity</th>
                <th className="px-3 py-2 text-left">Unit</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Taxable</th>
                <th className="px-3 py-2 text-right">CGST</th>
                <th className="px-3 py-2 text-right">SGST</th>
                <th className="px-3 py-2 text-right">IGST</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium">{item.item_name || '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{item.hsn_code || '—'}</td>
                    <td className="px-3 py-2 text-right">{item.quantity || '—'}</td>
                    <td className="px-3 py-2">{item.unit || '—'}</td>
                    <td className="px-3 py-2 text-right">₹{(item.price || 0).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right">₹{(item.taxable_amount || 0).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right">{item.cgst_rate ? `${item.cgst_rate}%` : '—'}</td>
                    <td className="px-3 py-2 text-right">{item.sgst_rate ? `${item.sgst_rate}%` : '—'}</td>
                    <td className="px-3 py-2 text-right">{item.igst_rate ? `${item.igst_rate}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {user?.role === 'admin' && (
        <div className="flex justify-end">
          <Button variant="outline" className="h-11 text-sm text-red-600 border-red-200 hover:bg-red-50 gap-1.5"
            onClick={() => setShowDelete(true)}>
            <Trash2 className="w-4 h-4" /> Delete Invoice
          </Button>
        </div>
      )}

      <DeleteWithRemarks
        open={showDelete}
        onClose={() => setShowDelete(false)}
        entityName="SalesInvoice"
        recordId={invId}
        referenceNumber={invoice.invoice_number}
        onDeleted={() => window.location.href = '/SalesInvoices'}
      />
    </div>
  );
}