import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ArrowLeft, CheckCircle2, Circle, Truck, Package, FileText, AlertTriangle } from 'lucide-react';
import { PO_STATUS_COLOR, PO_STATUS_FLOW, formatDateDDMMYYYY, formatINR } from './purchaseHelpers';
import POGRNHistory from './POGRNHistory';
import POFollowUpList from './POFollowUpList';

const TIMELINE_STEPS = [
  { key: 'Created', label: 'Created', icon: FileText },
  { key: 'Sent to Supplier', label: 'Sent', icon: Truck },
  { key: 'Acknowledged', label: 'Acknowledged', icon: CheckCircle2 },
  { key: 'In Transit', label: 'In Transit', icon: Truck },
  { key: 'Gate Entry', label: 'Gate Entry', icon: Package },
  { key: 'GRN', label: 'Goods Receipt', icon: Package },
  { key: 'Delivered', label: 'Delivered', icon: CheckCircle2 },
];

export default function POTimelineView({ po, user, onBack }) {
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

  const statusIdx = PO_STATUS_FLOW.indexOf(po.status);
  const isCancelled = po.status === 'Cancelled';

  function getStepStatus(stepKey) {
    if (isCancelled) return 'cancelled';
    const stepMap = { Created: 0, 'Sent to Supplier': 1, Acknowledged: 2, 'In Transit': 3, 'Gate Entry': 4, GRN: 4, Delivered: 5 };
    const stepIdx = stepMap[stepKey] ?? 99;
    if (statusIdx >= stepIdx) return 'done';
    if (statusIdx === stepIdx - 1) return 'current';
    return 'pending';
  }

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-blue-600 font-medium text-sm flex items-center gap-1 hover:text-blue-700"><ArrowLeft className="w-4 h-4" /> Back</button>

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-xl font-bold text-slate-900">{po.po_id}</h2>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${PO_STATUS_COLOR[po.status] || 'bg-slate-100 text-slate-600'}`}>{po.status}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><span className="text-xs text-slate-500">Supplier</span><p className="font-medium">{po.supplier_name}</p></div>
          <div><span className="text-xs text-slate-500">Date</span><p className="font-medium">{formatDateDDMMYYYY(po.po_date)}</p></div>
          <div><span className="text-xs text-slate-500">Due</span><p className="font-medium">{formatDateDDMMYYYY(po.due_date)}</p></div>
          <div><span className="text-xs text-slate-500">Total</span><p className="font-bold text-lg">{formatINR(po.total_amount)}</p></div>
        </div>
      </div>

      {/* 7-Step Timeline */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <p className="text-sm font-semibold text-slate-700 mb-3">Order Timeline</p>
        <div className="flex items-center overflow-x-auto gap-1 pb-2 no-scrollbar">
          {TIMELINE_STEPS.map((ts, i) => {
            const st = getStepStatus(ts.key);
            const Icon = ts.icon;
            const cls = st === 'done' ? 'bg-green-100 text-green-700 border-green-200' : st === 'current' ? 'bg-blue-100 text-blue-700 border-blue-300' : st === 'cancelled' ? 'bg-red-50 text-red-400 border-red-200' : 'bg-slate-50 text-slate-400 border-slate-200';
            return (
              <div key={ts.key} className="flex items-center shrink-0">
                <div className={`flex items-center gap-1.5 border rounded-full px-3 py-1.5 ${cls}`}>
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold whitespace-nowrap">{ts.label}</span>
                </div>
                {i < TIMELINE_STEPS.length - 1 && <div className={`w-4 h-0.5 ${st === 'done' ? 'bg-green-300' : 'bg-slate-200'}`} />}
              </div>
            );
          })}
          {isCancelled && (
            <div className="flex items-center shrink-0 ml-2">
              <div className="flex items-center gap-1.5 border border-red-300 bg-red-100 text-red-700 rounded-full px-3 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /><span className="text-xs font-bold">Cancelled</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Items with % tracking */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 font-semibold text-sm text-slate-700">Items ({poItems.length})</div>
        {itemsLoading ? <div className="py-4 text-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 text-xs text-slate-500">
                <th className="text-left px-3 py-2">Item</th><th className="text-right px-3 py-2">Ordered</th>
                <th className="text-right px-3 py-2">Received</th><th className="text-right px-3 py-2">Pending</th>
                <th className="text-right px-3 py-2">% Done</th><th className="text-right px-3 py-2">Rate</th>
                <th className="text-right px-3 py-2">Amount</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {poItems.map((it, i) => {
                  const ordered = it.qty || it.quantity || 0;
                  const received = it.received_qty || 0;
                  const pending = it.pending_qty || Math.max(0, ordered - received);
                  const pct = ordered > 0 ? Math.round((received / ordered) * 100) : 0;
                  return (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">{it.item_name || it.item_code}</td>
                      <td className="px-3 py-2 text-right">{ordered}</td>
                      <td className="px-3 py-2 text-right text-green-700 font-medium">{received}</td>
                      <td className="px-3 py-2 text-right text-amber-600">{pending}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} /></div>
                          <span className="text-xs font-bold">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">{formatINR(it.rate || it.unit_price)}</td>
                      <td className="px-3 py-2 text-right font-bold">{formatINR(it.amount || (it.rate || 0) * ordered)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Freight summary */}
      {(po.estimated_freight > 0 || po.total_freight_paid > 0) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-slate-700 mb-2">Freight & Cost</p>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div><span className="text-xs text-slate-500">Estimated</span><p className="font-medium">{formatINR(po.estimated_freight)}</p></div>
            <div><span className="text-xs text-slate-500">Actual Paid</span><p className="font-medium text-green-700">{formatINR(po.total_freight_paid || 0)}</p></div>
            <div><span className="text-xs text-slate-500">Difference</span><p className="font-medium">{formatINR((po.estimated_freight || 0) - (po.total_freight_paid || 0))}</p></div>
          </div>
        </div>
      )}

      {/* GRN History */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <POGRNHistory poId={po.po_id} />
      </div>

      {/* Follow-ups */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <POFollowUpList poId={po.po_id} user={user} />
      </div>

      {/* Audit Trail */}
      {auditLogs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
          <p className="text-sm font-semibold text-slate-700">Audit Trail</p>
          {auditLogs.map(log => (
            <div key={log.id} className="flex items-start gap-2 text-xs py-1.5 border-b border-slate-50 last:border-0">
              <Circle className="w-2 h-2 mt-1 text-slate-400 shrink-0 fill-current" />
              <div className="flex-1"><p className="text-slate-700">{log.action}</p><p className="text-slate-400">{log.actor_name || log.actor_email} · {formatDateDDMMYYYY(log.created_date)}</p></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}