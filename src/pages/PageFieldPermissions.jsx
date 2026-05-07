import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AccessDenied from '@/components/AccessDenied';
import PageFieldPermissionEditor from '@/components/admin/PageFieldPermissionEditor';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { PAGE_PERMISSION_REGISTRY, getPageRegistryEntry, getAllCapsForPage } from '@/lib/pageFieldPermissionsRegistry.js';
import { getLblDashboardCapabilities } from '@/lib/lblDashboardPermissions';
import { ShieldCheck, Loader2 } from 'lucide-react';

// For now only one page supports field-level perms. As more pages register,
// this function becomes a lookup: pageKey -> default caps function.
function getDefaultsForPage(pageKey, role) {
  if (pageKey === 'LblPlanningDashboard') return getLblDashboardCapabilities(role);
  return {};
}

export default function PageFieldPermissions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const [pageKey, setPageKey] = useState(Object.keys(PAGE_PERMISSION_REGISTRY)[0] || '');
  const [roleKey, setRoleKey] = useState('');
  const [edited, setEdited] = useState({}); // staged cap changes
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.auth.me()
      .then(setUser)
      .catch(() => {})
      .finally(() => setUserLoading(false));
  }, []);

  // Load all non-admin roles
  const { data: roles = [] } = useQuery({
    queryKey: ['app-roles-active'],
    queryFn: () => base44.entities.AppRole.filter({ is_active: true }),
  });

  // Current stored override (if any)
  const { data: storedRow, isLoading: storedLoading } = useQuery({
    queryKey: ['page-field-perm-row', pageKey, roleKey],
    enabled: !!pageKey && !!roleKey,
    queryFn: async () => {
      const rows = await base44.entities.PageFieldPermission.filter({ page_key: pageKey, role_key: roleKey });
      return rows?.[0] || null;
    },
  });

  // Reset staged edits when selection changes or stored row reloads
  useEffect(() => {
    setEdited(storedRow?.capabilities || {});
  }, [storedRow, pageKey, roleKey]);

  const registryEntry = getPageRegistryEntry(pageKey);
  const defaults = useMemo(
    () => (roleKey ? getDefaultsForPage(pageKey, roleKey) : {}),
    [pageKey, roleKey]
  );

  const dirty = useMemo(() => {
    const storedCaps = storedRow?.capabilities || {};
    const keys = new Set([...Object.keys(storedCaps), ...Object.keys(edited)]);
    for (const k of keys) {
      if (storedCaps[k] !== edited[k]) return true;
    }
    return false;
  }, [storedRow, edited]);

  if (userLoading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>;
  }
  if (user?.role !== 'admin') {
    return <AccessDenied page="PageFieldPermissions" />;
  }

  const handleToggle = (capKey, value) => {
    setEdited(prev => ({ ...prev, [capKey]: value }));
  };

  const handleReset = () => {
    setEdited(storedRow?.capabilities || {});
  };

  const handleSave = async () => {
    if (!pageKey || !roleKey) return;
    setSaving(true);
    try {
      // Keep only keys that are valid for this page, and drop keys that equal the default (clean storage)
      const validKeys = getAllCapsForPage(pageKey).map(c => c.key);
      const cleaned = {};
      validKeys.forEach(k => {
        if (typeof edited[k] === 'boolean' && edited[k] !== defaults[k]) {
          cleaned[k] = edited[k];
        }
      });

      if (storedRow) {
        await base44.entities.PageFieldPermission.update(storedRow.id, {
          capabilities: cleaned,
        });
      } else {
        await base44.entities.PageFieldPermission.create({
          page_key: pageKey,
          role_key: roleKey,
          capabilities: cleaned,
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['page-field-perm-row', pageKey, roleKey] });
      await queryClient.invalidateQueries({ queryKey: ['page-field-perm', pageKey, roleKey] });
      toast({ title: 'Permissions saved', description: `Updated ${pageKey} for role "${roleKey}".` });
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const selectableRoles = roles.filter(r => r.role_key !== 'admin');

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">Page Field Permissions</h1>
          <p className="text-xs md:text-sm text-slate-500">
            Grant or deny individual fields and actions on a page for each role. Overrides the built-in defaults.
          </p>
        </div>
      </div>

      {/* Selectors */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 md:p-4">
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700">Page</Label>
            <Select value={pageKey} onValueChange={(v) => { setPageKey(v); setRoleKey(''); }}>
              <SelectTrigger className="h-11 md:h-9 text-sm"><SelectValue placeholder="Select page" /></SelectTrigger>
              <SelectContent>
                {Object.entries(PAGE_PERMISSION_REGISTRY).map(([key, entry]) => (
                  <SelectItem key={key} value={key}>{entry.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700">Role</Label>
            <Select value={roleKey} onValueChange={setRoleKey}>
              <SelectTrigger className="h-11 md:h-9 text-sm"><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>
                {selectableRoles.map(r => (
                  <SelectItem key={r.role_key} value={r.role_key}>{r.label || r.role_key}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">Admin role always has full access and cannot be edited here.</p>
          </div>
        </div>
      </div>

      {/* Editor */}
      {!roleKey && (
        <div className="text-center py-12 text-slate-500 bg-white border border-slate-200 border-dashed rounded-xl">
          <p className="font-medium">Select a page and a role to begin.</p>
        </div>
      )}

      {roleKey && storedLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
        </div>
      )}

      {roleKey && !storedLoading && registryEntry && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-6">
          <PageFieldPermissionEditor
            registryEntry={registryEntry}
            defaults={defaults}
            values={edited}
            onChange={handleToggle}
            onSave={handleSave}
            onReset={handleReset}
            saving={saving}
            dirty={dirty}
          />
        </div>
      )}
    </div>
  );
}