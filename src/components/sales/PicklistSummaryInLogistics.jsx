/**
 * Picklist Summary shown inside Logistics Review panel on Order detail.
 * Shows existing picklist info, items summary, and Save & Move to Next Stage button.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';
import { fireFMSEvent } from '@/lib/useFMSAutoComplete';
import {
  ClipboardList, ExternalLink, Loader2, ArrowRight, CheckCircle2, Package
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

export default function PicklistSummaryInLogistics({ order, onUpdated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: picklists = [] } = useQuery({
    queryKey: ['picklists_detail', order?.id],
    queryFn: () => base44.entities.SalesPicklist.filter({ sales_order_id: order.id }),
    enabled: !!order?.id,
    staleTime: 60000,
  });

  const activePicklist = picklists.filter(p => p.status !== 'cancelled')[0] || null;

  if (!activePicklist) return null;

  const items = activePicklist.items || [];
  const totalRequired = items.reduce((s, i) => s + (i.required_qty || 0), 0);
  const totalPicked = items.reduce((s, i) => s + (i.picked_qty || 0), 0);

  // Determine next action based on current picklist + order state
  const getNextAction = () => {
    if (activePicklist.status === 'pick_packed' && order.status !== 'packing') {
      return { label: 'Move Order to Packing', nextStatus: 'packing' };
    }
    if (activePicklist.status === 'pick_packed' && order.status === 'packing') {
      return { label: 'Proceed to Invoice', nextStatus: 'invoiced', panel: 'invoice' };
    }
    if (activePicklist.status === 'dispatch_scheduled' && order.status === 'picking') {
      return null; // Picking in progress, handled by picklist detail
    }
    return null;
  };

  const nextAction = getNextAction();

  async function handleMoveToNextStage() {
    if (!nextAction) return;
    setSaving(true);

    if (nextAction.nextStatus === 'packing') {
      await base44.entities.SalesOrder.update(order.id, { status: 'packing' });
      await base44.entities.SalesAuditLog.create({
        entity_type: 'SalesOrder', entity_id: order.id,
        reference_number: order.so_number, action: 'status_change',
        field_name: 'status', old_value: order.status, new_value: 'packing',
        user_email: user?.email,
      });
      toast({ title: 'Order moved to Packing stage' });
    }

    setSaving(false);
    qc.invalidateQueries({ queryKey: ['sales_order', order.id] });
    qc.invalidateQueries({ queryKey: ['picklists_detail', order.id] });
    onUpdated?.();
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-slate-600" />
          <h4 className="text-sm font-semibold text-slate-900">Pick List</h4>
        </div>
        <Link
          to={`/SalesPicklistDetail?id=${activePicklist.id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
        >
          <ExternalLink className="w-3 h-3" />
          Open {activePicklist.picklist_number}
        </Link>
      </div>

      <div className="p-4 space-y-3">
        {/* Picklist meta */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-xs text-slate-500">Picklist Number</span>
            <p className="font-semibold text-slate-900">{activePicklist.picklist_number}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Status</span>
            <p>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[activePicklist.status] || 'bg-slate-100 text-slate-600'}`}>
                {activePicklist.status?.replace(/_/g, ' ')}
              </span>
            </p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Dispatch Date</span>
            <p className="font-medium text-slate-900">{activePicklist.dispatch_date || '—'}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Transporter</span>
            <p className="font-medium text-slate-900">{activePicklist.transporter || '—'}</p>
          </div>
        </div>

        {/* Items summary */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-xs text-slate-700">
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-right">Required</th>
                <th className="px-3 py-2 text-right">Picked</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-800">{item.item_name || item.description || item.item_code || '—'}</td>
                  <td className="px-3 py-2 text-right font-medium">{item.required_qty || 0}</td>
                  <td className="px-3 py-2 text-right font-medium">{item.picked_qty ?? '—'}</td>
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
              ))}
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

        {/* Completed badge */}
        {activePicklist.status === 'pick_packed' && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-green-800 font-medium">Pick & Pack completed</span>
            {activePicklist.completed_by && <span className="text-green-600 text-xs ml-2">by {activePicklist.completed_by}</span>}
          </div>
        )}

        {/* Move to next stage */}
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
      </div>
    </div>
  );
}