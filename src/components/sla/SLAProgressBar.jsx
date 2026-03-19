/**
 * SLA Progress Bar
 * Visual timeline showing SLA consumption
 */

import { getSLAStatusColor } from '@/lib/slaEngine';

export default function SLAProgressBar({ 
  percentageUsed, 
  status, 
  label,
  showLabel = true 
}) {
  const normalizedPercentage = Math.min(100, percentageUsed);
  const colorClass = getSLAStatusColor(status);

  // Extract just the background color from the full class
  let bgColor = 'bg-green-500';
  if (colorClass.includes('amber')) bgColor = 'bg-amber-500';
  if (colorClass.includes('red-100')) bgColor = 'bg-red-500';
  if (colorClass.includes('red-900')) bgColor = 'bg-red-900';

  return (
    <div className="space-y-1">
      {showLabel && (
        <div className="flex justify-between text-xs">
          <span className="text-slate-700 font-medium">{label}</span>
          <span className="text-slate-500">{Math.round(percentageUsed)}%</span>
        </div>
      )}
      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${bgColor}`}
          style={{ width: `${normalizedPercentage}%` }}
        />
      </div>
    </div>
  );
}