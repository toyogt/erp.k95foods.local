import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Check, X, Loader2, Plus, Pencil, Trash2, Info, Lock } from 'lucide-react';

export default function PermissionMatrix() {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [accessRules, setAccessRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [me, rls, rules] = await Promise.all([
      base44.auth.me(),
      base44.entities.AppRole.filter({ is_active: true }, 'label'),
      base44.entities.DocumentAccessRule.filter({ is_active: true }, '-created_date', 500),
    ]);
    setUser(me);
    setRoles(rls);
    setAccessRules(rules);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleEditRule = (rule) => {
    setEditingRule(rule ? { ...rule } : {
      doc_type: '',
      allowed_roles: [],
      workflow_stages: [],
      can_view: true,
      can_edit: false,
      can_create: false,
      can_approve: false,
      can_reject: false,
      can_delete: false,
      is_active: true,
    });
    setFormOpen(true);
  };

  const handleSaveRule = async () => {
    if (!editingRule.doc_type || !editingRule.allowed_roles?.length) {
      alert('Document type and role are required');
      return;
    }
    setSavingRule(true);
    try {
      if (editingRule.id) {
        await base44.entities.DocumentAccessRule.update(editingRule.id, editingRule);
      } else {
        await base44.entities.DocumentAccessRule.create(editingRule);
      }
      setFormOpen(false);
      setEditingRule(null);
      load();
    } finally {
      setSavingRule(false);
    }
  };

  const handleDeleteRule = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await base44.entities.DocumentAccessRule.delete(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } finally {
      setDeleting(false);
    }
  };

  if (!user) return <div className="text-center py-12 text-slate-500">Unauthorized</div>;
  if (user.role !== 'admin') return <div className="text-center py-12 text-slate-500">Admin only</div>;
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Permission Matrix</h1>
        <p className="text-sm text-slate-500">Define what each role can do with each document type</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('access')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'access'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Access Control (CRUD)
        </button>
        <button
          onClick={() => setActiveTab('approval')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'approval'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Approval Rules (Workflow)
        </button>
      </div>

      {/* Access Control Tab */}
      {activeTab === 'access' && (
        <div className="space-y-4">
          <Button onClick={() => { setEditingRule(null); setFormOpen(true); }} className="gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" /> New Rule
          </Button>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase tracking-wide sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left min-w-40">Document Type</th>
                  <th className="px-4 py-2 text-center">Role</th>
                  <th className="px-4 py-2 text-center">View</th>
                  <th className="px-4 py-2 text-center">Create</th>
                  <th className="px-4 py-2 text-center">Edit</th>
                  <th className="px-4 py-2 text-center">Delete</th>
                  <th className="px-4 py-2 text-center">Approve</th>
                  <th className="px-4 py-2 text-center">Reject</th>
                  <th className="px-4 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {accessRules.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-4 py-8 text-center text-slate-400">
                      No rules defined. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  accessRules.map(rule => (
                    <tr key={rule.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono font-semibold text-slate-900">{rule.doc_type}</td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1 justify-center">
                          {rule.allowed_roles?.map(r => (
                            <span key={r} className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-xs font-medium">
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-center">{rule.can_view ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <X className="w-4 h-4 text-slate-300 mx-auto" />}</td>
                      <td className="px-4 py-2 text-center">{rule.can_create ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <X className="w-4 h-4 text-slate-300 mx-auto" />}</td>
                      <td className="px-4 py-2 text-center">{rule.can_edit ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <X className="w-4 h-4 text-slate-300 mx-auto" />}</td>
                      <td className="px-4 py-2 text-center">—</td>
                      <td className="px-4 py-2 text-center">{rule.can_approve ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <X className="w-4 h-4 text-slate-300 mx-auto" />}</td>
                      <td className="px-4 py-2 text-center">{rule.can_reject ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <X className="w-4 h-4 text-slate-300 mx-auto" />}</td>
                      <td className="px-4 py-2 text-center flex gap-1 justify-center">
                        <button onClick={() => { setEditingRule(rule); setFormOpen(true); }} className="p-1.5 hover:bg-slate-100 rounded">
                          <Pencil className="w-3.5 h-3.5 text-slate-500" />
                        </button>
                        <button onClick={() => handleDeleteRule(rule.id)} className="p-1.5 hover:bg-red-50 rounded">
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approval Rules Tab */}
      {activeTab === 'approval' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">Approval rules define which roles can perform state transitions (e.g., SUBMITTED → APPROVED).</p>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase tracking-wide sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left min-w-40">Document Type</th>
                  <th className="px-4 py-2 text-left min-w-32">Transition</th>
                  <th className="px-4 py-2 text-left min-w-40">Action</th>
                  <th className="px-4 py-2 text-left">Roles</th>
                  <th className="px-4 py-2 text-center">Reason?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {approvalRules.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-slate-400">
                      No approval rules defined yet.
                    </td>
                  </tr>
                ) : (
                  approvalRules.map(rule => (
                    <tr key={rule.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono font-semibold text-slate-900">{rule.doc_type}</td>
                      <td className="px-4 py-2 text-xs font-mono">
                        <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">{rule.from_state}</span>
                        <span className="mx-1">→</span>
                        <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">{rule.to_state}</span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full font-medium text-xs ${
                          rule.action_style === 'approve' ? 'bg-green-100 text-green-700' :
                          rule.action_style === 'reject' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {rule.action_label}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {rule.allowed_roles?.map(r => (
                            <span key={r} className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-xs font-medium">
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-center">
                        {rule.require_reason ? <Check className="w-4 h-4 text-amber-600 mx-auto" /> : <X className="w-4 h-4 text-slate-300 mx-auto" />}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      {formOpen && editingRule && (
        <Dialog open onOpenChange={setFormOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRule.id ? 'Edit Access Rule' : 'New Access Rule'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Document Type *</Label>
                <select
                  value={editingRule.doc_type || ''}
                  onChange={e => setEditingRule({ ...editingRule, doc_type: e.target.value })}
                  className="w-full h-10 border border-slate-200 rounded-md px-3 text-sm bg-white mt-1"
                  disabled={!!editingRule.id}
                >
                  <option value="">— Select Document Type —</option>
                  {['PurchaseRequest', 'PurchaseOrder', 'GRNHeader', 'QCInspection', 'SupplierInvoice', 'PaymentRequest', 'Job', 'Batch', 'Crate', 'Pallet', 'BoxLabel'].map(dt => (
                    <option key={dt} value={dt}>{dt}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Allowed Roles * (Select all roles that get this permission)</Label>
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto p-2 border border-slate-200 rounded-lg bg-slate-50">
                  {roles.filter(r => r.role_key !== 'admin').map(role => (
                    <label key={role.id} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-white rounded transition-colors">
                      <input
                        type="checkbox"
                        checked={editingRule.allowed_roles?.includes(role.role_key) || false}
                        onChange={e => {
                          const arr = editingRule.allowed_roles || [];
                          setEditingRule({
                            ...editingRule,
                            allowed_roles: e.target.checked
                              ? [...arr, role.role_key]
                              : arr.filter(r => r !== role.role_key),
                          });
                        }}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm text-slate-700 font-medium">{role.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-200 pt-4">
                <Label className="font-semibold">Permissions</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'can_view', label: 'Can View' },
                    { key: 'can_create', label: 'Can Create' },
                    { key: 'can_edit', label: 'Can Edit' },
                    { key: 'can_delete', label: 'Can Delete' },
                    { key: 'can_approve', label: 'Can Approve' },
                    { key: 'can_reject', label: 'Can Reject' },
                  ].map(perm => (
                    <label key={perm.key} className="flex items-center gap-2 p-2 border border-slate-200 rounded cursor-pointer hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={editingRule[perm.key] || false}
                        onChange={e => setEditingRule({ ...editingRule, [perm.key]: e.target.checked })}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm text-slate-700">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setFormOpen(false); setEditingRule(null); }}>Cancel</Button>
              <Button onClick={handleSaveRule} disabled={savingRule || !editingRule.doc_type} className="min-h-[44px]">
                {savingRule ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingRule.id ? 'Save Changes' : 'Create Rule')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <Dialog open onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Rule?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-600">
              Delete access rule for <strong>{deleteTarget.doc_type}</strong>?
              Users with these roles will lose this permission.
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700 min-h-[44px]" onClick={handleDeleteRule} disabled={deleting}>
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete Rule'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}