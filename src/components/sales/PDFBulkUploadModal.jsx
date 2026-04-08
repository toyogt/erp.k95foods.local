import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { X, Upload, Loader2, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { extractTextFromFile } from '@/lib/pdfTextExtractor';
import { parsePDFText } from '@/lib/salesPDFParser';
import { enrichParsedData } from '@/lib/salesPDFEnricher';
import PDFProcessingSteps from './PDFProcessingSteps';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import PDFInvoiceSplitView from './PDFInvoiceSplitView';
import { triggerFMSProcess } from '@/lib/useFMSAutoComplete';
import { generateDocNumber } from '@/lib/docNumberHelper';

// Status badge per PDF
function FilePill({ entry, active, onClick }) {
  const statusIcon = entry.status === 'done' ? <CheckCircle2 className="w-3 h-3 text-green-500" />
    : entry.status === 'error' ? <AlertCircle className="w-3 h-3 text-red-400" />
    : entry.status === 'parsing' ? <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
    : entry.status === 'confirmed' ? <CheckCircle2 className="w-3 h-3 text-emerald-600" />
    : <FileText className="w-3 h-3 text-slate-400" />;

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left w-full truncate ${
        active ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
      }`}
    >
      {statusIcon}
      <span className="truncate">{entry.filename}</span>
    </button>
  );
}

export default function PDFBulkUploadModal({ onClose, onCreated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef();
  const [entries, setEntries] = useState([]); // { id, filename, pdfUrl, status, data, error, steps }
  const [activeId, setActiveId] = useState(null);

  const INITIAL_STEPS = [
    { key: 'upload', label: 'Uploading PDF', status: 'pending', detail: '' },
    { key: 'parse', label: 'Extracting data from PDF', status: 'pending', detail: '' },
    { key: 'customer', label: 'Looking up customer', status: 'pending', detail: '' },
    { key: 'pricelist', label: 'Resolving price list', status: 'pending', detail: '' },
    { key: 'rates', label: 'Fetching item rates', status: 'pending', detail: '' },
  ];

  function setStep(id, key, status, detail = '') {
    setEntries(prev => prev.map(e => e.id !== id ? e : {
      ...e,
      steps: (e.steps || INITIAL_STEPS).map(s => s.key === key ? { ...s, status, detail } : s)
    }));
  }

  const activeEntry = entries.find(e => e.id === activeId);
  const successCount = entries.filter(e => e.status === 'confirmed').length;
  const totalCount = entries.length;

  async function processFile(file) {
    const id = `${Date.now()}-${Math.random()}`;
    const filename = file.name;

    setEntries(prev => [...prev, { id, filename, pdfUrl: null, status: 'uploading', data: null, steps: INITIAL_STEPS }]);
    setActiveId(id);

    // Step 1: Upload + extract text in parallel (browser-side, instant)
    setStep(id, 'upload', 'active', 'Uploading & reading text...');
    const [uploadResult, rawText] = await Promise.all([
      base44.integrations.Core.UploadFile({ file }),
      extractTextFromFile(file).catch(() => ''),
    ]);
    const file_url = uploadResult.file_url;
    setStep(id, 'upload', 'done', 'Uploaded successfully');
    setEntries(prev => prev.map(e => e.id === id ? { ...e, pdfUrl: file_url } : e));

    // Step 2: Parse (browser regex — instant for known platforms)
    setStep(id, 'parse', 'active', 'Detecting platform & extracting items...');
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: 'parsing' } : e));

    let d = null;
    const browserParsed = rawText ? parsePDFText(rawText) : null;

    if (browserParsed && browserParsed.items?.length > 0) {
      // Known platform — enrich in browser
      setStep(id, 'parse', 'done', `${browserParsed.items.length} items extracted (${browserParsed.platform})`);
      setStep(id, 'customer', 'active', 'Looking up customer & rates...');
      d = await enrichParsedData(browserParsed);
      setStep(id, 'customer', 'done', d._customer_found ? `Matched: ${d.customer_name}` : 'Not found — please verify');
      setStep(id, 'pricelist', 'done', d._price_list_used ? `Using: ${d._price_list_used}` : 'No specific price list');
      setStep(id, 'rates', 'done', `${d._matched_count} of ${d._total_items} items rate-matched`);
    } else {
      // Unknown platform — fall back to backend LLM
      setStep(id, 'parse', 'active', 'Unknown format — using AI extraction...');
      const res = await base44.functions.invoke('parseSalesPDF', { pdf_url: file_url, raw_text: rawText });
      if (!res.data?.success) {
        setStep(id, 'parse', 'error', 'Could not extract data');
        setEntries(prev => prev.map(e => e.id === id ? { ...e, status: 'error', error: 'Parsing failed' } : e));
        return;
      }
      d = res.data.data;
      setStep(id, 'parse', 'done', `${d.items?.length || 0} items extracted`);
      setStep(id, 'customer', 'done', d._customer_found ? `Matched: ${d.customer_name}` : 'Not found — please verify');
      setStep(id, 'pricelist', 'done', d._price_list_used ? `Using: ${d._price_list_used}` : 'No specific price list');
      setStep(id, 'rates', 'done', `${d._matched_count || 0} of ${d._total_items || 0} items rate-matched`);
    }

    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: 'done', data: d } : e));
  }

  async function handleFiles(files) {
    // Process all files in parallel for maximum speed
    const pdfs = Array.from(files).filter(f => f.type === 'application/pdf');
    await Promise.all(pdfs.map(f => processFile(f)));
  }

  async function handleConfirm(entryId, confirmedData) {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    const soNumber = await generateDocNumber('SO');
    const so = await base44.entities.SalesOrder.create({
      customer_name: confirmedData.customer_name || '',
      customer_gstin: confirmedData.customer_gstin || '',
      billing_address: confirmedData.billing_address || '',
      shipping_address: confirmedData.shipping_address || '',
      po_number: confirmedData.po_number || '',
      po_date: confirmedData.po_date || '',
      po_expiry_date: confirmedData.po_expiry_date || '',
      po_delivery_date: confirmedData.po_delivery_date || '',
      payment_terms: confirmedData.payment_terms || '',
      platform: confirmedData.platform || 'direct',
      vendor_no: confirmedData.vendor_no || '',
      taxable_amount: confirmedData.taxable_amount || 0,
      tax_amount: confirmedData.tax_amount || 0,
      total_amount: confirmedData.total_amount || 0,
      pdf_url: entry.pdfUrl,
      source: 'pdf_upload',
      status: 'confirmed',
      so_number: soNumber,
    });

    if (confirmedData.items?.length) {
      const itemPayloads = confirmedData.items.map(item => ({
        ...item,
        sales_order_id: so.id,
        so_number: soNumber,
        stock_status: 'not_checked',
      }));
      await base44.entities.SalesOrderItem.bulkCreate(itemPayloads);
    }

    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesOrder', entity_id: so.id,
      reference_number: soNumber, action: 'created',
      new_value: JSON.stringify({ status: 'confirmed', source: 'pdf_upload' }),
      user_email: user?.email,
    });

    await triggerFMSProcess({
      triggerSource: 'sales_order_created', triggerRefId: so.id,
      title: `Sales Order ${soNumber}`,
      triggerData: { so_number: soNumber, customer: confirmedData.customer_name },
    });

    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, status: 'confirmed' } : e));
    toast({ title: 'Sales Order created', description: soNumber });
    onCreated(so);

    // Auto-advance to next pending
    const next = entries.find(e => e.id !== entryId && e.status === 'done');
    if (next) setActiveId(next.id);
  }

  const pendingCount = entries.filter(e => e.status === 'done').length;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[96vw] flex flex-col" style={{ height: '94vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Upload Invoices (PDF → SO)</h2>
            {totalCount > 0 && (
              <p className="text-xs text-slate-500 mt-0.5">
                {successCount} of {totalCount} confirmed &nbsp;·&nbsp;
                {pendingCount} pending review
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {totalCount > 0 && (
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => fileRef.current?.click()}>
                <Upload className="w-3.5 h-3.5" /> Upload More
              </Button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Body */}
        {totalCount === 0 ? (
          // Drop zone
          <div className="flex-1 flex items-center justify-center p-8">
            <div
              className="border-2 border-dashed border-slate-200 rounded-2xl p-16 text-center cursor-pointer hover:border-slate-400 transition-colors w-full max-w-lg"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            >
              <Upload className="w-10 h-10 text-slate-300 mx-auto mb-4" />
              <p className="text-sm font-semibold text-slate-700">Drop PDFs here or click to upload</p>
              <p className="text-xs text-slate-400 mt-1">Multiple files supported — Blinkit, Swiggy, Zepto auto-detected</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Left sidebar — file list */}
            <div className="w-48 flex-shrink-0 border-r border-slate-100 flex flex-col bg-slate-50">
              <div className="p-3 space-y-1.5 overflow-y-auto flex-1">
                {entries.map(entry => (
                  <FilePill
                    key={entry.id}
                    entry={entry}
                    active={activeId === entry.id}
                    onClick={() => setActiveId(entry.id)}
                  />
                ))}
              </div>
              <div
                className="p-3 border-t border-slate-200 text-xs text-center text-slate-500 cursor-pointer hover:bg-slate-100 rounded-b-2xl"
                onClick={() => fileRef.current?.click()}
              >
                + Add more PDFs
              </div>
            </div>

            {/* Right — split view */}
            <div className="flex-1 overflow-hidden">
            {activeEntry ? (
              activeEntry.status === 'uploading' || activeEntry.status === 'parsing' ? (
                <PDFProcessingSteps steps={activeEntry.steps || []} filename={activeEntry.filename} />
              ) : activeEntry.status === 'error' ? (
                <div className="flex-1 flex flex-col items-center justify-center h-full text-red-400 gap-3">
                  <AlertCircle className="w-8 h-8" />
                  <p className="text-sm">Could not extract data from this PDF</p>
                </div>
              ) : activeEntry.status === 'confirmed' ? (
                <div className="flex-1 flex flex-col items-center justify-center h-full text-emerald-500 gap-3">
                  <CheckCircle2 className="w-10 h-10" />
                  <p className="text-sm font-medium">Sales Order created successfully</p>
                </div>
              ) : (
                <PDFInvoiceSplitView
                  key={activeEntry.id}
                  pdfEntry={activeEntry}
                  onConfirm={(confirmedData) => handleConfirm(activeEntry.id, confirmedData)}
                />
              )
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">Select a file to preview</div>
            )}
            </div>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={e => { if (e.target.files) handleFiles(e.target.files); }}
        />
      </div>
    </div>
  );
}