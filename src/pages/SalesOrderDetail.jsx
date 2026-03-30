import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, AlertTriangle, Send, Zap, FileCheck,
  ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import SalesOrderStatusBadge from '@/components/sales/SalesOrderStatusBadge';
import SOInvoicePanel from '@/components/sales/SOInvoicePanel';
import SOLogisticsReviewPanel from '@/components/sales/SOLogisticsReviewPanel';
import { fireFMSEvent } from '@/lib/useFMSAutoComplete';

const STATUS_ORDER = ['draft', 'confirmed', 'logistics_review', 'picking', 'packing', 'invoiced', 'delivered', 'paid', 'closed'];

const NEXT_STATUS = {
  draft: { label: 'Confirm Order', next: 'confirmed', event: null },
  confirmed: { label: 'Send for Logistics Review', next: 'logistics_review', event: 'sales_logistics_review' },
  logistics_review: { label: 'Start Picking', next: 'picking', event: null },
  picking: { label: 'Mark Packed', next: 'packing', event: null },
  packing: { label: 'Mark Invoiced', next: 'invoiced', event: null },
  invoiced: { label: 'Mark Delivered', next: 'delivered', event: null },
  delivered: { label: 'Mark Paid', next: 'paid', event: null },
};

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-md bg-white mb-3">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        onClick={() => setOpen(o => !o)}
      >
        <span>{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t border-slate-100">{children}</div>}
    </div>
  );
}

function Field({ label, value, highlight }) {
  return (
    <div className="py-1.5 border-b border-slate-100 last:border-0 grid grid-cols-2 gap-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xs font-medium ${highlight ? 'text-blue-700' : 'text-slate-900'}`}>{value || '—'}</span>
    </div>
  );
}

