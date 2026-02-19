import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, ChevronDown, ChevronUp, Copy, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';

const STATION_TYPES = ['STORES','RECIPE','FILLING','CHAMBER','RECEIVING','LABELLING','FG'];
const STAGES = ['BEFORE','WHILE','AFTER','STARTUP','FIRST_PIECE','ROLL_CHANGE','RECEIVE','DISPATCH','RESTART_AFTER_HARD_STOP','FG_PALLETIZE'];
const ITEM_TYPES = ['checkbox','number','text'];

const EMPTY_TEMPLATE = { template_id: '', station_type: 'LABELLING', stage: 'STARTUP', name: '', version: 1, is_active: true, items_json: [] };
const EMPTY_ITEM = { id: '', label: '', type: 'checkbox', required: true };

export default function ChecklistTemplateManager() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStation, setFilterStation] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null); // null = list view
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setTemplates(await base44.entities.ChecklistTemplate.list('-created_date', 200)); } catch { /* offline */ }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    const data = { ...editingTemplate };
    try {
      if (data._editId) {
        await base44.entities.ChecklistTemplate.update(data._editId, { template_id: data.template_id, station_type: data.station_type, stage: data.stage, name: data.name, version: Number(data.version), is_active: data.is_active, items_json: data.items_json });
      } else {
        await base44.entities.ChecklistTemplate.create({ template_id: data.template_id, station_type: data.station_type, stage: data.stage, name: data.name, version: Number(data.version), is_active: data.is_active, items_json: data.items_json });
      }
      setEditingTemplate(null);
      await load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  }

  async function handleToggleActive(t) {
    try { await base44.entities.ChecklistTemplate.update(t.id, { is_active: !t.is_active }); await load(); } catch { /* offline */ }
  }

  async function handleDuplicate(t) {
    const maxVer = templates.filter(x => x.template_id === t.template_id).reduce((m, x) => Math.max(m, x.version || 1), 1);
    const newT = { ...t, version: maxVer + 1, is_active: false };
    delete newT.id;
    try { await base44.entities.ChecklistTemplate.create(newT); await load(); } catch { /* offline */ }
  }

  async function handleDelete(t) {
    if (!confirm('Delete this template?')) return;
    await base44.entities.ChecklistTemplate.delete(t.id);
    setTemplates(prev => prev.filter(x => x.id !== t.id));
  }

  function startEdit(t) {
    setEditingTemplate({ ...t, _editId: t.id });
  }

  function addItem() {
    const id = 'item_' + Date.now();
    setEditingTemplate(prev => ({ ...prev, items_json: [...(prev.items_json || []), { ...EMPTY_ITEM, id }] }));
  }

  function updateItem(idx, field, val) {
    setEditingTemplate(prev => {
      const items = [...prev.items_json];
      items[idx] = { ...items[idx], [field]: val };
      return { ...prev, items_json: items };
    });
  }

  function removeItem(idx) {
    setEditingTemplate(prev => ({ ...prev, items_json: prev.items_json.filter((_, i) => i !== idx) }));
  }

  const filtered = templates.filter(t =>
    (!filterStation || t.station_type === filterStation) &&
    (!filterStage || t.stage === filterStage)
  );

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  // Edit view
  if (editingTemplate) return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setEditingTemplate(null)}>← Back</Button>
        <p className="font-bold text-slate-900">{editingTemplate._editId ? 'Edit Template' : 'New Template'}</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        {[['template_id','Template ID'],['name','Name']].map(([k,lbl]) => (
          <div key={k}>
            <label className="text-xs text-slate-500 font-medium">{lbl}</label>
            <input value={editingTemplate[k] || ''} onChange={e => setEditingTemplate(p => ({ ...p, [k]: e.target.value }))}
              className="w-full mt-1 h-10 rounded-xl border border-slate-300 px-3 text-sm focus:outline-none focus:border-blue-500" />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-slate-500 font-medium">Station</label>
            <select value={editingTemplate.station_type} onChange={e => setEditingTemplate(p => ({ ...p, station_type: e.target.value }))}
              className="w-full mt-1 h-10 rounded-xl border border-slate-300 px-3 text-sm focus:outline-none bg-white">
              {STATION_TYPES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">Stage</label>
            <select value={editingTemplate.stage} onChange={e => setEditingTemplate(p => ({ ...p, stage: e.target.value }))}
              className="w-full mt-1 h-10 rounded-xl border border-slate-300 px-3 text-sm focus:outline-none bg-white">
              {STAGES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-500 font-medium">Version</label>
          <input type="number" value={editingTemplate.version} onChange={e => setEditingTemplate(p => ({ ...p, version: e.target.value }))}
            className="w-20 h-9 rounded-xl border border-slate-300 px-3 text-sm focus:outline-none" />
          <label className="flex items-center gap-2 ml-auto cursor-pointer">
            <span className="text-xs text-slate-500 font-medium">Active</span>
            <input type="checkbox" checked={editingTemplate.is_active} onChange={e => setEditingTemplate(p => ({ ...p, is_active: e.target.checked }))} />
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Checklist Items</p>
          <Button size="sm" variant="outline" className="rounded-xl h-8 gap-1" onClick={addItem}><Plus className="w-3 h-3" />Add Item</Button>
        </div>
        {(editingTemplate.items_json || []).map((item, idx) => (
          <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input value={item.label} onChange={e => updateItem(idx, 'label', e.target.value)} placeholder="Item label"
                className="flex-1 h-9 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none" />
              <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-3">
              <select value={item.type} onChange={e => updateItem(idx, 'type', e.target.value)}
                className="h-8 rounded-lg border border-slate-300 px-2 text-xs bg-white focus:outline-none">
                {ITEM_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                <input type="checkbox" checked={item.required} onChange={e => updateItem(idx, 'required', e.target.checked)} />
                Required
              </label>
              <span className="text-xs text-slate-400 font-mono">id: {item.id}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setEditingTemplate(null)}>Cancel</Button>
        <Button className="flex-1 rounded-xl h-12" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Template'}
        </Button>
      </div>
    </div>
  );

  // List view
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select value={filterStation} onChange={e => setFilterStation(e.target.value)} className="flex-1 h-9 rounded-xl border border-slate-300 px-2 text-xs bg-white">
          <option value="">All Stations</option>
          {STATION_TYPES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterStage} onChange={e => setFilterStage(e.target.value)} className="flex-1 h-9 rounded-xl border border-slate-300 px-2 text-xs bg-white">
          <option value="">All Stages</option>
          {STAGES.map(s => <option key={s}>{s}</option>)}
        </select>
        <Button size="sm" className="rounded-xl h-9 gap-1 shrink-0" onClick={() => setEditingTemplate({ ...EMPTY_TEMPLATE })}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-2">
        {filtered.map(t => (
          <div key={t.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <button className="w-full flex items-center gap-3 p-3 text-left" onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 text-sm truncate">{t.name}</p>
                <p className="text-xs text-slate-500">{t.station_type} · {t.stage} · v{t.version} · {(t.items_json || []).length} items</p>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${t.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {t.is_active ? 'ACTIVE' : 'OFF'}
              </span>
              {expandedId === t.id ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
            </button>
            {expandedId === t.id && (
              <div className="border-t border-slate-100 p-3 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 rounded-xl text-xs" onClick={() => startEdit(t)}>Edit</Button>
                <Button variant="outline" size="sm" className="rounded-xl" title="Duplicate" onClick={() => handleDuplicate(t)}><Copy className="w-3.5 h-3.5" /></Button>
                <Button variant="outline" size="sm" className="rounded-xl" title={t.is_active ? 'Deactivate' : 'Activate'} onClick={() => handleToggleActive(t)}>
                  {t.is_active ? <ToggleRight className="w-3.5 h-3.5 text-emerald-600" /> : <ToggleLeft className="w-3.5 h-3.5 text-slate-400" />}
                </Button>
                <Button variant="outline" size="sm" className="rounded-xl text-red-500 border-red-200" onClick={() => handleDelete(t)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No templates found. Create one above.</p>}
      </div>
    </div>
  );
}