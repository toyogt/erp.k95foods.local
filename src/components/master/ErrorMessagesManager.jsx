import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Save, Download, Upload, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

// Default error message definitions
const DEFAULT_ERRORS = [
  {
    key: 'BOX_NOT_FOUND',
    screen: 'Pallet Build / Warehouse Receive',
    trigger: 'Jab QR scan karo aur box serial database mein na mile',
    default_message: 'Box serial not found: {serial}',
  },
  {
    key: 'BOX_ALREADY_ON_PALLET',
    screen: 'Pallet Build',
    trigger: 'Same box ko ek hi pallet par dobara scan karo',
    default_message: 'Already scanned on this pallet: {serial}',
  },
  {
    key: 'BOX_ON_DIFFERENT_PALLET',
    screen: 'Pallet Build',
    trigger: 'Jab box pehle se kisi aur pallet par registered ho',
    default_message: '❌ Already on pallet "{pallet_id}" — use a different label',
  },
  {
    key: 'BOX_STATUS_NOT_ALLOWED',
    screen: 'Pallet Build',
    trigger: 'Box ka status PRINTED_UNREGISTERED nahi hai (jaise HANDED_OVER ya OUT)',
    default_message: '❌ Cannot add — box status is {status}',
  },
  {
    key: 'BOX_MIXED_PRODUCT',
    screen: 'Pallet Build',
    trigger: 'Alag product ka box scan karo jab pallet par pehle se koi aur product hai',
    default_message: '❌ Pallet already has item "{item_code}" — cannot mix products',
  },
  {
    key: 'BOX_MIXED_BATCH',
    screen: 'Pallet Build',
    trigger: 'Alag batch ka box scan karo jab pallet par koi aur batch pehle se hai',
    default_message: '❌ Pallet already has batch "{batch_no}" — cannot mix batches',
  },
  {
    key: 'PALLET_SESSION_NOT_FOUND',
    screen: 'Warehouse Receive',
    trigger: 'Aisa pallet ID daalo jo exist na kare ya handed over na ho',
    default_message: 'Pallet "{pallet_id}" not found. Only handed-over pallets can be received.',
  },
  {
    key: 'BOX_ALREADY_RECEIVED',
    screen: 'Warehouse Receive',
    trigger: 'Same box ko ek session mein dobara scan karo',
    default_message: 'Already scanned: {serial}',
  },
  {
    key: 'DISPATCH_BOX_NOT_IN_STOCK',
    screen: 'Dispatch',
    trigger: 'Dispatch ke liye box scan karo aur uska status IN_STOCK na ho',
    default_message: 'Box status is "{status}", expected IN_STOCK',
  },
  {
    key: 'MANIFEST_REQUIRED',
    screen: 'Pallet Build — Seal & Print',
    trigger: 'Jab bina manifest print kiye "Proceed to Photo Proof" dabao',
    default_message: '⚠ Print the manifest to proceed',
  },
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
  const [saving, setSaving] = useState(null); // key being saved
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [importMsg, setImportMsg] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const records = await base44.entities.AppSetting.filter({}, 'key', 200).catch(() => []);
    const errorSettings = records.filter(r => r.key?.startsWith('ERR_'));
    // Merge defaults with saved
    const merged = DEFAULT_ERRORS.map(def => {
      const saved = errorSettings.find(r => r.key === `ERR_${def.key}`);
      return {
        ...def,
        message: saved?.value || def.default_message,
        db_id: saved?.id || null,
      };
    });
    setConfigs(merged);
    setLoading(false);
  }

  function updateMessage(key, val) {
    setConfigs(prev => prev.map(c => c.key === key ? { ...c, message: val } : c));
  }

  async function saveOne(cfg) {
    setSaving(cfg.key);
    setSaveSuccess(null);
    if (cfg.db_id) {
      await base44.entities.AppSetting.update(cfg.db_id, { value: cfg.message });
    } else {
      const created = await base44.entities.AppSetting.create({
        key: `ERR_${cfg.key}`,
        value: cfg.message,
        description: `Error message: ${cfg.screen}`,
      });
      setConfigs(prev => prev.map(c => c.key === cfg.key ? { ...c, db_id: created.id } : c));
    }
    setSaving(null);
    setSaveSuccess(cfg.key);
    setTimeout(() => setSaveSuccess(null), 2000);
  }

  async function resetOne(cfg) {
    updateMessage(cfg.key, cfg.default_message);
    if (cfg.db_id) {
      await base44.entities.AppSetting.update(cfg.db_id, { value: cfg.default_message });
    }
  }

  function downloadCSV() {
    const csv = toCSV(configs);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'error_messages.csv'; a.click();
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
        await base44.entities.AppSetting.create({
          key: `ERR_${row.key}`,
          value: row.message,
          description: `Error message: ${cfg.screen}`,
        });
      }
      updated++;
    }
    setImportMsg({ ok: true, msg: `${updated} messages updated from CSV.` });
    load();
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-700">Error & Alert Messages</p>
          <p className="text-xs text-slate-400">Customize the messages shown to users. CSV mein download/upload bhi kar sakte ho.</p>
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
          <button onClick={load} className="text-slate-400 hover:text-slate-600">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {importMsg && (
        <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl ${importMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
          {importMsg.ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {importMsg.msg}
          <button onClick={() => setImportMsg(null)} className="ml-auto text-xs">×</button>
        </div>
      )}

      <div className="space-y-3">
        {configs.map(cfg => (
          <div key={cfg.key} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
            {/* Header */}
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

            {/* When/Why */}
            <div className="bg-slate-50 rounded-lg px-3 py-2">
              <p className="text-xs text-slate-500"><span className="font-semibold text-slate-600">Kab milta hai:</span> {cfg.trigger}</p>
            </div>

            {/* Editable message */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase mb-1 block">Message</label>
              <textarea
                className="w-full h-16 px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-sky-500 focus:outline-none resize-none font-mono"
                value={cfg.message}
                onChange={e => updateMessage(cfg.key, e.target.value)}
              />
              <p className="text-xs text-slate-400 mt-0.5">
                Variables: {cfg.default_message.match(/\{[^}]+\}/g)?.join(', ') || 'none'}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => saveOne(cfg)}
                disabled={saving === cfg.key}
                className="h-8 gap-1 bg-sky-600 hover:bg-sky-700"
              >
                {saving === cfg.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => resetOne(cfg)}
                className="h-8 text-xs"
              >
                Reset Default
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}