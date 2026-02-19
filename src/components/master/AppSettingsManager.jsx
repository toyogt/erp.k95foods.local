import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Save, CheckCircle2 } from 'lucide-react';

const DEFAULT_SETTINGS = [
  { key: 'WIP_PALLET_CRATE_CAPACITY', label: 'WIP Pallet Crate Capacity', description: 'Number of crates per WIP pallet before auto-pallet prompt', type: 'number' },
];

export default function AppSettingsManager() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [saved, setSaved] = useState({});

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

  async function saveSetting(key, value) {
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      const existing = settings[key];
      if (existing?.id) {
        await base44.entities.AppSetting.update(existing.id, { value: String(value) });
        setSettings(prev => ({ ...prev, [key]: { ...existing, value: String(value) } }));
      } else {
        const def = DEFAULT_SETTINGS.find(d => d.key === key);
        const created = await base44.entities.AppSetting.create({ key, value: String(value), description: def?.description || '' });
        setSettings(prev => ({ ...prev, [key]: created }));
      }
      setSaved(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setSaved(prev => ({ ...prev, [key]: false })), 2000);
    } catch (e) { console.error(e); }
    setSaving(prev => ({ ...prev, [key]: false }));
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Configure app-wide settings used by station screens.</p>
      {DEFAULT_SETTINGS.map(def => {
        const current = settings[def.key];
        const [val, setVal] = useState(current?.value || '');
        return (
          <div key={def.key} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
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
              <Button
                onClick={() => saveSetting(def.key, val)}
                disabled={saving[def.key]}
                className="h-11 px-4 rounded-xl"
              >
                {saving[def.key] ? <Loader2 className="w-4 h-4 animate-spin" /> : saved[def.key] ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Save className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-slate-400">Key: <code className="bg-slate-100 px-1 rounded">{def.key}</code></p>
          </div>
        );
      })}
    </div>
  );
}