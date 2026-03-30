import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { AlertTriangle, CheckCircle, Loader2, FileText, X, ShieldAlert } from 'lucide-react';

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
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [creditNoteNumber, setCreditNoteNumber] = useState('');
  const [creditNoteAmount, setCreditNoteAmount] = useState('');
  const [creditNoteDate, setCreditNoteDate] = useState(new Date().toISOString().split('T')[0]);

  // Fetch the actual invoice to get real amounts and SO reference
  const { data: matchedInvoices = [] } = useQuery({
    queryKey: ['grn-invoice-lookup', grn?.invoice_number, grn?.id],
    enabled: !!grn?.invoice_number,
    queryFn: () => base44.entities.SalesInvoice.filter({ invoice_number: grn.invoice_number }),
  });

  // Also try by invoice_id if available
  const { data: invoiceById = [] } = useQuery({
    queryKey: ['grn-invoice-by-id', grn?.invoice_id],
    enabled: !!grn?.invoice_id && matchedInvoices.length === 0,
    queryFn: () => base44.entities.SalesInvoice.filter({ id: grn.invoice_id }),
  });

  const invoice = matchedInvoices[0] || invoiceById[0];

  // Fetch SO
  const { data: salesOrders = [] } = useQuery({
    queryKey: ['grn-so-lookup', invoice?.sales_order_id, grn?.id],
    enabled: !!invoice?.sales_order_id,
    queryFn: () => base44.entities.SalesOrder.filter({ id: invoice.sales_order_id }),
  });
  const salesOrder = salesOrders[0];

  // Fetch SO items for the preview
  const { data: soItems = [] } = useQuery({
    queryKey: ['grn-so-items-preview', invoice?.sales_order_id],
    enabled: !!invoice?.sales_order_id,
    queryFn: () => base44.entities.SalesOrderItem.filter({ sales_order_id: invoice.sales_order_id }),
  });

  if (!open || !grn) return null;

  // Use actual invoice amount from linked invoice, fallback to grn.invoice_total_amount
  const ourInvoiceAmount = invoice?.total_amount || grn.invoice_total_amount || 0;
  const grnAmount = grn.grn_total_amount || 0;
  const discrepancyAmount = ourInvoiceAmount - grnAmount;
  const discrepancyPct = ourInvoiceAmount > 0 ? Math.abs(discrepancyAmount / ourInvoiceAmount) * 100 : 0;
  const needsManagementReview = discrepancyPct > 1;

  // Build comparison
  const reconciled = (grn.items || []).map(grnItem => {
    const match = soItems.find(oi =>
      oi.description?.toLowerCase().includes(grnItem.description?.toLowerCase()?.substring(0, 15)) ||
      oi.item_code === grnItem.sku_code
    );
    const expectedQty = match?.quantity || grnItem.exp_qty || 0;
    const qtyDiff = (grnItem.grn_qty || 0) - expectedQty;
    return {
      ...grnItem,
      our_qty: expectedQty,
      our_price: match?.unit_base_cost || grnItem.unit_price,
      qty_diff: qtyDiff,
      has_issue: Math.abs(qtyDiff) > 0,
    };
  });

  const handleIssueCreditNote = async () => {
    if (!creditNoteNumber || !creditNoteAmount) {
      toast({ title: 'Credit note number and amount are required.', variant: 'destructive' }); return;
    }
    setSaving(true);
    await base44.entities.CustomerGRN.update(grn.id, {
      our_credit_note_number: creditNoteNumber,
      our_credit_note_amount: Number(creditNoteAmount),
      our_credit_note_date: creditNoteDate,
      status: 'credit_note_issued',
    });
    if (invoice?.id) {
      await base44.entities.SalesInvoice.update(invoice.id, {
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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-end">
      <div className="h-full w-full max-w-6xl bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-900">GRN Reconciliation — {grn.grn_number}</h2>
            <StatusBadge status={grn.status} />
            {needsManagementReview && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                <ShieldAlert className="w-3 h-3" /> Management Review Required
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Split layout */}
        <div className="flex-1 overflow-hidden flex">
          {/* LEFT: Sales Order Preview */}
          <div className="w-2/5 border-r border-slate-200 overflow-y-auto bg-slate-50 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sales Order Reference</p>
            {!salesOrder ? (
              <div className="text-sm text-slate-400 p-4 text-center bg-white border border-slate-200 rounded-lg">
                {invoice ? 'Loading sales order...' : 'No linked invoice found'}
              </div>
            ) : (
              <>
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
                  {[
                    ['Sales Order', salesOrder.so_number],
                    ['Customer', salesOrder.customer_name],
                    ['PO Number', salesOrder.po_number || '—'],
                    ['Status', salesOrder.status],
                    ['Platform', salesOrder.platform?.toUpperCase() || '—'],
                    ['Payment Terms', salesOrder.payment_terms || '—'],
                    ['Invoice Number', invoice?.invoice_number || '—'],
                    ['Invoice Date', invoice?.invoice_date || '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <span className="text-slate-500 shrink-0">{k}</span>
                      <span className="font-medium text-slate-800 text-right">{v}</span>
                    </div>
                  ))}
                </div>

                {/* SO Items */}
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-2">Order Items</p>
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="text-left px-3 py-2">Product</th>
                        <th className="text-center px-2 py-2">Qty</th>
                        <th className="text-right px-3 py-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {soItems.length === 0 && (
                        <tr><td colSpan={3} className="text-center py-4 text-slate-400">No items</td></tr>
                      )}
                      {soItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-3 py-2">
                            <p className="font-medium text-slate-800 leading-tight">{item.description}</p>
                            {item.item_code && <p className="text-slate-400">{item.item_code}</p>}
                          </td>
                          <td className="text-center px-2 py-2 text-slate-700">{item.quantity}</td>
                          <td className="text-right px-3 py-2 text-slate-700">₹{(item.total_amount || 0).toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Invoice total */}
                <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Invoice Taxable</span>
                    <span className="font-medium">₹{(invoice?.taxable_amount || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tax</span>
                    <span className="font-medium">₹{(invoice?.tax_amount || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 font-semibold text-slate-900">
                    <span>Invoice Total</span>
                    <span>₹{ourInvoiceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* RIGHT: GRN Details */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">GRN Details</p>

            {/* GRN meta */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm border border-slate-200 rounded-lg p-3 bg-slate-50">
              {[
                ['GRN Number', grn.grn_number],
                ['Platform', grn.platform?.toUpperCase()],
                ['Invoice Number', grn.invoice_number],
                ['GRN Date', grn.grn_date],
                ['Purchase Order', grn.po_number || '—'],
                ['Warehouse', grn.warehouse_location || '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <span className="text-slate-500 text-xs">{k}</span>
                  <p className="font-medium text-slate-800">{v || '—'}</p>
                </div>
              ))}
            </div>

            {/* Amount comparison — highlight if >1% discrepancy */}
            <div className={`grid grid-cols-3 gap-2 rounded-lg p-3 border ${needsManagementReview ? 'bg-red-50 border-red-300' : 'bg-white border-slate-200'}`}>
              <div className="text-center">
                <p className="text-xs text-blue-600">Our Invoice Amount</p>
                <p className="font-bold text-blue-800 text-sm">₹{ourInvoiceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                {invoice?.invoice_number && <p className="text-xs text-slate-400 mt-0.5">{invoice.invoice_number}</p>}
                {salesOrder?.so_number && <p className="text-xs text-slate-400">{salesOrder.so_number}</p>}
                {salesOrder?.po_number && <p className="text-xs text-slate-400">PO: {salesOrder.po_number}</p>}
              </div>
              <div className="text-center">
                <p className="text-xs text-green-600">GRN Accepted Amount</p>
                <p className="font-bold text-green-800 text-sm">₹{grnAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="text-center">
                <p className={`text-xs ${needsManagementReview ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                  Discrepancy {needsManagementReview ? '⚠ >1%' : ''}
                </p>
                <p className={`font-bold text-sm ${needsManagementReview ? 'text-red-700' : 'text-slate-700'}`}>
                  ₹{Math.abs(discrepancyAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
                <p className={`text-xs mt-0.5 ${needsManagementReview ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
                  {discrepancyPct.toFixed(2)}%
                </p>
              </div>
            </div>

            {needsManagementReview && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Discrepancy exceeds 1% of invoice value. This GRN has been flagged for management review.</span>
              </div>
            )}

            {/* Debit note if any */}
            {grn.dn_amount > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
                <p className="font-semibold text-orange-800">Debit Note: {grn.dn_number}</p>
                <p className="text-orange-700">Amount: ₹{(grn.dn_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })} · Date: {grn.dn_date || '—'}</p>
              </div>
            )}

            {/* Line item comparison */}
            <div>
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
                        <td className="px-2 py-2 text-slate-500 max-w-[100px]">{item.reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Credit Note Issuance */}
            {!['credit_note_issued', 'closed', 'matched'].includes(grn.status) && (
              <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
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
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Issue Credit Note
                </Button>
              </div>
            )}

            {grn.status === 'credit_note_issued' && (
              <div className="border border-green-200 bg-green-50 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-semibold text-green-800">Credit Note Issued</p>
                  <p className="text-xs text-green-700">Number: {grn.our_credit_note_number} · Amount: ₹{grn.our_credit_note_amount} · Date: {grn.our_credit_note_date}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pb-4">
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
          </div>
        </div>
      </div>
    </div>
  );
}