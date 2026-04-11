/**
 * Auto-calculates order weight from SKU gross_weight_kg × quantity.
 * Shows breakdown per item and auto-fills weight into the logistics cost record.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Scale, Calculator, Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function AutoWeightCalculator({ order, onWeightCalculated }) {
  const [applying, setApplying] = useState(false);

  const { data: soItems = [] } = useQuery({
    queryKey: ['so-items-weight', order?.id],
    queryFn: () => base44.entities.SalesOrderItem.filter({ sales_order_id: order.id }),
    enabled: !!order?.id,
    staleTime: 30000,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['product-master-weights'],
    queryFn: () => base44.entities.ProductMaster.filter({ is_active: true }),
    staleTime: 300000,
  });

  const productMap = useMemo(() => {
    const map = {};
    products.forEach(p => { if (p.item_code) map[p.item_code] = p; });
    return map;
  }, [products]);

  const breakdown = useMemo(() => {
    return soItems.map(item => {
      const code = item.item_code || item.sku_code || '';
      const product = productMap[code];
      const packingUnit = product?.bottles_per_box || 1;
      const weightPerBox = product?.gross_weight_kg || 0;
      const qty = item.quantity || 0;
      const boxes = packingUnit > 0 ? qty / packingUnit : 0;
      const lineWeight = weightPerBox * boxes;
      return {
        code,
        description: item.description,
        qty,
        packingUnit,
        boxes: Number(boxes.toFixed(2)),
        weightPerBox,
        lineWeight: Number(lineWeight.toFixed(3)),
        hasMissingData: !weightPerBox,
      };
    });
  }, [soItems, productMap]);

  const totalWeight = useMemo(() =>
    Number(breakdown.reduce((s, r) => s + r.lineWeight, 0).toFixed(3)),
    [breakdown]
  );

  const missingCount = breakdown.filter(b => b.hasMissingData).length;

  async function handleApplyWeight() {
    if (totalWeight <= 0) return;
    setApplying(true);
    if (onWeightCalculated) await onWeightCalculated(totalWeight);
    setApplying(false);
  }

  if (soItems.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
          <Calculator className="w-3.5 h-3.5" /> Auto-Calculated Weight
        </h4>
        {totalWeight > 0 && (
          <Button
            size="sm"
            className="h-9 text-sm bg-slate-900 text-white gap-1"
            onClick={handleApplyWeight}
            disabled={applying}
          >
            {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scale className="w-3.5 h-3.5" />}
            Apply {totalWeight} kg
          </Button>
        )}
      </div>

      {missingCount > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg">
          {missingCount} item(s) missing weight data — configure in Product Master for accurate totals.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium text-slate-600">Item Code</th>
              <th className="px-2 py-1.5 text-left font-medium text-slate-600">Description</th>
              <th className="px-2 py-1.5 text-right font-medium text-slate-600">Quantity</th>
              <th className="px-2 py-1.5 text-right font-medium text-slate-600">Units/Box</th>
              <th className="px-2 py-1.5 text-right font-medium text-slate-600">Boxes</th>
              <th className="px-2 py-1.5 text-right font-medium text-slate-600">Weight/Box (kg)</th>
              <th className="px-2 py-1.5 text-right font-medium text-slate-600">Line Weight (kg)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {breakdown.map((row, i) => (
              <tr key={i} className={row.hasMissingData ? 'bg-amber-50' : ''}>
                <td className="px-2 py-1.5 font-mono text-slate-900 whitespace-nowrap">{row.code || '—'}</td>
                <td className="px-2 py-1.5 text-slate-600 max-w-[180px] truncate">{row.description || '—'}</td>
                <td className="px-2 py-1.5 text-right">{row.qty}</td>
                <td className="px-2 py-1.5 text-right">{row.packingUnit}</td>
                <td className="px-2 py-1.5 text-right">{row.boxes}</td>
                <td className="px-2 py-1.5 text-right">{row.weightPerBox || <span className="text-red-500">—</span>}</td>
                <td className="px-2 py-1.5 text-right font-medium">{row.lineWeight || '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 border-t-2 border-slate-200">
              <td colSpan={6} className="px-2 py-2 text-right font-semibold text-slate-900">Total Order Weight</td>
              <td className="px-2 py-2 text-right font-bold text-slate-900">{totalWeight} kg</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}