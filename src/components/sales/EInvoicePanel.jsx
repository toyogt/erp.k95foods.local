/**
 * E-Invoice, E-Way Bill & Invoice Workflow Panel
 * SI Minimal Workflowe (active):
 *   Pending → Approved & Submitted → Send for Tally Posting → Posted to Tally → Delivered
 *   Return path: Approved & Submitted → Return Initiated → Return Received → Credit/Debit Note Raised → Tally
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { FileText, Truck, Upload, AlertTriangle, CheckCircle2, Loader2, ArrowRight, RotateCcw, Zap } from 'lucide-react';
import { fireFMSEvent } from '@/lib/useFMSAutoComplete';

const INV_WORKFLOW_STEPS = [
  { key: 'pending',                label: 'Pending' },
  { key: 'approved_submitted',     label: 'Approved & Submitted' },
  { key: 'send_for_tally_posting', label: 'Send for Tally Posting' },
  { key: 'posted_to_tally',        label: 'Posted to Tally' },
  { key: 'delivered',              label: 'Delivered' },
];

const INV_RETURN_STEPS = [
  { key: 'return_initiated',         label: 'Return Initiated' },
  { key: 'return_received',          label: 'Return Received' },
  { key: 'credit_debit_note_raised', label: 'Credit/Debit Note Raised' },
];

const INV_TRANSITIONS = [
  { from: 'pending',                  action: 'Approve & Submit',        next: 'approved_submitted' },
  { from: 'approved_submitted',       action: 'Send for Tally Posting',  next: 'send_for_tally_posting' },
  { from: 'approved_submitted',       action: 'Initiate Return',         next: 'return_initiated', isReturn: true },
  { from: 'send_for_tally_posting',   action: 'Mark Posted to Tally',    next: 'posted_to_tally' },
  { from: 'posted_to_tally',          action: 'Mark Delivered',          next: 'delivered' },
  { from: 'return_initiated',         action: 'Return Received',         next: 'return_received' },
  { from: 'return_received',          action: 'Raise Credit/Debit Note', next: 'credit_debit_note_raised' },
  { from: 'credit_debit_note_raised', action: 'Send for Tally Posting',  next: 'send_for_tally_posting' },
];

const STATE_COLORS = {
  pending: 'bg-amber-100 text-amber-800',
  approved_submitted: 'bg-blue-100 text-blue-800',
  return_initiated: 'bg-orange-100 text-orange-800',
  return_received: 'bg-orange-100 text-orange-800',
  credit_debit_note_raised: 'bg-purple-100 text-purple-800',
  send_for_tally_posting: 'bg-indigo-100 text-indigo-800',
  posted_to_tally: 'bg-green-100 text-green-700',
  delivered: 'bg-green-100 text-green-700',
};

export default function EInvoicePanel({ invoice, order, onUpdated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [irn, setIrn] = useState(invoice?.irn || '');
  const [ackNo, setAckNo] = useState(invoice?.ack_number || '');
  const [ackDate, setAckDate] = useState(invoice?.ack_date || '');
  const [ewayBill, setEwayBill] = useState(invoice?.eway_bill || '');
  const [ewayBillDate, setEwayBillDate] = useState(invoice?.eway_bill_date || '');
  const [tallyVoucherNo, setTallyVoucherNo] = useState(invoice?.tally_voucher_no || '');
  const [creditNoteNo, setCreditNoteNo] = useState(invoice?.credit_note_number || '');
  const [creditNoteAmt, setCreditNoteAmt] = useState(invoice?.credit_note_amount || '');

  if (!invoice) {
    return (
      <div className="flex items-start gap-2 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800">No invoice created yet</p>
          <p className="text-xs text-amber-600 mt-1">Create an invoice from the Invoice tab first.</p>
        </div>
      </div>
    );
  }

  const workflowState = invoice.workflow_state || 'pending';
  const hasEInvoice = !!invoice.irn;
  const hasEwayBill = !!invoice.eway_bill;
  const isPostedToTally = !!invoice.posted_to_tally;
  const availableTransitions = INV_TRANSITIONS.filter(t => t.from === workflowState);
  const isReturnPath = ['return_initiated', 'return_received', 'credit_debit_note_raised'].includes(workflowState);
  const currentStepIndex = INV_WORKFLOW_STEPS.findIndex(s => s.key === workflowState);
  const returnStepIndex = INV_RETURN_STEPS.findIndex(s => s.key === workflowState);

  async function advanceWorkflow(nextState) {
    setSaving(true);
    const updateData = { workflow_state: nextState };

    if (nextState === 'posted_to_tally') {
      updateData.posted_to_tally = true;
      updateData.tally_posted_date = new Date().toISOString().split('T')[0];
      updateData.tally_posted_by = user?.email;
      if (tallyVoucherNo) updateData.tally_voucher_no = tallyVoucherNo;
    }
    if (nextState === 'credit_debit_note_raised') {
      if (creditNoteNo) updateData.credit_note_number = creditNoteNo;
      if (creditNoteAmt) updateData.credit_note_amount = parseFloat(creditNoteAmt);
    }
    if (nextState === 'delivered') {
      await base44.entities.SalesOrder.update(order.id, { status: 'delivered' });
    }

    await base44.entities.SalesInvoice.update(invoice.id, updateData);
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesInvoice', entity_id: invoice.id,
      reference_number: invoice.invoice_number,
      action: `workflow_${nextState}`, old_value: workflowState,
      new_value: nextState, user_email: user?.email,
    });

    const eventMap = {
      approved_submitted: 'sales_invoice_approved', send_for_tally_posting: 'sales_send_for_tally',
      posted_to_tally: 'sales_tally_posted', delivered: 'sales_invoice_delivered',
      return_initiated: 'sales_return_initiated',
    };
    if (eventMap[nextState]) await fireFMSEvent(eventMap[nextState], invoice.id);

    setSaving(false);
    const label = [...INV_WORKFLOW_STEPS, ...INV_RETURN_STEPS].find(s => s.key === nextState)?.label || nextState;
    toast({ title: `Invoice → ${label}` });
    if (onUpdated) onUpdated();
  }

  async function generateIRN() {
    setSaving(true);
    const resp = await base44.functions.invoke('cleartaxGenerate', { action: 'generate_irn', invoice_id: invoice.id });
    setSaving(false);
    if (resp.data?.success) {
      setIrn(resp.data.irn || '');
      setAckNo(resp.data.ack_number || '');
      setAckDate(resp.data.ack_date || '');
      toast({ title: 'IRN generated successfully' });
      if (onUpdated) onUpdated();
    } else {
      toast({ title: 'IRN generation failed', description: resp.data?.error || 'Check ClearTax API key in Sales Settings', variant: 'destructive' });
    }
  }

  async function generateEwayBill() {
    setSaving(true);
    const resp = await base44.functions.invoke('cleartaxGenerate', { action: 'generate_eway', invoice_id: invoice.id });
    setSaving(false);
    if (resp.data?.success) {
      setEwayBill(resp.data.eway_bill || '');
      setEwayBillDate(resp.data.eway_bill_date || '');
      toast({ title: 'E-Way Bill generated', description: String(resp.data.eway_bill) });
      if (onUpdated) onUpdated();
    } else {
      toast({ title: 'E-Way Bill generation failed', description: resp.data?.error || 'Check ClearTax API key in Sales Settings', variant: 'destructive' });
    }
  }

  async function saveEInvoiceDetails() {
    setSaving(true);
    const updateData = {};
    if (irn) updateData.irn = irn;
    if (ackNo) updateData.ack_number = ackNo;
    if (ackDate) updateData.ack_date = ackDate;
    if (ewayBill) updateData.eway_bill = ewayBill;
    if (ewayBillDate) updateData.eway_bill_date = ewayBillDate;
    await base44.entities.SalesInvoice.update(invoice.id, updateData);
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesInvoice', entity_id: invoice.id,
      reference_number: invoice.invoice_number,
      action: 'einvoice_details_saved', user_email: user?.email,
    });
    setSaving(false);
    toast({ title: 'E-Invoice details saved' });
    if (onUpdated) onUpdated();
  }

  const activeSteps = isReturnPath ? INV_RETURN_STEPS : INV_WORKFLOW_STEPS;
  const activeIdx = isReturnPath ? returnStepIndex : currentStepIndex;

  return (
    <div className="space-y-4">
      {/* Invoice Workflow Progress */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Invoice Workflow</h4>
        <div className="flex items-center overflow-x-auto min-w-max">
          {activeSteps.map((step, i) => {
            const done = activeIdx > i;
            const active = activeIdx === i;
            return (
              <div key={step.key} className="flex items-center">
                <div className="flex flex-col items-center gap-1 px-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${
                    done ? 'bg-green-100 text-green-600' : active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {done ? <CheckCircle2 className="w-4 h-4" /> : (i + 1)}
                  </div>
                  <span className={`text-xs font-medium text-center max-w-[90px] ${active ? 'text-slate-900' : done ? 'text-green-700' : 'text-slate-400'}`}>
                    {step.label}
                  </span>
                </div>
                {i < activeSteps.length - 1 && <div className={`w-8 h-0.5 mb-5 ${done ? 'bg-green-400' : 'bg-slate-200'}`} />}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATE_COLORS[workflowState] || 'bg-slate-100 text-slate-600'}`}>
            {[...INV_WORKFLOW_STEPS, ...INV_RETURN_STEPS].find(s => s.key === workflowState)?.label || workflowState}
          </span>
          <div className="flex gap-2 flex-wrap">
            {availableTransitions.map(t => (
              <Button key={t.next}
                className={`h-11 text-sm ${t.isReturn ? 'bg-orange-600 hover:bg-orange-700' : 'bg-slate-900 hover:bg-slate-800'} text-white`}
                onClick={() => advanceWorkflow(t.next)} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> :
                  t.isReturn ? <RotateCcw className="w-4 h-4 mr-1" /> : <ArrowRight className="w-4 h-4 mr-1" />}
                {t.action}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Tally Voucher (when ready to post) */}
      {workflowState === 'send_for_tally_posting' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-emerald-900">Tally Posting Details</h4>
          <div>
            <Label className="text-xs font-medium text-slate-700">Tally Voucher Number</Label>
            <Input className="h-9 text-sm mt-1" value={tallyVoucherNo}
              onChange={e => setTallyVoucherNo(e.target.value)} placeholder="Enter Tally voucher number..." />
          </div>
        </div>
      )}

      {/* Credit/Debit Note (when return received) */}
      {workflowState === 'return_received' && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-purple-900">Credit / Debit Note</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-slate-700">Credit Note Number</Label>
              <Input className="h-9 text-sm mt-1" value={creditNoteNo} onChange={e => setCreditNoteNo(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-700">Credit Note Amount</Label>
              <Input type="number" className="h-9 text-sm mt-1" value={creditNoteAmt} onChange={e => setCreditNoteAmt(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Tally confirmed badge */}
      {isPostedToTally && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <span className="text-green-800 font-medium">Posted to Tally</span>
          {invoice.tally_voucher_no && <span className="text-green-600 text-xs ml-2">Voucher: {invoice.tally_voucher_no}</span>}
          {invoice.tally_posted_date && <span className="text-green-600 text-xs ml-2">on {invoice.tally_posted_date}</span>}
        </div>
      )}

      {/* E-Invoice (IRN) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <FileText className="w-4 h-4 text-violet-600" />
          <span className="text-sm font-semibold text-slate-900">E-Invoice (IRN)</span>
          {hasEInvoice && (
            <span className="ml-auto bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Generated
            </span>
          )}
        </div>
        <div className="p-4 space-y-3">
          {hasEInvoice && (
            <div className="space-y-1 text-sm bg-slate-50 rounded-lg p-3">
              <div><span className="text-slate-500">IRN: </span><span className="font-mono text-xs break-all">{invoice.irn}</span></div>
              {invoice.ack_number && <div><span className="text-slate-500">Ack No: </span><span className="font-medium">{invoice.ack_number}</span></div>}
              {invoice.ack_date && <div><span className="text-slate-500">Ack Date: </span><span>{invoice.ack_date}</span></div>}
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
          </div>
          <Button variant="outline" className="h-11 text-sm" onClick={generateIRN} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
            Generate via ClearTax
          </Button>
        </div>
      </div>

      {/* E-Way Bill */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Truck className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-slate-900">E-Way Bill</span>
          {hasEwayBill && (
            <span className="ml-auto bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Generated
            </span>
          )}
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-slate-700">E-Way Bill Number</Label>
              <Input className="h-9 text-sm mt-1" value={ewayBill} onChange={e => setEwayBill(e.target.value)} placeholder="Enter E-Way Bill number" />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-700">E-Way Bill Date</Label>
              <Input type="date" className="h-9 text-sm mt-1" value={ewayBillDate} onChange={e => setEwayBillDate(e.target.value)} />
            </div>
          </div>
          <Button variant="outline" className="h-11 text-sm" onClick={generateEwayBill} disabled={saving || !invoice?.irn}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
            Generate via ClearTax{!invoice?.irn && <span className="text-xs ml-1 opacity-70">(generate IRN first)</span>}
          </Button>
        </div>
      </div>

      {/* Save manual details */}
      <div className="flex justify-end">
        <Button className="h-11 bg-slate-900 text-white text-sm" onClick={saveEInvoiceDetails} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
          Save E-Invoice & E-Way Bill Details
        </Button>
      </div>
    </div>
  );
}