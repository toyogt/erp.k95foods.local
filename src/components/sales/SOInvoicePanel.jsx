import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, FileText, CheckCircle2 } from 'lucide-react';
import { fireFMSEvent, linkFMSRef, findFMSInstanceByRef } from '@/lib/useFMSAutoComplete';

export default function SOInvoicePanel({ order, items, onUpdated }) {
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
        <div className="flex items-center gap-2 p-3 bg-violet-50 rounded-lg">
          <FileText className="w-4 h-4 text-violet-600" />
          <span className="text-sm font-medium text-violet-700">Invoice: {existingInvoice.invoice_number}</span>
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
            existingInvoice.status === 'paid' ? 'bg-green-100 text-green-700' :
            existingInvoice.status === 'overdue' ? 'bg-red-100 text-red-700' :
            'bg-violet-100 text-violet-700'
          }`}>{existingInvoice.status}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          {[
            ['Customer', existingInvoice.customer_name],
            ['Invoice Date', existingInvoice.invoice_date],
            ['Due Date', existingInvoice.due_date || '—'],
            ['Taxable Amount', `₹${existingInvoice.taxable_amount?.toLocaleString('en-IN') || 0}`],
            ['Tax Amount', `₹${existingInvoice.tax_amount?.toLocaleString('en-IN') || 0}`],
            ['Total Amount', `₹${existingInvoice.total_amount?.toLocaleString('en-IN') || 0}`],
          ].map(([k, v]) => (
            <div key={k} className="bg-white border border-slate-200 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">{k}</p>
              <p className="font-medium text-slate-900">{v}</p>
            </div>
          ))}
        </div>

        {/* Line items preview */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-2 text-xs font-medium text-slate-700">Invoice Items</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-600 border-b border-slate-100">
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Taxable</th>
                <th className="px-3 py-2 text-right">Tax</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(item => (
                <tr key={item.id}>
                  <td className="px-3 py-2 text-slate-800">{item.description}</td>
                  <td className="px-3 py-2 text-right">{item.quantity}</td>
                  <td className="px-3 py-2 text-right">₹{item.taxable_value?.toLocaleString('en-IN') || '—'}</td>
                  <td className="px-3 py-2 text-right">₹{item.igst_amount?.toLocaleString('en-IN') || '—'}</td>
                  <td className="px-3 py-2 text-right font-medium">₹{item.total_amount?.toLocaleString('en-IN') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
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