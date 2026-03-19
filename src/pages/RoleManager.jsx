import { useState, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Plus, Pencil, Trash2, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { ALL_MODULE_KEYS } from '@/lib/approvalEngine';
import { getPagesInModule, getVisiblePagesInModule } from '@/lib/registryConfig';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { auditRoleCreated, auditRoleUpdated, auditRoleDeactivated } from '@/lib/auditAdminActions';

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

const EMPTY_FORM = { role_key: '', label: '', description: '', color: 'slate', module_access: [], page_access: [], is_active: true, is_system: false };

function RoleForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [expandedModule, setExpandedModule] = useState(null);

  const toggleModule = (mod) => {
    setForm(f => ({
      ...f,
      module_access: f.module_access.includes(mod)
        ? f.module_access.filter(m => m !== mod)
        : [...f.module_access, mod],
    }));
  };

  const togglePageAccess = (pageKey) => {
    setForm(f => ({
      ...f,
      page_access: f.page_access?.includes(pageKey)
        ? f.page_access.filter(p => p !== pageKey)
        : [...(f.page_access || []), pageKey],
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
         <p className="text-xs text-slate-400 mb-2">Select modules and configure page-level access within each module</p>
         <div className="space-y-2">
           {ALL_MODULE_KEYS.filter(m => m !== 'ADMIN').map(mod => {
             const isSelected = form.module_access.includes(mod);
             const modulePages = getPagesInModule(mod);
             return (
               <div key={mod} className="border border-slate-200 rounded-lg overflow-hidden">
                 <button
                   onClick={() => {
                     toggleModule(mod);
                     if (!isSelected) setExpandedModule(mod);
                   }}
                   className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-all ${
                     isSelected
                       ? 'bg-slate-900 text-white'
                       : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                   }`}
                 >
                   <input
                     type="checkbox"
                     checked={isSelected}
                     onChange={() => {}}
                     className="cursor-pointer"
                   />
                   <span className="flex-1 text-left">{MODULE_LABELS[mod] || mod}</span>
                   {isSelected && (
                     <ChevronDown className={`w-4 h-4 transition-transform ${expandedModule === mod ? 'rotate-180' : ''}`} />
                   )}
                 </button>
                 {isSelected && expandedModule === mod && (
                   <div className="bg-slate-50 border-t border-slate-200 p-3 space-y-1.5 max-h-48 overflow-y-auto">
                     <p className="text-xs text-slate-500 mb-2">Select pages this role can access:</p>
                     {modulePages.length === 0 ? (
                       <p className="text-xs text-slate-400 italic">No pages in this module</p>
                     ) : (
                       modulePages.map(page => (
                         <label key={page.pageKey} className="flex items-center gap-2 px-2 py-1 hover:bg-white rounded cursor-pointer text-xs">
                           <input
                             type="checkbox"
                             checked={form.page_access?.includes(page.pageKey) ?? true}
                             onChange={() => togglePageAccess(page.pageKey)}
                             className="cursor-pointer"
                           />
                           <span className="text-slate-600">{page.title}</span>
                         </label>
                       ))
                     )}
                   </div>
                 )}
               </div>
             );
           })}
         </div>
       </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          disabled={saving || !form.role_key || !form.label}
          onClick={() => onSave(form)}
          className="h-11 px-4"
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
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivating, setDeactivating] = useState(false);

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
    try {
      if (modal.mode === 'create') {
        await base44.entities.AppRole.create(form);
        await auditRoleCreated(user, form.role_key, form.label, form.module_access);
      } else {
        await base44.entities.AppRole.update(modal.role.id, form);
        await auditRoleUpdated(user, form.role_key, form.label, form.module_access);
      }
      setModal(null);
      load();
    } catch (e) {
      console.error('Error saving role:', e);
    }
    setSaving(false);
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await base44.entities.AppRole.update(deactivateTarget.id, { is_active: false });
      await auditRoleDeactivated(user, deactivateTarget.role_key, deactivateTarget.label);
      setDeactivateTarget(null);
      load();
    } catch (e) {
      console.error('Error deactivating role:', e);
    }
    setDeactivating(false);
  };

  // Access control handled by Layout.jsx — if user isn't admin, they won't reach this page

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
        <Button onClick={() => setModal({ mode: 'create' })} className="gap-2 h-11 px-4">
          <Plus className="w-4 h-4" /> New Role
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : (
        <div className="space-y-3">
          {roles.filter(r => !r.is_system).length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <Shield className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="font-semibold">No custom roles yet</p>
              <p className="text-xs mt-1">Click "New Role" to create your first role. (System roles Admin & User are not shown)</p>
            </div>
          )}
          {roles.filter(r => !r.is_system).map(role => (
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
                  {role.page_access?.length > 0 && (
                    <p className="text-xs text-slate-500 mt-2">+ {role.page_access.length} custom page access overrides</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-9 w-9"
                    onClick={() => setModal({ mode: 'edit', role })}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  {!role.is_system && (
                    <Button size="icon" variant="ghost" className="h-9 w-9 text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => setDeactivateTarget(role)}>
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

      {/* Deactivate confirm */}
      <ConfirmDialog
        open={!!deactivateTarget}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title="Deactivate Role?"
        description={`Deactivate "${deactivateTarget?.label}"? Users with this role will lose access, but the role record and history are preserved.`}
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        onConfirm={handleDeactivate}
        isDestructive={true}
        isLoading={deactivating}
      />
    </div>
  );
}