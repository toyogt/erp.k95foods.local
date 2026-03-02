import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Trash2, Loader2, Search, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function ProductionOrders() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [lines, setLines] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [orderForm, setOrderForm] = useState({ order_id: '', order_name: '', due_date: '', priority: 'MED', status: 'OPEN', notes: '' });
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [addingLine, setAddingLine] = useState(null);
  const [lineForm, setLineForm] = useState({ sku_code: '', target_bottles_requested: '' });
  const [selectedLines, setSelectedLines] = useState(new Set());
  const [creatingPlan, setCreatingPlan] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.role !== 'admin' && u?.role !== 'production_manager') {
        alert('Access denied');
        return;
      }
      loadData();
    });
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [ords, lns, prods] = await Promise.all([
      base44.entities.ProductionOrder.list('-created_date', 500),
      base44.entities.ProductionOrderLine.list('-created_date', 1000),
      base44.entities.ProductMaster.filter({ is_active: true }, '-created_date', 500),
    ]);
    setOrders(ords);
    setLines(lns);
    setProducts(prods);
    setLoading(false);
  };

  const handleAddOrder = () => {
    setEditingOrder(null);
    setOrderForm({ order_id: '', order_name: '', due_date: '', priority: 'MED', status: 'OPEN', notes: '' });
    setOrderDialogOpen(true);
  };

  const handleEditOrder = (order) => {
    setEditingOrder(order);
    setOrderForm({ ...order });
    setOrderDialogOpen(true);
  };

  const handleSaveOrder = async () => {
    if (!orderForm.order_id.trim()) {
      alert('Order ID is required');
      return;
    }
    if (editingOrder) {
      await base44.entities.ProductionOrder.update(editingOrder.id, orderForm);
    } else {
      await base44.entities.ProductionOrder.create(orderForm);
    }
    setOrderDialogOpen(false);
    loadData();
  };

  const handleDeleteOrder = async (id) => {
    if (!window.confirm('Delete this order and all lines?')) return;
    await base44.entities.ProductionOrder.delete(id);
    loadData();
  };

  const handleAddLine = (orderId) => {
    setAddingLine(orderId);
    setLineForm({ sku_code: '', target_bottles_requested: '' });
  };

  const handleSaveLine = async () => {
    if (!lineForm.sku_code || !lineForm.target_bottles_requested) {
      alert('SKU and target bottles required');
      return;
    }
    const sku = products.find(p => p.item_code === lineForm.sku_code);
    if (!sku?.bottles_per_box) {
      alert('SKU not found or bottles_per_box not set');
      return;
    }

    const targetBottles = Number(lineForm.target_bottles_requested);
    const boxesPerSkuCount = sku.bottles_per_box;
    const targetBoxes = Math.ceil(targetBottles / boxesPerSkuCount);
    const requiredBottles = targetBoxes * boxesPerSkuCount;

    await base44.entities.ProductionOrderLine.create({
      order_id: addingLine,
      sku_code: lineForm.sku_code,
      target_bottles_requested: targetBottles,
      bottles_per_box: boxesPerSkuCount,
      target_boxes: targetBoxes,
      required_bottles: requiredBottles,
      produced_bottles_packed: 0,
      status: 'OPEN',
    });
    setAddingLine(null);
    loadData();
  };

  const handleDeleteLine = async (id) => {
    if (!window.confirm('Delete this line?')) return;
    await base44.entities.ProductionOrderLine.delete(id);
    loadData();
  };

  const computeLineStatus = (line) => {
    if (line.produced_bottles_packed >= line.required_bottles) return 'DONE';
    if (line.produced_bottles_packed > 0) return 'PARTIAL';
    return 'OPEN';
  };

  const getLinesByOrder = (orderId) => lines.filter(l => l.order_id === orderId);

  const toggleLineSelection = (lineId) => {
    const newSelected = new Set(selectedLines);
    if (newSelected.has(lineId)) {
      newSelected.delete(lineId);
    } else {
      newSelected.add(lineId);
    }
    setSelectedLines(newSelected);
  };

  const handleCreateLiquidPlans = async () => {
    if (selectedLines.size === 0) {
      alert('Select at least one line');
      return;
    }

    setCreatingPlan(true);
    try {
      const response = await base44.functions.invoke('createLiquidPlansFromOrders', {
        selectedLineIds: Array.from(selectedLines),
        skuProducts: products,
      });
      alert(`Created ${response.data.plansCreated} liquid batch plan(s)`);
      setSelectedLines(new Set());
      loadData();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setCreatingPlan(false);
    }
  };

  const filteredOrders = orders.filter(o =>
    !search || o.order_id?.toLowerCase().includes(search.toLowerCase()) ||
    o.order_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!user) return <div className="text-center py-12 text-slate-500">Unauthorized</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Production Orders</h1>
        <p className="text-sm text-slate-500">Create and track production orders by SKU</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
          <Input
            className="pl-8 w-56 text-sm"
            placeholder="Search orders…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={handleAddOrder} className="gap-1.5 text-xs">
          <Plus className="w-3.5 h-3.5" /> New Order
        </Button>
      </div>

      {selectedLines.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex justify-between items-center">
          <p className="text-sm font-medium text-blue-900">{selectedLines.size} line(s) selected</p>
          <Button
            size="sm"
            onClick={handleCreateLiquidPlans}
            disabled={creatingPlan}
            className="gap-1.5 bg-blue-600 hover:bg-blue-700"
          >
            {creatingPlan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Create Liquid Plan(s)
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">No orders found</div>
        ) : (
          filteredOrders.map(order => {
            const orderLines = getLinesByOrder(order.order_id);
            const isExpanded = expandedOrder === order.id;
            return (
              <div key={order.id} className="border border-slate-200 rounded-lg bg-white">
                {/* Order Header */}
                <div className="p-4 flex justify-between items-start cursor-pointer hover:bg-slate-50" onClick={() => setExpandedOrder(isExpanded ? null : order.id)}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{order.order_id}</p>
                      {order.order_name && <p className="text-sm text-slate-600">— {order.order_name}</p>}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        order.status === 'CLOSED' ? 'bg-green-100 text-green-700' :
                        order.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {order.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        order.priority === 'HIGH' ? 'bg-red-100 text-red-700' :
                        order.priority === 'MED' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {order.priority}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Due: {order.due_date || '—'} | Lines: {orderLines.length}</p>
                    {order.notes && <p className="text-xs text-slate-600 mt-1">{order.notes}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); handleEditOrder(order); }} className="p-1.5 rounded-lg hover:bg-slate-100">
                      <Pencil className="w-4 h-4 text-slate-500" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteOrder(order.id); }} className="p-1.5 rounded-lg hover:bg-red-50">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>

                {/* Order Lines (Expanded) */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-4 space-y-3 bg-slate-50">
                    {orderLines.length === 0 ? (
                      <p className="text-sm text-slate-500">No lines yet</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-100 text-slate-700 text-xs uppercase tracking-wide">
                            <tr>
                              <th className="px-3 py-2 text-left w-8"><input type="checkbox" /></th>
                              <th className="px-3 py-2 text-left">SKU</th>
                              <th className="px-3 py-2 text-right">Requested</th>
                              <th className="px-3 py-2 text-right">Per Box</th>
                              <th className="px-3 py-2 text-right">Target Boxes</th>
                              <th className="px-3 py-2 text-right">Required</th>
                              <th className="px-3 py-2 text-right">Produced</th>
                              <th className="px-3 py-2 text-right">Pending</th>
                              <th className="px-3 py-2 text-center">Status</th>
                              <th className="px-3 py-2 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {orderLines.map(line => {
                              const status = computeLineStatus(line);
                              const pending = Math.max(0, line.required_bottles - line.produced_bottles_packed);
                              return (
                                <tr key={line.id} className="hover:bg-slate-50">
                                  <td className="px-3 py-2 text-center">
                                    <input
                                      type="checkbox"
                                      checked={selectedLines.has(line.id)}
                                      onChange={() => toggleLineSelection(line.id)}
                                    />
                                  </td>
                                  <td className="px-3 py-2 font-mono text-xs font-semibold">{line.sku_code}</td>
                                  <td className="px-3 py-2 text-right font-medium">{line.target_bottles_requested}</td>
                                  <td className="px-3 py-2 text-right text-slate-600">{line.bottles_per_box}</td>
                                  <td className="px-3 py-2 text-right text-slate-600">{line.target_boxes}</td>
                                  <td className="px-3 py-2 text-right text-slate-600">{line.required_bottles}</td>
                                  <td className="px-3 py-2 text-right font-semibold text-green-700">{line.produced_bottles_packed}</td>
                                  <td className="px-3 py-2 text-right font-semibold text-orange-700">{pending}</td>
                                  <td className="px-3 py-2 text-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      status === 'DONE' ? 'bg-green-100 text-green-700' :
                                      status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-slate-100 text-slate-700'
                                    }`}>
                                      {status}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <button onClick={() => handleDeleteLine(line.id)} className="p-1 hover:bg-red-50 rounded">
                                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Add Line Form */}
                    {addingLine === order.id ? (
                      <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Label className="text-xs">SKU</Label>
                            <select
                              value={lineForm.sku_code}
                              onChange={e => setLineForm(f => ({ ...f, sku_code: e.target.value }))}
                              className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm bg-white"
                            >
                              <option value="">— Select SKU —</option>
                              {products.map(p => <option key={p.id} value={p.item_code}>{p.item_code} - {p.product_name}</option>)}
                            </select>
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs">Target Bottles</Label>
                            <Input
                              type="number"
                              placeholder="0"
                              value={lineForm.target_bottles_requested}
                              onChange={e => setLineForm(f => ({ ...f, target_bottles_requested: e.target.value }))}
                              className="text-sm"
                            />
                          </div>
                          <div className="flex items-end gap-1">
                            <Button size="sm" onClick={handleSaveLine} className="text-xs">Add</Button>
                            <Button size="sm" variant="outline" onClick={() => setAddingLine(null)} className="text-xs">Cancel</Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => handleAddLine(order.id)} className="gap-1.5 text-xs">
                        <Plus className="w-3.5 h-3.5" /> Add SKU Line
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Order Dialog */}
      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingOrder ? 'Edit Order' : 'New Production Order'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Order ID *</Label>
              <Input
                value={orderForm.order_id}
                onChange={e => setOrderForm(f => ({ ...f, order_id: e.target.value }))}
                className="text-sm"
                placeholder="e.g., ORD-20260302-001"
              />
            </div>
            <div>
              <Label className="text-xs">Order Name</Label>
              <Input
                value={orderForm.order_name}
                onChange={e => setOrderForm(f => ({ ...f, order_name: e.target.value }))}
                className="text-sm"
                placeholder="Optional friendly name"
              />
            </div>
            <div>
              <Label className="text-xs">Due Date</Label>
              <Input
                type="date"
                value={orderForm.due_date}
                onChange={e => setOrderForm(f => ({ ...f, due_date: e.target.value }))}
                className="text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Priority</Label>
                <select
                  value={orderForm.priority}
                  onChange={e => setOrderForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm bg-white"
                >
                  <option value="LOW">Low</option>
                  <option value="MED">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <select
                  value={orderForm.status}
                  onChange={e => setOrderForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm bg-white"
                >
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <textarea
                value={orderForm.notes}
                onChange={e => setOrderForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm"
                rows="3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveOrder}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}