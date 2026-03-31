import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { AlertTriangle, CheckCircle, Loader2, FileText, X, ShieldAlert, Upload, PackageCheck } from 'lucide-react';

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
  const [uploadingDN, setUploadingDN] = useState(false);
  const [uploadingPOD, setUploadingPOD] = useState(false);
  const [creditNoteNumber, setCreditNoteNumber] = useState('');
  const [creditNoteAmount, setCreditNoteAmount] = useState('');
  const [creditNoteDate, setCreditNoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [dnNumber, setDnNumber] = useState('');
  const [dnDate, setDnDate] = useState('');
  const [dnAmount, setDnAmount] = useState('');

  const { data: matchedInvoices = [] } = useQuery({
    queryKey: ['grn-invoice-lookup', grn?.invoice_number, grn?.id],
    enabled: !!grn?.invoice_number,
    queryFn: () => base44.entities.SalesInvoice.filter({ invoice_number: grn.invoice_number }),
  });

  const { data: invoiceById = [] } = useQuery({
    queryKey: ['grn-invoice-by-id', grn?.invoice_id],
    enabled: !!grn?.invoice_id && matchedInvoices.length === 0,
    queryFn: () => base44.entities.SalesInvoice.filter({ id: grn.invoice_id }),
  });

  const invoice = matchedInvoices[0] || invoiceById[0];

  const { data: salesOrders = [] } = useQuery({
    queryKey: ['grn-so-lookup', invoice?.sales_order_id, grn?.id],
    enabled: !!invoice?.sales_order_id,
    queryFn: () => base44.entities.SalesOrder.filter({ id: invoice.sales_order_id }),
  });
  const salesOrder = salesOrders[0];

  const { data: soItems = [] } = useQuery({
    queryKey: ['grn-so-items-preview', invoice?.sales_order_id],
    enabled: !!invoice?.sales_order_id,
    queryFn: () => base44.entities.SalesOrderItem.filter({ sales_order_id: invoice.sales_order_id }),
  });

  if (!open || !grn) return null;

  // Platform-aware label for the discrepancy document
  const isZepto = grn.platform === 'zepto';
  const discrepancyDocLabel = isZepto ? 'Quantity Difference Note' : 'Debit Note';

  const ourInvoiceAmount = invoice?.total_amount || grn.invoice_total_amount || 0;
  const grnAmount = grn.grn_total_amount || 0;
  const discrepancyAmount = ourInvoiceAmount - grnAmount;
  const discrepancyPct = ourInvoiceAmount > 0 ? Math.abs(discrepancyAmount / ourInvoiceAmount) * 100 : 0;
  const needsManagementReview = discrepancyPct > 1;
  const hasDiscrepancy = Math.abs(discrepancyAmount) > 0.01;

  // Document state
  const hasDNOnRecord = grn.dn_number || grn.dn_amount > 0;
  const hasDNDocs = grn.discrepancy_pdf_url;
  const hasPOD = !!grn.pod_url;

  // Step 1: Match each GRN line to an SO item
  // Priority: exact sku_code > exact item_code > full description equality > partial (last resort)
  const reconciledGrnItems = (grn.items || []).map(grnItem => {
    const grnDesc = grnItem.description?.toLowerCase().trim();
    const grnSku = grnItem.sku_code?.trim();
    const match =
      soItems.find(oi => grnSku && oi.sku_code?.trim() === grnSku) ||
      soItems.find(oi => grnSku && oi.item_code?.trim() === grnSku) ||
      soItems.find(oi => grnDesc && oi.description?.toLowerCase().trim() === grnDesc) ||
      soItems.find(oi => grnDesc && grnDesc.length > 25 && oi.description?.toLowerCase().trim().includes(grnDesc.substring(0, 30)));
    
    const expectedQty = match?.quantity || grnItem.exp_qty || 0;
    const qtyDiff = (grnItem.grn_qty || 0) - expectedQty;
    return {
      ...grnItem,
      _soItemId: match?.id,
      our_qty: expectedQty,
      our_price: match?.unit_base_cost || grnItem.unit_price,
      qty_diff: qtyDiff,
      has_issue: Math.abs(qtyDiff) > 0,
      _missing: false,
    };
  });

  // Step 2: Find SO items completely absent from the GRN — these are fully short
  const matchedSoIds = new Set(reconciledGrnItems.map(r => r._soItemId).filter(Boolean));
  const missingFromGrn = soItems
    .filter(oi => !matchedSoIds.has(oi.id))
    .map(oi => ({
      sku_code: oi.sku_code || oi.item_code,
      description: oi.description,
      our_qty: oi.quantity || 0,
      grn_qty: 0,
      qty_diff: -(oi.quantity || 0),
      has_issue: true,
      our_price: oi.unit_base_cost,
      unit_price: oi.unit_base_cost,
      total_amount: 0,
      dn_qty: null,
      _missing: true,
    }));

  const reconciled = [...reconciledGrnItems, ...missingFromGrn];

  // Totals
  const totalExpQty = reconciled.reduce((s, i) => s + (i.our_qty || 0), 0);
  const totalGrnQty = reconciledGrnItems.reduce((s, i) => s + (i.grn_qty || 0), 0);
  // Bottle shortfall = sum of all negative differences (including completely missing SKUs)
  const bottleShortfall = reconciled.reduce((s, i) => s + (i.qty_diff < 0 ? Math.abs(i.qty_diff) : 0), 0);

  const handleUploadPOD = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPOD(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.CustomerGRN.update(grn.id, { pod_url: file_url });
      toast({ title: 'Proof of Delivery uploaded successfully.' });
      onUpdated?.();
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingPOD(false);
    }
  };

  const handleUploadDebitNote = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDN(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const rawText = await base44.integrations.Core.InvokeLLM({
        prompt: 'Return ONLY the raw text content of this document exactly as it appears. No interpretation.',
        file_urls: [file_url],
      });

      const text = typeof rawText === 'string' ? rawText : JSON.stringify(rawText);
      const noteMatch = text.match(/Note#\s*(\S+)/i) || text.match(/Debit Note no:\s*(\S+)/i);
      const dateMatch = text.match(/Date\s*:\s*([\d]{1,2}[\/\-][\d]{1,2}[\/\-][\d]{4})/i);
      const amtMatch = text.match(/Grand Total[\s\u20b9]+([\.\d,]+)/i) || text.match(/\bTotal\b[\s\u20b9]+([\.\d,]+)/i);

      if (noteMatch) setDnNumber(noteMatch[1]);
      if (dateMatch) {
        const parts = dateMatch[1].split(/[\/\-]/);
        if (parts[0].length <= 2) setDnDate(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`);
      }
      if (amtMatch) setDnAmount(amtMatch[1].replace(/,/g, ''));

      await base44.entities.CustomerGRN.update(grn.id, { discrepancy_pdf_url: file_url });
      toast({ title: `${discrepancyDocLabel} PDF uploaded`, description: 'Fill in details below and save.' });
      onUpdated?.();
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingDN(false);
    }
  };

  const handleSaveDebitNote = async () => {
    if (!dnNumber || !dnAmount) {
      toast({ title: 'Debit note number and amount are required.', variant: 'destructive' }); return;
    }
    setSaving(true);
    await base44.entities.CustomerGRN.update(grn.id, {
      dn_number: dnNumber,
      dn_date: dnDate,
      dn_amount: Number(dnAmount),
      status: 'discrepancy_identified',
    });
    toast({ title: 'Debit note details saved.' });
    onUpdated?.();
    setSaving(false);
  };

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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-end" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
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

            {/* Amount + Qty comparison */}
            <div className={`rounded-lg p-3 border ${needsManagementReview ? 'bg-red-50 border-red-300' : hasDiscrepancy ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-xs text-blue-600">Our Invoice Amount</p>
                  <p className="font-bold text-blue-800 text-sm">₹{ourInvoiceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                  {totalExpQty > 0 && <p className="text-xs text-blue-500 mt-0.5">{totalExpQty} bottles ordered</p>}
                </div>
                <div className="text-center">
                  <p className="text-xs text-green-600">GRN Accepted Amount</p>
                  <p className="font-bold text-green-800 text-sm">₹{grnAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                  {totalGrnQty > 0 && <p className="text-xs text-green-500 mt-0.5">{totalGrnQty} bottles received</p>}
                </div>
                <div className="text-center">
                  <p className={`text-xs ${needsManagementReview ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                    Discrepancy {needsManagementReview ? '⚠ >1%' : ''}
                  </p>
                  <p className={`font-bold text-sm ${needsManagementReview ? 'text-red-700' : hasDiscrepancy ? 'text-amber-700' : 'text-green-700'}`}>
                    ₹{Math.abs(discrepancyAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                  <p className={`text-xs mt-0.5 ${needsManagementReview ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
                    {discrepancyPct.toFixed(2)}% of invoice
                  </p>
                  {bottleShortfall > 0 && (
                    <p className="text-xs mt-0.5 text-amber-700 font-medium">
                      {bottleShortfall} bottle{bottleShortfall !== 1 ? 's' : ''} short
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Management Review Banner — enhanced with qty and weight info */}
            {needsManagementReview && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-1">
                <div className="flex items-center gap-2 text-red-700">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-semibold">Discrepancy exceeds 1% of invoice value. This GRN has been flagged for management review.</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-red-700 bg-red-100 rounded p-2">
                  <div>
                    <span className="text-red-500 block">Amount Short</span>
                    <span className="font-bold">₹{Math.abs(discrepancyAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div>
                    <span className="text-red-500 block">Bottles Short</span>
                    <span className="font-bold">{bottleShortfall} bottle{bottleShortfall !== 1 ? 's' : ''}</span>
                  </div>
                  <div>
                    <span className="text-red-500 block">Discrepancy %</span>
                    <span className="font-bold">{discrepancyPct.toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Existing debit note on record */}
            {hasDNOnRecord && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
                <p className="font-semibold text-orange-800">Debit Note on Record: {grn.dn_number}</p>
                <p className="text-orange-700 text-xs mt-0.5">Amount: ₹{(grn.dn_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} · Date: {grn.dn_date || '—'}</p>
              </div>
            )}

            {/* POD Upload — mandatory when discrepancy exists */}
            {hasDiscrepancy && !['closed'].includes(grn.status) && (
              <div className={`border rounded-lg p-4 space-y-2 ${hasPOD ? 'border-green-200 bg-green-50' : 'border-red-300 bg-red-50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PackageCheck className={`w-4 h-4 ${hasPOD ? 'text-green-600' : 'text-red-600'}`} />
                    <p className={`text-sm font-semibold ${hasPOD ? 'text-green-800' : 'text-red-800'}`}>
                      Proof of Delivery (POD) {!hasPOD && <span className="text-xs font-normal ml-1">— Required before issuing credit note</span>}
                    </p>
                  </div>
                  {!hasPOD ? (
                    <label className="cursor-pointer">
                      {uploadingPOD
                        ? <span className="flex items-center gap-1 text-xs text-red-600"><Loader2 className="w-3 h-3 animate-spin" />Uploading...</span>
                        : <span className="flex items-center gap-1 text-xs bg-white border border-red-300 text-red-700 px-3 py-1.5 rounded hover:bg-red-50 transition-colors">
                            <Upload className="w-3 h-3" /> Upload POD PDF
                          </span>
                      }
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleUploadPOD} />
                    </label>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={() => window.open(grn.pod_url, '_blank')} className="text-xs text-green-700 underline">View POD</button>
                      <label className="cursor-pointer text-xs text-slate-500 underline">
                        Replace
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleUploadPOD} />
                      </label>
                    </div>
                  )}
                </div>
                {hasPOD && <p className="text-xs text-green-700">POD uploaded — you may now proceed to issue a credit note.</p>}
              </div>
            )}

            {/* Discrepancy / Quantity Difference Note */}
            {hasDiscrepancy && !['credit_note_issued', 'closed', 'matched'].includes(grn.status) && (
              <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-amber-800">{discrepancyDocLabel}</p>
                  <label className="cursor-pointer">
                    {uploadingDN
                      ? <span className="flex items-center gap-1 text-xs text-amber-600"><Loader2 className="w-3 h-3 animate-spin" />Parsing PDF...</span>
                      : <span className="flex items-center gap-1 text-xs bg-amber-100 border border-amber-300 text-amber-800 px-3 py-1.5 rounded hover:bg-amber-200 transition-colors">
                          <Upload className="w-3 h-3" /> Upload {discrepancyDocLabel} PDF (auto-fill)
                        </span>
                    }
                    <input type="file" accept=".pdf" className="hidden" onChange={handleUploadDebitNote} />
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-slate-700">{discrepancyDocLabel} Number</Label>
                    <Input className="h-9 text-sm mt-1" value={dnNumber || grn.dn_number || ''} onChange={e => setDnNumber(e.target.value)} placeholder="e.g. 25-26/004352_QD" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Date</Label>
                    <Input className="h-9 text-sm mt-1" type="date" value={dnDate || grn.dn_date || ''} onChange={e => setDnDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Amount (INR)</Label>
                    <Input className="h-9 text-sm mt-1" type="number" value={dnAmount || grn.dn_amount || ''} onChange={e => setDnAmount(e.target.value)} />
                  </div>
                </div>
                {!hasDNOnRecord && (
                  <Button onClick={handleSaveDebitNote} disabled={saving} className="h-10 w-full">
                    {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Save {discrepancyDocLabel} Details
                  </Button>
                )}
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
                      <th className="text-center px-2 py-2">Goods Receipt Qty</th>
                      <th className="text-center px-2 py-2">Difference</th>
                      <th className="text-center px-2 py-2">Discrepancy Qty</th>
                      <th className="text-right px-3 py-2">Goods Receipt Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reconciled.length === 0 && (
                      <tr><td colSpan={6} className="text-center text-slate-400 py-6">No line items recorded</td></tr>
                    )}
                    {reconciled.map((item, idx) => (
                      <tr key={idx} className={item._missing ? 'bg-red-100' : item.has_issue ? 'bg-red-50' : 'hover:bg-slate-50'}>
                        <td className="px-3 py-2">
                          <div className="flex items-start gap-1">
                            {item.has_issue && <AlertTriangle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />}
                            <div>
                              <p className="font-medium text-slate-800 leading-tight">{item.description}</p>
                              {item.sku_code && <p className="text-slate-400">{item.sku_code}</p>}
                              {item._missing && (
                                <span className="inline-block mt-0.5 text-xs font-semibold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">Not received in Goods Receipt</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="text-center px-2 py-2 text-slate-700">{item.our_qty}</td>
                        <td className={`text-center px-2 py-2 font-semibold ${item._missing ? 'text-red-600' : 'text-slate-700'}`}>{item._missing ? '0' : item.grn_qty}</td>
                        <td className={`text-center px-2 py-2 font-semibold ${item.qty_diff < 0 ? 'text-red-600' : item.qty_diff > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                          {item.qty_diff > 0 ? '+' : ''}{item.qty_diff !== 0 ? item.qty_diff : '—'}
                        </td>
                        <td className="text-center px-2 py-2 text-red-600 font-medium">{item.dn_qty || '—'}</td>
                        <td className="text-right px-3 py-2 text-slate-700">{item._missing ? '—' : `₹${(item.total_amount || 0).toFixed(2)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Issue Credit Note — only shown when debit note docs AND POD are uploaded */}
            {hasDNDocs && hasDNOnRecord && hasPOD && !['credit_note_issued', 'closed', 'matched'].includes(grn.status) && (
              <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                <p className="text-sm font-semibold text-blue-800 mb-3">Issue Credit Note</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Our Credit Note Number</Label>
                    <Input className="h-9 text-sm mt-1" value={creditNoteNumber} onChange={e => setCreditNoteNumber(e.target.value)} placeholder="e.g. CN/25-26/001" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Amount (INR)</Label>
                    <Input className="h-9 text-sm mt-1" type="number" value={creditNoteAmount} onChange={e => setCreditNoteAmount(e.target.value)} placeholder={grn.dn_amount?.toString() || ''} />
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

            {/* Show message if debit note not yet uploaded */}
            {hasDiscrepancy && hasDNOnRecord && !hasDNDocs && !['credit_note_issued', 'closed', 'matched'].includes(grn.status) && (
              <div className="border border-slate-200 bg-slate-50 rounded-lg p-3 text-sm text-slate-500 text-center">
                Upload the {discrepancyDocLabel} PDF above to proceed with Credit Note issuance.
              </div>
            )}
            {hasDiscrepancy && hasDNDocs && hasDNOnRecord && !hasPOD && !['credit_note_issued', 'closed', 'matched'].includes(grn.status) && (
              <div className="border border-red-200 bg-red-50 rounded-lg p-3 text-sm text-red-600 text-center">
                Please upload the Proof of Delivery (POD) above before issuing a Credit Note.
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
              {/* Mark as Fully Matched: only shown if NO discrepancy */}
              {!hasDiscrepancy && grn.status === 'pending_match' && (
                <Button variant="outline" onClick={handleMarkMatched} disabled={saving} className="h-11 flex-1">
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Mark as Fully Matched (No Discrepancy)
                </Button>
              )}
              {grn.grn_pdf_url && (
                <Button variant="outline" className="h-11" onClick={() => window.open(grn.grn_pdf_url, '_blank')}>
                  <FileText className="w-4 h-4 mr-2" /> View Goods Receipt PDF
                </Button>
              )}
              {grn.pod_url && (
                <Button variant="outline" className="h-11" onClick={() => window.open(grn.pod_url, '_blank')}>
                  <PackageCheck className="w-4 h-4 mr-2" /> View POD
                </Button>
              )}
              {grn.discrepancy_pdf_url && (
                <Button variant="outline" className="h-11" onClick={() => window.open(grn.discrepancy_pdf_url, '_blank')}>
                  <FileText className="w-4 h-4 mr-2" /> View {discrepancyDocLabel} PDF
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}