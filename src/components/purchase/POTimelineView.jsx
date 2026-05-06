import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Clock, Hash, Send, CheckCircle2, Truck, DoorOpen, Package, CircleCheckBig, XCircle } from 'lucide-react';
import { PO_STATUS_FLOW, formatDateDDMMYYYY, formatDateTimeDDMMYYYY, formatINR } from './purchaseHelpers';

const TIMELINE_STEPS = [
  { key: 'Created',           label: 'Purchase Order Created',  icon: Hash,           color: 'text-blue-600 bg-blue-100 border-blue-300' },
  { key: 'Sent to Supplier',  label: 'Sent to Supplier',        icon: Send,           color: 'text-cyan-600 bg-cyan-100 border-cyan-300' },
  { key: 'Acknowledged',      label: 'Acknowledged by Supplier', icon: CheckCircle2,   color: 'text-teal-600 bg-teal-100 border-teal-300' },
  { key: 'In Transit',        label: 'In Transit',              icon: Truck,          color: 'text-amber-600 bg-amber-100 border-amber-300' },
  { key: 'Gate Entry',        label: 'Gate Entry Recorded',     icon: DoorOpen,       color: 'text-indigo-600 bg-indigo-100 border-indigo-300' },
  { key: 'GRN',               label: 'Goods Received Note',     icon: Package,        color: 'text-orange-600 bg-orange-100 border-orange-300' },
  { key: 'Delivered',         label: 'Fully Delivered',         icon: CircleCheckBig, color: 'text-green-600 bg-green-100 border-green-300' },
];

function getStepState(stepKey, poStatus) {
  if (poStatus === 'Cancelled') return 'cancelled';
  const statusIdx = PO_STATUS_FLOW.indexOf(poStatus);
  const stepMap = { Created: 0, 'Sent to Supplier': 1, Acknowledged: 2, 'In Transit': 3, 'Gate Entry': 4, GRN: 4, Delivered: 5 };
  const stepIdx = stepMap[stepKey] ?? 99;
  if (statusIdx >= stepIdx) return 'done';
  if (statusIdx === stepIdx - 1) return 'current';
  return 'pending';
}

function findActualDate(auditLogs, stepKey) {
  const keywords = {
    Created: ['created'],
    'Sent to Supplier': ['sent to supplier', 'sent'],
    Acknowledged: ['acknowledged'],
    'In Transit': ['in transit', 'transit'],
    'Gate Entry': ['gate entry'],
    GRN: ['goods received', 'goods receipt', 'grn'],
    Delivered: ['delivered', 'fully delivered'],
  };
  const keys = keywords[stepKey] || [];
  for (const log of auditLogs) {
    const action = (log.action || '').toLowerCase();
    if (keys.some(k => action.includes(k))) {
      return log.created_date;
    }
  }
  return null;
}

