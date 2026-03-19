/**
 * Rules Manager
 * Configure transaction validation rules
 */

import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, Trash2, Edit2, Plus, CheckCircle2 } from 'lucide-react';
import { invalidateRulesCache } from '@/lib/rulesEngine';

const MODULES = ['WAREHOUSE', 'PRODUCTION', 'LABELLING', 'GRN', 'ACCOUNTS'];
const VALIDATION_TYPES = [
  'stock_availability',
  'status_requirement',
  'approval_requirement',
  'data_consistency',
  'lock_status',
  'reference_integrity',
  'tolerance_limit',
  'custom',
];

export default function RulesManager() {
  const [user, setUser] = useState(null);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      if (currentUser?.role !== 'admin') {
        setUser(null);
        return;
      }

      setUser(currentUser);
      const data = await base44.entities.RulesConfig.list('-sort_order', 100);
      setRules(data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = rules.filter(r => {
    const matchesSearch = r.rule_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.rule_key?.toLowerCase().includes(search.toLowerCase());
    const matchesModule = !filterModule || r.module === filterModule;
    return matchesSearch && matchesModule;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h2 className="font-bold text-red-900 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Admin Access Required
        </h2>
        <p className="text-sm text-red-700 mt-2">Only administrators can manage rules.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transaction Rules</h1>
          <p className="text-sm text-slate-600 mt-1">
            Configure validation rules to prevent invalid factory operations.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingRule(null);
            setShowForm(true);
          }}
          className="bg-slate-900 hover:bg-slate-800"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search rules..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-9"
        />
        <Select value={filterModule} onValueChange={setFilterModule}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="All Modules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>All Modules</SelectItem>
            {MODULES.map(m => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Rules Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Rule Key</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Module</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Entity</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Action</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map(rule => (
                <tr key={rule.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900">{rule.rule_key}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{rule.rule_name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{rule.module}</td>
                  <td className="px-4 py-3 text-slate-600">{rule.entity_type}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{rule.action_type}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{rule.validation_type}</td>
                  <td className="px-4 py-3 text-center">
                    {rule.is_active ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        Active
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingRule(rule);
                          setShowForm(true);
                        }}
                        className="p-2 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(rule)}
                        className="p-2 hover:bg-red-50 rounded-lg text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            <p>No rules found. Create your first rule to get started.</p>
          </div>
        )}
      </div>

      {/* Form Dialog */}
      {showForm && (
        <RuleForm
          rule={editingRule}
          onSave={async (data) => {
            try {
              if (editingRule) {
                await base44.entities.RulesConfig.update(editingRule.id, data);
              } else {
                await base44.entities.RulesConfig.create(data);
              }
              invalidateRulesCache();
              await loadData();
              setShowForm(false);
            } catch (error) {
              alert('Failed to save: ' + error.message);
            }
          }}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <Dialog open onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Rule?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-600">
              Are you sure you want to delete <strong>{deleteConfirm.rule_key}</strong>?
            </p>
            <div className="flex gap-3 justify-end mt-4">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  try {
                    await base44.entities.RulesConfig.delete(deleteConfirm.id);
                    invalidateRulesCache();
                    await loadData();
                    setDeleteConfirm(null);
                  } catch (error) {
                    alert('Failed to delete: ' + error.message);
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/**
 * Rule Form Component
 */
function RuleForm({ rule, onSave, onClose }) {
  const [data, setData] = useState(
    rule || {
      rule_key: '',
      rule_name: '',
      module: '',
      entity_type: '',
      action_type: '',
      validation_type: '',
      error_message: '',
      allow_override: true,
      override_roles: [],
      reason_codes: [],
      severity: 'block',
      is_active: true,
      sort_order: 10,
      description: '',
      conditions: {},
    }
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {rule ? 'Edit Rule' : 'Create New Rule'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-700">Rule Key *</label>
              <Input
                value={data.rule_key}
                onChange={e => setData({ ...data, rule_key: e.target.value })}
                placeholder="e.g. DISPATCH_STOCK_CHECK"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Module *</label>
              <Select value={data.module} onValueChange={v => setData({ ...data, module: v })}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {MODULES.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-700">Entity Type *</label>
              <Input
                value={data.entity_type}
                onChange={e => setData({ ...data, entity_type: e.target.value })}
                placeholder="e.g. Dispatch"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Action *</label>
              <Input
                value={data.action_type}
                onChange={e => setData({ ...data, action_type: e.target.value })}
                placeholder="e.g. create, approve"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">Validation Type *</label>
              <Select value={data.validation_type} onValueChange={v => setData({ ...data, validation_type: v })}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {VALIDATION_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700">Rule Name *</label>
            <Input
              value={data.rule_name}
              onChange={e => setData({ ...data, rule_name: e.target.value })}
              placeholder="Human-readable name"
              className="h-9 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700">Error Message *</label>
            <Textarea
              value={data.error_message}
              onChange={e => setData({ ...data, error_message: e.target.value })}
              placeholder="User-friendly message shown when rule blocks action"
              className="h-20 text-sm"
            />
          </div>

          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={data.is_active}
                onChange={e => setData({ ...data, is_active: e.target.checked })}
              />
              <span className="text-slate-700">Active</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={data.allow_override}
                onChange={e => setData({ ...data, allow_override: e.target.checked })}
              />
              <span className="text-slate-700">Allow Override</span>
            </label>
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(data)} className="bg-slate-900">
            {rule ? 'Update Rule' : 'Create Rule'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}