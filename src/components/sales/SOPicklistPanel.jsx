import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, CheckCircle2 } from 'lucide-react';
import { fireFMSEvent, linkFMSRef, findFMSInstanceByRef } from '@/lib/useFMSAutoComplete';

export default function SOPicklistPanel({ order, items, onUpdated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [pickedQtys, setPickedQtys] = useState({});

  const { data: picklists = [], refetch } = useQuery({
    queryKey: ['picklists', order.id],
    queryFn: () => base44.entities.SalesPicklist.filter({ sales_order_id: order.id }, '-created_date'),
  });

  const activePicklist = picklists[0];

  async function generatePicklist() {
    setCreating(true);
    const plNumber = `PL-${Date.now().toString().slice(-7)}`;
    const picklistItems = items.map(i => ({
      sales_order_item_id: i.id,
      item_code: i.item_code,
      description: i.description,
      location: i.location || 'TBD',
      required_qty: i.quantity,
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

    await base44.entities.SalesOrder.update(order.id, { status: 'picking' });

    const instances = await findFMSInstanceByRef(order.id);
    if (instances[0]) await linkFMSRef(instances[0].id, pl.id);
    await fireFMSEvent('sales_picklist_created', order.id);

    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesPicklist', entity_id: pl.id,
      reference_number: plNumber, action: 'created', user_email: user?.email,
    });

    setCreating(false);
    toast({ title: 'Picklist generated', description: plNumber });
    refetch(); onUpdated();
  }

  async function completePicklist() {
    setCompleting(true);
    const updatedItems = activePicklist.items.map(item => {
      const picked = parseFloat(pickedQtys[item.sales_order_item_id] ?? item.picked_qty ?? 0);
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
      action: 'completed', user_email: user?.email,
    });

    setCompleting(false);
    toast({ title: 'Picklist completed' });
    refetch(); onUpdated();
  }

  if (!items.length) return <div className="text-sm text-slate-400 py-4">No items on this order.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Picklist</h3>
        {!activePicklist && (
          <Button className="h-11 bg-slate-900 text-white text-sm" onClick={generatePicklist} disabled={creating}>
            {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Generate Picklist
          </Button>
        )}
        {activePicklist && activePicklist.status !== 'completed' && (
          <Button className="h-11 bg-green-600 hover:bg-green-700 text-white text-sm" onClick={completePicklist} disabled={completing}>
            {completing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Mark Complete
          </Button>
        )}
      </div>

      {!activePicklist && (
        <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
          No picklist generated yet. Click "Generate Picklist" to begin picking.
        </div>
      )}

      {activePicklist && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700">{activePicklist.picklist_number}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              activePicklist.status === 'completed' ? 'bg-green-100 text-green-700' :
              activePicklist.status === 'partial' ? 'bg-amber-100 text-amber-700' :
              'bg-slate-100 text-slate-600'
            }`}>{activePicklist.status}</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-700 border-b border-slate-100">
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-left">Location</th>
                <th className="px-3 py-2 text-right">Required</th>
                <th className="px-3 py-2 text-right">Picked Qty</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activePicklist.items?.map(item => (
                <tr key={item.sales_order_item_id}>
                  <td className="px-3 py-2 text-slate-800">{item.description}</td>
                  <td className="px-3 py-2 text-slate-500 text-xs">{item.location}</td>
                  <td className="px-3 py-2 text-right">{item.required_qty}</td>
                  <td className="px-3 py-2 text-right">
                    {activePicklist.status === 'completed' ? (
                      <span className="font-medium">{item.picked_qty}</span>
                    ) : (
                      <Input
                        type="number" min="0" max={item.required_qty}
                        className="h-8 w-20 text-sm text-right ml-auto"
                        defaultValue={item.picked_qty || ''}
                        onChange={e => setPickedQtys(p => ({ ...p, [item.sales_order_item_id]: e.target.value }))}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs font-medium ${
                      item.status === 'picked' ? 'text-green-600' :
                      item.status === 'short' ? 'text-amber-600' : 'text-slate-500'
                    }`}>{item.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}