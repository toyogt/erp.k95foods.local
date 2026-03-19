/**
 * Reconciliation Dashboard
 * Exception-first view of all factory mismatches
 */

import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MismatchCard from '@/components/reconciliation/MismatchCard';
import ReconciliationFilters from '@/components/reconciliation/ReconciliationFilters';
import {
  Package, AlertTriangle, AlertCircle, CheckCircle2, TrendingDown, Download,
  RefreshCw, Calendar,
} from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';

export default function ReconciliationDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState([]);
  const [filters, setFilters] = useState({
    module: null,
    severity: null,
    status: 'open',
    dateFrom: format(startOfDay(new Date()), 'yyyy-MM-dd'),
    dateTo: format(endOfDay(new Date()), 'yyyy-MM-dd'),
    search: '',
  });
  const [selectedMismatch, setSelectedMismatch] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => setUser(u)).catch(() => {});
  }, []);

  useEffect(() => {
    loadSnapshots();
  }, [filters]);

  const loadSnapshots = async () => {
    setLoading(true);
    try {
      let query = {};

      if (filters.dateFrom) {
        query.snapshot_date = { $gte: filters.dateFrom };
      }
      if (filters.dateTo) {
        query.snapshot_date = query.snapshot_date || {};
        query.snapshot_date.$lte = filters.dateTo;
      }
      if (filters.module) {
        query.module = filters.module;
      }
      if (filters.severity) {
        query.severity = filters.severity;
      }
      if (filters.status) {
        query.status = filters.status;
      }

      let results = await base44.entities.ReconciliationSnapshot.filter(
        query,
        '-created_date',
        500
      );

      // Client-side search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        results = results.filter(s =>
          s.entity_code?.toLowerCase().includes(searchLower) ||
          s.sku?.toLowerCase().includes(searchLower) ||
          s.entity_id?.toLowerCase().includes(searchLower)
        );
      }

      setSnapshots(results || []);
    } catch (error) {
      console.error('Error loading snapshots:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    // Call backend function
    base44.functions.invoke('calculateDailyReconciliation', {})
      .then(() => {
        loadSnapshots();
      })
      .catch(err => console.error('Refresh failed:', err));
  };

  // Summary stats
  const bySeverity = {
    critical: snapshots.filter(s => s.severity === 'critical').length,
    high: snapshots.filter(s => s.severity === 'high').length,
    medium: snapshots.filter(s => s.severity === 'medium').length,
    low: snapshots.filter(s => s.severity === 'low').length,
  };

  const byStatus = {
    open: snapshots.filter(s => s.status === 'open').length,
    investigating: snapshots.filter(s => s.status === 'investigating').length,
    resolved: snapshots.filter(s => s.status === 'resolved').length,
  };

  const byModule = {};
  snapshots.forEach(s => {
    byModule[s.module] = (byModule[s.module] || 0) + 1;
  });

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-slate-900">Reconciliation Dashboard</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Recalculate
          </Button>
        </div>
        <p className="text-sm text-slate-600">
          Exception-first view of production, warehouse, labelling, GRN, sync, and approval mismatches.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          icon={AlertTriangle}
          label="Critical"
          value={bySeverity.critical}
          color="red"
        />
        <SummaryCard
          icon={AlertCircle}
          label="High"
          value={bySeverity.high}
          color="orange"
        />
        <SummaryCard
          icon={TrendingDown}
          label="Total Issues"
          value={snapshots.length}
          color="slate"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Resolved"
          value={byStatus.resolved}
          color="green"
        />
      </div>

      {/* Module breakdown */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <h3 className="font-semibold text-slate-900 mb-3">By Module</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {Object.entries(byModule).map(([module, count]) => (
            <button
              key={module}
              onClick={() => setFilters({ ...filters, module: filters.module === module ? null : module })}
              className={`p-2 rounded-lg border text-sm font-medium transition-all ${
                filters.module === module
                  ? 'bg-blue-100 border-blue-300 text-blue-900'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {module}
              <span className="block text-lg font-bold mt-1">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <h3 className="font-semibold text-slate-900 mb-3">Filters</h3>
        <ReconciliationFilters filters={filters} onFilterChange={setFilters} />
      </div>

      {/* Mismatches - Tabbed by status */}
      {!loading && snapshots.length > 0 ? (
        <Tabs defaultValue="open" className="space-y-4">
          <TabsList className="bg-slate-100 p-1 h-10">
            <TabsTrigger value="open" className="text-sm">
              Open ({byStatus.open})
            </TabsTrigger>
            <TabsTrigger value="investigating" className="text-sm">
              Investigating ({byStatus.investigating})
            </TabsTrigger>
            <TabsTrigger value="resolved" className="text-sm">
              Resolved ({byStatus.resolved})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="space-y-3">
            {snapshots
              .filter(s => s.status === 'open')
              .sort((a, b) => {
                const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                return severityOrder[a.severity] - severityOrder[b.severity];
              })
              .map(mismatch => (
                <MismatchCard
                  key={mismatch.id}
                  mismatch={mismatch}
                  onDrill={() => setSelectedMismatch(mismatch)}
                />
              ))}
          </TabsContent>

          <TabsContent value="investigating" className="space-y-3">
            {snapshots
              .filter(s => s.status === 'investigating')
              .map(mismatch => (
                <MismatchCard
                  key={mismatch.id}
                  mismatch={mismatch}
                  onDrill={() => setSelectedMismatch(mismatch)}
                />
              ))}
          </TabsContent>

          <TabsContent value="resolved" className="space-y-3">
            {snapshots
              .filter(s => s.status === 'resolved')
              .map(mismatch => (
                <MismatchCard
                  key={mismatch.id}
                  mismatch={mismatch}
                  onDrill={() => setSelectedMismatch(mismatch)}
                  isDark
                />
              ))}
          </TabsContent>
        </Tabs>
      ) : loading ? (
        <div className="text-center py-12 text-slate-500">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-3"></div>
          Loading reconciliation data...
        </div>
      ) : (
        <div className="text-center py-12 text-slate-500 bg-white border border-slate-200 rounded-lg">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
          <p className="font-medium">All reconciliations clear!</p>
          <p className="text-sm">No mismatches found for the selected filters.</p>
        </div>
      )}

      {/* Detail Modal */}
      {selectedMismatch && (
        <MismatchDetailModal
          mismatch={selectedMismatch}
          onClose={() => setSelectedMismatch(null)}
          onStatusChange={(status) => {
            // Update mismatch status
            base44.entities.ReconciliationSnapshot.update(selectedMismatch.id, { status })
              .then(() => {
                loadSnapshots();
                setSelectedMismatch(null);
              });
          }}
        />
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }) {
  const colorClasses = {
    red: 'bg-red-50 border-red-200 text-red-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
  };

  return (
    <div className={`border rounded-lg p-4 ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-5 h-5" />
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function MismatchDetailModal({ mismatch, onClose, onStatusChange }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            {mismatch.entity_code} - {mismatch.reconciliation_type}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900">✕</button>
        </div>

        <div className="p-4 space-y-4">
          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-600 font-medium">Entity</p>
              <p className="text-slate-900">{mismatch.entity_type}</p>
            </div>
            <div>
              <p className="text-slate-600 font-medium">SKU</p>
              <p className="text-slate-900">{mismatch.sku || '—'}</p>
            </div>
            <div>
              <p className="text-slate-600 font-medium">Expected</p>
              <p className="font-semibold text-slate-900">{mismatch.expected_value}</p>
            </div>
            <div>
              <p className="text-slate-600 font-medium">Actual</p>
              <p className="font-semibold text-slate-900">{mismatch.actual_value}</p>
            </div>
            <div>
              <p className="text-slate-600 font-medium">Difference</p>
              <p className="font-semibold text-red-600">{mismatch.difference}</p>
            </div>
            <div>
              <p className="text-slate-600 font-medium">Variance</p>
              <p className="font-semibold">{mismatch.variance_percent}%</p>
            </div>
          </div>

          {/* Details object */}
          {mismatch.details && (
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs font-medium text-slate-600 mb-2">Details</p>
              <pre className="text-xs text-slate-700 overflow-x-auto">
                {JSON.stringify(mismatch.details, null, 2)}
              </pre>
            </div>
          )}

          {/* Root cause */}
          {mismatch.root_cause && (
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">Root Cause</p>
              <p className="text-sm text-slate-700">{mismatch.root_cause}</p>
            </div>
          )}

          {/* Status buttons */}
          <div className="flex gap-2 pt-4 border-t border-slate-200">
            <Button
              variant={mismatch.status === 'investigating' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onStatusChange('investigating')}
            >
              Mark Investigating
            </Button>
            <Button
              variant={mismatch.status === 'resolved' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onStatusChange('resolved')}
            >
              Mark Resolved
            </Button>
            <Button
              variant={mismatch.status === 'false_positive' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onStatusChange('false_positive')}
            >
              False Positive
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}