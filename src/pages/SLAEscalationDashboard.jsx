/**
 * SLA Escalation Dashboard
 * Monitoring and reporting for SLA escalations
 */

import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import ErrorBoundary from '@/components/common/ErrorBoundary';

export default function SLAEscalationDashboard() {
  const [user, setUser] = useState(null);
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('unresolved');

  useEffect(() => {
    base44.auth.me().then(u => setUser(u));
    loadEscalations();
  }, []);

  const loadEscalations = async () => {
    try {
      const data = await base44.entities.SLAEscalationLog.filter(
        filter === 'unresolved' ? { resolved_at: null } : {},
        '-created_date',
        100
      );
      setEscalations(data);
    } catch (error) {
      console.error('Error loading escalations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Stats
  const unacknowledged = escalations.filter(e => !e.acknowledged).length;
  const unresolved = escalations.filter(e => !e.resolved_at).length;
  const critical = escalations.filter(e => e.escalation_level >= 2).length;

  // Group by workflow
  const byWorkflow = {};
  escalations.forEach(e => {
    if (!byWorkflow[e.workflow_type]) {
      byWorkflow[e.workflow_type] = [];
    }
    byWorkflow[e.workflow_type].push(e);
  });

  return (
    <ErrorBoundary>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">SLA Escalation Monitor</h1>
          <p className="text-slate-600 mt-1">Track escalated items that require attention</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-600 font-medium">Total Escalations</p>
                <p className="text-4xl font-bold text-slate-900 mt-2">{escalations.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-slate-400" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-600 font-medium">Unacknowledged</p>
                <p className="text-4xl font-bold text-amber-600 mt-2">{unacknowledged}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-400" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-600 font-medium">Critical Escalations</p>
                <p className="text-4xl font-bold text-red-600 mt-2">{critical}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-red-400" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-600 font-medium">Resolved</p>
                <p className="text-4xl font-bold text-green-600 mt-2">
                  {escalations.length - unresolved}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <button
            onClick={() => { setFilter('unresolved'); loadEscalations(); }}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              filter === 'unresolved'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Unresolved Only
          </button>
          <button
            onClick={() => { setFilter('all'); loadEscalations(); }}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              filter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            All Escalations
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto" />
          </div>
        ) : escalations.length === 0 ? (
          <div className="text-center py-12 bg-white border border-slate-200 rounded-lg">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-semibold text-slate-900">No Escalations</p>
            <p className="text-slate-600 mt-1">All SLAs are on track!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(byWorkflow).map(([workflowType, items]) => (
              <div key={workflowType} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                {/* Workflow header */}
                <div className="bg-slate-100 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                  <h3 className="font-bold text-slate-900">{workflowType}</h3>
                  <span className="px-3 py-1 bg-slate-200 text-slate-700 rounded-full text-sm font-medium">
                    {items.length}
                  </span>
                </div>

                {/* Escalations list */}
                <div className="divide-y divide-slate-100">
                  {items.map(escalation => (
                    <div key={escalation.id} className="p-6 hover:bg-slate-50">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h4 className="font-bold text-slate-900">{escalation.entity_code}</h4>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              escalation.escalation_level >= 2
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              Level {escalation.escalation_level}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 mt-1">{escalation.entity_type}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold text-lg ${
                            escalation.acknowledged ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {escalation.acknowledged ? 'Acknowledged' : 'Awaiting Response'}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {escalation.hours_overdue.toFixed(1)}h overdue
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-slate-600">
                          <span>Escalated to:</span>
                          <span className="font-medium text-slate-900">
                            {escalation.escalated_to_name} ({escalation.escalated_to_role})
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Reason:</span>
                          <span className="font-medium text-slate-900">
                            {escalation.escalation_reason}
                          </span>
                        </div>
                        {escalation.acknowledged_at && (
                          <div className="flex justify-between text-green-600">
                            <span>Acknowledged:</span>
                            <span className="font-medium">
                              {new Date(escalation.acknowledged_at).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {escalation.resolved_at && (
                          <div className="flex justify-between text-green-600">
                            <span>Resolved:</span>
                            <span className="font-medium">
                              {new Date(escalation.resolved_at).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}