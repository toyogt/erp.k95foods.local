import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Plus, Pencil, Trash2, Loader2, Search, Zap,
  Download, Upload, ChevronDown, ChevronRight, Info, FlaskConical
} from 'lucide-react';

function genOrderId() {
  const d = new Date();
  const ds = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  return `PO-${ds}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;
}

function computeLine(targetBottles, bpb) {
  const tb = Number(targetBottles) || 0;
  const b  = Number(bpb) || 1;
  const targetBoxes = Math.ceil(tb / b);
  const requiredBottles = targetBoxes * b;
  return { targetBoxes, requiredBottles };
}

function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// --- Searchable SKU Picker ---
function SKUPicker({ products, value, onChange }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) { if (!ref.current?.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = products.filter(p => {
    if (!q) return true;
    const hay = `${p.item_code} ${p.product_name || ''} ${p.brand_name || ''} ${p.flavour || ''} ${p.mrp || ''}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  }).slice(0, 40);

  const selected = products.find(p => p.item_code === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setQ(''); }}
        className="w-full flex items-center justify-between border border-slate-200 rounded-md px-3 py-2 text-sm bg-white text-left h-9"
      >
        <span className={selected ? 'text-slate-900 font-mono font-semibold' : 'text-slate-400'}>
          {selected ? `${selected.item_code} — ${selected.product_name}` : '— Select SKU —'}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                autoFocus
                className="w-full pl-7 pr-2 py-1.5 text-sm border border-slate-200 rounded outline-none"
                placeholder="Search by code, name, brand, flavour, MRP…"
                value={q}
                onChange={e => setQ(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No SKUs found</p>}
            {filtered.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => { onChange(p.item_code); setOpen(false); }}
                className={`w-full text-left px-3 py-2 hover:bg-slate-50 text-sm ${value === p.item_code ? 'bg-blue-50' : ''}`}
              >
                <span className="font-mono font-semibold text-xs text-slate-900">{p.item_code}</span>
                <span className="text-slate-600 ml-2 text-xs">{p.product_name}{p.brand_name ? ` · ${p.brand_name}` : ''}{p.flavour ? ` · ${p.flavour}` : ''}{p.mrp ? ` · ₹${p.mrp}` : ''}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Add Line Row (inline) ---
function AddLineRow({ orderId, products, boxTypes, onSaved, onCancel }) {
  const [skuCode, setSkuCode] = useState('');
  const [targetBottles, setTargetBottles] = useState('');
  const [saving, setSaving] = useState(false);

  const sku = products.find(p => p.item_code === skuCode);
  const bpb = (() => {
    if (!sku) return null;
    if (sku.bottles_per_box) return sku.bottles_per_box;
    if (sku.box_type_id) {
      const bt = boxTypes.find(b => b.box_type_id === sku.box_type_id);
      return bt?.bottles_per_box || null;
    }
    return null;
  })();

  const { targetBoxes, requiredBottles } = bpb && targetBottles
    ? computeLine(targetBottles, bpb)
    : { targetBoxes: null, requiredBottles: null };

  const roundingUp = requiredBottles && Number(targetBottles) && requiredBottles > Number(targetBottles)
    ? requiredBottles - Number(targetBottles) : 0;

  async function save() {
    if (!skuCode || !targetBottles) { alert('SKU and target bottles required'); return; }
    if (!bpb) { alert('SKU has no bottles_per_box configured'); return; }
    setSaving(true);
    await base44.entities.ProductionOrderLine.create({
      order_id: orderId,
      sku_code: skuCode,
      target_bottles_requested: Number(targetBottles),
      bottles_per_box: bpb,
      target_boxes: targetBoxes,
      required_bottles: requiredBottles,
      produced_bottles_packed: 0,
      status: 'OPEN',
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="bg-white border border-blue-200 rounded-lg p-3 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="sm:col-span-2">
          <Label className="text-xs">SKU *</Label>
          <SKUPicker products={products} value={skuCode} onChange={setSkuCode} />
        </div>
        <div>
          <Label className="text-xs">Target Bottles *</Label>
          <Input
            type="number"
            min="1"
            placeholder="e.g. 1000"
            value={targetBottles}
            onChange={e => setTargetBottles(e.target.value)}
            className="text-sm"
          />
        </div>
      </div>

      {/* Auto-computed preview */}
      {bpb && targetBottles && Number(targetBottles) > 0 && (
        <div className="flex flex-wrap gap-4 bg-slate-50 rounded-lg px-3 py-2 text-xs">
          <span className="text-slate-600">Per box: <b>{bpb}</b></span>
          <span className="text-slate-600">Target boxes: <b>{targetBoxes}</b></span>
          <span className="text-slate-600">Required bottles: <b>{requiredBottles}</b></span>
          {roundingUp > 0 && (
            <span className="flex items-center gap-1 text-amber-600 font-semibold">
              <Info className="w-3 h-3" /> Rounded up by +{roundingUp} bottles to complete full boxes.
            </span>
          )}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={onCancel} className="text-xs">Cancel</Button>
        <Button size="sm" onClick={save} disabled={saving} className="text-xs">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add Line'}
        </Button>
      </div>
    </div>
  );
}

// --- Main Page ---
export default function ProductionOrders() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [lines, setLines] = useState([]);
  const [products, setProducts] = useState([]);
  const [boxTypes, setBoxTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [orderForm, setOrderForm] = useState({
    order_id: '', order_name: '', due_date: '', priority: 'MED', status: 'OPEN', notes: ''
  });
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [addingLine, setAddingLine] = useState(null);
  const [selectedLines, setSelectedLines] = useState(new Set());
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [importing, setImporting] = useState(null); // order_id being imported to
  const [planFromOrderOpen, setPlanFromOrderOpen] = useState(false);
  const [recipeGroups, setRecipeGroups] = useState([]);
  const [recipeOptions, setRecipeOptions] = useState([]);
  const [optionOverrides, setOptionOverrides] = useState({}); // { [recipe_group_id]: option_id }
  const csvRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      loadData();
    });
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [ords, lns, prods, bts, rgs, opts, packedEvents] = await Promise.all([
      base44.entities.ProductionOrder.list('-created_date', 500),
      base44.entities.ProductionOrderLine.list('-created_date', 1000),
      base44.entities.ProductMaster.filter({ is_active: true }, '-created_date', 500),
      base44.entities.BoxType.list('-created_date', 200).catch(() => []),
      base44.entities.RecipeGroup.list('-created_date', 200).catch(() => []),
      base44.entities.RecipeOption.list('-created_date', 500).catch(() => []),
      base44.entities.PackedOutputEvent.filter({ status: 'ACTIVE' }, '-created_date', 5000).catch(() => []),
    ]);

    for (const line of lns) {
      const events = packedEvents.filter(e => e.sku_code === line.sku_code && e.order_id === line.order_id);
      line.produced_bottles_packed = events.reduce((sum, e) => sum + (e.packed_bottles || 0), 0);
    }

    setOrders(ords);
    setLines(lns);
    setProducts(prods);
    setBoxTypes(bts);
    setLoading(false);
  };

  const openNewOrder = () => {
    setEditingOrder(null);
    setOrderForm({ order_id: genOrderId(), order_name: '', due_date: '', priority: 'MED', status: 'OPEN', notes: '' });
    setOrderDialogOpen(true);
  };

  const openEditOrder = (order) => {
    setEditingOrder(order);
    setOrderForm({ ...order });
    setOrderDialogOpen(true);
  };

  const saveOrder = async () => {
    if (!orderForm.order_id.trim()) { alert('Order ID is required'); return; }
    if (editingOrder) {
      await base44.entities.ProductionOrder.update(editingOrder.id, orderForm);
    } else {
      await base44.entities.ProductionOrder.create(orderForm);
    }
    setOrderDialogOpen(false);
    loadData();
  };

  const deleteOrder = async (id) => {
    if (!window.confirm('Delete this order and all lines?')) return;
    await base44.entities.ProductionOrder.delete(id);
    loadData();
  };

  const deleteLine = async (id) => {
    if (!window.confirm('Delete this line?')) return;
    await base44.entities.ProductionOrderLine.delete(id);
    loadData();
  };

  const computeLineStatus = (line) => {
    if ((line.produced_bottles_packed || 0) >= (line.required_bottles || 0)) return 'DONE';
    if ((line.produced_bottles_packed || 0) > 0) return 'PARTIAL';
    return 'OPEN';
  };

  const getLinesByOrder = (orderId) => lines.filter(l => l.order_id === orderId);

  const toggleLineSelection = (lineId) => {
    const s = new Set(selectedLines);
    s.has(lineId) ? s.delete(lineId) : s.add(lineId);
    setSelectedLines(s);
  };

  const handleCreateLiquidPlans = async () => {
    if (selectedLines.size === 0) { alert('Select at least one line'); return; }
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

  // CSV template download
  const handleDownloadTemplate = () => {
    downloadCSV('production_order_template.csv', [
      ['sku_code', 'target_bottles'],
      ['SKU-EXAMPLE-001', '1000'],
      ['SKU-EXAMPLE-002', '500'],
    ]);
  };

  // CSV import for a specific order
  const handleImportCSV = (orderId) => {
    setImporting(orderId);
    setTimeout(() => csvRef.current?.click(), 50);
  };

  const handleCSVFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !importing) return;
    const text = await file.text();
    const rows = text.trim().split('\n').map(r => r.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
    const header = rows[0].map(h => h.toLowerCase());
    const skuIdx = header.indexOf('sku_code');
    const bottlesIdx = header.indexOf('target_bottles');
    if (skuIdx < 0 || bottlesIdx < 0) { alert('CSV must have columns: sku_code, target_bottles'); return; }

    let imported = 0, errors = [];
    for (const row of rows.slice(1)) {
      if (!row[skuIdx]) continue;
      const skuCode = row[skuIdx];
      const targetBottles = Number(row[bottlesIdx]);
      if (!targetBottles || isNaN(targetBottles)) { errors.push(`${skuCode}: invalid bottles`); continue; }

      const sku = products.find(p => p.item_code === skuCode);
      let bpb = sku?.bottles_per_box;
      if (!bpb && sku?.box_type_id) {
        const bt = boxTypes.find(b => b.box_type_id === sku.box_type_id);
        bpb = bt?.bottles_per_box;
      }
      if (!bpb) { errors.push(`${skuCode}: SKU not found or missing bottles_per_box`); continue; }

      const { targetBoxes, requiredBottles } = computeLine(targetBottles, bpb);
      await base44.entities.ProductionOrderLine.create({
        order_id: importing,
        sku_code: skuCode,
        target_bottles_requested: targetBottles,
        bottles_per_box: bpb,
        target_boxes: targetBoxes,
        required_bottles: requiredBottles,
        produced_bottles_packed: 0,
        status: 'OPEN',
      });
      imported++;
    }

    e.target.value = '';
    setImporting(null);
    if (errors.length) alert(`Imported ${imported} lines.\nErrors:\n${errors.join('\n')}`);
    else alert(`Imported ${imported} lines successfully.`);
    loadData();
  };

  const filteredOrders = orders.filter(o =>
    !search ||
    o.order_id?.toLowerCase().includes(search.toLowerCase()) ||
    o.order_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!user) return <div className="text-center py-12 text-slate-500">Unauthorized</div>;

  return (
    <div className="space-y-4">
      <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCSVFile} />

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Production Orders</h1>
        <p className="text-sm text-slate-500">Create and track production orders by SKU. Targets in bottles — boxes computed automatically.</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
          <Input className="pl-8 w-56 text-sm" placeholder="Search orders…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" /> CSV Template
          </Button>
          <Button onClick={openNewOrder} className="gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" /> New Order
          </Button>
        </div>
      </div>

      {selectedLines.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex justify-between items-center">
          <p className="text-sm font-medium text-blue-900">{selectedLines.size} line(s) selected</p>
          <Button size="sm" onClick={handleCreateLiquidPlans} disabled={creatingPlan} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
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
              <div key={order.id} className="border border-slate-200 rounded-xl bg-white">
                {/* Header */}
                <div
                  className="p-4 flex justify-between items-start cursor-pointer hover:bg-slate-50 rounded-xl"
                  onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                >
                  <div className="flex items-start gap-2">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900 font-mono">{order.order_id}</p>
                        {order.order_name && <p className="text-sm text-slate-600">— {order.order_name}</p>}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          order.status === 'CLOSED' ? 'bg-green-100 text-green-700' :
                          order.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-700'}`}>{order.status}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          order.priority === 'HIGH' ? 'bg-red-100 text-red-700' :
                          order.priority === 'MED' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'}`}>{order.priority}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">Due: {order.due_date || '—'} | Lines: {orderLines.length}</p>
                      {order.notes && <p className="text-xs text-slate-500 mt-0.5">{order.notes}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); openEditOrder(order); }} className="p-1.5 rounded-lg hover:bg-slate-100">
                      <Pencil className="w-4 h-4 text-slate-500" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteOrder(order.id); }} className="p-1.5 rounded-lg hover:bg-red-50">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>

                {/* Expanded Lines */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-4 space-y-3 bg-slate-50 rounded-b-xl">
                    {orderLines.length > 0 && (
                      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wide">
                            <tr>
                              <th className="px-3 py-2 text-left w-8"></th>
                              <th className="px-3 py-2 text-left">SKU</th>
                              <th className="px-3 py-2 text-right">Requested</th>
                              <th className="px-3 py-2 text-right">Per Box</th>
                              <th className="px-3 py-2 text-right">Boxes</th>
                              <th className="px-3 py-2 text-right">Required</th>
                              <th className="px-3 py-2 text-right">Produced</th>
                              <th className="px-3 py-2 text-right">Pending</th>
                              <th className="px-3 py-2 text-center">Status</th>
                              <th className="px-3 py-2 text-center">Del</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {orderLines.map(line => {
                              const status = computeLineStatus(line);
                              const pending = Math.max(0, (line.required_bottles || 0) - (line.produced_bottles_packed || 0));
                              return (
                                <tr key={line.id} className="hover:bg-slate-50">
                                  <td className="px-3 py-2 text-center">
                                    <input
                                      type="checkbox"
                                      checked={selectedLines.has(line.id)}
                                      onChange={() => toggleLineSelection(line.id)}
                                    />
                                  </td>
                                  <td className="px-3 py-2 font-mono text-xs font-bold text-slate-800">{line.sku_code}</td>
                                  <td className="px-3 py-2 text-right">{line.target_bottles_requested}</td>
                                  <td className="px-3 py-2 text-right text-slate-500">{line.bottles_per_box}</td>
                                  <td className="px-3 py-2 text-right text-slate-500">{line.target_boxes}</td>
                                  <td className="px-3 py-2 text-right font-semibold">{line.required_bottles}</td>
                                  <td className="px-3 py-2 text-right font-semibold text-green-700">{line.produced_bottles_packed || 0}</td>
                                  <td className="px-3 py-2 text-right font-semibold text-orange-600">{pending}</td>
                                  <td className="px-3 py-2 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                      status === 'DONE' ? 'bg-green-100 text-green-700' :
                                      status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-slate-100 text-slate-600'}`}>{status}</span>
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <button onClick={() => deleteLine(line.id)} className="p-1 rounded hover:bg-red-50">
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

                    {addingLine === order.id ? (
                      <AddLineRow
                        orderId={order.order_id}
                        products={products}
                        boxTypes={boxTypes}
                        onSaved={() => { setAddingLine(null); loadData(); }}
                        onCancel={() => setAddingLine(null)}
                      />
                    ) : (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setAddingLine(order.id)} className="gap-1.5 text-xs">
                          <Plus className="w-3.5 h-3.5" /> Add SKU Line
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleImportCSV(order.order_id)} className="gap-1.5 text-xs">
                          <Upload className="w-3.5 h-3.5" /> Import CSV
                        </Button>
                      </div>
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
                readOnly={!!editingOrder}
                onChange={e => setOrderForm(f => ({ ...f, order_id: e.target.value }))}
                className="text-sm font-mono"
                placeholder="Auto-generated"
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
                  className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm bg-white h-9"
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
                  className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-sm bg-white h-9"
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
            <Button onClick={saveOrder}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}