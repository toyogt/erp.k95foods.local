import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, Upload, Plus, X, Loader2, Zap } from 'lucide-react';
import { genId, logAccountsAudit, findCandidatePOs } from '@/components/accounts/accountsHelpers';

export default function InvoiceCapture() {
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(1); // 1=upload, 2=details, 3=items
  const [suppliers, setSuppliersList] = useState([]);
  const [uoms, setUoms] = useState([]);

  const [invId, setInvId] = useState('');
  const [supplierId, setSuppliers] = useState('');
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
      setStep(2);
    } catch (err) {
      setError(`Upload failed: ${err.message}`);
    } finally {
      setFileLoading(false);
    }
  };

  const handleSupplierChange = async (sid) => {
    setSuppliers(sid);
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

      // Create items
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

      alert(`Invoice ${id} saved as DRAFT. Go to 3-Way Match to submit.`);
      window.location.reload();
    } catch (err) {
      setError(`Save failed: ${err.message}`);
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Invoice Capture</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      <Card className="p-6">
        {/* Step 1: File Upload */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">Step 1: Upload Invoice</h3>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 transition">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                disabled={fileLoading}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                {fileLoading ? (
                  <>
                    <Loader2 className="w-12 h-12 text-blue-500 mx-auto mb-2 animate-spin" />
                    <p className="text-sm text-slate-600">Uploading...</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-900">Click or drag to upload invoice (PDF or image)</p>
                  </>
                )}
              </label>
            </div>
          </div>
        )}

        {/* Step 2: Invoice Details */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">Step 2: Invoice Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
                <select
                  value={supplierId}
                  onChange={e => handleSupplierChange(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select supplier...</option>
                  {suppliers.map(s => (
                    <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Number</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="INV-123456"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Date</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={e => setInvoiceDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Total Amount</label>
                <input
                  type="number"
                  value={invoiceAmount}
                  onChange={e => setInvoiceAmount(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* PO Lookup */}
            <div className="border-t pt-4 mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Link PO (optional)</label>
              <div className="flex gap-2 mb-3">
                <Button onClick={handleFindPO} variant="outline" className="flex-1">
                  Find PO by Supplier
                </Button>
                <Button onClick={handleAIExtract} variant="outline" disabled={aiLoading} className="flex-1 gap-2">
                  {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  AI Extract
                </Button>
              </div>
              {candidates.length > 0 && (
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg">
                  {candidates.map(p => (
                    <button
                      key={p.po_id}
                      onClick={() => { setPoId(p.po_id); setCandidates([]); }}
                      className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b last:border-0 text-sm"
                    >
                      <div className="font-medium">{p.po_id}</div>
                      <div className="text-xs text-slate-500">{p.po_date} • ₹{p.total_amount}</div>
                    </button>
                  ))}
                </div>
              )}
              {poId && (
                <div className="mt-2 px-3 py-2 bg-blue-50 rounded-lg text-sm text-blue-700 flex justify-between">
                  <span>Linked: {poId}</span>
                  <button onClick={() => setPoId('')} className="font-medium">Clear</button>
                </div>
              )}
            </div>

            {/* AI Results */}
            {aiResult && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="font-medium text-amber-900">AI Extracted Data</div>
                  <Button onClick={applyAIExtraction} size="sm" className="bg-amber-600 hover:bg-amber-700">
                    Apply Suggestions
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-amber-800">
                  <div>Number: {aiResult.invoice_number}</div>
                  <div>Date: {aiResult.invoice_date}</div>
                  <div>Amount: ₹{aiResult.total_amount}</div>
                  <div>Items: {aiResult.items?.length || 0}</div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm h-20"
                placeholder="Any additional notes..."
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={() => setStep(1)} variant="outline" className="flex-1">Back</Button>
              <Button onClick={() => setStep(3)} className="flex-1">Next: Items</Button>
            </div>
          </div>
        )}

        {/* Step 3: Line Items */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">Step 3: Invoice Items</h3>
            {items.length === 0 ? (
              <p className="text-sm text-slate-500">No items yet. Add one below.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {items.map((it, i) => (
                  <div key={it.key} className="border border-slate-200 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-medium text-slate-500">Item {i + 1}</span>
                      <button onClick={() => removeItem(it.key)} className="text-red-600 hover:text-red-700">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={it.item_code}
                        onChange={e => updateItem(it.key, 'item_code', e.target.value)}
                        placeholder="Item Code"
                        className="text-xs border border-slate-200 rounded px-2 py-1"
                      />
                      <input
                        type="text"
                        value={it.item_name}
                        onChange={e => updateItem(it.key, 'item_name', e.target.value)}
                        placeholder="Description"
                        className="text-xs border border-slate-200 rounded px-2 py-1"
                      />
                      <select
                        value={it.uom_code}
                        onChange={e => updateItem(it.key, 'uom_code', e.target.value)}
                        className="text-xs border border-slate-200 rounded px-2 py-1"
                      >
                        <option value="">UOM</option>
                        {uoms.map(u => (
                          <option key={u.uom_id} value={u.uom_id}>{u.uom_code}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        value={it.qty}
                        onChange={e => updateItem(it.key, 'qty', parseFloat(e.target.value) || 0)}
                        placeholder="Qty"
                        className="text-xs border border-slate-200 rounded px-2 py-1"
                      />
                      <input
                        type="number"
                        value={it.rate}
                        onChange={e => updateItem(it.key, 'rate', parseFloat(e.target.value) || 0)}
                        placeholder="Rate"
                        className="text-xs border border-slate-200 rounded px-2 py-1"
                      />
                      <input
                        type="number"
                        value={it.amount}
                        onChange={e => updateItem(it.key, 'amount', parseFloat(e.target.value) || 0)}
                        placeholder="Amount"
                        className="text-xs border border-slate-200 rounded px-2 py-1"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button onClick={addItem} variant="outline" className="w-full gap-2">
              <Plus className="w-4 h-4" /> Add Item
            </Button>

            <div className="flex gap-2 pt-4 border-t">
              <Button onClick={() => setStep(2)} variant="outline" className="flex-1">Back</Button>
              <Button
                onClick={handleSubmit}
                disabled={submitLoading || !supplierId || !invoiceFile}
                className="flex-1 gap-2"
              >
                {submitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save as Draft
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}