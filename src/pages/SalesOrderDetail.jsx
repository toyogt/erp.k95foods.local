import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, AlertTriangle, Package, Truck, FileText, CreditCard, RotateCcw } from 'lucide-react';
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
import { fireFMSEvent } from '@/lib/useFMSAutoComplete';

const FLOW_STEPS = [
  { key: 'confirmed',        label: 'Confirmed',         icon: CheckCircle2 },
  { key: 'logistics_review', label: 'Logistics Review',  icon: Package },
  { key: 'picking',          label: 'Pick & Pack',       icon: Package },
  { key: 'packing',          label: 'Delivery Note',     icon: Truck },
  { key: 'invoiced',         label: 'Invoiced',          icon: FileText },
  { key: 'delivered',        label: 'Delivered',         icon: Truck },
  { key: 'paid',             label: 'Paid',              icon: CreditCard },
];

const STATUS_ORDER = ['draft', 'confirmed', 'logistics_review', 'picking', 'packing', 'invoiced', 'delivered', 'paid', 'closed'];

export default function SalesOrderDetail() {
  const params = new URLSearchParams(window.location.search);
  const soId = params.get('id');
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activePanel, setActivePanel] = useState('items');

  const { data: order, isLoading, refetch } = useQuery({
    queryKey: ['sales_order', soId],
    queryFn: () => base44.entities.SalesOrder.filter({ id: soId }).then(list => list[0]),
    enabled: !!soId,
  });

  // Fetch delivery notes for invoice template
  const { data: deliveryNotes = [] } = useQuery({
    queryKey: ['delivery_notes_detail', soId],
    queryFn: () => base44.entities.SalesDeliveryNote.filter({ sales_order_id: soId }),
    enabled: !!soId,
  });

  // Fetch invoices for e-invoice panel
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

  const currentStepIndex = STATUS_ORDER.indexOf(order?.status);

  async function moveToStatus(newStatus, eventKey) {
    const oldStatus = order.status;
    await base44.entities.SalesOrder.update(soId, { status: newStatus });
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesOrder',
      entity_id: soId,
      reference_number: order.so_number,
      action: 'status_change',
      field_name: 'status',
      old_value: oldStatus,
      new_value: newStatus,
      user_email: user?.email,
    });
    if (eventKey) await fireFMSEvent(eventKey, soId);
    refetch();
    qc.invalidateQueries(['so_audit', soId]);
    toast({ title: `Status updated to ${newStatus}` });
  }

  if (isLoading) return (
    <div className="p-8 text-center text-slate-400">Loading order...</div>
  );

  if (!order) return (
    <div className="p-8 text-center text-slate-400">Order not found</div>
  );

  const isExpired = order.po_expiry_date && new Date(order.po_expiry_date) < new Date()
    && !['paid', 'closed', 'cancelled'].includes(order.status);

  const PANELS = [
    { key: 'items',         label: 'Items',            icon: Package },
    { key: 'stock_pick',    label: 'Logistics Review', icon: CheckCircle2 },
    { key: 'delivery_note', label: 'Delivery Note',    icon: Truck },
    { key: 'invoice',       label: 'Invoice',          icon: FileText },
    { key: 'payment',       label: 'Payment',          icon: CreditCard },
    { key: 'returns',       label: 'Returns',          icon: RotateCcw },
    { key: 'timeline',      label: 'Timeline',         icon: Clock },
  ];

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* Back + Header */}
      <div className="flex items-start gap-3">
        <Link to="/SalesOrders" className="mt-1 text-slate-500 hover:text-slate-900">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{order.so_number || 'Sales Order'}</h1>
            <SalesOrderStatusBadge status={order.status} />
            {isExpired && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                <AlertTriangle className="w-3 h-3" /> PO Expired
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{order.customer_name} · PO: {order.po_number || 'N/A'}</p>
        </div>

        {/* Quick action buttons */}
        {order.status === 'confirmed' && (
          <Button className="h-11 bg-slate-900 text-white text-sm" onClick={() => {
            moveToStatus('logistics_review', 'sales_logistics_review');
            setActivePanel('stock_pick');
          }}>
            Send for Logistics Review
          </Button>
        )}
        {(order.status === 'logistics_review' || order.status === 'picking') && (
          <Button className="h-11 bg-slate-900 text-white text-sm" onClick={() => setActivePanel('stock_pick')}>
            Stock &amp; Pick
          </Button>
        )}
      </div>

      {/* Flow progress bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto">
        <div className="flex items-center min-w-max gap-0">
          {FLOW_STEPS.map((step, i) => {
            const stepIndex = STATUS_ORDER.indexOf(step.key);
            const done = currentStepIndex > stepIndex;
            const active = currentStepIndex === stepIndex;
            return (
              <div key={step.key} className="flex items-center">
                <div className={`flex flex-col items-center gap-1 px-3`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    done ? 'bg-green-100 text-green-600' :
                    active ? 'bg-slate-900 text-white' :
                    'bg-slate-100 text-slate-400'
                  }`}>
                    {done ? <CheckCircle2 className="w-4 h-4" /> : <step.icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-xs font-medium ${active ? 'text-slate-900' : done ? 'text-green-700' : 'text-slate-400'}`}>
                    {step.label}
                  </span>
                </div>
                {i < FLOW_STEPS.length - 1 && (
                  <div className={`w-8 h-0.5 mb-5 ${done ? 'bg-green-400' : 'bg-slate-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Order meta info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Platform', value: order.platform?.toUpperCase() || '—' },
          { label: 'PO Expiry', value: order.po_expiry_date || '—', highlight: isExpired },
          { label: 'Payment Terms', value: order.payment_terms || '—' },
          { label: 'Total Value', value: order.total_amount ? `₹${order.total_amount.toLocaleString('en-IN')}` : '—' },
        ].map(m => (
          <div key={m.label} className="bg-white border border-slate-200 rounded-xl p-3">
            <p className="text-xs text-slate-500 mb-1">{m.label}</p>
            <p className={`text-sm font-semibold ${m.highlight ? 'text-red-600' : 'text-slate-900'}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Panel tabs */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex overflow-x-auto border-b border-slate-100">
          {PANELS.map(p => (
            <button
              key={p.key}
              onClick={() => setActivePanel(p.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activePanel === p.key
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <p.icon className="w-3.5 h-3.5" />
              {p.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activePanel === 'items' && <SOItemsTable items={items} order={order} />}
          {activePanel === 'stock_pick' && <SOStockPicklistPanel order={order} items={items} onUpdated={refetch} />}
          {activePanel === 'delivery_note' && <SODeliveryNotePanel order={order} items={items} onUpdated={refetch} />}
          {activePanel === 'invoice' && <SOInvoicePanel order={order} items={items} onUpdated={refetch} deliveryNote={deliveryNotes[0]} />}
          {activePanel === 'payment' && <SOPaymentPanel order={order} onUpdated={refetch} />}
          {activePanel === 'returns' && <SOReturnPanel order={order} items={items} onUpdated={refetch} />}
          {activePanel === 'timeline' && <SOTimeline logs={auditLogs} />}
        </div>
      </div>
    </div>
  );
}