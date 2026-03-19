/**
 * Permission Policy Manager
 * Central admin UI for managing all permissions
 * Replaces scattered permission config pages
 */

import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Shield, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PermissionPolicyForm from '@/components/admin/PermissionPolicyForm';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { clearPermissionCache } from '@/lib/permissionResolver';
import { auditPermissionPolicyCreated, auditPermissionPolicyUpdated, auditPermissionPolicyDeleted } from '@/lib/auditAdminActions';

export default function PermissionPolicyManager() {
  const [user, setUser] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [me, policiesData, rolesData] = await Promise.all([
      base44.auth.me(),
      base44.entities.PermissionPolicy.list('role_key'),
      base44.entities.AppRole.filter({ is_active: true }, 'label'),
    ]);
    setUser(me);
    setPolicies(policiesData);
    setRoles(rolesData);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (policyData) => {
    setSaving(true);
    try {
      if (modal.mode === 'create') {
        await base44.entities.PermissionPolicy.create(policyData);
        await auditPermissionPolicyCreated(user, policyData.role_key, policyData.module_access);
      } else {
        await base44.entities.PermissionPolicy.update(modal.policy.id, policyData);
        await auditPermissionPolicyUpdated(user, policyData.role_key, { modules: policyData.module_access });
      }
      clearPermissionCache(policyData.role_key);
      setModal(null);
      load();
    } catch (e) {
      console.error('Error saving policy:', e);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await base44.entities.PermissionPolicy.delete(deleteTarget.id);
      await auditPermissionPolicyDeleted(user, deleteTarget.role_key);
      clearPermissionCache(deleteTarget.role_key);
      setDeleteTarget(null);
      load();
    } catch (e) {
      console.error('Error deleting policy:', e);
    }
    setDeleting(false);
  };

  if (!loading && user?.role !== 'admin') {
    return <div className="flex items-center justify-center h-64 text-slate-400">Admin access required.</div>;
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  const assignedRoles = new Set(policies.map(p => p.role_key));
  const unassignedRoles = roles.filter(r => !assignedRoles.has(r.role_key));

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-slate-700" />
          <h1 className="text-2xl font-bold text-slate-900">Permission Policies</h1>
        </div>
        {unassignedRoles.length > 0 && (
          <Button onClick={() => setModal({ mode: 'create' })} className="gap-2">
            <Plus className="w-4 h-4" /> New Policy
          </Button>
        )}
      </div>

      <p className="text-slate-600">Unified access control: modules → pages → actions → approvals</p>

      {policies.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Shield className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>No policies configured yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {policies.map(policy => (
            <div key={policy.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{policy.role_key}</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {policy.module_access?.length > 0 && (
                      <div className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                        {policy.module_access.length} modules
                      </div>
                    )}
                    {policy.page_overrides?.length > 0 && (
                      <div className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded">
                        {policy.page_overrides.length} page overrides
                      </div>
                    )}
                    {policy.action_permissions?.length > 0 && (
                      <div className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded">
                        {policy.action_permissions.length} actions
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setModal({ mode: 'edit', policy })}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  {!policy.is_system && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(policy)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Dialog open onOpenChange={() => setModal(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {modal.mode === 'create' ? 'Create Permission Policy' : `Edit Policy: ${modal.policy.role_key}`}
              </DialogTitle>
            </DialogHeader>
            <PermissionPolicyForm
              initial={modal.policy}
              availableRoles={unassignedRoles}
              onSave={handleSave}
              onCancel={() => setModal(null)}
              saving={saving}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}