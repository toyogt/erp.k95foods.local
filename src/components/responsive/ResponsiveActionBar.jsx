/**
 * Responsive Action Bar
 * Sticky action buttons optimized for mobile/scanner touch
 */

import { useDeviceMode } from '@/hooks/useDeviceMode';

export default function ResponsiveActionBar({
  actions = [],
  sticky = true,
  orientation = 'horizontal', // horizontal | vertical
  className = '',
}) {
  const { mode, sizes } = useDeviceMode();

  // Determine if sticky
  const shouldSticky = sticky && ['mobile', 'scanner', 'kiosk'].includes(mode);

  const containerClass = `
    flex gap-2 p-4 bg-white border-t border-slate-200 rounded-t-lg
    ${orientation === 'vertical' ? 'flex-col' : 'flex-row'}
    ${shouldSticky ? 'fixed bottom-0 left-0 right-0 z-40' : 'relative'}
    ${className}
  `;

  const paddingBottom = shouldSticky ? 'pb-24' : 'pb-0';

  return (
    <>
      {/* Spacer if sticky */}
      {shouldSticky && <div className={`h-24 w-full ${paddingBottom}`} />}

      {/* Action bar */}
      <div className={containerClass}>
        {actions.map((action, idx) => (
          <button
            key={idx}
            onClick={action.onClick}
            disabled={action.disabled}
            className={`
              flex-1 rounded-lg font-bold transition-all
              ${action.variant === 'primary'
                ? 'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-700'
                : 'bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300'
              }
              ${sizes.buttonHeight}
              ${sizes.buttonPadding}
              disabled:opacity-50 disabled:cursor-not-allowed
              ${action.loading ? 'opacity-70' : ''}
            `}
          >
            {action.loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {action.label}
              </span>
            ) : (
              action.label
            )}
          </button>
        ))}
      </div>
    </>
  );
}