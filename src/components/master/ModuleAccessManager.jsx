import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import { MODULE_KEYS } from '@/components/modules/moduleHelpers';

const MODULE_LIST = Object.values(MODULE_KEYS).map(k => ({
  key: k, name: k.replace(/_/g, ' ')
}));

const ALL_ROLES = ['admin','production_manager','stores','recipe_operator','qa','filling_operator','chamber_operator','labelling_receiver','line_operator','labelling_supervisor','warehouse'];

export default function ModuleAccessManager() {
  const [moduleConfigs, setModuleConfigs] = useState([]);
  const [roleAccesses, setRoleAccesses] = useState([]);
  const [selectedRole, setSelectedRole] = useState('filling_operator');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [mc, ra] = await Promise.all([
      base44.entities.ModuleConfig.list().catch(() => []),
      base44.entities.RoleModuleAccess.list().catch(() => []),
    ]);
    // Seed missing module configs
    const existingKeys = mc.map(m => m.module_key);
    const missing = MODULE_LIST.filter(m => !existingKeys.includes(m.key));
    if (missing.length > 0) {
      await Promise.all(missing.map(m => base44.entities.ModuleConfig.create({ module_key: m.key, name: m.name, is_globally_enabled: true })));
      const updated = await base44.entities.ModuleConfig.list().catch(() => mc);
      setModuleConfigs(updated);
    } else {
      setModuleConfigs(mc);
    }
    setRoleAccesses(ra);
    setLoading(false);
  }

  function isGlobalEnabled(key) {
    const mc = moduleConfigs.find(m => m.module_key === key);
    return mc ? mc.is_globally_enabled !== false : true;
  }

  function isRoleEnabled(role, key) {
    const ra = roleAccesses.find(r => r.role === role && r.module_key === key);
    return ra ? ra.enabled !== false : false;
  }

  async function toggleGlobal(key) {
    const mc = moduleConfigs.find(m => m.module_key === key);
    if (!mc) return;
    setSaving(true);
    const newVal = !mc.is_globally_enabled;
    await base44.entities.ModuleConfig.update(mc.id, { is_globally_enabled: newVal });
    setModuleConfigs(prev => prev.map(m => m.module_key === key ? { ...m, is_globally_enabled: newVal } : m));
    setSaving(false);
  }

  async function toggleRoleAccess(role, key) {
    setSaving(true);
    const existing = roleAccesses.find(r => r.role === role && r.module_key === key);
    if (existing) {
      const newVal = !existing.enabled;
      await base44.entities.RoleModuleAccess.update(existing.id, { enabled: newVal });
      setRoleAccesses(prev => prev.map(r => r.id === existing.id ? { ...r, enabled: newVal } : r));
    } else {
      const created = await base44.entities.RoleModuleAccess.create({ role, module_key: key, enabled: true });
      setRoleAccesses(prev => [...prev, created]);
    }
    setSaving(false);
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">Toggle modules globally or per role. {saving && <span className="text-blue-500">Saving…</span>}</p>

      <div>
        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Role Access</label>
        <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)}
          className="w-full mt-1 h-11 rounded-xl border border-slate-300 px-3 text-sm bg-white focus:outline-none">
          {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-3 text-xs font-bold text-slate-400 uppercase tracking-wide px-3">
          <span className="col-span-1">Module</span>
          <span className="text-center">Global</span>
          <span className="text-center">Role</span>
        </div>
        {MODULE_LIST.map(m => {
          const globalOn = isGlobalEnabled(m.key);
          const roleOn = isRoleEnabled(selectedRole, m.key);
          return (
            <div key={m.key} className={`bg-white rounded-xl border border-slate-200 p-3 grid grid-cols-3 items-center ${!globalOn ? 'opacity-50' : ''}`}>
              <div>
                <p className="text-xs font-bold text-slate-700">{m.name}</p>
                <p className="text-xs text-slate-400">{m.key}</p>
              </div>
              <div className="flex justify-center">
                <button onClick={() => toggleGlobal(m.key)}>
                  {globalOn ? <ToggleRight className="w-6 h-6 text-emerald-500" /> : <ToggleLeft className="w-6 h-6 text-slate-300" />}
                </button>
              </div>
              <div className="flex justify-center">
                <button onClick={() => toggleRoleAccess(selectedRole, m.key)} disabled={!globalOn}>
                  {roleOn ? <ToggleRight className="w-6 h-6 text-blue-500" /> : <ToggleLeft className="w-6 h-6 text-slate-300" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}