import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Upload, Loader2 } from 'lucide-react';

const PLATFORMS = [
  { value: 'swiggy', label: 'Swiggy (Scootsy)' },
  { value: 'zepto', label: 'Zepto' },
  { value: 'blinkit', label: 'Blinkit' },
  { value: 'other', label: 'Other' },
];

export default function DebitNoteEntryModal({ open, onClose, onSaved, grns = [], invoices = [] }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const [form, setForm] = useState({
    platform: '', debit_note_number: '', debit_note_date: '', grn_id: '', grn_number: '',
    invoice_id: '', invoice_number: '', customer_name: '', po_number: '',
    debit_note_amount: '', taxable_amount: '', igst_amount: '', narration: '',
    email_subject: '', notes: '', pdf_url: '',
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleGRNSelect = (grnId) => {
    const grn = grns.find(g => g.id === grnId);
    if (grn) {
      setForm(p => ({
        ...p,
        grn_id: grnId,
        grn_number: grn.grn_number,
        invoice_id: grn.invoice_id || '',
        invoice_number: grn.invoice_number || '',
        customer_name: grn.customer_name || '',
        po_number: grn.po_number || '',
        platform: grn.platform || p.platform,
      }));
    }
  };

  const handlePDFUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setExtracting(true);
      setUploading(false);

      const extracted = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract debit note data from this PDF. This is a debit note raised by a customer (Swiggy/Scootsy or Zepto) against K95 Foods. Extract all key fields.`,
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            debit_note_number: { type: 'string' },
            debit_note_date: { type: 'string' },
            invoice_number: { type: 'string' },
            grn_number: { type: 'string' },
            po_number: { type: 'string' },
            customer_name: { type: 'string' },
            debit_note_amount: { type: 'number' },
            taxable_amount: { type: 'number' },
            igst_amount: { type: 'number' },
            narration: { type: 'string' },
          }
        }
      });

      setForm(p => ({
        ...p,
        pdf_url: file_url,
        debit_note_number: extracted.debit_note_number || p.debit_note_number,
        debit_note_date: extracted.debit_note_date || p.debit_note_date,
        invoice_number: extracted.invoice_number || p.invoice_number,
        grn_number: extracted.grn_number || p.grn_number,
        po_number: extracted.po_number || p.po_number,
        customer_name: extracted.customer_name || p.customer_name,
        debit_note_amount: extracted.debit_note_amount || p.debit_note_amount,
        taxable_amount: extracted.taxable_amount || p.taxable_amount,
        igst_amount: extracted.igst_amount || p.igst_amount,
        narration: extracted.narration || p.narration,
      }));

      toast({ title: 'Data extracted from PDF', description: 'Review and confirm details.' });
    } catch (err) {
      toast({ title: 'Extraction failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!form.platform || !form.debit_note_number || !form.debit_note_amount) {
      toast({ title: 'Missing required fields', description: 'Platform, Debit Note Number and Amount are required.', variant: 'destructive' });
      return;
    }
    setSaving(true);

    // Auto-link to GRN if grn_number matches
    let resolvedGrnId = form.grn_id;
    if (!resolvedGrnId && form.grn_number) {
      const matchingGrn = grns.find(g => g.grn_number === form.grn_number);
      if (matchingGrn) resolvedGrnId = matchingGrn.id;
    }

    await base44.entities.CustomerDebitNote.create({
      ...form,
      grn_id: resolvedGrnId,
      debit_note_amount: Number(form.debit_note_amount) || 0,
      taxable_amount: Number(form.taxable_amount) || 0,
      igst_amount: Number(form.igst_amount) || 0,
      status: resolvedGrnId ? 'matched_to_grn' : 'received',
    });

    // If linked to GRN, update GRN dn_number
    if (resolvedGrnId) {
      await base44.entities.CustomerGRN.update(resolvedGrnId, {
        dn_number: form.debit_note_number,
        dn_amount: Number(form.debit_note_amount) || 0,
        status: 'discrepancy_identified',
      });
    }

    toast({ title: 'Debit note recorded', description: resolvedGrnId ? 'Auto-linked to GRN.' : 'Saved. Link to GRN manually if needed.' });
    onSaved?.();
    onClose();
    setSaving(false);
  };

  const F = ({ label, k, type = 'text', required = false }) => (
    <div>
      <Label className="text-xs font-medium text-slate-700">{label}{required && ' *'}</Label>
      <Input className="h-9 text-sm mt-1" type={type} value={form[k] || ''} onChange={e => set(k, e.target.value)} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Customer Debit Note</DialogTitle>
        </DialogHeader>

        {/* PDF Upload */}
        <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center mb-4">
          {uploading || extracting ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
              <span className="text-sm text-slate-600">{uploading ? 'Uploading...' : 'Extracting data with AI...'}</span>
            </div>
          ) : (
            <label className="cursor-pointer flex items-center justify-center gap-2 text-sm text-slate-600">
              <Upload className="w-4 h-4 text-slate-400" />
              Upload Debit Note PDF (auto-fill)
              <input type="file" accept=".pdf" className="hidden" onChange={handlePDFUpload} />
            </label>
          )}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-slate-700">Platform *</Label>
              <Select value={form.platform} onValueChange={v => set('platform', v)}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-700">Link to GRN</Label>
              <Select value={form.grn_id} onValueChange={handleGRNSelect}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Select GRN (optional)" /></SelectTrigger>
                <SelectContent>{grns.map(g => <SelectItem key={g.id} value={g.id}>{g.grn_number} — {g.invoice_number}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <F label="Debit Note Number" k="debit_note_number" required />
            <F label="Debit Note Date" k="debit_note_date" type="date" />
            <F label="Invoice Number" k="invoice_number" />
            <F label="GRN Number" k="grn_number" />
            <F label="Purchase Order Number" k="po_number" />
            <F label="Customer Name" k="customer_name" />
          </div>

          <div className="grid grid-cols-3 gap-3 border border-red-100 bg-red-50 rounded-lg p-3">
            <F label="Debit Note Amount (INR) *" k="debit_note_amount" type="number" required />
            <F label="Taxable Amount (INR)" k="taxable_amount" type="number" />
            <F label="IGST Amount (INR)" k="igst_amount" type="number" />
          </div>

          <F label="Narration / Reason" k="narration" />
          <F label="Email Subject" k="email_subject" />
          <F label="Internal Notes" k="notes" />

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={onClose} className="h-11">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="h-11">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</> : 'Save Debit Note'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}