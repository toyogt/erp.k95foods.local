import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Plus, X, Save, Loader2 } from 'lucide-react';
import MOQConfigManager from '@/components/sales/MOQConfigManager';

const DEFAULT_SETTINGS = [
  { setting_key: 'transporters', setting_label: 'Transporter Names', values: ['DTDC', 'Local', 'Bluedart', 'Prakash Parcel Services Ltd', 'Delhivery'], description: 'Transporter options for dispatch' },
  { setting_key: 'packing_types', setting_label: 'Packing / Box Types', values: ['Master Carton 12-pcs', 'Master Carton 24-pcs', 'Display Box 6-pcs', 'Loose'], description: 'Box/packing type options for dispatch' },
];

export default function SalesSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState({});
  const [localValues, setLocalValues] = useState({});

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['sales_settings'],
    queryFn: async () => {
      const existing = await base44.entities.SalesSettings.list();
      if (existing.length === 0) {
        for (const s of DEFAULT_SETTINGS) {
          await base44.entities.SalesSettings.create(s);
        }
        return base44.entities.SalesSettings.list();
      }
      return existing;
    },
  });

  function getValues(setting) {
    return localValues[setting.id] ?? setting.values ?? [];
  }

  function addValue(settingId) {
    setLocalValues(prev => ({ ...prev, [settingId]: [...(prev[settingId] ?? []), ''] }));
  }

  function updateValue(settingId, idx, val) {
    setLocalValues(prev => {
      const arr = [...(prev[settingId] ?? [])];
      arr[idx] = val;
      return { ...prev, [settingId]: arr };
    });
  }

  function removeValue(settingId, idx) {
    setLocalValues(prev => {
      const arr = [...(prev[settingId] ?? [])].filter((_, i) => i !== idx);
      return { ...prev, [settingId]: arr };
    });
  }

  async function saveSetting(setting) {
    const values = getValues(setting).filter(v => v.trim());
    setSaving(s => ({ ...s, [setting.id]: true }));
    await base44.entities.SalesSettings.update(setting.id, { values });
    setSaving(s => ({ ...s, [setting.id]: false }));
    qc.invalidateQueries(['sales_settings']);
    toast({ title: `${setting.setting_label} saved` });
  }

  if (isLoading) return <div className="p-8 text-center text-slate-400 text-sm">Loading settings...</div>;

  return (
    <div className="p-3 md:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Sales Settings</h1>
        <p className="text-sm text-slate-500">Manage dispatch options, packing types, and minimum order quantities</p>
      </div>

      {settings.map(setting => (
        <div key={setting.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-900">{setting.setting_label}</p>
            <p className="text-xs text-slate-500 mt-0.5">{setting.description}</p>
          </div>
          <div className="p-4 space-y-2">
            {getValues(setting).map((val, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input className="h-9 text-sm flex-1" value={val}
                  onChange={e => updateValue(setting.id, idx, e.target.value)} />
                <button onClick={() => removeValue(setting.id, idx)} className="text-slate-400 hover:text-red-500 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => addValue(setting.id)}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium py-1"
            >
              <Plus className="w-4 h-4" /> Add option
            </button>
          </div>
          <div className="px-4 pb-4 flex justify-end">
            <Button className="h-11 bg-slate-900 text-white text-sm" onClick={() => saveSetting(setting)} disabled={saving[setting.id]}>
              {saving[setting.id] ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </div>
      ))}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-900">Minimum Order Configuration</p>
          <p className="text-xs text-slate-500 mt-0.5">Set minimum order quantity and box rules per product and distributor</p>
        </div>
        <div className="p-4">
          <MOQConfigManager />
        </div>
      </div>
    </div>
  );
}