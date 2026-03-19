/**
 * Sync Status Badge
 * Shows offline sync status on business records
 */

import { Cloud, CloudOff, AlertTriangle, CheckCircle2, Clock, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function SyncStatusBadge({ status, error, retryCount, syncedAt }) {
  if (!status) return null;

  const configs = {
    queued: {
      icon: Clock,
      label: 'Pending Sync',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      tooltip: 'Transaction queued for sync',
    },
    processing: {
      icon: Clock,
      label: 'Syncing...',
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      border: 'border-blue-300',
      tooltip: 'Transaction is currently syncing',
    },
    confirmed: {
      icon: CheckCircle2,
      label: 'Synced',
      bg: 'bg-green-50',
      text: 'text-green-700',
      border: 'border-green-200',
      tooltip: syncedAt ? `Synced ${new Date(syncedAt).toLocaleString()}` : 'Successfully synced',
    },
    failed: {
      icon: AlertTriangle,
      label: 'Sync Failed',
      bg: 'bg-red-50',
      text: 'text-red-700',
      border: 'border-red-200',
      tooltip: error || 'Sync failed - review in Sync Center',
    },
    conflict: {
      icon: Zap,
      label: 'Conflict',
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      tooltip: error || 'Conflict detected - supervisor action required',
    },
  };

  const config = configs[status] || configs.queued;
  const Icon = config.icon;

  let tooltip = config.tooltip;
  if (retryCount > 0 && status === 'queued') {
    tooltip = `Retrying (attempt ${retryCount + 1})`;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={`${config.bg} ${config.text} border-2 ${config.border} cursor-help`}>
            <Icon className="w-3 h-3 mr-1" />
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Quick sync status indicator (compact)
 */
export function SyncStatusDot({ status, size = 'md' }) {
  const colors = {
    queued: 'bg-blue-500',
    processing: 'bg-blue-400',
    confirmed: 'bg-green-500',
    failed: 'bg-red-500',
    conflict: 'bg-amber-500',
  };

  const sizes = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  return (
    <div className={`${colors[status] || colors.queued} ${sizes[size]} rounded-full animate-pulse`} />
  );
}

/**
 * Inline sync badge for tables
 */
export function SyncStatusInline({ status, syncedAt }) {
  const labels = {
    queued: 'Pending',
    processing: 'Syncing',
    confirmed: 'Synced',
    failed: 'Failed',
    conflict: 'Conflict',
  };

  const colors = {
    queued: 'text-blue-600',
    processing: 'text-blue-600',
    confirmed: 'text-green-600',
    failed: 'text-red-600',
    conflict: 'text-amber-600',
  };

  return (
    <span className={`text-xs font-medium ${colors[status]}`}>
      {labels[status]}
      {status === 'confirmed' && syncedAt && ` @ ${new Date(syncedAt).toLocaleTimeString()}`}
    </span>
  );
}