import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { X, Download, Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const IMPORT_COLUMNS = [
  { key: 'name', label: 'Customer Name', required: true, example: 'Swiggy Pvt Ltd' },
  { key: 'code', label: 'Code', required: false, example: 'CUST-001 (leave blank to auto-assign)' },
  { key: 'customer_type', label: 'Customer Type', required: false, example: 'Company' },
  { key: 'customer_group', label: 'Customer Group', required: false, example: 'Quick Commerce' },
  { key: 'salutation', label: 'Salutation', required: false, example: 'Mr' },
  { key: 'first_name', label: 'First Name', required: false, example: 'Rahul' },
  { key: 'last_name', label: 'Last Name', required: false, example: 'Sharma' },
  { key: 'contact_name', label: 'Contact Name', required: false, example: 'Rahul Sharma' },
  { key: 'mobile_no', label: 'Mobile Number', required: false, example: '9876543210' },
  { key: 'phone', label: 'Phone', required: false, example: '02212345678' },
  { key: 'email', label: 'Email ID', required: false, example: 'accounts@swiggy.com' },
  { key: 'gstin', label: 'GSTIN / UIN', required: false, example: '27AAACS1234A1Z5' },
  { key: 'pan', label: 'PAN', required: false, example: 'AAACS1234A' },
  { key: 'gst_category', label: 'GST Category', required: false, example: 'Registered Regular' },
  { key: 'place_of_supply', label: 'Place of Supply', required: false, example: '27' },
  { key: 'billing_address', label: 'Billing Address', required: false, example: '123 MG Road Mumbai' },
  { key: 'shipping_address', label: 'Shipping Address', required: false, example: '123 MG Road Mumbai' },
  { key: 'territory', label: 'Territory', required: false, example: 'Maharashtra' },
  { key: 'region', label: 'Region', required: false, example: 'Mumbai' },
  { key: 'outlet_id', label: 'Outlet ID', required: false, example: 'OUT-001' },
  { key: 'market_segment', label: 'Market Segment', required: false, example: 'Modern Trade' },
  { key: 'industry', label: 'Industry', required: false, example: 'Food & Beverage' },
  { key: 'account_manager', label: 'Account Manager', required: false, example: 'Priya Singh' },
  { key: 'price_list', label: 'Price List', required: false, example: 'Swiggy Rate List' },
  { key: 'payment_terms', label: 'Payment Terms', required: false, example: 'Net 30' },
  { key: 'billing_currency', label: 'Billing Currency', required: false, example: 'INR' },
  { key: 'outstanding_limit', label: 'Credit Limit', required: false, example: '500000' },
  { key: 'sales_partner', label: 'Sales Partner', required: false, example: 'Partner A' },
  { key: 'tally_parent_group', label: 'Tally Parent Group', required: false, example: 'Sundry Debtors' },
  { key: 'status', label: 'Status', required: false, example: 'active' },
];

function downloadTemplate() {
  const header = IMPORT_COLUMNS.map(c => c.label).join(',');
  const example = IMPORT_COLUMNS.map(c => `"${c.example}"`).join(',');
  const blob = new Blob([header + '\n' + example], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'customer_import_template.csv';
  a.click();
}

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return { rows: [], errors: ['File must have a header row and at least one data row'] };

  const rawHeaders = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
  const colMap = {};
  for (const col of IMPORT_COLUMNS) {
    const idx = rawHeaders.indexOf(col.label.toLowerCase());
    if (idx !== -1) colMap[col.key] = idx;
  }

  const rows = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) || [];
    const clean = vals.map(v => v.replace(/^"|"$/g, '').trim());
    const row = {};
    for (const [key, idx] of Object.entries(colMap)) {
      row[key] = clean[idx] || '';
    }
    if (!row.name) { errors.push(`Row ${i + 1}: Customer Name is required`); continue; }
    rows.push({ ...row, _line: i + 1 });
  }

  return { rows, errors };
}

