import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, RotateCcw, Plus } from 'lucide-react';
import { fireFMSEvent, linkFMSRef, findFMSInstanceByRef } from '@/lib/useFMSAutoComplete';

export default function SOReturnPanel({ order, items, onUpdated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ return_type: 'partial', reason: '', notes: '' });
  const [returnQtys, setReturnQtys] = useState({});

  const { data: returns = [], refetch } = useQuery({
    queryKey: ['so_returns', order.id],
    queryFn: () => base44.entities.SalesReturn.filter({ sales_order_id: order.id }, '-created_date'),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['so_invoices', order.id],
    queryFn: () => base44.entities.SalesInvoice.filter({ sales_order_id: order.id }),
  });

  const { data: dispatches = [] } = useQuery({
    queryKey: ['dispatches', order.id],
    queryFn: () => base44.entities.SalesDispatch.filter({ sales_order_id: order.id }),
  });

  async function submitReturn() {
    if (!form.reason) { toast({ title: 'Reason is required', variant: 'destructive' }); return; }
    setSaving(true);

    const returnNum = `RET-${Date.now().toString().slice(-7)}`;
    const returnItems = items
      .filter(i => parseFloat(returnQtys[i.id]) > 0)
      .map(i => ({
        item_code: i.item_code,
        description: i.description,
        returned_qty: parseFloat(returnQtys[i.id]),
        reason: form.reason,
      }));

    const creditAmount = returnItems.reduce((s, ri) => {
      const item = items.find(i => i.item_code === ri.item_code || i.description === ri.description);
      if (!item) return s;
      return s + (ri.returned_qty * (item.unit_base_cost || 0));
    }, 0);

    const ret = await base44.entities.SalesReturn.create({
      sales_order_id: order.id,
      invoice_id: invoices[0]?.id || null,
      dispatch_id: dispatches[0]?.id || null,
      so_number: order.so_number,
      return_number: returnNum,
      return_type: form.return_type,
      reason: form.reason,
      status: 'initiated',
      items: returnItems,
      credit_note_amount: creditAmount,
      notes: form.notes,
      stock_adjustment_done: false,
      financial_adjustment_done: false,
    });

    const instances = await findFMSInstanceByRef(order.id);
    if (instances[0]) await linkFMSRef(instances[0].id, ret.id);
    await fireFMSEvent('sales_return_initiated', order.id);

    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesReturn', entity_id: ret.id,
      reference_number: returnNum, action: 'return_initiated',
      new_value: form.reason, user_email: user?.email,
    });

    setSaving(false);
    setShowForm(false);
    toast({ title: 'Return initiated', description: returnNum });
    refetch(); onUpdated();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Returns</h3>
        {!showForm && (
          <Button className="h-11 bg-slate-900 text-white text-sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" /> Initiate Return
          </Button>
        )}
      </div>

      {showForm && (
        <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-slate-700">Return Type</Label>
              <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.return_type} onChange={e => setForm(f => ({ ...f, return_type: e.target.value }))}>
                <option value="partial">Partial Return</option>
                <option value="full">Full Return</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-700">Reason *</Label>
              <Input className="h-9 text-sm mt-1" value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
          </div>

          <p className="text-xs font-medium text-slate-700">Return Quantities</p>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white text-xs text-slate-600 border-b border-slate-100">
                  <th className="px-3 py-2 text-left">Product</th>
                  <th className="px-3 py-2 text-right">Ordered</th>
                  <th className="px-3 py-2 text-right">Return Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map(item => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 text-slate-800">{item.description}</td>
                    <td className="px-3 py-2 text-right">{item.quantity}</td>
                    <td className="px-3 py-2 text-right">
                      <Input type="number" min="0" max={item.quantity}
                        className="h-8 w-20 text-sm text-right ml-auto"
                        value={returnQtys[item.id] || ''}
                        onChange={e => setReturnQtys(q => ({ ...q, [item.id]: e.target.value }))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" className="h-11 px-4" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button className="h-11 bg-slate-900 text-white" onClick={submitReturn} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
              Submit Return
            </Button>
          </div>
        </div>
      )}

      {returns.length === 0 && !showForm && (
        <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
          No returns recorded for this order.
        </div>
      )}

      {returns.map(ret => (
        <div key={ret.id} className="border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-900">{ret.return_number}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              ret.status === 'closed' ? 'bg-green-100 text-green-700' :
              ret.status === 'received' ? 'bg-blue-100 text-blue-700' :
              'bg-amber-100 text-amber-700'
            }`}>{ret.status}</span>
          </div>
          <p className="text-xs text-slate-500">Type: <strong>{ret.return_type}</strong> · Reason: {ret.reason}</p>
          {ret.credit_note_amount > 0 && (
            <p className="text-xs text-slate-600 mt-1">Credit Note: ₹{ret.credit_note_amount.toLocaleString('en-IN')}</p>
          )}
        </div>
      ))}
    </div>
  );
}