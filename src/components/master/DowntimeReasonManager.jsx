import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Loader2 } from 'lucide-react';

const STATIONS = ['LABELLING', 'CHAMBER', 'FILLING'];
const CATEGORIES = ['MECHANICAL', 'MATERIAL', 'QUALITY', 'PLANNING', 'CHANGEOVER', 'MICRO_STOP', 'OTHER'];

const CAT_COLORS = {
  MECHANICAL: 'bg-red-100 text-red-700', MATERIAL: 'bg-orange-100 text-orange-700',
  QUALITY: 'bg-purple-100 text-purple-700', PLANNING: 'bg-blue-100 text-blue-700',
  CHANGEOVER: 'bg-cyan-100 text-cyan-700', MICRO_STOP: 'bg-slate-100 text-slate-600', OTHER: 'bg-gray-100 text-gray-600',
};

export default function DowntimeReasonManager() {
  const [reasons, setReasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ reason_code: '', station_type: 'LABELLING', reason_name: '', category: 'OTHER', is_active: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const r = await base44.entities.DowntimeReason.list('station_type', 100).catch(() => []);
    setReasons(r);
    setLoading(false);
  }

  async function handleAdd() {
    if (!form.reason_code.trim() || !form.reason_name.trim()) return;
    setSaving(true);
    await base44.entities.DowntimeReason.create({ ...form });
    setForm({ reason_code: '', station_type: 'LABELLING', reason_name: '', category: 'OTHER', is_active: true });
    setAdding(false);
    setSaving(false);
    load();
  }

  async function handleToggle(r) {
    await base44.entities.DowntimeReason.update(r.id, { is_active: !r.is_active });
    load();
  }

  async function handleDelete(r) {
    if (!window.confirm(`Delete "${r.reason_name}"?`)) return;
    await base44.entities.DowntimeReason.delete(r.id);
    load();
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-700">Downtime Reasons ({reasons.length})</p>
        <Button size="sm" onClick={() => setAdding(v => !v)} className="gap-1"><Plus className="w-4 h-4" /> Add</Button>
      </div>

      {adding && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Code</label>
              <input className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none"
                placeholder="e.g. MECH_JAM"
                value={form.reason_code} onChange={e => setForm(f => ({ ...f, reason_code: e.target.value.toUpperCase().replace(/\s+/g, '_') }))} />
            </div>
            <div>
              <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Station</label>
              <select className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none"
                value={form.station_type} onChange={e => setForm(f => ({ ...f, station_type: e.target.value }))}>
                {STATIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Name</label>
            <input className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none"
              placeholder="e.g. Label Jam" value={form.reason_name} onChange={e => setForm(f => ({ ...f, reason_name: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, category: c }))}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-all ${form.category === c ? 'bg-slate-900 text-white border-slate-900' : CAT_COLORS[c] || ''}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setAdding(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {reasons.map(r => (
          <div key={r.id} className={`flex items-center gap-3 p-3 rounded-xl border ${r.is_active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm text-slate-800">{r.reason_name}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${CAT_COLORS[r.category] || ''}`}>{r.category}</span>
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{r.station_type}</span>
              </div>
              <p className="text-xs text-slate-400 font-mono">{r.reason_code}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => handleToggle(r)} className={`text-xs px-2 py-1 rounded-lg font-semibold ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                {r.is_active ? 'Active' : 'Off'}
              </button>
              <button onClick={() => handleDelete(r)} className="text-red-400 hover:text-red-600 p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {reasons.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No downtime reasons yet. Add one above.</p>}
      </div>
    </div>
  );
}