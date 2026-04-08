import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Plus, Edit2, X, Bell, Upload, Send, Loader2 } from 'lucide-react';
import ExportButton from '@/components/store/ExportButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { showSuccessToast, showErrorAlert } from '@/lib/toastHelpers';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function ConfigModal({ config, storeItems, onSave, onClose }) {
  const [form, setForm] = useState(config || { item_code: '', item_name: '', uom: 'Nos', reorder_level: '', reorder_quantity: '', alert_emails: '', is_active: true });
  const [saving, setSaving] = useState(false);
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  // Initialize alert_emails as comma string for editing
  useEffect(() => {
    if (config?.alert_emails && Array.isArray(config.alert_emails)) {
      set('alert_emails', config.alert_emails.join(', '));
    }
  }, []);

  function handleItemSelect(e) {
    const selected = storeItems.find(s => s.item_code === e.target.value);
    if (selected) {
      set('item_code', selected.item_code);
      set('item_name', selected.item_name);
      set('uom', selected.uom || 'Nos');
    }
  }

  async function handleSave() {
    if (!form.item_code || !form.reorder_level) return;
    setSaving(true);
    const emails = typeof form.alert_emails === 'string' 
      ? form.alert_emails.split(',').map(e => e.trim()).filter(Boolean) 
      : (form.alert_emails || []);
    const payload = { 
      item_code: form.item_code,
      item_name: form.item_name,
      uom: form.uom,
      reorder_level: Number(form.reorder_level) || 0,
      reorder_quantity: form.reorder_quantity ? Number(form.reorder_quantity) : null,
      alert_emails: emails,
      is_active: form.is_active,
    };
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
            <div className="col-span-2">
              <Label className="text-xs font-medium text-slate-700">Item <span className="text-red-500">*</span></Label>
              <select
                className="w-full h-11 border border-slate-200 rounded-xl px-3 text-sm mt-1"
                value={form.item_code || ''}
                onChange={handleItemSelect}
              >
                <option value="">Select item...</option>
                {storeItems.map(s => (
                  <option key={s.id} value={s.item_code}>{s.item_name} ({s.item_code})</option>
                ))}
              </select>
            </div>
            {form.item_name && (
              <div className="col-span-2 flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                <span className="text-sm font-medium text-slate-800">{form.item_name}</span>
                <span className="text-xs text-slate-400">{form.uom || 'Nos'}</span>
              </div>
            )}
            <div>
              <Label className="text-xs font-medium text-slate-700">Reorder Level <span className="text-red-500">*</span></Label>
              <Input type="number" className="h-11 text-sm mt-1" placeholder="Alert when stock ≤ this" value={form.reorder_level || ''} onChange={e => set('reorder_level', e.target.value)} />
              <p className="text-xs text-slate-400 mt-0.5">Alert triggers when stock falls to or below this level</p>
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-700">Suggested Reorder Quantity</Label>
              <Input type="number" className="h-11 text-sm mt-1" placeholder="How many to order" value={form.reorder_quantity || ''} onChange={e => set('reorder_quantity', e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-medium text-slate-700">Alert Email Recipients</Label>
              <Input className="h-11 text-sm mt-1" placeholder="email1@example.com, email2@example.com" value={form.alert_emails || ''} onChange={e => set('alert_emails', e.target.value)} />
              <p className="text-xs text-slate-400 mt-0.5">Comma-separated emails to notify when stock is low</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="w-4 h-4" />
            <label htmlFor="active" className="text-sm text-slate-700">Active (alert enabled)</label>
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" disabled={saving || !form.item_code || !form.reorder_level} onClick={handleSave}>{saving ? 'Saving...' : 'Save'}</Button>
        </div>
      </div>
    </div>
  );
}

export default function SMSReorderConfig() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState([]);
  const [stockByItem, setStockByItem] = useState({});
  const [storeItems, setStoreItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);
  const [sendingAlert, setSendingAlert] = useState(null);
  const fileInputRef = useRef(null);

  async function load() {
    setLoading(true);
    const [cfgs, stock, items] = await Promise.all([
      base44.entities.StoreReorderConfig.list('-created_date', 200),
      base44.entities.StoreStockBalance.list('-created_date', 1000),
      base44.entities.StoreItemMaster.filter({ is_active: true }, 'item_name', 500),
    ]);
    setConfigs(cfgs);
    setStoreItems(items);
    const map = {};
    stock.forEach(s => { map[s.item_code] = (map[s.item_code] || 0) + (s.quantity || 0); });
    setStockByItem(map);
    setLoading(false);
  }

  async function handleBulkImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: 'object',
          properties: {
            rows: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  item_code: { type: 'string' },
                  item_name: { type: 'string' },
                  uom: { type: 'string' },
                  reorder_quantity: { type: 'number' },
                },
              },
            },
          },
        },
      });
      const rows = result?.output?.rows || [];
      if (rows.length === 0) {
        showErrorAlert('Import Failed', 'No valid rows found in file');
        setImporting(false);
        return;
      }
      let created = 0;
      for (const row of rows) {
        if (!row.item_code) continue;
        await base44.entities.StoreReorderConfig.create({
          item_code: row.item_code,
          item_name: row.item_name || '',
          uom: row.uom || 'Nos',
          reorder_quantity: row.reorder_quantity || null,
          is_active: true,
        });
        created++;
      }
      showSuccessToast(`Imported ${created} reorder alert(s)`);
      load();
    } catch (err) {
      showErrorAlert('Import Failed', err.message || 'Could not process file');
    }
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  useEffect(() => { load(); }, []);

  async function handleSendAlert(cfg) {
    const current = stockByItem[cfg.item_code] || 0;
    const emails = cfg.alert_emails || [];
    if (emails.length === 0) {
      showErrorAlert('No Recipients', 'Please add alert email recipients to this config first.');
      return;
    }
    setSendingAlert(cfg.id);
    const subject = `Low Stock Alert: ${cfg.item_name || cfg.item_code}`;
    const body = `<h2>Low Stock Alert</h2>
<p><strong>Item:</strong> ${cfg.item_name} (${cfg.item_code})</p>
<p><strong>Current Stock:</strong> ${current.toFixed(2)} ${cfg.uom || 'Nos'}</p>
<p><strong>Reorder Level:</strong> ${cfg.reorder_level}</p>
<p><strong>Suggested Order Quantity:</strong> ${cfg.reorder_quantity || 'Not set'}</p>
<p>Please take necessary action to replenish stock.</p>
<p style="color:#94a3b8;font-size:12px">Sent from K95 ERP Store Management</p>`;
    for (const email of emails) {
      await base44.integrations.Core.SendEmail({ to: email, subject, body });
    }
    await base44.entities.StoreReorderConfig.update(cfg.id, { last_alert_sent_at: new Date().toISOString() });
    showSuccessToast(`Alert sent to ${emails.length} recipient(s)`);
    setSendingAlert(null);
    load();
  }

  return (
    <motion.div className="space-y-4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <ToastContainer />
      <input type="file" ref={fileInputRef} accept=".csv,.xlsx,.xls,.json" className="hidden" onChange={handleBulkImport} />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reorder Configuration</h1>
          <p className="text-sm text-slate-500">Set minimum stock thresholds and alert levels per item</p>
        </div>
        <div className="flex gap-2">
          <ExportButton data={configs} columns={[
            { key: 'item_code', label: 'Code' }, { key: 'item_name', label: 'Item' }, { key: 'uom', label: 'Unit' },
            { key: 'reorder_quantity', label: 'Order Quantity' },
            { key: 'is_active', label: 'Active' },
          ]} filename="reorder_config" />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing} className="gap-2 h-11">
            <Upload className="w-4 h-4" /> {importing ? 'Importing...' : 'Bulk Import'}
          </Button>
          <Button onClick={() => { setEditing(null); setShowModal(true); }} className="gap-2 h-11"><Plus className="w-4 h-4" /> Add Alert</Button>
        </div>
      </div>
      {/* Desktop Table */}
      <div className="hidden md:block bg-white/50 backdrop-blur-xl border border-white/30 rounded-[28px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-100 text-slate-700 text-xs"><th className="text-left px-4 py-3 font-medium">Item</th><th className="text-right px-4 py-3 font-medium">Current Stock</th><th className="text-right px-4 py-3 font-medium">Reorder Level</th><th className="text-right px-4 py-3 font-medium">Suggest Order</th><th className="text-left px-4 py-3 font-medium">Status</th><th className="text-left px-4 py-3 font-medium">Alert</th><th className="text-left px-4 py-3 font-medium">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan={7} className="text-center py-8 text-slate-400">Loading...</td></tr> : configs.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-slate-400">No reorder configs set</td></tr> : configs.map(c => {
                const current = stockByItem[c.item_code] || 0;
                const isLow = (c.reorder_level || 0) > 0 && current <= (c.reorder_level || 0);
                return (
                  <tr key={c.id} className={`hover:bg-slate-50 ${isLow ? 'bg-red-50/40' : ''}`}>
                    <td className="px-4 py-3"><p className="font-medium text-slate-800">{c.item_name || c.item_code}</p><p className="text-xs text-slate-400">{c.item_code} · {c.uom}</p></td>
                    <td className={`px-4 py-3 text-right font-bold ${isLow ? 'text-red-600' : 'text-slate-800'}`}>{current.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-slate-600 font-medium">{c.reorder_level || '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{c.reorder_quantity || '—'}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{c.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td className="px-4 py-3">{isLow ? <span className="flex items-center gap-1 text-xs text-red-500 font-medium"><Bell className="w-3.5 h-3.5" />Low Stock</span> : <span className="text-xs text-green-600">OK</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditing(c); setShowModal(true); }} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" title="Edit"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleSendAlert(c)} disabled={sendingAlert === c.id} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" title="Send Alert Email">
                          {sendingAlert === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 text-xs text-slate-500 font-medium">{configs.length} config(s)</div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {loading ? (
          <div className="text-center py-8 text-slate-400">Loading...</div>
        ) : configs.length === 0 ? (
          <div className="text-center py-8 text-slate-400">No reorder configs set</div>
        ) : configs.map(c => {
          const current = stockByItem[c.item_code] || 0;
          const isLow = (c.reorder_level || 0) > 0 && current <= (c.reorder_level || 0);
          return (
            <div key={c.id} className={`bg-white border rounded-xl p-3 ${isLow ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{c.item_name || c.item_code}</p>
                  <p className="text-xs text-slate-400">{c.item_code} · {c.uom}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{c.is_active ? 'Active' : 'Inactive'}</span>
                  <button onClick={() => { setEditing(c); setShowModal(true); }} className="p-1.5 rounded hover:bg-slate-100 text-slate-500"><Edit2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                <span>Current: <strong className={isLow ? 'text-red-600' : 'text-slate-700'}>{current.toFixed(2)}</strong></span>
                <span>Reorder Level: <strong className="text-slate-700">{c.reorder_level || '—'}</strong></span>
                <span>Order Quantity: <strong className="text-slate-700">{c.reorder_quantity || '—'}</strong></span>
              </div>
              {isLow && (
                <div className="flex items-center justify-between gap-2 mt-2">
                  <span className="flex items-center gap-1 text-xs text-red-500 font-medium"><Bell className="w-3.5 h-3.5" />Low Stock Alert</span>
                  <button onClick={() => handleSendAlert(c)} disabled={sendingAlert === c.id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100">
                    {sendingAlert === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Send Alert
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showModal && <ConfigModal config={editing} storeItems={storeItems} onSave={() => { setShowModal(false); load(); }} onClose={() => setShowModal(false)} />}
    </motion.div>
  );
}