/**
 * Logistics Review Panel — Unified layout.
 * Merged order items table (stock + weight + Set Now).
 * Transporter, packaging, weight are optional at this stage (can be filled at picklist).
 * Highlighted if missing but not blocking.
 */
import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle2, Loader2, Truck, Package, Calendar, Scale, AlertCircle, Info } from 'lucide-react';
import { fireFMSEvent, linkFMSRef, findFMSInstanceByRef } from '@/lib/useFMSAutoComplete';
import { generateDocNumber } from '@/lib/docNumberHelper';
import SystemEstimateCard from '@/components/sales/logistics/SystemEstimateCard';
import PlannedCostForm from '@/components/sales/logistics/PlannedCostForm';
import ExtraChargesSection from '@/components/sales/logistics/ExtraChargesSection';
import ActualCostForm from '@/components/sales/logistics/ActualCostForm';
import CostComparisonCard from '@/components/sales/logistics/CostComparisonCard';
import OrderItemsReviewTable from '@/components/sales/logistics/OrderItemsReviewTable';

export default function SOLogisticsReviewPanel({ order, onUpdated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    transporter: order?.transporter || '',
    packaging_type: order?.packaging_type || '',
    appointment_date: order?.po_delivery_date || '',
    dispatch_date: order?.planned_dispatch_date || '',
  });
  const [weightInput, setWeightInput] = useState('');

  const { data: settingsList = [] } = useQuery({
    queryKey: ['sales_settings'],
    queryFn: () => base44.entities.SalesSettings.list(),
  });
  const transporters = settingsList.find(s => s.setting_key === 'transporters')?.values || [];
  const packingTypes = settingsList.find(s => s.setting_key === 'packing_types')?.values || [];

  // Logistics cost data
  const { data: costRecords = [] } = useQuery({
    queryKey: ['order-logistics-cost', order?.id],
    queryFn: () => base44.entities.OrderLogisticsCost.filter({ sales_order_id: order.id }),
    enabled: !!order?.id,
  });
  const costRecord = costRecords[0] || null;

  const { data: rateCards = [] } = useQuery({
    queryKey: ['transport-rate-cards'],
    queryFn: () => base44.entities.TransportRateCard.filter({ is_active: true }),
    staleTime: 120000,
  });

  const orderWeight = costRecord?.order_weight_kg || Number(weightInput) || 0;
  const matchedCard = rateCards.find(rc =>
    orderWeight >= rc.weight_from_kg && orderWeight <= rc.weight_to_kg &&
    (!form.transporter || !rc.transporter || rc.transporter === form.transporter)
  ) || rateCards.find(rc =>
    orderWeight >= rc.weight_from_kg && orderWeight <= rc.weight_to_kg
  );

  const alreadyApproved = order?.workflow_state === 'ready_to_pick';
  const isInReview = order?.workflow_state === 'under_logistics_review';
  const isDelivered = ['delivered', 'paid', 'closed'].includes(order?.status);

  // Track what's missing (for highlighting, not blocking)
  const missingFields = [];
  if (!form.transporter) missingFields.push('Transporter');
  if (!form.packaging_type) missingFields.push('Packaging Type');

  const generateSystemEstimate = () => {
    if (!matchedCard) return {};
    return {
      system_freight: matchedCard.freight_cost || 0,
      system_door_delivery: matchedCard.door_delivery_cost || 0,
      system_bilty: matchedCard.bilty_cost || 0,
      system_labour: matchedCard.labour_cost || 0,
      system_pickup: matchedCard.pickup_charges || 0,
      system_late_fees: matchedCard.late_fees || 0,
      system_total: (matchedCard.freight_cost || 0) + (matchedCard.door_delivery_cost || 0) +
        (matchedCard.bilty_cost || 0) + (matchedCard.labour_cost || 0) +
        (matchedCard.pickup_charges || 0) + (matchedCard.late_fees || 0),
      rate_card_id: matchedCard.id,
    };
  };

  const saveCostData = async (updates) => {
    setSaving(true);
    if (costRecord) {
      await base44.entities.OrderLogisticsCost.update(costRecord.id, updates);
    } else {
      const sysEstimate = generateSystemEstimate();
      await base44.entities.OrderLogisticsCost.create({
        sales_order_id: order.id, so_number: order.so_number,
        order_weight_kg: orderWeight, status: 'pending_plan',
        ...sysEstimate, ...updates,
      });
    }
    qc.invalidateQueries({ queryKey: ['order-logistics-cost', order.id] });
    toast({ title: 'Logistics cost saved' });
    setSaving(false);
  };

  const handleSetWeight = async () => {
    const w = Number(weightInput);
    if (!w || w <= 0) { toast({ title: 'Enter a valid weight', variant: 'destructive' }); return; }
    await saveCostData({ order_weight_kg: w, ...generateSystemEstimate(), status: costRecord?.status || 'pending_plan' });
  };

  async function handleApprove() {
    if (!form.transporter) { toast({ title: 'Transporter Name is required', variant: 'destructive' }); return; }
    if (!form.packaging_type) { toast({ title: 'Packaging Type is required', variant: 'destructive' }); return; }
    setSaving(true);
    await base44.entities.SalesOrder.update(order.id, {
      transporter: form.transporter, packaging_type: form.packaging_type,
      workflow_state: 'ready_to_pick', status: 'picking',
    });
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesOrder', entity_id: order.id,
      reference_number: order.so_number, action: 'approved_for_picking',
      new_value: `Transporter: ${form.transporter}, Packaging: ${form.packaging_type}`,
      user_email: user?.email,
    });
    await fireFMSEvent('sales_picking_started', order.id);

    // Auto-generate Picklist
    const plNumber = await generateDocNumber('PL');
    const soItems = await base44.entities.SalesOrderItem.filter({ sales_order_id: order.id });
    const plItems = soItems.map(item => ({
      sales_order_item_id: item.id, item_code: item.sku_code || item.item_code || '',
      description: item.description, location: item.location || '',
      required_qty: item.quantity || 0, picked_qty: 0, status: 'pending',
    }));
    const newPicklist = await base44.entities.SalesPicklist.create({
      sales_order_id: order.id, so_number: order.so_number,
      picklist_number: plNumber, status: 'draft',
      transporter: form.transporter, packaging_type: form.packaging_type,
      appointment_date: form.appointment_date || '', dispatch_date: form.dispatch_date || '',
      expiry_date: order.po_expiry_date || '', generated_by: user?.email, items: plItems,
    });
    const instances = await findFMSInstanceByRef(order.id);
    if (instances[0]) await linkFMSRef(instances[0].id, newPicklist.id);
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesPicklist', entity_id: newPicklist.id,
      reference_number: plNumber, action: 'created',
      new_value: `Auto-generated from ${order.so_number}`, user_email: user?.email,
    });

    setSaving(false);
    toast({ title: 'Approved for Picking', description: `Picklist ${plNumber} generated automatically` });
    if (onUpdated) onUpdated();
  }

  async function handleSendForReview() {
    if (!order.billing_address && !order.shipping_address) {
      toast({ title: 'Customer address is required before logistics review', variant: 'destructive' }); return;
    }
    setSaving(true);
    await base44.entities.SalesOrder.update(order.id, {
      workflow_state: 'under_logistics_review', status: 'logistics_review',
    });
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesOrder', entity_id: order.id,
      reference_number: order.so_number, action: 'sent_for_logistics_review', user_email: user?.email,
    });
    await fireFMSEvent('sales_logistics_review', order.id);
    setSaving(false);
    toast({ title: 'Sent for Logistics Review' });
    if (onUpdated) onUpdated();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Logistics Review</h3>
          <p className="text-xs text-slate-500 mt-0.5">Review items, set logistics details, and approve for picking.</p>
        </div>
        {alreadyApproved && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-800 font-medium">Approved for Picking</span>
          </div>
        )}
      </div>

      {/* ── Merged Order Items Table (Stock + Weight + Set Now) ── */}
      <OrderItemsReviewTable order={order} />

      {/* ── Logistics Details (optional — highlighted if missing) ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5" /> Logistics Details
          </h4>
          {missingFields.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              <Info className="w-3 h-3" /> Optional — can be set at picklist stage
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Transporter */}
          <div>
            <Label className="text-xs font-medium text-slate-700 flex items-center gap-1">
              Transporter Name
              {!form.transporter && <span className="text-amber-500 text-xs">*</span>}
            </Label>
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
            {form.transporter && matchedCard && (
              <p className="text-xs text-green-700 mt-1">
                Rate card matched: {matchedCard.weight_from_kg}–{matchedCard.weight_to_kg} kg
              </p>
            )}
          </div>

          {/* Packaging Type */}
          <div>
            <Label className="text-xs font-medium text-slate-700 flex items-center gap-1">
              <Package className="w-3 h-3" /> Packaging Type
              {!form.packaging_type && <span className="text-amber-500 text-xs">*</span>}
            </Label>
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

          {/* Appointment Date */}
          <div>
            <Label className="text-xs font-medium text-slate-700 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Appointment Date
            </Label>
            <Input type="date" className="h-9 text-sm mt-1" value={form.appointment_date}
              onChange={e => setForm(f => ({ ...f, appointment_date: e.target.value }))} />
          </div>

          {/* Planned Dispatch Date */}
          <div>
            <Label className="text-xs font-medium text-slate-700 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Planned Dispatch Date
            </Label>
            <Input type="date" className="h-9 text-sm mt-1" value={form.dispatch_date}
              onChange={e => setForm(f => ({ ...f, dispatch_date: e.target.value }))} />
            {order.po_delivery_date && (
              <p className="text-xs text-slate-500 mt-1">Purchase Order Delivery: {order.po_delivery_date}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Weight & Transportation Cost (collapsible, optional) ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
          <Scale className="w-3.5 h-3.5" /> Order Weight & Transportation Estimate
        </h4>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px] max-w-xs">
            <Label className="text-xs font-medium text-slate-700">Order Weight (kg)</Label>
            <Input className="h-9 text-sm mt-1" type="number"
              value={costRecord?.order_weight_kg || weightInput}
              onChange={e => !costRecord?.order_weight_kg && setWeightInput(e.target.value)}
              placeholder="Enter total order weight"
              disabled={!!costRecord?.order_weight_kg} />
          </div>
          {!costRecord?.order_weight_kg && (
            <Button className="h-11 text-sm bg-slate-900 hover:bg-slate-800 text-white" onClick={handleSetWeight} disabled={saving}>
              Calculate Estimate
            </Button>
          )}
        </div>
        <SystemEstimateCard costRecord={costRecord} compact />
      </div>

      {/* ── Planned Transportation Cost ── */}
      <PlannedCostForm costRecord={costRecord} onSave={async (data) => {
        await saveCostData({ ...data, status: 'planned', planned_by: user?.email });
      }} saving={saving} />

      {/* Extra Charges */}
      <ExtraChargesSection
        charges={costRecord?.extra_charges || []}
        confirmed={costRecord?.extra_charges_confirmed}
        onSave={saveCostData}
        saving={saving}
      />

      {/* Actual Cost (Post-Delivery) */}
      {isDelivered && (
        <ActualCostForm costRecord={costRecord} onSave={async (data) => {
          const planTotal = costRecord?.planned_total || 0;
          const sysTotal = costRecord?.system_total || 0;
          const actTotal = data.actual_total || 0;
          const accuracy = planTotal > 0 ? Math.max(0, 100 - Math.abs((actTotal - planTotal) / planTotal * 100)) : null;
          await saveCostData({
            ...data, status: 'completed', actual_entered_by: user?.email,
            variance_system_vs_actual: sysTotal > 0 ? actTotal - sysTotal : undefined,
            variance_planned_vs_actual: planTotal > 0 ? actTotal - planTotal : undefined,
            accuracy_pct: accuracy !== null ? Number(accuracy.toFixed(1)) : undefined,
          });
        }} saving={saving} />
      )}

      {/* Cost Comparison */}
      <CostComparisonCard costRecord={costRecord} />

      {/* ── Action Buttons ── */}
      <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-200">
        {order.workflow_state === 'draft' && (
          <Button className="h-11 bg-slate-900 text-white text-sm" onClick={handleSendForReview} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Send for Logistics Review
          </Button>
        )}
        {isInReview && (
          <div className="space-y-2">
            {missingFields.length > 0 && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Required before approval</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Please set: {missingFields.join(', ')}
                  </p>
                </div>
              </div>
            )}
            <Button className="h-11 bg-green-700 hover:bg-green-800 text-white text-sm"
              onClick={handleApprove} disabled={saving || missingFields.length > 0}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Approve for Picking
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}