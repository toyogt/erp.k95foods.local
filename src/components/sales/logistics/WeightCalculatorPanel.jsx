/**
 * WeightCalculatorPanel — SKU-wise weight breakdown for a Sales Order.
 * Fetches SO items + ProductMaster gross_weight_kg to auto-calculate total order weight.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Scale, RefreshCw, AlertCircle } from 'lucide-react';

export default function WeightCalculatorPanel({ order, lockedWeight, manualWeight, onManualWeightChange, onUseCalculated, onConfirm, saving }) {
  // Fetch SO items
  const { data: soItems = [] } = useQuery({
    queryKey: ['so-items-weight', order?.id],
    queryFn: () => base44.entities.SalesOrderItem.filter({ sales_order_id: order.id }),
    enabled: !!order?.id,
  });

  // Fetch all active products for weight lookup
  const { data: products = [] } = useQuery({
    queryKey: ['product-master-weights'],
    queryFn: () => base44.entities.ProductMaster.filter({ is_active: true }),
    staleTime: 300000,
  });

  // Build product lookup map by item_code
  const productMap = useMemo(() => {
    const map = {};
    products.forEach(p => { map[p.item_code] = p; });
    return map;
  }, [products]);

  // Compute per-SKU weight rows
  const weightRows = useMemo(() => {
    return soItems.map(item => {
      const sku = item.item_code || item.sku_code || '';
      const product = productMap[sku];
      const weightPerBox = product?.gross_weight_kg || null;
      const qty = item.quantity || 0;
      const packingUnit = item.packing_unit || product?.bottles_per_box || 1;
      // qty is in bottles; boxes = qty / packing_unit
      const boxes = packingUnit > 0 ? qty / packingUnit : qty;
      const totalWeight = weightPerBox !== null ? weightPerBox * boxes : null;
      return {
        sku,
        description: item.description || sku,
        quantity: qty,
        packingUnit,
        boxes: Number(boxes.toFixed(2)),
        weightPerBox,
        totalWeight: totalWeight !== null ? Number(totalWeight.toFixed(3)) : null,
      };
    });
  }, [soItems, productMap]);

  const calculatedTotal = useMemo(() => {
    const rows = weightRows.filter(r => r.totalWeight !== null);
    if (rows.length === 0) return null;
    return Number(weightRows.reduce((s, r) => s + (r.totalWeight || 0), 0).toFixed(3));
  }, [weightRows]);

  const missingWeightSkus = weightRows.filter(r => r.weightPerBox === null).map(r => r.sku);
  const allHaveWeights = missingWeightSkus.length === 0 && weightRows.length > 0;

  return (
    <div className="space-y-3">
      {/* SKU weight table */}
      {weightRows.length > 0 && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
            <Scale className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700">SKU-wise Weight Breakdown</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">Product Code / Description</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Ordered Qty</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Units per Box</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Boxes</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Weight / Box (kg)</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-600">Line Weight (kg)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {weightRows.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{row.sku || '—'}</div>
                      <div className="text-slate-500 mt-0.5 leading-tight">{row.description}</div>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">{row.quantity}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{row.packingUnit}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{row.boxes}</td>
                    <td className="px-3 py-2 text-right">
                      {row.weightPerBox !== null ? (
                        <span className="text-slate-700">{row.weightPerBox} kg</span>
                      ) : (
                        <span className="text-amber-600 flex items-center justify-end gap-1">
                          <AlertCircle className="w-3 h-3" /> Not set
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {row.totalWeight !== null ? (
                        <span className="text-slate-900">{row.totalWeight} kg</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {calculatedTotal !== null && (
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td colSpan={5} className="px-3 py-2 text-right text-sm font-semibold text-slate-900">
                      Calculated Total Weight
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-bold text-slate-900">
                      {calculatedTotal} kg
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {missingWeightSkus.length > 0 && (
            <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-200 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">
                Weight not configured for: <strong>{missingWeightSkus.join(', ')}</strong>.
                Set <em>Gross Weight per Box (kg)</em> in Product Master to enable auto-calculation.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Weight input row */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[160px] max-w-xs">
          <Label className="text-xs font-medium text-slate-700">Order Weight (kg)</Label>
          <Input
            className="h-9 text-sm mt-1"
            type="number"
            value={lockedWeight || manualWeight}
            onChange={e => !lockedWeight && onManualWeightChange(e.target.value)}
            placeholder="Enter total order weight"
            disabled={!!lockedWeight}
          />
        </div>

        {/* Auto-fill from calculation */}
        {!lockedWeight && calculatedTotal !== null && (
          <Button
            variant="outline"
            className="h-9 text-xs"
            onClick={() => onUseCalculated(calculatedTotal)}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Use Calculated ({calculatedTotal} kg)
          </Button>
        )}

        {!lockedWeight && (
          <Button className="h-11 text-sm bg-slate-900 hover:bg-slate-800 text-white" onClick={onConfirm} disabled={saving}>
            Calculate Estimate
          </Button>
        )}
      </div>
    </div>
  );
}