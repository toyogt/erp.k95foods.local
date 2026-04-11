import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { formatDateTime, formatDate } from '@/lib/dateFormatter';
import {
  ArrowLeft, ArrowRight, AlertTriangle, Send, Zap, FileCheck,
  ChevronDown, ChevronUp, ExternalLink, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import SalesOrderStatusBadge from '@/components/sales/SalesOrderStatusBadge';
import SOInvoicePanel from '@/components/sales/SOInvoicePanel';
import SOLogisticsReviewPanel from '@/components/sales/SOLogisticsReviewPanel';
import SOAddressPanel from '@/components/sales/SOAddressPanel';
import DeleteWithRemarks from '@/components/sales/DeleteWithRemarks';
import SOConnectionsGrid from '@/components/sales/SOConnectionsGrid';
import SOActivityTimeline from '@/components/sales/SOActivityTimeline';
import SOEditableItemsTable from '@/components/sales/SOEditableItemsTable';
import { fireFMSEvent } from '@/lib/useFMSAutoComplete';

const STATUS_ORDER = ['draft', 'confirmed', 'logistics_review', 'picking', 'packing', 'invoiced', 'delivered', 'paid', 'closed'];

// Workflow-aware next action — only shows the button for the CURRENT stage
// Once an order progresses past a stage, that stage's button must not reappear
function getNextAction(order) {
  const status = order?.status;
  const wf = order?.workflow_state;
  // Terminal / no-action states
  if (['cancelled', 'closed', 'paid'].includes(status)) return null;

  // Use the LATER of status/workflow_state to determine current position
  const STAGE_ORDER = ['draft', 'confirmed', 'logistics_review', 'under_logistics_review', 'ready_to_pick', 'picking', 'packing', 'invoiced', 'delivered', 'paid', 'closed'];
  const statusIdx = STAGE_ORDER.indexOf(status);
  const wfIdx = STAGE_ORDER.indexOf(wf);
  const effectiveIdx = Math.max(statusIdx, wfIdx);

  // Map: effective stage → action
  const stageActions = {
    draft:        { label: 'Confirm Order', next: 'confirmed', event: null },
    confirmed:    { label: 'Send for Logistics Review', next: 'logistics_review', event: 'sales_logistics_review' },
    // logistics_review → picking is handled by SOLogisticsReviewPanel
    picking:      { label: 'Mark Packed', next: 'packing', event: null },
    // packing → invoiced requires Invoice tab
    invoiced:     { label: 'Mark Delivered', next: 'delivered', event: null },
    delivered:    { label: 'Go to GRN Reconciliation', next: null, event: null, link: '/SalesGRNReconciliation' },
  };

  // Find the action for the effective stage
  const effectiveStage = STAGE_ORDER[effectiveIdx];
  return stageActions[effectiveStage] || null;
}

const PANELS = [
  { key: 'items',            label: 'Details' },
  { key: 'address',          label: 'Address & Contact' },
  { key: 'terms',            label: 'Terms' },
  { key: 'moreinfo',         label: 'More Info' },
  { key: 'connections',      label: 'Connections' },
  { key: 'logistics_review', label: 'Logistics Review' },
  { key: 'invoice',          label: 'Invoice' },
  { key: 'history',          label: 'History' },
];

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white/50 backdrop-blur-xl border border-white/30 rounded-[20px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] mb-3 hover:shadow-md transition-shadow">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50/50 rounded-t-[20px]"
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
  const [activePanel, setActivePanel] = useState('items');
  const [movingStatus, setMovingStatus] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const { data: order, isLoading, refetch } = useQuery({
    queryKey: ['sales_order', soId],
    queryFn: () => base44.entities.SalesOrder.filter({ id: soId }).then(list => list[0]),
    enabled: !!soId,
    staleTime: 15000,
  });

  const { data: deliveryNotes = [] } = useQuery({
    queryKey: ['delivery_notes_detail', soId],
    queryFn: () => base44.entities.SalesDeliveryNote.filter({ sales_order_id: soId }),
    enabled: !!soId && (activePanel === 'invoice' || activePanel === 'connections'),
    staleTime: 120000,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices_detail', soId],
    queryFn: () => base44.entities.SalesInvoice.filter({ sales_order_id: soId }),
    enabled: !!soId && (activePanel === 'invoice' || activePanel === 'connections'),
    staleTime: 120000,
  });

  const { data: items = [] } = useQuery({
    queryKey: ['so_items', soId],
    queryFn: () => base44.entities.SalesOrderItem.filter({ sales_order_id: soId }),
    enabled: !!soId,
    staleTime: 120000,
  });

  const { data: picklists = [] } = useQuery({
    queryKey: ['picklists_detail', soId],
    queryFn: () => base44.entities.SalesPicklist.filter({ sales_order_id: soId }),
    enabled: !!soId && (activePanel === 'connections' || activePanel === 'logistics_review'),
    staleTime: 120000,
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['so_audit', soId],
    queryFn: () => base44.entities.SalesAuditLog.filter({ entity_id: soId }, '-created_date', 50),
    enabled: !!soId && activePanel === 'history',
    staleTime: 120000,
  });

  // Workflow sequence validation
  function validateWorkflowTransition(from, to) {
    const VALID_TRANSITIONS = {
      draft: ['confirmed'],
      confirmed: ['logistics_review'],
      logistics_review: ['picking'],
      picking: ['packing'],
      packing: ['invoiced'],
      invoiced: ['delivered'],
      delivered: ['paid'],
      paid: ['closed'],
    };
    const allowed = VALID_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) return `Cannot move from ${from} to ${to}. Complete prerequisite steps first.`;
    // Specific validations
    if (to === 'invoiced' && order.workflow_state !== 'ready_to_pick') {
      return 'Logistics Review must be completed before invoicing.';
    }
    if (to === 'invoiced' && picklists.length === 0) {
      return 'A picklist must be generated before invoicing.';
    }
    if (to === 'picking' && order.workflow_state !== 'ready_to_pick') {
      return 'Order must be approved for picking via Logistics Review first.';
    }
    return null;
  }

  async function moveToStatus(newStatus, eventKey) {
    // Enforce workflow sequence
    const error = validateWorkflowTransition(order.status, newStatus);
    if (error) {
      toast({ title: 'Workflow Validation', description: error, variant: 'destructive' });
      return;
    }
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

  const nextAction = getNextAction(order);
  const hasInvoice = invoices.length > 0;
  const firstInvoice = invoices[0];
  const tallyNotPushed = hasInvoice && !firstInvoice?.posted_to_tally;
  const eInvoiceNotDone = hasInvoice && !firstInvoice?.irn;
  const eWayNotDone = hasInvoice && !firstInvoice?.eway_bill;

  // Totals
  const taxableAmt = order.taxable_amount || items.reduce((s, i) => s + (i.taxable_value || 0), 0);
  const taxAmt = order.tax_amount || items.reduce((s, i) => s + (i.igst_amount || i.cgst_amount || 0), 0);
  const grandTotal = order.total_amount || (taxableAmt + taxAmt);

  const fmt = formatDate;

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
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-purple-700 border-purple-200 hover:bg-purple-50" onClick={() => setActivePanel('invoice')}>
                <FileCheck className="w-3 h-3" /> E-Invoice
              </Button>
            )}
            {hasInvoice && eWayNotDone && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-orange-700 border-orange-200 hover:bg-orange-50" onClick={() => setActivePanel('invoice')}>
                <Zap className="w-3 h-3" /> E-Way Bill
              </Button>
            )}
            {tallyNotPushed && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-blue-700 border-blue-200 hover:bg-blue-50" onClick={() => setActivePanel('invoice')}>
                <Send className="w-3 h-3" /> Push to Tally
              </Button>
            )}
            {nextAction && !['cancelled', 'closed', 'paid'].includes(order.status) && (
              nextAction.link ? (
                <Link to={nextAction.link}>
                  <Button size="sm" className="h-7 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 gap-1">
                    {nextAction.label} <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              ) : nextAction.next ? (
                <Button
                  size="sm"
                  className="h-7 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 gap-1"
                  onClick={() => moveToStatus(nextAction.next, nextAction.event)}
                  disabled={movingStatus}
                >
                  {nextAction.label} <ArrowRight className="w-3 h-3" />
                </Button>
              ) : null
            )}
            {user?.role === 'admin' && (
              <Button variant="outline" size="sm" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 gap-1"
                onClick={() => setShowDelete(true)}>
                <Trash2 className="w-3 h-3" /> Delete
              </Button>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex overflow-x-auto px-4 gap-0 border-t border-slate-100">
          {PANELS.map(p => (
            <button
              key={p.key}
              onClick={() => setActivePanel(p.key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
                activePanel === p.key
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Page content */}
      <motion.div className="mx-auto px-4 py-4 space-y-0" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

        {/* ── Details (Items) ─────────────────────────────────────────── */}
        {activePanel === 'items' && (
          <>
            <Section title="Sales Order" defaultOpen={true}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <div>
                  <Field label="Customer" value={order.customer_name} highlight />
                  <Field label="Customer Type" value={order.platform?.toUpperCase() || 'Direct'} />
                  <Field label="Order Date" value={fmt(order.created_date?.split('T')[0])} />
                  <Field label="Delivery Date" value={fmt(order.po_delivery_date)} />
                </div>
                <div>
                  <Field label="Sales Order Number" value={order.so_number} />
                  <Field label="Purchase Order Number" value={order.po_number} />
                  <Field label="Purchase Order Date" value={fmt(order.po_date)} />
                  <Field label="Price List" value={order.price_list || 'Standard Selling'} />
                </div>
              </div>
            </Section>

            <Section title="Currency and Price List" defaultOpen={false}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <div>
                  <Field label="Currency" value={order.billing_currency || 'INR'} />
                  <Field label="Price List" value={order.price_list || 'Standard Selling'} />
                </div>
              </div>
            </Section>

            <Section title="Items" defaultOpen={true}>
              <SOEditableItemsTable order={order} items={items} onUpdated={() => { refetch(); qc.invalidateQueries(['so_items', soId]); }} />
            </Section>

            {/* Taxes section */}
            <Section title="Taxes and Charges" defaultOpen={true}>
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700">
                      <th className="text-left px-3 py-2 font-medium">#</th>
                      <th className="text-left px-3 py-2 font-medium">Type</th>
                      <th className="text-right px-3 py-2 font-medium">Rate</th>
                      <th className="text-right px-3 py-2 font-medium">Amount</th>
                      <th className="text-right px-3 py-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
                      const hasIGST = items.some(i => (i.igst_amount || 0) > 0);
                      const hasCGST = items.some(i => (i.cgst_amount || 0) > 0);
                      const rows = [];
                      if (hasIGST) {
                        const rate = items.find(i => i.igst_rate)?.igst_rate || 0;
                        const amt = items.reduce((s, i) => s + (i.igst_amount || 0), 0);
                        rows.push({ label: 'IGST', rate: `${rate}%`, amount: amt, total: taxableAmt + amt });
                      }
                      if (hasCGST) {
                        const rate = items.find(i => i.cgst_rate)?.cgst_rate || 0;
                        const cAmt = items.reduce((s, i) => s + (i.cgst_amount || 0), 0);
                        const sAmt = items.reduce((s, i) => s + (i.sgst_amount || 0), 0);
                        rows.push({ label: 'CGST', rate: `${rate}%`, amount: cAmt, total: taxableAmt + cAmt });
                        rows.push({ label: 'SGST', rate: `${rate}%`, amount: sAmt, total: taxableAmt + cAmt + sAmt });
                      }
                      if (rows.length === 0) {
                        rows.push({ label: 'Tax (included)', rate: '—', amount: taxAmt, total: grandTotal });
                      }
                      return rows.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-2 text-slate-900">{r.label}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{r.rate}</td>
                          <td className="px-3 py-2 text-right text-slate-700">₹{r.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="px-3 py-2 text-right font-medium text-slate-900">₹{r.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* Totals section */}
            <Section title="Totals" defaultOpen={true}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <div className="space-y-1">
                  <Field label="Total Taxes and Charges" value={`₹${taxAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
                  <Field label="Grand Total" value={`₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
                  <Field label="Rounded Total" value={`₹${Math.round(grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
                </div>
                <div className="space-y-1">
                  <Field label="Total Quantity" value={items.reduce((s, i) => s + (i.quantity || 0), 0)} />
                  <Field label="Net Total" value={`₹${taxableAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
                  <p className="text-xs mt-3 text-slate-500 italic">
                    In Words: <span className="text-slate-700 font-medium">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </p>
                </div>
              </div>
            </Section>
          </>
        )}

        {/* ── Terms ─────────────────────────────────────────── */}
        {activePanel === 'terms' && (
          <Section title="Terms and Conditions" defaultOpen={true}>
            <p className="text-sm text-slate-600 whitespace-pre-line">
              {order.payment_terms || 'No specific terms recorded for this order.'}
            </p>
          </Section>
        )}

        {/* ── More Info ─────────────────────────────────────── */}
        {activePanel === 'moreinfo' && (
          <Section title="More Information" defaultOpen={true}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              <div>
                <Field label="Purchase Order Expiry" value={fmt(order.po_expiry_date)} />
                <Field label="Planned Dispatch Date" value={fmt(order.planned_dispatch_date)} />
                <Field label="Source" value={order.source?.replace(/_/g, ' ')?.replace(/\b\w/g, c => c.toUpperCase()) || 'Manual'} />
                <Field label="Vendor Number" value={order.vendor_no} />
              </div>
              <div>
                <Field label="Transporter" value={order.transporter} />
                <Field label="Packaging Type" value={order.packaging_type} />
                <Field label="Stock Validation" value={order.stock_validation_status?.replace(/_/g, ' ')?.replace(/\b\w/g, c => c.toUpperCase()) || 'Not Checked'} />
                <Field label="Notes" value={order.notes} />
              </div>
            </div>
          </Section>
        )}

        {/* ── Address & Contacts ─────────────────────────────────────── */}
        {activePanel === 'address' && (
          <SOAddressPanel order={order} onUpdated={refetch} />
        )}

        {/* ── Logistics ─────────────────────────────────────────── */}
        {activePanel === 'logistics_review' && (
          <Section title="Logistics Review" defaultOpen={true}>
            <SOLogisticsReviewPanel order={order} onUpdated={refetch} />
          </Section>
        )}

        {/* ── Invoice ───────────────────────────────────────────── */}
        {activePanel === 'invoice' && (
          <Section title="Invoice" defaultOpen={true}>
            <SOInvoicePanel order={order} items={items} onUpdated={refetch} deliveryNote={deliveryNotes[0]} />
          </Section>
        )}

        {/* ── Connections ───────────────────────────────────────── */}
        {activePanel === 'connections' && (
          <Section title="Connections" defaultOpen={true}>
            <SOConnectionsGrid
              picklists={picklists}
              deliveryNotes={deliveryNotes}
              invoices={invoices}
            />
          </Section>
        )}

        {/* ── History ──────────────────────────────────────────────────── */}
        {activePanel === 'history' && (
          <Section title="Order History & Audit Trail" defaultOpen={true}>
            <SOActivityTimeline auditLogs={auditLogs} />
          </Section>
        )}

      </motion.div>

      <DeleteWithRemarks
        open={showDelete}
        onClose={() => setShowDelete(false)}
        entityName="SalesOrder"
        recordId={soId}
        referenceNumber={order.so_number}
        onDeleted={() => window.location.href = '/SalesOrders'}
      />
    </div>
  );
}