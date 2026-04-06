/**
 * StockCrossCheckPanel — Cross-check SO items against current warehouse stock.
 * Allows editing dispatch quantity and adding remarks per line.
 */
import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, RefreshCw, PackageCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function StockCrossCheckPanel({ order }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [edits, setEdits] = useState({}); // { itemId: { dispatch_qty, remarks } }

  const { data: soItems = [], refetch: refetchItems } = useQuery({
    queryKey: ['so-items-stock', order?.id],
    queryFn: () => base44.entities.SalesOrderItem.filter({ sales_order_id: order.id }),
    enabled: !!order?.id,
    staleTime: 30000,
  });

  const { data: stockBalances = [], isLoading } = useQuery({
    queryKey: ['stock-balances-crosscheck'],
    queryFn: () => base44.entities.StoreStockBalance.list('-updated_date', 2000),
    staleTime: 60000,
  });

  const stockByCode = useMemo(() => {
    const map = {};
    stockBalances.forEach(b => {
      if (b.item_code) map[b.item_code] = (map[b.item_code] || 0) + (b.quantity || 0);
    });
    return map;
  }, [stockBalances]);

  function setEdit(itemId, key, val) {
    setEdits(prev => ({ ...prev, [itemId]: { ...(prev[itemId] || {}), [key]: val } }));
  }

  async function handleSave() {
    setSaving(true);
    for (const [itemId, vals] of Object.entries(edits)) {
      await base44.entities.SalesOrderItem.update(itemId, {
        ...(vals.dispatch_qty !== undefined && { dispatch_qty: vals.dispatch_qty }),
        ...(vals.remarks !== undefined && { dispatch_remarks: vals.remarks }),
      });
    }
    setSaving(false);
    setEdits({});
    toast({ title: 'Dispatch quantities saved' });
    refetchItems();
    qc.invalidateQueries({ queryKey: ['so-items-stock', order?.id] });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
          <PackageCheck className="w-3.5 h-3.5" /> Stock Cross-Check
        </h4>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => { refetchItems(); qc.invalidateQueries({ queryKey: ['stock-balances-crosscheck'] }); }}>
          <RefreshCw className="w-3 h-3" /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-slate-400 py-3 text-center">Loading stock data…</p>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[600px]">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Item</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">Ordered Qty</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">Available Stock</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-600">Status</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-600">Dispatch Qty</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-600">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {soItems.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-6 text-slate-400">No items found</td></tr>
                ) : soItems.map(item => {
                  const code = item.sku_code || item.item_code || '';
                  const stockQty = stockByCode[code] || 0;
                  const ordered = item.quantity || 0;
                  const canFulfill = stockQty >= ordered;
                  const partial = stockQty > 0 && stockQty < ordered;
                  const currentDispatch = edits[item.id]?.dispatch_qty ?? item.dispatch_qty ?? ordered;
                  const currentRemarks = edits[item.id]?.remarks ?? item.dispatch_remarks ?? '';
                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900 font-mono">{code || '—'}</div>
                        <div className="text-slate-500 mt-0.5">{item.description}</div>
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-slate-800">{ordered}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`font-bold ${canFulfill ? 'text-green-700' : partial ? 'text-amber-600' : 'text-red-600'}`}>
                          {stockQty.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {canFulfill ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Available
                          </span>
                        ) : partial ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                            <AlertTriangle className="w-3 h-3" /> Partial
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                            <AlertTriangle className="w-3 h-3" /> No Stock
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          className="h-8 text-xs text-center w-20 mx-auto"
                          value={currentDispatch}
                          onChange={e => setEdit(item.id, 'dispatch_qty', Number(e.target.value))}
                          max={ordered}
                          min={0}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          className="h-8 text-xs w-32 mx-auto"
                          value={currentRemarks}
                          onChange={e => setEdit(item.id, 'remarks', e.target.value)}
                          placeholder="Remarks…"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {Object.keys(edits).length > 0 && (
        <Button className="h-9 text-sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : `Save Dispatch Quantities (${Object.keys(edits).length} changed)`}
        </Button>
      )}
    </div>
  );
}