import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, FileText, Printer } from 'lucide-react';
import { fireFMSEvent, linkFMSRef, findFMSInstanceByRef } from '@/lib/useFMSAutoComplete';
import K95InvoiceTemplate from '@/components/sales/K95InvoiceTemplate';

export default function SOInvoicePanel({ order, items, onUpdated, deliveryNote }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    invoice_number: `INV-${Date.now().toString().slice(-8)}`,
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: '',
  });

  const { data: invoices = [], refetch } = useQuery({
    queryKey: ['so_invoices', order.id],
    queryFn: () => base44.entities.SalesInvoice.filter({ sales_order_id: order.id }, '-created_date'),
  });

  const existingInvoice = invoices[0];

  const { data: dispatches = [] } = useQuery({
    queryKey: ['dispatches_inv', order.id],
    queryFn: () => base44.entities.SalesDispatch.filter({ sales_order_id: order.id }),
  });

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
            dispatch={dispatches[0]}
            order={order}
            deliveryNote={deliveryNote}
          />
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