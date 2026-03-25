/**
 * ClearTax API Settings
 * Saves config to AppSetting entity with keys:
 *   cleartax_api_key, cleartax_env
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Save, Loader2, Zap, Eye, EyeOff } from 'lucide-react';

const CLEARTAX_KEYS = ['cleartax_api_key', 'cleartax_env'];

export default function ClearTaxSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [form, setForm] = useState({ cleartax_api_key: '', cleartax_env: 'sandbox' });

  const { data: appSettings = [], isLoading } = useQuery({
    queryKey: ['app_settings_cleartax'],
    queryFn: async () => {
      const all = await base44.entities.AppSetting.filter({ key: { $in: CLEARTAX_KEYS } });
      if (all.length > 0) {
        const initial = {};
        all.forEach(s => { initial[s.key] = s.value || ''; });
        setForm(f => ({ ...f, ...initial }));
      }
      return all;
    },
  });

  async function handleSave() {
    setSaving(true);
    for (const key of CLEARTAX_KEYS) {
      const existing = appSettings.find(s => s.key === key);
      if (existing) {
        await base44.entities.AppSetting.update(existing.id, { value: form[key] });
      } else {
        await base44.entities.AppSetting.create({ key, value: form[key], label: key });
      }
    }
    qc.invalidateQueries(['app_settings_cleartax']);
    setSaving(false);
    toast({ title: 'ClearTax settings saved' });
  }

  if (isLoading) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Zap className="w-4 h-4 text-violet-600" />
        <div>
          <p className="text-sm font-semibold text-slate-900">ClearTax API Integration</p>
          <p className="text-xs text-slate-500 mt-0.5">Used to auto-generate IRN (E-Invoice) and E-Way Bills from the invoice panel</p>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
          <Zap className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            Get your API key from <strong>app.cleartax.in</strong> → Settings → API Credentials.
            Use <strong>sandbox</strong> for testing, <strong>production</strong> for live invoices.
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-medium text-slate-700">ClearTax API Key</Label>
            <div className="relative mt-1">
              <Input
                type={showKey ? 'text' : 'password'}
                className="h-9 text-sm pr-10"
                value={form.cleartax_api_key}
                onChange={e => setForm(f => ({ ...f, cleartax_api_key: e.target.value }))}
                placeholder="Enter your ClearTax API key..."
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                onClick={() => setShowKey(s => !s)}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Environment</Label>
            <select
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.cleartax_env}
              onChange={e => setForm(f => ({ ...f, cleartax_env: e.target.value }))}
            >
              <option value="sandbox">Sandbox (testing)</option>
              <option value="production">Production (live)</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end">
          <Button className="h-11 bg-slate-900 text-white text-sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save ClearTax Settings
          </Button>
        </div>
      </div>
    </div>
  );
}