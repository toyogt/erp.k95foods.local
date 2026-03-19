/**
 * Supervisor Layout
 * Desktop-optimized for reconciliation and data-heavy tasks
 */

import { useDeviceMode } from '@/hooks/useDeviceMode';

export default function SupervisorLayout({
  children,
  title,
  filters = null,
  stats = null,
}) {
  const { sizes, layout } = useDeviceMode();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-6">
        <div className="max-w-7xl mx-auto">
          {title && <h1 className="text-3xl font-bold text-slate-900">{title}</h1>}

          {/* Stats row */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              {stats.map((stat, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-600 font-medium">{stat.label}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-2">{stat.value}</p>
                  {stat.change && (
                    <p className={`text-xs mt-1 ${stat.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stat.change > 0 ? '+' : ''}{stat.change}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {/* Filters */}
          {filters && (
            <div className="bg-white p-4 rounded-lg border border-slate-200 mb-6 space-y-4">
              {filters}
            </div>
          )}

          {/* Content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}