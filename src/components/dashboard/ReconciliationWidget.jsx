/**
 * Reconciliation Widget
 * Exception summary for home/admin dashboards
 */

import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, AlertCircle, TrendingDown, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, startOfDay, endOfDay } from 'date-fns';

export default function ReconciliationWidget() {
  const [summary, setSummary] = useState({
    critical: 0,
    high: 0,
    medium: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      const today = format(startOfDay(new Date()), 'yyyy-MM-dd');
      const snapshots = await base44.entities.ReconciliationSnapshot.filter(
        {
          snapshot_date: today,
          status: 'open',
        },
        '-created_date',
        100
      );

      if (snapshots) {
        setSummary({
          critical: snapshots.filter(s => s.severity === 'critical').length,
          high: snapshots.filter(s => s.severity === 'high').length,
          medium: snapshots.filter(s => s.severity === 'medium').length,
          total: snapshots.length,
        });
      }
    } catch (error) {
      console.error('Error loading reconciliation summary:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="h-20 flex items-center justify-center text-slate-500">
          Loading...
        </div>
      </div>
    );
  }

  const hasIssues = summary.critical > 0 || summary.high > 0;

  return (
    <Link to="/ReconciliationDashboard">
      <div className={`rounded-lg p-4 transition-all hover:shadow-md cursor-pointer border ${
        hasIssues
          ? 'bg-red-50 border-red-200'
          : 'bg-green-50 border-green-200'
      }`}>
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            {hasIssues ? <AlertTriangle className="w-5 h-5 text-red-600" /> : <AlertCircle className="w-5 h-5 text-green-600" />}
            Factory Reconciliation
          </h3>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>

        {hasIssues ? (
          <div className="space-y-2">
            {summary.critical > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-700">Critical Issues</span>
                <span className="font-bold text-red-600">{summary.critical}</span>
              </div>
            )}
            {summary.high > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-700">High Priority</span>
                <span className="font-bold text-orange-600">{summary.high}</span>
              </div>
            )}
            {summary.medium > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-700">Medium Priority</span>
                <span className="font-bold text-yellow-600">{summary.medium}</span>
              </div>
            )}
            <p className="text-xs text-slate-600 mt-3 pt-3 border-t border-red-200">
              {summary.total} mismatch{summary.total !== 1 ? 'es' : ''} require attention
            </p>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm font-medium text-green-700">All reconciliations clear</p>
            <p className="text-xs text-green-600 mt-1">No issues as of today</p>
          </div>
        )}
      </div>
    </Link>
  );
}