import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { AlertTriangle, CheckCircle, Loader2, FileText } from 'lucide-react';

function StatusBadge({ status }) {
  const map = {
    pending_match: 'bg-yellow-100 text-yellow-700',
    matched: 'bg-green-100 text-green-700',
    discrepancy_identified: 'bg-red-100 text-red-700',
    credit_note_issued: 'bg-blue-100 text-blue-700',
    closed: 'bg-slate-100 text-slate-600',
  };
  const labels = {
    pending_match: 'Pending Match', matched: 'Matched',
    discrepancy_identified: 'Discrepancy Found', credit_note_issued: 'Credit Note Issued', closed: 'Closed'
  };
  return <span className={`text-xs font-medium px-2 py-1 rounded-full ${map[status] || 'bg-slate-100 text-slate-600'}`}>{labels[status] || status}</span>;
}

export default function GRNReconciliationPanel({ grn, open, onClose, onUpdated }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [creditNoteNumber, setCreditNoteNumber] = useState('');
  const [creditNoteAmount, setCreditNoteAmount] = useState('');
  const [creditNoteDate, setCreditNoteDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: invoiceItems = [] } = useQuery({
    queryKey: ['grn-reconcile-items', grn?.id],
    enabled: !!grn?.invoice_id,
    queryFn: () => base44.entities.SalesOrderItem.filter({ sales_order_id: grn.invoice_id }),
  });

  // Try to fetch from sales invoice to get sales_order_id
  const { data: invoices = [] } = useQuery({
    queryKey: ['grn-invoice', grn?.invoice_id],
    enabled: !!grn?.invoice_id,
    queryFn: () => base44.entities.SalesInvoice.filter({ id: grn.invoice_id }),
  });

  const { data: soItems = [] } = useQuery({
    queryKey: ['grn-so-items', invoices?.[0]?.sales_order_id],
    enabled: !!invoices?.[0]?.sales_order_id,
    queryFn: () => base44.entities.SalesOrderItem.filter({ sales_order_id: invoices[0].sales_order_id }),
  });

  const ourItems = soItems.length > 0 ? soItems : invoiceItems;

  if (!grn) return null;

  // Build comparison: match GRN items to our items by description
  const reconciled = (grn.items || []).map(grnItem => {
    const match = ourItems.find(oi =>
      oi.description?.toLowerCase().includes(grnItem.description?.toLowerCase()?.substring(0, 15)) ||
      oi.item_code === grnItem.sku_code
    );
    const qtyDiff = (grnItem.grn_qty || 0) - (match?.quantity || grnItem.exp_qty || 0);
    const hasQtyIssue = Math.abs(qtyDiff) > 0;
    return { ...grnItem, our_qty: match?.quantity || grnItem.exp_qty || 0, our_price: match?.unit_base_cost || grnItem.unit_price, qty_diff: qtyDiff, has_issue: hasQtyIssue };
  });

  const handleIssueCreditNote = async () => {
    if (!creditNoteNumber || !creditNoteAmount) {
      toast({ title: 'Credit note number and amount are required.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    await base44.entities.CustomerGRN.update(grn.id, {
      our_credit_note_number: creditNoteNumber,
      our_credit_note_amount: Number(creditNoteAmount),
      our_credit_note_date: creditNoteDate,
      status: 'credit_note_issued',
    });

    // Also update the SalesInvoice if linked
    if (grn.invoice_id) {
      await base44.entities.SalesInvoice.update(grn.invoice_id, {
        credit_note_number: creditNoteNumber,
        credit_note_amount: Number(creditNoteAmount),
      });
    }

    toast({ title: 'Credit note issued and recorded successfully.' });
    onUpdated?.();
    setSaving(false);
  };

  const handleMarkMatched = async () => {
    setSaving(true);
    await base44.entities.CustomerGRN.update(grn.id, { status: 'matched' });
    toast({ title: 'GRN marked as fully matched.' });
    onUpdated?.();
    setSaving(false);
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full md:min-w-[700px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            GRN Reconciliation
            <StatusBadge status={grn.status} />
          </SheetTitle>
        </SheetHeader>

        {/* Header info */}
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm border border-slate-200 rounded-lg p-3 bg-slate-50">
          {[['GRN Number', grn.grn_number], ['Platform', grn.platform?.toUpperCase()], ['Invoice Number', grn.invoice_number], ['GRN Date', grn.grn_date], ['Purchase Order', grn.po_number], ['Warehouse', grn.warehouse_location]].map(([k, v]) => (
            <div key={k}>
              <span className="text-slate-500 text-xs">{k}</span>
              <p className="font-medium text-slate-800">{v || '—'}</p>
            </div>
          ))}
        </div>

        {/* Amount summary */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
            <p className="text-xs text-blue-600">Our Invoice Amount</p>
            <p className="font-bold text-blue-800">₹{(grn.invoice_total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-center">
            <p className="text-xs text-green-600">GRN Accepted Amount</p>
            <p className="font-bold text-green-800">₹{(grn.grn_total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          </div>
          {grn.dn_amount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
              <p className="text-xs text-red-600">Debit Note Amount</p>
              <p className="font-bold text-red-800">₹{(grn.dn_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              {grn.dn_number && <p className="text-xs text-red-500 mt-0.5">{grn.dn_number}</p>}
            </div>
          )}
        </div>

        {/* Line item comparison */}
        <div className="mt-4">
          <p className="text-sm font-semibold text-slate-700 mb-2">Line-by-Line Reconciliation</p>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="text-left px-3 py-2">Product</th>
                  <th className="text-center px-2 py-2">Our Qty</th>
                  <th className="text-center px-2 py-2">GRN Qty</th>
                  <th className="text-center px-2 py-2">Diff</th>
                  <th className="text-center px-2 py-2">Debit Qty</th>
                  <th className="text-right px-3 py-2">GRN Amount</th>
                  <th className="px-2 py-2">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reconciled.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-slate-400 py-6">No line items recorded</td></tr>
                )}
                {reconciled.map((item, idx) => (
                  <tr key={idx} className={item.has_issue ? 'bg-red-50' : 'hover:bg-slate-50'}>
                    <td className="px-3 py-2">
                      <div className="flex items-start gap-1">
                        {item.has_issue && <AlertTriangle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />}
                        <div>
                          <p className="font-medium text-slate-800 leading-tight">{item.description}</p>
                          {item.sku_code && <p className="text-slate-400">{item.sku_code}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="text-center px-2 py-2 text-slate-700">{item.our_qty}</td>
                    <td className="text-center px-2 py-2 text-slate-700">{item.grn_qty}</td>
                    <td className={`text-center px-2 py-2 font-semibold ${item.qty_diff < 0 ? 'text-red-600' : item.qty_diff > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                      {item.qty_diff > 0 ? '+' : ''}{item.qty_diff || '—'}
                    </td>
                    <td className="text-center px-2 py-2 text-red-600 font-medium">{item.dn_qty || '—'}</td>
                    <td className="text-right px-3 py-2 text-slate-700">₹{(item.total_amount || 0).toFixed(2)}</td>
                    <td className="px-2 py-2 text-slate-500 max-w-[120px]">{item.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Credit Note Issuance */}
        {grn.status !== 'credit_note_issued' && grn.status !== 'closed' && grn.status !== 'matched' && (
          <div className="mt-4 border border-blue-200 bg-blue-50 rounded-lg p-4">
            <p className="text-sm font-semibold text-blue-800 mb-3">Issue Credit Note</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-700">Our Credit Note Number</Label>
                <Input className="h-9 text-sm mt-1" value={creditNoteNumber} onChange={e => setCreditNoteNumber(e.target.value)} placeholder="e.g. CN/25-26/001" />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Amount (INR)</Label>
                <Input className="h-9 text-sm mt-1" type="number" value={creditNoteAmount} onChange={e => setCreditNoteAmount(e.target.value)} placeholder={grn.dn_amount || ''} />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Date</Label>
                <Input className="h-9 text-sm mt-1" type="date" value={creditNoteDate} onChange={e => setCreditNoteDate(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleIssueCreditNote} disabled={saving} className="mt-3 h-10 w-full">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Issue Credit Note
            </Button>
          </div>
        )}

        {/* Already issued */}
        {grn.status === 'credit_note_issued' && (
          <div className="mt-4 border border-green-200 bg-green-50 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm font-semibold text-green-800">Credit Note Issued</p>
              <p className="text-xs text-green-700">Number: {grn.our_credit_note_number} · Amount: ₹{grn.our_credit_note_amount} · Date: {grn.our_credit_note_date}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex gap-3">
          {grn.status === 'pending_match' && (
            <Button variant="outline" onClick={handleMarkMatched} disabled={saving} className="h-11 flex-1">
              Mark as Fully Matched (No Discrepancy)
            </Button>
          )}
          {grn.grn_pdf_url && (
            <Button variant="outline" className="h-11" onClick={() => window.open(grn.grn_pdf_url, '_blank')}>
              <FileText className="w-4 h-4 mr-2" /> View GRN PDF
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}