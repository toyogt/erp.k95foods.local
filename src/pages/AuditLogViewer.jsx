import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getEntityAuditTrail, searchAuditLogs } from '@/lib/auditLogEngine';
import { format } from 'date-fns';
import { Search, Filter, Download, ChevronDown, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export default function AuditLogViewer() {
  const [user, setUser] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchMode, setSearchMode] = useState('global'); // global | entity

  // Global search filters
  const [filters, setFilters] = useState({
    module: '',
    actionType: '',
    criticality: '',
    fromDate: '',
    toDate: '',
    actor: '',
  });

  // Entity search
  const [entitySearch, setEntitySearch] = useState({
    entityType: '',
    entityId: '',
  });

  const [expandedLog, setExpandedLog] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.auth.me(),
      loadLogs(),
    ]).then(([u]) => {
      setUser(u);
      if (u?.role !== 'admin') {
        alert('Admin access required');
        base44.auth.logout();
      }
    });
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      if (searchMode === 'entity' && entitySearch.entityId) {
        const trail = await getEntityAuditTrail(entitySearch.entityType, entitySearch.entityId);
        setLogs(trail);
      } else {
        const results = await searchAuditLogs({
          module: filters.module || undefined,
          actionType: filters.actionType || undefined,
          criticality: filters.criticality || undefined,
          fromDate: filters.fromDate ? new Date(filters.fromDate) : undefined,
          toDate: filters.toDate ? new Date(filters.toDate) : undefined,
          actor: filters.actor || undefined,
          limit: 500,
        });
        setLogs(results);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadLogs();
  };

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'Module', 'Action', 'Entity', 'Entity Code', 'Actor', 'Role', 'Reason Code', 'Criticality'],
      ...logs.map(log => [
        format(new Date(log.created_date), 'yyyy-MM-dd HH:mm:ss'),
        log.module,
        log.action_type,
        log.entity_type,
        log.entity_code,
        log.actor_name,
        log.actor_role,
        log.reason_code,
        log.criticality,
      ]),
    ]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const criticalityIcon = (criticality) => {
    switch (criticality) {
      case 'critical':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-amber-600" />;
      case 'info':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Audit Log Viewer</h1>
          <p className="text-slate-500 mt-1">Search and analyze all system actions for compliance and root-cause analysis</p>
        </div>

        {/* Search tabs */}
        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setSearchMode('global')}
            className={`px-4 py-2.5 font-medium text-sm transition-colors ${
              searchMode === 'global'
                ? 'border-b-2 border-slate-900 text-slate-900'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Global Search
          </button>
          <button
            onClick={() => setSearchMode('entity')}
            className={`px-4 py-2.5 font-medium text-sm transition-colors ${
              searchMode === 'entity'
                ? 'border-b-2 border-slate-900 text-slate-900'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Entity Audit Trail
          </button>
        </div>

        {/* Filters */}
        <Card className="p-4 md:p-6">
          {searchMode === 'global' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Module</label>
                  <Input
                    placeholder="WAREHOUSE, PRODUCTION, QC..."
                    value={filters.module}
                    onChange={(e) => setFilters({ ...filters, module: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Action Type</label>
                  <select
                    value={filters.actionType}
                    onChange={(e) => setFilters({ ...filters, actionType: e.target.value })}
                    className="w-full h-9 border border-slate-200 rounded-md px-3 text-sm bg-white"
                  >
                    <option value="">All Actions</option>
                    <option value="create">Create</option>
                    <option value="update">Update</option>
                    <option value="delete">Delete</option>
                    <option value="approve">Approve</option>
                    <option value="reject">Reject</option>
                    <option value="adjustment">Adjustment</option>
                    <option value="override">Override</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Criticality</label>
                  <select
                    value={filters.criticality}
                    onChange={(e) => setFilters({ ...filters, criticality: e.target.value })}
                    className="w-full h-9 border border-slate-200 rounded-md px-3 text-sm bg-white"
                  >
                    <option value="">All Levels</option>
                    <option value="critical">Critical</option>
                    <option value="warning">Warning</option>
                    <option value="info">Info</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Actor</label>
                  <Input
                    placeholder="User email..."
                    type="email"
                    value={filters.actor}
                    onChange={(e) => setFilters({ ...filters, actor: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">From Date</label>
                  <Input
                    type="date"
                    value={filters.fromDate}
                    onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">To Date</label>
                  <Input
                    type="date"
                    value={filters.toDate}
                    onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setFilters({ module: '', actionType: '', criticality: '', fromDate: '', toDate: '', actor: '' })}
                  className="h-11 text-base"
                >
                  Clear
                </Button>
                <Button
                  onClick={handleSearch}
                  disabled={loading}
                  className="h-11 text-base"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Entity Type</label>
                  <Input
                    placeholder="Batch, Pallet, Dispatch..."
                    value={entitySearch.entityType}
                    onChange={(e) => setEntitySearch({ ...entitySearch, entityType: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Entity ID</label>
                  <Input
                    placeholder="Entity ID or code..."
                    value={entitySearch.entityId}
                    onChange={(e) => setEntitySearch({ ...entitySearch, entityId: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setEntitySearch({ entityType: '', entityId: '' })}
                  className="h-11 text-base"
                >
                  Clear
                </Button>
                <Button
                  onClick={handleSearch}
                  disabled={loading || !entitySearch.entityId}
                  className="h-11 text-base"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Trace Entity
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Results */}
        <div className="flex justify-between items-center">
          <p className="text-sm text-slate-600">{logs.length} entries found</p>
          {logs.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="h-11 text-base"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          )}
        </div>

        {/* Log entries */}
        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <Card className="p-8 text-center text-slate-500">
              No audit logs found for the selected criteria.
            </Card>
          ) : (
            logs.map((log) => (
              <Card
                key={log.id}
                className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-3">
                      {criticalityIcon(log.criticality)}
                      <span className="font-medium text-slate-900">{log.action}</span>
                      <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">
                        {log.entity_code || log.entity_id}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <span className="font-medium text-slate-700">{log.actor_name}</span>
                        <span className="text-slate-400"> ({log.actor_role})</span>
                      </div>
                      <div>{format(new Date(log.created_date), 'MMM dd, yyyy HH:mm')}</div>
                      <div className="text-slate-600">{log.module}</div>
                      {log.reason_code && <div className="font-mono text-slate-600">{log.reason_code}</div>}
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 transition-transform ${
                      expandedLog === log.id ? 'rotate-180' : ''
                    }`}
                  />
                </div>

                {/* Expanded details */}
                {expandedLog === log.id && (
                  <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                    {log.reason_text && (
                      <div>
                        <p className="text-xs font-medium text-slate-700 mb-1">Reason/Note</p>
                        <p className="text-sm text-slate-600 bg-slate-50 p-2 rounded">{log.reason_text}</p>
                      </div>
                    )}
                    {log.before_state && Object.keys(log.before_state).length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-700 mb-1">Before</p>
                        <pre className="text-xs bg-slate-50 p-2 rounded overflow-auto max-h-32">
                          {JSON.stringify(log.before_state, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.after_state && Object.keys(log.after_state).length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-700 mb-1">After</p>
                        <pre className="text-xs bg-slate-50 p-2 rounded overflow-auto max-h-32">
                          {JSON.stringify(log.after_state, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                      {log.device_id && (
                        <div>
                          <p className="font-medium text-slate-700">Device</p>
                          <p className="text-slate-600">{log.device_id}</p>
                        </div>
                      )}
                      {log.transaction_id && (
                        <div>
                          <p className="font-medium text-slate-700">Transaction ID</p>
                          <p className="text-slate-600 font-mono text-xs">{log.transaction_id.substring(0, 20)}...</p>
                        </div>
                      )}
                      {log.is_offline && (
                        <div>
                          <p className="font-medium text-slate-700">Sync Status</p>
                          <p className="text-amber-600">Offline → {log.synced_at ? 'Synced' : 'Queued'}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}