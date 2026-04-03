import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Edit2, X, Bell } from 'lucide-react';
import ExportButton from '@/components/store/ExportButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

function ConfigModal({ config, onSave, onClose }) {
  const [form, setForm] = useState(config || { item_code: '', item_name: '', uom: '', reorder_level: '', reorder_quantity: '', is_active: true });
  const [saving, setSaving] = useState(false);
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  async function handleSave() {
    if (!form.item_code || form.reorder_level === '') return;
    setSaving(true);
    const payload = { ...form, reorder_level: Number(form.reorder_level), reorder_quantity: form.reorder_quantity ? Number(form.reorder_quantity) : null };
    if (config?.id) await base44.entities.StoreReorderConfig.update(config.id, payload);
    else await base44.entities.StoreReorderConfig.create(payload);
    onSave();
  }
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-slate-900">{config ? 'Edit Reorder Config' : 'Add Reorder Alert'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[{ k: 'item_code', l: 'Item Code *', p: 'e.g. SKU001' }, { k: 'item_name', l: 'Item Name *', p: 'Description' }, { k: 'uom', l: 'Unit', p: 'Kg / Ltr / Nos' }].map(f => (
              <div key={f.k} className={f.k === 'item_name' ? 'col-span-2' : ''}>
                <Label className="text-xs font-medium text-slate-700">{f.l}</Label>
                <Input className="h-9 text-sm mt-1" placeholder={f.p} value={form[f.k] || ''} onChange={e => set(f.k, e.target.value)} />
              </div>
            ))}
            <div>
              <Label className="text-xs font-medium text-slate-700">Reorder Level *</Label>
              <Input type="number" className="h-9 text-sm mt-1" placeholder="Alert threshold" value={form.reorder_level} onChange={e => set('reorder_level', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-700">Reorder Quantity</Label>
              <Input type="number" className="h-9 text-sm mt-1" placeholder="Suggested order qty" value={form.reorder_quantity || ''} onChange={e => set('reorder_quantity', e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="w-4 h-4" />
            <label htmlFor="active" className="text-sm text-slate-700">Active (alert enabled)</label>
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" disabled={saving || !form.item_code || form.reorder_level === ''} onClick={handleSave}>{saving ? 'Saving...' : 'Save'}</Button>
        </div>
      </div>
    </div>
  );
}

export default function SMSReorderConfig() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState([]);
  const [stockByItem, setStockByItem] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    const [cfgs, stock] = await Promise.all([base44.entities.StoreReorderConfig.list('-created_date', 200), base44.entities.StoreStockBalance.list('-created_date', 1000)]);
    setConfigs(cfgs);
    const map = {};
    stock.forEach(s => { map[s.item_code] = (map[s.item_code] || 0) + (s.quantity || 0); });
    setStockByItem(map);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reorder Configuration</h1>
          <p className="text-sm text-slate-500">Set minimum stock thresholds and alert levels per item</p>
        </div>
        <div className="flex gap-2">
          <ExportButton data={configs} columns={[
            { key: 'item_code', label: 'Code' }, { key: 'item_name', label: 'Item' }, { key: 'uom', label: 'Unit' },
            { key: 'reorder_level', label: 'Reorder Level' }, { key: 'reorder_quantity', label: 'Order Qty' },
            { key: 'is_active', label: 'Active' },
          ]} filename="reorder_config" />
          <Button onClick={() => { setEditing(null); setShowModal(true); }} className="gap-2 h-11"><Plus className="w-4 h-4" /> Add Alert</Button>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-100 text-slate-700 text-xs"><th className="text-left px-4 py-3">Item</th><th className="text-right px-4 py-3">Current Stock</th><th className="text-right px-4 py-3">Reorder Level</th><th className="text-right px-4 py-3">Suggest Order</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Alert</th><th className="text-left px-4 py-3">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan={7} className="text-center py-8 text-slate-400">Loading...</td></tr> : configs.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-slate-400">No reorder configs set</td></tr> : configs.map(c => {
                const current = stockByItem[c.item_code] || 0;
                const isLow = current <= c.reorder_level;
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3"><p className="font-medium text-slate-800">{c.item_name || c.item_code}</p><p className="text-xs text-slate-400">{c.item_code} · {c.uom}</p></td>
                    <td className={`px-4 py-3 text-right font-bold ${isLow ? 'text-red-600' : 'text-slate-800'}`}>{current.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{c.reorder_level}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{c.reorder_quantity || '—'}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{c.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td className="px-4 py-3">{isLow && <span className="flex items-center gap-1 text-xs text-red-500 font-medium"><Bell className="w-3.5 h-3.5" />Low Stock</span>}</td>
                    <td className="px-4 py-3"><button onClick={() => { setEditing(c); setShowModal(true); }} className="p-1.5 rounded hover:bg-slate-100 text-slate-500"><Edit2 className="w-4 h-4" /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {showModal && <ConfigModal config={editing} onSave={() => { setShowModal(false); load(); }} onClose={() => setShowModal(false)} />}
    </div>
  );
}