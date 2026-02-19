import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Save } from 'lucide-react';
import { logAudit } from '@/components/AuditLogger';

export default function AppSettingManager({ user }) {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const data = await base44.entities.AppSetting.list('key');
    setSettings(data.map(s => ({ ...s, _val: s.value })));
    setLoading(false);
  }

  async function save(s) {
    setSaving(prev => ({ ...prev, [s.id]: true }));
    await base44.entities.AppSetting.update(s.id, { value: s._val });
    await logAudit({ action: `Updated setting ${s.key} = ${s._val}`, entity_type: 'AppSetting', entity_id: s.key, user });
    setSaving(prev => ({ ...prev, [s.id]: false }));
    load();
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-slate-900">App Settings</h3>
      {settings.map(s => (
        <div key={s.id} className="rounded-xl bg-white border border-slate-200 p-4 space-y-2">
          <div>
            <p className="font-semibold text-slate-900 font-mono text-sm">{s.key}</p>
            {s.description && <p className="text-xs text-slate-500">{s.description}</p>}
          </div>
          <div className="flex gap-2">
            <Input
              value={s._val}
              onChange={e => setSettings(prev => prev.map(x => x.id === s.id ? { ...x, _val: e.target.value } : x))}
              className="h-11 rounded-xl flex-1"
            />
            <Button onClick={() => save(s)} disabled={saving[s.id] || s._val === s.value} className="h-11 rounded-xl px-4">
              {saving[s.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}