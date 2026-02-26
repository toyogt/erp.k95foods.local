import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Upload, AlertCircle, CheckCircle, Loader2, Download, Plus, Trash2, Save } from 'lucide-react';

const SAMPLE_CSV = `item_code,batch_no,mfg_date,exp_date,qty_boxes,warehouse_location
SKU001,BATCH-2024-01,2024-01-01,2026-01-01,50,WAREHOUSE-1
SKU002,BATCH-2024-02,2024-02-01,2026-02-01,30,WAREHOUSE-2`;

const REQUIRED_COLS = ['item_code', 'batch_no', 'qty_boxes', 'warehouse_location'];

const emptyRow = () => ({ item_code: '', batch_no: '', mfg_date: '', exp_date: '', qty_boxes: '', warehouse_location: 'WAREHOUSE-1' });

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
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('manual'); // 'manual' | 'csv'

  // Manual entry
  const [manualRows, setManualRows] = useState([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);

  // CSV
  const [csvText, setCsvText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    Promise.all([base44.auth.me(), base44.entities.ProductMaster.filter({ is_active: true }, 'product_name', 500)])
      .then(([u, prods]) => { setUser(u); setProducts(prods); setLoading(false); });
  }, []);

  // Manual row helpers
  function updateRow(i, field, val) {
    setManualRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  }
  function addRow() { setManualRows(prev => [...prev, emptyRow()]); }
  function removeRow(i) { setManualRows(prev => prev.filter((_, idx) => idx !== i)); }

  async function handleManualSave() {
    const valid = manualRows.filter(r => r.item_code && r.batch_no && r.qty_boxes && r.warehouse_location);
    if (!valid.length) return;
    setSaving(true);
    let imported = 0;
    for (const row of valid) {
      const qty = Number(row.qty_boxes);
      if (!qty) continue;
      const existing = await base44.entities.LegacyStockLot.filter({
        item_code: row.item_code,
        batch_no: row.batch_no,
        current_location: row.warehouse_location,
      }, '-created_date', 1);

      const prod = products.find(p => p.item_code === row.item_code);
      const productName = prod ? prod.product_name + (prod.flavour ? ` · ${prod.flavour}` : '') : row.item_code;

      if (existing.length) {
        await base44.entities.LegacyStockLot.update(existing[0].id, {
          qty_boxes: existing[0].qty_boxes + qty,
        });
      } else {
        await base44.entities.LegacyStockLot.create({
          item_code: row.item_code,
          product_name: productName,
          batch_no: row.batch_no,
          mfg_date: row.mfg_date || undefined,
          exp_date: row.exp_date || undefined,
          qty_boxes: qty,
          current_location: row.warehouse_location,
          source: 'OPENING',
          imported_at: new Date().toISOString(),
          imported_by: user?.email || '',
        });
      }
      imported++;
    }
    setSaving(false);
    setSaveResult({ imported });
    setManualRows([emptyRow()]);
  }

  // CSV
  function handleParse() {
    const { headers, rows } = parseCSV(csvText);
    const missingCols = REQUIRED_COLS.filter(c => !headers.includes(c));
    if (missingCols.length) { setParsed({ error: `Missing columns: ${missingCols.join(', ')}` }); return; }
    const validItemCodes = new Set(products.map(p => p.item_code));
    const validated = rows.map((row, i) => {
      const errors = [];
      if (!row.item_code) errors.push('item_code required');
      if (!row.batch_no) errors.push('batch_no required');
      const qty = Number(row.qty_boxes);
      if (isNaN(qty) || qty <= 0) errors.push('qty_boxes must be > 0');
      if (!row.warehouse_location) errors.push('warehouse_location required');
      return { ...row, _line: i + 2, _errors: errors, _unknownSku: row.item_code && !validItemCodes.has(row.item_code), _qty: qty };
    });
    setParsed({ rows: validated });
    setImportResult(null);
  }

  async function handleCSVImport() {
    if (!parsed?.rows) return;
    setImporting(true);
    let imported = 0, skipped = 0;
    for (const row of parsed.rows) {
      if (row._errors.length) { skipped++; continue; }
      const existing = await base44.entities.LegacyStockLot.filter({
        item_code: row.item_code,
        batch_no: row.batch_no,
        current_location: row.warehouse_location,
      }, '-created_date', 1);
      const prod = products.find(p => p.item_code === row.item_code);
      const productName = prod ? prod.product_name + (prod.flavour ? ` · ${prod.flavour}` : '') : row.item_code;
      if (existing.length) {
        await base44.entities.LegacyStockLot.update(existing[0].id, { qty_boxes: existing[0].qty_boxes + row._qty });
      } else {
        await base44.entities.LegacyStockLot.create({
          item_code: row.item_code,
          product_name: productName,
          batch_no: row.batch_no,
          mfg_date: row.mfg_date || undefined,
          exp_date: row.exp_date || undefined,
          qty_boxes: row._qty,
          current_location: row.warehouse_location,
          source: 'OPENING',
          imported_at: new Date().toISOString(),
          imported_by: user?.email || '',
        });
      }
      imported++;
    }
    setImportResult({ imported, skipped });
    setImporting(false);
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'opening_stock_template.csv';
    a.click(); URL.revokeObjectURL(url);
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  if (user?.role !== 'admin') return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-2">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
        <p className="font-semibold text-slate-700">Admin access required</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Opening Stock Import</h2>
        <p className="text-sm text-slate-500">Add legacy/non-serialised stock (without QR codes) to the warehouse.</p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {[['manual', 'Manual Entry'], ['csv', 'CSV Upload']].map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${mode === m ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Manual Entry */}
      {mode === 'manual' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <p className="text-sm text-slate-500">Enter each stock item. Items with matching item+batch+location will be merged automatically.</p>

          {saveResult && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-700 text-sm">
              <CheckCircle className="w-4 h-4 shrink-0" />
              {saveResult.imported} lot(s) saved successfully.
              <button onClick={() => setSaveResult(null)} className="ml-auto text-xs text-emerald-500 hover:text-emerald-700">Clear</button>
            </div>
          )}

          <div className="space-y-3">
            {manualRows.map((row, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Item {i + 1}</span>
                  {manualRows.length > 1 && (
                    <button onClick={() => removeRow(i)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-400 mb-0.5 block">Item Code *</label>
                    <select
                      className="w-full h-9 px-2 text-sm rounded-lg border border-slate-300 focus:outline-none"
                      value={row.item_code}
                      onChange={e => updateRow(i, 'item_code', e.target.value)}
                    >
                      <option value="">Select product…</option>
                      {products.map(p => (
                        <option key={p.item_code} value={p.item_code}>
                          {p.item_code} – {p.product_name}{p.flavour ? ` · ${p.flavour}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-0.5 block">Batch No *</label>
                    <input className="w-full h-9 px-2 text-sm rounded-lg border border-slate-300 focus:outline-none"
                      placeholder="e.g. B-2024-01" value={row.batch_no} onChange={e => updateRow(i, 'batch_no', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-0.5 block">Mfg Date</label>
                    <input type="date" className="w-full h-9 px-2 text-sm rounded-lg border border-slate-300 focus:outline-none"
                      value={row.mfg_date} onChange={e => updateRow(i, 'mfg_date', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-0.5 block">Exp Date</label>
                    <input type="date" className="w-full h-9 px-2 text-sm rounded-lg border border-slate-300 focus:outline-none"
                      value={row.exp_date} onChange={e => updateRow(i, 'exp_date', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-0.5 block">Qty Boxes *</label>
                    <input type="number" min={1} className="w-full h-9 px-2 text-sm rounded-lg border border-slate-300 focus:outline-none"
                      placeholder="0" value={row.qty_boxes} onChange={e => updateRow(i, 'qty_boxes', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-0.5 block">Location *</label>
                    <input className="w-full h-9 px-2 text-sm rounded-lg border border-slate-300 focus:outline-none"
                      placeholder="WAREHOUSE-1" value={row.warehouse_location} onChange={e => updateRow(i, 'warehouse_location', e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={addRow} className="gap-2 flex-1 h-10">
              <Plus className="w-4 h-4" /> Add Row
            </Button>
            <Button
              onClick={handleManualSave}
              disabled={saving || !manualRows.some(r => r.item_code && r.batch_no && r.qty_boxes)}
              className="gap-2 flex-1 h-10 bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save Stock'}
            </Button>
          </div>
        </div>
      )}

      {/* CSV Upload */}
      {mode === 'csv' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
            <div className="flex-1 text-sm text-blue-800">
              Columns: <code className="bg-blue-100 px-1 rounded">item_code, batch_no, mfg_date, exp_date, qty_boxes, warehouse_location</code>
            </div>
            <Button variant="outline" size="sm" onClick={downloadSample} className="shrink-0 gap-1">
              <Download className="w-3.5 h-3.5" /> Sample
            </Button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-5 text-center">
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-600 mb-2">Drop CSV file or click to upload</p>
              <label className="cursor-pointer text-sm font-semibold text-sky-600 hover:text-sky-800">
                Choose File <input type="file" accept=".csv,.txt" className="hidden" onChange={async e => { const t = await e.target.files[0]?.text(); if (t) setCsvText(t); }} />
              </label>
            </div>
            <textarea
              className="w-full h-28 px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:border-sky-500 focus:outline-none resize-none"
              placeholder={SAMPLE_CSV}
              value={csvText}
              onChange={e => { setCsvText(e.target.value); setParsed(null); setImportResult(null); }}
            />
            <Button onClick={handleParse} disabled={!csvText.trim()} variant="outline" className="w-full h-10">
              Parse & Validate
            </Button>
          </div>

          {parsed?.error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />{parsed.error}
            </div>
          )}

          {parsed?.rows?.length > 0 && !importResult && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
                <span className="text-sm font-semibold text-slate-700">
                  {parsed.rows.filter(r => !r._errors.length).length} valid · {parsed.rows.filter(r => r._errors.length).length} invalid
                </span>
                <Button onClick={handleCSVImport} disabled={importing}
                  className="bg-emerald-600 hover:bg-emerald-700 gap-2 h-9">
                  {importing ? <><Loader2 className="w-4 h-4 animate-spin" />Importing…</> : `Import ${parsed.rows.filter(r => !r._errors.length).length} rows`}
                </Button>
              </div>
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="text-slate-500 uppercase">
                      <th className="text-left px-3 py-2">Item</th>
                      <th className="text-left px-3 py-2">Batch</th>
                      <th className="text-right px-3 py-2">Qty</th>
                      <th className="text-left px-3 py-2">Location</th>
                      <th className="text-left px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {parsed.rows.map((row, i) => (
                      <tr key={i} className={row._errors.length ? 'bg-red-50' : ''}>
                        <td className="px-3 py-2 font-semibold">{row.item_code}</td>
                        <td className="px-3 py-2">{row.batch_no}</td>
                        <td className="px-3 py-2 text-right font-bold">{row.qty_boxes}</td>
                        <td className="px-3 py-2">{row.warehouse_location}</td>
                        <td className="px-3 py-2">
                          {row._errors.length
                            ? <span className="text-red-600 font-semibold">{row._errors.join('; ')}</span>
                            : <span className="text-emerald-600 font-semibold">✓ OK</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importResult && (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-slate-900">Import complete</p>
                <p className="text-sm text-slate-600">{importResult.imported} rows imported · {importResult.skipped} skipped</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setCsvText(''); setParsed(null); setImportResult(null); }} className="ml-auto">
                Import More
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}