import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Upload, AlertCircle, CheckCircle, Loader2, Download } from 'lucide-react';

const REQUIRED_COLS = ['item_code', 'batch_no', 'qty_boxes', 'warehouse_location'];
const SAMPLE_CSV = `item_code,batch_no,mfg_date,exp_date,qty_boxes,warehouse_location
SKU001,BATCH-2024-01,2024-01-01,2026-01-01,50,WAREHOUSE-1
SKU002,BATCH-2024-02,2024-02-01,2026-02-01,30,WAREHOUSE-2`;

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const rows = lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
  return { headers, rows };
}

export default function OpeningStockImport() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [csvText, setCsvText] = useState('');
  const [parsed, setParsed] = useState(null); // { rows, validation }
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null); // { imported, skipped, errors }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([base44.auth.me(), base44.entities.ProductMaster.filter({}, 'item_code', 500)])
      .then(([u, prods]) => { setUser(u); setProducts(prods); setLoading(false); });
  }, []);

  function handleParse() {
    const { headers, rows } = parseCSV(csvText);
    const missingCols = REQUIRED_COLS.filter(c => !headers.includes(c));
    if (missingCols.length) {
      setParsed({ error: `Missing columns: ${missingCols.join(', ')}` });
      return;
    }
    const validItemCodes = new Set(products.map(p => p.item_code));
    const validated = rows.map((row, i) => {
      const errors = [];
      if (!row.item_code) errors.push('item_code required');
      if (!row.batch_no) errors.push('batch_no required');
      const qty = Number(row.qty_boxes);
      if (isNaN(qty) || qty <= 0) errors.push('qty_boxes must be > 0');
      if (!row.warehouse_location) errors.push('warehouse_location required');
      const unknownSku = row.item_code && !validItemCodes.has(row.item_code);
      return { ...row, _line: i + 2, _errors: errors, _unknownSku: unknownSku, _qty: qty };
    });
    setParsed({ rows: validated });
    setResult(null);
  }

  async function handleImport() {
    if (!parsed?.rows) return;
    setImporting(true);
    let imported = 0, skipped = 0;
    const errors = [];

    for (const row of parsed.rows) {
      if (row._errors.length) { skipped++; continue; }
      try {
        // Check for existing lot to merge
        const existing = await base44.entities.LegacyStockLot.filter({
          item_code: row.item_code,
          batch_no: row.batch_no,
          current_location: row.warehouse_location,
        }, '-created_date', 1);

        let lotId;
        if (existing.length) {
          await base44.entities.LegacyStockLot.update(existing[0].id, {
            qty_boxes: existing[0].qty_boxes + row._qty,
          });
          lotId = existing[0].id;
        } else {
          const lot = await base44.entities.LegacyStockLot.create({
            item_code: row.item_code,
            batch_no: row.batch_no,
            mfg_date: row.mfg_date || '',
            exp_date: row.exp_date || '',
            qty_boxes: row._qty,
            current_location: row.warehouse_location,
            source: 'OPENING',
            imported_at: new Date().toISOString(),
            imported_by: user?.email || '',
          });
          lotId = lot.id;
        }
        await base44.entities.LegacyStockMove.create({
          lot_id: lotId,
          item_code: row.item_code,
          batch_no: row.batch_no,
          qty_boxes: row._qty,
          direction: 'IN',
          reference_doc_no: 'OPENING',
          moved_at: new Date().toISOString(),
          moved_by: user?.email || '',
        });
        imported++;
      } catch (e) {
        errors.push(`Row ${row._line}: ${e.message}`);
        skipped++;
      }
    }
    setResult({ imported, skipped, errors });
    setImporting(false);
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'opening_stock_template.csv';
    a.click(); URL.revokeObjectURL(url);
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  );

  if (user?.role !== 'admin') return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-2">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
        <p className="font-semibold text-slate-700">Admin access required</p>
      </div>
    </div>
  );

  const validRows = parsed?.rows?.filter(r => !r._errors.length) || [];
  const invalidRows = parsed?.rows?.filter(r => r._errors.length) || [];
  const warnRows = parsed?.rows?.filter(r => !r._errors.length && r._unknownSku) || [];

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Opening Stock Import</h2>
        <p className="text-sm text-slate-500">Import legacy stock lots without serialised labels.</p>
      </div>

      {/* Instructions + template */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
        <div className="flex-1 text-sm text-blue-800">
          Upload or paste a CSV with columns: <code className="bg-blue-100 px-1 rounded">item_code, batch_no, mfg_date, exp_date, qty_boxes, warehouse_location</code>.
          Rows with matching item+batch+location will be merged (qty added).
        </div>
        <Button variant="outline" size="sm" onClick={downloadSample} className="shrink-0 gap-1">
          <Download className="w-3.5 h-3.5" /> Sample CSV
        </Button>
      </div>

      {/* Upload area */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-5 text-center">
          <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-600 mb-2">Drop CSV file or click to upload</p>
          <label className="cursor-pointer text-sm font-semibold text-sky-600 hover:text-sky-800">
            Choose File <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Or paste CSV here</label>
          <textarea
            className="w-full h-32 px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:border-sky-500 focus:outline-none resize-none"
            placeholder={SAMPLE_CSV}
            value={csvText}
            onChange={e => { setCsvText(e.target.value); setParsed(null); setResult(null); }}
          />
        </div>
        <Button onClick={handleParse} disabled={!csvText.trim()} variant="outline" className="w-full h-10">
          Parse &amp; Validate
        </Button>
      </div>

      {/* Validation error */}
      {parsed?.error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />{parsed.error}
        </div>
      )}

      {/* Preview table */}
      {parsed?.rows?.length > 0 && !result && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden space-y-0">
          <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
            <div className="text-sm font-semibold text-slate-700">
              {parsed.rows.length} rows parsed · <span className="text-emerald-600">{validRows.length} valid</span>
              {invalidRows.length > 0 && <span className="text-red-500"> · {invalidRows.length} invalid</span>}
              {warnRows.length > 0 && <span className="text-amber-500"> · {warnRows.length} unknown SKU</span>}
            </div>
            <Button onClick={handleImport} disabled={validRows.length === 0 || importing}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2 h-9">
              {importing ? <><Loader2 className="w-4 h-4 animate-spin" />Importing…</> : `Import ${validRows.length} rows`}
            </Button>
          </div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-slate-500 uppercase tracking-wide">
                  <th className="text-left px-3 py-2">#</th>
                  <th className="text-left px-3 py-2">Item Code</th>
                  <th className="text-left px-3 py-2">Batch</th>
                  <th className="text-left px-3 py-2">Mfg</th>
                  <th className="text-left px-3 py-2">Exp</th>
                  <th className="text-right px-3 py-2">Qty</th>
                  <th className="text-left px-3 py-2">Location</th>
                  <th className="text-left px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {parsed.rows.map((row, i) => (
                  <tr key={i} className={row._errors.length ? 'bg-red-50' : row._unknownSku ? 'bg-amber-50' : ''}>
                    <td className="px-3 py-2 text-slate-400">{row._line}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800">{row.item_code}</td>
                    <td className="px-3 py-2 text-slate-600">{row.batch_no}</td>
                    <td className="px-3 py-2 text-slate-500">{row.mfg_date}</td>
                    <td className="px-3 py-2 text-slate-500">{row.exp_date}</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900">{row.qty_boxes}</td>
                    <td className="px-3 py-2 text-slate-600">{row.warehouse_location}</td>
                    <td className="px-3 py-2">
                      {row._errors.length
                        ? <span className="text-red-600 font-semibold">{row._errors.join('; ')}</span>
                        : row._unknownSku
                          ? <span className="text-amber-600 font-semibold">Unknown SKU</span>
                          : <span className="text-emerald-600 font-semibold">✓ OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import result */}
      {result && (
        <div className="space-y-3">
          <div className={`flex items-center gap-3 rounded-2xl border p-4 ${result.imported > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-slate-900">Import complete</p>
              <p className="text-sm text-slate-600">{result.imported} rows imported · {result.skipped} skipped</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1">
              {result.errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
            </div>
          )}
          <Button variant="outline" onClick={() => { setCsvText(''); setParsed(null); setResult(null); }} className="w-full h-10">
            Import Another File
          </Button>
        </div>
      )}
    </div>
  );
}