export default function POTimelineView({ po }) {
  const { data: poItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['po-timeline-items', po.po_id],
    queryFn: () => base44.entities.PurchaseOrderItem.filter({ po_id: po.po_id }, 'line_number', 100),
    staleTime: 20000,
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['po-audit', po.po_id],
    queryFn: () => base44.entities.AuditLog.filter({ entity_id: po.po_id, module: 'PURCHASE' }, '-created_date', 50).catch(() => []),
    staleTime: 30000,
  });

  const { data: grnHeaders = [] } = useQuery({
    queryKey: ['po-grn-tl', po.po_id],
    queryFn: async () => {
      const [byPo, all] = await Promise.all([
        base44.entities.GRNHeader.filter({ po_id: po.po_id }, '-received_at', 50).catch(() => []),
        base44.entities.GRNHeader.list('-received_at', 200).catch(() => []),
      ]);
      const byLinked = all.filter(h => Array.isArray(h.linked_po_ids) && h.linked_po_ids.includes(po.po_id));
      const seen = new Set();
      const merged = [];
      [...byPo, ...byLinked].forEach(h => { if (!seen.has(h.id)) { seen.add(h.id); merged.push(h); } });
      return merged;
    },
    staleTime: 30000,
  });

  const { data: gateEntries = [] } = useQuery({
    queryKey: ['po-gate-tl', po.po_id],
    queryFn: () => base44.entities.GateEntry.filter({ linked_po_id: po.po_id }, '-created_date', 10).catch(() => []),
    staleTime: 30000,
  });

  const sortedLogs = [...auditLogs].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
  const plannedDate = po.due_date;
  const isCancelled = po.status === 'Cancelled';

  // Compute totals for items
  const totalOrdered = poItems.reduce((s, it) => s + (it.qty || it.quantity || 0), 0);
  const totalReceived = poItems.reduce((s, it) => s + (it.received_qty || 0), 0);
  const totalPending = Math.max(0, totalOrdered - totalReceived);

  function renderStepContent(step) {
    const state = getStepState(step.key, po.status);
    if (state === 'pending') return null;

    if (step.key === 'Created') {
      return (
        <div className="text-xs text-slate-700 space-y-0.5">
          <p>Purchase Order: <strong>{po.po_id}</strong></p>
          {po.pr_number && <p>Source Request: <strong>{po.pr_number}</strong></p>}
          <p>Total Amount: <strong>{formatINR(po.total_amount)}</strong></p>
          <p>Items: <strong>{poItems.length} line items</strong></p>
        </div>
      );
    }
    if (step.key === 'Sent to Supplier') {
      return po.sent_via ? <p className="text-xs text-slate-600">Sent via: <strong>{po.sent_via}</strong></p> : null;
    }
    if (step.key === 'In Transit') {
      return po.ship_via ? <p className="text-xs text-slate-600">Ship Via: <strong>{po.ship_via}</strong></p> : null;
    }
    if (step.key === 'Gate Entry') {
      if (gateEntries.length === 0) return null;
      return (
        <div className="text-xs text-slate-700 space-y-0.5">
          {gateEntries.map(ge => (
            <p key={ge.id}>Gate Entry: <strong>{ge.gate_entry_id || ge.id}</strong> — {formatDateTimeDDMMYYYY(ge.created_date)}</p>
          ))}
        </div>
      );
    }
    if (step.key === 'GRN') {
      if (grnHeaders.length === 0) return null;
      return (
        <div className="text-xs text-slate-700 space-y-1">
          {grnHeaders.map(grn => (
            <div key={grn.id}>
              <p>Goods Received Note <span className="font-mono">{grn.grn_id}</span>: <strong>{grn.status === 'RECEIVED' ? 'PARTIAL' : grn.status}</strong> — {formatDateTimeDDMMYYYY(grn.received_at)}</p>
              {grn.freight_amount > 0 && <p>Freight ({grn.grn_id}): <strong>{formatINR(grn.freight_amount)}</strong></p>}
            </div>
          ))}
          <p className="text-green-700">Received So Far: <strong>{totalReceived} of {totalOrdered}</strong> ({totalPending} pending)</p>
        </div>
      );
    }
    if (step.key === 'Delivered') return null;
    return null;
  }

  const steps = isCancelled
    ? [...TIMELINE_STEPS, { key: 'Cancelled', label: 'Cancelled', icon: XCircle, color: 'text-red-600 bg-red-100 border-red-300' }]
    : TIMELINE_STEPS;

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <h2 className="text-xl font-bold text-slate-900">{po.po_id}</h2>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
            po.status === 'Delivered' ? 'bg-green-100 text-green-700' :
            po.status === 'Cancelled' ? 'bg-red-100 text-red-600' :
            'bg-blue-100 text-blue-700'
          }`}>{po.status}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-xs text-slate-500 block">Supplier</span><p className="font-medium text-slate-900">{po.supplier_name || '—'}</p></div>
          <div><span className="text-xs text-slate-500 block">Order Date</span><p className="font-medium">{formatDateDDMMYYYY(po.po_date)}</p></div>
          <div><span className="text-xs text-slate-500 block">Due Date</span><p className="font-medium">{formatDateDDMMYYYY(po.due_date)}</p></div>
          <div><span className="text-xs text-slate-500 block">Total Amount</span><p className="font-bold text-lg text-slate-900">{formatINR(po.total_amount)}</p></div>
        </div>
      </div>

      {/* Vertical Timeline */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-5">
          <Clock className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Order Timeline</h3>
        </div>

        <div className="relative">
          {steps.map((step, i) => {
            const state = getStepState(step.key, po.status);
            const Icon = step.icon;
            const actualDate = findActualDate(sortedLogs, step.key);
            const isDone = state === 'done' || state === 'current';
            const isLast = i === steps.length - 1;
            const content = renderStepContent(step);

            // Icon circle colors
            const iconBg = state === 'done' ? step.color
              : state === 'current' ? step.color
              : state === 'cancelled' ? 'text-red-600 bg-red-100 border-red-300'
              : 'text-slate-400 bg-slate-100 border-slate-300';

            return (
              <div key={step.key} className="relative flex gap-4">
                {/* Vertical line */}
                {!isLast && (
                  <div className="absolute left-[18px] top-[40px] bottom-0 w-0.5"
                    style={{ backgroundColor: isDone ? '#86efac' : '#e2e8f0' }} />
                )}

                {/* Icon circle */}
                <div className={`relative z-10 w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0 ${iconBg}`}>
                  <Icon className="w-4 h-4" />
                </div>

                {/* Content */}
                <div className={`flex-1 pb-6 ${isLast ? 'pb-0' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-slate-900">{step.label}</span>
                    {isDone && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  </div>

                  {/* Planned / Actual dates card */}
                  {(isDone || state === 'current') && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mt-1 space-y-2">
                      <div className="flex gap-6">
                        <div>
                          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Planned</span>
                          <p className="text-xs text-slate-700 font-medium">{formatDateTimeDDMMYYYY(plannedDate) || '—'}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Actual</span>
                          <p className="text-xs text-slate-700 font-medium">
                            {actualDate ? formatDateTimeDDMMYYYY(actualDate) : (isDone ? formatDateTimeDDMMYYYY(po.created_date) : '—')}
                          </p>
                        </div>
                      </div>
                      {content}
                    </div>
                  )}

                  {/* Pending - show empty card */}
                  {state === 'pending' && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mt-1 opacity-50">
                      <span className="text-xs text-slate-400">Awaiting</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Items table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 font-semibold text-sm text-slate-700">Line Items ({poItems.length})</div>
        {itemsLoading ? <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-100 text-xs text-slate-600">
                <th className="text-left px-3 py-2 font-medium">Item</th>
                <th className="text-right px-3 py-2 font-medium">Ordered</th>
                <th className="text-right px-3 py-2 font-medium">Received</th>
                <th className="text-right px-3 py-2 font-medium">Pending</th>
                <th className="text-right px-3 py-2 font-medium">Rate</th>
                <th className="text-right px-3 py-2 font-medium">Amount</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {poItems.map((it, idx) => {
                  const ordered = it.qty || it.quantity || 0;
                  const received = it.received_qty || 0;
                  const pending = Math.max(0, ordered - received);
                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-medium text-slate-900">{it.item_name || it.item_code}</td>
                      <td className="px-3 py-2.5 text-right">{ordered}</td>
                      <td className="px-3 py-2.5 text-right text-green-700 font-medium">{received}</td>
                      <td className="px-3 py-2.5 text-right text-amber-600 font-medium">{pending}</td>
                      <td className="px-3 py-2.5 text-right">{formatINR(it.rate || it.unit_price)}</td>
                      <td className="px-3 py-2.5 text-right font-bold">{formatINR(it.amount || (it.rate || 0) * ordered)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold text-sm">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right">{totalOrdered}</td>
                  <td className="px-3 py-2 text-right text-green-700">{totalReceived}</td>
                  <td className="px-3 py-2 text-right text-amber-600">{totalPending}</td>
                  <td></td>
                  <td className="px-3 py-2 text-right">{formatINR(po.total_amount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Freight */}
      {(po.estimated_freight > 0 || po.total_freight_paid > 0) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-slate-900 mb-2">Freight & Cost</p>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div><span className="text-xs text-slate-500">Estimated</span><p className="font-medium">{formatINR(po.estimated_freight)}</p></div>
            <div><span className="text-xs text-slate-500">Actual Paid</span><p className="font-medium text-green-700">{formatINR(po.total_freight_paid || 0)}</p></div>
            <div><span className="text-xs text-slate-500">Difference</span><p className="font-medium">{formatINR((po.estimated_freight || 0) - (po.total_freight_paid || 0))}</p></div>
          </div>
        </div>
      )}
    </div>
  );
}