import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, Upload, Plus, X, Loader2, Zap, Check } from 'lucide-react';
import { genId, logAccountsAudit, findCandidatePOs } from '@/components/accounts/accountsHelpers';
import ItemSelector from '@/components/accounts/ItemSelector';

export default function InvoiceCapture() {
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(1);
  const [suppliers, setSuppliersList] = useState([]);
  const [uoms, setUoms] = useState([]);

  const [invId, setInvId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceFile, setInvoiceFile] = useState('');
  const [poId, setPoId] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');

  const [fileLoading, setFileLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      const [supps, uomList] = await Promise.all([
        base44.entities.Supplier.list(),
        base44.entities.UOMMaster.list(),
      ]);
      setSuppliersList(supps);
      setUoms(uomList);
    })();
  }, []);

  const handleFileUpload = async (file) => {
    setFileLoading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setInvoiceFile(file_url);
      setError('');
    } catch (err) {
      setError(`Upload failed: ${err.message}`);
    } finally {
      setFileLoading(false);
    }
  };

  const handleSupplierChange = async (sid) => {
    setSupplierId(sid);
    const supp = suppliers.find(s => s.supplier_id === sid);
    setSupplierName(supp?.supplier_name || '');
    setCandidates([]);
    setPoId('');
  };

  const handleFindPO = async () => {
    if (!supplierId) {
      setError('Select supplier first');
      return;
    }
    const cand = await findCandidatePOs(supplierId);
    setCandidates(cand);
  };

  const handleAIExtract = async () => {
    if (!invoiceFile) {
      setError('Upload invoice file first');
      return;
    }
    setAiLoading(true);
    try {
      const res = await base44.functions.invoke('aiExtractInvoice', {
        invoice_file: invoiceFile,
        supplier_name: supplierName,
        po_id: poId,
      });
      const extracted = res.data;
      setAiResult(extracted);
      setError('');
    } catch (err) {
      setError(`AI extraction failed: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const applyAIExtraction = () => {
    if (!aiResult) return;
    setInvoiceNumber(aiResult.invoice_number || '');
    setInvoiceDate(aiResult.invoice_date || '');
    setInvoiceAmount(aiResult.total_amount || '');

    const newItems = (aiResult.items || []).map((it, i) => ({
      key: `item-${i}`,
      item_code: '',
      item_name: it.description || '',
      uom_code: it.uom || '',
      qty: it.qty || 0,
      rate: it.rate || 0,
      amount: it.amount || 0,
      remarks: '',
    }));
    setItems(newItems);
    setAiResult(null);
  };

  const addItem = () => {
    setItems(prev => [...prev, {
      key: `item-${Date.now()}`,
      item_code: '',
      item_name: '',
      uom_code: '',
      qty: 0,
      rate: 0,
      amount: 0,
      remarks: '',
    }]);
  };

  const updateItem = (key, field, value) => {
    setItems(prev => prev.map(it => 
      it.key === key ? { ...it, [field]: value } : it
    ));
  };

  const removeItem = (key) => {
    setItems(prev => prev.filter(it => it.key !== key));
  };

  const handleSelectItem = (key, item) => {
    updateItem(key, 'item_code', item?.short_code || '');
    updateItem(key, 'item_name', item?.ingredient_name || '');
  };

  const handleSubmit = async () => {
    setSubmitLoading(true);
    try {
      const id = genId('PINV');
      await base44.entities.SupplierInvoice.create({
        inv_id: id,
        supplier_id: supplierId,
        supplier_name: supplierName,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        invoice_amount: parseFloat(invoiceAmount) || 0,
        invoice_file: invoiceFile,
        status: 'DRAFT',
        linked_po_id: poId || null,
        notes,
        submitted_by: user?.full_name || user?.email || '',
        submitted_at: new Date().toISOString(),
      });

      for (const it of items) {
        await base44.entities.SupplierInvoiceItem.create({
          inv_id: id,
          item_code: it.item_code,
          item_name: it.item_name,
          uom_code: it.uom_code,
          qty: it.qty,
          rate: it.rate,
          amount: it.amount,
          remarks: it.remarks,
        });
      }

      await logAccountsAudit({
        action: 'INVOICE_CREATED',
        entity_type: 'SupplierInvoice',
        entity_id: id,
        details: { supplier_id: supplierId },
        user,
      });

      alert(`Invoice ${id} saved successfully!`);
      window.location.reload();
    } catch (err) {
      setError(`Save failed: ${err.message}`);
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Invoice Capture</h1>
          <p className="text-slate-600">Upload and process supplier invoices for payment</p>
        </div>

        {/* Step Indicator */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex-1">
              <div className={`flex items-center gap-2 p-3 rounded-lg border-2 transition ${
                step === s ? 'bg-blue-50 border-blue-500' : step > s ? 'bg-green-50 border-green-500' : 'bg-slate-100 border-slate-300'
              }`}>
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-semibold text-sm ${
                  step === s ? 'bg-blue-500 text-white' : step > s ? 'bg-green-500 text-white' : 'bg-slate-300 text-slate-600'
                }`}>
                  {step > s ? <Check className="w-4 h-4" /> : s}
                </div>
                <div className="text-xs font-medium text-slate-700">
                  {s === 1 ? 'Upload' : s === 2 ? 'Details' : 'Line Items'}
                </div>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-red-900">Error</div>
              <div className="text-sm text-red-800">{error}</div>
            </div>
          </div>
        )}

        <Card className="shadow-lg">
          {/* Step 1: File Upload */}
          {step === 1 && (
            <div className="p-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Upload Invoice</h2>
              <p className="text-sm text-slate-600 mb-6">Upload a PDF or image of your supplier invoice</p>

              <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-blue-400 hover:bg-blue-50 transition">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  disabled={fileLoading}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer block">
                  {fileLoading ? (
                    <>
                      <Loader2 className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />
                      <p className="text-sm text-slate-600 font-medium">Uploading...</p>
                    </>
                  ) : invoiceFile ? (
                    <>
                      <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
                      <p className="text-sm text-green-700 font-medium">File uploaded successfully</p>
                      <p className="text-xs text-slate-500 mt-2">Click to change file</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                      <p className="text-sm font-medium text-slate-900">Click to upload or drag and drop</p>
                      <p className="text-xs text-slate-500 mt-1">PDF or image (PNG, JPG)</p>
                    </>
                  )}
                </label>
              </div>

              <div className="flex gap-3 mt-8 pt-6 border-t">
                <Button variant="outline" className="flex-1" disabled>Back</Button>
                <Button onClick={() => setStep(2)} disabled={!invoiceFile} className="flex-1">Next: Invoice Details</Button>
              </div>
            </div>
          )}

          {/* Step 2: Invoice Details */}
          {step === 2 && (
            <div className="p-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-6">Invoice Details</h2>

              <div className="space-y-6">
                {/* Supplier Section */}
                <div className="bg-slate-50 rounded-lg p-6">
                  <h3 className="font-medium text-slate-900 mb-4">Supplier Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Supplier *</label>
                      <select
                        value={supplierId}
                        onChange={e => handleSupplierChange(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      >
                        <option value="">Select a supplier...</option>
                        {suppliers.map(s => (
                          <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Invoice Details Section */}
                <div className="bg-slate-50 rounded-lg p-6">
                  <h3 className="font-medium text-slate-900 mb-4">Invoice Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Invoice Number *</label>
                      <input
                        type="text"
                        value={invoiceNumber}
                        onChange={e => setInvoiceNumber(e.target.value)}
                        placeholder="e.g., INV-2026-001234"
                        className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Invoice Date *</label>
                      <input
                        type="date"
                        value={invoiceDate}
                        onChange={e => setInvoiceDate(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-2">Total Amount (₹) *</label>
                      <input
                        type="number"
                        value={invoiceAmount}
                        onChange={e => setInvoiceAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* PO Linking Section */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="font-medium text-slate-900 mb-4">Link Purchase Order (Optional)</h3>
                  <div className="flex gap-3 mb-4">
                    <Button onClick={handleFindPO} variant="outline" className="flex-1">Find PO by Supplier</Button>
                    <Button onClick={handleAIExtract} disabled={aiLoading} variant="outline" className="flex-1 gap-2">
                      {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      AI Extract
                    </Button>
                  </div>

                  {candidates.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <label className="block text-sm font-medium text-slate-700">Available POs:</label>
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {candidates.map(p => (
                          <button
                            key={p.po_id}
                            onClick={() => { setPoId(p.po_id); setCandidates([]); }}
                            className="w-full text-left px-4 py-2.5 bg-white border border-slate-200 hover:border-blue-500 hover:bg-blue-50 rounded-lg transition text-sm"
                          >
                            <div className="font-medium text-slate-900">{p.po_id}</div>
                            <div className="text-xs text-slate-500">Date: {p.po_date} • Amount: ₹{p.total_amount}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {poId && (
                    <div className="px-4 py-2.5 bg-white border border-blue-300 rounded-lg text-sm text-slate-900 flex justify-between items-center">
                      <span><strong>Linked:</strong> {poId}</span>
                      <button onClick={() => setPoId('')} className="text-red-600 hover:text-red-700 font-medium">Clear</button>
                    </div>
                  )}
                </div>

                {/* AI Results */}
                {aiResult && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-medium text-amber-900">AI Extracted Data (Preview)</h3>
                      <Button onClick={applyAIExtraction} size="sm" className="bg-amber-600 hover:bg-amber-700">Apply</Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm text-amber-900">
                      <div><strong>Number:</strong> {aiResult.invoice_number}</div>
                      <div><strong>Date:</strong> {aiResult.invoice_date}</div>
                      <div><strong>Amount:</strong> ₹{aiResult.total_amount}</div>
                      <div><strong>Items:</strong> {aiResult.items?.length || 0}</div>
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Notes (Optional)</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Add any additional information or notes..."
                    rows={3}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-8 pt-6 border-t">
                <Button onClick={() => setStep(1)} variant="outline" className="flex-1">Back</Button>
                <Button onClick={() => setStep(3)} disabled={!supplierId || !invoiceNumber || !invoiceDate || !invoiceAmount} className="flex-1">Next: Line Items</Button>
              </div>
            </div>
          )}

          {/* Step 3: Line Items */}
          {step === 3 && (
            <div className="p-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Invoice Line Items</h2>
              <p className="text-sm text-slate-600 mb-6">Add the items from your invoice</p>

              {items.length === 0 ? (
                <div className="bg-slate-50 rounded-lg p-12 text-center mb-6">
                  <p className="text-slate-600 mb-4">No items added yet</p>
                  <Button onClick={addItem} variant="outline" className="gap-2">
                    <Plus className="w-4 h-4" /> Add First Item
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                  {items.map((it, idx) => (
                    <div key={it.key} className="border border-slate-200 rounded-lg p-6 hover:shadow-md transition">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="font-medium text-slate-900">Item {idx + 1}</h3>
                        <button onClick={() => removeItem(it.key)} className="text-red-600 hover:text-red-700 p-1">
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-slate-600 mb-2">Item (Search or type)</label>
                          <ItemSelector
                            value={it.item_code}
                            onChange={item => handleSelectItem(it.key, item)}
                            placeholder="Search items by name or code..."
                          />
                          {it.item_name && (
                            <div className="text-xs text-green-600 mt-1">Selected: {it.item_name}</div>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-2">Quantity</label>
                          <input
                            type="number"
                            value={it.qty}
                            onChange={e => updateItem(it.key, 'qty', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-2">UOM</label>
                          <select
                            value={it.uom_code}
                            onChange={e => updateItem(it.key, 'uom_code', e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          >
                            <option value="">Select UOM</option>
                            {uoms.map(u => (
                              <option key={u.uom_id} value={u.uom_id}>{u.uom_code}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-2">Unit Rate (₹)</label>
                          <input
                            type="number"
                            value={it.rate}
                            onChange={e => updateItem(it.key, 'rate', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-2">Amount (₹)</label>
                          <input
                            type="number"
                            value={it.amount}
                            onChange={e => updateItem(it.key, 'amount', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-slate-600 mb-2">Remarks (Optional)</label>
                          <input
                            type="text"
                            value={it.remarks}
                            onChange={e => updateItem(it.key, 'remarks', e.target.value)}
                            placeholder="Add any notes..."
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button onClick={addItem} variant="outline" className="w-full gap-2 mb-6">
                <Plus className="w-4 h-4" /> Add Item
              </Button>

              <div className="flex gap-3 pt-6 border-t">
                <Button onClick={() => setStep(2)} variant="outline" className="flex-1">Back</Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitLoading || items.length === 0}
                  className="flex-1 gap-2"
                >
                  {submitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save Invoice as Draft
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}