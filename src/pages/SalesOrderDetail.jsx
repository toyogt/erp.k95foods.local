import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Clock, AlertTriangle, Package,
  Truck, FileText, CreditCard, RotateCcw, MapPin, Link2,
  Printer, ChevronDown, Send, Zap, FileCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import SalesOrderStatusBadge from '@/components/sales/SalesOrderStatusBadge';
import SOItemsTable from '@/components/sales/SOItemsTable';
import SOStockPicklistPanel from '@/components/sales/SOStockPicklistPanel';
import SODeliveryNotePanel from '@/components/sales/SODeliveryNotePanel';
import SOInvoicePanel from '@/components/sales/SOInvoicePanel';
import SOPaymentPanel from '@/components/sales/SOPaymentPanel';
import SOReturnPanel from '@/components/sales/SOReturnPanel';
import SOTimeline from '@/components/sales/SOTimeline';
import SOAddressPanel from '@/components/sales/SOAddressPanel';
import SOConnectionsPanel from '@/components/sales/SOConnectionsPanel';
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

const PANELS = [
  { key: 'items',            label: 'Details' },
  { key: 'address',          label: 'Address & Contact' },
  { key: 'connections',      label: 'Connections' },
  { key: 'logistics_review', label: 'Logistics Review' },
  { key: 'stock_pick',       label: 'Pick List' },
  { key: 'delivery_note',    label: 'Delivery Note' },
  { key: 'invoice',          label: 'Invoice' },
  { key: 'payment',          label: 'Payment' },
  { key: 'returns',          label: 'Returns' },
  { key: 'timeline',         label: 'Timeline' },
];

export default function SalesOrderDetail() {
  const params = new URLSearchParams(window.location.search);
  const soId = params.get('id');
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activePanel, setActivePanel] = useState('items');
  const [movingStatus, setMovingStatus] = useState(false);

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

  const currentIdx = STATUS_ORDER.indexOf(order.status);
  const nextAction = NEXT_STATUS[order.status];
  const hasInvoice = invoices.length > 0;
  const firstInvoice = invoices[0];
  const tallyNotPushed = hasInvoice && !firstInvoice?.posted_to_tally;
  const eInvoiceNotDone = hasInvoice && !firstInvoice?.irn;
  const eWayNotDone = hasInvoice && !firstInvoice?.eway_bill;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Frappe-style sticky header ──────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 h-14">
          <Link to="/SalesOrders" className="text-slate-500 hover:text-slate-900 shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>

          {/* Title */}
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <h1 className="text-base font-bold text-slate-900 truncate">
              {order.customer_name || 'Customer'}
            </h1>
            <span className="text-slate-400 shrink-0 text-sm font-mono">{order.so_number}</span>
            <SalesOrderStatusBadge status={order.status} />
            {isExpired && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium shrink-0">
                <AlertTriangle className="w-3 h-3" /> PO Expired
              </span>
            )}
          </div>

          {/* Right action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* E-Invoice button */}
            {hasInvoice && eInvoiceNotDone && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 text-purple-700 border-purple-200 hover:bg-purple-50"
                onClick={() => setActivePanel('invoice')}
              >
                <FileCheck className="w-3.5 h-3.5" /> E-Invoice
              </Button>
            )}

            {/* E-Way Bill button */}
            {hasInvoice && eWayNotDone && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 text-orange-700 border-orange-200 hover:bg-orange-50"
                onClick={() => setActivePanel('invoice')}
              >
                <Zap className="w-3.5 h-3.5" /> E-Way Bill
              </Button>
            )}

            {/* Push to Tally */}
            {tallyNotPushed && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50"
                onClick={() => setActivePanel('invoice')}
              >
                <Send className="w-3.5 h-3.5" /> Push to Tally
              </Button>
            )}

            {/* Print */}
            <button className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500">
              <Printer className="w-4 h-4" />
            </button>

            {/* Next status action */}
            {nextAction && !['cancelled', 'closed', 'paid'].includes(order.status) && (
              <Button
                className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 gap-1.5"
                onClick={() => moveToStatus(nextAction.next, nextAction.event)}
                disabled={movingStatus}
              >
                {nextAction.label}
                <ArrowRight className="w-3.5 h-3.5" />
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

      {/* ── Order summary strip ───────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap gap-4 text-xs text-slate-600">
        <span>PO: <strong className="text-slate-900">{order.po_number || '—'}</strong></span>
        <span>Platform: <strong className="text-slate-900">{order.platform?.toUpperCase() || '—'}</strong></span>
        <span>Payment Terms: <strong className="text-slate-900">{order.payment_terms || '—'}</strong></span>
        {order.po_expiry_date && (
          <span className={isExpired ? 'text-red-600 font-semibold' : ''}>
            PO Expiry: <strong>{order.po_expiry_date}</strong>
          </span>
        )}
        {order.total_amount && (
          <span className="ml-auto font-semibold text-slate-900">
            ₹{order.total_amount.toLocaleString('en-IN')}
          </span>
        )}
      </div>

      {/* ── Panel content ────────────────────────────────────────────── */}
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {activePanel === 'items' && <SOItemsTable items={items} order={order} />}
        {activePanel === 'address' && <SOAddressPanel order={order} />}
        {activePanel === 'connections' && <SOConnectionsPanel order={order} />}
        {activePanel === 'logistics_review' && <SOLogisticsReviewPanel order={order} onUpdated={refetch} />}
        {activePanel === 'stock_pick' && <SOStockPicklistPanel order={order} items={items} onUpdated={refetch} />}
        {activePanel === 'delivery_note' && <SODeliveryNotePanel order={order} items={items} onUpdated={refetch} />}
        {activePanel === 'invoice' && <SOInvoicePanel order={order} items={items} onUpdated={refetch} deliveryNote={deliveryNotes[0]} />}
        {activePanel === 'payment' && <SOPaymentPanel order={order} onUpdated={refetch} />}
        {activePanel === 'returns' && <SOReturnPanel order={order} items={items} onUpdated={refetch} />}
        {activePanel === 'timeline' && <SOTimeline logs={auditLogs} />}
      </div>
    </div>
  );
}