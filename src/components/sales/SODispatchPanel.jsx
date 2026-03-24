import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Truck, CheckCircle2, AlertTriangle } from 'lucide-react';
import { fireFMSEvent, linkFMSRef, findFMSInstanceByRef } from '@/lib/useFMSAutoComplete';

export default function SODispatchPanel({ order, onUpdated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    transporter_name: '',
    vehicle_number: '',
    lr_number: '',
    packing_type: '',
    planned_dispatch_date: '',
    actual_dispatch_date: '',
    total_boxes: '',
    total_weight_kg: '',
    notes: '',
  });

  const { data: settingsList = [] } = useQuery({
    queryKey: ['sales_settings'],
    queryFn: () => base44.entities.SalesSettings.list(),
  });

  const transporters = settingsList.find(s => s.setting_key === 'transporters')?.values || ['DTDC', 'Local', 'Bluedart'];
  const packingTypes = settingsList.find(s => s.setting_key === 'packing_types')?.values || ['Master Carton 12-pcs', 'Master Carton 24-pcs'];
  const [error, setError] = useState('');

  const { data: dispatches = [], refetch } = useQuery({
    queryKey: ['dispatches', order.id],
    queryFn: () => base44.entities.SalesDispatch.filter({ sales_order_id: order.id }, '-created_date'),
  });

  const activeDispatch = dispatches[0];

  function validate() {
    if (!form.transporter_name) return 'Transporter name is required';
    if (!form.packing_type) return 'Packing / Box type is required';
    if (!form.planned_dispatch_date) return 'Planned dispatch date is required';
    return '';
  }

  async function handleDispatch() {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setSaving(true);

    const planned = new Date(form.planned_dispatch_date);
    const actual = form.actual_dispatch_date ? new Date(form.actual_dispatch_date) : null;
    const delayDays = actual ? Math.max(0, Math.round((actual - planned) / 86400000)) : 0;

    const dispatchNum = `DSP-${Date.now().toString().slice(-7)}`;
    const dispatch = await base44.entities.SalesDispatch.create({
      ...form,
      sales_order_id: order.id,
      so_number: order.so_number,
      dispatch_number: dispatchNum,
      delay_days: delayDays,
      status: 'dispatched',
      total_boxes: parseFloat(form.total_boxes) || 0,
      total_weight_kg: parseFloat(form.total_weight_kg) || 0,
    });

    await base44.entities.SalesOrder.update(order.id, { status: 'dispatched' });

    const instances = await findFMSInstanceByRef(order.id);
    if (instances[0]) await linkFMSRef(instances[0].id, dispatch.id);
    await fireFMSEvent('sales_dispatched', order.id);

    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesDispatch', entity_id: dispatch.id,
      reference_number: dispatchNum, action: 'created', user_email: user?.email,
      notes: delayDays > 0 ? `Delayed by ${delayDays} days: ${form.delay_reason}` : undefined,
    });

    setSaving(false);
    toast({ title: 'Dispatch recorded', description: dispatchNum });
    refetch(); onUpdated();
  }

  if (activeDispatch) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-lg">
          <Truck className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-medium text-indigo-700">Dispatch: {activeDispatch.dispatch_number}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          {[
            ['Transporter', activeDispatch.transporter_name],
            ['Vehicle', activeDispatch.vehicle_number || '—'],
            ['LR Number', activeDispatch.lr_number || '—'],
            ['Packing Type', activeDispatch.packing_type],
            ['Planned Dispatch', activeDispatch.planned_dispatch_date],
            ['Actual Dispatch', activeDispatch.actual_dispatch_date || '—'],
          ].map(([k, v]) => (
            <div key={k} className="bg-white border border-slate-200 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">{k}</p>
              <p className="font-medium text-slate-900">{v}</p>
            </div>
          ))}
        </div>
        {activeDispatch.delay_days > 0 && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Delayed by {activeDispatch.delay_days} day(s)</p>
              <p className="text-xs text-amber-600">{activeDispatch.delay_reason}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-900">Create Dispatch</h3>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium text-slate-700">Transporter Name *</Label>
          <Input className="h-9 text-sm mt-1" value={form.transporter_name}
            onChange={e => setForm(f => ({ ...f, transporter_name: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-700">Packing / Box Type *</Label>
          <Input className="h-9 text-sm mt-1" placeholder="e.g. Master Carton 24-pcs"
            value={form.packing_type}
            onChange={e => setForm(f => ({ ...f, packing_type: e.target.value }))} />
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
          <Label className="text-xs font-medium text-slate-700">Planned Dispatch Date *</Label>
          <Input type="date" className="h-9 text-sm mt-1" value={form.planned_dispatch_date}
            onChange={e => setForm(f => ({ ...f, planned_dispatch_date: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-700">Actual Dispatch Date</Label>
          <Input type="date" className="h-9 text-sm mt-1" value={form.actual_dispatch_date}
            onChange={e => setForm(f => ({ ...f, actual_dispatch_date: e.target.value }))} />
        </div>
        {form.actual_dispatch_date && form.planned_dispatch_date && new Date(form.actual_dispatch_date) > new Date(form.planned_dispatch_date) && (
          <div className="md:col-span-2">
            <Label className="text-xs font-medium text-amber-700">Delay Reason (required for delayed dispatch)</Label>
            <Input className="h-9 text-sm mt-1 border-amber-300" value={form.delay_reason}
              onChange={e => setForm(f => ({ ...f, delay_reason: e.target.value }))} />
          </div>
        )}
        <div>
          <Label className="text-xs font-medium text-slate-700">Total Boxes</Label>
          <Input type="number" className="h-9 text-sm mt-1" value={form.total_boxes}
            onChange={e => setForm(f => ({ ...f, total_boxes: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-700">Total Weight (kg)</Label>
          <Input type="number" className="h-9 text-sm mt-1" value={form.total_weight_kg}
            onChange={e => setForm(f => ({ ...f, total_weight_kg: e.target.value }))} />
        </div>
      </div>

      <div className="flex justify-end">
        <Button className="h-11 bg-slate-900 text-white text-sm" onClick={handleDispatch} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Truck className="w-4 h-4 mr-2" />}
          Record Dispatch
        </Button>
      </div>
    </div>
  );
}