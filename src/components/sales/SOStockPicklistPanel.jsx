/**
 * Pick List Panel — mirrors PL Minimal Workflow:
 *   Draft → Dispatch Scheduled → Pick & Packed → Delivered
 * 
 * Conditions from ERP:
 *   - "Dispatch Date Confirmed" requires dispatch_date set
 *   - "Pick & Packing Done" requires picking completion
 *   - "Delivered" maps to final state
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle2, AlertTriangle, Loader2, Package, Calendar, Truck } from 'lucide-react';
import { fireFMSEvent, linkFMSRef, findFMSInstanceByRef } from '@/lib/useFMSAutoComplete';

const PL_WORKFLOW_STEPS = [
  { key: 'draft',              label: 'Draft',              icon: Package },
  { key: 'dispatch_scheduled', label: 'Dispatch Scheduled', icon: Calendar },
  { key: 'picking',            label: 'Pick & Pack',        icon: Package },
  { key: 'pick_packed',        label: 'Pick & Packed',      icon: CheckCircle2 },
  { key: 'delivered',          label: 'Delivered',          icon: Truck },
];

const PL_TRANSITIONS = [
  { from: 'draft',              action: 'Dispatch Date Confirmed', next: 'dispatch_scheduled', condition: 'dispatch_date' },
  { from: 'dispatch_scheduled', action: 'Pick & Packing Done',    next: 'pick_packed',         condition: null },
  { from: 'pick_packed',        action: 'Mark Delivered',          next: 'delivered',           condition: null },
];

export default function SOStockPicklistPanel({ order, items, onUpdated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [pickQtys, setPickQtys] = useState(() =>
    Object.fromEntries(items.map(i => [i.id, i.quantity ?? '']))
  );
  const [scheduleForm, setScheduleForm] = useState({
    dispatch_date: '',
    appointment_date: '',
    expiry_date: order?.po_expiry_date || '',
    transporter: '',
    packaging_type: '',
  });

  const { data: warehouseLots = [] } = useQuery({
    queryKey: ['warehouse_lots_active'],
    queryFn: () => base44.entities.WarehouseLot.filter({ status: 'ACTIVE' }, '-created_date', 300),
  });

  const { data: picklists = [], refetch: refetchPicklists } = useQuery({
    queryKey: ['picklists', order.id],
    queryFn: () => base44.entities.SalesPicklist.filter({ sales_order_id: order.id }, '-created_date'),
  });

  const { data: settingsList = [] } = useQuery({
    queryKey: ['sales_settings'],
    queryFn: () => base44.entities.SalesSettings.list(),
  });

  const transporters = settingsList.find(s => s.setting_key === 'transporters')?.values || [];
  const packingTypes = settingsList.find(s => s.setting_key === 'packing_types')?.values || [];

  const activePicklist = picklists[0] ?? null;
  const plStatus = activePicklist?.status || null;

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

  const STATUS_STYLE = { ok: 'text-green-600', short: 'text-amber-600', none: 'text-red-600', unknown: 'text-slate-400' };
  const STATUS_LABEL = { ok: 'Available', short: 'Short', none: 'Out of Stock', unknown: 'Not on Record' };

  // Step 1: Create picklist in Draft (stock check + generate)
  async function handleCreatePicklist() {
    setSaving(true);
    for (const item of items) {
      const stock = getWarehouseStock(item);
      const status = getStatus(item);
      const stockStatus = status === 'ok' ? 'full' : status === 'short' ? 'partial' : 'unavailable';
      await base44.entities.SalesOrderItem.update(item.id, { available_stock: stock ?? 0, stock_status: stockStatus });
    }
    const statuses = items.map(i => getStatus(i));
    const overall = statuses.every(s => s === 'ok') ? 'full' : statuses.every(s => s === 'none') ? 'unavailable' : 'partial';
    await base44.entities.SalesOrder.update(order.id, {
      stock_validation_status: overall,
      stock_validated_by: user?.email,
      stock_validated_at: new Date().toISOString(),
    });

    const plNumber = `PL-${Date.now().toString().slice(-7)}`;
    const picklistItems = items.map(i => ({
      sales_order_item_id: i.id, item_code: i.item_code, description: i.description,
      location: i.location || 'Finished Goods', required_qty: parseFloat(pickQtys[i.id]) || i.quantity,
      picked_qty: 0, status: 'pending',
    }));

    const pl = await base44.entities.SalesPicklist.create({
      sales_order_id: order.id, so_number: order.so_number, picklist_number: plNumber,
      status: 'draft', generated_by: user?.email, items: picklistItems,
    });

    await base44.entities.SalesOrder.update(order.id, { status: 'picking' });
    const instances = await findFMSInstanceByRef(order.id);
    if (instances[0]) await linkFMSRef(instances[0].id, pl.id);
    await fireFMSEvent('sales_picklist_created', order.id);
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesPicklist', entity_id: pl.id, reference_number: plNumber,
      action: 'stock_checked_and_picklist_created', new_value: `Overall stock: ${overall}`, user_email: user?.email,
    });

    setSaving(false);
    toast({ title: 'Picklist created', description: plNumber });
    refetchPicklists(); onUpdated();
  }

  // Step 2: Confirm dispatch date → move to dispatch_scheduled
  async function handleConfirmDispatchDate() {
    if (!scheduleForm.dispatch_date) {
      toast({ title: 'Dispatch date is required', variant: 'destructive' }); return;
    }
    setSaving(true);
    await base44.entities.SalesPicklist.update(activePicklist.id, {
      status: 'dispatch_scheduled',
      dispatch_date: scheduleForm.dispatch_date,
      appointment_date: scheduleForm.appointment_date,
      expiry_date: scheduleForm.expiry_date,
      transporter: scheduleForm.transporter,
      packaging_type: scheduleForm.packaging_type,
    });
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesPicklist', entity_id: activePicklist.id, reference_number: activePicklist.picklist_number,
      action: 'dispatch_date_confirmed', new_value: scheduleForm.dispatch_date, user_email: user?.email,
    });
    await fireFMSEvent('sales_dispatch_scheduled', activePicklist.id);
    setSaving(false);
    toast({ title: 'Dispatch date confirmed' });
    refetchPicklists(); onUpdated();
  }

  // Step 3: Pick & Packing Done → move to pick_packed
  async function handlePickPackDone() {
    setSaving(true);
    const updatedItems = activePicklist.items.map(item => {
      const picked = parseFloat(pickQtys[item.sales_order_item_id] ?? item.picked_qty ?? item.required_qty);
      return { ...item, picked_qty: picked, status: picked >= item.required_qty ? 'picked' : picked > 0 ? 'short' : 'pending' };
    });

    await base44.entities.SalesPicklist.update(activePicklist.id, {
      items: updatedItems, status: 'pick_packed', completed_by: user?.email, completed_at: new Date().toISOString(),
    });
    await base44.entities.SalesOrder.update(order.id, { status: 'packing' });
    await fireFMSEvent('sales_picklist_completed', activePicklist.id);
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesPicklist', entity_id: activePicklist.id, reference_number: activePicklist.picklist_number,
      action: 'pick_and_pack_done', user_email: user?.email,
    });
    setSaving(false);
    toast({ title: 'Pick & Pack marked complete' });
    refetchPicklists(); onUpdated();
  }

  // Step 4: Delivered
  async function handleDelivered() {
    setSaving(true);
    await base44.entities.SalesPicklist.update(activePicklist.id, { status: 'delivered' });
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesPicklist', entity_id: activePicklist.id, reference_number: activePicklist.picklist_number,
      action: 'picklist_delivered', user_email: user?.email,
    });
    setSaving(false);
    toast({ title: 'Picklist marked as Delivered' });
    refetchPicklists(); onUpdated();
  }

  if (!items.length) return <div className="text-sm text-slate-400 py-4">No items on this order.</div>;

  const currentStepIndex = PL_WORKFLOW_STEPS.findIndex(s => s.key === plStatus);
  const nextTransition = PL_TRANSITIONS.find(t => t.from === plStatus);

  return (
    <div className="space-y-4">
      {/* Workflow progress bar (only when picklist exists) */}
      {activePicklist && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto">
          <div className="flex items-center min-w-max gap-0">
            {PL_WORKFLOW_STEPS.map((step, i) => {
              const done = currentStepIndex > i;
              const active = currentStepIndex === i;
              return (
                <div key={step.key} className="flex items-center">
                  <div className="flex flex-col items-center gap-1 px-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      done ? 'bg-green-100 text-green-600' : active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {done ? <CheckCircle2 className="w-4 h-4" /> : <step.icon className="w-4 h-4" />}
                    </div>
                    <span className={`text-xs font-medium text-center max-w-[80px] ${active ? 'text-slate-900' : done ? 'text-green-700' : 'text-slate-400'}`}>
                      {step.label}
                    </span>
                  </div>
                  {i < PL_WORKFLOW_STEPS.length - 1 && (
                    <div className={`w-8 h-0.5 mb-5 ${done ? 'bg-green-400' : 'bg-slate-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Picklist badge */}
      {activePicklist && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm">
          <Package className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span className="text-blue-800 font-medium">{activePicklist.picklist_number}</span>
          <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${
            plStatus === 'delivered' || plStatus === 'pick_packed' ? 'bg-green-100 text-green-700' :
            plStatus === 'dispatch_scheduled' ? 'bg-indigo-100 text-indigo-700' :
            'bg-slate-100 text-slate-600'
          }`}>{PL_WORKFLOW_STEPS.find(s => s.key === plStatus)?.label || plStatus}</span>
        </div>
      )}

      {/* Dispatch scheduling form (show when picklist is in Draft) */}
      {plStatus === 'draft' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-amber-900">Confirm Dispatch Date</h4>
          <p className="text-xs text-amber-700">Set the dispatch date and logistics details to move to "Dispatch Scheduled" state.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
            <div>
              <Label className="text-xs font-medium text-slate-700">Transporter</Label>
              <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={scheduleForm.transporter} onChange={e => setScheduleForm(f => ({ ...f, transporter: e.target.value }))}>
                <option value="">Select transporter...</option>
                {transporters.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-700">Packaging Type</Label>
              <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={scheduleForm.packaging_type} onChange={e => setScheduleForm(f => ({ ...f, packaging_type: e.target.value }))}>
                <option value="">Select packaging...</option>
                {packingTypes.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <Button className="h-11 bg-slate-900 text-white text-sm" onClick={handleConfirmDispatchDate} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Calendar className="w-4 h-4 mr-1" />}
            Dispatch Date Confirmed
          </Button>
        </div>
      )}

      {/* Picklist info when dispatch is scheduled */}
      {plStatus === 'dispatch_scheduled' && activePicklist && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          {[
            ['Dispatch Date', activePicklist.dispatch_date || '—'],
            ['Appointment Date', activePicklist.appointment_date || '—'],
            ['Transporter', activePicklist.transporter || '—'],
            ['Packaging', activePicklist.packaging_type || '—'],
          ].map(([k, v]) => (
            <div key={k} className="bg-white border border-slate-200 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">{k}</p>
              <p className="font-medium text-slate-900">{v}</p>
            </div>
          ))}
        </div>
      )}

      {/* Header with action button */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Stock Check & Pick List</h3>
          <p className="text-xs text-slate-500 mt-0.5">Stock pulled live from inventory. Set pick quantities and confirm.</p>
        </div>
        {!activePicklist && (
          <Button className="h-11 bg-slate-900 text-white text-sm" onClick={handleCreatePicklist} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
            Confirm & Generate Picklist
          </Button>
        )}
        {plStatus === 'dispatch_scheduled' && (
          <Button className="h-11 bg-green-600 hover:bg-green-700 text-white text-sm" onClick={handlePickPackDone} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Package className="w-4 h-4 mr-1" />}
            Pick & Packing Done
          </Button>
        )}
        {plStatus === 'pick_packed' && (
          <Button className="h-11 bg-indigo-600 hover:bg-indigo-700 text-white text-sm" onClick={handleDelivered} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Truck className="w-4 h-4 mr-1" />}
            Mark Delivered
          </Button>
        )}
      </div>

      {/* Main stock table */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-700">
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-right">Order Quantity</th>
              <th className="px-3 py-2 text-right">Current Stock</th>
              <th className="px-3 py-2 text-right">{activePicklist ? 'Pick Quantity' : 'Pick Quantity to Send'}</th>
              <th className="px-3 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map(item => {
              const stock = getWarehouseStock(item);
              const status = getStatus(item);
              const plItem = activePicklist?.items?.find(pi => pi.sales_order_item_id === item.id);
              const isEditable = !activePicklist || plStatus === 'dispatch_scheduled';
              return (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-800">{item.description}</td>
                  <td className="px-3 py-2 text-right font-medium text-slate-700">{item.quantity}</td>
                  <td className="px-3 py-2 text-right">
                    {stock !== null ? (
                      <span className={`font-semibold ${stock >= item.quantity ? 'text-green-700' : stock > 0 ? 'text-amber-700' : 'text-red-600'}`}>
                        {stock}
                      </span>
                    ) : <span className="text-slate-400 text-xs">Not found</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEditable ? (
                      <Input type="number" min="0" max={item.quantity}
                        className="h-8 w-20 text-sm text-right ml-auto"
                        value={activePicklist ? (pickQtys[item.sales_order_item_id] ?? plItem?.required_qty ?? '') : pickQtys[item.id]}
                        onChange={e => setPickQtys(p => ({ ...p, [activePicklist ? item.sales_order_item_id : item.id]: e.target.value }))} />
                    ) : (
                      <span className="font-semibold text-slate-800">{plItem?.picked_qty ?? plItem?.required_qty ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs font-semibold ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>
                    {status === 'short' && stock !== null && <div className="text-xs text-red-400">Short by {item.quantity - stock}</div>}
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