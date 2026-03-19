import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Check, X, Loader2, Plus, Pencil, Trash2, Info } from 'lucide-react';

export default function PermissionMatrix() {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [docTypes, setDocTypes] = useState([]);
  const [accessRules, setAccessRules] = useState([]);
  const [approvalRules, setApprovalRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('access'); // 'access' or 'approval'
  const [editingRule, setEditingRule] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.role === 'admin') loadData();
    });
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [rls, rules, appRules] = await Promise.all([
      base44.entities.AppRole.filter({ is_active: true }, '-created_date', 100),
      base44.entities.DocumentAccessRule.filter({ is_active: true }, '-created_date', 500),
      base44.entities.DocumentApprovalRule.filter({ is_active: true }, '-created_date', 500),
    ]);
    setRoles(rls);
    setAccessRules(rules);
    setApprovalRules(appRules);

    // Extract unique doc types
    const docTypeSet = new Set();
    rules.forEach(r => docTypeSet.add(r.doc_type));
    appRules.forEach(r => docTypeSet.add(r.doc_type));
    setDocTypes(Array.from(docTypeSet).sort());

    setLoading(false);
  };

  const getRuleForDocTypeAndRole = (docType, roleKey) => {
    return accessRules.find(r => r.doc_type === docType && r.allowed_roles?.includes(roleKey));
  };

  const getApprovalRulesForDocType = (docType, roleKey) => {
    return approvalRules.filter(r => r.doc_type === docType && r.allowed_roles?.includes(roleKey));
  };

  const handleEditRule = (docType, roleKey) => {
    const existing = getRuleForDocTypeAndRole(docType, roleKey);
    setEditingRule(existing || {
      doc_type: docType,
      allowed_roles: [roleKey],
      workflow_stages: [],
      can_view: false,
      can_edit: false,
      can_create: false,
      can_approve: false,
      can_reject: false,
      is_active: true,
    });
    setFormOpen(true);
  };

  const handleSaveRule = async () => {
    if (!editingRule.doc_type || !editingRule.allowed_roles?.length) {
      alert('Document type and role are required');
      return;
    }

    if (editingRule.id) {
      await base44.entities.DocumentAccessRule.update(editingRule.id, editingRule);
    } else {
      await base44.entities.DocumentAccessRule.create(editingRule);
    }
    setFormOpen(false);
    loadData();
  };

  const handleDeleteRule = async (ruleId) => {
    if (!confirm('Delete this permission rule?')) return;
    await base44.entities.DocumentAccessRule.delete(ruleId);
    loadData();
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

      {/* Edit Rule Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRule?.id ? 'Edit' : 'New'} Access Rule</DialogTitle>
          </DialogHeader>
          {editingRule && (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-xs">Document Type *</Label>
                <select
                  value={editingRule.doc_type || ''}
                  onChange={e => setEditingRule({ ...editingRule, doc_type: e.target.value })}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white h-9"
                  disabled={!!editingRule.id}
                >
                  <option value="">— Select —</option>
                  {['PurchaseRequest', 'PurchaseOrder', 'GRNHeader', 'QCInspection', 'SupplierInvoice', 'PaymentRequest', 'Job', 'Batch', 'Crate', 'Pallet', 'BoxLabelPrintLog'].map(dt => (
                    <option key={dt} value={dt}>{dt}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs">Allowed Roles *</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {roles.map(role => (
                    <label key={role.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer">
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
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-slate-700">{role.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 p-2 border border-slate-200 rounded cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={editingRule.can_view || false}
                    onChange={e => setEditingRule({ ...editingRule, can_view: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-700">Can View</span>
                </label>
                <label className="flex items-center gap-2 p-2 border border-slate-200 rounded cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={editingRule.can_create || false}
                    onChange={e => setEditingRule({ ...editingRule, can_create: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-700">Can Create</span>
                </label>
                <label className="flex items-center gap-2 p-2 border border-slate-200 rounded cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={editingRule.can_edit || false}
                    onChange={e => setEditingRule({ ...editingRule, can_edit: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-700">Can Edit</span>
                </label>
                <label className="flex items-center gap-2 p-2 border border-slate-200 rounded cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={editingRule.can_approve || false}
                    onChange={e => setEditingRule({ ...editingRule, can_approve: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-700">Can Approve</span>
                </label>
                <label className="flex items-center gap-2 p-2 border border-slate-200 rounded cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={editingRule.can_reject || false}
                    onChange={e => setEditingRule({ ...editingRule, can_reject: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-700">Can Reject</span>
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRule}>Save Rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}