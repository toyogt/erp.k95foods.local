/**
 * SI Minimal Workflow — exact match to JSON:
 *
 * Forward:
 *   draft → [Submit] → waiting_for_e_invoice → [Bills Generated] → waiting_for_dispatch
 *   → [Dispatched] → waiting_for_bilty → [Bilty Received] → wait_to_deliver
 *   → [POD Received] → delivered
 *
 * Return path (from delivered):
 *   delivered → [Submit Return] → return_pending_approval → [Approve Return]
 *   → return_approved → [Complete Return] → return_completed
 *
 * Cancel: from waiting_for_e_invoice, waiting_for_dispatch, waiting_for_bilty,
 *         wait_to_deliver, delivered, return_approved, return_completed
 *
 * Tally: manual metadata — stored on invoice but not a workflow state
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  FileText, Truck, Upload, AlertTriangle, CheckCircle2,
  Loader2, ArrowRight, RotateCcw, Zap, XCircle, History
} from 'lucide-react';
import TallyPushLogViewer from '@/components/sales/TallyPushLogViewer';
import { fireFMSEvent } from '@/lib/useFMSAutoComplete';

const SI_STEPS = [
  { key: 'draft',                  label: 'Draft' },
  { key: 'waiting_for_e_invoice',  label: 'E-Invoice & E-Way Bill' },
  { key: 'waiting_for_dispatch',   label: 'Waiting for Dispatch' },
  { key: 'waiting_for_bilty',      label: 'Waiting for Bilty' },
  { key: 'wait_to_deliver',        label: 'Wait to Deliver' },
  { key: 'delivered',              label: 'Delivered' },
];

const SI_RETURN_STEPS = [
  { key: 'return_pending_approval', label: 'Return Pending Approval' },
  { key: 'return_approved',         label: 'Return Approved' },
  { key: 'return_completed',        label: 'Return Completed' },
];

const SI_TRANSITIONS = [
  { from: 'draft',                   action: 'Submit',          next: 'waiting_for_e_invoice' },
  { from: 'waiting_for_e_invoice',   action: 'Bills Generated', next: 'waiting_for_dispatch' },
  { from: 'waiting_for_dispatch',    action: 'Dispatched',      next: 'waiting_for_bilty' },
  { from: 'waiting_for_bilty',       action: 'Bilty Received',  next: 'wait_to_deliver' },
  { from: 'wait_to_deliver',         action: 'POD Received',    next: 'delivered' },
  // Return path
  { from: 'delivered',               action: 'Submit Return',   next: 'return_pending_approval', isReturn: true },
  { from: 'return_pending_approval', action: 'Approve Return',  next: 'return_approved', isReturn: true },
  { from: 'return_approved',         action: 'Complete Return', next: 'return_completed', isReturn: true },
];

const CANCELLABLE = new Set([
  'waiting_for_e_invoice', 'waiting_for_dispatch', 'waiting_for_bilty',
  'wait_to_deliver', 'delivered', 'return_approved', 'return_completed'
]);

const STATE_COLORS = {
  draft:                   'bg-slate-100 text-slate-600',
  waiting_for_e_invoice:   'bg-amber-100 text-amber-800',
  waiting_for_dispatch:    'bg-blue-100 text-blue-800',
  waiting_for_bilty:       'bg-indigo-100 text-indigo-800',
  wait_to_deliver:         'bg-violet-100 text-violet-800',
  delivered:               'bg-green-100 text-green-700',
  return_pending_approval: 'bg-orange-100 text-orange-800',
  return_approved:         'bg-orange-100 text-orange-800',
  return_completed:        'bg-purple-100 text-purple-800',
  cancelled:               'bg-red-100 text-red-700',
};

const ALL_STEPS = [...SI_STEPS, ...SI_RETURN_STEPS];
function stepLabel(key) {
  return ALL_STEPS.find(s => s.key === key)?.label || key;
}

export default function EInvoicePanel({ invoice, order, onUpdated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showDistancePrompt, setShowDistancePrompt] = useState(false);
  const [distanceKm, setDistanceKm] = useState('');
  const [useSandbox, setUseSandbox] = useState(false);
  const [lastResponse, setLastResponse] = useState(null);

  // E-Invoice manual fields
  const [irn, setIrn] = useState(invoice?.irn || '');
  const [ackNo, setAckNo] = useState(invoice?.ack_number || '');
  const [ackDate, setAckDate] = useState(invoice?.ack_date || '');
  const [ewayBill, setEwayBill] = useState(invoice?.eway_bill || '');
  const [ewayBillDate, setEwayBillDate] = useState(invoice?.eway_bill_date || '');

  // Dispatch / Bilty fields
  const [lrNumber, setLrNumber] = useState(invoice?.lr_number || '');
  const [lrDate, setLrDate] = useState(invoice?.lr_date || '');
  const [podDate, setPodDate] = useState(invoice?.pod_date || '');

  // Tally
  const [tallyVoucherNo, setTallyVoucherNo] = useState(invoice?.tally_voucher_no || '');
  const [showTallyLog, setShowTallyLog] = useState(false);

  if (!invoice) {
    return (
      <div className="flex items-start gap-2 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800">No invoice created yet</p>
          <p className="text-xs text-amber-600 mt-1">Generate an invoice from the Invoice tab first.</p>
        </div>
      </div>
    );
  }

  const workflowState = invoice.workflow_state || 'draft';
  const isCancelled = workflowState === 'cancelled';
  const isReturnPath = ['return_pending_approval', 'return_approved', 'return_completed'].includes(workflowState);
  const nextTransition = SI_TRANSITIONS.find(t => t.from === workflowState);
  const canCancel = CANCELLABLE.has(workflowState);

  const activeSteps = isReturnPath ? SI_RETURN_STEPS : SI_STEPS;
  const activeIdx = activeSteps.findIndex(s => s.key === workflowState);

  // Mirrors ERPNext server scripts:
  // "SI Mandatory" (Before Save) + "E-Invoice & E-Way Bill Mandatory" (Before Save)
  function validateMandatoryForSITransition(nextState) {
    const missing = [];
    if (nextState === 'waiting_for_dispatch') {
      // Mirrors "E-Invoice & E-Way Bill Mandatory": IRN + E-Way Bill required before Bills Generated
      if (!irn && !invoice?.irn) missing.push('IRN (E-Invoice)');
      if (!ewayBill && !invoice?.eway_bill) missing.push('E-Way Bill Number');
    }
    if (nextState === 'wait_to_deliver') {
      // Mirrors "SI Mandatory": dispatched_date required before Bilty Received
      if (!lrNumber && !invoice?.lr_number) missing.push('LR / Bilty Number');
      if (!lrDate && !invoice?.lr_date) missing.push('LR / Bilty Date');
    }
    if (nextState === 'delivered') {
      // Mirrors "SI Mandatory": POD date required before Delivered
      if (!podDate && !invoice?.pod_date) missing.push('POD Received Date');
    }
    return missing;
  }

  // Auto-generate flow triggered by "Bills Generated" button — mirrors Frappe client script
  async function handleBillsGenerated() {
    setSaving(true);
    try {
      // Step 1: Generate IRN if missing
      const currentIrn = irn || invoice?.irn;
      if (!currentIrn) {
        toast({ title: 'Generating E-Invoice (IRN)…' });
        const resp = await base44.functions.invoke('cleartaxGenerate', { action: 'generate_irn', invoice_id: invoice.id, sandbox: useSandbox });
        if (!resp.data?.success) {
          toast({ title: 'E-Invoice generation failed', description: resp.data?.error || 'Check ClearTax settings', variant: 'destructive' });
          setSaving(false);
          return;
        }
        setIrn(resp.data.irn || '');
        setAckNo(resp.data.ack_number || '');
        setAckDate(resp.data.ack_date || '');
        if (onUpdated) onUpdated();
      }

      // Step 2: Generate E-Way Bill if missing
      const currentEway = ewayBill || invoice?.eway_bill;
      if (!currentEway) {
        setSaving(false);
        setShowDistancePrompt(true);
        return;
      }

      // Step 3: All docs present — advance workflow
      await advanceWorkflow('waiting_for_dispatch');
    } catch (err) {
      toast({ title: 'Unexpected error', description: err.message, variant: 'destructive' });
      setSaving(false);
    }
  }

  async function confirmEwayGeneration() {
    const km = parseInt(distanceKm, 10);
    if (!km || km < 1 || km > 4000) {
      toast({ title: 'Enter a distance between 1 and 4000 km', variant: 'destructive' });
      return;
    }
    setShowDistancePrompt(false);
    setSaving(true);
    try {
      toast({ title: 'Generating E-Way Bill…' });
      const resp = await base44.functions.invoke('cleartaxGenerate', { action: 'generate_eway', invoice_id: invoice.id, distance_km: km, sandbox: useSandbox });
      if (!resp.data?.success) {
        toast({ title: 'E-Way Bill generation failed', description: resp.data?.error || 'Check ClearTax settings', variant: 'destructive' });
        setSaving(false);
        return;
      }
      setEwayBill(resp.data.eway_bill || '');
      setEwayBillDate(resp.data.eway_bill_date || '');
      if (onUpdated) onUpdated();
      // Now advance workflow
      await advanceWorkflow('waiting_for_dispatch');
    } catch (err) {
      toast({ title: 'Unexpected error', description: err.message, variant: 'destructive' });
      setSaving(false);
    }
  }

  async function advanceWorkflow(nextState) {
    const missing = validateMandatoryForSITransition(nextState);
    if (missing.length > 0) {
      toast({ title: `Required before proceeding: ${missing.join(', ')}`, variant: 'destructive' });
      return;
    }
    setSaving(true);
    const updateData = { workflow_state: nextState };

    if (nextState === 'waiting_for_dispatch') {
      if (irn) updateData.irn = irn;
      if (ackNo) updateData.ack_number = ackNo;
      if (ackDate) updateData.ack_date = ackDate;
      if (ewayBill) updateData.eway_bill = ewayBill;
      if (ewayBillDate) updateData.eway_bill_date = ewayBillDate;
    }
    if (nextState === 'wait_to_deliver') {
      if (lrNumber) updateData.lr_number = lrNumber;
      if (lrDate) updateData.lr_date = lrDate;
    }
    if (nextState === 'delivered') {
      if (podDate) updateData.pod_date = podDate;
      await base44.entities.SalesOrder.update(order?.id, { status: 'delivered' });
    }

    await base44.entities.SalesInvoice.update(invoice.id, updateData);
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesInvoice', entity_id: invoice.id,
      reference_number: invoice.invoice_number,
      action: `workflow_${nextState}`, old_value: workflowState,
      new_value: nextState, user_email: user?.email,
    });

    const eventMap = {
      waiting_for_e_invoice:   'sales_invoice_submitted',
      waiting_for_dispatch:    'sales_invoice_bills_generated',
      waiting_for_bilty:       'sales_invoice_dispatched',
      wait_to_deliver:         'sales_invoice_bilty_received',
      delivered:               'sales_invoice_delivered',
      return_pending_approval: 'sales_return_initiated',
      return_approved:         'sales_return_approved',
      return_completed:        'sales_return_completed',
    };
    if (eventMap[nextState]) await fireFMSEvent(eventMap[nextState], invoice.id);

    setSaving(false);
    toast({ title: `Invoice → ${stepLabel(nextState)}` });
    if (onUpdated) onUpdated();
  }

  async function handleCancel() {
    if (!cancelReason.trim()) {
      toast({ title: 'Cancellation reason required', variant: 'destructive' }); return;
    }
    setSaving(true);
    await base44.entities.SalesInvoice.update(invoice.id, {
      workflow_state: 'cancelled', status: 'cancelled',
    });
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesInvoice', entity_id: invoice.id,
      reference_number: invoice.invoice_number,
      action: 'cancelled', old_value: workflowState,
      new_value: 'cancelled', notes: cancelReason, user_email: user?.email,
    });
    setSaving(false);
    setShowCancel(false);
    toast({ title: 'Invoice cancelled' });
    if (onUpdated) onUpdated();
  }

  async function generateIRN() {
    setSaving(true);
    const resp = await base44.functions.invoke('cleartaxGenerate', { action: 'generate_irn', invoice_id: invoice.id, sandbox: useSandbox });
    setSaving(false);
    setLastResponse(resp.data);
    if (resp.data?.success) {
      setIrn(resp.data.irn || ''); setAckNo(resp.data.ack_number || ''); setAckDate(resp.data.ack_date || '');
      const modeLabel = resp.data.demo_mode ? 'Demo Mode' : (resp.data.mode || 'API');
      toast({ title: `IRN generated (${modeLabel})`, description: resp.data.message || 'Success' });
      if (onUpdated) onUpdated();
    } else {
      toast({ title: 'IRN generation failed', description: resp.data?.error || 'Check GST integration settings', variant: 'destructive' });
    }
  }

  async function generateEwayBill() {
    setSaving(true);
    const resp = await base44.functions.invoke('cleartaxGenerate', { action: 'generate_eway', invoice_id: invoice.id, sandbox: useSandbox });
    setSaving(false);
    setLastResponse(resp.data);
    if (resp.data?.success) {
      setEwayBill(resp.data.eway_bill || ''); setEwayBillDate(resp.data.eway_bill_date || '');
      const modeLabel = resp.data.demo_mode ? 'Demo Mode' : (resp.data.mode || 'API');
      toast({ title: `E-Way Bill generated (${modeLabel})` });
      if (onUpdated) onUpdated();
    } else {
      toast({ title: 'E-Way Bill generation failed', description: resp.data?.error || 'Check GST integration settings', variant: 'destructive' });
    }
  }

  async function saveTally() {
    setSaving(true);
    try {
      const resp = await base44.functions.invoke('tallyPushInvoice', { invoice_id: invoice.id });
      const data = resp?.data;
      if (data?.status === 'success') {
        toast({ title: 'Invoice pushed to Tally successfully!', description: `Voucher: ${data.voucher_number}` });
        await fireFMSEvent('sales_tally_posted', invoice.id);
        if (onUpdated) onUpdated();
      } else {
        toast({
          title: 'Tally push failed',
          description: data?.error || 'Check the Push Log tab for details.',
          variant: 'destructive',
        });
        setShowTallyLog(true);
      }
    } catch (err) {
      toast({ title: 'Error pushing to Tally', description: err.message, variant: 'destructive' });
      setShowTallyLog(true);
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      {/* Workflow Progress */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Invoice Workflow</h4>
        {!isCancelled && (
          <div className="flex items-center overflow-x-auto min-w-max mb-4">
            {activeSteps.map((step, i) => {
              const done = activeIdx > i;
              const active = activeIdx === i;
              return (
                <div key={step.key} className="flex items-center">
                  <div className="flex flex-col items-center gap-1 px-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                      done ? 'bg-green-100 text-green-600' : active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : (i + 1)}
                    </div>
                    <span className={`text-[10px] font-medium text-center max-w-[80px] leading-tight ${active ? 'text-slate-900' : done ? 'text-green-700' : 'text-slate-400'}`}>
                      {step.label}
                    </span>
                  </div>
                  {i < activeSteps.length - 1 && <div className={`w-6 h-0.5 mb-5 flex-shrink-0 ${done ? 'bg-green-400' : 'bg-slate-200'}`} />}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATE_COLORS[workflowState] || 'bg-slate-100 text-slate-600'}`}>
            {stepLabel(workflowState)}
          </span>
          <div className="flex gap-2 flex-wrap">
            {canCancel && !showCancel && (
              <Button variant="outline" className="h-11 text-sm text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setShowCancel(true)} disabled={saving}>
                <XCircle className="w-4 h-4 mr-1" /> Cancel Invoice
              </Button>
            )}
            {nextTransition && !isCancelled && (
              <Button
                className={`h-11 text-sm ${nextTransition.isReturn ? 'bg-orange-600 hover:bg-orange-700' : 'bg-slate-900 hover:bg-slate-800'} text-white`}
                onClick={() => nextTransition.action === 'Bills Generated' ? handleBillsGenerated() : advanceWorkflow(nextTransition.next)}
                disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> :
                  nextTransition.isReturn ? <RotateCcw className="w-4 h-4 mr-1" /> : <ArrowRight className="w-4 h-4 mr-1" />}
                {nextTransition.action}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Distance prompt modal — appears before E-Way Bill generation */}
      {showDistancePrompt && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-blue-900">Distance Required for E-Way Bill</h4>
          <p className="text-xs text-blue-700">Enter the transport distance in kilometres (1–4000).</p>
          <div>
            <Label className="text-xs font-medium text-slate-700">Distance (km) *</Label>
            <Input
              type="number" min={1} max={4000}
              className="h-9 text-sm mt-1 w-40"
              value={distanceKm}
              onChange={e => setDistanceKm(e.target.value)}
              placeholder="e.g. 250"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-11 text-sm" onClick={() => setShowDistancePrompt(false)}>Cancel</Button>
            <Button className="h-11 bg-slate-900 hover:bg-slate-800 text-white text-sm" onClick={confirmEwayGeneration}>
              <Zap className="w-4 h-4 mr-2" /> Generate E-Way Bill
            </Button>
          </div>
        </div>
      )}

      {/* Cancel form */}
      {showCancel && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-red-800">Cancel Invoice</h4>
          <div>
            <Label className="text-xs font-medium text-red-700">Reason *</Label>
            <Input className="h-9 text-sm mt-1 border-red-300" value={cancelReason}
              onChange={e => setCancelReason(e.target.value)} placeholder="Enter reason for cancellation..." />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-11 text-sm" onClick={() => setShowCancel(false)}>Back</Button>
            <Button className="h-11 bg-red-600 hover:bg-red-700 text-white text-sm" onClick={handleCancel} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
              Confirm Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Cancelled banner */}
      {isCancelled && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm font-medium text-red-800">Invoice Cancelled</p>
        </div>
      )}

      {/* E-Invoice & E-Way Bill — shown when in waiting_for_e_invoice */}
      {(workflowState === 'waiting_for_e_invoice' || invoice.irn) && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-violet-600" />
            <span className="text-sm font-semibold text-slate-900">E-Invoice & E-Way Bill</span>
            {invoice.irn && (
              <span className="ml-auto bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Generated
              </span>
            )}
          </div>
          <div className="p-4 space-y-3">
            {invoice.irn && (
              <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
                <div><span className="text-slate-500">IRN: </span><span className="font-mono text-xs break-all">{invoice.irn}</span></div>
                {invoice.ack_number && <div><span className="text-slate-500">Ack No: </span><span className="font-medium">{invoice.ack_number}</span></div>}
                {invoice.eway_bill && <div><span className="text-slate-500">E-Way Bill: </span><span className="font-medium">{invoice.eway_bill}</span></div>}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-700">IRN Number</Label>
                <Input className="h-9 text-sm mt-1 font-mono" value={irn} onChange={e => setIrn(e.target.value)} placeholder="Enter IRN manually" />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Acknowledgement Number</Label>
                <Input className="h-9 text-sm mt-1" value={ackNo} onChange={e => setAckNo(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Acknowledgement Date</Label>
                <Input type="date" className="h-9 text-sm mt-1" value={ackDate} onChange={e => setAckDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">E-Way Bill Number</Label>
                <Input className="h-9 text-sm mt-1" value={ewayBill} onChange={e => setEwayBill(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">E-Way Bill Date</Label>
                <Input type="date" className="h-9 text-sm mt-1" value={ewayBillDate} onChange={e => setEwayBillDate(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap pt-1">
               <label className="flex items-center gap-2 cursor-pointer select-none">
                 <input type="checkbox" className="w-4 h-4 rounded" checked={useSandbox} onChange={e => setUseSandbox(e.target.checked)} />
                 <span className="text-xs text-slate-600">Sandbox / Test mode</span>
               </label>
             </div>
             <div className="flex gap-2 flex-wrap">
               <Button variant="outline" className="h-11 text-sm" onClick={generateIRN} disabled={saving}>
                 <Zap className="w-4 h-4 mr-2" /> Generate IRN
               </Button>
               <Button variant="outline" className="h-11 text-sm" onClick={generateEwayBill} disabled={saving || !invoice?.irn}>
                 <Zap className="w-4 h-4 mr-2" /> Generate E-Way Bill{!invoice?.irn && <span className="text-xs ml-1 opacity-60">(IRN first)</span>}
               </Button>
             </div>
             {lastResponse && (
               <div className={`text-xs rounded-lg px-3 py-2 ${lastResponse.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
                 {lastResponse.message || lastResponse.error || (lastResponse.success ? 'Success' : 'Failed')}
                 {lastResponse.demo_mode && <span className="ml-2 font-semibold">[Demo Mode]</span>}
               </div>
             )}
          </div>
        </div>
      )}

      {/* Bilty / LR fields — shown when dispatched */}
      {(workflowState === 'waiting_for_bilty' || workflowState === 'wait_to_deliver' || workflowState === 'delivered' || invoice.lr_number) && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <Truck className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-semibold text-slate-900">LR / Bilty Details</span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-slate-700">LR / Bilty Number</Label>
              <Input className="h-9 text-sm mt-1" value={lrNumber} onChange={e => setLrNumber(e.target.value)} placeholder="Enter LR number" />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-700">LR Date</Label>
              <Input type="date" className="h-9 text-sm mt-1" value={lrDate} onChange={e => setLrDate(e.target.value)} />
            </div>
            {(workflowState === 'wait_to_deliver' || workflowState === 'delivered') && (
              <div>
                <Label className="text-xs font-medium text-slate-700">POD Received Date</Label>
                <Input type="date" className="h-9 text-sm mt-1" value={podDate} onChange={e => setPodDate(e.target.value)} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tally Posting */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Upload className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-semibold text-slate-900">Tally Posting</span>
          {invoice.posted_to_tally && (
            <span className="ml-1 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Posted
            </span>
          )}
          <button
            onClick={() => setShowTallyLog(v => !v)}
            className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded px-2 py-1">
            <History className="w-3.5 h-3.5" /> Push Log
          </button>
        </div>
        <div className="p-4 space-y-3">
          {invoice.posted_to_tally ? (
            <div className="text-sm space-y-1">
              {invoice.tally_voucher_no && <div><span className="text-slate-500">Voucher No: </span><span className="font-medium">{invoice.tally_voucher_no}</span></div>}
              {invoice.tally_posted_date && <div><span className="text-slate-500">Date: </span><span>{invoice.tally_posted_date}</span></div>}
              {invoice.tally_posted_by && <div><span className="text-slate-500">By: </span><span>{invoice.tally_posted_by}</span></div>}
              <Button variant="outline" className="h-11 text-sm mt-2" onClick={saveTally} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                Re-push to Tally
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Button className="h-11 bg-emerald-700 hover:bg-emerald-800 text-white text-sm" onClick={saveTally} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                Push to Tally
              </Button>
              <p className="text-xs text-slate-500">This will automatically generate the XML and send it to your Tally instance.</p>
            </div>
          )}
          {showTallyLog && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Push Attempt History</p>
              <TallyPushLogViewer invoiceId={invoice.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}