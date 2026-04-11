/**
 * Create Picklist Modal — select Sales Order, auto-fetch items, edit quantities, generate.
 */
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { generateDocNumber } from '@/lib/docNumberHelper';
import { fireFMSEvent, findFMSInstanceByRef, linkFMSRef } from '@/lib/useFMSAutoComplete';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Loader2, ClipboardList, Package, AlertTriangle } from 'lucide-react';

export default function CreatePicklistModal({ open, onClose, onCreated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [pickQtys, setPickQtys] = useState({});
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState('select'); // 'select' | 'configure'

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['eligible-orders-for-picklist'],
    queryFn: async () => {
      const all = await base44.entities.SalesOrder.list('-created_date', 200);
      return all.filter(o =>
        ['confirmed', 'logistics_review', 'picking'].includes(o.status) ||
        ['under_logistics_review', 'ready_to_pick'].includes(o.workflow_state)
      );
    },
    enabled: open,
  });

  const filteredOrders = useMemo(() => {
    if (!search) return orders;
    const s = search.toLowerCase();
    return orders.filter(o =>
      o.so_number?.toLowerCase().includes(s) ||
      o.customer_name?.toLowerCase().includes(s)
    );
  }, [orders, search]);

  const { data: soItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['so-items-for-picklist', selectedOrder?.id],
    queryFn: () => base44.entities.SalesOrderItem.filter({ sales_order_id: selectedOrder.id }),
    enabled: !!selectedOrder?.id,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['product-master-for-picklist'],
    queryFn: () => base44.entities.ProductMaster.list('-created_date', 500),
    enabled: !!selectedOrder?.id,
  });

  const productMap = useMemo(() => {
    const map = {};
    products.forEach(p => { map[(p.item_code || '').toUpperCase()] = p; });
    return map;
  }, [products]);

  function handleSelectOrder(order) {
    setSelectedOrder(order);
    setStep('configure');
    setPickQtys({});
  }

  function handleBack() {
    setSelectedOrder(null);
    setStep('select');
    setPickQtys({});
  }

  async function handleCreate() {
    if (!selectedOrder) return;
    setSaving(true);
    const plNumber = await generateDocNumber('PL');

    const plItems = soItems.map(item => {
      const code = (item.item_code || item.sku_code || '').toUpperCase();
      const product = productMap[code];
      const qty = pickQtys[item.id] !== undefined ? Number(pickQtys[item.id]) : (item.quantity || 0);
      return {
        sales_order_item_id: item.id,
        item_code: item.item_code || item.sku_code || '',
        item_name: item.description || product?.product_name || '',
        description: item.description || '',
        item_group: 'Kombucha',
        warehouse: 'Finished Goods - KFPL',
        location: item.location || '',
        required_qty: qty,
        picked_qty: 0,
        delivered_qty: 0,
        uom: 'Pcs',
        available_stock: product?.current_stock || 0,
        status: 'pending',
      };
    });

    const newPl = await base44.entities.SalesPicklist.create({
      sales_order_id: selectedOrder.id,
      so_number: selectedOrder.so_number,
      picklist_number: plNumber,
      company: 'K95 Foods Private Limited',
      purpose: 'Delivery',
      customer_name: selectedOrder.customer_name || '',
      warehouse: 'Finished Goods - KFPL',
      status: 'draft',
      transporter: selectedOrder.transporter || '',
      packaging_type: selectedOrder.packaging_type || '',
      po_number: selectedOrder.po_number || selectedOrder.so_number || '',
      dispatch_date: selectedOrder.planned_dispatch_date || '',
      generated_by: user?.email,
      items: plItems,
    });

    const instances = await findFMSInstanceByRef(selectedOrder.id);
    if (instances[0]) await linkFMSRef(instances[0].id, newPl.id);
    await fireFMSEvent('sales_picklist_created', selectedOrder.id);
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesPicklist', entity_id: newPl.id,
      reference_number: plNumber, action: 'created',
      new_value: `Created from ${selectedOrder.so_number}`,
      user_email: user?.email,
    });

    setSaving(false);
    toast({ title: 'Picklist Created', description: plNumber });
    onCreated?.(newPl);
    onClose();
    setSelectedOrder(null);
    setStep('select');
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            {step === 'select' ? 'Create Pick List — Select Sales Order' : `Create Pick List — ${selectedOrder?.so_number}`}
          </DialogTitle>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Search by order number or customer..." value={search}
                onChange={e => setSearch(e.target.value)} className="pl-9 h-11 text-sm" />
            </div>

            {ordersLoading ? (
              <div className="py-8 text-center text-slate-400 text-sm">Loading orders...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">No eligible orders found</div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-700">Sales Order</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-700">Customer</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-700">Status</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-700">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map(o => (
                      <tr key={o.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => handleSelectOrder(o)}>
                        <td className="px-3 py-2 font-medium text-blue-600">{o.so_number}</td>
                        <td className="px-3 py-2 text-slate-700">{o.customer_name || '—'}</td>
                        <td className="px-3 py-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                            {o.status?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" variant="outline" className="h-8 text-xs">Select</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {step === 'configure' && (
          <div className="space-y-4">
            {/* Order summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-xs text-blue-600 font-medium">Customer</span>
                <p className="font-semibold text-slate-900">{selectedOrder.customer_name || '—'}</p>
              </div>
              <div>
                <span className="text-xs text-blue-600 font-medium">Transporter</span>
                <p className="font-semibold text-slate-900">{selectedOrder.transporter || '—'}</p>
              </div>
              <div>
                <span className="text-xs text-blue-600 font-medium">Packaging</span>
                <p className="font-semibold text-slate-900">{selectedOrder.packaging_type || '—'}</p>
              </div>
              <div>
                <span className="text-xs text-blue-600 font-medium">Platform</span>
                <p className="font-semibold text-slate-900">{selectedOrder.platform || '—'}</p>
              </div>
            </div>

            {/* Items table */}
            {itemsLoading ? (
              <div className="py-6 text-center text-slate-400 text-sm">Loading items...</div>
            ) : soItems.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-sm">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-400" />
                No items found for this order
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-700">Item Code</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-700">Description</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-700">Order Qty</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-700">Available Stock</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-700">Pick Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {soItems.map(item => {
                      const code = (item.item_code || item.sku_code || '').toUpperCase();
                      const product = productMap[code];
                      const stock = product?.current_stock || 0;
                      const qty = item.quantity || 0;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono text-slate-800 text-xs">{item.item_code || item.sku_code || '—'}</td>
                          <td className="px-3 py-2 text-slate-600">{item.description}</td>
                          <td className="px-3 py-2 text-right font-medium">{qty}</td>
                          <td className="px-3 py-2 text-right">
                            <span className={`font-bold ${stock >= qty ? 'text-green-700' : stock > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                              {stock}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Input type="number" min="0" max={qty}
                              className="h-8 w-20 text-sm text-right ml-auto"
                              value={pickQtys[item.id] ?? qty}
                              onChange={e => setPickQtys(p => ({ ...p, [item.id]: e.target.value }))} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" className="h-11 text-sm" onClick={handleBack}>Back</Button>
              <Button className="h-11 text-sm bg-slate-900 hover:bg-slate-800 text-white gap-1.5"
                onClick={handleCreate} disabled={saving || soItems.length === 0}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                Generate Pick List
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}