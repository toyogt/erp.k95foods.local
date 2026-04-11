/**
 * Logistics Review → Picklist Panel
 *
 * Mirrors ERP flow exactly:
 *   Step 1 (logistics_review): Set transporter + packaging_type + review stock
 *              → "Approve for Picking" (condition: transporter AND packaging_type must be set)
 *              → SO moves to "picking" (Ready to Pick & Pack)
 *
 *   Step 2 (picking, no picklist): Edit pick quantities
 *              → "Generate Picklist" → PL created in Draft, SO stays in picking
 *
 *   Step 3 (PL Draft): Confirm dispatch date
 *              → "Dispatch Date Confirmed" (condition: dispatch_date must be set)
 *              → PL moves to dispatch_scheduled
 *
 *   Step 4 (PL dispatch_scheduled): Pick & pack the order
 *              → "Pick & Packing Done" → PL moves to pick_packed
 *
 *   Step 5 (PL pick_packed): Mark delivered
 *              → "Mark Delivered" → PL moves to delivered
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle2, AlertTriangle, Loader2, Package, Calendar, Truck, ClipboardList } from 'lucide-react';
import { fireFMSEvent, findFMSInstanceByRef, linkFMSRef } from '@/lib/useFMSAutoComplete';

const PL_STEPS = [
  { key: 'draft',              label: 'Draft' },
  { key: 'dispatch_scheduled', label: 'Dispatch Scheduled' },
  { key: 'pick_packed',        label: 'Pick & Packed' },
];

const STOCK_STYLE = { ok: 'text-green-600', short: 'text-amber-600', none: 'text-red-600', unknown: 'text-slate-400' };
const STOCK_LABEL = { ok: 'Available', short: 'Short', none: 'Out of Stock', unknown: 'Not on Record' };

export default function SOStockPicklistPanel({ order, items, onUpdated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [shortageConfirm, setShortageConfirm] = useState(false); // mirrors "Partial Pick List" + "Checks & Validations"
  const [logisticsForm, setLogisticsForm] = useState({
    transporter: order?.transporter || '',
    packaging_type: order?.packaging_type || '',
  });
  const [pickQtys, setPickQtys] = useState(() =>
    Object.fromEntries(items.map(i => [i.id, i.quantity ?? '']))
  );
  const [scheduleForm, setScheduleForm] = useState({
    dispatch_date: '',
    appointment_date: '',
    expiry_date: order?.po_expiry_date || '',
  });

  const { data: settingsList = [] } = useQuery({
    queryKey: ['sales_settings'],
    queryFn: () => base44.entities.SalesSettings.list(),
  });
  const transporters = settingsList.find(s => s.setting_key === 'transporters')?.values || [];
  const packingTypes = settingsList.find(s => s.setting_key === 'packing_types')?.values || [];

  const { data: warehouseLots = [] } = useQuery({
    queryKey: ['warehouse_lots_active'],
    queryFn: () => base44.entities.WarehouseLot.filter({ status: 'ACTIVE' }, '-created_date', 300),
  });

  const { data: picklists = [], refetch: refetchPicklists } = useQuery({
    queryKey: ['picklists', order.id],
    queryFn: () => base44.entities.SalesPicklist.filter({ sales_order_id: order.id }, '-created_date'),
  });

  const activePicklist = picklists[0] ?? null;
  const plStatus = activePicklist?.status || null;

  // ── Stock helpers ──────────────────────────────────────────────────────────
  function getWarehouseStock(item) {
    const code = item.item_code || item.sku_code;
    if (!code) return null;
    const matching = warehouseLots.filter(l =>
      l.sku_code === code || l.sku_code?.includes(code) || code?.includes(l.sku_code)
    );
    if (!matching.length) return null;
    return matching.reduce((s, l) => s + (l.boxes_balance || 0) * (item.packing_unit || 12) + (l.loose_bottles_balance || 0), 0);
  }

  function getStockStatus(item) {
    const stock = getWarehouseStock(item);
    const pick = parseFloat(pickQtys[item.id]) || item.quantity || 0;
    if (stock === null) return 'unknown';
    if (stock >= pick) return 'ok';
    if (stock > 0) return 'short';
    return 'none';
  }

  // ── Step 1: Approve for Picking ────────────────────────────────────────────
  // Mirrors "Checks & Validations" + "Partial Pick List" client scripts:
  // if shortages exist, confirm partial pick before proceeding
  async function handleApproveForPickingWithCheck() {
    if (!logisticsForm.transporter || !logisticsForm.packaging_type) {
      toast({ title: 'Transporter and packaging type are required before approving for picking', variant: 'destructive' });
      return;
    }
    const hasShortages = items.some(item => {
      const s = getStockStatus(item);
      return s === 'short' || s === 'none';
    });
    if (hasShortages && !shortageConfirm) {
      setShortageConfirm(true);
      return;
    }
    setShortageConfirm(false);
    await handleApproveForPicking();
  }

  async function handleApproveForPicking() {
    if (!logisticsForm.transporter || !logisticsForm.packaging_type) {
      toast({ title: 'Transporter and packaging type are required before approving for picking', variant: 'destructive' });
      return;
    }
    setSaving(true);

    // Save stock check to items
    for (const item of items) {
      const stock = getWarehouseStock(item);
      const status = getStockStatus(item);
      const stockStatus = status === 'ok' ? 'full' : status === 'short' ? 'partial' : 'unavailable';
      await base44.entities.SalesOrderItem.update(item.id, { available_stock: stock ?? 0, stock_status: stockStatus });
    }
    const statuses = items.map(i => getStockStatus(i));
    const overall = statuses.every(s => s === 'ok') ? 'full' : statuses.every(s => s === 'none') ? 'unavailable' : 'partial';

    // Save transporter + packaging_type to SO + move to picking
    await base44.entities.SalesOrder.update(order.id, {
      transporter: logisticsForm.transporter,
      packaging_type: logisticsForm.packaging_type,
      stock_validation_status: overall,
      stock_validated_by: user?.email,
      stock_validated_at: new Date().toISOString(),
      status: 'picking',
    });

    await fireFMSEvent('sales_picking_started', order.id);
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesOrder', entity_id: order.id,
      reference_number: order.so_number, action: 'approved_for_picking',
      new_value: `Transporter: ${logisticsForm.transporter}, Stock: ${overall}`,
      user_email: user?.email,
    });

    setSaving(false);
    toast({ title: 'Approved for Picking', description: `Stock: ${overall}` });
    onUpdated();
  }

  // ── Step 2: Generate Picklist ──────────────────────────────────────────────
  async function handleGeneratePicklist() {
    setSaving(true);
    const plNumber = `PL-${Date.now().toString().slice(-7)}`;
    const picklistItems = items.map(i => ({
      sales_order_item_id: i.id, item_code: i.item_code, description: i.description,
      location: i.location || 'Finished Goods',
      required_qty: parseFloat(pickQtys[i.id]) || i.quantity,
      picked_qty: 0, status: 'pending',
    }));

    const pl = await base44.entities.SalesPicklist.create({
      sales_order_id: order.id, so_number: order.so_number, picklist_number: plNumber,
      status: 'draft', generated_by: user?.email,
      company: 'K95 Foods Private Limited', purpose: 'Delivery',
      customer_name: order?.customer_name || '',
      warehouse: 'Finished Goods - KFPL',
      transporter: order.transporter, packaging_type: order.packaging_type,
      po_number: order.po_number || order.so_number || '',
      items: picklistItems,
    });

    const instances = await findFMSInstanceByRef(order.id);
    if (instances[0]) await linkFMSRef(instances[0].id, pl.id);
    await fireFMSEvent('sales_picklist_created', order.id);
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesPicklist', entity_id: pl.id, reference_number: plNumber,
      action: 'picklist_generated', user_email: user?.email,
    });

    setSaving(false);
    toast({ title: 'Picklist generated', description: plNumber });
    refetchPicklists(); onUpdated();
  }

  // ── Step 3: Confirm Dispatch Date ─────────────────────────────────────────
  async function handleConfirmDispatchDate() {
    // Mirrors ERPNext "PL Mandatory" server script:
    // dispatch_date required before Dispatch Scheduled / Pick & Packed
    if (!scheduleForm.dispatch_date) {
      toast({ title: 'Dispatch Date is required before confirming schedule', variant: 'destructive' }); return;
    }
    setSaving(true);
    await base44.entities.SalesPicklist.update(activePicklist.id, {
      status: 'dispatch_scheduled',
      dispatch_date: scheduleForm.dispatch_date,
      appointment_date: scheduleForm.appointment_date,
      expiry_date: scheduleForm.expiry_date,
    });
    await fireFMSEvent('sales_dispatch_scheduled', activePicklist.id);
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesPicklist', entity_id: activePicklist.id,
      reference_number: activePicklist.picklist_number,
      action: 'dispatch_date_confirmed', new_value: scheduleForm.dispatch_date,
      user_email: user?.email,
    });
    setSaving(false);
    toast({ title: 'Dispatch date confirmed' });
    refetchPicklists(); onUpdated();
  }

  // ── Step 4: Pick & Packing Done ───────────────────────────────────────────
  async function handlePickPackDone() {
    setSaving(true);
    const updatedItems = activePicklist.items.map(item => {
      const picked = parseFloat(pickQtys[item.sales_order_item_id] ?? item.required_qty ?? 0);
      return { ...item, picked_qty: picked, status: picked >= item.required_qty ? 'picked' : picked > 0 ? 'short' : 'pending' };
    });
    await base44.entities.SalesPicklist.update(activePicklist.id, {
      items: updatedItems, status: 'pick_packed',
      completed_by: user?.email, completed_at: new Date().toISOString(),
    });
    await base44.entities.SalesOrder.update(order.id, { status: 'packing' });
    await fireFMSEvent('sales_picklist_completed', activePicklist.id);
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesPicklist', entity_id: activePicklist.id,
      reference_number: activePicklist.picklist_number,
      action: 'pick_and_pack_done', user_email: user?.email,
    });
    setSaving(false);
    toast({ title: 'Pick & Pack complete' });
    refetchPicklists(); onUpdated();
  }

  // ── Cancel Picklist ──────────────────────────────────────────────────────
  const [showCancelPL, setShowCancelPL] = useState(false);
  const [cancelReasonPL, setCancelReasonPL] = useState('');

  async function handleCancelPicklist() {
    if (!cancelReasonPL.trim()) {
      toast({ title: 'Cancellation reason is required', variant: 'destructive' }); return;
    }
    setSaving(true);
    await base44.entities.SalesPicklist.update(activePicklist.id, {
      status: 'cancelled', notes: cancelReasonPL,
    });
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesPicklist', entity_id: activePicklist.id,
      reference_number: activePicklist.picklist_number,
      action: 'cancelled', notes: cancelReasonPL, user_email: user?.email,
    });
    setSaving(false);
    setShowCancelPL(false);
    toast({ title: 'Picklist cancelled' });
    refetchPicklists(); onUpdated();
  }

  if (!items.length) return <div className="text-sm text-slate-400 py-4">No items on this order.</div>;

  // ── STEP 1 UI: Logistics Review (SO in logistics_review, no picklist) ──────
  if (order.status === 'logistics_review' && !activePicklist) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Logistics Review</h3>
          <p className="text-xs text-slate-500 mt-0.5">Set transporter and packaging type, review stock availability, then approve for picking.</p>
        </div>

        {/* Transporter + Packaging fields — required for Approve */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-amber-900">Logistics Details (required to approve)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-slate-700">Transporter *</Label>
              <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={logisticsForm.transporter}
                onChange={e => setLogisticsForm(f => ({ ...f, transporter: e.target.value }))}>
                <option value="">Select transporter...</option>
                {transporters.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-700">Packaging Type *</Label>
              <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={logisticsForm.packaging_type}
                onChange={e => setLogisticsForm(f => ({ ...f, packaging_type: e.target.value }))}>
                <option value="">Select packaging...</option>
                {packingTypes.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Stock Review Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-700">
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-right">Order Quantity</th>
                <th className="px-3 py-2 text-right">Stock in Warehouse</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(item => {
                const stock = getWarehouseStock(item);
                const status = getStockStatus(item);
                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-800">{item.description}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-700">{item.quantity}</td>
                    <td className="px-3 py-2 text-right">
                      {stock !== null
                        ? <span className={`font-semibold ${stock >= item.quantity ? 'text-green-700' : stock > 0 ? 'text-amber-700' : 'text-red-600'}`}>{stock}</span>
                        : <span className="text-slate-400 text-xs">Not found</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs font-semibold ${STOCK_STYLE[status]}`}>{STOCK_LABEL[status]}</span>
                      {status === 'short' && stock !== null && <div className="text-xs text-red-400">Short by {item.quantity - stock}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Shortage confirmation — mirrors ERPNext "Partial Pick List" confirm dialog */}
        {shortageConfirm && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Some items have stock shortages</p>
                <p className="text-xs text-amber-700 mt-0.5">Do you want to proceed and create a partial pick list for available items?</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="h-11 text-sm" onClick={() => setShortageConfirm(false)}>Cancel</Button>
              <Button className="h-11 bg-amber-600 hover:bg-amber-700 text-white text-sm" onClick={handleApproveForPicking} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Proceed with Partial Pick List
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button className="h-11 bg-slate-900 text-white text-sm" onClick={handleApproveForPickingWithCheck} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Approve for Picking
          </Button>
        </div>
      </div>
    );
  }

  // ── STEP 2 UI: Ready to Pick & Pack — generate picklist ───────────────────
  if (order.status === 'picking' && !activePicklist) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Generate Picklist</h3>
            <p className="text-xs text-slate-500 mt-0.5">Adjust pick quantities if needed, then generate the picklist.</p>
          </div>
          <Button className="h-11 bg-slate-900 text-white text-sm" onClick={handleGeneratePicklist} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ClipboardList className="w-4 h-4 mr-1" />}
            Generate Picklist
          </Button>
        </div>

        {/* Logistics summary */}
        <div className="flex gap-3 flex-wrap">
          {[['Transporter', order.transporter], ['Packaging', order.packaging_type], ['Stock', order.stock_validation_status]].map(([k, v]) => v && (
            <div key={k} className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-xs">
              <span className="text-indigo-500">{k}: </span><span className="font-medium text-indigo-800">{v}</span>
            </div>
          ))}
        </div>

        {/* Editable pick quantities */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-700">
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-right">Order Quantity</th>
                <th className="px-3 py-2 text-right">Stock in Warehouse</th>
                <th className="px-3 py-2 text-right">Pick Quantity to Send</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(item => {
                const stock = getWarehouseStock(item);
                const status = getStockStatus(item);
                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-800">{item.description}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-700">{item.quantity}</td>
                    <td className="px-3 py-2 text-right">
                      {stock !== null
                        ? <span className={`font-semibold ${stock >= item.quantity ? 'text-green-700' : stock > 0 ? 'text-amber-700' : 'text-red-600'}`}>{stock}</span>
                        : <span className="text-slate-400 text-xs">Not found</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input type="number" min="0" max={item.quantity}
                        className="h-8 w-20 text-sm text-right ml-auto"
                        value={pickQtys[item.id]}
                        onChange={e => setPickQtys(p => ({ ...p, [item.id]: e.target.value }))} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs font-semibold ${STOCK_STYLE[status]}`}>{STOCK_LABEL[status]}</span>
                      {status === 'short' && stock !== null && <div className="text-xs text-red-400">Short by {item.quantity - stock}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── STEPS 3-5 UI: Picklist workflow ───────────────────────────────────────
  if (activePicklist) {
    const currentStepIdx = PL_STEPS.findIndex(s => s.key === plStatus);
    return (
      <div className="space-y-4">
        {/* Picklist number + status */}
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm">
          <Package className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span className="text-blue-800 font-medium">{activePicklist.picklist_number}</span>
          <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${
            plStatus === 'delivered' || plStatus === 'pick_packed' ? 'bg-green-100 text-green-700' :
            plStatus === 'dispatch_scheduled' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
          }`}>{PL_STEPS.find(s => s.key === plStatus)?.label || plStatus}</span>
        </div>

        {/* Workflow progress */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto">
          <div className="flex items-center min-w-max">
            {PL_STEPS.map((step, i) => {
              const done = currentStepIdx > i;
              const active = currentStepIdx === i;
              return (
                <div key={step.key} className="flex items-center">
                  <div className="flex flex-col items-center gap-1 px-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${
                      done ? 'bg-green-100 text-green-600' : active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {done ? <CheckCircle2 className="w-4 h-4" /> : (i + 1)}
                    </div>
                    <span className={`text-xs font-medium text-center max-w-[80px] ${active ? 'text-slate-900' : done ? 'text-green-700' : 'text-slate-400'}`}>
                      {step.label}
                    </span>
                  </div>
                  {i < PL_STEPS.length - 1 && <div className={`w-8 h-0.5 mb-5 ${done ? 'bg-green-400' : 'bg-slate-200'}`} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 3: Dispatch date scheduling (PL in Draft) */}
        {plStatus === 'draft' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-semibold text-amber-900">Confirm Dispatch Date</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-700">Dispatch Date *</Label>
                <Input type="date" className="h-9 text-sm mt-1" value={scheduleForm.dispatch_date}
                  onChange={e => setScheduleForm(f => ({ ...f, dispatch_date: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Appointment Date</Label>
                <Input type="date" className="h-9 text-sm mt-1" value={scheduleForm.appointment_date}
                  onChange={e => setScheduleForm(f => ({ ...f, appointment_date: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Expiry Date</Label>
                <Input type="date" className="h-9 text-sm mt-1" value={scheduleForm.expiry_date}
                  onChange={e => setScheduleForm(f => ({ ...f, expiry_date: e.target.value }))} />
              </div>
            </div>
            <Button className="h-11 bg-slate-900 text-white text-sm" onClick={handleConfirmDispatchDate} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Calendar className="w-4 h-4 mr-1" />}
              Dispatch Date Confirmed
            </Button>
          </div>
        )}

        {/* Step 4: Dispatch scheduled — pick quantities */}
        {plStatus === 'dispatch_scheduled' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              {[
                ['Dispatch Date', activePicklist.dispatch_date],
                ['Appointment Date', activePicklist.appointment_date || '—'],
                ['Transporter', activePicklist.transporter || order.transporter || '—'],
                ['Packaging', activePicklist.packaging_type || order.packaging_type || '—'],
              ].map(([k, v]) => (
                <div key={k} className="bg-white border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">{k}</p>
                  <p className="font-medium text-slate-900">{v}</p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs text-slate-700">
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-right">Required Quantity</th>
                    <th className="px-3 py-2 text-right">Picked Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activePicklist.items?.map(item => (
                    <tr key={item.sales_order_item_id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-800">{item.description}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{item.required_qty}</td>
                      <td className="px-3 py-2 text-right">
                        <Input type="number" min="0"
                          className="h-8 w-20 text-sm text-right ml-auto"
                          defaultValue={item.required_qty}
                          onChange={e => setPickQtys(p => ({ ...p, [item.sales_order_item_id]: e.target.value }))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <Button className="h-11 bg-green-600 hover:bg-green-700 text-white text-sm" onClick={handlePickPackDone} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Package className="w-4 h-4 mr-1" />}
                Pick & Packing Done
              </Button>
            </div>
          </div>
        )}

        {/* Pick & Packed — done state */}
        {plStatus === 'pick_packed' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-green-800 font-medium">Pick & Pack completed</span>
              {activePicklist.completed_by && <span className="text-green-600 text-xs ml-2">by {activePicklist.completed_by}</span>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              {activePicklist.items?.map(item => (
                <div key={item.sales_order_item_id} className="bg-white border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">{item.description}</p>
                  <p className="font-semibold text-slate-900">{item.picked_qty ?? item.required_qty} pcs</p>
                  <span className={`text-xs font-medium ${item.status === 'picked' ? 'text-green-600' : item.status === 'short' ? 'text-amber-600' : 'text-slate-400'}`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cancel picklist (only from pick_packed per JSON) */}
        {plStatus === 'pick_packed' && !showCancelPL && (
          <div className="flex justify-end">
            <Button variant="outline" className="h-11 text-sm text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setShowCancelPL(true)} disabled={saving}>
              Cancel Picklist
            </Button>
          </div>
        )}
        {showCancelPL && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-semibold text-red-800">Cancel Picklist</h4>
            <Input className="h-9 text-sm border-red-300" value={cancelReasonPL}
              onChange={e => setCancelReasonPL(e.target.value)} placeholder="Reason for cancellation..." />
            <div className="flex gap-2">
              <Button variant="outline" className="h-11 text-sm" onClick={() => setShowCancelPL(false)}>Back</Button>
              <Button className="h-11 bg-red-600 hover:bg-red-700 text-white text-sm" onClick={handleCancelPicklist} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Confirm Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Cancelled state */}
        {plStatus === 'cancelled' && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm">
            <CheckCircle2 className="w-4 h-4 text-red-500" />
            <span className="text-red-800 font-medium">Picklist cancelled</span>
          </div>
        )}
      </div>
    );
  }

  // Fallback
  return (
    <div className="text-sm text-slate-400 py-4 text-center">
      Order must be in Logistics Review or Ready to Pick & Pack state to manage the picklist.
    </div>
  );
}