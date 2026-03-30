import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Upload, X, Loader2, CheckCircle, AlertTriangle, Download } from 'lucide-react';

/**
 * Generic CSV bulk-update modal.
 * Props:
 *   entityName — display name e.g. "Customer"
 *   columns — [{ key, label }] — only these columns will be shown in template
 *   idColumn — which column is the unique identifier (default: 'id')
 *   updatableColumns — [{ key, label, options? }] — columns user can update
 *   onUpdate — async fn(rows: [{id, ...fields}]) — caller handles the actual update
 *   onClose — fn
 *   templateFilename — e.g. "customers_bulk_update.csv"
 */
export default function BulkCSVUploadModal({
  entityName,
  idColumn = 'id',
  templateColumns = [],
  onUpdate,
  onClose,
  templateFilename = 'bulk_update_template.csv',
}) {
  const { toast } = useToast();
  const fileRef = useRef();
  const [rows, setRows] = useState(null);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [applied, setApplied] = useState(0);

  function downloadTemplate() {
    const header = templateColumns.map(c => c.label).join(',');
    const example = templateColumns.map(c => c.example ?? '').join(',');
    const blob = new Blob([header + '\n' + example], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = templateFilename;
    a.click();
  }

  function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return { rows: [], errors: ['CSV must have a header row and at least one data row'] };
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    const parsed = [];
    const errs = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row = {};
      headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });
      const idVal = row[templateColumns[0]?.key?.toLowerCase()] || row[idColumn?.toLowerCase()];
      if (!idVal) { errs.push(`Row ${i + 1}: Missing identifier`); continue; }
      parsed.push(row);
    }
    return { rows: parsed, errors: errs };
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const { rows: parsed, errors: errs } = parseCSV(ev.target.result);
      setRows(parsed);
      setErrors(errs);
    };
    reader.readAsText(file);
  }

  async function handleApply() {
    if (!rows?.length) return;
    setLoading(true);
    try {
      const count = await onUpdate(rows);
      setApplied(count);
      setDone(true);
      toast({ title: `${entityName} bulk update complete`, description: `${count} records updated` });
    } catch (err) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Bulk Update {entityName}s via CSV</h2>
            <p className="text-xs text-slate-500 mt-0.5">Upload a CSV file to update multiple records at once</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        {!done ? (
          <div className="p-5 space-y-4">
            {/* Step 1: Download template */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs font-semibold text-blue-800 mb-1">Step 1 — Download the template</p>
              <p className="text-xs text-blue-700 mb-2">Fill in the identifier column (first column) plus any fields you want to update. Leave blank to keep existing value.</p>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={downloadTemplate}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Download CSV Template
              </Button>
            </div>

            {/* Step 2: Upload */}
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2">Step 2 — Upload filled CSV</p>
              <div
                className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-slate-400 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600">Click to upload or drag & drop</p>
                <p className="text-xs text-slate-400 mt-1">CSV files only</p>
              </div>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            </div>

            {/* Preview */}
            {rows && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-3 py-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-slate-900">{rows.length} rows parsed</span>
                </div>
                <div className="overflow-x-auto max-h-40">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {templateColumns.map(c => (
                          <th key={c.key} className="px-3 py-2 text-left text-slate-600 font-medium">{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.slice(0, 5).map((row, i) => (
                        <tr key={i}>
                          {templateColumns.map(c => (
                            <td key={c.key} className="px-3 py-1.5 text-slate-700">{row[c.key] || row[c.label?.toLowerCase()] || '—'}</td>
                          ))}
                        </tr>
                      ))}
                      {rows.length > 5 && (
                        <tr><td colSpan={templateColumns.length} className="px-3 py-1.5 text-slate-400 text-center">+ {rows.length - 5} more rows</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Errors */}
            {errors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-1">
                <div className="flex items-center gap-1.5 text-red-700">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-xs font-semibold">{errors.length} issues found</span>
                </div>
                {errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" className="h-11 px-4" onClick={onClose}>Cancel</Button>
              <Button
                className="h-11 bg-slate-900 text-white"
                onClick={handleApply}
                disabled={!rows?.length || loading}
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Updating...</> : `Apply to ${rows?.length ?? 0} Records`}
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center space-y-3">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <p className="text-lg font-semibold text-slate-900">Update Complete</p>
            <p className="text-sm text-slate-500">{applied} {entityName.toLowerCase()}s were updated successfully.</p>
            <Button className="h-11 bg-slate-900 text-white mt-2" onClick={onClose}>Done</Button>
          </div>
        )}
      </div>
    </div>
  );
}