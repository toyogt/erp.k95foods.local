/**
 * Responsive Card
 * Auto-adjusts density based on device
 */

import { useDeviceMode } from '@/hooks/useDeviceMode';

export default function ResponsiveCard({
  children,
  title,
  subtitle,
  variant = 'default', // default | dense | comfortable | sparse
  className = '',
}) {
  const { mode, layout } = useDeviceMode();

  // Auto-select variant based on device
  let densityVariant = variant;
  if (variant === 'default') {
    densityVariant = layout.tableDensity;
  }

  const paddings = {
    dense: 'p-2',
    compact: 'p-3',
    comfortable: 'p-4',
    sparse: 'p-6',
  };

  const gaps = {
    dense: 'space-y-1',
    compact: 'space-y-2',
    comfortable: 'space-y-3',
    sparse: 'space-y-4',
  };

  const padding = paddings[densityVariant] || paddings.comfortable;
  const gap = gaps[densityVariant] || gaps.comfortable;

  return (
    <div className={`rounded-lg border border-slate-200 bg-white ${padding} ${gap} ${className}`}>
      {title && (
        <div>
          <h3 className="font-bold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}