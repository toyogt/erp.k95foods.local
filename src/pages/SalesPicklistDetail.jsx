/**
 * Pick List Detail Page — ERPNext-style layout with header meta, items table,
 * picking workflow, print preview, and status transitions.
 */
import { useState, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { fireFMSEvent } from '@/lib/useFMSAutoComplete';
import PicklistPrintTemplate from '@/components/sales/PicklistPrintTemplate';
import PicklistHeaderMeta from '@/components/sales/PicklistHeaderMeta';
import PicklistItemsTable from '@/components/sales/PicklistItemsTable';
import PicklistWorkflowBar from '@/components/sales/PicklistWorkflowBar';
import DeleteWithRemarks from '@/components/sales/DeleteWithRemarks';
import {
  ArrowLeft, Printer, Trash2, Loader2, XCircle,
  Calendar, Package, Play, CheckCircle2, Download
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

export default function SalesPicklistDetail() {
  const params = new URLSearchParams(window.location.search);
  const plId = params.get('id');
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [dispatchDate, setDispatchDate] = useState('');
  const [pickQtys, setPickQtys] = useState({});
  const printRef = useRef();

  const { data: pl, isLoading, refetch } = useQuery({
    queryKey: ['pl_detail', plId],
    queryFn: async () => {
      const results = await base44.entities.SalesPicklist.filter({ id: plId });
      return results[0] || null;
    },
    enabled: !!plId,
  });

  // Init dispatch date from picklist
  useState(() => {
    if (pl?.dispatch_date) setDispatchDate(pl.dispatch_date);
  });

  function handlePrint() {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(`
      <html><head><title>${pl?.picklist_number || 'Picklist'} — K95 Foods</title>
      <style>
        body{margin:0;padding:0;font-family:Arial,sans-serif;}
        @media print{body{margin:0;}@page{size:A4;margin:15mm;}}
      </style>
      </head><body>${content.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  async function handleStartPicking() {
    setSaving(true);
    await base44.entities.SalesPicklist.update(plId, { status: 'picking' });
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesPicklist', entity_id: plId,
      reference_number: pl.picklist_number, action: 'picking_started', user_email: user?.email,
    });
    setSaving(false);
    toast({ title: 'Picking Started' });
    refetch();
  }

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

  async function handlePickComplete() {
    setSaving(true);
    const updatedItems = (pl.items || []).map(item => {
      const picked = parseFloat(pickQtys[item.sales_order_item_id] ?? item.required_qty ?? 0);
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
      reference_number: pl.picklist_number, action: 'pick_and_pack_done', user_email: user?.email,
    });
    setSaving(false);
    toast({ title: 'Pick & Pack Complete' });
    refetch();
  }

  async function handleCancel() {
    if (!cancelReason.trim()) { toast({ title: 'Reason required', variant: 'destructive' }); return; }
    setSaving(true);
    await base44.entities.SalesPicklist.update(plId, { status: 'cancelled', cancellation_reason: cancelReason, notes: cancelReason });
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesPicklist', entity_id: plId,
      reference_number: pl.picklist_number, action: 'cancelled', notes: cancelReason, user_email: user?.email,
    });
    setSaving(false);
    setShowCancel(false);
    toast({ title: 'Picklist Cancelled' });
    refetch();
  }

  if (isLoading) return <div className="p-8 text-center text-slate-400">Loading...</div>;
  if (!pl) return <div className="p-8 text-center text-slate-400">Pick List not found</div>;

  return (
    <div className="p-3 md:p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link to="/SalesPicklists" className="mt-1 text-slate-500 hover:text-slate-900">
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
            {pl.customer_name && <> · {pl.customer_name}</>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-9 text-sm gap-1" onClick={() => setShowPrint(p => !p)}>
            <Printer className="w-4 h-4" /> {showPrint ? 'Hide' : 'Print'}
          </Button>
          {showPrint && (
            <Button variant="outline" className="h-9 text-sm gap-1 text-blue-700 border-blue-300" onClick={handlePrint}>
              <Download className="w-4 h-4" /> Send to Printer
            </Button>
          )}
        </div>
      </div>

      {/* Print Preview */}
      {showPrint && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-100">
            <span className="text-xs font-medium text-slate-600">Print Preview (A4)</span>
          </div>
          <div ref={printRef} className="p-2 overflow-auto bg-white">
            <PicklistPrintTemplate picklist={pl} soNumber={pl.so_number} customerName={pl.customer_name} />
          </div>
        </div>
      )}

      {/* Workflow Progress Bar */}
      {pl.status !== 'cancelled' && <PicklistWorkflowBar status={pl.status} />}

      {/* Header Meta — ERPNext style */}
      <PicklistHeaderMeta picklist={pl} />

      {/* Action Panels based on status */}
      {pl.status === 'draft' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
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

      {(pl.status === 'picking' || pl.status === 'dispatch_scheduled') && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-blue-900">
            {pl.status === 'picking' ? 'Picking in Progress — Update quantities below' : 'Dispatch Scheduled — Complete picking'}
          </h4>
        </div>
      )}

      {/* Items Table */}
      <PicklistItemsTable
        items={pl.items || []}
        status={pl.status}
        pickQtys={pickQtys}
        onPickQtyChange={setPickQtys}
      />

      {/* Pick & Pack Done button */}
      {(pl.status === 'picking' || pl.status === 'dispatch_scheduled') && (
        <div className="flex justify-end">
          <Button className="h-11 bg-green-600 hover:bg-green-700 text-white text-sm gap-1.5" onClick={handlePickComplete} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
            Pick & Packing Done
          </Button>
        </div>
      )}

      {/* Completed / Pick & Packed summary */}
      {(pl.status === 'pick_packed' || pl.status === 'completed') && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <span className="text-green-800 font-medium">Pick & Pack completed</span>
          {pl.completed_by && <span className="text-green-600 text-xs ml-2">by {pl.completed_by}</span>}
        </div>
      )}

      {/* Cancel section */}
      {['draft', 'picking', 'picked', 'dispatch_scheduled', 'pick_packed'].includes(pl.status) && !showCancel && (
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
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Confirm Cancel
            </Button>
          </div>
        </div>
      )}
      {pl.status === 'cancelled' && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm">
          <XCircle className="w-4 h-4 text-red-500" />
          <span className="text-red-800 font-medium">Picklist Cancelled</span>
          {(pl.cancellation_reason || pl.notes) && <span className="text-red-600 text-xs ml-2">Reason: {pl.cancellation_reason || pl.notes}</span>}
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
      <DeleteWithRemarks open={showDelete} onClose={() => setShowDelete(false)}
        entityName="SalesPicklist" recordId={plId} referenceNumber={pl.picklist_number}
        onDeleted={() => window.location.href = '/SalesPicklists'} />
    </div>
  );
}