import { useState, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Plus, Pencil, Trash2, GitMerge, ChevronDown } from 'lucide-react';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { getDocumentTypes } from '@/lib/documentTypeRegistry';
import { auditApprovalRuleCreated, auditApprovalRuleUpdated, auditApprovalRuleDeleted } from '@/lib/auditAdminActions';

const ACTION_STYLES = [
  { value: 'approve',  label: 'Approve (Green)' },
  { value: 'reject',   label: 'Reject (Red)' },
  { value: 'neutral',  label: 'Neutral (Outline)' },
];

const ACTION_STYLE_CLS = {
  approve: 'bg-green-600 hover:bg-green-700 text-white',
  reject:  'bg-red-600 hover:bg-red-700 text-white',
  neutral: 'border border-slate-300 text-slate-700',
};

const EMPTY_FORM = {
  doc_type: '', from_state: '', to_state: '', action_label: '',
  action_style: 'approve', allowed_roles: [], require_reason: false, is_active: true, sort_order: 10,
};

function RuleForm({ initial, roles, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);

  const toggleRole = (rk) => {
    setForm(f => ({
      ...f,
      allowed_roles: f.allowed_roles.includes(rk)
        ? f.allowed_roles.filter(r => r !== rk)
        : [...f.allowed_roles, rk],
    }));
  };

  const valid = form.doc_type && form.from_state && form.to_state && form.action_label && form.allowed_roles.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <Label>Document Type <span className="text-red-500">*</span></Label>
        <Select value={form.doc_type} onValueChange={v => setForm(f => ({ ...f, doc_type: v }))}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Select document type" /></SelectTrigger>
          <SelectContent>
            {DOC_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>From State <span className="text-red-500">*</span></Label>
          <Input className="mt-1 font-mono text-sm uppercase" placeholder="e.g. SUBMITTED"
            value={form.from_state}
            onChange={e => setForm(f => ({ ...f, from_state: e.target.value.toUpperCase() }))} />
        </div>
        <div>
          <Label>To State <span className="text-red-500">*</span></Label>
          <Input className="mt-1 font-mono text-sm uppercase" placeholder="e.g. APPROVED"
            value={form.to_state}
            onChange={e => setForm(f => ({ ...f, to_state: e.target.value.toUpperCase() }))} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Action Button Label <span className="text-red-500">*</span></Label>
          <Input className="mt-1" placeholder="e.g. Approve"
            value={form.action_label}
            onChange={e => setForm(f => ({ ...f, action_label: e.target.value }))} />
        </div>
        <div>
          <Label>Button Style</Label>
          <Select value={form.action_style} onValueChange={v => setForm(f => ({ ...f, action_style: v }))}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTION_STYLES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Allowed Roles <span className="text-red-500">*</span></Label>
        <p className="text-xs text-slate-400 mb-2">Who can perform this action? (Admin always can)</p>
        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
          {roles.filter(r => r.role_key !== 'admin').map(r => {
            const checked = form.allowed_roles.includes(r.role_key);
            return (
              <label key={r.role_key} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm ${
                checked ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
              }`}>
                <input type="checkbox" className="hidden" checked={checked} onChange={() => toggleRole(r.role_key)} />
                <span className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${checked ? 'bg-white border-white' : 'border-slate-300'}`}>
                  {checked && <span className="block w-2 h-2 bg-slate-900 rounded-sm" />}
                </span>
                {r.label}
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.require_reason}
            onChange={e => setForm(f => ({ ...f, require_reason: e.target.checked }))}
            className="w-4 h-4 rounded" />
          <span className="text-sm text-slate-700">Require reason / note before action</span>
        </label>
      </div>

      <div>
        <Label>Preview</Label>
        <div className="mt-1">
          <button className={`px-4 py-2 rounded-lg text-sm font-bold ${ACTION_STYLE_CLS[form.action_style] || ACTION_STYLE_CLS.neutral}`}>
            {form.action_label || 'Action Button'}
          </button>
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button disabled={saving || !valid} onClick={() => onSave(form)} className="min-h-[44px]">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (initial ? 'Save Changes' : 'Create Rule')}
        </Button>
      </div>
    </div>
  );
}

export default function ApprovalRulesManager() {
  const [user, setUser] = useState(null);
  const [rules, setRules] = useState([]);
  const [roles, setRoles] = useState([]);
  const [docTypes, setDocTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDoc, setFilterDoc] = useState('all');
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [me, rulesData, rolesData] = await Promise.all([
      base44.auth.me(),
      base44.entities.DocumentApprovalRule.list('doc_type'),
      base44.entities.AppRole.filter({ is_active: true }, 'label'),
    ]);
    setUser(me);
    setRules(rulesData);
    setRoles(rolesData);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    setSaving(true);
    if (modal.mode === 'create') {
      await base44.entities.DocumentApprovalRule.create(form);
    } else {
      await base44.entities.DocumentApprovalRule.update(modal.rule.id, form);
    }
    setSaving(false);
    setModal(null);
    load();
  };

  const handleDelete = async () => {
    setDeleting(true);
    await base44.entities.DocumentApprovalRule.delete(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    load();
  };

  if (!loading && user?.role !== 'admin') {
    return <div className="flex items-center justify-center h-64 text-slate-400">Admin access required.</div>;
  }

  const displayRules = filterDoc === 'all' ? rules : rules.filter(r => r.doc_type === filterDoc);

  // Group by doc_type for display
  const grouped = displayRules.reduce((acc, r) => {
    if (!acc[r.doc_type]) acc[r.doc_type] = [];
    acc[r.doc_type].push(r);
    return acc;
  }, {});

  const getRoleLabels = (roleKeys = []) => {
    return roleKeys.map(k => roles.find(r => r.role_key === k)?.label || k).join(', ');
  };

  const ACTION_STYLE_BADGE = {
    approve: 'bg-green-100 text-green-700',
    reject:  'bg-red-100 text-red-600',
    neutral: 'bg-slate-100 text-slate-600',
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <GitMerge className="w-6 h-6 text-slate-700" />
            <h1 className="text-2xl font-bold text-slate-900">Approval Rules</h1>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">Define who can approve, reject, or transition document states</p>
        </div>
        <Button onClick={() => setModal({ mode: 'create' })} className="gap-2 h-11 px-4">
          <Plus className="w-4 h-4" /> New Rule
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterDoc('all')}
          className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all ${filterDoc === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}>
          All
        </button>
        {DOC_TYPES.map(d => (
          <button key={d.value} onClick={() => setFilterDoc(d.value)}
            className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all ${filterDoc === d.value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}>
            {d.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <GitMerge className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="font-semibold">No approval rules yet</p>
          <p className="text-xs mt-1">Click "New Rule" to define who can approve which documents.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([docType, docRules]) => {
            const docLabel = DOC_TYPES.find(d => d.value === docType)?.label || docType;
            return (
              <div key={docType} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <h3 className="font-bold text-slate-800">{docLabel}</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {docRules.sort((a, b) => (a.sort_order || 10) - (b.sort_order || 10)).map(rule => (
                    <div key={rule.id} className="flex items-center gap-3 px-4 py-3 flex-wrap sm:flex-nowrap">
                      {/* Transition arrow */}
                      <div className="flex items-center gap-1.5 text-sm font-mono shrink-0">
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{rule.from_state}</span>
                        <span className="text-slate-400">→</span>
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{rule.to_state}</span>
                      </div>
                      {/* Action badge */}
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${ACTION_STYLE_BADGE[rule.action_style] || ACTION_STYLE_BADGE.neutral}`}>
                        {rule.action_label}
                      </span>
                      {/* Roles */}
                      <span className="text-xs text-slate-500 flex-1 min-w-0">
                        {getRoleLabels(rule.allowed_roles) || <em>No roles assigned</em>}
                      </span>
                      {rule.require_reason && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded shrink-0">Reason required</span>
                      )}
                      {!rule.is_active && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded shrink-0">Inactive</span>
                      )}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-8 w-8"
                          onClick={() => setModal({ mode: 'edit', rule })}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteTarget(rule)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <Dialog open onOpenChange={() => setModal(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{modal.mode === 'create' ? 'Create Approval Rule' : 'Edit Approval Rule'}</DialogTitle>
            </DialogHeader>
            <RuleForm initial={modal.rule} roles={roles} onSave={handleSave} onCancel={() => setModal(null)} saving={saving} />
          </DialogContent>
        </Dialog>
      )}

      {deleteTarget && (
        <Dialog open onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Delete Rule?</DialogTitle></DialogHeader>
            <p className="text-sm text-slate-600">
              Delete the <strong>{deleteTarget.action_label}</strong> rule for <strong>{deleteTarget.doc_type}</strong>?
              This will immediately affect who can perform this action.
            </p>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700 h-11 px-4" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}