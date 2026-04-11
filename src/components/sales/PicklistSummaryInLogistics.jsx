/**
 * Picklist Summary shown inside Logistics Review panel on Order detail.
 * Full picking workflow: start picking, enter pick quantities, confirm dispatch, complete pick & pack.
 * Also shows "Move to Next Stage" actions after pick is done.
 */
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';
import { fireFMSEvent } from '@/lib/useFMSAutoComplete';
import {
  ClipboardList, ExternalLink, Loader2, ArrowRight, CheckCircle2,
  Package, Play, Calendar, XCircle
} from 'lucide-react';

const STATUS_COLOR = {
  draft: 'bg-slate-100 text-slate-600',
  picking: 'bg-amber-100 text-amber-800',
  picked: 'bg-blue-100 text-blue-800',
  dispatch_scheduled: 'bg-indigo-100 text-indigo-800',
  pick_packed: 'bg-green-100 text-green-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

const WORKFLOW_STEPS = ['draft', 'picking', 'dispatch_scheduled', 'pick_packed', 'completed'];

function PicklistWorkflowMini({ status }) {
  const idx = WORKFLOW_STEPS.indexOf(status);
  return (
    <div className="flex items-center gap-1">
      {WORKFLOW_STEPS.map((step, i) => {
        const done = i <= idx;
        const active = i === idx;
        return (
          <div key={step} className="flex items-center gap-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
              done ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
            } ${active ? 'ring-2 ring-emerald-300' : ''}`}>
              {done ? '✓' : i + 1}
            </div>
            {i < WORKFLOW_STEPS.length - 1 && (
              <div className={`w-6 h-0.5 ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function PicklistSummaryInLogistics({ order, onUpdated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [pickQtys, setPickQtys] = useState({});
  const [dispatchDate, setDispatchDate] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const { data: picklists = [], refetch } = useQuery({
    queryKey: ['picklists_detail', order?.id],
    queryFn: () => base44.entities.SalesPicklist.filter({ sales_order_id: order.id }),
    enabled: !!order?.id,
    staleTime: 30000,
  });

  const activePicklist = picklists.filter(p => p.status !== 'cancelled')[0] || null;

  // Init dispatch date from picklist
  useEffect(() => {
    if (activePicklist?.dispatch_date) setDispatchDate(activePicklist.dispatch_date);
  }, [activePicklist?.id, activePicklist?.dispatch_date]);

  if (!activePicklist) return null;

  const plId = activePicklist.id;
  const items = activePicklist.items || [];
  const totalRequired = items.reduce((s, i) => s + (i.required_qty || 0), 0);
  const totalPicked = items.reduce((s, i) => s + (i.picked_qty || 0), 0);
  const status = activePicklist.status;

  const refreshAll = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ['sales_order', order.id] });
    onUpdated?.();
  };

  // ─── Picking Workflow Actions ───
  async function handleStartPicking() {
    setSaving(true);
    await base44.entities.SalesPicklist.update(plId, { status: 'picking' });
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesPicklist', entity_id: plId,
      reference_number: activePicklist.picklist_number,
      action: 'picking_started', user_email: user?.email,
    });
    setSaving(false);
    toast({ title: 'Picking Started' });
    refreshAll();
  }

  async function handleConfirmDispatch() {
    if (!dispatchDate) { toast({ title: 'Dispatch date is required', variant: 'destructive' }); return; }
    setSaving(true);
    await base44.entities.SalesPicklist.update(plId, { status: 'dispatch_scheduled', dispatch_date: dispatchDate });
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesPicklist', entity_id: plId,
      reference_number: activePicklist.picklist_number,
      action: 'dispatch_date_confirmed', new_value: dispatchDate, user_email: user?.email,
    });
    await fireFMSEvent('sales_dispatch_scheduled', plId);
    setSaving(false);
    toast({ title: 'Dispatch date confirmed' });
    refreshAll();
  }

  async function handlePickComplete() {
    setSaving(true);
    const updatedItems = items.map(item => {
      const picked = parseFloat(pickQtys[item.sales_order_item_id] ?? item.picked_qty ?? item.required_qty ?? 0);
      return {
        ...item,
        picked_qty: picked,
        status: picked >= item.required_qty ? 'picked' : picked > 0 ? 'short' : 'pending',
      };
    });
    await base44.entities.SalesPicklist.update(plId, {
      items: updatedItems, status: 'pick_packed',
      completed_by: user?.email, completed_at: new Date().toISOString(),
    });
    await fireFMSEvent('sales_picklist_completed', plId);
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesPicklist', entity_id: plId,
      reference_number: activePicklist.picklist_number,
      action: 'pick_and_pack_done', user_email: user?.email,
    });
    setSaving(false);
    toast({ title: 'Pick & Pack Complete' });
    refreshAll();
  }

  async function handleCancel() {
    if (!cancelReason.trim()) { toast({ title: 'Reason required', variant: 'destructive' }); return; }
    setSaving(true);
    await base44.entities.SalesPicklist.update(plId, { status: 'cancelled', cancellation_reason: cancelReason, notes: cancelReason });
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesPicklist', entity_id: plId,
      reference_number: activePicklist.picklist_number,
      action: 'cancelled', notes: cancelReason, user_email: user?.email,
    });
    setSaving(false);
    setShowCancel(false);
    toast({ title: 'Picklist Cancelled' });
    refreshAll();
  }

  // ─── Move Order to Next Stage ───
  const getNextAction = () => {
    if (status === 'pick_packed' && order.status !== 'packing') {
      return { label: 'Move Order to Packing', nextStatus: 'packing' };
    }
    if (status === 'pick_packed' && order.status === 'packing') {
      return { label: 'Proceed to Invoice', nextStatus: 'invoiced' };
    }
    return null;
  };

  const nextAction = getNextAction();

  async function handleMoveToNextStage() {
    if (!nextAction) return;
    setSaving(true);
    await base44.entities.SalesOrder.update(order.id, { status: nextAction.nextStatus });
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesOrder', entity_id: order.id,
      reference_number: order.so_number, action: 'status_change',
      field_name: 'status', old_value: order.status, new_value: nextAction.nextStatus,
      user_email: user?.email,
    });
    toast({ title: `Order moved to ${nextAction.nextStatus.replace(/_/g, ' ')} stage` });
    setSaving(false);
    refreshAll();
  }

  const canPick = status === 'picking' || status === 'dispatch_scheduled';

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-slate-600" />
          <h4 className="text-sm font-semibold text-slate-900">Pick List</h4>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[status] || 'bg-slate-100 text-slate-600'}`}>
            {status?.replace(/_/g, ' ')}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <PicklistWorkflowMini status={status} />
          <Link
            to={`/SalesPicklistDetail?id=${plId}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            <ExternalLink className="w-3 h-3" />
            {activePicklist.picklist_number}
          </Link>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Picklist meta row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-xs text-slate-500">Picklist Number</span>
            <p className="font-semibold text-slate-900">{activePicklist.picklist_number}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Transporter</span>
            <p className="font-medium text-slate-900">{activePicklist.transporter || '—'}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Dispatch Date</span>
            <p className="font-medium text-slate-900">{activePicklist.dispatch_date || '—'}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Appointment Date</span>
            <p className="font-medium text-slate-900">{activePicklist.appointment_date || '—'}</p>
          </div>
        </div>

        {/* ── Draft Actions: Start Picking / Confirm Dispatch ── */}
        {status === 'draft' && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-semibold text-amber-900">Next Step: Start Picking or Schedule Dispatch</h4>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[160px] max-w-xs">
                <Label className="text-xs font-medium text-slate-700">Dispatch Date</Label>
                <Input type="date" className="h-9 text-sm mt-1" value={dispatchDate} onChange={e => setDispatchDate(e.target.value)} />
              </div>
              <Button className="h-11 text-sm bg-slate-900 text-white gap-1.5" onClick={handleConfirmDispatch} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                Confirm Dispatch Date
              </Button>
              <Button className="h-11 text-sm bg-amber-600 hover:bg-amber-700 text-white gap-1.5" onClick={handleStartPicking} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Start Picking
              </Button>
            </div>
          </div>
        )}

        {/* ── Picking in Progress banner ── */}
        {canPick && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm font-semibold text-blue-900">
              {status === 'picking' ? 'Picking in Progress — Update quantities below' : 'Dispatch Scheduled — Complete picking'}
            </p>
          </div>
        )}

        {/* Items Table with pick qty entry */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-xs text-slate-700">
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-right w-20">Required</th>
                <th className="px-3 py-2 text-right w-24">{canPick ? 'Pick Qty' : 'Picked'}</th>
                <th className="px-3 py-2 text-center w-20">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => {
                const currentPicked = pickQtys[item.sales_order_item_id] ?? item.picked_qty ?? '';
                return (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-800">
                      <div className="font-medium">{item.item_name || item.description || item.item_code || '—'}</div>
                      {item.location && <div className="text-[10px] text-slate-400 mt-0.5">Location: {item.location}</div>}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{item.required_qty || 0}</td>
                    <td className="px-3 py-2 text-right">
                      {canPick ? (
                        <Input
                          type="number"
                          className="h-8 text-sm w-20 ml-auto text-right"
                          value={currentPicked}
                          placeholder={String(item.required_qty || 0)}
                          onChange={e => setPickQtys(prev => ({
                            ...prev,
                            [item.sales_order_item_id]: e.target.value,
                          }))}
                        />
                      ) : (
                        <span className="font-medium">{item.picked_qty ?? '—'}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {item.status === 'picked' ? (
                        <span className="text-xs text-green-600 font-medium">Picked</span>
                      ) : item.status === 'short' ? (
                        <span className="text-xs text-amber-600 font-medium">Short</span>
                      ) : (
                        <span className="text-xs text-slate-400">{item.status || 'pending'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200">
                <td className="px-3 py-2 text-sm font-semibold text-slate-900">Total</td>
                <td className="px-3 py-2 text-right font-bold text-slate-900">{totalRequired}</td>
                <td className="px-3 py-2 text-right font-bold text-slate-900">{totalPicked}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── Pick & Pack Done button ── */}
        {canPick && (
          <div className="flex justify-end">
            <Button className="h-11 bg-green-600 hover:bg-green-700 text-white text-sm gap-1.5" onClick={handlePickComplete} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
              Pick & Packing Done
            </Button>
          </div>
        )}

        {/* ── Completed badge ── */}
        {(status === 'pick_packed' || status === 'completed') && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-green-800 font-medium">Pick & Pack completed</span>
            {activePicklist.completed_by && <span className="text-green-600 text-xs ml-2">by {activePicklist.completed_by}</span>}
          </div>
        )}

        {/* ── Move to Next Stage ── */}
        {nextAction && (
          <div className="flex justify-end pt-1">
            <Button
              className="h-11 text-sm bg-slate-900 hover:bg-slate-800 text-white gap-1.5"
              onClick={handleMoveToNextStage}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {nextAction.label}
            </Button>
          </div>
        )}

        {/* ── Cancel Picklist ── */}
        {['draft', 'picking', 'picked', 'dispatch_scheduled', 'pick_packed'].includes(status) && !showCancel && (
          <div className="flex justify-end">
            <Button variant="outline" className="h-9 text-sm text-red-600 border-red-200 hover:bg-red-50 gap-1" onClick={() => setShowCancel(true)}>
              <XCircle className="w-3.5 h-3.5" /> Cancel Picklist
            </Button>
          </div>
        )}
        {showCancel && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-semibold text-red-800">Cancel Picklist</h4>
            <Input className="h-9 text-sm border-red-300" value={cancelReason}
              onChange={e => setCancelReason(e.target.value)} placeholder="Reason for cancellation..." />
            <div className="flex gap-2">
              <Button variant="outline" className="h-11 text-sm" onClick={() => setShowCancel(false)}>Back</Button>
              <Button className="h-11 bg-red-600 hover:bg-red-700 text-white text-sm" onClick={handleCancel} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Confirm Cancel
              </Button>
            </div>
          </div>
        )}
        {status === 'cancelled' && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-red-800 font-medium">Picklist Cancelled</span>
            {activePicklist.cancellation_reason && <span className="text-red-600 text-xs ml-2">Reason: {activePicklist.cancellation_reason}</span>}
          </div>
        )}
      </div>
    </div>
  );
}