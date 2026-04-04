import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { QrCode, Bell, Mail, Save, Loader2, Send } from 'lucide-react';

const KEYS = [
  'store_manual_entry_enabled',
  'store_expiry_notification_enabled',
  'store_manager_email',
  'store_expiry_threshold_days',
  'store_smtp_from_name',
];

const DEFAULTS = {
  store_manual_entry_enabled: 'false',
  store_expiry_notification_enabled: 'false',
  store_manager_email: '',
  store_expiry_threshold_days: '30',
  store_smtp_from_name: 'K95 Store',
};

function ToggleRow({ label, description, value, onChange, color = 'bg-teal-600' }) {
  const on = value === 'true';
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(on ? 'false' : 'true')}
        className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${on ? color : 'bg-slate-200'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${on ? 'translate-x-6' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

export default function SMSStoreSettings() {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState({ ...DEFAULTS });
  const [settingIds, setSettingIds] = useState({});

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [u, all] = await Promise.all([base44.auth.me(), base44.entities.AppSetting.list()]);
    setUser(u);
    const map = { ...DEFAULTS };
    const ids = {};
    all.forEach(s => {
      if (KEYS.includes(s.key)) { map[s.key] = s.value; ids[s.key] = s.id; }
    });
    setSettings(map);
    setSettingIds(ids);
    setLoading(false);
  }

  function set(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    await Promise.all(
      Object.entries(settings).map(async ([key, value]) => {
        if (settingIds[key]) {
          await base44.entities.AppSetting.update(settingIds[key], { value });
        } else {
          const created = await base44.entities.AppSetting.create({ key, value, description: `Store setting: ${key}` });
          setSettingIds(prev => ({ ...prev, [key]: created.id }));
        }
      })
    );
    toast({ title: 'Settings saved' });
    setSaving(false);
  }

  async function handleTestEmail() {
    setTesting(true);
    const res = await base44.functions.invoke('sendNearExpiryAlert', {});
    if (res.data?.error) {
      toast({ title: 'Error: ' + res.data.error, variant: 'destructive' });
    } else if (res.data?.sent) {
      toast({ title: `Alert sent — ${res.data.count} near-expiry lot(s) reported` });
    } else {
      toast({ title: res.data?.message || 'No near-expiry lots found at this time' });
    }
    setTesting(false);
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>;
  if (user?.role !== 'admin') return <div className="text-center py-20 text-slate-500">Admin access required to view Store Settings.</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-16">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Store Settings</h1>
        <p className="text-sm text-slate-500">Configure store module features and notification preferences</p>
      </div>

      {/* Stock Issue Settings */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
          <QrCode className="w-5 h-5 text-teal-600" />
          <h2 className="font-semibold text-slate-900">Stock Issue Settings</h2>
        </div>
        <ToggleRow
          label="Allow Manual Lot ID Entry"
          description="When disabled, only QR scanning is permitted for Lot identification during stock issue"
          value={settings.store_manual_entry_enabled}
          onChange={v => set('store_manual_entry_enabled', v)}
          color="bg-teal-600"
        />
      </section>

      {/* Near-Expiry Notifications */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
          <Bell className="w-5 h-5 text-amber-600" />
          <h2 className="font-semibold text-slate-900">Near-Expiry Notifications</h2>
        </div>
        <ToggleRow
          label="Enable Expiry Email Alerts"
          description="Automatically send email alerts when lots are approaching their expiry date"
          value={settings.store_expiry_notification_enabled}
          onChange={v => set('store_expiry_notification_enabled', v)}
          color="bg-amber-500"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-medium text-slate-700">Manager Email(s) *</Label>
            <Input className="h-9 text-sm mt-1" placeholder="manager@company.com"
              value={settings.store_manager_email}
              onChange={e => set('store_manager_email', e.target.value)} />
            <p className="text-xs text-slate-400 mt-0.5">Separate multiple emails with commas</p>
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Alert Threshold (days)</Label>
            <Input type="number" className="h-9 text-sm mt-1" min="1" max="365"
              value={settings.store_expiry_threshold_days}
              onChange={e => set('store_expiry_threshold_days', e.target.value)} />
            <p className="text-xs text-slate-400 mt-0.5">Alert when expiry is within this many days</p>
          </div>
        </div>
      </section>

      {/* SMTP Configuration */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
          <Mail className="w-5 h-5 text-indigo-600" />
          <h2 className="font-semibold text-slate-900">SMTP Configuration</h2>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800 space-y-1">
          <p className="font-semibold">⚙️ Set these secrets in Dashboard → Settings → Environment Variables:</p>
          <p className="font-mono">SMTP_HOST · SMTP_PORT · SMTP_USER · SMTP_PASSWORD</p>
          <p>Example for Gmail: Host = smtp.gmail.com, Port = 587, use an App Password (not your main password).</p>
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-700">Sender Display Name</Label>
          <Input className="h-9 text-sm mt-1" placeholder="K95 Store"
            value={settings.store_smtp_from_name}
            onChange={e => set('store_smtp_from_name', e.target.value)} />
        </div>
        <Button variant="outline" className="gap-2 h-10" onClick={handleTestEmail} disabled={testing}>
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {testing ? 'Sending…' : 'Send Test Alert Email Now'}
        </Button>
      </section>

      <Button className="w-full h-11 text-base gap-2" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? 'Saving…' : 'Save All Settings'}
      </Button>
    </div>
  );
}