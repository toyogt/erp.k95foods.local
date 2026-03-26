/**
 * Delivery Note Panel — mirrors DN Minimal Workflow:
 *   Waiting for Transporter → Transporter Arrived → Waiting for Loading
 *   → Loading Completed → Loading Completed & Waiting for Bills → Bills Generated → Submitted
 *   + Cancel option from Waiting for Transporter and Waiting for Loading
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Truck, CheckCircle2, FileText, XCircle } from 'lucide-react';
import { fireFMSEvent, linkFMSRef, findFMSInstanceByRef } from '@/lib/useFMSAutoComplete';

const WORKFLOW_STEPS = [
  { key: 'waiting_for_transporter', label: 'Waiting for Transporter' },
  { key: 'waiting_for_loading',     label: 'Waiting for Loading' },
  { key: 'loading_completed',       label: 'Loading Completed & Waiting for Bills' },
  { key: 'bills_generated',         label: 'Bills Generated' },
];

const WORKFLOW_COLORS = {
  waiting_for_transporter: 'bg-amber-100 text-amber-800',
  waiting_for_loading:     'bg-blue-100 text-blue-800',
  loading_completed:       'bg-indigo-100 text-indigo-800',
  bills_generated:         'bg-green-100 text-green-700',
  submitted:               'bg-green-100 text-green-700',
  cancelled:               'bg-red-100 text-red-700',
};

const TRANSITIONS = [
  { from: 'waiting_for_transporter', action: 'Transporter Arrived', next: 'waiting_for_loading' },
  { from: 'waiting_for_loading',     action: 'Loading Completed',   next: 'loading_completed' },
  { from: 'loading_completed',       action: 'Bills Generated',     next: 'bills_generated' },
];

// Bills Cancelled: revert bills_generated → loading_completed
const REVERSE_TRANSITIONS = [
  { from: 'bills_generated', action: 'Bills Cancelled', next: 'loading_completed' },
];

// Cancel allowed from loading_completed and bills_generated (per JSON)
const CANCELLABLE_STATES = ['loading_completed', 'bills_generated'];

export default function SODeliveryNotePanel({ order, items, onUpdated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [form, setForm] = useState({
    transporter_name: '', vehicle_number: '', lr_number: '', packaging_type: '',
    dispatch_date: '', appointment_date: '', expiry_date: order?.po_expiry_date || '', notes: '',
  });

  const { data: settingsList = [] } = useQuery({
    queryKey: ['sales_settings'],
    queryFn: () => base44.entities.SalesSettings.list(),
  });

  const transporters = settingsList.find(s => s.setting_key === 'transporters')?.values || [];
  const packingTypes = settingsList.find(s => s.setting_key === 'packing_types')?.values || [];

  const { data: deliveryNotes = [], refetch } = useQuery({
    queryKey: ['delivery_notes', order.id],
    queryFn: () => base44.entities.SalesDeliveryNote.filter({ sales_order_id: order.id }, '-created_date'),
  });

  const activeDN = deliveryNotes[0];
  const totalQty = items.reduce((s, i) => s + (i.quantity || 0), 0);
  const totalBoxes = items.reduce((s, i) => {
    const pu = i.packing_unit || 12;
    return s + Math.ceil((i.quantity || 0) / pu);
  }, 0);

  async function createDeliveryNote() {
    if (!form.transporter_name || !form.packaging_type) {
      toast({ title: 'Transporter and packaging type are required', variant: 'destructive' }); return;
    }
    setSaving(true);
    const dnNumber = `DN-${Date.now().toString().slice(-8)}`;
    const dn = await base44.entities.SalesDeliveryNote.create({
      ...form, sales_order_id: order.id, so_number: order.so_number, dn_number: dnNumber,
      customer_name: order.customer_name, customer_gstin: order.customer_gstin,
      shipping_address: order.shipping_address, total_qty: totalQty, total_boxes: totalBoxes,
      workflow_state: 'waiting_for_transporter', status: 'draft', created_by_email: user?.email,
    });
    const instances = await findFMSInstanceByRef(order.id);
    if (instances[0]) await linkFMSRef(instances[0].id, dn.id);
    await fireFMSEvent('sales_dn_created', order.id);
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesDeliveryNote', entity_id: dn.id, reference_number: dnNumber,
      action: 'created', user_email: user?.email,
    });
    setSaving(false);
    toast({ title: 'Delivery Note created', description: dnNumber });
    refetch(); onUpdated();
  }

  // Mirrors ERPNext "DN Mandatory" client script:
  // Each workflow state transition requires specific fields to be filled
  function validateMandatoryForTransition(nextState) {
    const missing = [];
    if (nextState === 'waiting_for_loading') {
      // Transporter Arrived → requires transporter, vehicle number
      if (!activeDN.transporter_name) missing.push('Transporter Name');
      if (!activeDN.vehicle_number) missing.push('Vehicle Number');
      if (!activeDN.lr_number) missing.push('Transport Receipt Number (LR)');
    }
    if (nextState === 'loading_completed') {
      // Loading Completed → shipping_address (per DN Minimal Workflow JSON condition)
      if (!activeDN.shipping_address && !order.shipping_address) missing.push('Shipping Address');
    }
    if (nextState === 'bills_generated') {
      // Bills Generated → dispatch_date required
      if (!activeDN.dispatch_date) missing.push('Dispatch Date');
    }
    return missing;
  }

  async function advanceWorkflow(nextState) {
    if (!activeDN) return;
    const missing = validateMandatoryForTransition(nextState);
    if (missing.length > 0) {
      toast({ title: `Required before proceeding: ${missing.join(', ')}`, variant: 'destructive' });
      return;
    }
    setAdvancing(true);
    const statusMap = {
      waiting_for_loading: 'loading', loading_completed: 'loaded',
      bills_generated: 'dispatched',
    };
    await base44.entities.SalesDeliveryNote.update(activeDN.id, {
      workflow_state: nextState, status: statusMap[nextState] || activeDN.status,
    });
    await fireFMSEvent('sales_dn_advanced', activeDN.id);
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesDeliveryNote', entity_id: activeDN.id, reference_number: activeDN.dn_number,
      action: `workflow_${nextState}`, old_value: activeDN.workflow_state,
      new_value: nextState, user_email: user?.email,
    });
    setAdvancing(false);
    toast({ title: `Delivery Note → ${WORKFLOW_STEPS.find(s => s.key === nextState)?.label || nextState}` });
    refetch(); onUpdated();
  }

  async function handleCancel() {
    if (!cancelReason.trim()) {
      toast({ title: 'Cancellation reason is required', variant: 'destructive' }); return;
    }
    setAdvancing(true);
    await base44.entities.SalesDeliveryNote.update(activeDN.id, {
      workflow_state: 'cancelled', status: 'cancelled', cancellation_reason: cancelReason,
    });
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesDeliveryNote', entity_id: activeDN.id, reference_number: activeDN.dn_number,
      action: 'cancelled', old_value: activeDN.workflow_state, new_value: 'cancelled',
      notes: cancelReason, user_email: user?.email,
    });
    setAdvancing(false);
    setShowCancel(false);
    toast({ title: 'Delivery Note cancelled' });
    refetch(); onUpdated();
  }

  if (activeDN) {
    const isCancelled = activeDN.workflow_state === 'cancelled';
    const nextTransition = TRANSITIONS.find(t => t.from === activeDN.workflow_state);
    const reverseTransition = REVERSE_TRANSITIONS.find(t => t.from === activeDN.workflow_state);
    const canCancel = CANCELLABLE_STATES.includes(activeDN.workflow_state);

    return (
      <div className="space-y-4">
        {/* Header with DN number and status */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-lg flex-1">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium text-indigo-700">{activeDN.dn_number}</span>
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${WORKFLOW_COLORS[activeDN.workflow_state] || 'bg-slate-100 text-slate-600'}`}>
              {WORKFLOW_STEPS.find(s => s.key === activeDN.workflow_state)?.label || activeDN.workflow_state}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {canCancel && !showCancel && (
              <Button variant="outline" className="h-11 text-sm text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setShowCancel(true)}>
                <XCircle className="w-4 h-4 mr-1" /> Cancel
              </Button>
            )}
            {reverseTransition && !isCancelled && (
              <Button variant="outline" className="h-11 text-sm text-amber-700 border-amber-300 hover:bg-amber-50"
                onClick={() => advanceWorkflow(reverseTransition.next)} disabled={advancing}>
                <XCircle className="w-4 h-4 mr-1" /> {reverseTransition.action}
              </Button>
            )}
            {nextTransition && !isCancelled && (
              <Button className="h-11 bg-slate-900 text-white text-sm"
                onClick={() => advanceWorkflow(nextTransition.next)} disabled={advancing}>
                {advancing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                {nextTransition.action}
              </Button>
            )}
          </div>
        </div>

        {/* Cancel form */}
        {showCancel && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-semibold text-red-800">Cancel Delivery Note</h4>
            <div>
              <Label className="text-xs font-medium text-red-700">Reason for Cancellation *</Label>
              <Input className="h-9 text-sm mt-1 border-red-300" value={cancelReason}
                onChange={e => setCancelReason(e.target.value)} placeholder="Enter reason..." />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="h-11 text-sm" onClick={() => setShowCancel(false)}>Back</Button>
              <Button className="h-11 bg-red-600 hover:bg-red-700 text-white text-sm" onClick={handleCancel} disabled={advancing}>
                {advancing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
                Confirm Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Workflow progress bar */}
        {!isCancelled && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto">
            <div className="flex items-center min-w-max gap-0">
              {WORKFLOW_STEPS.map((step, i) => {
                const currentIdx = WORKFLOW_STEPS.findIndex(s => s.key === activeDN.workflow_state);
                const done = currentIdx > i;
                const active = currentIdx === i;
                return (
                  <div key={step.key} className="flex items-center">
                    <div className="flex flex-col items-center gap-1 px-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                        done ? 'bg-green-100 text-green-600' : active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : (i + 1)}
                      </div>
                      <span className={`text-xs font-medium max-w-[90px] text-center ${active ? 'text-slate-900' : done ? 'text-green-700' : 'text-slate-400'}`}>
                        {step.label.split('&')[0].trim()}
                      </span>
                    </div>
                    {i < WORKFLOW_STEPS.length - 1 && (
                      <div className={`w-6 h-0.5 mb-5 ${done ? 'bg-green-400' : 'bg-slate-200'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cancelled banner */}
        {isCancelled && (
          <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
            <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">Delivery Note Cancelled</p>
              {activeDN.cancellation_reason && <p className="text-xs text-red-600 mt-1">Reason: {activeDN.cancellation_reason}</p>}
            </div>
          </div>
        )}

        {/* Details grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          {[
            ['Transporter', activeDN.transporter_name],
            ['Vehicle', activeDN.vehicle_number || '—'],
            ['LR Number', activeDN.lr_number || '—'],
            ['Packaging', activeDN.packaging_type],
            ['Dispatch Date', activeDN.dispatch_date || '—'],
            ['Appointment Date', activeDN.appointment_date || '—'],
            ['Total Quantity', `${activeDN.total_qty} pieces`],
            ['Total Boxes', activeDN.total_boxes || '—'],
          ].map(([k, v]) => (
            <div key={k} className="bg-white border border-slate-200 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">{k}</p>
              <p className="font-medium text-slate-900">{v}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Create new DN form
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-900">Create Delivery Note</h3>
      <p className="text-xs text-slate-500">Create a delivery note before or when the transporter arrives.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium text-slate-700">Transporter Name *</Label>
          <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.transporter_name} onChange={e => setForm(f => ({ ...f, transporter_name: e.target.value }))}>
            <option value="">Select transporter...</option>
            {transporters.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-700">Packaging Type *</Label>
          <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.packaging_type} onChange={e => setForm(f => ({ ...f, packaging_type: e.target.value }))}>
            <option value="">Select packaging...</option>
            {packingTypes.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-700">Vehicle Number</Label>
          <Input className="h-9 text-sm mt-1" value={form.vehicle_number}
            onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-700">LR Number</Label>
          <Input className="h-9 text-sm mt-1" value={form.lr_number}
            onChange={e => setForm(f => ({ ...f, lr_number: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-700">Dispatch Date</Label>
          <Input type="date" className="h-9 text-sm mt-1" value={form.dispatch_date}
            onChange={e => setForm(f => ({ ...f, dispatch_date: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-700">Appointment Date</Label>
          <Input type="date" className="h-9 text-sm mt-1" value={form.appointment_date}
            onChange={e => setForm(f => ({ ...f, appointment_date: e.target.value }))} />
        </div>
      </div>
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
        <div className="flex justify-between text-slate-600"><span>Total Quantity</span><span className="font-medium">{totalQty} pieces</span></div>
        <div className="flex justify-between text-slate-600 mt-1"><span>Total Boxes (estimated)</span><span className="font-medium">{totalBoxes} boxes</span></div>
      </div>
      <div className="flex justify-end">
        <Button className="h-11 bg-slate-900 text-white text-sm" onClick={createDeliveryNote} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Truck className="w-4 h-4 mr-2" />}
          Create Delivery Note
        </Button>
      </div>
    </div>
  );
}