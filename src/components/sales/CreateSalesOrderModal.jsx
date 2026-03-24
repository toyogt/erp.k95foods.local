import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { X, Upload, FileText, Loader2, Edit2, Check, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import ExcelSOImport from '@/components/sales/ExcelSOImport';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { triggerFMSProcess } from '@/lib/useFMSAutoComplete';

const CREATION_TYPES = [
  { key: 'manual', label: 'Manual Entry', icon: Edit2 },
  { key: 'pdf_upload', label: 'Upload PDF', icon: Upload },
  { key: 'excel_upload', label: 'Excel Import', icon: FileSpreadsheet },
];

export default function CreateSalesOrderModal({ defaultType = 'manual', onClose, onCreated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [type, setType] = useState(defaultType);
  const [step, setStep] = useState('form'); // form | preview | saving
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [expiryWarning, setExpiryWarning] = useState(false);
  const fileRef = useRef();

  const [form, setForm] = useState({
    customer_name: '',
    po_number: '',
    po_date: '',
    po_expiry_date: '',
    po_delivery_date: '',
    payment_terms: '',
    platform: 'direct',
    notes: '',
  });

  const soNumber = `SO-${Date.now().toString().slice(-8)}`;

  async function handlePDFUpload(file) {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setPdfUrl(file_url);
    setUploading(false);

    setParsing(true);
    const res = await base44.functions.invoke('parseSalesPDF', { pdf_url: file_url });
    setParsing(false);

    if (res.data?.success) {
      const d = res.data.data;
      setExtractedData(d);
      setForm(f => ({
        ...f,
        customer_name: d.customer_name || '',
        po_number: d.po_number || '',
        po_date: d.po_date || '',
        po_expiry_date: d.po_expiry_date || '',
        po_delivery_date: d.po_delivery_date || '',
        payment_terms: d.payment_terms || '',
        platform: d.platform || 'direct',
        customer_gstin: d.customer_gstin || '',
        billing_address: d.billing_address || '',
        shipping_address: d.shipping_address || '',
        taxable_amount: d.taxable_amount || 0,
        tax_amount: d.tax_amount || 0,
        total_amount: d.total_amount || 0,
        vendor_no: d.vendor_no || '',
      }));

      if (d.po_expiry_date && new Date(d.po_expiry_date) < new Date()) {
        setExpiryWarning(true);
      }
      setStep('preview');
    } else {
      toast({ title: 'Parsing failed', description: 'Could not extract data from PDF', variant: 'destructive' });
    }
  }

  async function handleSave() {
    if (!form.customer_name) {
      toast({ title: 'Customer name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);

    const soData = {
      ...form,
      so_number: soNumber,
      source: type,
      status: 'confirmed',
      pdf_url: pdfUrl || null,
      expiry_override_approved: expiryWarning ? false : undefined,
    };

    const so = await base44.entities.SalesOrder.create(soData);

    // Save items if extracted
    if (extractedData?.items?.length) {
      for (const item of extractedData.items) {
        await base44.entities.SalesOrderItem.create({
          ...item,
          sales_order_id: so.id,
          so_number: soNumber,
          stock_status: 'not_checked',
        });
      }
    }

    // Audit log
    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesOrder',
      entity_id: so.id,
      reference_number: soNumber,
      action: 'created',
      new_value: JSON.stringify({ status: 'confirmed', source: type }),
      user_email: user?.email,
    });

    // FMS trigger
    await triggerFMSProcess({
      triggerSource: 'sales_order_created',
      triggerRefId: so.id,
      title: `Sales Order ${soNumber}`,
      triggerData: { so_number: soNumber, customer: form.customer_name },
    });

    setSaving(false);
    toast({ title: 'Sales Order created', description: soNumber });
    onCreated(so);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">New Sales Order</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Type selector */}
          <div className="flex gap-2">
            {CREATION_TYPES.map(t => (
              <button
                key={t.key}
                onClick={() => { setType(t.key); setStep('form'); setExtractedData(null); setPdfUrl(null); setExpiryWarning(false); }}
                className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-lg border text-sm font-medium transition-colors ${
                  type === t.key
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>

          {/* PDF Upload */}
          {type === 'pdf_upload' && step === 'form' && (
            <div>
              {uploading || parsing ? (
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">{uploading ? 'Uploading PDF...' : 'Parsing with AI (Zepto / Blinkit / Swiggy)...'}</p>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center cursor-pointer hover:border-slate-400 transition-colors"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file?.type === 'application/pdf') handlePDFUpload(file);
                  }}
                >
                  <Upload className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-700">Drag & drop PDF here</p>
                  <p className="text-xs text-slate-400 mt-1">Blinkit, Swiggy, Zepto POs auto-detected</p>
                  <input ref={fileRef} type="file" accept=".pdf" className="hidden"
                    onChange={e => { if (e.target.files[0]) handlePDFUpload(e.target.files[0]); }} />
                </div>
              )}
            </div>
          )}

          {/* Form (manual or after PDF parse) */}
          {(type === 'manual' || step === 'preview') && (
            <>
              {expiryWarning && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-700">PO Expiry Date has passed</p>
                    <p className="text-xs text-red-600">This order requires override approval before dispatch.</p>
                  </div>
                </div>
              )}

              {step === 'preview' && pdfUrl && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-blue-700 font-medium">
                    PDF parsed — Platform: <strong>{form.platform?.toUpperCase()}</strong>
                    {extractedData?.items?.length && ` · ${extractedData.items.length} items extracted`}
                  </span>
                </div>
              )}

              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Customer Name *</Label>
                    <Input className="h-9 text-sm mt-1" value={form.customer_name}
                      onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Platform</Label>
                    <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
                      <option value="direct">Direct</option>
                      <option value="blinkit">Blinkit</option>
                      <option value="swiggy">Swiggy</option>
                      <option value="zepto">Zepto</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Purchase Order Number</Label>
                    <Input className="h-9 text-sm mt-1" value={form.po_number}
                      onChange={e => setForm(f => ({ ...f, po_number: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Payment Terms</Label>
                    <Input className="h-9 text-sm mt-1" value={form.payment_terms}
                      onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-700">PO Date</Label>
                    <Input type="date" className="h-9 text-sm mt-1" value={form.po_date}
                      onChange={e => setForm(f => ({ ...f, po_date: e.target.value }))} />
                  </div>
                  <div>
                    <Label className={`text-xs font-medium ${expiryWarning ? 'text-red-600' : 'text-slate-700'}`}>
                      PO Expiry Date *
                    </Label>
                    <Input type="date" className={`h-9 text-sm mt-1 ${expiryWarning ? 'border-red-400' : ''}`}
                      value={form.po_expiry_date}
                      onChange={e => {
                        const v = e.target.value;
                        setForm(f => ({ ...f, po_expiry_date: v }));
                        setExpiryWarning(v && new Date(v) < new Date());
                      }} />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Delivery Date</Label>
                    <Input type="date" className="h-9 text-sm mt-1" value={form.po_delivery_date}
                      onChange={e => setForm(f => ({ ...f, po_delivery_date: e.target.value }))} />
                  </div>
                </div>

                {/* Items preview for PDF */}
                {step === 'preview' && extractedData?.items?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-700 mb-2">Line Items ({extractedData.items.length})</p>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-slate-600">Description</th>
                            <th className="px-3 py-2 text-right text-slate-600">Qty</th>
                            <th className="px-3 py-2 text-right text-slate-600">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {extractedData.items.map((item, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2 text-slate-700">{item.description}</td>
                              <td className="px-3 py-2 text-right">{item.quantity}</td>
                              <td className="px-3 py-2 text-right font-medium">₹{item.total_amount?.toLocaleString('en-IN')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {extractedData.total_amount && (
                      <p className="text-right text-sm font-semibold text-slate-900 mt-2">
                        Grand Total: ₹{extractedData.total_amount?.toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <Label className="text-xs font-medium text-slate-700">Notes</Label>
                  <textarea
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {(type === 'manual' || step === 'preview') && (
          <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
            <Button variant="outline" className="h-11 px-4" onClick={onClose}>Cancel</Button>
            <Button
              className="h-11 px-6 bg-slate-900 hover:bg-slate-800 text-white"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</> : <><Check className="w-4 h-4 mr-2" /> Create Sales Order</>}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}