export default function SalesOrderDetail() {
  const params = new URLSearchParams(window.location.search);
  const soId = params.get('id');
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [movingStatus, setMovingStatus] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const { data: order, isLoading, refetch } = useQuery({
    queryKey: ['sales_order', soId],
    queryFn: () => base44.entities.SalesOrder.filter({ id: soId }).then(list => list[0]),
    enabled: !!soId,
  });

  const { data: deliveryNotes = [] } = useQuery({
    queryKey: ['delivery_notes_detail', soId],
    queryFn: () => base44.entities.SalesDeliveryNote.filter({ sales_order_id: soId }),
    enabled: !!soId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices_detail', soId],
    queryFn: () => base44.entities.SalesInvoice.filter({ sales_order_id: soId }),
    enabled: !!soId,
  });

  const { data: items = [] } = useQuery({
    queryKey: ['so_items', soId],
    queryFn: () => base44.entities.SalesOrderItem.filter({ sales_order_id: soId }),
    enabled: !!soId,
  });

  const { data: picklists = [] } = useQuery({
    queryKey: ['picklists_detail', soId],
    queryFn: () => base44.entities.SalesPicklist.filter({ sales_order_id: soId }),
    enabled: !!soId,
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['so_audit', soId],
    queryFn: () => base44.entities.SalesAuditLog.filter({ entity_id: soId }, '-created_date', 30),
    enabled: !!soId,
  });

  async function moveToStatus(newStatus, eventKey) {
    setMovingStatus(true);
    const oldStatus = order.status;
    await base44.entities.SalesOrder.update(soId, { status: newStatus });
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesOrder', entity_id: soId,
      reference_number: order.so_number, action: 'status_change',
      field_name: 'status', old_value: oldStatus, new_value: newStatus,
      user_email: user?.email,
    });
    if (eventKey) await fireFMSEvent(eventKey, soId);
    refetch();
    qc.invalidateQueries(['so_audit', soId]);
    toast({ title: `Status updated to ${newStatus}` });
    setMovingStatus(false);
  }

  if (isLoading) return <div className="p-8 text-center text-slate-400">Loading order...</div>;
  if (!order) return <div className="p-8 text-center text-slate-400">Order not found</div>;

  const isExpired = order.po_expiry_date && new Date(order.po_expiry_date) < new Date()
    && !['paid', 'closed', 'cancelled'].includes(order.status);

  const nextAction = NEXT_STATUS[order.status];
  const hasInvoice = invoices.length > 0;
  const firstInvoice = invoices[0];
  const tallyNotPushed = hasInvoice && !firstInvoice?.posted_to_tally;
  const eInvoiceNotDone = hasInvoice && !firstInvoice?.irn;
  const eWayNotDone = hasInvoice && !firstInvoice?.eway_bill;

  // Totals
  const taxableAmt = order.taxable_amount || items.reduce((s, i) => s + (i.taxable_value || 0), 0);
  const taxAmt = order.tax_amount || items.reduce((s, i) => s + (i.igst_amount || i.cgst_amount || 0), 0);
  const grandTotal = order.total_amount || (taxableAmt + taxAmt);

  // Format date DD/MM/YYYY
  const fmt = (d) => {
    if (!d) return '—';
    const parts = d.split('-');
    if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return d;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky top header */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 px-4 h-12">
          <Link to="/SalesOrders" className="text-slate-500 hover:text-slate-900 shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-1.5 text-sm min-w-0">
            <Link to="/SalesOrders" className="text-blue-600 hover:underline shrink-0 text-xs">Sales Order</Link>
            <span className="text-slate-400 text-xs">›</span>
            <span className="font-semibold text-slate-900 text-xs truncate">{order.so_number}</span>
          </div>
          <SalesOrderStatusBadge status={order.status} />
          {isExpired && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium shrink-0">
              <AlertTriangle className="w-3 h-3" /> Purchase Order Expired
            </span>
          )}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            {hasInvoice && eInvoiceNotDone && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-purple-700 border-purple-200 hover:bg-purple-50" onClick={() => setShowInvoiceModal(true)}>
                <FileCheck className="w-3 h-3" /> E-Invoice
              </Button>
            )}
            {hasInvoice && eWayNotDone && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-orange-700 border-orange-200 hover:bg-orange-50" onClick={() => setShowInvoiceModal(true)}>
                <Zap className="w-3 h-3" /> E-Way Bill
              </Button>
            )}
            {tallyNotPushed && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-blue-700 border-blue-200 hover:bg-blue-50" onClick={() => setShowInvoiceModal(true)}>
                <Send className="w-3 h-3" /> Push to Tally
              </Button>
            )}
            {nextAction && !['cancelled', 'closed', 'paid'].includes(order.status) && (
              <Button
                size="sm"
                className="h-7 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 gap-1"
                onClick={() => moveToStatus(nextAction.next, nextAction.event)}
                disabled={movingStatus}
              >
                {nextAction.label} <ArrowRight className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Page content */}
      <div className="max-w-4xl mx-auto px-4 py-4 space-y-0">

        {/* ── Core Details ─────────────────────────────────────────── */}
        <Section title="Sales Order" defaultOpen={true}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <div>
              <Field label="Customer" value={order.customer_name} highlight />
              <Field label="Platform" value={order.platform?.toUpperCase()} />
              <Field label="Order Status" value={order.status?.replace(/_/g, ' ')?.replace(/\b\w/g, c => c.toUpperCase())} />
              <Field label="Currency" value={order.billing_currency || 'INR'} />
            </div>
            <div>
              <Field label="Sales Order Number" value={order.so_number} />
              <Field label="Order Date" value={fmt(order.created_date?.split('T')[0])} />
              <Field label="Source" value={order.source?.replace(/_/g, ' ')?.replace(/\b\w/g, c => c.toUpperCase()) || 'Manual'} />
              <Field label="Transporter" value={order.transporter} />
            </div>
          </div>
        </Section>

        {/* ── Items Table ───────────────────────────────────────── */}
        <Section title="Items" defaultOpen={true}>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="text-left px-2 py-2 font-medium w-6">#</th>
                  <th className="text-left px-2 py-2 font-medium">Item Code</th>
                  <th className="text-left px-2 py-2 font-medium">Description</th>
                  <th className="text-right px-2 py-2 font-medium">Qty</th>
                  <th className="text-right px-2 py-2 font-medium">MRP</th>
                  <th className="text-right px-2 py-2 font-medium">Rate</th>
                  <th className="text-right px-2 py-2 font-medium">Taxable Value</th>
                  <th className="text-right px-2 py-2 font-medium">IGST %</th>
                  <th className="text-right px-2 py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-6 text-slate-400">No items</td></tr>
                ) : items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-2 py-2 text-slate-400">{idx + 1}</td>
                    <td className="px-2 py-2 text-slate-700 font-mono">{item.sku_code || item.item_code || '—'}</td>
                    <td className="px-2 py-2 text-slate-900">{item.description}</td>
                    <td className="px-2 py-2 text-right text-slate-900">{item.quantity}</td>
                    <td className="px-2 py-2 text-right text-slate-700">₹{(item.mrp || 0).toLocaleString('en-IN')}</td>
                    <td className="px-2 py-2 text-right text-slate-700">₹{(item.rate_snapshot || item.unit_base_cost || 0).toLocaleString('en-IN')}</td>
                    <td className="px-2 py-2 text-right text-slate-700">₹{(item.taxable_value || 0).toLocaleString('en-IN')}</td>
                    <td className="px-2 py-2 text-right text-slate-500">{item.igst_rate || 0}%</td>
                    <td className="px-2 py-2 text-right font-medium text-slate-900">₹{(item.total_amount || 0).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-3 flex justify-end">
            <div className="w-64 space-y-1 text-xs border border-slate-200 rounded p-3 bg-slate-50">
              <div className="flex justify-between text-slate-600">
                <span>Total Quantity</span>
                <span className="font-medium text-slate-900">{items.reduce((s, i) => s + (i.quantity || 0), 0)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Net Total</span>
                <span className="font-medium text-slate-900">₹{taxableAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Tax</span>
                <span className="font-medium text-slate-900">₹{taxAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-bold border-t border-slate-300 pt-1 mt-1">
                <span>Grand Total</span>
                <span>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </Section>

        {/* ── More Information ───────────────────────────────────── */}
        <Section title="More Information" defaultOpen={true}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <div>
              <Field label="Purchase Order Number" value={order.po_number} />
              <Field label="Purchase Order Date" value={fmt(order.po_date)} />
              <Field label="Purchase Order Expiry" value={fmt(order.po_expiry_date)} />
              <Field label="Planned Delivery Date" value={fmt(order.po_delivery_date)} />
            </div>
            <div>
              <Field label="Payment Terms" value={order.payment_terms} />
              <Field label="Vendor Number" value={order.vendor_no} />
              <Field label="Packaging Type" value={order.packaging_type} />
              <Field label="Notes" value={order.notes} />
            </div>
          </div>
        </Section>

        {/* ── Address & Contacts ─────────────────────────────────── */}
        <Section title="Address &amp; Contacts" defaultOpen={false}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2">Billing Address</p>
              <p className="text-xs text-slate-700 whitespace-pre-line">{order.billing_address || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2">Shipping Address</p>
              <p className="text-xs text-slate-700 whitespace-pre-line">{order.shipping_address || '—'}</p>
            </div>
          </div>
          {order.customer_gstin && (
            <div className="mt-3">
              <Field label="Customer GSTIN" value={order.customer_gstin} />
              <Field label="Customer PAN" value={order.customer_pan} />
            </div>
          )}
        </Section>

        {/* ── Logistics ─────────────────────────────────────────── */}
        <Section title="Logistics Review" defaultOpen={false}>
          <SOLogisticsReviewPanel order={order} onUpdated={refetch} />
        </Section>

        {/* ── Invoice ───────────────────────────────────────────── */}
        <Section title="Invoice" defaultOpen={false}>
          <SOInvoicePanel order={order} items={items} onUpdated={refetch} deliveryNote={deliveryNotes[0]} />
        </Section>

        {/* ── Connections ───────────────────────────────────────── */}
        <Section title="Connections" defaultOpen={true}>
          <div className="space-y-2">
            {/* Picklists */}
            {picklists.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Pick Lists</p>
                <div className="flex flex-wrap gap-2">
                  {picklists.map(pl => (
                    <a key={pl.id} href={`/SalesPicklistDetail?id=${pl.id}`}
                      className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-1 hover:bg-blue-100">
                      {pl.picklist_number} <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            {/* Delivery Notes */}
            {deliveryNotes.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Delivery Notes</p>
                <div className="flex flex-wrap gap-2">
                  {deliveryNotes.map(dn => (
                    <a key={dn.id} href={`/SalesDeliveryNoteDetail?id=${dn.id}`}
                      className="flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded px-2 py-1 hover:bg-green-100">
                      {dn.dn_number} <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            {/* Invoices */}
            {invoices.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Sales Invoices</p>
                <div className="flex flex-wrap gap-2">
                  {invoices.map(inv => (
                    <a key={inv.id} href={`/SalesInvoiceDetail?id=${inv.id}`}
                      className="flex items-center gap-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded px-2 py-1 hover:bg-purple-100">
                      {inv.invoice_number} — ₹{(inv.total_amount || 0).toLocaleString('en-IN')} <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            {picklists.length === 0 && deliveryNotes.length === 0 && invoices.length === 0 && (
              <p className="text-xs text-slate-400">No linked documents yet.</p>
            )}
          </div>
        </Section>

        {/* ── Activity ──────────────────────────────────────────── */}
        <Section title="Activity" defaultOpen={true}>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-400">No activity recorded.</p>
            ) : auditLogs.map(log => (
              <div key={log.id} className="flex gap-3 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-700 capitalize">{log.action?.replace(/_/g, ' ')}</span>
                    {log.field_name && (
                      <span className="text-slate-400">· {log.field_name}</span>
                    )}
                    <span className="ml-auto text-slate-400">
                      {log.created_date ? fmt(log.created_date.split('T')[0]) : ''}
                    </span>
                  </div>
                  {log.old_value && log.new_value && (
                    <p className="text-slate-500 mt-0.5">
                      <span className="line-through text-red-400">{log.old_value}</span>
                      {' → '}
                      <span className="text-green-600 font-medium">{log.new_value}</span>
                    </p>
                  )}
                  {log.notes && <p className="text-slate-500 mt-0.5">{log.notes}</p>}
                  <p className="text-slate-400 mt-0.5">{log.user_email}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

      </div>
    </div>
  );
}