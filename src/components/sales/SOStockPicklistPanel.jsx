import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle2, AlertTriangle, Loader2, Package } from 'lucide-react';
import { fireFMSEvent, linkFMSRef, findFMSInstanceByRef } from '@/lib/useFMSAutoComplete';

export default function SOStockPicklistPanel({ order, items, onUpdated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [pickQtys, setPickQtys] = useState(() =>
    Object.fromEntries(items.map(i => [i.id, i.quantity ?? '']))
  );

  // Pull real FG Warehouse stock (read-only from inventory system)
  const { data: warehouseLots = [] } = useQuery({
    queryKey: ['warehouse_lots_active'],
    queryFn: () => base44.entities.WarehouseLot.filter({ status: 'ACTIVE' }, '-created_date', 300),
  });

  // Check if a picklist already exists
  const { data: picklists = [], refetch: refetchPicklists } = useQuery({
    queryKey: ['picklists', order.id],
    queryFn: () => base44.entities.SalesPicklist.filter({ sales_order_id: order.id }, '-created_date'),
  });

  const activePicklist = picklists[0] ?? null;

  function getWarehouseStock(item) {
    const code = item.item_code || item.sku_code;
    if (!code) return null;
    const matching = warehouseLots.filter(l =>
      l.sku_code === code || l.sku_code?.includes(code) || code?.includes(l.sku_code)
    );
    if (!matching.length) return null;
    return matching.reduce((s, l) => s + (l.boxes_balance || 0) * (item.packing_unit || 12) + (l.loose_bottles_balance || 0), 0);
  }

  function getStatus(item) {
    const stock = getWarehouseStock(item);
    const pick = parseFloat(pickQtys[item.id]) || 0;
    if (stock === null) return 'unknown';
    if (stock >= pick) return 'ok';
    if (stock > 0) return 'short';
    return 'none';
  }

  const STATUS_STYLE = {
    ok: 'text-green-600',
    short: 'text-amber-600',
    none: 'text-red-600',
    unknown: 'text-slate-400',
  };

  const STATUS_LABEL = {
    ok: 'Available',
    short: 'Short',
    none: 'Out of Stock',
    unknown: 'Not on Record',
  };

  async function handleConfirm() {
    setSaving(true);

    // 1. Save stock status per item
    for (const item of items) {
      const stock = getWarehouseStock(item);
      const pick = parseFloat(pickQtys[item.id]) || 0;
      const status = getStatus(item);
      const stockStatus = status === 'ok' ? 'full' : status === 'short' ? 'partial' : 'unavailable';
      await base44.entities.SalesOrderItem.update(item.id, {
        available_stock: stock ?? 0,
        stock_status: stockStatus,
      });
    }

    // 2. Determine overall stock health
    const statuses = items.map(i => getStatus(i));
    const overall = statuses.every(s => s === 'ok') ? 'full' : statuses.every(s => s === 'none') ? 'unavailable' : 'partial';

    // 3. Update sales order
    await base44.entities.SalesOrder.update(order.id, {
      stock_validation_status: overall,
      stock_validated_by: user?.email,
      stock_validated_at: new Date().toISOString(),
    });

    // 4. Create picklist
    const plNumber = `PL-${Date.now().toString().slice(-7)}`;
    const picklistItems = items.map(i => ({
      sales_order_item_id: i.id,
      item_code: i.item_code,
      description: i.description,
      location: i.location || 'TBD',
      required_qty: parseFloat(pickQtys[i.id]) || i.quantity,
      picked_qty: 0,
      status: 'pending',
    }));

    const pl = await base44.entities.SalesPicklist.create({
      sales_order_id: order.id,
      so_number: order.so_number,
      picklist_number: plNumber,
      status: 'pending',
      generated_by: user?.email,
      items: picklistItems,
    });

    // 5. Advance order status to picking
    await base44.entities.SalesOrder.update(order.id, { status: 'picking' });

    // 6. FMS + audit
    const instances = await findFMSInstanceByRef(order.id);
    if (instances[0]) await linkFMSRef(instances[0].id, pl.id);
    await fireFMSEvent('sales_picklist_created', order.id);
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesPicklist', entity_id: pl.id,
      reference_number: plNumber, action: 'stock_checked_and_picklist_created',
      new_value: `Overall stock: ${overall}`, user_email: user?.email,
    });

    setSaving(false);
    toast({ title: 'Stock checked & Picklist created', description: plNumber });
    refetchPicklists();
    onUpdated();
  }

  async function completePicklist() {
    setSaving(true);
    const updatedItems = activePicklist.items.map(item => {
      const picked = parseFloat(pickQtys[item.sales_order_item_id] ?? item.picked_qty ?? 0);
      return {
        ...item,
        picked_qty: picked,
        status: picked >= item.required_qty ? 'picked' : picked > 0 ? 'short' : 'pending',
      };
    });

    const allPicked = updatedItems.every(i => i.status === 'picked');
    await base44.entities.SalesPicklist.update(activePicklist.id, {
      items: updatedItems,
      status: allPicked ? 'completed' : 'partial',
      completed_by: user?.email,
      completed_at: new Date().toISOString(),
    });

    await base44.entities.SalesOrder.update(order.id, { status: 'packing' });
    await fireFMSEvent('sales_picklist_completed', activePicklist.id);
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesPicklist', entity_id: activePicklist.id,
      reference_number: activePicklist.picklist_number,
      action: 'picklist_completed', user_email: user?.email,
    });

    setSaving(false);
    toast({ title: 'Picklist marked as complete' });
    refetchPicklists();
    onUpdated();
  }

  if (!items.length) return <div className="text-sm text-slate-400 py-4">No items on this order.</div>;

  const isLocked = !!activePicklist;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Stock Check &amp; Pick List</h3>
          <p className="text-xs text-slate-500 mt-0.5">Stock pulled live from inventory. Set pick quantities and confirm.</p>
        </div>
        {!isLocked && (
          <Button className="h-11 bg-slate-900 text-white text-sm" onClick={handleConfirm} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
            Confirm &amp; Generate Picklist
          </Button>
        )}
        {isLocked && activePicklist.status !== 'completed' && (
          <Button className="h-11 bg-green-600 hover:bg-green-700 text-white text-sm" onClick={completePicklist} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Package className="w-4 h-4 mr-1" />}
            Mark Picklist Complete
          </Button>
        )}
      </div>

      {/* Picklist badge if exists */}
      {isLocked && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm">
          <Package className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span className="text-blue-800 font-medium">Picklist: {activePicklist.picklist_number}</span>
          <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${
            activePicklist.status === 'completed' ? 'bg-green-100 text-green-700' :
            activePicklist.status === 'partial' ? 'bg-amber-100 text-amber-700' :
            'bg-slate-100 text-slate-600'
          }`}>{activePicklist.status}</span>
        </div>
      )}

      {/* Main table */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-700">
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-right">Order Qty</th>
              <th className="px-3 py-2 text-right">Current Stock<br /><span className="font-normal text-slate-400">(from inventory)</span></th>
              <th className="px-3 py-2 text-right">{isLocked ? 'Pick Qty' : 'Pick Qty to Send'}</th>
              <th className="px-3 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map(item => {
              const stock = getWarehouseStock(item);
              const status = getStatus(item);
              // If picklist exists, show picklist item data
              const plItem = activePicklist?.items?.find(pi => pi.sales_order_item_id === item.id);

              return (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-800">{item.description}</td>
                  <td className="px-3 py-2 text-right font-medium text-slate-700">{item.quantity}</td>
                  <td className="px-3 py-2 text-right">
                    {stock !== null ? (
                      <span className={`font-semibold ${stock >= item.quantity ? 'text-green-700' : stock > 0 ? 'text-amber-700' : 'text-red-600'}`}>
                        {stock}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">Not found</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isLocked ? (
                      <span className="font-semibold text-slate-800">
                        {activePicklist.status === 'completed'
                          ? (plItem?.picked_qty ?? plItem?.required_qty ?? '—')
                          : (
                            <Input
                              type="number" min="0" max={item.quantity}
                              className="h-8 w-20 text-sm text-right ml-auto"
                              defaultValue={plItem?.picked_qty || plItem?.required_qty || ''}
                              onChange={e => setPickQtys(p => ({ ...p, [item.sales_order_item_id]: e.target.value }))}
                            />
                          )
                        }
                      </span>
                    ) : (
                      <Input
                        type="number" min="0" max={item.quantity}
                        className="h-8 w-20 text-sm text-right ml-auto"
                        value={pickQtys[item.id]}
                        onChange={e => setPickQtys(p => ({ ...p, [item.id]: e.target.value }))}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs font-semibold ${STATUS_STYLE[status]}`}>
                      {STATUS_LABEL[status]}
                    </span>
                    {status === 'short' && stock !== null && (
                      <div className="text-xs text-red-400">Short by {item.quantity - stock}</div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Overall stock summary */}
      {order.stock_validation_status && order.stock_validation_status !== 'not_checked' && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${
          order.stock_validation_status === 'full' ? 'bg-green-50 border border-green-200 text-green-800' :
          order.stock_validation_status === 'partial' ? 'bg-amber-50 border border-amber-200 text-amber-800' :
          'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {order.stock_validation_status === 'full'
            ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          Overall stock: <strong className="ml-1">{order.stock_validation_status}</strong>
          {order.stock_validated_by && <span className="ml-2 font-normal text-xs opacity-70">· Checked by {order.stock_validated_by}</span>}
        </div>
      )}
    </div>
  );
}