import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Pencil, Trash2, Warehouse, Package, Settings } from 'lucide-react';

const BIN_TYPES = ['RECEIVING', 'QC_HOLD', 'UNRESTRICTED', 'REJECTED', 'RTV'];
const BIN_TYPE_COLOR = {
  RECEIVING:    'bg-blue-100 text-blue-700',
  QC_HOLD:      'bg-amber-100 text-amber-700',
  UNRESTRICTED: 'bg-green-100 text-green-700',
  REJECTED:     'bg-red-100 text-red-700',
  RTV:          'bg-slate-100 text-slate-600',
};
const WORKFLOW_PURPOSES = ['QC_HOLD', 'RECEIVING', 'REJECTED', 'RTV', 'DEFAULT_PUTAWAY'];

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl">×</button>
        </div>
        <div className="p-4 space-y-3">{children}</div>
      </div>
    </div>
  );
}

export default function WarehouseBins() {
  const [tab, setTab] = useState('warehouses');
  const [warehouses, setWarehouses] = useState([]);
  const [bins, setBins] = useState([]);
  const [binConfigs, setBinConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'wh' | 'bin' | 'config'
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [wh, bn, cfg] = await Promise.all([
      base44.entities.Warehouse.filter({}),
      base44.entities.Bin.filter({}),
      base44.entities.WorkflowBinConfig.filter({}),
    ]);
    setWarehouses(wh);
    setBins(bn);
    setBinConfigs(cfg);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openModal(type, record = null) {
    setModal(type);
    setEditing(record);
    if (type === 'wh') setForm(record ? { warehouse_name: record.warehouse_name, is_active: record.is_active } : { warehouse_name: '', is_active: true });
    if (type === 'bin') setForm(record ? { bin_code: record.bin_code, bin_name: record.bin_name || '', bin_type: record.bin_type, warehouse_id: record.warehouse_id || '', is_active: record.is_active } : { bin_code: '', bin_name: '', bin_type: 'UNRESTRICTED', warehouse_id: warehouses[0]?.warehouse_id || '', is_active: true });
    if (type === 'config') setForm(record ? { purpose: record.purpose, bin_id: record.bin_id, is_active: record.is_active } : { purpose: 'QC_HOLD', bin_id: '', is_active: true });
  }

  function closeModal() { setModal(null); setEditing(null); setForm({}); }

  async function saveWarehouse() {
    setSaving(true);
    if (editing) {
      await base44.entities.Warehouse.update(editing.id, { warehouse_name: form.warehouse_name, is_active: form.is_active });
    } else {
      const wh_id = `WH-${Date.now().toString(36).toUpperCase()}`;
      await base44.entities.Warehouse.create({ warehouse_id: wh_id, warehouse_name: form.warehouse_name, is_active: true });
    }
    setSaving(false); closeModal(); load();
  }

  async function saveBin() {
    setSaving(true);
    if (editing) {
      await base44.entities.Bin.update(editing.id, { bin_code: form.bin_code, bin_name: form.bin_name, bin_type: form.bin_type, warehouse_id: form.warehouse_id, is_active: form.is_active });
    } else {
      const bin_id = `BIN-${Date.now().toString(36).toUpperCase()}`;
      await base44.entities.Bin.create({ bin_id, bin_code: form.bin_code, bin_name: form.bin_name, bin_type: form.bin_type, warehouse_id: form.warehouse_id, is_active: true });
    }
    setSaving(false); closeModal(); load();
  }

  async function saveConfig() {
    setSaving(true);
    const bin = bins.find(b => b.bin_id === form.bin_id);
    if (editing) {
      await base44.entities.WorkflowBinConfig.update(editing.id, { purpose: form.purpose, bin_id: form.bin_id, bin_code: bin?.bin_code || '', is_active: form.is_active });
    } else {
      await base44.entities.WorkflowBinConfig.create({ purpose: form.purpose, bin_id: form.bin_id, bin_code: bin?.bin_code || '', is_active: true });
    }
    setSaving(false); closeModal(); load();
  }

  async function deleteRecord(entity, id) {
    if (!confirm('Delete this record?')) return;
    await base44.entities[entity].delete(id);
    load();
  }

  const TABS = [
    { k: 'warehouses', label: 'Warehouses', icon: Warehouse },
    { k: 'bins', label: 'Bins', icon: Package },
    { k: 'workflow', label: 'Workflow Config', icon: Settings },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-12">
      <h1 className="text-2xl font-bold text-slate-900">Warehouses & Bins</h1>

      <div className="flex gap-1">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === t.k ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'}`}>
              <Icon className="w-4 h-4" />{t.label}
            </button>
          );
        })}
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div> : (
        <>
          {/* Warehouses */}
          {tab === 'warehouses' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button onClick={() => openModal('wh')} className="h-9 bg-slate-900"><Plus className="w-4 h-4 mr-1" />Add Warehouse</Button>
              </div>
              {warehouses.map(wh => (
                <div key={wh.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{wh.warehouse_name}</p>
                    <p className="text-xs text-slate-400 font-mono">{wh.warehouse_id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${wh.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{wh.is_active ? 'Active' : 'Inactive'}</span>
                    <button onClick={() => openModal('wh', wh)} className="p-1.5 rounded-lg hover:bg-slate-100"><Pencil className="w-4 h-4 text-slate-500" /></button>
                    <button onClick={() => deleteRecord('Warehouse', wh.id)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-400" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bins */}
          {tab === 'bins' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button onClick={() => openModal('bin')} className="h-9 bg-slate-900"><Plus className="w-4 h-4 mr-1" />Add Bin</Button>
              </div>
              {bins.map(bin => (
                <div key={bin.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900 font-mono">{bin.bin_code}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${BIN_TYPE_COLOR[bin.bin_type] || ''}`}>{bin.bin_type}</span>
                    </div>
                    <p className="text-xs text-slate-400">{bin.bin_name || '—'} · WH: {warehouses.find(w => w.warehouse_id === bin.warehouse_id)?.warehouse_name || bin.warehouse_id || '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openModal('bin', bin)} className="p-1.5 rounded-lg hover:bg-slate-100"><Pencil className="w-4 h-4 text-slate-500" /></button>
                    <button onClick={() => deleteRecord('Bin', bin.id)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-400" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Workflow Config */}
          {tab === 'workflow' && (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
                Assign a bin to each workflow purpose. These control where stock moves automatically during receiving, QC, and putaway.
              </div>
              <div className="flex justify-end">
                <Button onClick={() => openModal('config')} className="h-9 bg-slate-900"><Plus className="w-4 h-4 mr-1" />Add Config</Button>
              </div>
              {binConfigs.map(cfg => {
                const bin = bins.find(b => b.bin_id === cfg.bin_id);
                return (
                  <div key={cfg.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{cfg.purpose}</p>
                      <p className="text-xs text-slate-400">→ {bin?.bin_code || cfg.bin_id} {bin ? `(${bin.bin_type})` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{cfg.is_active ? 'Active' : 'Off'}</span>
                      <button onClick={() => openModal('config', cfg)} className="p-1.5 rounded-lg hover:bg-slate-100"><Pencil className="w-4 h-4 text-slate-500" /></button>
                      <button onClick={() => deleteRecord('WorkflowBinConfig', cfg.id)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-400" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Warehouse Modal */}
      {modal === 'wh' && (
        <Modal title={editing ? 'Edit Warehouse' : 'Add Warehouse'} onClose={closeModal}>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Warehouse Name</label>
            <input type="text" value={form.warehouse_name || ''} onChange={e => setForm(f => ({ ...f, warehouse_name: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" placeholder="e.g. Main Warehouse" />
          </div>
          <Button onClick={saveWarehouse} disabled={saving || !form.warehouse_name} className="w-full h-10 bg-slate-900">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}{editing ? 'Update' : 'Create'}
          </Button>
        </Modal>
      )}

      {/* Bin Modal */}
      {modal === 'bin' && (
        <Modal title={editing ? 'Edit Bin' : 'Add Bin'} onClose={closeModal}>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Bin Code <span className="text-red-500">*</span></label>
            <input type="text" value={form.bin_code || ''} onChange={e => setForm(f => ({ ...f, bin_code: e.target.value.toUpperCase() }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono uppercase" placeholder="e.g. QC-HOLD-A1" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Bin Name (optional)</label>
            <input type="text" value={form.bin_name || ''} onChange={e => setForm(f => ({ ...f, bin_name: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" placeholder="e.g. QC Hold Zone A" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Bin Type</label>
            <select value={form.bin_type || 'UNRESTRICTED'} onChange={e => setForm(f => ({ ...f, bin_type: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm">
              {BIN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Warehouse</label>
            <select value={form.warehouse_id || ''} onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm">
              <option value="">— None —</option>
              {warehouses.map(w => <option key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse_name}</option>)}
            </select>
          </div>
          <Button onClick={saveBin} disabled={saving || !form.bin_code} className="w-full h-10 bg-slate-900">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}{editing ? 'Update' : 'Create'}
          </Button>
        </Modal>
      )}

      {/* Workflow Config Modal */}
      {modal === 'config' && (
        <Modal title={editing ? 'Edit Config' : 'Add Workflow Bin Config'} onClose={closeModal}>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Purpose</label>
            <select value={form.purpose || 'QC_HOLD'} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm">
              {WORKFLOW_PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Bin</label>
            <select value={form.bin_id || ''} onChange={e => setForm(f => ({ ...f, bin_id: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm">
              <option value="">— Select Bin —</option>
              {bins.filter(b => b.is_active).map(b => <option key={b.bin_id} value={b.bin_id}>{b.bin_code} ({b.bin_type})</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="cfg_active" checked={!!form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
            <label htmlFor="cfg_active" className="text-sm text-slate-700">Active</label>
          </div>
          <Button onClick={saveConfig} disabled={saving || !form.bin_id} className="w-full h-10 bg-slate-900">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}{editing ? 'Update' : 'Create'}
          </Button>
        </Modal>
      )}
    </div>
  );
}