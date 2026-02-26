import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Save, Download, Upload, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

// All configurable error/alert messages across the app
const DEFAULT_ERRORS = [
  // ── Pallet Build ──────────────────────────────
  { key: 'BOX_NOT_FOUND',            screen: 'Pallet Build / Warehouse Receive', trigger: 'Scan a QR and the box serial is not in database', default_message: 'Box serial not found: {serial}' },
  { key: 'BOX_ALREADY_ON_PALLET',    screen: 'Pallet Build', trigger: 'Same box scanned twice on the same pallet', default_message: 'Already scanned on this pallet: {serial}' },
  { key: 'BOX_ON_DIFFERENT_PALLET',  screen: 'Pallet Build', trigger: 'Box already registered on a different pallet', default_message: '❌ Already on pallet "{pallet_id}" — use a different label' },
  { key: 'BOX_STATUS_NOT_ALLOWED',   screen: 'Pallet Build', trigger: 'Box status is not PRINTED_UNREGISTERED (e.g. HANDED_OVER)', default_message: '❌ Cannot add — box status is {status}' },
  { key: 'BOX_MIXED_PRODUCT',        screen: 'Pallet Build', trigger: 'Scanning a different product when pallet already has one', default_message: '❌ Pallet already has item "{item_code}" — cannot mix products' },
  { key: 'BOX_MIXED_BATCH',          screen: 'Pallet Build', trigger: 'Scanning a different batch when pallet already has one', default_message: '❌ Pallet already has batch "{batch_no}" — cannot mix batches' },
  { key: 'MANIFEST_REQUIRED',        screen: 'Pallet Build — Seal & Print', trigger: 'Clicking "Proceed to Photo Proof" without printing manifest', default_message: '⚠ Please print the manifest before proceeding' },

  // ── Warehouse Ops / Receive ──────────────────
  { key: 'PALLET_SESSION_NOT_FOUND', screen: 'Warehouse Receive', trigger: 'Entering a pallet ID that does not exist or is not handed over', default_message: 'Pallet "{pallet_id}" not found. Only handed-over pallets can be received.' },
  { key: 'BOX_ALREADY_RECEIVED',     screen: 'Warehouse Receive', trigger: 'Same box scanned twice in a receive session', default_message: 'Already scanned: {serial}' },
  { key: 'BOX_NOT_IN_SESSION',       screen: 'Warehouse Receive', trigger: 'Scanned box does not belong to the pallet being received', default_message: 'Box "{serial}" is not part of pallet "{pallet_id}"' },

  // ── Dispatch ────────────────────────────────
  { key: 'DISPATCH_BOX_NOT_IN_STOCK', screen: 'Dispatch', trigger: 'Scanning a box for dispatch that is not IN_STOCK', default_message: 'Box status is "{status}", expected IN_STOCK' },
  { key: 'DISPATCH_BOX_MIXED_SKU',    screen: 'Dispatch', trigger: 'Adding a box with different item/batch to same dispatch session', default_message: 'Dispatch session has item "{item_code}" — cannot mix SKUs' },

  // ── Box Label Print ──────────────────────────
  { key: 'LABEL_REQUEST_DUPLICATE',   screen: 'Box Label Print', trigger: 'Submitting a request for same item+batch+date that already exists pending', default_message: 'A pending request for batch "{batch_no}" already exists' },
  { key: 'LABEL_NOT_APPROVED',        screen: 'Box Label Print', trigger: 'Trying to print labels on a PENDING request', default_message: 'This request is still pending approval' },

  // ── Filling Station ──────────────────────────
  { key: 'CRATE_ID_TAKEN',            screen: 'Filling Station', trigger: 'Creating a crate with an ID that already exists', default_message: 'Crate ID "{crate_id}" already exists' },
  { key: 'MACHINE_NO_ACTIVE_BATCH',   screen: 'Filling Station', trigger: 'Scanning a crate on a machine with no active batch assigned', default_message: 'No active batch assigned to machine "{machine_id}"' },

  // ── Chamber Station ──────────────────────────
  { key: 'PALLET_NOT_FOUND',          screen: 'Chamber Station', trigger: 'Scanning a pallet ID that does not exist', default_message: 'Pallet "{pallet_id}" not found' },
  { key: 'PALLET_WRONG_STATUS',       screen: 'Chamber Station / Transfer', trigger: 'Pallet is in an unexpected status for the operation', default_message: 'Pallet status is "{status}" — cannot perform this action' },

  // ── Stores Issue ─────────────────────────────
  { key: 'MATERIAL_REQUEST_NOT_FOUND', screen: 'Stores Issue', trigger: 'Scanning/entering a request ID that does not exist', default_message: 'Material request "{request_id}" not found' },
  { key: 'OVER_ISSUE',                 screen: 'Stores Issue', trigger: 'Issuing more quantity than requested', default_message: 'Issuing {qty} exceeds requested qty of {requested}' },

  // ── QC / Batch ───────────────────────────────
  { key: 'BATCH_QC_FAILED',           screen: 'Recipe Station / QC', trigger: 'Batch is in QC_FAILED status and operator tries to proceed', default_message: 'Batch "{batch_id}" has failed QC — cannot proceed' },
  { key: 'BATCH_NOT_APPROVED',        screen: 'Recipe Station', trigger: 'Trying to start filling on a batch that is not QC-approved', default_message: 'Batch "{batch_id}" is not approved for production' },
];

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
}

