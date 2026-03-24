import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Package, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { fireFMSEvent } from '@/lib/useFMSAutoComplete';

export default function SOStockValidation({ order, items, onUpdated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Pull real FG Warehouse stock
  const { data: warehouseLots = [] } = useQuery({
    queryKey: ['warehouse_lots_active'],
    queryFn: () => base44.entities.WarehouseLot.filter({ status: 'ACTIVE' }, '-created_date', 300),
  });

  // Build stock map by sku_code -> total bottles (boxes*packing_unit + loose)
  function getWarehouseStock(item) {
    const skuCode = item.item_code || item.sku_code;
    if (!skuCode) return null;
    const matching = warehouseLots.filter(l =>
      l.sku_code === skuCode || l.sku_code?.includes(skuCode) || skuCode?.includes(l.sku_code)
    );
    if (!matching.length) return null;
    return matching.reduce((s, l) => s + (l.boxes_balance || 0) * 12 + (l.loose_bottles_balance || 0), 0);
  }

  const [stocks, setStocks] = useState(() =>
    Object.fromEntries(items.map(i => {
      const wStock = null; // will be populated from warehouse
      return [i.id, i.available_stock ?? ''];
    }))
  );

  if (items.length === 0) return <div className="text-sm text-slate-400 py-4">No items to validate.</div>;

  function getItemStatus(item) {
    const avail = parseFloat(stocks[item.id]);
    if (isNaN(avail)) return 'not_checked';
    if (avail >= item.quantity) return 'full';
    if (avail > 0) return 'partial';
    return 'unavailable';
  }

  function getOverallStatus() {
    const statuses = items.map(i => getItemStatus(i));
    if (statuses.every(s => s === 'full')) return 'full';
    if (statuses.every(s => s === 'unavailable')) return 'unavailable';
    return 'partial';
  }

  async function handleValidate() {
    setSaving(true);
    for (const item of items) {
      const avail = parseFloat(stocks[item.id]);
      const status = getItemStatus(item);
      await base44.entities.SalesOrderItem.update(item.id, {
        available_stock: isNaN(avail) ? 0 : avail,
        stock_status: status,
      });
    }

    const overall = getOverallStatus();
    await base44.entities.SalesOrder.update(order.id, {
      status: 'stock_validated',
      stock_validation_status: overall,
      stock_validated_by: user?.email,
      stock_validated_at: new Date().toISOString(),
    });

    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesOrder', entity_id: order.id,
      reference_number: order.so_number,
      action: 'stock_validated',
      new_value: overall, user_email: user?.email,
    });

    await fireFMSEvent('sales_stock_validated', order.id);
    setSaving(false);
    toast({ title: 'Stock validated', description: `Overall: ${overall}` });
    onUpdated();
  }

  const STATUS_COLOR = { full: 'text-green-600', partial: 'text-amber-600', unavailable: 'text-red-600', not_checked: 'text-slate-400' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Stock Availability Check</h3>
        <Button className="h-11 bg-slate-900 text-white text-sm" onClick={handleValidate} disabled={saving}>
          {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</> : 'Validate & Confirm'}
        </Button>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-700">
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-right">Required</th>
              <th className="px-3 py-2 text-right">Available Stock</th>
              <th className="px-3 py-2 text-right">Shortfall</th>
              <th className="px-3 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map(item => {
              const avail = parseFloat(stocks[item.id]);
              const shortfall = isNaN(avail) ? '—' : Math.max(0, item.quantity - avail);
              const status = getItemStatus(item);
              return (
                <tr key={item.id}>
                  <td className="px-3 py-2 text-slate-800">{item.description}</td>
                  <td className="px-3 py-2 text-right font-medium">{item.quantity}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-col items-end gap-1">
                      {(() => {
                        const ws = getWarehouseStock(item);
                        return ws !== null ? (
                          <button
                            className="text-xs text-blue-600 underline"
                            onClick={() => setStocks(s => ({ ...s, [item.id]: ws }))}
                          >FG: {ws} (auto-fill)</button>
                        ) : null;
                      })()}
                      <Input
                        type="number"
                        min="0"
                        className="h-8 w-24 text-sm text-right"
                        value={stocks[item.id]}
                        onChange={e => setStocks(s => ({ ...s, [item.id]: e.target.value }))}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-red-600 font-medium">{shortfall}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs font-medium ${STATUS_COLOR[status]}`}>{status.replace('_', ' ')}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {order.stock_validation_status && order.stock_validation_status !== 'not_checked' && (
        <div className={`flex items-center gap-2 p-3 rounded-lg ${
          order.stock_validation_status === 'full' ? 'bg-green-50 text-green-700' :
          order.stock_validation_status === 'partial' ? 'bg-amber-50 text-amber-700' :
          'bg-red-50 text-red-700'
        }`}>
          {order.stock_validation_status === 'full' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span className="text-sm font-medium">
            Overall stock: <strong>{order.stock_validation_status}</strong>
            {order.stock_validated_by && ` · Checked by ${order.stock_validated_by}`}
          </span>
        </div>
      )}
    </div>
  );
}