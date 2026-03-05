import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, AlertTriangle } from 'lucide-react';

function parseCSV(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
}

export default function ImportCSVModal({ specs, uoms, brandItems, onImport, onCancel }) {
  const [rows, setRows] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [changeNote, setChangeNote] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const parsed = parseCSV(ev.target.result);
      const resolved = [];
      const warns = [];
      parsed.forEach((row, i) => {
        const spec = specs.find(s =>
          (row.ingredient_short_code && s.short_code?.toLowerCase() === row.ingredient_short_code.toLowerCase()) ||
          (row.ingredient_id && s.ingredient_id === row.ingredient_id)
        );
        if (!spec) { warns.push(`Row ${i + 2}: ingredient not found (${row.ingredient_short_code || row.ingredient_id})`); return; }
        // Always use spec's default UOM — ignore CSV uom_code for standardization
        const uom_id = spec.uom_id || '';
        const lockBrand = row.lock_brand?.toLowerCase() === 'true';
        let itemId = '';
        if (lockBrand && row.brand_name) {
          const found = brandItems.find(bi => bi.ingredient_id === spec.ingredient_id && bi.brand_name?.toLowerCase() === row.brand_name.toLowerCase());
          if (!found) warns.push(`Row ${i + 2}: brand_name "${row.brand_name}" not found for ${spec.short_code}. Lock left blank.`);
          else itemId = found.item_id;
        }
        resolved.push({
          _key: Date.now() + i,
          ingredient_id: spec.ingredient_id,
          qty: parseFloat(row.qty) || 0,
          uom_id,
          phase: 'MIX',
          notes: row.notes || '',
          lock_brand: lockBrand && !!itemId,
          ingredient_item_id: itemId,
        });
      });
      setRows(resolved);
      setWarnings(warns);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!changeNote.trim() || !rows?.length) return;
    setSaving(true);
    await onImport(rows, changeNote.trim());
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800">Import Ingredients CSV</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="font-semibold mb-1">Expected columns:</p>
            <p className="font-mono">ingredient_short_code, qty, notes, lock_brand, brand_name</p>
            <p className="text-slate-400 mt-1">UOM is auto-set from ingredient spec. phase is not needed.</p>
          </div>

          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          <Button variant="outline" className="w-full gap-2" onClick={() => fileRef.current.click()}>
            <Upload className="w-4 h-4" /> Choose CSV file
          </Button>

          {warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
              {warnings.map((w, i) => <p key={i} className="text-xs text-amber-800 flex items-start gap-1"><AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />{w}</p>)}
            </div>
          )}

          {rows && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-700">
              {rows.length} ingredient row(s) parsed successfully.
            </div>
          )}

          {rows && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Change Note <span className="text-red-500">*</span></label>
              <textarea
                className="w-full h-16 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
                placeholder="Why are you importing this? (required)"
                value={changeNote}
                onChange={e => setChangeNote(e.target.value)}
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
            {rows && (
              <Button size="sm" disabled={!changeNote.trim() || saving} onClick={handleImport} className="ml-auto">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : `Import ${rows.length} rows`}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}