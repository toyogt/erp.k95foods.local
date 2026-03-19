/**
 * SLA Configuration Manager
 * Admin page to configure SLA targets and escalation paths
 */

import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import ErrorBoundary from '@/components/common/ErrorBoundary';

export default function SLAConfigManager() {
  const [user, setUser] = useState(null);
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(getInitialFormData());

  useEffect(() => {
    base44.auth.me().then(u => setUser(u));
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const data = await base44.entities.SLAConfig.filter({}, '-workflow_type', 50);
      setConfigs(data);
    } catch (error) {
      console.error('Error loading SLA configs:', error);
    } finally {
      setLoading(false);
    }
  };

  function getInitialFormData() {
    return {
      workflow_type: '',
      workflow_label: '',
      normal_sla_hours: 24,
      urgent_sla_hours: 4,
      critical_sla_hours: 1,
      warning_threshold_percent: 75,
      overdue_threshold_percent: 150,
      escalation_interval_hours: 4,
      allow_exception_justification: true,
      is_active: true,
      description: '',
      escalation_chain: [],
    };
  }

  const handleSave = async () => {
    try {
      if (editingId) {
        await base44.entities.SLAConfig.update(editingId, formData);
      } else {
        await base44.entities.SLAConfig.create(formData);
      }
      loadConfigs();
      setShowForm(false);
      setEditingId(null);
      setFormData(getInitialFormData());
    } catch (error) {
      alert('Error saving SLA config: ' + error.message);
    }
  };

  const handleEdit = (config) => {
    setFormData(config);
    setEditingId(config.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this SLA configuration?')) return;
    try {
      await base44.entities.SLAConfig.delete(id);
      loadConfigs();
    } catch (error) {
      alert('Error deleting: ' + error.message);
    }
  };

  const workflows = [
    'purchase_approval',
    'label_approval',
    'grn_qc_pending',
    'dispatch_readiness',
    'transfer_receipt_pending',
    'maintenance_issue',
    'sync_conflict',
    'quality_hold',
  ];

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <ErrorBoundary>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">SLA Configuration</h1>
            <p className="text-slate-600 mt-1">Define SLA targets and escalation paths</p>
          </div>
          <Button onClick={() => { setShowForm(true); setEditingId(null); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add SLA Config
          </Button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <h2 className="font-bold text-lg">
              {editingId ? 'Edit SLA Configuration' : 'New SLA Configuration'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Workflow Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Workflow Type
                </label>
                <select
                  value={formData.workflow_type}
                  onChange={(e) => setFormData({ ...formData, workflow_type: e.target.value })}
                  className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm"
                >
                  <option value="">Select workflow...</option>
                  {workflows.map(w => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>

              {/* Label */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Display Label
                </label>
                <input
                  type="text"
                  value={formData.workflow_label}
                  onChange={(e) => setFormData({ ...formData, workflow_label: e.target.value })}
                  placeholder="e.g. Purchase Order Approval"
                  className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm"
                />
              </div>

              {/* Normal SLA */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Normal SLA (hours)
                </label>
                <input
                  type="number"
                  value={formData.normal_sla_hours}
                  onChange={(e) => setFormData({ ...formData, normal_sla_hours: Number(e.target.value) })}
                  className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm"
                />
              </div>

              {/* Urgent SLA */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Urgent SLA (hours)
                </label>
                <input
                  type="number"
                  value={formData.urgent_sla_hours}
                  onChange={(e) => setFormData({ ...formData, urgent_sla_hours: Number(e.target.value) })}
                  className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm"
                />
              </div>

              {/* Warning Threshold */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Warning Threshold (% of SLA)
                </label>
                <input
                  type="number"
                  value={formData.warning_threshold_percent}
                  onChange={(e) => setFormData({ ...formData, warning_threshold_percent: Number(e.target.value) })}
                  min={0}
                  max={100}
                  className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm"
                />
              </div>

              {/* Escalation Interval */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Escalation Every (hours)
                </label>
                <input
                  type="number"
                  value={formData.escalation_interval_hours}
                  onChange={(e) => setFormData({ ...formData, escalation_interval_hours: Number(e.target.value) })}
                  className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Explain why this SLA exists..."
                className="w-full h-20 border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => { setShowForm(false); setEditingId(null); }}
              >
                Cancel
              </Button>
              <Button onClick={handleSave}>
                {editingId ? 'Update Configuration' : 'Create Configuration'}
              </Button>
            </div>
          </div>
        )}

        {/* List */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-100 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-700">Workflow</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-700">Normal SLA</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-700">Urgent SLA</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-700">Escalation</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-700">Status</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {configs.map(config => (
                <tr key={config.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-900">{config.workflow_label}</p>
                    <p className="text-xs text-slate-500">{config.workflow_type}</p>
                  </td>
                  <td className="px-6 py-4 text-sm">{config.normal_sla_hours}h</td>
                  <td className="px-6 py-4 text-sm">{config.urgent_sla_hours}h</td>
                  <td className="px-6 py-4 text-sm">Every {config.escalation_interval_hours}h</td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      config.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {config.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                    <button
                      onClick={() => handleEdit(config)}
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-slate-600" />
                    </button>
                    <button
                      onClick={() => handleDelete(config.id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ErrorBoundary>
  );
}