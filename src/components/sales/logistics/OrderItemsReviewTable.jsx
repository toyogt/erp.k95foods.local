/**
 * Unified Order Items table for Logistics Review.
 * Merges stock cross-check + weight breakdown + "Set Now" for pendencies.
 * Columns: Item Code | Description | Ordered Qty | Available Stock | Status | Units/Box | Wt/Box | Boxes | Line Weight
 */
import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, AlertTriangle, AlertCircle, RefreshCw, PackageCheck } from 'lucide-react';
import SetProductDetailInline from './SetProductDetailInline';

export default function OrderItemsReviewTable({ order, onPicklistQtyChange }) {
  const qc = useQueryClient();
  const [picklistQtys, setPicklistQtys] = useState({});

  const { data: soItems = [], refetch: refetchItems } = useQuery({
    queryKey: ['so-items-review', order?.id],
    queryFn: () => base44.entities.SalesOrderItem.filter({ sales_order_id: order.id }),
    enabled: !!order?.id,
    staleTime: 30000,
  });

  // Extract item codes from order items for targeted lookup
  const itemCodes = useMemo(() => soItems.map(i => i.item_code).filter(Boolean), [soItems]);

  const { data: products = [], isLoading: stockLoading } = useQuery({
    queryKey: ['product-master-for-order', order?.id, itemCodes.join(',')],
    queryFn: async () => {
      if (itemCodes.length === 0) return [];
      // Fetch all products and filter client-side (entity filter doesn't support $in)
      const all = await base44.entities.ProductMaster.list('-created_date', 500);
      return all;
    },
    enabled: !!order?.id && itemCodes.length > 0,
    staleTime: 60000,
  });

  const stockByCode = useMemo(() => {
    const map = {};
    products.forEach(p => {
      const code = (p.item_code || '').trim().toUpperCase();
      if (code) map[code] = (map[code] || 0) + (p.current_stock || 0);
    });
    return map;
  }, [products]);

  const productMap = useMemo(() => {
    const map = {};
    products.forEach(p => { map[p.item_code] = p; });
    return map;
  }, [products]);

  const rows = useMemo(() => {
    return soItems.map(item => {
      const itemCode = item.item_code || '';
      const codeUpper = itemCode.trim().toUpperCase();
      const stockQty = stockByCode[codeUpper] || 0;
      const ordered = item.quantity || 0;
      const product = productMap[itemCode];
      const packingUnit = product?.bottles_per_box || null;
      const weightPerBox = product?.gross_weight_kg || null;
      const boxes = packingUnit && packingUnit > 0 ? ordered / packingUnit : null;
      const lineWeight = weightPerBox !== null && boxes !== null ? weightPerBox * boxes : null;

      return {
        id: item.id,
        itemCode,
        description: item.description || '',
        ordered,
        stockQty,
        canFulfill: stockQty >= ordered,
        partial: stockQty > 0 && stockQty < ordered,
        packingUnit,
        weightPerBox,
        boxes: boxes !== null ? Number(boxes.toFixed(2)) : null,
        lineWeight: lineWeight !== null ? Number(lineWeight.toFixed(3)) : null,
        productId: product?.id || null,
      };
    });
  }, [soItems, stockByCode, productMap]);

  const calculatedTotalWeight = useMemo(() => {
    const valid = rows.filter(r => r.lineWeight !== null);
    if (valid.length === 0) return null;
    return Number(rows.reduce((s, r) => s + (r.lineWeight || 0), 0).toFixed(3));
  }, [rows]);

  const missingWeight = rows.filter(r => r.productId && r.weightPerBox === null);
  const missingPacking = rows.filter(r => r.productId && r.packingUnit === null);
  const hasPendencies = missingWeight.length > 0 || missingPacking.length > 0;

  function handleProductUpdated() {
    qc.invalidateQueries({ queryKey: ['product-master-all'] });
  }

  function handleRefresh() {
    refetchItems();
    qc.invalidateQueries({ queryKey: ['product-master-all'] });
  }

  if (stockLoading) {
    return <p className="text-xs text-slate-400 py-4 text-center">Loading order items…</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
          <PackageCheck className="w-3.5 h-3.5" /> Order Items — Stock & Weight
        </h4>
        <div className="flex items-center gap-2">
          {hasPendencies && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              <AlertCircle className="w-3 h-3" /> Missing Details
            </span>
          )}
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={handleRefresh}>
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>
        </div>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[800px]">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Item Code</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Description</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Ordered</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Stock</th>
                <th className="px-3 py-2 text-center font-medium text-slate-600">Availability</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Picklist Qty</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Units/Box</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Weight/Box</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Boxes</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Line Weight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-6 text-slate-400">No items found</td></tr>
              ) : rows.map(row => (
                <tr key={row.id} className={`hover:bg-slate-50 ${row.stockQty <= 0 ? 'bg-red-50/50' : ''}`}>
                  <td className="px-3 py-2 font-mono text-slate-900 whitespace-nowrap">{row.itemCode || '—'}</td>
                  <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate">{row.description || '—'}</td>
                  <td className="px-3 py-2 text-right font-medium text-slate-800">{row.ordered}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={`font-bold ${row.canFulfill ? 'text-green-700' : row.partial ? 'text-amber-600' : 'text-red-600'}`}>
                      {row.stockQty.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {row.canFulfill ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                        <CheckCircle2 className="w-3 h-3" /> OK
                      </span>
                    ) : row.partial ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs">
                        <AlertTriangle className="w-3 h-3" /> Partial
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">
                        <AlertTriangle className="w-3 h-3" /> Out of Stock
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Input
                      type="number"
                      className="h-7 w-20 text-xs text-right ml-auto"
                      min={0}
                      max={Math.min(row.ordered, row.stockQty)}
                      value={picklistQtys[row.id] ?? Math.min(row.ordered, row.stockQty)}
                      onChange={e => {
                        const val = Math.max(0, Math.min(Number(e.target.value) || 0, row.ordered, row.stockQty));
                        const newQtys = { ...picklistQtys, [row.id]: val };
                        setPicklistQtys(newQtys);
                        if (onPicklistQtyChange) onPicklistQtyChange(newQtys);
                      }}
                      disabled={row.stockQty <= 0}
                    />
                    {row.stockQty <= 0 && <span className="text-[10px] text-red-500 block mt-0.5">No stock</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {row.packingUnit !== null ? (
                      <span className="text-slate-700">{row.packingUnit}</span>
                    ) : row.productId ? (
                      <SetProductDetailInline
                        productId={row.productId}
                        sku={row.itemCode}
                        fieldKey="bottles_per_box"
                        fieldLabel="Units per Box"
                        fieldType="number"
                        onUpdated={handleProductUpdated}
                      />
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {row.weightPerBox !== null ? (
                      <span className="text-slate-700">{row.weightPerBox} kg</span>
                    ) : row.productId ? (
                      <SetProductDetailInline
                        productId={row.productId}
                        sku={row.itemCode}
                        fieldKey="gross_weight_kg"
                        fieldLabel="Weight / Box (kg)"
                        fieldType="number"
                        onUpdated={handleProductUpdated}
                      />
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {row.boxes !== null ? row.boxes : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {row.lineWeight !== null ? (
                      <span className="text-slate-900">{row.lineWeight} kg</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {calculatedTotalWeight !== null && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td colSpan={9} className="px-3 py-2 text-right text-sm font-semibold text-slate-900">
                    Total Calculated Weight
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-bold text-slate-900">
                    {calculatedTotalWeight} kg
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {hasPendencies && (
          <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-200 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">
              {missingWeight.length > 0 && (
                <>Weight not configured for: <strong>{missingWeight.map(r => r.itemCode).join(', ')}</strong>. </>
              )}
              {missingPacking.length > 0 && (
                <>Units per box not set for: <strong>{missingPacking.map(r => r.itemCode).join(', ')}</strong>. </>
              )}
              Click <strong>"Set Now"</strong> to configure instantly.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}