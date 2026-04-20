import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, CheckCircle2, AlertCircle, X, FileSpreadsheet } from 'lucide-react';

export default function UOMImportModal({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | uploading | extracting | importing | done | error
  const [progress, setProgress] = useState({ total: 0, created: 0, skipped: 0, errors: 0 });
  const [errorMsg, setErrorMsg] = useState('');
  const fileRef = useRef();

  async function handleImport() {
    if (!file) return;
    setStatus('uploading');
    setErrorMsg('');

    // Upload file
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    setStatus('extracting');

    // Extract data from Excel
    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: "object",
        properties: {
          rows: {
            type: "array",
            items: {
              type: "object",
              properties: {
                uom_name: { type: "string", description: "UOM Name column" },
                enabled: { type: "number", description: "Enabled column (1 or 0)" },
                must_be_whole_number: { type: "number", description: "Must be Whole Number column (1 or 0)" }
              }
            }
          }
        }
      }
    });

    if (result.status === 'error') {
      setErrorMsg(result.details || 'Failed to extract data from file');
      setStatus('error');
      return;
    }

    const rows = result.output?.rows || [];
    if (rows.length === 0) {
      setErrorMsg('No rows found in file');
      setStatus('error');
      return;
    }

    setStatus('importing');

    // Load existing UOMs to avoid duplicates
    const existing = await base44.entities.UOMMaster.list('uom_name', 500);
    const existingNames = new Set(existing.map(u => u.uom_name?.toLowerCase().trim()));

    let created = 0, skipped = 0, errors = 0;
    const toCreate = [];

    for (const row of rows) {
      const name = row.uom_name?.trim();
      if (!name) { skipped++; continue; }
      if (existingNames.has(name.toLowerCase())) { skipped++; continue; }

      // Generate code: uppercase, first 10 chars, replace spaces with underscore
      const code = name.toUpperCase().replace(/\s+/g, '_').substring(0, 20);

      toCreate.push({
        uom_id: `UOM-${code}`,
        uom_code: code,
        uom_name: name,
        must_be_whole_number: row.must_be_whole_number === 1,
        is_active: row.enabled !== 0
      });

      existingNames.add(name.toLowerCase()); // prevent dupes within batch
    }

    // Bulk create in batches of 50
    for (let i = 0; i < toCreate.length; i += 50) {
      const batch = toCreate.slice(i, i + 50);
      await base44.entities.UOMMaster.bulkCreate(batch);
      created += batch.length;
      setProgress({ total: rows.length, created, skipped, errors });
    }

    setProgress({ total: rows.length, created, skipped: rows.length - created, errors });
    setStatus('done');
    if (onImported) onImported();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">Import Units of Measure</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {status === 'idle' && (
            <>
              <p className="text-sm text-slate-600">
                Upload an Excel file with columns: <strong>UOM Name</strong>, <strong>Enabled</strong>, <strong>Must be Whole Number</strong>.
              </p>
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-slate-400 transition-colors"
              >
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-slate-700">{file.name}</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Click to select Excel file</p>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                />
              </div>
            </>
          )}

          {(status === 'uploading' || status === 'extracting' || status === 'importing') && (
            <div className="text-center py-6 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-slate-500 mx-auto" />
              <p className="text-sm text-slate-600">
                {status === 'uploading' && 'Uploading file…'}
                {status === 'extracting' && 'Extracting data from file…'}
                {status === 'importing' && `Importing… ${progress.created} created`}
              </p>
            </div>
          )}

          {status === 'done' && (
            <div className="text-center py-4 space-y-3">
              <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" />
              <p className="text-sm font-medium text-slate-900">Import Complete</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-lg font-bold text-slate-900">{progress.total}</p>
                  <p className="text-xs text-slate-500">Total Rows</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-lg font-bold text-green-700">{progress.created}</p>
                  <p className="text-xs text-green-600">Created</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3">
                  <p className="text-lg font-bold text-amber-700">{progress.skipped}</p>
                  <p className="text-xs text-amber-600">Skipped</p>
                </div>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-4 space-y-3">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
              <p className="text-sm text-red-700">{errorMsg}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 flex gap-2">
          {status === 'idle' && (
            <>
              <Button variant="outline" onClick={onClose} className="flex-1 h-11 text-sm">Cancel</Button>
              <Button onClick={handleImport} disabled={!file} className="flex-1 h-11 bg-slate-900 text-sm gap-2">
                <Upload className="w-4 h-4" /> Import
              </Button>
            </>
          )}
          {(status === 'done' || status === 'error') && (
            <Button onClick={onClose} className="w-full h-11 text-sm">Close</Button>
          )}
        </div>
      </div>
    </div>
  );
}