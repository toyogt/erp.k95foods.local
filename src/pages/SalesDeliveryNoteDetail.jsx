/**
 * Delivery Note Detail Page — dedicated page for a single Delivery Note.
 * Full DN workflow: Waiting for Transporter → Loading → Bills Generated → Cancelled
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { ArrowLeft, Truck, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { fireFMSEvent } from '@/lib/useFMSAutoComplete';

const WORKFLOW_STEPS = [
  { key: 'waiting_for_transporter', label: 'Waiting for Transporter' },
  { key: 'waiting_for_loading',     label: 'Waiting for Loading' },
  { key: 'loading_completed',       label: 'Loading Completed' },
  { key: 'bills_generated',         label: 'Bills Generated' },
];

const TRANSITIONS = [
  { from: 'waiting_for_transporter', action: 'Transporter Arrived', next: 'waiting_for_loading' },
  { from: 'waiting_for_loading',     action: 'Loading Completed',   next: 'loading_completed' },
  { from: 'loading_completed',       action: 'Bills Generated',     next: 'bills_generated' },
];

const REVERSE = [
  { from: 'bills_generated', action: 'Bills Cancelled', next: 'loading_completed' },
];

const STATUS_COLOR = {
  waiting_for_transporter: 'bg-amber-100 text-amber-800',
  waiting_for_loading:     'bg-blue-100 text-blue-800',
  loading_completed:       'bg-indigo-100 text-indigo-800',
  bills_generated:         'bg-green-100 text-green-700',
  cancelled:               'bg-red-100 text-red-700',
};

export default function SalesDeliveryNoteDetail() {
  const params = new URLSearchParams(window.location.search);
  const dnId = params.get('id');
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const { data: dn, isLoading, refetch } = useQuery({
    queryKey: ['dn_detail', dnId],
    queryFn: () => base44.entities.SalesDeliveryNote.filter({ id: dnId }).then(r => r[0]),
    enabled: !!dnId,
  });

  if (isLoading) return <div className="p-8 text-center text-slate-400">Loading...</div>;
  if (!dn) return <div className="p-8 text-center text-slate-400">Delivery Note not found</div>;

  const stepIdx = WORKFLOW_STEPS.findIndex(s => s.key === dn.workflow_state);
  const nextT = TRANSITIONS.find(t => t.from === dn.workflow_state);
  const revT = REVERSE.find(t => t.from === dn.workflow_state);
  const canCancel = ['loading_completed', 'bills_generated'].includes(dn.workflow_state);
  const isCancelled = dn.workflow_state === 'cancelled';

  async function advance(nextState) {
    // DN condition: shipping_address required before Loading Completed (per DN Minimal Workflow JSON)
    if (nextState === 'loading_completed' && !dn.shipping_address) {
      toast({ title: 'Shipping address is required before marking Loading Completed', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const statusMap = { waiting_for_loading: 'loading', loading_completed: 'loaded', bills_generated: 'dispatched' };
    await base44.entities.SalesDeliveryNote.update(dnId, {
      workflow_state: nextState, status: statusMap[nextState] || dn.status,
    });
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesDeliveryNote', entity_id: dnId,
      reference_number: dn.dn_number, action: `workflow_${nextState}`,
      old_value: dn.workflow_state, new_value: nextState, user_email: user?.email,
    });
    await fireFMSEvent('sales_dn_advanced', dnId);
    setSaving(false);
    toast({ title: `Delivery Note → ${WORKFLOW_STEPS.find(s => s.key === nextState)?.label || nextState}` });
    refetch();
  }

  async function handleCancel() {
    if (!cancelReason.trim()) { toast({ title: 'Reason required', variant: 'destructive' }); return; }
    setSaving(true);
    await base44.entities.SalesDeliveryNote.update(dnId, {
      workflow_state: 'cancelled', status: 'cancelled', cancellation_reason: cancelReason,
    });
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesDeliveryNote', entity_id: dnId,
      reference_number: dn.dn_number, action: 'cancelled',
      notes: cancelReason, user_email: user?.email,
    });
    setSaving(false); setShowCancel(false);
    toast({ title: 'Delivery Note cancelled' });
    refetch();
  }

  return (
    <div className="p-3 md:p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link to={`/SalesOrderDetail?id=${dn.sales_order_id}`} className="mt-1 text-slate-500 hover:text-slate-900">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{dn.dn_number}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[dn.workflow_state] || 'bg-slate-100 text-slate-600'}`}>
              {WORKFLOW_STEPS.find(s => s.key === dn.workflow_state)?.label || dn.workflow_state}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Sales Order: <Link to={`/SalesOrderDetail?id=${dn.sales_order_id}`} className="text-blue-600 hover:underline">{dn.so_number}</Link>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canCancel && !showCancel && (
            <Button variant="outline" className="h-11 text-sm text-red-600 border-red-200 hover:bg-red-50" onClick={() => setShowCancel(true)}>
              <XCircle className="w-4 h-4 mr-1" /> Cancel
            </Button>
          )}
          {revT && !isCancelled && (
            <Button variant="outline" className="h-11 text-sm text-amber-700 border-amber-300 hover:bg-amber-50"
              onClick={() => advance(revT.next)} disabled={saving}>
              {revT.action}
            </Button>
          )}
          {nextT && !isCancelled && (
            <Button className="h-11 bg-slate-900 text-white text-sm" onClick={() => advance(nextT.next)} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              {nextT.action}
            </Button>
          )}
        </div>
      </div>

      {/* Workflow progress */}
      {!isCancelled && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto">
          <div className="flex items-center min-w-max">
            {WORKFLOW_STEPS.map((step, i) => {
              const done = stepIdx > i; const active = stepIdx === i;
              return (
                <div key={step.key} className="flex items-center">
                  <div className="flex flex-col items-center gap-1 px-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${done ? 'bg-green-100 text-green-600' : active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      {done ? <CheckCircle2 className="w-4 h-4" /> : (i + 1)}
                    </div>
                    <span className={`text-xs font-medium text-center max-w-[80px] ${active ? 'text-slate-900' : done ? 'text-green-700' : 'text-slate-400'}`}>{step.label}</span>
                  </div>
                  {i < WORKFLOW_STEPS.length - 1 && <div className={`w-8 h-0.5 mb-5 ${done ? 'bg-green-400' : 'bg-slate-200'}`} />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cancel form */}
      {showCancel && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-red-800">Cancel Delivery Note</h4>
          <Input className="h-9 text-sm border-red-300" value={cancelReason}
            onChange={e => setCancelReason(e.target.value)} placeholder="Reason..." />
          <div className="flex gap-2">
            <Button variant="outline" className="h-11 text-sm" onClick={() => setShowCancel(false)}>Back</Button>
            <Button className="h-11 bg-red-600 hover:bg-red-700 text-white text-sm" onClick={handleCancel} disabled={saving}>Confirm Cancel</Button>
          </div>
        </div>
      )}

      {isCancelled && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
          <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Delivery Note Cancelled</p>
            {dn.cancellation_reason && <p className="text-xs text-red-600 mt-1">Reason: {dn.cancellation_reason}</p>}
          </div>
        </div>
      )}

      {/* Details grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          ['Customer', dn.customer_name],
          ['Transporter', dn.transporter_name],
          ['Vehicle Number', dn.vehicle_number],
          ['LR Number', dn.lr_number],
          ['Packaging Type', dn.packaging_type],
          ['Dispatch Date', dn.dispatch_date],
          ['Appointment Date', dn.appointment_date],
          ['Total Quantity', dn.total_qty ? `${dn.total_qty} pieces` : null],
          ['Total Boxes', dn.total_boxes],
          ['Created By', dn.created_by_email],
        ].filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="bg-white border border-slate-200 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">{k}</p>
            <p className="text-sm font-medium text-slate-900">{v}</p>
          </div>
        ))}
      </div>

      {dn.shipping_address && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-2">Shipping Address</p>
          <p className="text-sm text-slate-800 whitespace-pre-line">{dn.shipping_address}</p>
        </div>
      )}
    </div>
  );
}