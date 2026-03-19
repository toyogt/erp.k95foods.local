/**
 * Mismatch Card
 * Displays single reconciliation exception
 */

import { AlertTriangle, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const SEVERITY_CONFIG = {
  critical: { icon: AlertTriangle, color: 'bg-red-100 border-red-300', text: 'text-red-700', badge: 'bg-red-50 text-red-700' },
  high: { icon: AlertCircle, color: 'bg-orange-100 border-orange-300', text: 'text-orange-700', badge: 'bg-orange-50 text-orange-700' },
  medium: { icon: AlertCircle, color: 'bg-yellow-100 border-yellow-300', text: 'text-yellow-700', badge: 'bg-yellow-50 text-yellow-700' },
  low: { icon: AlertCircle, color: 'bg-blue-100 border-blue-300', text: 'text-blue-700', badge: 'bg-blue-50 text-blue-700' },
};

const STATUS_CONFIG = {
  open: { icon: AlertCircle, label: 'Open', color: 'text-red-600' },
  investigating: { icon: Clock, label: 'Investigating', color: 'text-yellow-600' },
  resolved: { icon: CheckCircle2, label: 'Resolved', color: 'text-green-600' },
  false_positive: { icon: CheckCircle2, label: 'False Positive', color: 'text-slate-600' },
};

export default function MismatchCard({ mismatch, onDrill, isDark = false }) {
  const severityConfig = SEVERITY_CONFIG[mismatch.severity] || SEVERITY_CONFIG.low;
  const SeverityIcon = severityConfig.icon;
  const StatusIcon = STATUS_CONFIG[mismatch.status]?.icon || AlertCircle;

  const variance = parseFloat(mismatch.variance_percent) || 0;
  const isNegativeDiff = mismatch.difference < 0;

  return (
    <div
      onClick={onDrill}
      className={`border-l-4 p-4 rounded-lg cursor-pointer transition-all hover:shadow-md ${
        severityConfig.color
      } ${isDark ? 'bg-opacity-80' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <SeverityIcon className={`w-5 h-5 shrink-0 ${severityConfig.text}`} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h4 className="font-semibold text-slate-900">
                {formatReconciliationType(mismatch.reconciliation_type)}
              </h4>
              <p className="text-xs text-slate-600 mt-1">
                {mismatch.entity_code} • {mismatch.sku || mismatch.entity_type}
              </p>
            </div>

            <div className="flex gap-2">
              <Badge className={`${severityConfig.badge} whitespace-nowrap`}>
                {mismatch.severity.toUpperCase()}
              </Badge>
              <Badge variant="outline" className="whitespace-nowrap flex items-center gap-1">
                <StatusIcon className="w-3 h-3" />
                {STATUS_CONFIG[mismatch.status]?.label}
              </Badge>
            </div>
          </div>

          {/* Values */}
          <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
            <div className="bg-white bg-opacity-60 p-2 rounded">
              <p className="text-xs text-slate-600 font-medium">Expected</p>
              <p className="font-semibold text-slate-900">
                {formatNumber(mismatch.expected_value)}
              </p>
            </div>

            <div className="bg-white bg-opacity-60 p-2 rounded">
              <p className="text-xs text-slate-600 font-medium">Actual</p>
              <p className="font-semibold text-slate-900">
                {formatNumber(mismatch.actual_value)}
              </p>
            </div>

            <div className={`p-2 rounded ${isNegativeDiff ? 'bg-green-200 bg-opacity-40' : 'bg-red-200 bg-opacity-40'}`}>
              <p className="text-xs text-slate-600 font-medium">Difference</p>
              <p className={`font-semibold ${isNegativeDiff ? 'text-green-700' : 'text-red-700'}`}>
                {formatNumber(mismatch.difference)}
              </p>
            </div>
          </div>

          {/* Variance */}
          <div className="flex items-center justify-between text-xs">
            <p className="text-slate-600">
              Variance: <span className="font-semibold">{variance.toFixed(1)}%</span>
            </p>
            {mismatch.assigned_to_name && (
              <p className="text-slate-600">
                Assigned to: <span className="font-semibold">{mismatch.assigned_to_name}</span>
              </p>
            )}
          </div>

          {/* Notes */}
          {mismatch.root_cause && (
            <div className="mt-3 p-2 bg-white bg-opacity-50 rounded text-xs">
              <p className="text-slate-700"><span className="font-medium">Cause:</span> {mismatch.root_cause}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatReconciliationType(type) {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function formatNumber(value) {
  return typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value;
}