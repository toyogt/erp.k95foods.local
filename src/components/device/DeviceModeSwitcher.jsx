/**
 * Device Mode Switcher
 * Admin/user-facing control for device mode override
 */

import { useDeviceMode } from '@/hooks/useDeviceMode';
import { Monitor, Smartphone, Barcode, Maximize2 } from 'lucide-react';

export default function DeviceModeSwitcher({ adminOnly = true }) {
  const { mode, isManualOverride, setModeOverride } = useDeviceMode();

  const modes = [
    { key: 'desktop', label: 'Desktop', icon: Monitor, description: 'Dense tables, multi-column' },
    { key: 'mobile', label: 'Touch', icon: Smartphone, description: 'Large buttons, simple nav' },
    { key: 'scanner', label: 'Scanner', icon: Barcode, description: 'Large scan focus' },
    { key: 'kiosk', label: 'Kiosk', icon: Maximize2, description: 'Shared terminal mode' },
    { key: 'auto', label: 'Auto', icon: null, description: 'Detect automatically' },
  ];

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-xs font-medium text-slate-600">Device Mode:</span>
      {modes.map((m) => {
        const Icon = m.icon;
        const isActive = (m.key === 'auto' && !isManualOverride) || mode === m.key;

        return (
          <button
            key={m.key}
            onClick={() => setModeOverride(m.key)}
            title={m.description}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${isActive
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }
            `}
          >
            {Icon && <Icon className="w-4 h-4" />}
            {m.label}
          </button>
        );
      })}
    </div>
  );
}