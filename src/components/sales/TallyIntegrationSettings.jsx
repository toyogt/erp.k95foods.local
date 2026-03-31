import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Save, Loader2, Server } from 'lucide-react';

const SETTING_KEY = 'tally_config';

const DEFAULTS = {
  tally_url: 'http://localhost',
  tally_port: '9000',
  tally_company_name: '',
  enabled: true,
};

export default function TallyIntegrationSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [settingId, setSettingId] = useState(null);

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['sales_settings_tally'],
    staleTime: 60000,
    queryFn: () => base44.entities.SalesSettings.filter({ setting_key: SETTING_KEY }),
  });

  useEffect(() => {
    if (settings.length > 0) {
      const rec = settings[0];
      setSettingId(rec.id);
      // values is stored as an array of "key=value" strings for compatibility
      const parsed = {};
      (rec.values || []).forEach(v => {
        const idx = v.indexOf('=');
        if (idx > -1) parsed[v.substring(0, idx)] = v.substring(idx + 1);
      });
      setForm({ ...DEFAULTS, ...parsed });
    }
  }, [settings]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const toValues = (f) => Object.entries(f).map(([k, v]) => `${k}=${v}`);

  const handleSave = async () => {
    setSaving(true);
    const values = toValues(form);
    if (settingId) {
      await base44.entities.SalesSettings.update(settingId, { values });
    } else {
      const rec = await base44.entities.SalesSettings.create({
        setting_key: SETTING_KEY,
        setting_label: 'Tally Integration',
        values,
        description: 'Tally ERP connection settings for invoice push',
      });
      setSettingId(rec.id);
    }
    qc.invalidateQueries(['sales_settings_tally']);
    toast({ title: 'Tally integration settings saved' });
    setSaving(false);
  };

  if (isLoading) return <div className="p-4 text-sm text-slate-400">Loading Tally settings...</div>;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Server className="w-4 h-4 text-slate-500" />
        <div>
          <p className="text-sm font-semibold text-slate-900">Tally Integration</p>
          <p className="text-xs text-slate-500 mt-0.5">Configure Tally ERP connection for invoice push</p>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-medium text-slate-700">Tally Server URL</Label>
            <Input
              className="h-9 text-sm mt-1"
              value={form.tally_url}
              onChange={e => set('tally_url', e.target.value)}
              placeholder="http://localhost"
            />
            <p className="text-xs text-slate-400 mt-1">Base URL of Tally server (no trailing slash)</p>
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Port</Label>
            <Input
              className="h-9 text-sm mt-1"
              value={form.tally_port}
              onChange={e => set('tally_port', e.target.value)}
              placeholder="9000"
            />
            <p className="text-xs text-slate-400 mt-1">Default Tally port is 9000</p>
          </div>
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-700">Company Name in Tally</Label>
          <Input
            className="h-9 text-sm mt-1"
            value={form.tally_company_name}
            onChange={e => set('tally_company_name', e.target.value)}
            placeholder="e.g. K95 Beverages Pvt Ltd"
          />
          <p className="text-xs text-slate-400 mt-1">Must match exactly as it appears in Tally</p>
        </div>

        {/* Connection preview */}
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 font-mono">
          Endpoint: {form.tally_url}:{form.tally_port}
        </div>

        <div className="flex justify-end">
          <Button className="h-11 bg-slate-900 text-white text-sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Tally Settings
          </Button>
        </div>
      </div>
    </div>
  );
}