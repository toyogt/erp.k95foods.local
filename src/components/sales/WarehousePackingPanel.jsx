/**
 * Warehouse Packing Panel — shown in Picklist Detail when status is dispatch_scheduled.
 * Provides a proper packing UI: scan/enter items, track packed qty, mark boxes.
 */
import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Package, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';

export default function WarehousePackingPanel({ picklist, onUpdated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [packQtys, setPackQtys] = useState(() => {
    const init = {};
    (picklist?.items || []).forEach(item => {
      init[item.sales_order_item_id] = item.picked_qty ?? item.required_qty ?? 0;
    });
    return init;
  });
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const items = picklist?.items || [];

  const summary = useMemo(() => {
    let totalRequired = 0, totalPacked = 0, shortItems = 0;
    items.forEach(item => {
      const req = item.required_qty || 0;
      const packed = Number(packQtys[item.sales_order_item_id] || 0);
      totalRequired += req;
      totalPacked += packed;
      if (packed < req) shortItems++;
    });
    return { totalRequired, totalPacked, shortItems };
  }, [items, packQtys]);

  async function handleCompletePacking() {
    setSaving(true);
    const updatedItems = items.map(item => {
      const packed = Number(packQtys[item.sales_order_item_id] || 0);
      return {
        ...item,
        picked_qty: packed,
        status: packed >= item.required_qty ? 'picked' : packed > 0 ? 'short' : 'pending',
      };
    });

    await base44.entities.SalesPicklist.update(picklist.id, {
      items: updatedItems,
      status: 'pick_packed',
      completed_by: user?.email,
      completed_at: new Date().toISOString(),
      notes: remarks || picklist.notes,
    });

    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesPicklist',
      entity_id: picklist.id,
      reference_number: picklist.picklist_number,
      action: 'warehouse_packing_completed',
      new_value: `Packed ${summary.totalPacked}/${summary.totalRequired} units. ${summary.shortItems > 0 ? `${summary.shortItems} short item(s).` : 'All items fulfilled.'}`,
      notes: remarks,
      user_email: user?.email,
    });

    setSaving(false);
    toast({
      title: 'Packing Completed',
      description: summary.shortItems > 0
        ? `${summary.shortItems} item(s) packed short — logged.`
        : 'All items packed successfully',
    });
    if (onUpdated) onUpdated();
  }

  if (picklist?.status !== 'dispatch_scheduled') return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="bg-green-50 px-4 py-3 border-b border-green-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-green-700" />
          <h3 className="text-sm font-semibold text-green-900">Warehouse Packing</h3>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-green-700 font-medium">Packed: {summary.totalPacked}/{summary.totalRequired}</span>
          {summary.shortItems > 0 && (
            <span className="text-amber-700 font-medium flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {summary.shortItems} short
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="px-3 py-2 text-left">Item</th>
              <th className="px-3 py-2 text-left">Location</th>
              <th className="px-3 py-2 text-right">Required</th>
              <th className="px-3 py-2 text-right">Pack Quantity</th>
              <th className="px-3 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map(item => {
              const packed = Number(packQtys[item.sales_order_item_id] || 0);
              const isShort = packed < (item.required_qty || 0);
              const isOver = packed > (item.required_qty || 0);
              return (
                <tr key={item.sales_order_item_id} className={`hover:bg-slate-50 ${isShort ? 'bg-amber-50' : ''}`}>
                  <td className="px-3 py-2">
                    <p className="text-slate-900 font-medium">{item.description}</p>
                    <p className="text-xs text-slate-500 font-mono">{item.item_code}</p>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{item.location || '—'}</td>
                  <td className="px-3 py-2 text-right font-medium">{item.required_qty}</td>
                  <td className="px-3 py-2 text-right">
                    <Input
                      type="number"
                      min="0"
                      className={`h-9 w-24 text-sm text-right ml-auto ${isShort ? 'border-amber-400' : isOver ? 'border-blue-400' : ''}`}
                      value={packQtys[item.sales_order_item_id] ?? ''}
                      onChange={e => setPackQtys(p => ({
                        ...p,
                        [item.sales_order_item_id]: e.target.value,
                      }))}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    {packed >= (item.required_qty || 0) ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Packed
                      </span>
                    ) : packed > 0 ? (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">Short</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs font-medium">Pending</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-slate-100 space-y-3">
        <div>
          <Label className="text-xs font-medium text-slate-700">Packing Remarks (optional)</Label>
          <Input
            className="h-11 md:h-9 text-sm mt-1"
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            placeholder="Any packing notes or observations..."
          />
        </div>
        <div className="flex justify-end">
          <Button
            className="h-11 bg-green-700 hover:bg-green-800 text-white text-sm gap-2"
            onClick={handleCompletePacking}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
            Complete Packing
          </Button>
        </div>
      </div>
    </div>
  );
}