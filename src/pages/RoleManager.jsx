import { useState, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Plus, Pencil, Shield, ChevronDown, ChevronUp, ToggleLeft, ToggleRight } from 'lucide-react';
import { ALL_MODULE_KEYS } from '@/lib/approvalEngine';
import { getPagesInModule, getVisiblePagesInModule } from '@/lib/registryConfig';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { auditRoleCreated, auditRoleUpdated, auditRoleDeactivated } from '@/lib/auditAdminActions';



const MODULE_LABELS = {
  DASHBOARD: 'Dashboard', PRODUCTION: 'Production', LABELLING: 'Labelling & Packing',
  LBL_DEPT: 'Labelling Department', WAREHOUSE: 'Warehouse & FG', PURCHASE: 'Purchase',
  STORE: 'Store Management', QUALITY: 'Quality', ACCOUNTS: 'Accounts',
  FMS: 'Process Flow', SALES: 'Sales', USER_MANAGEMENT: 'User Management',
  ADMIN: 'System', HR: 'Human Resources', ALL_ITEMS: 'All Items',
  PRINT_MGMT: 'Print Management',
};

// Fallback: convert SNAKE_CASE to Title Case for any module not in the map
const formatModuleLabel = (key) => {
  if (MODULE_LABELS[key]) return MODULE_LABELS[key];
  return key
    .split('_')
    .map(w => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
};

const EMPTY_FORM = { role_key: '', label: '', description: '', module_access: [], page_access: [], is_active: true, is_system: false };

function RoleForm({ initial, onSave, onCancel, saving }) {
  // Infer modules from page_access if module_access is empty
  const inferModulesFromPages = (pages) => {
    if (!pages?.length) return [];
    const modules = new Set();
    pages.forEach(pageKey => {
      ALL_MODULE_KEYS.forEach(mod => {
        if (getPagesInModule(mod).find(p => p.pageKey === pageKey)) {
          modules.add(mod);
        }
      });
    });
    return Array.from(modules);
  };

  const initialData = initial ? {
    ...initial,
    module_access: initial.module_access?.length > 0 ? initial.module_access : inferModulesFromPages(initial.page_access)
  } : EMPTY_FORM;

  const [form, setForm] = useState(initialData);
  const [expandedModule, setExpandedModule] = useState(null);

  const toggleExpandModule = (mod) => {
    setExpandedModule(expandedModule === mod ? null : mod);
  };

  const togglePageAccess = (pageKey, moduleKey) => {
    setForm(f => {
      const isCurrentlySelected = f.page_access?.includes(pageKey);
      const newPageAccess = isCurrentlySelected
        ? f.page_access.filter(p => p !== pageKey)
        : [...(f.page_access || []), pageKey];

      // If selecting a page, auto-select the module
      let newModuleAccess = f.module_access;
      if (!isCurrentlySelected && !newModuleAccess.includes(moduleKey)) {
        newModuleAccess = [...newModuleAccess, moduleKey];
      }

      // If no pages left in module, auto-deselect the module
      const modulePages = getPagesInModule(moduleKey).map(p => p.pageKey);
      const hasAnyPageInModule = newPageAccess.some(p => modulePages.includes(p));
      if (isCurrentlySelected && !hasAnyPageInModule && newModuleAccess.includes(moduleKey)) {
        newModuleAccess = newModuleAccess.filter(m => m !== moduleKey);
      }

      return {
        ...f,
        module_access: newModuleAccess,
        page_access: newPageAccess,
      };
    });
  };

  const selectedPageCountForModule = (mod) => {
    const modulePages = getPagesInModule(mod).map(p => p.pageKey);
    return (form.page_access || []).filter(p => modulePages.includes(p)).length;
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 space-y-4 pb-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700">Role Name <span className="text-red-500">*</span></Label>
          <Input
            className="h-11 md:h-9 text-base md:text-sm"
            placeholder="e.g. Purchase Manager"
            value={form.label}
            onChange={e => {
              const newLabel = e.target.value;
              const newRoleKey = newLabel.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
              setForm(f => ({ ...f, label: newLabel, role_key: newRoleKey }));
            }}
            disabled={initial?.is_system}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700">Description</Label>
          <Input
            className="h-11 md:h-9 text-base md:text-sm"
            placeholder="What can this role do?"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            disabled={initial?.is_system}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-slate-700">Module Access</Label>
          <p className="text-xs text-slate-500">Tap a module to choose which pages this role can access</p>
          <div className="space-y-2">
            {ALL_MODULE_KEYS.filter(m => m !== 'ADMIN').map(mod => {
              const isSelected = form.module_access.includes(mod);
              const modulePages = getPagesInModule(mod);
              const isExpanded = expandedModule === mod;
              const selectedCount = selectedPageCountForModule(mod);
              return (
                <div key={mod} className={`border rounded-xl overflow-hidden transition-colors ${isSelected ? 'border-slate-900' : 'border-slate-200'}`}>
                  <button
                    type="button"
                    onClick={() => toggleExpandModule(mod)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-all ${
                      isSelected
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-white border-white' : 'border-slate-300 bg-white'
                    }`}>
                      {isSelected && (
                        <svg className="w-3.5 h-3.5 text-slate-900" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-8 8a1 1 0 01-1.415 0l-4-4a1 1 0 011.415-1.42L8 12.58l7.29-7.29a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </span>
                    <span className="flex-1 text-left truncate">{formatModuleLabel(mod)}</span>
                    {isSelected && modulePages.length > 0 && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {selectedCount}/{modulePages.length}
                      </span>
                    )}
                    {modulePages.length > 0 && (
                      <ChevronDown className={`w-4 h-4 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="bg-slate-50 border-t border-slate-200 p-2 space-y-0.5">
                      <p className="text-xs text-slate-500 px-2 py-1.5">Pages in this module:</p>
                      {modulePages.length === 0 ? (
                        <p className="text-xs text-slate-400 italic px-2 py-1">No pages in this module</p>
                      ) : (
                        modulePages.map(page => {
                          const checked = form.page_access?.includes(page.pageKey) ?? true;
                          return (
                            <label
                              key={page.pageKey}
                              className="flex items-center gap-3 px-3 py-3 md:py-2 hover:bg-white active:bg-white rounded-lg cursor-pointer text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePageAccess(page.pageKey, mod)}
                                className="w-5 h-5 md:w-4 md:h-4 cursor-pointer accent-slate-900 shrink-0"
                              />
                              <span className="text-slate-700 flex-1">{page.title}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pinned footer — always visible */}
      <div className="shrink-0 px-4 py-3 bg-white border-t border-slate-200 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
        <Button
          variant="outline"
          onClick={onCancel}
          className="h-11 md:h-9 w-full sm:w-auto"
        >
          Cancel
        </Button>
        <Button
          disabled={saving || !form.role_key || !form.label}
          onClick={() => onSave(form)}
          className="h-11 md:h-9 w-full sm:w-auto px-4"
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

  const handleToggleActive = async (role) => {
    setDeactivating(true);
    try {
      const newActiveState = !role.is_active;
      await base44.entities.AppRole.update(role.id, { is_active: newActiveState });
      if (!newActiveState) {
        await auditRoleDeactivated(user, role.role_key, role.label);
      }
      setDeactivateTarget(null);
      load();
    } catch (e) {
      console.error('Error toggling role active state:', e);
    }
    setDeactivating(false);
  };

  // Access control handled by Layout.jsx — if user isn't admin, they won't reach this page



  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-5 pb-12 px-3 md:px-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 md:w-6 md:h-6 text-slate-700 shrink-0" />
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 truncate">Role Manager</h1>
          </div>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">Create and manage application roles and their module access</p>
        </div>
        <Button onClick={() => setModal({ mode: 'create' })} className="gap-2 h-11 px-4 w-full md:w-auto">
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
                   <span className="text-sm font-bold text-slate-900">{role.label}</span>
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
                       <span key={m} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{formatModuleLabel(m)}</span>
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
                     <Button size="icon" variant="ghost" className={`h-9 w-9 ${role.is_active ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-green-600 hover:text-green-700 hover:bg-green-50'}`}
                       onClick={() => handleToggleActive(role)}
                       disabled={deactivating}>
                       {role.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
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
          <DialogContent
            className="
              max-w-lg p-0 gap-0 overflow-hidden
              w-[calc(100vw-1rem)] sm:w-full
              h-[92vh] sm:h-auto sm:max-h-[90vh]
              flex flex-col
              rounded-xl sm:rounded-lg
            "
          >
            <DialogHeader className="px-4 pt-4 pb-3 border-b border-slate-200 shrink-0">
              <DialogTitle className="text-base md:text-lg pr-6 truncate">
                {modal.mode === 'create' ? 'Create New Role' : `Edit Role: ${modal.role.label}`}
              </DialogTitle>
            </DialogHeader>
            <RoleForm initial={modal.role} onSave={handleSave} onCancel={() => setModal(null)} saving={saving} />
          </DialogContent>
        </Dialog>
      )}


    </div>
  );
}