import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, CreditCard, CheckCircle2 } from 'lucide-react';
import { fireFMSEvent } from '@/lib/useFMSAutoComplete';

export default function SOPaymentPanel({ order, onUpdated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    amount: order.total_amount || '',
    payment_date: new Date().toISOString().split('T')[0],
    method: 'neft',
    reference_number: '',
    type: 'receipt',
    notes: '',
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['so_invoices', order.id],
    queryFn: () => base44.entities.SalesInvoice.filter({ sales_order_id: order.id }),
  });

  const { data: payments = [], refetch } = useQuery({
    queryKey: ['so_payments', order.id],
    queryFn: () => base44.entities.SalesPayment.filter({ sales_order_id: order.id }, '-created_date'),
  });

  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const isPending = order.status === 'invoiced' || order.status === 'delivered';

  async function recordPayment() {
    setSaving(true);
    const invoice = invoices[0];
    const payment = await base44.entities.SalesPayment.create({
      ...form,
      amount: parseFloat(form.amount),
      sales_order_id: order.id,
      invoice_id: invoice?.id || null,
      so_number: order.so_number,
      invoice_number: invoice?.invoice_number || null,
      customer_name: order.customer_name,
      recorded_by: user?.email,
    });

    const newTotalPaid = totalPaid + parseFloat(form.amount);
    if (newTotalPaid >= (order.total_amount || 0)) {
      await base44.entities.SalesOrder.update(order.id, { status: 'paid' });
      if (invoice) await base44.entities.SalesInvoice.update(invoice.id, { status: 'paid' });
      await fireFMSEvent('sales_payment_received', order.id);
    } else {
      if (invoice) await base44.entities.SalesInvoice.update(invoice.id, { status: 'partially_paid' });
    }

    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesPayment', entity_id: payment.id,
      reference_number: order.so_number, action: 'payment_recorded',
      new_value: `₹${form.amount} via ${form.method}`, user_email: user?.email,
    });

    setSaving(false);
    setShowForm(false);
    toast({ title: 'Payment recorded', description: `₹${parseFloat(form.amount).toLocaleString('en-IN')}` });
    refetch(); onUpdated();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Payments</h3>
        {isPending && !showForm && (
          <Button className="h-11 bg-slate-900 text-white text-sm" onClick={() => setShowForm(true)}>
            <CreditCard className="w-4 h-4 mr-2" /> Record Payment
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          ['Total Invoice', `₹${(order.total_amount || 0).toLocaleString('en-IN')}`],
          ['Amount Received', `₹${totalPaid.toLocaleString('en-IN')}`],
          ['Balance Due', `₹${Math.max(0, (order.total_amount || 0) - totalPaid).toLocaleString('en-IN')}`],
        ].map(([k, v]) => (
          <div key={k} className="bg-white border border-slate-200 rounded-xl p-3">
            <p className="text-xs text-slate-500 mb-1">{k}</p>
            <p className="text-sm font-bold text-slate-900">{v}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-slate-700">Amount (INR) *</Label>
              <Input type="number" className="h-9 text-sm mt-1" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-700">Payment Date *</Label>
              <Input type="date" className="h-9 text-sm mt-1" value={form.payment_date}
                onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-700">Payment Method</Label>
              <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                <option value="neft">NEFT</option>
                <option value="rtgs">RTGS</option>
                <option value="upi">UPI</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-700">Reference Number</Label>
              <Input className="h-9 text-sm mt-1" value={form.reference_number}
                onChange={e => setForm(f => ({ ...f, reference_number: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="h-11 px-4" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button className="h-11 bg-slate-900 text-white" onClick={recordPayment} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Save Payment
            </Button>
          </div>
        </div>
      )}

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-2 text-xs font-medium text-slate-700">Payment History</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-600 border-b border-slate-100">
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-left">Method</th>
                <th className="px-3 py-2 text-left">Reference</th>
                <th className="px-3 py-2 text-left">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map(p => (
                <tr key={p.id}>
                  <td className="px-3 py-2 text-slate-600">{p.payment_date}</td>
                  <td className="px-3 py-2 text-right font-medium text-green-700">₹{p.amount?.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-slate-600 uppercase text-xs">{p.method}</td>
                  <td className="px-3 py-2 text-slate-500">{p.reference_number || '—'}</td>
                  <td className="px-3 py-2 text-slate-500 text-xs">{p.recorded_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {order.status === 'paid' && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span className="text-sm font-medium text-green-700">Payment fully received — Order closed</span>
        </div>
      )}
    </div>
  );
}