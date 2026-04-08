import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Plus, Edit2, X, Bell, Upload, Send, Loader2, Search, ImageIcon } from 'lucide-react';
import ExportButton from '@/components/store/ExportButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { showSuccessToast, showErrorAlert } from '@/lib/toastHelpers';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function ItemSearchDropdown({ storeItems, value, onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? storeItems.filter(s =>
        (s.item_name || '').toLowerCase().includes(q) ||
        (s.item_code || '').toLowerCase().includes(q)
      )
    : storeItems;

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          className="w-full h-11 pl-8 pr-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-teal-400 mt-1"
          placeholder="Search items by name or code..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto" style={{ zIndex: 9999 }}>
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-amber-600">No items found. Add items via Item Master first.</div>
          ) : filtered.map((s) => (
            <div key={s.id} className="px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 flex items-start gap-2 border-b border-slate-50 last:border-0"
              onClick={() => { setQuery(s.item_name); setOpen(false); onSelect(s); }}>
              {s.material_photo ? (
                <img src={s.material_photo} alt="" className="w-7 h-7 rounded object-cover border border-slate-200 shrink-0 mt-0.5" />
              ) : (
                <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                  <ImageIcon className="w-3 h-3 text-slate-400" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-800 break-words leading-snug">{s.item_name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {s.item_code && `${s.item_code} · `}{s.item_category?.replace('_', ' ')} · {s.uom || 'Nos'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfigModal({ config, storeItems, onSave, onClose }) {
  const [form, setForm] = useState(config || { item_code: '', item_name: '', uom: 'Nos', reorder_level: '', reorder_quantity: '', alert_emails: '', is_active: true });
  const [saving, setSaving] = useState(false);
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  useEffect(() => {
    if (config?.alert_emails && Array.isArray(config.alert_emails)) {
      set('alert_emails', config.alert_emails.join(', '));
    }
  }, []);

  function handleItemSelect(item) {
    set('item_code', item.item_code);
    set('item_name', item.item_name);
    set('uom', item.uom || 'Nos');
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
              <ItemSearchDropdown storeItems={storeItems} value={form.item_code} onSelect={handleItemSelect} />
            </div>
            {form.item_name && (
              <div className="col-span-2 flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                <div className="w-2 h-2 rounded-full bg-teal-500 shrink-0" />
                <span className="text-sm font-medium text-slate-800">{form.item_name}</span>
                <span className="text-xs text-slate-500">{form.item_code}</span>
                <span className="text-xs text-slate-400 ml-auto">{form.uom || 'Nos'}</span>
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
    const subject = `⚠️ Low Stock Alert — ${cfg.item_name || cfg.item_code}`;
    const alertDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const alertTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const body = `
<div style="font-family:'Inter',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
  <div style="background:#0f172a;padding:24px 32px">
    <h1 style="color:#ffffff;font-size:20px;margin:0;font-weight:700">⚠️ Low Stock Alert</h1>
    <p style="color:#94a3b8;font-size:13px;margin:4px 0 0">K95 ERP — Store Management System</p>
  </div>
  <div style="padding:24px 32px">
    <p style="font-size:14px;color:#334155;margin:0 0 16px">The following item has fallen below its configured reorder level and requires immediate attention:</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:10px 12px;font-size:13px;color:#64748b;width:45%">Item Name</td>
        <td style="padding:10px 12px;font-size:14px;color:#0f172a;font-weight:600">${cfg.item_name || '—'}</td>
      </tr>
      <tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:10px 12px;font-size:13px;color:#64748b">Item Code</td>
        <td style="padding:10px 12px;font-size:14px;color:#0f172a;font-family:monospace">${cfg.item_code}</td>
      </tr>
      <tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:10px 12px;font-size:13px;color:#64748b">Unit of Measure</td>
        <td style="padding:10px 12px;font-size:14px;color:#0f172a">${cfg.uom || 'Nos'}</td>
      </tr>
      <tr style="border-bottom:1px solid #f1f5f9;background:#fef2f2">
        <td style="padding:10px 12px;font-size:13px;color:#991b1b;font-weight:600">Current Stock</td>
        <td style="padding:10px 12px;font-size:16px;color:#dc2626;font-weight:700">${current.toFixed(2)} ${cfg.uom || 'Nos'}</td>
      </tr>
      <tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:10px 12px;font-size:13px;color:#64748b">Reorder Level</td>
        <td style="padding:10px 12px;font-size:14px;color:#0f172a;font-weight:600">${cfg.reorder_level} ${cfg.uom || 'Nos'}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;font-size:13px;color:#64748b">Suggested Order Quantity</td>
        <td style="padding:10px 12px;font-size:14px;color:#0f172a;font-weight:600">${cfg.reorder_quantity ? cfg.reorder_quantity + ' ' + (cfg.uom || 'Nos') : 'Not configured'}</td>
      </tr>
    </table>
    <div style="background:#fffbeb;border:1px solid #fbbf24;border-radius:8px;padding:12px 16px;margin-bottom:16px">
      <p style="font-size:13px;color:#92400e;margin:0;font-weight:600">⏰ Action Required</p>
      <p style="font-size:13px;color:#78350f;margin:4px 0 0">Please initiate a purchase order or stock replenishment for this item at the earliest.</p>
    </div>
  </div>
  <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0">
    <p style="font-size:11px;color:#94a3b8;margin:0">Alert generated on ${alertDate} at ${alertTime} · K95 ERP Store Management</p>
  </div>
</div>`;
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