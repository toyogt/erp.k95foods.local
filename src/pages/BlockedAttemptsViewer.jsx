/**
 * Blocked Attempts Viewer
 * Monitor and analyze prevented transactions
 */

import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, ChevronDown, Check, Lock } from 'lucide-react';
import { format } from 'date-fns';

export default function BlockedAttemptsViewer() {
  const [user, setUser] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('blocked');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const data = await base44.entities.BlockedAttempt.filter(
        { block_status: filterStatus },
        '-created_date',
        100
      );
      setAttempts(data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [filterStatus]);

  const filtered = attempts.filter(a => {
    const matchesSearch = a.rule_key?.toLowerCase().includes(search.toLowerCase()) ||
      a.entity_id?.toLowerCase().includes(search.toLowerCase()) ||
      a.user_email?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  const stats = {
    blocked: attempts.filter(a => a.block_status === 'blocked').length,
    overridden: attempts.filter(a => a.block_status === 'overridden').length,
    escalated: attempts.filter(a => a.block_status === 'escalated').length,
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Blocked Transaction Attempts</h1>
        <p className="text-sm text-slate-600 mt-1">
          Review prevented invalid operations and supervisor overrides.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Blocked', value: stats.blocked, color: 'bg-red-50 border-red-200' },
          { label: 'Overridden', value: stats.overridden, color: 'bg-blue-50 border-blue-200' },
          { label: 'Escalated', value: stats.escalated, color: 'bg-yellow-50 border-yellow-200' },
        ].map(stat => (
          <div key={stat.label} className={`p-4 rounded-lg border ${stat.color}`}>
            <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
            <p className="text-xs text-slate-600 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search by rule, entity, or user..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-9"
        />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="overridden">Overridden</SelectItem>
            <SelectItem value="escalated">Escalated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.map(attempt => (
          <div
            key={attempt.id}
            className="border border-slate-200 rounded-lg bg-white hover:shadow-sm transition-shadow"
          >
            {/* Summary */}
            <button
              onClick={() => setExpandedId(expandedId === attempt.id ? null : attempt.id)}
              className="w-full p-4 flex items-start gap-3 hover:bg-slate-50 transition-colors text-left"
            >
              <div className="mt-0.5">
                {attempt.block_status === 'blocked' && (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
                {attempt.block_status === 'overridden' && (
                  <Check className="w-5 h-5 text-blue-600" />
                )}
                {attempt.block_status === 'escalated' && (
                  <Lock className="w-5 h-5 text-yellow-600" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{attempt.rule_key}</h3>
                    <p className="text-sm text-slate-600 mt-1">{attempt.error_message}</p>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${
                      expandedId === attempt.id ? 'rotate-180' : ''
                    }`}
                  />
                </div>

                <div className="flex flex-wrap gap-3 mt-3 text-xs">
                  <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">
                    {attempt.entity_type}
                  </span>
                  <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">
                    {attempt.action_type}
                  </span>
                  <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">
                    {attempt.module}
                  </span>
                  <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">
                    {format(new Date(attempt.created_date), 'MMM d, HH:mm')}
                  </span>
                </div>
              </div>
            </button>

            {/* Details */}
            {expandedId === attempt.id && (
              <div className="border-t border-slate-200 p-4 bg-slate-50 space-y-4">
                {/* Basic info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs font-medium text-slate-700">Attempted By</p>
                    <p className="text-slate-900 mt-1">{attempt.user_name}</p>
                    <p className="text-xs text-slate-600">{attempt.user_email}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-700">Entity ID</p>
                    <p className="text-slate-900 mt-1 font-mono text-xs">
                      {attempt.entity_id || '(not set)'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-700">Device</p>
                    <p className="text-slate-900 mt-1 font-mono text-xs">{attempt.device_id}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-700">Status</p>
                    <p className="text-slate-900 mt-1 capitalize">
                      {attempt.block_status.replace('_', ' ')}
                    </p>
                  </div>
                </div>

                {/* Override details */}
                {attempt.block_status === 'overridden' && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <p className="text-xs font-medium text-blue-900">Override Details</p>
                    <div className="text-sm text-slate-700 mt-2 space-y-1">
                      <p>
                        <span className="font-medium">Approved by:</span> {attempt.override_by}
                      </p>
                      <p>
                        <span className="font-medium">Reason:</span> {attempt.override_reason_code}
                      </p>
                      {attempt.override_comment && (
                        <p>
                          <span className="font-medium">Comment:</span> {attempt.override_comment}
                        </p>
                      )}
                      <p className="text-xs text-slate-500">
                        {format(new Date(attempt.override_at), 'MMM d, HH:mm')}
                      </p>
                    </div>
                  </div>
                )}

                {/* Validation details */}
                {attempt.validation_details && (
                  <details className="border border-slate-300 rounded p-3">
                    <summary className="cursor-pointer font-medium text-slate-700">
                      Technical Details
                    </summary>
                    <pre className="mt-2 text-xs bg-white p-2 rounded overflow-auto max-h-48 text-slate-600">
                      {JSON.stringify(attempt.validation_details, null, 2)}
                    </pre>
                  </details>
                )}

                {/* Payload */}
                {attempt.payload && (
                  <details className="border border-slate-300 rounded p-3">
                    <summary className="cursor-pointer font-medium text-slate-700">
                      Attempted Payload
                    </summary>
                    <pre className="mt-2 text-xs bg-white p-2 rounded overflow-auto max-h-48 text-slate-600">
                      {JSON.stringify(attempt.payload, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <AlertCircle className="w-8 h-8 mx-auto mb-3 text-slate-400" />
          <p>No blocked attempts found.</p>
        </div>
      )}
    </div>
  );
}