import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

const STATUS_COLORS = { RELEASED: 'bg-blue-100 text-blue-700', RUNNING: 'bg-emerald-100 text-emerald-700', PAUSED: 'bg-amber-100 text-amber-700', COMPLETED: 'bg-slate-100 text-slate-500' };

const EMPTY = { wo_id: '', product: '', bottle_type: '', mrp: '', pack_type: 'CASE12', target_cases: '', target_bottles: '', priority: 5, status: 'RELEASED', assigned_line: 'LABEL-LINE-1', label_sku_code: '', carton_code: '', batch_id: '', printer_template_id: '' };

export default function PackingWOManager() {
  const [wos, setWos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setWos(await base44.entities.PackingWO.list('-created_date', 100)); } catch { /* offline */ }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    const data = { ...form, target_cases: Number(form.target_cases), target_bottles: Number(form.target_bottles), priority: Number(form.priority) };
    try {
      if (form._editId) {
        await base44.entities.PackingWO.update(form._editId, data);
      } else {
        await base44.entities.PackingWO.create(data);
      }
      setShowForm(false);
      setForm(EMPTY);
      await load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!confirm('Delete this WO?')) return;
    await base44.entities.PackingWO.delete(id);
    setWos(prev => prev.filter(w => w.id !== id));
  }

  function startEdit(wo) {
    setForm({ ...wo, _editId: wo.id });
    setShowForm(true);
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{wos.length} work orders</p>
        <Button size="sm" onClick={() => { setForm(EMPTY); setShowForm(!showForm); }} className="rounded-xl h-9 gap-1.5">
          <Plus className="w-4 h-4" /> New WO
        </Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <p className="font-semibold text-slate-800">{form._editId ? 'Edit' : 'New'} Work Order</p>
          {[
            ['wo_id', 'WO ID', 'text'],
            ['product', 'Product Name', 'text'],
            ['bottle_type', 'Bottle Type', 'text'],
            ['mrp', 'MRP', 'text'],
            ['target_bottles', 'Target Bottles', 'number'],
            ['target_cases', 'Target Cases', 'number'],
            ['label_sku_code', 'Label SKU Code', 'text'],
            ['carton_code', 'Carton Code', 'text'],
            ['batch_id', 'Batch ID', 'text'],
            ['printer_template_id', 'Printer Template ID', 'text'],
          ].map(([key, label, type]) => (
            <div key={key}>
              <label className="text-xs text-slate-500 font-medium">{label}</label>
              <input type={type} value={form[key] || ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                className="w-full h-10 rounded-xl border border-slate-300 px-3 text-sm focus:outline-none focus:border-blue-500 mt-1" />
            </div>
          ))}
          {[
            ['pack_type', 'Pack Type', ['CASE6', 'CASE12']],
            ['assigned_line', 'Assigned Line', ['LABEL-LINE-1', 'LABEL-LINE-2']],
            ['status', 'Status', ['RELEASED', 'RUNNING', 'PAUSED', 'COMPLETED']],
          ].map(([key, label, options]) => (
            <div key={key}>
              <label className="text-xs text-slate-500 font-medium">{label}</label>
              <select value={form[key] || ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                className="w-full h-10 rounded-xl border border-slate-300 px-3 text-sm focus:outline-none focus:border-blue-500 mt-1 bg-white">
                {options.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button className="flex-1 rounded-xl" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {wos.map(wo => (
          <div key={wo.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <button className="w-full flex items-center justify-between p-4 text-left" onClick={() => setExpandedId(expandedId === wo.id ? null : wo.id)}>
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-bold text-slate-900 text-sm">{wo.wo_id}</p>
                  <p className="text-xs text-slate-500">{wo.product} · {wo.assigned_line}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_COLORS[wo.status] || STATUS_COLORS.RELEASED}`}>{wo.status}</span>
                {expandedId === wo.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </button>
            {expandedId === wo.id && (
              <div className="border-t border-slate-100 p-4 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><p className="text-xs text-slate-400">Pack Type</p><p className="font-medium">{wo.pack_type}</p></div>
                  <div><p className="text-xs text-slate-400">Target Bottles</p><p className="font-medium">{wo.target_bottles}</p></div>
                  <div><p className="text-xs text-slate-400">Label SKU</p><p className="font-medium font-mono text-xs">{wo.label_sku_code || '—'}</p></div>
                  <div><p className="text-xs text-slate-400">Carton Code</p><p className="font-medium font-mono text-xs">{wo.carton_code || '—'}</p></div>
                  <div><p className="text-xs text-slate-400">Batch</p><p className="font-medium">{wo.batch_id || '—'}</p></div>
                  <div><p className="text-xs text-slate-400">Priority</p><p className="font-medium">{wo.priority}</p></div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={() => startEdit(wo)}>Edit</Button>
                  <Button variant="outline" size="sm" className="rounded-xl text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleDelete(wo.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}