function generateCode(existingCodes, prefix = 'CUST') {
  const nums = existingCodes
    .filter(c => c?.startsWith(prefix + '-'))
    .map(c => parseInt(c.replace(prefix + '-', ''), 10))
    .filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

export default function CustomerImportModal({ onClose, onImported, existingCustomers = [] }) {
  const { toast } = useToast();
  const fileRef = useRef();
  const [step, setStep] = useState('upload'); // upload | preview | done
  const [rows, setRows] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { rows: parsed, errors } = parseCSV(ev.target.result);
      setParseErrors(errors);
      setRows(parsed);
      setStep('preview');
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    setImporting(true);
    let created = 0, skipped = 0;
    const existingCodes = [...existingCustomers.map(c => c.code).filter(Boolean)];

    for (const row of rows) {
      // Skip duplicates by GSTIN or name
      const duplicate = existingCustomers.find(c =>
        (row.gstin && c.gstin?.toLowerCase() === row.gstin.toLowerCase()) ||
        c.name?.toLowerCase() === row.name.toLowerCase()
      );
      if (duplicate) { skipped++; continue; }

      const code = row.code || generateCode(existingCodes);
      existingCodes.push(code);

      await base44.entities.Customer.create({
        name: row.name,
        code,
        customer_type: row.customer_type || 'Company',
        customer_group: row.customer_group || '',
        salutation: row.salutation || '',
        first_name: row.first_name || '',
        last_name: row.last_name || '',
        contact_name: row.contact_name || '',
        mobile_no: row.mobile_no || '',
        phone: row.phone || '',
        email: row.email || '',
        gstin: row.gstin || '',
        pan: row.pan || '',
        gst_category: row.gst_category || 'Registered Regular',
        place_of_supply: row.place_of_supply || '',
        billing_address: row.billing_address || '',
        shipping_address: row.shipping_address || '',
        territory: row.territory || '',
        region: row.region || '',
        outlet_id: row.outlet_id || '',
        market_segment: row.market_segment || '',
        industry: row.industry || '',
        account_manager: row.account_manager || '',
        price_list: row.price_list || '',
        payment_terms: row.payment_terms || '',
        billing_currency: row.billing_currency || 'INR',
        outstanding_limit: parseFloat(row.outstanding_limit) || 0,
        sales_partner: row.sales_partner || '',
        tally_parent_group: row.tally_parent_group || '',
        status: row.status || 'active',
      });
      created++;
    }

    setResults({ created, skipped });
    setStep('done');
    setImporting(false);
    toast({ title: `Import complete — ${created} customers added, ${skipped} skipped` });
    onImported();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Import Customers</h2>
            <p className="text-xs text-slate-500 mt-0.5">Upload a CSV to create multiple customers at once with price list assignments</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {step === 'upload' && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                <strong>Step 1:</strong> Download the template, fill in your customer data, then upload the file.
              </div>
              <Button variant="outline" className="h-11 w-full" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-2" /> Download Import Template (CSV)
              </Button>
              <div className="text-xs text-slate-500">
                <strong>Required:</strong> Customer Name &nbsp;|&nbsp; <strong>Optional:</strong> Code (auto-assigned if blank), Price List, GSTIN, Group, Payment Terms, etc.
              </div>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
                <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500 mb-3">Select your filled CSV file</p>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
                <Button className="h-11 bg-slate-900 text-white" onClick={() => fileRef.current?.click()}>
                  Choose CSV File
                </Button>
              </div>
            </>
          )}

          {step === 'preview' && (
            <>
              {parseErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                  {parseErrors.map((e, i) => (
                    <div key={i} className="flex gap-2 text-sm text-red-700"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{e}</div>
                  ))}
                </div>
              )}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                <strong>{rows.length} customers</strong> ready to import. Review below then click Import.
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700">
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Code</th>
                      <th className="px-3 py-2 text-left">Group</th>
                      <th className="px-3 py-2 text-left">Price List</th>
                      <th className="px-3 py-2 text-left">GSTIN</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-900">{r.name}</td>
                        <td className="px-3 py-2 text-slate-500 font-mono">{r.code || <span className="italic text-slate-400">auto</span>}</td>
                        <td className="px-3 py-2 text-slate-600">{r.customer_group || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{r.price_list || '—'}</td>
                        <td className="px-3 py-2 font-mono text-slate-500">{r.gstin || '—'}</td>
                        <td className="px-3 py-2">{r.status || 'active'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="text-xs text-slate-500 underline" onClick={() => { setStep('upload'); setRows([]); setParseErrors([]); }}>
                Upload a different file
              </button>
            </>
          )}

          {step === 'done' && results && (
            <div className="text-center py-8 space-y-4">
              <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
              <div>
                <p className="text-lg font-semibold text-slate-900">Import Complete</p>
                <p className="text-sm text-slate-600 mt-1">{results.created} customers created · {results.skipped} skipped (duplicates)</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
          {step === 'done' ? (
            <Button className="h-11 bg-slate-900 text-white" onClick={onClose}>Close</Button>
          ) : (
            <>
              <Button variant="outline" className="h-11 px-4" onClick={onClose}>Cancel</Button>
              {step === 'preview' && rows.length > 0 && (
                <Button className="h-11 bg-slate-900 text-white" onClick={handleImport} disabled={importing}>
                  {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                  Import {rows.length} Customers
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}