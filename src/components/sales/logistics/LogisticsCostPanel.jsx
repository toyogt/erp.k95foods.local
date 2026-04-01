/**
 * LogisticsCostPanel — full logistics cost lifecycle for a Sales Order.
 * Shows: System estimate, user planned cost, extra charges, actual cost, comparison.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { COST_HEADS } from './costHeads';
import SystemEstimateCard from './SystemEstimateCard';
import PlannedCostForm from './PlannedCostForm';
import ExtraChargesSection from './ExtraChargesSection';
import ActualCostForm from './ActualCostForm';
import CostComparisonCard from './CostComparisonCard';
import WeightCalculatorPanel from './WeightCalculatorPanel';
import { Loader2, Scale, Lightbulb } from 'lucide-react';

export default function LogisticsCostPanel({ order }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [transporter, setTransporter] = useState(order?.transporter || '');

  // Fetch existing cost record for this order
  const { data: costRecords = [], isLoading } = useQuery({
    queryKey: ['order-logistics-cost', order?.id],
    queryFn: () => base44.entities.OrderLogisticsCost.filter({ sales_order_id: order.id }),
    enabled: !!order?.id,
  });
  const costRecord = costRecords[0] || null;

  // Fetch rate cards
  const { data: rateCards = [] } = useQuery({
    queryKey: ['transport-rate-cards'],
    queryFn: () => base44.entities.TransportRateCard.filter({ is_active: true }),
    staleTime: 120000,
  });

  const orderWeight = costRecord?.order_weight_kg || Number(weightInput) || 0;

  // Collect unique transporters from rate cards
  const transporterOptions = [...new Set(rateCards.map(rc => rc.transporter).filter(Boolean))];

  // Find matching rate card by weight AND transporter
  const matchedCard = rateCards.find(rc =>
    orderWeight >= rc.weight_from_kg && orderWeight <= rc.weight_to_kg &&
    (!transporter || !rc.transporter || rc.transporter === transporter)
  ) || rateCards.find(rc =>
    orderWeight >= rc.weight_from_kg && orderWeight <= rc.weight_to_kg
  );

  // Generate system estimate from rate card
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

  // Create or update cost record
  const saveCostData = async (updates) => {
    setSaving(true);
    try {
      if (costRecord) {
        await base44.entities.OrderLogisticsCost.update(costRecord.id, updates);
      } else {
        const sysEstimate = generateSystemEstimate();
        await base44.entities.OrderLogisticsCost.create({
          sales_order_id: order.id,
          so_number: order.so_number,
          order_weight_kg: orderWeight,
          status: 'pending_plan',
          ...sysEstimate,
          ...updates,
        });
      }
      qc.invalidateQueries({ queryKey: ['order-logistics-cost', order.id] });
      toast({ title: 'Logistics cost saved' });
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  // Save weight and generate estimate
  const handleSetWeight = async () => {
    const w = Number(weightInput);
    if (!w || w <= 0) {
      toast({ title: 'Enter a valid weight', variant: 'destructive' }); return;
    }
    const sysEstimate = generateSystemEstimate();
    await saveCostData({
      order_weight_kg: w,
      ...sysEstimate,
      status: costRecord?.status || 'pending_plan',
    });
  };

  const handleSavePlanned = async (data) => {
    await saveCostData({ ...data, status: 'planned', planned_by: user?.email });
  };

  const handleSaveExtras = async (data) => {
    await saveCostData(data);
  };

  const handleSaveActual = async (data) => {
    const planTotal = costRecord?.planned_total || 0;
    const sysTotal = costRecord?.system_total || 0;
    const actTotal = data.actual_total || 0;
    const accuracy = planTotal > 0 ? Math.max(0, 100 - Math.abs((actTotal - planTotal) / planTotal * 100)) : null;
    await saveCostData({
      ...data,
      status: 'completed',
      actual_entered_by: user?.email,
      variance_system_vs_actual: sysTotal > 0 ? actTotal - sysTotal : undefined,
      variance_planned_vs_actual: planTotal > 0 ? actTotal - planTotal : undefined,
      accuracy_pct: accuracy !== null ? Number(accuracy.toFixed(1)) : undefined,
    });
  };

  if (isLoading) {
    return <div className="flex items-center gap-2 p-4 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading logistics cost data...</div>;
  }

  const isDelivered = ['delivered', 'paid', 'closed'].includes(order?.status);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Scale className="w-4 h-4" /> Expected Transportation Cost
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">System intelligence + your planned costs + actual post-delivery costs</p>
      </div>

      {/* Transporter + Weight Section */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
        {/* Transporter dropdown */}
        <div className="max-w-xs">
          <Label className="text-xs font-medium text-slate-700">Transporter</Label>
          <select
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={transporter}
            onChange={e => setTransporter(e.target.value)}
          >
            <option value="">— Select Transporter —</option>
            {transporterOptions.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {transporter && matchedCard && (
            <p className="text-xs text-green-700 mt-1">
              Rate card matched: {matchedCard.weight_from_kg}–{matchedCard.weight_to_kg} kg
              {matchedCard.name ? ` · ${matchedCard.name}` : ''}
            </p>
          )}
        </div>

        {/* Weight calculator with SKU breakdown */}
        <WeightCalculatorPanel
          order={order}
          lockedWeight={costRecord?.order_weight_kg}
          manualWeight={weightInput}
          onManualWeightChange={setWeightInput}
          onUseCalculated={val => setWeightInput(String(val))}
          onConfirm={handleSetWeight}
          saving={saving}
        />
      </div>

      {/* System Estimate (Reference) */}
      <SystemEstimateCard costRecord={costRecord} />

      {/* Planned Cost (User Entry) */}
      <PlannedCostForm costRecord={costRecord} onSave={handleSavePlanned} saving={saving} />

      {/* Extra Charges */}
      <ExtraChargesSection
        charges={costRecord?.extra_charges || []}
        confirmed={costRecord?.extra_charges_confirmed}
        onSave={handleSaveExtras}
        saving={saving}
      />

      {/* Actual Cost (Post-Delivery) */}
      {isDelivered && (
        <ActualCostForm costRecord={costRecord} onSave={handleSaveActual} saving={saving} />
      )}

      {/* Cost Comparison */}
      <CostComparisonCard costRecord={costRecord} />

      {/* Learning Prompt */}
      {costRecord?.status === 'completed' && costRecord.accuracy_pct !== null && costRecord.accuracy_pct < 80 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2">
          <Lightbulb className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Estimation accuracy is low ({costRecord.accuracy_pct}%)</p>
            <p className="text-xs text-amber-700 mt-1">
              Consider updating the transportation rate cards in Settings to improve future estimates.
              Significant variance detected: planned ₹{(costRecord.planned_total || 0).toLocaleString('en-IN')} vs actual ₹{(costRecord.actual_total || 0).toLocaleString('en-IN')}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}