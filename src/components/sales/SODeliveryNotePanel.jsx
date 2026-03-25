import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Truck, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import { fireFMSEvent, linkFMSRef, findFMSInstanceByRef } from '@/lib/useFMSAutoComplete';

const WORKFLOW_LABELS = {
  waiting_for_transporter: 'Waiting for Transporter',
  waiting_for_loading: 'Waiting for Loading to Complete',
  loading_completed: 'Loading Completed & Waiting for Bills',
  bills_generated: 'Bills Generated',
  submitted: 'Submitted',
};

const WORKFLOW_COLORS = {
  waiting_for_transporter: 'bg-amber-100 text-amber-800',
  waiting_for_loading: 'bg-blue-100 text-blue-800',
  loading_completed: 'bg-indigo-100 text-indigo-800',
  bills_generated: 'bg-green-100 text-green-700',
  submitted: 'bg-green-100 text-green-700',
};

export default function SODeliveryNotePanel({ order, items, onUpdated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [form, setForm] = useState({
    transporter_name: '',
    vehicle_number: '',
    lr_number: '',
    packaging_type: '',
    dispatch_date: '',
    appointment_date: '',
    expiry_date: order?.po_expiry_date || '',
    notes: '',
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
      toast({ title: 'Transporter and packaging type are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const dnNumber = `DN-${Date.now().toString().slice(-8)}`;

    const dn = await base44.entities.SalesDeliveryNote.create({
      ...form,
      sales_order_id: order.id,
      so_number: order.so_number,
      dn_number: dnNumber,
      customer_name: order.customer_name,
      customer_gstin: order.customer_gstin,
      shipping_address: order.shipping_address,
      total_qty: totalQty,
      total_boxes: totalBoxes,
      workflow_state: 'waiting_for_transporter',
      status: 'draft',
      created_by_email: user?.email,
    });

    const instances = await findFMSInstanceByRef(order.id);
    if (instances[0]) await linkFMSRef(instances[0].id, dn.id);
    await fireFMSEvent('sales_dn_created', order.id);

    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesDeliveryNote', entity_id: dn.id,
      reference_number: dnNumber, action: 'created', user_email: user?.email,
    });

    setSaving(false);
    toast({ title: 'Delivery Note created', description: dnNumber });
    refetch();
    onUpdated();
  }

  async function advanceWorkflow(nextState) {
    if (!activeDN) return;
    setAdvancing(true);

    const statusMap = {
      waiting_for_loading: 'loading',
      loading_completed: 'loaded',
      bills_generated: 'dispatched',
      submitted: 'dispatched',
    };

    await base44.entities.SalesDeliveryNote.update(activeDN.id, {
      workflow_state: nextState,
      status: statusMap[nextState] || activeDN.status,
    });

    if (nextState === 'loading_completed' || nextState === 'bills_generated') {
      await base44.entities.SalesOrder.update(order.id, { status: 'dispatched' });
    }

    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesDeliveryNote', entity_id: activeDN.id,
      reference_number: activeDN.dn_number,
      action: `workflow_${nextState}`,
      old_value: activeDN.workflow_state,
      new_value: nextState,
      user_email: user?.email,
    });

    setAdvancing(false);
    toast({ title: `Delivery Note updated to: ${WORKFLOW_LABELS[nextState]}` });
    refetch();
    onUpdated();
  }

  const WORKFLOW_TRANSITIONS = [
    { from: 'waiting_for_transporter', action: 'Transporter Arrived', next: 'waiting_for_loading' },
    { from: 'waiting_for_loading', action: 'Loading Completed', next: 'loading_completed' },
    { from: 'loading_completed', action: 'Bills Generated', next: 'bills_generated' },
    { from: 'bills_generated', action: 'Submit', next: 'submitted' },
  ];

  if (activeDN) {
    const nextTransition = WORKFLOW_TRANSITIONS.find(t => t.from === activeDN.workflow_state);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-lg flex-1">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium text-indigo-700">{activeDN.dn_number}</span>
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${WORKFLOW_COLORS[activeDN.workflow_state] || 'bg-slate-100 text-slate-600'}`}>
              {WORKFLOW_LABELS[activeDN.workflow_state] || activeDN.workflow_state}
            </span>
          </div>
          {nextTransition && (
            <Button
              className="h-11 bg-slate-900 text-white text-sm"
              onClick={() => advanceWorkflow(nextTransition.next)}
              disabled={advancing}
            >
              {advancing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              {nextTransition.action}
            </Button>
          )}
        </div>

        {/* Workflow progress */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto">
          <div className="flex items-center min-w-max gap-0">
            {WORKFLOW_TRANSITIONS.map((t, i) => {
              const states = WORKFLOW_TRANSITIONS.map(tr => tr.from);
              states.push('submitted');
              const currentIdx = states.indexOf(activeDN.workflow_state);
              const stepIdx = i;
              const done = currentIdx > stepIdx;
              const active = currentIdx === stepIdx;
              return (
                <div key={t.from} className="flex items-center">
                  <div className="flex flex-col items-center gap-1 px-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                      done ? 'bg-green-100 text-green-600' : active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : (i + 1)}
                    </div>
                    <span className={`text-xs font-medium max-w-[80px] text-center ${active ? 'text-slate-900' : done ? 'text-green-700' : 'text-slate-400'}`}>
                      {WORKFLOW_LABELS[t.from]?.split(' ').slice(0, 2).join(' ')}
                    </span>
                  </div>
                  {i < WORKFLOW_TRANSITIONS.length - 1 && (
                    <div className={`w-6 h-0.5 mb-5 ${done ? 'bg-green-400' : 'bg-slate-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          {[
            ['Transporter', activeDN.transporter_name],
            ['Vehicle', activeDN.vehicle_number || '—'],
            ['LR Number', activeDN.lr_number || '—'],
            ['Packaging', activeDN.packaging_type],
            ['Dispatch Date', activeDN.dispatch_date || '—'],
            ['Appointment Date', activeDN.appointment_date || '—'],
            ['Total Quantity', `${activeDN.total_qty} pcs`],
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
        <div className="flex justify-between text-slate-600">
          <span>Total Quantity</span><span className="font-medium">{totalQty} pieces</span>
        </div>
        <div className="flex justify-between text-slate-600 mt-1">
          <span>Total Boxes (estimated)</span><span className="font-medium">{totalBoxes} boxes</span>
        </div>
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