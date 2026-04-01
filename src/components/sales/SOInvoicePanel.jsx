import { useState, useEffect } from 'react';
import { generateDocNumber } from '@/lib/docNumberHelper';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, FileText, Printer, Lock } from 'lucide-react';

// Statuses that allow invoice creation
const INVOICE_ALLOWED_FROM = ['packing'];
// Statuses where invoice already exists (view-only)
const INVOICE_DONE_STATUSES = ['invoiced', 'delivered', 'paid', 'closed'];
// Human-readable prerequisite description per status
const PREREQUISITE_MSG = {
  draft:            'Order must be confirmed first.',
  confirmed:        'Order must go through Logistics Review before invoicing.',
  logistics_review: 'Order must complete Picking & Packing before invoicing.',
  picking:          'Order must be fully packed before invoicing.',
};
import { fireFMSEvent, linkFMSRef, findFMSInstanceByRef } from '@/lib/useFMSAutoComplete';
import K95InvoiceTemplate from '@/components/sales/K95InvoiceTemplate';
import EInvoicePanel from '@/components/sales/EInvoicePanel';

export default function SOInvoicePanel({ order, items, onUpdated, deliveryNote }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: '',
  });

  const canInvoice = INVOICE_ALLOWED_FROM.includes(order.status) || INVOICE_DONE_STATUSES.includes(order.status);

  useEffect(() => {
    // Only consume a counter number when the order is actually ready for invoicing
    if (INVOICE_ALLOWED_FROM.includes(order.status)) {
      generateDocNumber('INV').then(num => setForm(f => ({ ...f, invoice_number: num })));
    }
  }, [order.status]);

  const { data: invoices = [], refetch } = useQuery({
    queryKey: ['so_invoices', order.id],
    queryFn: () => base44.entities.SalesInvoice.filter({ sales_order_id: order.id }, '-created_date'),
  });

  const existingInvoice = invoices[0];

  async function createInvoice() {
    setSaving(true);
    const taxableAmount = items.reduce((s, i) => s + (i.taxable_value || 0), 0);
    const taxAmount = items.reduce((s, i) => s + (i.igst_amount || i.cgst_amount || 0), 0);
    const totalAmount = order.total_amount || (taxableAmount + taxAmount);

    const invoice = await base44.entities.SalesInvoice.create({
      ...form,
      sales_order_id: order.id,
      so_number: order.so_number,
      customer_name: order.customer_name,
      customer_gstin: order.customer_gstin,
      billing_address: order.billing_address,
      shipping_address: order.shipping_address,
      payment_terms: order.payment_terms,
      taxable_amount: taxableAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      status: 'sent',
      workflow_state: 'pending',
    });

    await base44.entities.SalesOrder.update(order.id, { status: 'invoiced' });

    const instances = await findFMSInstanceByRef(order.id);
    if (instances[0]) await linkFMSRef(instances[0].id, invoice.id);
    await fireFMSEvent('sales_invoiced', order.id);

    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesInvoice', entity_id: invoice.id,
      reference_number: form.invoice_number, action: 'created', user_email: user?.email,
    });

    setSaving(false);
    toast({ title: 'Invoice created', description: form.invoice_number });
    refetch(); onUpdated();
  }

  // ── Status gate — order not ready for invoicing yet ─────────────
  if (!canInvoice && !existingInvoice) {
    const prereq = PREREQUISITE_MSG[order.status] || 'Order is not ready for invoicing yet.';
    const statusLabel = order.status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
          <Lock className="w-5 h-5 text-slate-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700">Invoice Not Available Yet</p>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">{prereq}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
          <span className="text-xs text-amber-700 font-medium">Current Status:</span>
          <span className="text-xs font-semibold text-amber-900">{statusLabel}</span>
        </div>
        <p className="text-xs text-slate-400">Complete the required workflow steps to unlock invoice generation.</p>
      </div>
    );
  }

  if (existingInvoice) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 p-3 bg-violet-50 rounded-lg flex-1">
            <FileText className="w-4 h-4 text-violet-600" />
            <span className="text-sm font-medium text-violet-700">Invoice: {existingInvoice.invoice_number}</span>
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
              existingInvoice.status === 'paid' ? 'bg-green-100 text-green-700' :
              existingInvoice.status === 'overdue' ? 'bg-red-100 text-red-700' :
              'bg-violet-100 text-violet-700'
            }`}>{existingInvoice.status}</span>
          </div>
          <Button variant="outline" className="ml-3 h-9 text-xs" onClick={() => window.print()}>
            <Printer className="w-3 h-3 mr-1" /> Print
          </Button>
        </div>

        {/* K95 Invoice Preview */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <K95InvoiceTemplate
            invoice={existingInvoice}
            items={items}
            order={order}
            deliveryNote={deliveryNote}
          />
        </div>

        {/* E-Invoice, E-Way Bill, Workflow & Tally — inline below invoice */}
        <div className="border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">E-Invoice, E-Way Bill &amp; Tally</h3>
          <EInvoicePanel invoice={existingInvoice} order={order} onUpdated={() => { refetch(); if (onUpdated) onUpdated(); }} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-900">Generate Invoice</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-medium text-slate-700">Invoice Number</Label>
          <Input className="h-9 text-sm mt-1" value={form.invoice_number}
            onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-700">Invoice Date</Label>
          <Input type="date" className="h-9 text-sm mt-1" value={form.invoice_date}
            onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-700">Due Date</Label>
          <Input type="date" className="h-9 text-sm mt-1" value={form.due_date}
            onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>Taxable Amount</span>
          <span>₹{items.reduce((s, i) => s + (i.taxable_value || 0), 0).toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between text-slate-600 mt-1">
          <span>Tax Amount</span>
          <span>₹{items.reduce((s, i) => s + (i.igst_amount || 0), 0).toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between font-semibold text-slate-900 mt-2 pt-2 border-t border-slate-200">
          <span>Total</span>
          <span>₹{(order.total_amount || 0).toLocaleString('en-IN')}</span>
        </div>
      </div>

      <div className="flex justify-end">
        <Button className="h-11 bg-slate-900 text-white text-sm" onClick={createInvoice} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
          Generate Invoice
        </Button>
      </div>
    </div>
  );
}