function toCSV(rows) {
  const headers = ['key', 'screen', 'trigger', 'message'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([r.key, `"${r.screen}"`, `"${r.trigger}"`, `"${r.message || r.default_message}"`].join(','));
  }
  return lines.join('\n');
}

export default function ErrorMessagesManager() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [importMsg, setImportMsg] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const records = await base44.entities.AppSetting.filter({}, 'key', 500).catch(() => []);
    const errorSettings = records.filter(r => r.key?.startsWith('ERR_'));
    const merged = DEFAULT_ERRORS.map(def => {
      const saved = errorSettings.find(r => r.key === `ERR_${def.key}`);
      return { ...def, message: saved?.value || def.default_message, db_id: saved?.id || null };
    });
    setConfigs(merged);
    setLoading(false);
  }

  function updateMessage(key, val) {
    setConfigs(prev => prev.map(c => c.key === key ? { ...c, message: val } : c));
  }

  async function saveOne(cfg) {
    setSaving(cfg.key);
    if (cfg.db_id) {
      await base44.entities.AppSetting.update(cfg.db_id, { value: cfg.message });
    } else {
      const created = await base44.entities.AppSetting.create({ key: `ERR_${cfg.key}`, value: cfg.message, description: `Error: ${cfg.screen}` });
      setConfigs(prev => prev.map(c => c.key === cfg.key ? { ...c, db_id: created.id } : c));
    }
    setSaving(null);
    setSaveSuccess(cfg.key);
    setTimeout(() => setSaveSuccess(null), 2000);
  }

  async function resetOne(cfg) {
    updateMessage(cfg.key, cfg.default_message);
    if (cfg.db_id) await base44.entities.AppSetting.update(cfg.db_id, { value: cfg.default_message });
  }

  function downloadCSV() {
    const csv = toCSV(configs);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'error_messages.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCSV(text);
    if (!rows.length) { setImportMsg({ ok: false, msg: 'No rows found in CSV.' }); return; }
    let updated = 0;
    for (const row of rows) {
      if (!row.key || !row.message) continue;
      const cfg = configs.find(c => c.key === row.key);
      if (!cfg) continue;
      if (cfg.db_id) {
        await base44.entities.AppSetting.update(cfg.db_id, { value: row.message });
      } else {
        await base44.entities.AppSetting.create({ key: `ERR_${row.key}`, value: row.message, description: `Error: ${cfg.screen}` });
      }
      updated++;
    }
    setImportMsg({ ok: true, msg: `${updated} messages updated from CSV.` });
    load();
  }

  // Group by screen prefix
  const grouped = {};
  configs.forEach(c => {
    const grp = c.screen.split(' ')[0];
    if (!grouped[grp]) grouped[grp] = [];
    grouped[grp].push(c);
  });

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-700">Error & Alert Messages</p>
          <p className="text-xs text-slate-400">Customize messages shown to users across all screens. Download/upload via CSV.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadCSV} className="gap-1 h-8">
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
          <label className="cursor-pointer">
            <Button variant="outline" size="sm" className="gap-1 h-8 pointer-events-none">
              <Upload className="w-3.5 h-3.5" /> Import CSV
            </Button>
            <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
          </label>
          <button onClick={load} className="text-slate-400 hover:text-slate-600"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      {importMsg && (
        <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl ${importMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
          {importMsg.ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {importMsg.msg}
          <button onClick={() => setImportMsg(null)} className="ml-auto text-xs">×</button>
        </div>
      )}

      {Object.entries(grouped).map(([grp, items]) => (
        <div key={grp}>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 mt-4">{grp}</p>
          <div className="space-y-3">
            {items.map(cfg => (
              <div key={cfg.key} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-slate-800 font-mono">{cfg.key}</p>
                    <p className="text-xs text-slate-400">📍 {cfg.screen}</p>
                  </div>
                  {saveSuccess === cfg.key && (
                    <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Saved
                    </span>
                  )}
                </div>
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-500"><span className="font-semibold text-slate-600">When:</span> {cfg.trigger}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase mb-1 block">Message</label>
                  <textarea
                    className="w-full h-14 px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-sky-500 focus:outline-none resize-none font-mono"
                    value={cfg.message}
                    onChange={e => updateMessage(cfg.key, e.target.value)}
                  />
                  {cfg.default_message.match(/\{[^}]+\}/g) && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      Variables: {cfg.default_message.match(/\{[^}]+\}/g).join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveOne(cfg)} disabled={saving === cfg.key} className="h-8 gap-1 bg-sky-600 hover:bg-sky-700">
                    {saving === cfg.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => resetOne(cfg)} className="h-8 text-xs">Reset Default</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}