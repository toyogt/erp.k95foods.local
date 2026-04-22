import { Layers, Clock, PlayCircle, CheckCircle2 } from 'lucide-react';

const STAT_CONFIG = [
  { key: null,         label: 'Total Jobs',  icon: Layers,       accent: 'text-slate-900', bg: 'bg-slate-50', ring: 'ring-slate-900' },
  { key: 'pending',    label: 'Pending',     icon: Clock,        accent: 'text-slate-700', bg: 'bg-amber-50', ring: 'ring-amber-500' },
  { key: 'active',     label: 'In Progress', icon: PlayCircle,   accent: 'text-blue-700',  bg: 'bg-blue-50',  ring: 'ring-blue-500' },
  { key: 'completed',  label: 'Completed',   icon: CheckCircle2, accent: 'text-green-700', bg: 'bg-green-50', ring: 'ring-green-500' },
];

export default function LblPlanningStats({ stats, activeFilter, onFilterChange }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
      {STAT_CONFIG.map(cfg => {
        const value = cfg.key === null ? stats.total : stats[cfg.key];
        const isActive = activeFilter === cfg.key;
        const Icon = cfg.icon;
        return (
          <button
            key={cfg.label}
            type="button"
            onClick={() => onFilterChange(isActive ? null : cfg.key)}
            className={`text-left bg-white border rounded-xl p-3 transition-all active:scale-[0.98] ${
              isActive
                ? `border-transparent ring-2 ${cfg.ring} ${cfg.bg}`
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500">{cfg.label}</p>
              <Icon className={`w-4 h-4 ${cfg.accent} opacity-70`} />
            </div>
            <p className={`text-2xl md:text-3xl font-bold ${cfg.accent} mt-1 leading-none`}>{value}</p>
          </button>
        );
      })}
    </div>
  );
}