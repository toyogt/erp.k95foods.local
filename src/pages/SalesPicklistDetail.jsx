/**
 * Pick List Detail Page — dedicated page for a single Pick List.
 * Shows full PL workflow: Draft → Dispatch Scheduled → Pick & Packed → Cancelled
 */
import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { ArrowLeft, Package, CheckCircle2, Calendar, Loader2, XCircle, Printer, Trash2 } from 'lucide-react';
import PicklistLogisticsSection from '@/components/sales/PicklistLogisticsSection';
import DeleteWithRemarks from '@/components/sales/DeleteWithRemarks';
import PicklistPrintTemplate from '@/components/sales/PicklistPrintTemplate';
import WarehousePackingPanel from '@/components/sales/WarehousePackingPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { fireFMSEvent } from '@/lib/useFMSAutoComplete';

const PL_STEPS = [
  { key: 'draft', label: 'Draft' },
  { key: 'dispatch_scheduled', label: 'Dispatch Scheduled' },
  { key: 'pick_packed', label: 'Pick & Packed' },
];

const STATUS_COLOR = {
  draft: 'bg-slate-100 text-slate-600',
  dispatch_scheduled: 'bg-blue-100 text-blue-800',
  pick_packed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function SalesPicklistDetail() {
  const params = new URLSearchParams(window.location.search);
  const plId = params.get('id');
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [dispatchDate, setDispatchDate] = useState('');
  const [pickQtys, setPickQtys] = useState({});
  const [showPrint, setShowPrint] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const printRef = useRef();

  function handlePrint() {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(`
      <html><head><title>${pl?.picklist_number || 'Picklist'} — K95 Foods</title>
      <style>body{margin:0;padding:0;} @media print { body { margin: 0; } }</style>
      </head><body>${content.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }

  const { data: pl, isLoading, refetch } = useQuery({
    queryKey: ['pl_detail', plId],
    queryFn: () => base44.entities.SalesPicklist.filter({ id: plId }).then(r => r[0]),
    enabled: !!plId,
    onSuccess: (data) => {
      if (data?.dispatch_date) setDispatchDate(data.dispatch_date);
    },
  });

  if (isLoading) return <div className="p-8 text-center text-slate-400">Loading...</div>;
  if (!pl) return <div className="p-8 text-center text-slate-400">Pick List not found</div>;

  const stepIdx = PL_STEPS.findIndex(s => s.key === pl.status);

  async function handleConfirmDispatch() {
    if (!dispatchDate) { toast({ title: 'Dispatch date is required', variant: 'destructive' }); return; }
    setSaving(true);
    await base44.entities.SalesPicklist.update(plId, { status: 'dispatch_scheduled', dispatch_date: dispatchDate });
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesPicklist', entity_id: plId,
      reference_number: pl.picklist_number, action: 'dispatch_date_confirmed',
      new_value: dispatchDate, user_email: user?.email,
    });
    await fireFMSEvent('sales_dispatch_scheduled', plId);
    setSaving(false);
    toast({ title: 'Dispatch date confirmed' });
    refetch();
  }

  async function handlePickPackDone() {
    setSaving(true);
    const updatedItems = (pl.items || []).map(item => {
      const picked = parseFloat(pickQtys[item.sales_order_item_id] ?? item.required_qty ?? 0);
      return { ...item, picked_qty: picked, status: picked >= item.required_qty ? 'picked' : picked > 0 ? 'short' : 'pending' };
    });
    await base44.entities.SalesPicklist.update(plId, {
      items: updatedItems, status: 'pick_packed',
      completed_by: user?.email, completed_at: new Date().toISOString(),
    });
    await fireFMSEvent('sales_picklist_completed', plId);
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesPicklist', entity_id: plId,
      reference_number: pl.picklist_number, action: 'pick_and_pack_done', user_email: user?.email,
    });
    setSaving(false);
    toast({ title: 'Pick & Pack complete' });
    refetch();
  }

  async function handleCancel() {
    if (!cancelReason.trim()) { toast({ title: 'Reason required', variant: 'destructive' }); return; }
    setSaving(true);
    await base44.entities.SalesPicklist.update(plId, { status: 'cancelled', notes: cancelReason });
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesPicklist', entity_id: plId,
      reference_number: pl.picklist_number, action: 'cancelled',
      notes: cancelReason, user_email: user?.email,
    });
    setSaving(false); setShowCancel(false);
    toast({ title: 'Picklist cancelled' });
    refetch();
  }

  return (
    <div className="p-3 md:p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link to={`/SalesOrderDetail?id=${pl.sales_order_id}`} className="mt-1 text-slate-500 hover:text-slate-900">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{pl.picklist_number}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[pl.status] || 'bg-slate-100 text-slate-600'}`}>
              {pl.status?.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Sales Order: <Link to={`/SalesOrderDetail?id=${pl.sales_order_id}`} className="text-blue-600 hover:underline">{pl.so_number}</Link>
          </p>
        </div>
        <Button variant="outline" className="h-9 text-sm gap-1" onClick={() => setShowPrint(p => !p)}>
          <Printer className="w-4 h-4" /> {showPrint ? 'Hide Print' : 'Print'}
        </Button>
        {showPrint && (
          <Button variant="outline" className="h-9 text-sm gap-1 text-blue-700 border-blue-300" onClick={handlePrint}>
            <Printer className="w-4 h-4" /> Send to Printer
          </Button>
        )}
      </div>

      {/* Print Preview */}
      {showPrint && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Print Preview</span>
          </div>
          <div ref={printRef} className="p-2 overflow-auto">
            <PicklistPrintTemplate picklist={pl} soNumber={pl.so_number} customerName={''} />
          </div>
        </div>
      )}

      {/* Workflow progress */}
      {pl.status !== 'cancelled' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto">
          <div className="flex items-center min-w-max">
            {PL_STEPS.map((step, i) => {
              const done = stepIdx > i; const active = stepIdx === i;
              return (
                <div key={step.key} className="flex items-center">
                  <div className="flex flex-col items-center gap-1 px-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${done ? 'bg-green-100 text-green-600' : active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      {done ? <CheckCircle2 className="w-4 h-4" /> : (i + 1)}
                    </div>
                    <span className={`text-xs font-medium ${active ? 'text-slate-900' : done ? 'text-green-700' : 'text-slate-400'}`}>{step.label}</span>
                  </div>
                  {i < PL_STEPS.length - 1 && <div className={`w-8 h-0.5 mb-5 ${done ? 'bg-green-400' : 'bg-slate-200'}`} />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Meta info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Dispatch Date', pl.dispatch_date],
          ['Appointment Date', pl.appointment_date],
          ['Generated By', pl.generated_by],
          ['Completed By', pl.completed_by],
        ].filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="bg-white border border-slate-200 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">{k}</p>
            <p className="text-sm font-medium text-slate-900">{v}</p>
          </div>
        ))}
      </div>

      {/* Logistics Details — highlighted for filling */}
      <PicklistLogisticsSection picklist={pl} onUpdated={refetch} />

      {/* Action panel */}
      {pl.status === 'draft' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-amber-900">Confirm Dispatch Date</h4>
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-xs">
              <Label className="text-xs font-medium text-slate-700">Dispatch Date *</Label>
              <Input type="date" className="h-9 text-sm mt-1" value={dispatchDate} onChange={e => setDispatchDate(e.target.value)} />
            </div>
            <Button className="h-11 bg-slate-900 text-white text-sm" onClick={handleConfirmDispatch} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Calendar className="w-4 h-4 mr-1" />}
              Dispatch Date Confirmed
            </Button>
          </div>
        </div>
      )}

      {/* Items table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Picklist Items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-left">Location</th>
                <th className="px-3 py-2 text-right">Required Quantity</th>
                <th className="px-3 py-2 text-right">{pl.status === 'dispatch_scheduled' ? 'Picked Quantity' : 'Picked'}</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(pl.items || []).map(item => (
                <tr key={item.sales_order_item_id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-800">{item.description}</td>
                  <td className="px-3 py-2 text-slate-500">{item.location || '—'}</td>
                  <td className="px-3 py-2 text-right font-medium">{item.required_qty}</td>
                  <td className="px-3 py-2 text-right">
                    {pl.status === 'dispatch_scheduled' ? (
                      <Input type="number" min="0" className="h-8 w-20 text-sm text-right ml-auto"
                        defaultValue={item.required_qty}
                        onChange={e => setPickQtys(p => ({ ...p, [item.sales_order_item_id]: e.target.value }))} />
                    ) : (
                      <span>{item.picked_qty ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      item.status === 'picked' ? 'bg-green-100 text-green-700' :
                      item.status === 'short' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>{item.status || 'pending'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Warehouse Packing Panel — replaces the simple button with a proper packing UI */}
      <WarehousePackingPanel picklist={pl} onUpdated={refetch} />

      {/* Cancel section */}
      {pl.status === 'pick_packed' && !showCancel && (
        <div className="flex justify-end">
          <Button variant="outline" className="h-11 text-sm text-red-600 border-red-200 hover:bg-red-50" onClick={() => setShowCancel(true)}>
            <XCircle className="w-4 h-4 mr-1" /> Cancel Picklist
          </Button>
        </div>
      )}
      {showCancel && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-red-800">Cancel Picklist</h4>
          <Input className="h-9 text-sm border-red-300" value={cancelReason}
            onChange={e => setCancelReason(e.target.value)} placeholder="Reason for cancellation..." />
          <div className="flex gap-2">
            <Button variant="outline" className="h-11 text-sm" onClick={() => setShowCancel(false)}>Back</Button>
            <Button className="h-11 bg-red-600 hover:bg-red-700 text-white text-sm" onClick={handleCancel} disabled={saving}>
              Confirm Cancel
            </Button>
          </div>
        </div>
      )}
      {pl.status === 'cancelled' && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm">
          <XCircle className="w-4 h-4 text-red-500" />
          <span className="text-red-800 font-medium">Picklist Cancelled</span>
          {pl.notes && <span className="text-red-600 text-xs ml-2">Reason: {pl.notes}</span>}
        </div>
      )}

      {user?.role === 'admin' && (
        <div className="flex justify-end">
          <Button variant="outline" className="h-11 text-sm text-red-600 border-red-200 hover:bg-red-50 gap-1.5"
            onClick={() => setShowDelete(true)}>
            <Trash2 className="w-4 h-4" /> Delete Picklist
          </Button>
        </div>
      )}

      <DeleteWithRemarks
        open={showDelete}
        onClose={() => setShowDelete(false)}
        entityName="SalesPicklist"
        recordId={plId}
        referenceNumber={pl.picklist_number}
        onDeleted={() => window.location.href = '/SalesPicklists'}
      />
    </div>
  );
}