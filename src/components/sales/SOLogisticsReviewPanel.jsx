/**
 * Logistics Review tab — mirrors ERPNext "Logistics Review" tab.
 * Shows: Transporter Name, Packaging Type, Appointment Date, Planned Dispatch Date.
 * "Approve for Picking" button moves SO to ready_to_pick workflow_state.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { fireFMSEvent } from '@/lib/useFMSAutoComplete';

export default function SOLogisticsReviewPanel({ order, onUpdated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    transporter: order?.transporter || '',
    packaging_type: order?.packaging_type || '',
    appointment_date: order?.po_delivery_date || '',
    dispatch_date: order?.planned_dispatch_date || '',
  });

  const { data: settingsList = [] } = useQuery({
    queryKey: ['sales_settings'],
    queryFn: () => base44.entities.SalesSettings.list(),
  });
  const transporters = settingsList.find(s => s.setting_key === 'transporters')?.values || [];
  const packingTypes = settingsList.find(s => s.setting_key === 'packing_types')?.values || [];

  const alreadyApproved = order?.workflow_state === 'ready_to_pick';
  const isInReview = order?.workflow_state === 'under_logistics_review';

  async function handleApprove() {
    if (!form.transporter) {
      toast({ title: 'Transporter Name is required', variant: 'destructive' }); return;
    }
    if (!form.packaging_type) {
      toast({ title: 'Packaging Type is required', variant: 'destructive' }); return;
    }
    setSaving(true);
    await base44.entities.SalesOrder.update(order.id, {
      transporter: form.transporter,
      packaging_type: form.packaging_type,
      workflow_state: 'ready_to_pick',
      status: 'picking',
    });
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesOrder', entity_id: order.id,
      reference_number: order.so_number,
      action: 'approved_for_picking',
      new_value: `Transporter: ${form.transporter}, Packaging: ${form.packaging_type}`,
      user_email: user?.email,
    });
    await fireFMSEvent('sales_picking_started', order.id);
    setSaving(false);
    toast({ title: 'Approved for Picking', description: 'Sales Order is now Ready to Pick & Pack' });
    if (onUpdated) onUpdated();
  }

  async function handleSendForReview() {
    if (!order.billing_address && !order.shipping_address) {
      toast({ title: 'Customer address is required before logistics review', variant: 'destructive' }); return;
    }
    setSaving(true);
    await base44.entities.SalesOrder.update(order.id, {
      workflow_state: 'under_logistics_review',
      status: 'logistics_review',
    });
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesOrder', entity_id: order.id,
      reference_number: order.so_number,
      action: 'sent_for_logistics_review', user_email: user?.email,
    });
    await fireFMSEvent('sales_logistics_review', order.id);
    setSaving(false);
    toast({ title: 'Sent for Logistics Review' });
    if (onUpdated) onUpdated();
  }

  return (
    <div className="space-y-4 max-w-xl">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Logistics Review</h3>
        <p className="text-xs text-slate-500 mt-0.5">Set logistics details and approve the order for picking.</p>
      </div>

      {alreadyApproved && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <span className="text-green-800 font-medium">Approved for Picking</span>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <Label className="text-xs font-medium text-slate-700">Transporter Name *</Label>
          {transporters.length > 0 ? (
            <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.transporter} onChange={e => setForm(f => ({ ...f, transporter: e.target.value }))}>
              <option value="">Select transporter...</option>
              {transporters.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          ) : (
            <Input className="h-9 text-sm mt-1" value={form.transporter}
              onChange={e => setForm(f => ({ ...f, transporter: e.target.value }))}
              placeholder="Enter transporter name" />
          )}
        </div>

        <div>
          <Label className="text-xs font-medium text-slate-700">Packaging Type *</Label>
          {packingTypes.length > 0 ? (
            <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.packaging_type} onChange={e => setForm(f => ({ ...f, packaging_type: e.target.value }))}>
              <option value="">Select packaging type...</option>
              {packingTypes.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          ) : (
            <Input className="h-9 text-sm mt-1" value={form.packaging_type}
              onChange={e => setForm(f => ({ ...f, packaging_type: e.target.value }))}
              placeholder="Enter packaging type" />
          )}
        </div>

        <div>
          <Label className="text-xs font-medium text-slate-700">Appointment Date</Label>
          <Input type="date" className="h-9 text-sm mt-1" value={form.appointment_date}
            onChange={e => setForm(f => ({ ...f, appointment_date: e.target.value }))} />
        </div>

        <div>
          <Label className="text-xs font-medium text-slate-700">Planned Dispatch Date</Label>
          <Input type="date" className="h-9 text-sm mt-1" value={form.dispatch_date}
            onChange={e => setForm(f => ({ ...f, dispatch_date: e.target.value }))} />
          {order.po_delivery_date && (
            <p className="text-xs text-slate-500 mt-1">PO Delivery Date: {order.po_delivery_date}</p>
          )}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        {order.workflow_state === 'draft' && (
          <Button className="h-11 bg-slate-900 text-white text-sm" onClick={handleSendForReview} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Send for Logistics Review
          </Button>
        )}
        {isInReview && (
          <Button className="h-11 bg-green-700 hover:bg-green-800 text-white text-sm" onClick={handleApprove} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
            Approve for Picking
          </Button>
        )}
      </div>
    </div>
  );
}