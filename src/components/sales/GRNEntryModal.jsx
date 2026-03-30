import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Upload, Loader2, Plus, Trash2 } from 'lucide-react';

const PLATFORMS = [
  { value: 'swiggy', label: 'Swiggy (Scootsy)' },
  { value: 'zepto', label: 'Zepto' },
  { value: 'blinkit', label: 'Blinkit' },
  { value: 'other', label: 'Other' },
];

const DEFAULT_ITEM = { sku_code: '', description: '', mrp: '', exp_qty: '', grn_qty: '', unit_price: '', taxable_value: '', igst_amount: '', total_amount: '', dn_qty: '', reason: '' };

// ── Scootsy GRN text parser (regex, no AI) ─────────────────────────────────
function parseScootsyGRN(text) {
  const grab = (pattern) => {
    const m = text.match(pattern);
    return m ? m[1].trim() : '';
  };
  return {
    po_number:       grab(/PO\s*No\s*[:\-]+\s*([^\n\r]+)/i),
    grn_number:      grab(/GRN\s*No\s*[:\-]+\s*([^\n\r]+)/i),
    grn_date:        grab(/GRN\s*Date\s*[:\-]+\s*([^\n\r]+)/i),
    inbound_number:  grab(/Inbound\s*No\s*[:\-]+\s*([^\n\r]+)/i),
    invoice_number:  grab(/Invoice\s*No\s*[:\-]+\s*([^\n\r]+)/i),
    customer_name:   'SCOOTSY LOGISTICS PRIVATE LIMITED',
  };
}

