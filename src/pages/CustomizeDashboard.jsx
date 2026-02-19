import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, CheckSquare, Square, Save, ChevronDown, ChevronUp } from 'lucide-react';

const ALL_WIDGETS = [
  { key: 'chamber_waiting_crates',   label: 'Crates waiting for chamber',     roles: ['chamber_operator'] },
  { key: 'chamber_pallets_in',       label: 'Pallets in chamber',             roles: ['chamber_operator'] },
  { key: 'chamber_post_nochamber',   label: 'Post-chamber putaway',           roles: ['chamber_operator'] },
  { key: 'filling_crates_today',     label: 'Crates filled today',            roles: ['filling_operator'] },
  { key: 'filling_unpalletized',     label: 'Crates not palletized',          roles: ['filling_operator'] },
  { key: 'filling_active_batch',     label: 'Active batch ID + product',      roles: ['filling_operator'] },
  { key: 'receiving_pallets_transit',label: 'Pallets in transit',             roles: ['labelling_receiver','labelling_supervisor'] },
  { key: 'receiving_crates_putaway', label: 'Crates awaiting putaway',        roles: ['labelling_receiver'] },
  { key: 'receiving_zone_line1',     label: 'Zone Line 1 crates',             roles: ['labelling_receiver','line_operator','labelling_supervisor'] },
  { key: 'receiving_zone_line2',     label: 'Zone Line 2 crates',             roles: ['labelling_receiver','line_operator','labelling_supervisor'] },
  { key: 'labelling_active_wo',      label: 'Active WO + progress',           roles: ['line_operator','labelling_supervisor'] },
  { key: 'labelling_hardstops_today',label: 'Hard stops today',               roles: ['labelling_supervisor','production_manager','admin'] },
  { key: 'labelling_zone_crates',    label: 'Crates available in zone',       roles: ['line_operator','labelling_supervisor'] },
  { key: 'labelling_offline_queue',  label: 'Offline queue pending',          roles: ['line_operator','labelling_supervisor'] },
  { key: 'stores_released_requests', label: 'Released requests',              roles: ['stores'] },
  { key: 'stores_pending_sync',      label: 'Issues pending sync',            roles: ['stores'] },
  { key: 'manager_total_crates',     label: 'Active crates (all)',            roles: ['production_manager','admin'] },
  { key: 'manager_open_alerts',      label: 'Open alerts',                    roles: ['production_manager','admin','labelling_supervisor'] },
  { key: 'manager_active_batches',   label: 'Active batches',                 roles: ['production_manager','admin'] },
  { key: 'manager_pallets_transit',  label: 'Pallets in transit (all)',       roles: ['production_manager','admin'] },
];

const ALL_ROLES = ['admin','production_manager','stores','recipe_operator','qa','filling_operator','chamber_operator','labelling_receiver','line_operator','labelling_supervisor','warehouse'];

export default function CustomizeDashboard() {
  const [user, setUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('filling_operator');
  const [roleLayout, setRoleLayout] = useState(null);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const isManager = user?.role === 'admin' || user?.role === 'production_manager';

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); loadRole('filling_operator'); }).catch(() => {});
  }, []);

  async function loadRole(role) {
    setSelectedRole(role);
    setLoading(true);
    const layouts = await base44.entities.RoleDashboardLayout.filter({ role }).catch(() => []);
    setRoleLayout(layouts[0] || null);
    setSelected(layouts[0]?.layout_json || []);
    setLoading(false);
  }

  function toggle(key) {
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }

  async function save() {
    setLoading(true);
    const now = new Date().toISOString();
    if (roleLayout?.id) {
      await base44.entities.RoleDashboardLayout.update(roleLayout.id, { layout_json: selected, last_updated: now });
    } else {
      const created = await base44.entities.RoleDashboardLayout.create({ role: selectedRole, layout_json: selected, last_updated: now });
      setRoleLayout(created);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setLoading(false);
  }

  if (!isManager) return <div className="text-center py-20 text-slate-400">Access restricted to managers.</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Customize Dashboard</h1>
        <p className="text-sm text-slate-500">Choose widgets shown per role</p>
      </div>

      <div>
        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Role</label>
        <select value={selectedRole} onChange={e => loadRole(e.target.value)}
          className="w-full mt-1 h-11 rounded-xl border border-slate-300 px-3 text-sm bg-white focus:outline-none">
          {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {loading && <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>}

      {!loading && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">{selected.length} widget(s) selected</p>
          {ALL_WIDGETS.map(w => {
            const on = selected.includes(w.key);
            return (
              <button key={w.key} onClick={() => toggle(w.key)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${on ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                {on ? <CheckSquare className="w-5 h-5 text-blue-600 shrink-0" /> : <Square className="w-5 h-5 text-slate-300 shrink-0" />}
                <div>
                  <p className="text-sm font-medium text-slate-800">{w.label}</p>
                  <p className="text-xs text-slate-400">{w.key}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Button className="w-full h-12 rounded-xl" onClick={save} disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? '✓ Saved!' : <><Save className="w-4 h-4 mr-2" />Save Layout</>}
      </Button>
    </div>
  );
}