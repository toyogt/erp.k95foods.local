import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Save, CheckCircle2 } from 'lucide-react';

const DEFAULT_SETTINGS = [
  { key: 'WIP_PALLET_CRATE_CAPACITY',       label: 'WIP Pallet Crate Capacity',         description: 'Crates per WIP pallet before auto-pallet prompt',         type: 'number' },
  { key: 'EDGE_ENDPOINT_URL',               label: 'Edge Endpoint URL',                 description: 'LAN URL of edge device e.g. http://192.168.1.50:8080',   type: 'text'   },
  { key: 'ERP_API_BASE_URL',                label: 'ERP API Base URL',                  description: 'ERPNext base URL for sync e.g. https://erp.company.com',  type: 'text'   },
  { key: 'OFFLINE_SYNC_ENABLED',            label: 'Offline Sync Enabled',              description: 'true / false — enable background sync of offline queue',  type: 'text'   },
  { key: 'BOTTLE_TYPE_MISMATCH_HARDSTOP',   label: 'Bottle Type Mismatch → HARD STOP',  description: 'true = hard stop on bottle type mismatch (default: soft)', type: 'text'   },
];

function SettingRow({ def, existing, onSave }) {
  const [val, setVal] = useState(existing?.value || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(def.key, val, existing);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      <div>
        <p className="font-semibold text-slate-800">{def.label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{def.description}</p>
      </div>
      <div className="flex gap-2">
        <input
          type={def.type || 'text'}
          value={val}
          onChange={e => setVal(e.target.value)}
          className="flex-1 h-11 rounded-xl border border-slate-300 px-3 text-base focus:outline-none focus:border-blue-500"
          placeholder={`Enter ${def.label.toLowerCase()}…`}
        />
        <Button onClick={handleSave} disabled={saving} className="h-11 px-4 rounded-xl">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        </Button>
      </div>
      <p className="text-xs text-slate-400">Key: <code className="bg-slate-100 px-1 rounded">{def.key}</code></p>
    </div>
  );
}

export default function AppSettingsManager() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try {
      const data = await base44.entities.AppSetting.list();
      const map = {};
      data.forEach(s => { map[s.key] = s; });
      setSettings(map);
    } catch { /* offline */ }
    setLoading(false);
  }

  async function saveSetting(key, value, existing) {
    if (existing?.id) {
      const updated = await base44.entities.AppSetting.update(existing.id, { value: String(value) });
      setSettings(prev => ({ ...prev, [key]: { ...existing, value: String(value) } }));
    } else {
      const def = DEFAULT_SETTINGS.find(d => d.key === key);
      const created = await base44.entities.AppSetting.create({ key, value: String(value), description: def?.description || '' });
      setSettings(prev => ({ ...prev, [key]: created }));
    }
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Configure app-wide settings used by station screens.</p>
      {DEFAULT_SETTINGS.map(def => (
        <SettingRow key={def.key} def={def} existing={settings[def.key]} onSave={saveSetting} />
      ))}
    </div>
  );
}