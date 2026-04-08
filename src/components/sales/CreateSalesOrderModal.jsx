import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { X, Upload, FileText, Loader2, Edit2, Check, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { extractTextFromFile } from '@/lib/pdfTextExtractor';
import { parsePDFText } from '@/lib/salesPDFParser';
import { enrichParsedData } from '@/lib/salesPDFEnricher';
import ExcelSOImport from '@/components/sales/ExcelSOImport';
import PDFPreviewPanel from '@/components/sales/PDFPreviewPanel';
import PDFBulkUploadModal from '@/components/sales/PDFBulkUploadModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { triggerFMSProcess } from '@/lib/useFMSAutoComplete';
import { generateDocNumber } from '@/lib/docNumberHelper';

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

  // Auto planned dispatch date = today + 3 days (mirrors ERPNext client script)
  const defaultDispatchDate = new Date();
  defaultDispatchDate.setDate(defaultDispatchDate.getDate() + 3);
  const defaultDispatchDateStr = defaultDispatchDate.toISOString().split('T')[0];

  const [form, setForm] = useState({
    customer_name: '',
    po_number: '',
    po_date: '',
    po_expiry_date: '',
    po_delivery_date: '',
    planned_dispatch_date: defaultDispatchDateStr,
    payment_terms: '',
    platform: 'direct',
    notes: '',
  });

  const [creditWarning, setCreditWarning] = useState(null);
  const [soNumber, setSoNumber] = useState('');

  useEffect(() => {
    generateDocNumber('SO').then(num => setSoNumber(num));
  }, []);

  async function handlePDFUpload(file) {
    setUploading(true);
    const [uploadResult, rawText] = await Promise.all([
      base44.integrations.Core.UploadFile({ file }),
      extractTextFromFile(file).catch(() => ''),
    ]);
    const file_url = uploadResult.file_url;
    setPdfUrl(file_url);
    setUploading(false);

    setParsing(true);
    let d = null;
    const browserParsed = rawText ? parsePDFText(rawText) : null;
    if (browserParsed && browserParsed.items?.length > 0) {
      d = await enrichParsedData(browserParsed);
    } else {
      const res = await base44.functions.invoke('parseSalesPDF', { pdf_url: file_url, raw_text: rawText });
      if (res.data?.success) d = res.data.data;
    }
    setParsing(false);

    if (d) {
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

      if (d.po_expiry_date && new Date(d.po_expiry_date) < new Date() && (d.platform || 'direct') !== 'direct') {
        setExpiryWarning(true);
      }
      setStep('preview');
    } else {
      toast({ title: 'Parsing failed', description: 'Could not extract data from PDF', variant: 'destructive' });
    }
  }

  // Credit limit check — mirrors ERPNext \"Restrict Customer Outstanding\" server script
  async function checkCreditLimit(customerName) {
    const customers = await base44.entities.Customer.filter({ name: customerName });
    const customer = customers[0];
    if (!customer || !customer.check_outstanding) return null;
    const limit = customer.outstanding_limit || 0;
    const leverage = customer.leverage_outstanding || 0;
    const current = customer.current_outstanding || 0;
    const maxAllowed = limit + leverage;
    if (current > maxAllowed) {
      return { current, limit, leverage, maxAllowed, customerName };
    }
    return null;
  }

  // Mirrors \"Validate DD & TD\" — delivery_date cannot be before po_date (order date)
  function validateDates() {
    if (form.po_delivery_date && form.po_date && form.po_delivery_date < form.po_date) {
      toast({ title: 'Delivery Date cannot be before Purchase Order Date', variant: 'destructive' });
      return false;
    }
    return true;
  }

  // Auto-fill customer details + resolve price list (customer-specific → group fallback)
  async function handleCustomerNameBlur(name) {
    if (!name || name.length < 3) return;
    // Match by exact name or GSTIN-level search (with caching — staleTime on queryFn)
    const matches = await base44.entities.Customer.filter({ status: 'active' });
    const nameLower = name.toLowerCase();
    const c = matches.find(cu => cu.name?.toLowerCase() === nameLower)
      || matches.find(cu => cu.name?.toLowerCase().includes(nameLower.slice(0, 20)));

    // Resolve price list: customer-specific first, then group fallback
    let resolvedPriceList = c.price_list || '';
    if (!resolvedPriceList && c.customer_group) {
      const allRates = await base44.entities.SalesRateList.filter({ is_active: true });
      const groupName = c.customer_group.toLowerCase();
      const groupList = [...new Set(allRates.map(r => r.price_list).filter(Boolean))]
        .find(pl => (pl.toLowerCase().includes(groupName) || groupName.includes(pl.toLowerCase())) && pl !== 'Internal Transfer');
      if (groupList) resolvedPriceList = groupList;
    }

    setForm(f => ({
      ...f,
      customer_gstin: f.customer_gstin || c.gstin || '',
      billing_address: f.billing_address || c.billing_address || '',
      shipping_address: f.shipping_address || c.shipping_address || '',
      payment_terms: f.payment_terms || c.payment_terms || '',
      price_list: resolvedPriceList,
      _customer_price_list: resolvedPriceList,
      _customer_group: c.customer_group || '',
    }));
  }

  // Mirrors ERPNext \"Validate Sales Order Price List\" server script
  function validatePriceList() {
    if (!form._customer_price_list) return true; // no restriction if customer has no price list set
    if (form.price_list && form.price_list !== form._customer_price_list) {
      toast({
        title: `Price List \"${form.price_list}\" is not assigned to this customer. Only \"${form._customer_price_list}\" is allowed.`,
        variant: 'destructive'
      });
      return false;
    }
    return true;
  }

  async function handleSave() {
    if (!form.customer_name) {
      toast({ title: 'Customer name is required', variant: 'destructive' });
      return;
    }
    if (!validateDates()) return;
    if (!validatePriceList()) return;
    setSaving(true);

    // Credit limit check (mirrors server script Before Submit)
    const creditBlock = await checkCreditLimit(form.customer_name);
    if (creditBlock) {
      setSaving(false);
      setCreditWarning(creditBlock);
      toast({
        title: 'Credit Limit Exceeded',
        description: `Current Outstanding: ₹${creditBlock.current.toLocaleString('en-IN')} exceeds limit of ₹${creditBlock.maxAllowed.toLocaleString('en-IN')}`,
        variant: 'destructive',
      });
      return;
    }

    // Exclude internal keys prefixed with _ before saving
    const { _customer_price_list, ...formData } = form;
    const soData = {
      ...formData,
      so_number: soNumber,
      source: type,
      status: 'confirmed',
      pdf_url: pdfUrl || null,
      expiry_override_approved: expiryWarning ? false : undefined,
    };

    const so = await base44.entities.SalesOrder.create(soData);

    // Save items in batch for speed
    if (extractedData?.items?.length) {
      const itemPayloads = extractedData.items.map(item => ({
        ...item,
        sales_order_id: so.id,
        so_number: soNumber,
        stock_status: 'not_checked',
      }));
      await base44.entities.SalesOrderItem.bulkCreate(itemPayloads);
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

          {/* Excel Import */}
          {type === 'excel_upload' && (
            <ExcelSOImport onCreated={(so) => { onCreated(so); }} />
          )}

          {/* PDF Upload — opens dedicated bulk modal */}
          {type === 'pdf_upload' && (
            <PDFBulkUploadModal onClose={onClose} onCreated={onCreated} />
          )}

          {/* Form (manual or after PDF parse) */}
          {(type === 'manual' || step === 'preview') && (
            <>
              {expiryWarning && form.platform !== 'direct' && (
               <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                 <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                 <div>
                   <p className="text-sm font-medium text-red-700">PO Expiry Date has passed</p>
                   <p className="text-xs text-red-600">This order requires override approval before dispatch.</p>
                 </div>
               </div>
              )}
              {creditWarning && (
               <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                 <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                 <div>
                   <p className="text-sm font-medium text-red-700">Credit Limit Exceeded — Cannot Create Order</p>
                   <p className="text-xs text-red-600 mt-0.5">
                     Current Outstanding: <strong>₹{creditWarning.current?.toLocaleString('en-IN')}</strong> &nbsp;·&nbsp;
                     Allowed Limit: <strong>₹{creditWarning.maxAllowed?.toLocaleString('en-IN')}</strong>
                     {creditWarning.leverage > 0 && ` (Limit ₹${creditWarning.limit?.toLocaleString('en-IN')} + Buffer ₹${creditWarning.leverage?.toLocaleString('en-IN')})`}
                   </p>
                   <p className="text-xs text-red-500 mt-0.5">Please clear outstanding dues before placing a new order.</p>
                 </div>
               </div>
              )}

              {step === 'preview' && pdfUrl && (
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-blue-700 font-medium">
                      PDF parsed — Platform: <strong>{form.platform?.toUpperCase()}</strong>
                      {extractedData?.items?.length && ` · ${extractedData.items.length} items extracted`}
                    </span>
                  </div>
                  <PDFPreviewPanel pdfUrl={pdfUrl} />
                </div>
              )}

              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                  <Label className="text-xs font-medium text-slate-700">Customer Name *</Label>
                  <Input className="h-9 text-sm mt-1" value={form.customer_name}
                    onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                    onBlur={e => handleCustomerNameBlur(e.target.value)} />
                  <p className="text-xs text-slate-400 mt-0.5">GSTIN, address & price list auto-filled if customer exists</p>
                  </div>
                  <div>
                  <Label className="text-xs font-medium text-slate-700">Price List</Label>
                  <Input className="h-9 text-sm mt-1" value={form.price_list || ''}
                    onChange={e => setForm(f => ({ ...f, price_list: e.target.value }))}
                    placeholder={form._customer_price_list ? `Default: ${form._customer_price_list}` : 'e.g. Standard Selling'} />
                  {form._customer_price_list && form._customer_price_list !== 'Internal Transfer' && <p className="text-xs text-slate-400 mt-0.5">Customer's assigned price list: {form._customer_price_list}</p>}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Platform</Label>
                    <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.platform} onChange={e => {
                         const p = e.target.value;
                         setForm(f => ({ ...f, platform: p }));
                         if (p === 'direct') setExpiryWarning(false);
                       }}>
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
                     <Label className={`text-xs font-medium ${expiryWarning && form.platform !== 'direct' ? 'text-red-600' : 'text-slate-700'}`}>
                       PO Expiry Date {form.platform !== 'direct' ? '*' : <span className="text-slate-400 font-normal">(optional)</span>}
                     </Label>
                     <Input type="date" className={`h-9 text-sm mt-1 ${expiryWarning && form.platform !== 'direct' ? 'border-red-400' : ''}`}
                       value={form.po_expiry_date}
                       onChange={e => {
                         const v = e.target.value;
                         setForm(f => ({ ...f, po_expiry_date: v }));
                         setExpiryWarning(v && new Date(v) < new Date() && form.platform !== 'direct');
                       }} />
                     {form.platform === 'direct' && <p className="text-xs text-slate-400 mt-0.5">Not applicable for direct orders — no impact on workflow</p>}
                   </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Delivery Date</Label>
                    <Input type="date" className="h-9 text-sm mt-1" value={form.po_delivery_date}
                      onChange={e => setForm(f => ({ ...f, po_delivery_date: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Planned Dispatch Date</Label>
                    <Input type="date" className="h-9 text-sm mt-1" value={form.planned_dispatch_date}
                      onChange={e => setForm(f => ({ ...f, planned_dispatch_date: e.target.value }))} />
                    <p className="text-xs text-slate-400 mt-0.5">Auto-set to today + 3 days</p>
                  </div>
                </div>

                {/* Items preview for PDF */}
                {step === 'preview' && extractedData?.items?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-700">
                      {extractedData.items.length} item{extractedData.items.length !== 1 ? 's' : ''} extracted
                    </p>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="px-3 py-2 text-left text-slate-600 font-medium">Description</th>
                            <th className="px-3 py-2 text-right text-slate-600 font-medium">Qty</th>
                            <th className="px-3 py-2 text-right text-slate-600 font-medium">Rate</th>
                            <th className="px-3 py-2 text-right text-slate-600 font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {extractedData.items.map((item, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-3 py-2 text-slate-700">
                                <div>{item._product_name || item.description}</div>
                                {item.item_code && <div className="text-slate-400 text-[10px] mt-0.5">{item.item_code}</div>}
                              </td>
                              <td className="px-3 py-2 text-right text-slate-700">{item.quantity}</td>
                              <td className="px-3 py-2 text-right text-slate-700">
                                {item.unit_base_cost || item.rate_snapshot
                                  ? `₹${(item.unit_base_cost || item.rate_snapshot)?.toLocaleString('en-IN')}`
                                  : <span className="text-slate-400">—</span>}
                              </td>
                              <td className="px-3 py-2 text-right font-medium text-slate-900">
                                ₹{(item.total_amount || item.taxable_value || 0).toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Financial Summary */}
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
                      <div className="flex justify-between items-center px-4 py-2.5 text-sm">
                        <span className="text-slate-600">Taxable</span>
                        <span className="font-medium text-slate-900">
                          ₹{(extractedData.taxable_amount || extractedData.items.reduce((s, i) => s + (i.taxable_value || i.total_amount || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center px-4 py-2.5 text-sm">
                        <span className="text-slate-600">Tax (GST)</span>
                        <span className="font-medium text-slate-900">
                          ₹{(extractedData.tax_amount || extractedData.items.reduce((s, i) => s + (i.igst_amount || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center px-4 py-2.5 text-sm bg-slate-50 rounded-b-lg">
                        <span className="font-semibold text-slate-900">Grand Total</span>
                        <span className="font-bold text-emerald-700 text-base">
                          ₹{(extractedData.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                        </span>
                      </div>
                    </div>
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