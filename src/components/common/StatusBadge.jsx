/**
 * Status Badge
 * Color-coded status indicator
 */

import { Badge } from '@/components/ui/badge';

const STATUS_COLORS = {
  draft: 'bg-slate-100 text-slate-700',
  pending: 'bg-yellow-100 text-yellow-700',
  sent: 'bg-blue-100 text-blue-700',
  received: 'bg-green-100 text-green-700',
  completed: 'bg-green-100 text-green-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-700',
  on_hold: 'bg-orange-100 text-orange-700',
  processing: 'bg-blue-100 text-blue-700',
};

export default function StatusBadge({ status, label = null, className = '' }) {
  const statusKey = status?.toLowerCase();
  const colorClass = STATUS_COLORS[statusKey] || STATUS_COLORS.draft;
  const displayLabel = label || status;

  return (
    <Badge className={`${colorClass} ${className}`}>
      {displayLabel}
    </Badge>
  );
}