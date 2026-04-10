import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { DOC_ACTIONS, DOC_TYPES } from '@/lib/docTypePermissionHelper';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Save, ShieldCheck } from 'lucide-react';

export default function DocTypePermissionMatrix() {
  const queryClient = useQueryClient();
  const [selectedDocType, setSelectedDocType] = useState(DOC_TYPES[0].key);
  const [localPermissions, setLocalPermissions] = useState({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['app-roles-active'],
    queryFn: () => base44.entities.AppRole.filter({ is_active: true }),
  });

  const { data: permissions = [], isLoading: permsLoading } = useQuery({
    queryKey: ['doc-type-permissions'],
    queryFn: () => base44.entities.DocTypePermission.list('-created_date', 500),
  });

  // Build local state from DB permissions when data changes or doc type switches
  useEffect(() => {
    const map = {};
    const docPerms = permissions.filter(p => p.doc_type === selectedDocType);
    for (const p of docPerms) {
      map[p.role_key] = {
        id: p.id,
        allowed_actions: p.allowed_actions || [],
      };
    }
    setLocalPermissions(map);
    setDirty(false);
  }, [permissions, selectedDocType]);

  const toggleAction = (roleKey, actionKey) => {
    setLocalPermissions(prev => {
      const existing = prev[roleKey] || { allowed_actions: [] };
      const actions = existing.allowed_actions.includes(actionKey)
        ? existing.allowed_actions.filter(a => a !== actionKey)
        : [...existing.allowed_actions, actionKey];
      return { ...prev, [roleKey]: { ...existing, allowed_actions: actions } };
    });
    setDirty(true);
  };

  const toggleAllForRole = (roleKey, enable) => {
    setLocalPermissions(prev => ({
      ...prev,
      [roleKey]: {
        ...(prev[roleKey] || {}),
        allowed_actions: enable ? DOC_ACTIONS.map(a => a.key) : [],
      },
    }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const docTypeObj = DOC_TYPES.find(d => d.key === selectedDocType);

    for (const role of roles) {
      const local = localPermissions[role.role_key];
      const actions = local?.allowed_actions || [];
      const existingId = local?.id;

      if (existingId) {
        await base44.entities.DocTypePermission.update(existingId, { allowed_actions: actions });
      } else if (actions.length > 0) {
        await base44.entities.DocTypePermission.create({
          doc_type: selectedDocType,
          doc_type_label: docTypeObj?.label || selectedDocType,
          role_key: role.role_key,
          role_label: role.label,
          allowed_actions: actions,
          is_active: true,
        });
      }
    }

    queryClient.invalidateQueries({ queryKey: ['doc-type-permissions'] });
    toast({ title: 'Permissions Saved', description: `Updated permissions for ${docTypeObj?.label}` });
    setDirty(false);
    setSaving(false);
  };

  const isLoading = rolesLoading || permsLoading;
  const nonAdminRoles = roles.filter(r => r.role_key !== 'admin');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Document Type Selector */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
        <div className="space-y-1 flex-1">
          <label className="text-xs font-medium text-slate-700">Document Type</label>
          <Select value={selectedDocType} onValueChange={setSelectedDocType}>
            <SelectTrigger className="h-11 md:h-9 w-full md:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map(dt => (
                <SelectItem key={dt.key} value={dt.key}>{dt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="h-11 md:h-9 gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Permissions
        </Button>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
        <ShieldCheck className="w-4 h-4 inline mr-1.5" />
        Admin role has all permissions by default and is not shown below.
      </div>

      {nonAdminRoles.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">
          No roles configured. Add roles in Role Manager first.
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left px-3 py-2.5 font-semibold text-slate-700 sticky left-0 bg-slate-100 min-w-[140px]">Role</th>
                {DOC_ACTIONS.map(action => (
                  <th key={action.key} className="text-center px-2 py-2.5 font-medium text-slate-600 min-w-[70px]">
                    <span className="text-xs">{action.label}</span>
                  </th>
                ))}
                <th className="text-center px-2 py-2.5 font-medium text-slate-600 min-w-[70px]">
                  <span className="text-xs">All</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {nonAdminRoles.map(role => {
                const local = localPermissions[role.role_key] || { allowed_actions: [] };
                const allEnabled = DOC_ACTIONS.every(a => local.allowed_actions.includes(a.key));

                return (
                  <tr key={role.role_key} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-medium text-slate-900 sticky left-0 bg-white">
                      <div>
                        <div className="text-sm">{role.label}</div>
                        <div className="text-xs text-slate-400">{role.role_key}</div>
                      </div>
                    </td>
                    {DOC_ACTIONS.map(action => (
                      <td key={action.key} className="text-center px-2 py-2.5">
                        <Switch
                          checked={local.allowed_actions.includes(action.key)}
                          onCheckedChange={() => toggleAction(role.role_key, action.key)}
                          className="scale-75"
                        />
                      </td>
                    ))}
                    <td className="text-center px-2 py-2.5">
                      <Switch
                        checked={allEnabled}
                        onCheckedChange={(checked) => toggleAllForRole(role.role_key, checked)}
                        className="scale-75"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}