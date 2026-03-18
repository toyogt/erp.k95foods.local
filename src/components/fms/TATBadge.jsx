import { getTATBadgeClass, getTimeRemaining, getTATStatus } from '@/lib/fmsHelpers';
import { Clock, AlertCircle, CheckCircle } from 'lucide-react';

export default function TATBadge({ deadline, size = 'sm' }) {
  if (!deadline) return <span className="text-slate-400 text-xs">No deadline</span>;

  const status = getTATStatus(deadline);
  const remaining = getTimeRemaining(deadline);
  const cls = getTATBadgeClass(deadline);

  const Icon = status === 'overdue' ? AlertCircle : status === 'at_risk' ? Clock : CheckCircle;
  const textSize = size === 'lg' ? 'text-sm' : 'text-xs';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${textSize} ${cls}`}>
      <Icon className="w-3 h-3" />
      {remaining}
    </span>
  );
}