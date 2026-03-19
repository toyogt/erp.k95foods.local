/**
 * Permission Policy Form
 * Configure modules, pages, actions, and approvals for a role
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Trash2, Plus } from 'lucide-react';
import { ALL_MODULE_KEYS } from '@/lib/approvalEngine';
import { pageRegistry, getPageByKey } from '@/lib/registryConfig';

const EMPTY_POLICY = {
  role_key: '',
  module_access: [],
  page_overrides: [],
  action_permissions: [],
  field_restrictions: [],
  is_active: true,
};

// Get available pages from registry
const getAllPages = () => pageRegistry.map(p => ({ key: p.pageKey, title: p.title }));
const getAllEntities = () => ['Batch', 'Crate', 'Pallet', 'PurchaseOrder', 'GRNHeader', 'Invoice', 'PaymentRequest', 'PackingWO'];
const getAvailableActions = () => ['Create', 'Edit', 'Delete', 'Approve', 'Receive', 'Dispatch', 'Cancel'];

export default function PermissionPolicyForm({ initial, availableRoles, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || EMPTY_POLICY);
  const [error, setError] = useState('');
  const [allPages] = useState(getAllPages());
  const [allEntities] = useState(getAllEntities());
  const [availableActions] = useState(getAvailableActions());

  const toggleModule = (mod) => {
    setForm(f => ({
      ...f,
      module_access: f.module_access.includes(mod)
        ? f.module_access.filter(m => m !== mod)
        : [...f.module_access, mod],
    }));
  };

  const addPageOverride = () => {
    setForm(f => ({
      ...f,
      page_overrides: [...(f.page_overrides || []), { page_key: '', allow: true }],
    }));
  };

  const removePageOverride = (idx) => {
    setForm(f => ({
      ...f,
      page_overrides: f.page_overrides.filter((_, i) => i !== idx),
    }));
  };

  const addActionPermission = () => {
    setForm(f => ({
      ...f,
      action_permissions: [...(f.action_permissions || []), { action_key: '', entity_type: '', workflow_stages: [], allow: true }],
    }));
  };

  const removeActionPermission = (idx) => {
    setForm(f => ({
      ...f,
      action_permissions: f.action_permissions.filter((_, i) => i !== idx),
    }));
  };

  const handleSave = () => {
    if (!form.role_key) {
      setError('Role key is required');
      return;
    }
    if (form.module_access.length === 0) {
      setError('Select at least one module');
      return;
    }
    // Validate page overrides
    if (form.page_overrides?.some(p => !p.page_key)) {
      setError('Page overrides must have a page selected');
      return;
    }
    // Validate action permissions
    if (form.action_permissions?.some(a => !a.action_key || !a.entity_type)) {
      setError('All action permissions must have Action and Entity selected');
      return;
    }
    setError('');
    onSave(form);
  };

  return (
    <div className="space-y-5">
      <div>
        <Label>Role Key</Label>
        <Input
          placeholder="e.g. production_manager"
          value={form.role_key}
          onChange={e => setForm(f => ({ ...f, role_key: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
          disabled={!!initial}
          className="mt-1 font-mono text-sm"
        />
        {!initial && availableRoles.length > 0 && (
          <div className="text-xs text-slate-500 mt-2">
            Or select: {availableRoles.slice(0, 3).map(r => r.role_key).join(', ')}
          </div>
        )}
      </div>

      <div>
        <Label className="mb-2 block">Module Access</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ALL_MODULE_KEYS.filter(m => m !== 'ADMIN').map(mod => (
            <label key={mod} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm ${
              form.module_access.includes(mod)
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
            }`}>
              <input type="checkbox" className="hidden" checked={form.module_access.includes(mod)} onChange={() => toggleModule(mod)} />
              {mod}
            </label>
          ))}
        </div>
      </div>

      <div>
         <div className="flex items-center justify-between mb-2">
           <Label>Page Access (Optional)</Label>
           <Button size="sm" variant="outline" onClick={addPageOverride} className="h-8 gap-1">
             <Plus className="w-3 h-3" /> Add
           </Button>
         </div>
         <p className="text-xs text-slate-500 mb-2">Override page access beyond module defaults</p>
         <div className="space-y-2">
           {form.page_overrides?.map((override, idx) => (
             <div key={idx} className="flex gap-2 items-end border border-slate-200 p-2 rounded-lg">
               <div className="flex-1">
                 <select
                   value={override.page_key}
                   onChange={e => {
                     const newOverrides = [...form.page_overrides];
                     newOverrides[idx].page_key = e.target.value;
                     setForm(f => ({ ...f, page_overrides: newOverrides }));
                   }}
                   className="w-full px-2 py-2 border border-slate-200 rounded text-sm"
                 >
                   <option value="">Select Page...</option>
                   {allPages.map(p => (
                     <option key={p.key} value={p.key}>{p.title}</option>
                   ))}
                 </select>
               </div>
               <select
                 value={override.allow ? 'allow' : 'deny'}
                 onChange={e => {
                   const newOverrides = [...form.page_overrides];
                   newOverrides[idx].allow = e.target.value === 'allow';
                   setForm(f => ({ ...f, page_overrides: newOverrides }));
                 }}
                 className="px-2 py-2 border border-slate-200 rounded text-sm w-28"
               >
                 <option value="allow">Allow</option>
                 <option value="deny">Deny</option>
               </select>
               <Button size="icon" variant="ghost" onClick={() => removePageOverride(idx)} className="text-red-500 h-9 w-9 shrink-0">
                 <Trash2 className="w-4 h-4" />
               </Button>
             </div>
           ))}
         </div>
       </div>

      <div>
         <div className="flex items-center justify-between mb-2">
           <Label>Action Permissions (Optional)</Label>
           <Button size="sm" variant="outline" onClick={addActionPermission} className="h-8 gap-1">
             <Plus className="w-3 h-3" /> Add
           </Button>
         </div>
         <p className="text-xs text-slate-500 mb-2">Grant or restrict specific actions on documents</p>
         <div className="space-y-2">
           {form.action_permissions?.map((action, idx) => (
             <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end border border-slate-200 p-2 rounded-lg">
               <div>
                 <select
                   value={action.action_key}
                   onChange={e => {
                     const newActions = [...form.action_permissions];
                     newActions[idx].action_key = e.target.value;
                     setForm(f => ({ ...f, action_permissions: newActions }));
                   }}
                   className="w-full px-2 py-2 border border-slate-200 rounded text-sm"
                 >
                   <option value="">Select Action...</option>
                   {availableActions.map(a => (
                     <option key={a} value={a}>{a}</option>
                   ))}
                 </select>
               </div>
               <div>
                 <select
                   value={action.entity_type}
                   onChange={e => {
                     const newActions = [...form.action_permissions];
                     newActions[idx].entity_type = e.target.value;
                     setForm(f => ({ ...f, action_permissions: newActions }));
                   }}
                   className="w-full px-2 py-2 border border-slate-200 rounded text-sm"
                 >
                   <option value="">Select Entity...</option>
                   {allEntities.map(e => (
                     <option key={e} value={e}>{e}</option>
                   ))}
                 </select>
               </div>
               <select
                 value={action.allow ? 'allow' : 'deny'}
                 onChange={e => {
                   const newActions = [...form.action_permissions];
                   newActions[idx].allow = e.target.value === 'allow';
                   setForm(f => ({ ...f, action_permissions: newActions }));
                 }}
                 className="px-2 py-2 border border-slate-200 rounded text-sm"
               >
                 <option value="allow">Allow</option>
                 <option value="deny">Deny</option>
               </select>
               <Button size="icon" variant="ghost" onClick={() => removeActionPermission(idx)} className="text-red-500 h-9 w-9 shrink-0">
                 <Trash2 className="w-4 h-4" />
               </Button>
             </div>
           ))}
         </div>
       </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}

      <div className="flex gap-2 justify-end pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {initial ? 'Save Changes' : 'Create Policy'}
        </Button>
      </div>
    </div>
  );
}