export default function GRNEntryModal({ open, onClose, onSaved, invoices = [] }) {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const { toast } = useToast();

  // Fetch all SalesOrders so we can do PO → SO → Invoice lookup
  const { data: allSalesOrders = [] } = useQuery({
    queryKey: ['grn-entry-sales-orders'],
    queryFn: () => base44.entities.SalesOrder.list('-created_date', 500),
    staleTime: 60000,
  });

  const [form, setForm] = useState({
    platform: 'swiggy', grn_number: '', grn_date: '', po_number: '', asn_number: '',
    inbound_number: '', invoice_id: '', invoice_number: '', customer_name: 'SCOOTSY LOGISTICS PRIVATE LIMITED',
    warehouse_location: '', grn_total_qty: '', grn_total_amount: '', invoice_total_amount: '',
    dn_number: '', dn_date: '', dn_amount: '', email_subject: '', notes: '',
    items: [{ ...DEFAULT_ITEM }],
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // PO Number → SalesOrder → SalesInvoice lookup
  const lookupInvoiceByPO = async (poNumber) => {
    if (!poNumber) return null;
    const so = allSalesOrders.find(s => s.po_number?.trim().toUpperCase() === poNumber.trim().toUpperCase());
    if (!so) return null;
    const linked = await base44.entities.SalesInvoice.filter({ sales_order_id: so.id });
    return linked?.[0] || null;
  };

  const handleInvoiceSelect = (invoiceId) => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) return;
    setForm(p => ({
      ...p,
      invoice_id: invoiceId,
      invoice_number: inv.invoice_number,
      invoice_total_amount: inv.total_amount || p.invoice_total_amount,
      customer_name: p.customer_name || inv.customer_name,
    }));
  };

  const handlePDFUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setExtracting(true);
      setUploading(false);

      // Step 1: Extract raw text from PDF (no interpretation)
      const rawText = await base44.integrations.Core.InvokeLLM({
        prompt: `Return ONLY the raw text content of this document exactly as it appears. Do not interpret, summarise or change anything. Just return the plain text.`,
        file_urls: [file_url],
      });

      // Step 2: Parse using regex against known Scootsy GRN format
      const parsed = parseScootsyGRN(typeof rawText === 'string' ? rawText : JSON.stringify(rawText));

      // Step 3: Look up invoice via PO Number → Sales Order → Sales Invoice
      let linkedInvoice = null;
      if (parsed.po_number) {
        linkedInvoice = await lookupInvoiceByPO(parsed.po_number);
      }
      // Fallback: match by invoice_number directly
      if (!linkedInvoice && parsed.invoice_number) {
        linkedInvoice = invoices.find(i => i.invoice_number?.trim() === parsed.invoice_number?.trim()) || null;
      }

      setForm(p => ({
        ...p,
        grn_number:          parsed.grn_number      || p.grn_number,
        grn_date:            parsed.grn_date        || p.grn_date,
        po_number:           parsed.po_number       || p.po_number,
        inbound_number:      parsed.inbound_number  || p.inbound_number,
        invoice_number:      parsed.invoice_number  || (linkedInvoice?.invoice_number) || p.invoice_number,
        customer_name:       parsed.customer_name   || p.customer_name,
        invoice_id:          linkedInvoice?.id      || p.invoice_id,
        invoice_total_amount: linkedInvoice?.total_amount || p.invoice_total_amount,
        grn_pdf_url: file_url,
      }));

      const matchMsg = linkedInvoice
        ? `Matched to Invoice ${linkedInvoice.invoice_number} (₹${(linkedInvoice.total_amount || 0).toLocaleString('en-IN')})`
        : parsed.po_number ? `PO ${parsed.po_number} — no matching Sales Order found. Please link invoice manually.` : 'Could not match invoice. Please link manually.';

      toast({ title: 'GRN data extracted', description: matchMsg });
    } catch (err) {
      toast({ title: 'Extraction failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      setExtracting(false);
    }
  };

  const updateItem = (idx, k, v) => {
    setForm(p => {
      const items = [...p.items];
      items[idx] = { ...items[idx], [k]: v };
      return { ...p, items };
    });
  };

  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { ...DEFAULT_ITEM }] }));
  const removeItem = (idx) => setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const handleSave = async () => {
    if (!form.platform || !form.grn_number || !form.invoice_number) {
      toast({ title: 'Missing required fields', description: 'Platform, GRN Number and Invoice Number are required.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const totalQty = form.items.reduce((s, i) => s + (Number(i.grn_qty) || 0), 0);
    const totalAmt = form.items.reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
    const payload = {
      ...form,
      grn_total_qty: totalQty || Number(form.grn_total_qty) || 0,
      grn_total_amount: totalAmt || Number(form.grn_total_amount) || 0,
      dn_amount: Number(form.dn_amount) || 0,
      status: (form.dn_number || form.dn_amount) ? 'discrepancy_identified' : 'pending_match',
      items: form.items.map(it => ({
        ...it,
        mrp: Number(it.mrp) || 0,
        exp_qty: Number(it.exp_qty) || 0,
        grn_qty: Number(it.grn_qty) || 0,
        unit_price: Number(it.unit_price) || 0,
        taxable_value: Number(it.taxable_value) || 0,
        igst_amount: Number(it.igst_amount) || 0,
        total_amount: Number(it.total_amount) || 0,
        dn_qty: Number(it.dn_qty) || 0,
      })),
    };
    await base44.entities.CustomerGRN.create(payload);
    toast({ title: 'GRN recorded successfully' });
    onSaved?.();
    onClose();
    setSaving(false);
  };

  const F = ({ label, k, type = 'text', half = false }) => (
    <div className={half ? '' : ''}>
      <Label className="text-xs font-medium text-slate-700">{label}</Label>
      <Input className="h-9 text-sm mt-1" type={type} value={form[k] || ''} onChange={e => set(k, e.target.value)} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Customer GRN</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="manual">
          <TabsList className="mb-4">
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            <TabsTrigger value="pdf">Upload GRN PDF</TabsTrigger>
          </TabsList>

          <TabsContent value="pdf" className="space-y-3">
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
              {uploading || extracting ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                  <p className="text-sm text-slate-600">{uploading ? 'Uploading PDF...' : 'Extracting data with AI...'}</p>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600 mb-3">Upload GRN or Discrepancy Note PDF — data will be auto-extracted</p>
                  <label className="cursor-pointer">
                    <span className="bg-slate-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors">Choose PDF</span>
                    <input type="file" accept=".pdf" className="hidden" onChange={handlePDFUpload} />
                  </label>
                </>
              )}
            </div>
            <p className="text-xs text-slate-500">After extraction, the form below will be pre-filled. Review and save.</p>
          </TabsContent>

          <TabsContent value="manual" />
        </Tabs>

        <div className="space-y-4">
          {/* Platform + Invoice */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-slate-700">Platform *</Label>
              <Select value={form.platform} onValueChange={v => set('platform', v)}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Select platform" /></SelectTrigger>
                <SelectContent>{PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-700">Linked Invoice *</Label>
              <Select value={form.invoice_id} onValueChange={handleInvoiceSelect}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Select invoice" /></SelectTrigger>
                <SelectContent>{invoices.map(inv => <SelectItem key={inv.id} value={inv.id}>{inv.invoice_number} — {inv.customer_name}</SelectItem>)}</SelectContent>
              </Select>
              {!form.invoice_id && (
                <Input className="h-9 text-sm mt-1" placeholder="Or type invoice number manually" value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} />
              )}
              {form.invoice_total_amount > 0 && (
                <p className="text-xs text-green-700 font-medium mt-1">
                  ✓ Our Invoice Amount: ₹{Number(form.invoice_total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <F label="GRN Number *" k="grn_number" />
            <F label="GRN Date" k="grn_date" type="date" />
            <F label="Purchase Order Number" k="po_number" />
            <F label="ASN Number (Zepto)" k="asn_number" />
            <F label="Inbound Number" k="inbound_number" />
            <F label="Customer Name" k="customer_name" />
            <F label="Warehouse / Hub Location" k="warehouse_location" />
          </div>

          {/* Discrepancy Note section */}
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
            <p className="text-xs font-semibold text-amber-700 mb-2">Discrepancy / Debit Note (if any)</p>
            <div className="grid grid-cols-3 gap-3">
              <F label="Debit / Discrepancy Note Number" k="dn_number" />
              <F label="Date" k="dn_date" type="date" />
              <F label="Amount (INR)" k="dn_amount" type="number" />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-700">GRN Line Items</p>
              <Button variant="outline" size="sm" onClick={addItem} className="h-8 text-xs gap-1"><Plus className="w-3 h-3" />Add Item</Button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Item {idx + 1}</span>
                    {form.items.length > 1 && <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeItem(idx)}><Trash2 className="w-3 h-3 text-red-500" /></Button>}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[['Description', 'description'], ['Product Code', 'sku_code'], ['MRP', 'mrp'], ['Expected Qty', 'exp_qty'], ['GRN Qty (Received)', 'grn_qty'], ['Discrepancy Qty', 'dn_qty'], ['Unit Price', 'unit_price'], ['Total Amount', 'total_amount']].map(([lbl, key]) => (
                      <div key={key}>
                        <Label className="text-xs text-slate-600">{lbl}</Label>
                        <Input className="h-8 text-sm mt-0.5" value={item[key] || ''} onChange={e => updateItem(idx, key, e.target.value)} />
                      </div>
                    ))}
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Reason for Discrepancy</Label>
                    <Input className="h-8 text-sm mt-0.5" value={item.reason || ''} onChange={e => updateItem(idx, 'reason', e.target.value)} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium text-slate-700">Internal Notes</Label>
            <Input className="h-9 text-sm mt-1" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={onClose} className="h-11">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="h-11">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</> : 'Save GRN'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}