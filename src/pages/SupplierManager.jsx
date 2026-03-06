import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Search, CheckCircle2, AlertTriangle, Ban, Edit2, X } from 'lucide-react';
import { STATUS_COLOR, logPurchaseAudit, genId } from '@/components/purchase/purchaseHelpers';

const EMPTY = {
  supplier_id: '', supplier_name: '', approval_status: 'HOLD', is_approved: false,
  gstin: '', payment_terms_days: '', default_currency: 'INR',
  contact_name: '', phone: '', email: '', bank_details: '', notes: '',
};

export default function SupplierManager() {
  const [user, setUser] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // null = list, {} = new/edit form
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    load();
  }, []);

  async function load() {
    setLoading(true);
    const data = await base44.entities.Supplier.list('supplier_name', 500);
    setSuppliers(data);
    setLoading(false);
  }

  function startNew() {
    setForm({ ...EMPTY, supplier_id: genId('SUP') });
    setEditing('new');
  }

  function startEdit(s) {
    setForm({ ...s });
    setEditing(s.id);
  }

  function setF(field, val) {
    setForm(prev => {
      const updated = { ...prev, [field]: val };
      if (field === 'approval_status') {
        updated.is_approved = val === 'APPROVED';
      }
      return updated;
    });
  }

  async function handleSave() {
    if (!form.supplier_name.trim()) { alert('Supplier name required'); return; }
    setSaving(true);
    try {
      if (editing === 'new') {
        await base44.entities.Supplier.create({ ...form, payment_terms_days: Number(form.payment_terms_days) || undefined });
        await logPurchaseAudit({ action: `Supplier ${form.supplier_id} created`, entity_type: 'Supplier', entity_id: form.supplier_id, user });
      } else {
        await base44.entities.Supplier.update(editing, { ...form, payment_terms_days: Number(form.payment_terms_days) || undefined });
        await logPurchaseAudit({ action: `Supplier ${form.supplier_id} updated`, entity_type: 'Supplier', entity_id: form.supplier_id, user });
      }
      setEditing(null);
      load();
    } catch (e) { alert('Error: ' + e.message); }
    setSaving(false);
  }

  async function handleStatusChange(s, newStatus) {
    await base44.entities.Supplier.update(s.id, {
      approval_status: newStatus,
      is_approved: newStatus === 'APPROVED',
    });
    await logPurchaseAudit({ action: `Supplier ${s.supplier_id} → ${newStatus}`, entity_type: 'Supplier', entity_id: s.supplier_id, user });
    load();
  }

  async function handleDelete(s) {
    // Check for references
    const [pos, mrs] = await Promise.all([
      base44.entities.PurchaseOrder.filter({ supplier_id: s.supplier_id }, '-created_date', 1),
      base44.entities.PurchaseRequest.list('-created_date', 1),
    ]);
    if (pos.length > 0) {
      alert(`Cannot delete — ${s.supplier_name} has purchase orders. Block or Hold instead.`);
      return;
    }
    if (!window.confirm(`Delete supplier ${s.supplier_name}?`)) return;
    await base44.entities.Supplier.delete(s.id);
    await logPurchaseAudit({ action: `Supplier ${s.supplier_id} deleted`, entity_type: 'Supplier', entity_id: s.supplier_id, user });
    load();
  }

  const filtered = suppliers.filter(s =>
    s.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.supplier_id?.toLowerCase().includes(search.toLowerCase()) ||
    s.gstin?.toLowerCase().includes(search.toLowerCase())
  );

  const StatusIcon = ({ status }) => {
    if (status === 'APPROVED') return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    if (status === 'HOLD') return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    return <Ban className="w-4 h-4 text-red-500" />;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Suppliers</h1>
          <p className="text-sm text-slate-500">Master list with approval status</p>
        </div>
        {!editing && (
          <Button onClick={startNew} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        )}
      </div>

      {/* Form */}
      {editing && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-900">{editing === 'new' ? 'New Supplier' : 'Edit Supplier'}</h3>
            <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-slate-500">Supplier Name *</label>
              <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1"
                value={form.supplier_name} onChange={e => setF('supplier_name', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500">Status</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1 bg-white"
                value={form.approval_status} onChange={e => setF('approval_status', e.target.value)}>
                <option value="APPROVED">APPROVED</option>
                <option value="HOLD">HOLD</option>
                <option value="BLOCKED">BLOCKED</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">GSTIN</label>
              <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1"
                value={form.gstin} onChange={e => setF('gstin', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500">Contact Name</label>
              <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1"
                value={form.contact_name} onChange={e => setF('contact_name', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500">Phone</label>
              <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1"
                value={form.phone} onChange={e => setF('phone', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-500">Email</label>
              <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1"
                value={form.email} onChange={e => setF('email', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500">Payment Terms (days)</label>
              <input type="number" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1"
                value={form.payment_terms_days} onChange={e => setF('payment_terms_days', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500">Currency</label>
              <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1"
                value={form.default_currency} onChange={e => setF('default_currency', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-500">Bank Details</label>
              <textarea className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1" rows={2}
                value={form.bank_details} onChange={e => setF('bank_details', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-500">Notes</label>
              <textarea className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1" rows={2}
                value={form.notes} onChange={e => setF('notes', e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(null)} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {/* Search */}
      {!editing && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm bg-white"
            placeholder="Search suppliers…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      )}

      {/* List */}
      {!editing && (
        loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : (
          <div className="space-y-2">
            {filtered.map(s => (
              <div key={s.id} className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <StatusIcon status={s.approval_status} />
                    <div>
                      <p className="font-bold text-slate-900">{s.supplier_name}</p>
                      <p className="text-xs text-slate-400 font-mono">{s.supplier_id}</p>
                      {s.gstin && <p className="text-xs text-slate-400">GSTIN: {s.gstin}</p>}
                      {s.contact_name && <p className="text-xs text-slate-400">{s.contact_name} · {s.phone}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[s.approval_status] || ''}`}>
                      {s.approval_status}
                    </span>
                    <button onClick={() => startEdit(s)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {/* Quick status toggles */}
                <div className="flex gap-2 mt-3">
                  {s.approval_status !== 'APPROVED' && (
                    <button onClick={() => handleStatusChange(s, 'APPROVED')}
                      className="text-xs font-semibold text-green-700 bg-green-100 px-3 py-1 rounded-lg hover:bg-green-200">
                      Approve
                    </button>
                  )}
                  {s.approval_status !== 'HOLD' && (
                    <button onClick={() => handleStatusChange(s, 'HOLD')}
                      className="text-xs font-semibold text-amber-700 bg-amber-100 px-3 py-1 rounded-lg hover:bg-amber-200">
                      Hold
                    </button>
                  )}
                  {s.approval_status !== 'BLOCKED' && (
                    <button onClick={() => handleStatusChange(s, 'BLOCKED')}
                      className="text-xs font-semibold text-red-700 bg-red-100 px-3 py-1 rounded-lg hover:bg-red-200">
                      Block
                    </button>
                  )}
                  <button onClick={() => handleDelete(s)}
                    className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg hover:bg-red-50 hover:text-red-600 ml-auto">
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-center text-slate-400 py-8">No suppliers found.</p>}
          </div>
        )
      )}
    </div>
  );
}