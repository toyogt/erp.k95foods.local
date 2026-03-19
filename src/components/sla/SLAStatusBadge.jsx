/**
 * SLA Status Badge
 * Visual indicator for item aging status
 */

import { getSLAStatusColor, getSLAStatusLabel, getAgeingBucketIcon } from '@/lib/slaEngine';

export default function SLAStatusBadge({ status, hoursRemaining, compact = false }) {
  const colorClass = getSLAStatusColor(status);
  const label = getSLAStatusLabel(status);
  const icon = getAgeingBucketIcon(status);

  if (compact) {
    return (
      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full border font-bold text-sm ${colorClass}`}>
        {icon}
      </span>
    );
  }

  return (
    <div className={`px-3 py-2 rounded-lg border font-medium text-sm ${colorClass}`}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <div>
          <p className="font-bold">{label}</p>
          {hoursRemaining !== undefined && (
            <p className="text-xs opacity-75">
              {hoursRemaining > 0
                ? `${Math.round(hoursRemaining)}h remaining`
                : `${Math.round(Math.abs(hoursRemaining))}h overdue`
              }
            </p>
          )}
        </div>
      </div>
    </div>
  );
}