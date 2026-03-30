import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { X, Download, Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const IMPORT_COLUMNS = [
  { key: 'name', label: 'Customer Name', required: true, example: 'Swiggy Pvt Ltd' },
  { key: 'code', label: 'Customer Code', required: false, example: 'CUST-001 (leave blank to auto-assign)' },
  { key: 'series', label: 'Series', required: false, example: 'CUST-' },
  { key: 'customer_type', label: 'Customer Type', required: false, example: 'Company' },
  { key: 'customer_group', label: 'Customer Group', required: false, example: 'Quick Commerce' },
  { key: 'salutation', label: 'Salutation', required: false, example: 'Mr' },
  { key: 'first_name', label: 'First Name', required: false, example: 'Rahul' },
  { key: 'last_name', label: 'Last Name', required: false, example: 'Sharma' },
  { key: 'gender', label: 'Gender', required: false, example: 'Male' },
  { key: 'contact_name', label: 'Contact Name', required: false, example: 'Rahul Sharma' },
  { key: 'mobile_no', label: 'Mobile No', required: false, example: '9876543210' },
  { key: 'phone', label: 'Phone', required: false, example: '02212345678' },
  { key: 'email', label: 'Email Id', required: false, example: 'accounts@swiggy.com' },
  { key: 'website', label: 'Website', required: false, example: 'https://swiggy.com' },
  { key: 'from_lead', label: 'From Lead', required: false, example: '' },
  { key: 'from_opportunity', label: 'From Opportunity', required: false, example: '' },
  { key: 'from_prospect', label: 'From Prospect', required: false, example: '' },
  { key: 'account_manager', label: 'Account Manager', required: false, example: 'Priya Singh' },
  { key: 'billing_currency', label: 'Billing Currency', required: false, example: 'INR' },
  { key: 'default_bank_account', label: 'Default Company Bank Account', required: false, example: '' },
  { key: 'check_outstanding', label: 'Check Outstanding', required: false, example: 'false' },
  { key: 'price_list', label: 'Default Price List', required: false, example: 'Swiggy Rate List' },
  { key: 'outstanding_limit', label: 'Outstanding Limit', required: false, example: '500000' },
  { key: 'current_outstanding', label: 'Current Outstanding', required: false, example: '0' },
  { key: 'leverage_outstanding', label: 'Leverage Outstanding', required: false, example: '0' },
  { key: 'is_internal_customer', label: 'Is Internal Customer', required: false, example: 'false' },
  { key: 'represents_company', label: 'Represents Company', required: false, example: 'false' },
  { key: 'market_segment', label: 'Market Segment', required: false, example: 'Modern Trade' },
  { key: 'industry', label: 'Industry', required: false, example: 'Food & Beverage' },
  { key: 'customer_pos_id', label: 'Customer POS id', required: false, example: 'POS-001' },
  { key: 'print_language', label: 'Print Language', required: false, example: 'English' },
  { key: 'customer_details', label: 'Customer Details', required: false, example: '' },
  { key: 'customer_primary_address', label: 'Customer Primary Address', required: false, example: '' },
  { key: 'primary_address', label: 'Primary Address', required: false, example: '' },
  { key: 'customer_primary_contact', label: 'Customer Primary Contact', required: false, example: '' },
  { key: 'gstin', label: 'GSTIN / UIN', required: false, example: '27AAACS1234A1Z5' },
  { key: 'pan', label: 'PAN', required: false, example: 'AAACS1234A' },
  { key: 'tax_id', label: 'Tax ID', required: false, example: '' },
  { key: 'gst_category', label: 'GST Category', required: false, example: 'Registered Regular' },
  { key: 'tax_category', label: 'Tax Category', required: false, example: '' },
  { key: 'tax_withholding_category', label: 'Tax Withholding Category', required: false, example: '' },
  { key: 'payment_terms', label: 'Default Payment Terms Template', required: false, example: 'Net 30' },
  { key: 'loyalty_program', label: 'Loyalty Program', required: false, example: '' },
  { key: 'loyalty_program_tier', label: 'Loyalty Program Tier', required: false, example: '' },
  { key: 'sales_partner', label: 'Sales Partner', required: false, example: 'Partner A' },
  { key: 'commission_rate', label: 'Commission Rate', required: false, example: '5' },
  { key: 'allow_invoice_without_so', label: 'Allow Sales Invoice Creation Without Sales Order', required: false, example: 'false' },
  { key: 'allow_invoice_without_dn', label: 'Allow Sales Invoice Creation Without Delivery Note', required: false, example: 'false' },
  { key: 'is_frozen', label: 'Is Frozen', required: false, example: 'false' },
  { key: 'disabled', label: 'Disabled', required: false, example: 'false' },
  { key: 'tally_synced', label: 'Tally Synced', required: false, example: 'false' },
  { key: 'tally_sync_date', label: 'Tally Sync Date', required: false, example: '' },
  { key: 'tally_sync_status', label: 'Tally Sync Status', required: false, example: '' },
  { key: 'tally_parent_group', label: 'Tally Parent Group', required: false, example: 'Sundry Debtors' },
  { key: 'billing_address', label: 'Billing Address', required: false, example: '123 MG Road Mumbai' },
  { key: 'shipping_address', label: 'Shipping Address', required: false, example: '123 MG Road Mumbai' },
  { key: 'territory', label: 'Territory', required: false, example: 'Maharashtra' },
  { key: 'region', label: 'Region', required: false, example: 'Mumbai' },
  { key: 'outlet_id', label: 'Outlet ID', required: false, example: 'OUT-001' },
  { key: 'place_of_supply', label: 'Place of Supply (State Code)', required: false, example: '27' },
  { key: 'bypass_credit_limit_check', label: 'Bypass Credit Limit Check at Sales Order (Credit Limit)', required: false, example: 'false' },
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

      const parseBool = (v) => v === 'true' || v === '1' || v === 'yes';
      await base44.entities.Customer.create({
        name: row.name,
        code,
        series: row.series || '',
        customer_type: row.customer_type || 'Company',
        customer_group: row.customer_group || '',
        salutation: row.salutation || '',
        first_name: row.first_name || '',
        last_name: row.last_name || '',
        gender: row.gender || '',
        contact_name: row.contact_name || '',
        mobile_no: row.mobile_no || '',
        phone: row.phone || '',
        email: row.email || '',
        website: row.website || '',
        from_lead: row.from_lead || '',
        from_opportunity: row.from_opportunity || '',
        from_prospect: row.from_prospect || '',
        account_manager: row.account_manager || '',
        billing_currency: row.billing_currency || 'INR',
        default_bank_account: row.default_bank_account || '',
        check_outstanding: parseBool(row.check_outstanding),
        price_list: row.price_list || '',
        outstanding_limit: parseFloat(row.outstanding_limit) || 0,
        current_outstanding: parseFloat(row.current_outstanding) || 0,
        leverage_outstanding: parseFloat(row.leverage_outstanding) || 0,
        is_internal_customer: parseBool(row.is_internal_customer),
        represents_company: parseBool(row.represents_company),
        market_segment: row.market_segment || '',
        industry: row.industry || '',
        customer_pos_id: row.customer_pos_id || '',
        print_language: row.print_language || '',
        customer_details: row.customer_details || '',
        customer_primary_address: row.customer_primary_address || '',
        primary_address: row.primary_address || '',
        customer_primary_contact: row.customer_primary_contact || '',
        gstin: row.gstin || '',
        pan: row.pan || '',
        tax_id: row.tax_id || '',
        gst_category: row.gst_category || 'Registered Regular',
        tax_category: row.tax_category || '',
        tax_withholding_category: row.tax_withholding_category || '',
        payment_terms: row.payment_terms || '',
        loyalty_program: row.loyalty_program || '',
        loyalty_program_tier: row.loyalty_program_tier || '',
        sales_partner: row.sales_partner || '',
        commission_rate: parseFloat(row.commission_rate) || 0,
        allow_invoice_without_so: parseBool(row.allow_invoice_without_so),
        allow_invoice_without_dn: parseBool(row.allow_invoice_without_dn),
        is_frozen: parseBool(row.is_frozen),
        disabled: parseBool(row.disabled),
        tally_synced: parseBool(row.tally_synced),
        tally_sync_date: row.tally_sync_date || '',
        tally_sync_status: row.tally_sync_status || '',
        tally_parent_group: row.tally_parent_group || '',
        billing_address: row.billing_address || '',
        shipping_address: row.shipping_address || '',
        territory: row.territory || '',
        region: row.region || '',
        outlet_id: row.outlet_id || '',
        place_of_supply: row.place_of_supply || '',
        bypass_credit_limit_check: parseBool(row.bypass_credit_limit_check),
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