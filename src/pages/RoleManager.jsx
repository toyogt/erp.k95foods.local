import { useState, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Plus, Pencil, Trash2, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { ALL_MODULE_KEYS } from '@/lib/approvalEngine';

const COLOR_OPTIONS = [
  { value: 'slate',  label: 'Slate',   cls: 'bg-slate-100 text-slate-700' },
  { value: 'blue',   label: 'Blue',    cls: 'bg-blue-100 text-blue-700' },
  { value: 'purple', label: 'Purple',  cls: 'bg-purple-100 text-purple-700' },
  { value: 'green',  label: 'Green',   cls: 'bg-green-100 text-green-700' },
  { value: 'orange', label: 'Orange',  cls: 'bg-orange-100 text-orange-700' },
  { value: 'red',    label: 'Red',     cls: 'bg-red-100 text-red-700' },
  { value: 'pink',   label: 'Pink',    cls: 'bg-pink-100 text-pink-700' },
  { value: 'teal',   label: 'Teal',    cls: 'bg-teal-100 text-teal-700' },
  { value: 'indigo', label: 'Indigo',  cls: 'bg-indigo-100 text-indigo-700' },
  { value: 'yellow', label: 'Yellow',  cls: 'bg-yellow-100 text-yellow-700' },
];

const MODULE_LABELS = {
  DASHBOARD: 'Dashboard', PRODUCTION: 'Production', LABELLING: 'Labelling & Packing',
  WAREHOUSE: 'Warehouse & FG', PURCHASE: 'Purchase', GRN: 'Goods Receipt',
  QUALITY: 'Quality', ACCOUNTS: 'Accounts', FMS: 'Process Flow', ADMIN: 'Admin',
};

const EMPTY_FORM = { role_key: '', label: '', description: '', color: 'slate', module_access: [], is_active: true, is_system: false };

function RoleForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);

  const toggleModule = (mod) => {
    setForm(f => ({
      ...f,
      module_access: f.module_access.includes(mod)
        ? f.module_access.filter(m => m !== mod)
        : [...f.module_access, mod],
    }));
  };

  const colorCls = COLOR_OPTIONS.find(c => c.value === form.color)?.cls || 'bg-slate-100 text-slate-700';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Role Key <span className="text-red-500">*</span></Label>
          <Input
            className="mt-1 font-mono text-sm"
            placeholder="e.g. purchase_manager"
            value={form.role_key}
            onChange={e => setForm(f => ({ ...f, role_key: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
            disabled={initial?.is_system}
          />
          <p className="text-xs text-slate-400 mt-0.5">Unique identifier — no spaces, use underscores</p>
        </div>
        <div>
          <Label>Display Label <span className="text-red-500">*</span></Label>
          <Input className="mt-1" placeholder="e.g. Purchase Manager"
            value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
        </div>
      </div>

      <div>
        <Label>Description</Label>
        <Input className="mt-1" placeholder="What can this role do?"
          value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </div>

      <div>
        <Label>Badge Color</Label>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {COLOR_OPTIONS.map(c => (
            <button key={c.value}
              onClick={() => setForm(f => ({ ...f, color: c.value }))}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border-2 transition-all ${c.cls} ${form.color === c.value ? 'border-slate-800 scale-105' : 'border-transparent'}`}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="mt-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${colorCls}`}>Preview: {form.label || 'Role Name'}</span>
        </div>
      </div>

      <div>
        <Label>Module Access</Label>
        <p className="text-xs text-slate-400 mb-2">Select which modules this role can access. Admin always has full access.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ALL_MODULE_KEYS.filter(m => m !== 'ADMIN').map(mod => (
            <label key={mod} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm ${
              form.module_access.includes(mod)
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
            }`}>
              <input type="checkbox" className="hidden"
                checked={form.module_access.includes(mod)}
                onChange={() => toggleModule(mod)} />
              <span className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${
                form.module_access.includes(mod) ? 'bg-white border-white' : 'border-slate-300'
              }`}>
                {form.module_access.includes(mod) && <span className="block w-2 h-2 bg-slate-900 rounded-sm" />}
              </span>
              {MODULE_LABELS[mod] || mod}
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          disabled={saving || !form.role_key || !form.label}
          onClick={() => onSave(form)}
          className="min-h-[44px]"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (initial ? 'Save Changes' : 'Create Role')}
        </Button>
      </div>
    </div>
  );
}

export default function RoleManager() {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { mode: 'create'|'edit', role?: obj }
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [me, data] = await Promise.all([base44.auth.me(), base44.entities.AppRole.list('label')]);
    setUser(me);
    setRoles(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    setSaving(true);
    if (modal.mode === 'create') {
      await base44.entities.AppRole.create(form);
    } else {
      await base44.entities.AppRole.update(modal.role.id, form);
    }
    setSaving(false);
    setModal(null);
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await base44.entities.AppRole.delete(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    load();
  };

  if (!loading && user?.role !== 'admin') {
    return <div className="flex items-center justify-center h-64 text-slate-400">Admin access required.</div>;
  }

  const getColorCls = (color) => {
    const c = COLOR_OPTIONS.find(c => c.value === color);
    return c?.cls || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-slate-700" />
            <h1 className="text-2xl font-bold text-slate-900">Role Manager</h1>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">Create and manage application roles and their module access</p>
        </div>
        <Button onClick={() => setModal({ mode: 'create' })} className="gap-2 min-h-[44px]">
          <Plus className="w-4 h-4" /> New Role
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : (
        <div className="space-y-3">
          {roles.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <Shield className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="font-semibold">No roles yet</p>
              <p className="text-xs mt-1">Click "New Role" to create your first role.</p>
            </div>
          )}
          {roles.map(role => (
            <div key={role.id} className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${getColorCls(role.color)}`}>{role.label}</span>
                    <code className="text-xs text-slate-400 font-mono">{role.role_key}</code>
                    {role.is_system && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">SYSTEM</span>}
                    {!role.is_active && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-semibold">INACTIVE</span>}
                  </div>
                  {role.description && (
                    <p className="text-sm text-slate-500 mt-1">{role.description}</p>
                  )}
                  {role.module_access?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {role.module_access.map(m => (
                        <span key={m} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{MODULE_LABELS[m] || m}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-9 w-9"
                    onClick={() => setModal({ mode: 'edit', role })}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  {!role.is_system && (
                    <Button size="icon" variant="ghost" className="h-9 w-9 text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => setDeleteTarget(role)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      {modal && (
        <Dialog open onOpenChange={() => setModal(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{modal.mode === 'create' ? 'Create New Role' : `Edit Role: ${modal.role.label}`}</DialogTitle>
            </DialogHeader>
            <RoleForm initial={modal.role} onSave={handleSave} onCancel={() => setModal(null)} saving={saving} />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <Dialog open onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Role?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-600">
              Are you sure you want to delete the <strong>{deleteTarget.label}</strong> role?
              Users currently assigned this role will lose their access.
            </p>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700 min-h-[44px]" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete Role'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}