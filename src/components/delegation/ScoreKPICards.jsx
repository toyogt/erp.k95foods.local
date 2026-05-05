import { TrendingDown, TrendingUp, CalendarClock, AlertTriangle, ArrowRightLeft, CheckCircle2 } from 'lucide-react';

const CARDS = [
  { key: 'total', label: 'Total Tasks', color: 'bg-slate-50 border-slate-200', text: 'text-slate-900', icon: CheckCircle2, iconColor: 'text-slate-500' },
  { key: 'green_pct', label: 'Green %', color: 'bg-green-50 border-green-100', text: 'text-green-700', icon: TrendingUp, iconColor: 'text-green-500', suffix: '%' },
  { key: 'yellow_pct', label: 'Yellow %', color: 'bg-yellow-50 border-yellow-100', text: 'text-yellow-700', icon: TrendingDown, iconColor: 'text-yellow-500', suffix: '%' },
  { key: 'red_pct', label: 'Red %', color: 'bg-red-50 border-red-100', text: 'text-red-700', icon: TrendingDown, iconColor: 'text-red-500', suffix: '%' },
  { key: 'green', label: 'Green Tasks', color: 'bg-green-50 border-green-100', text: 'text-green-700', icon: CheckCircle2, iconColor: 'text-green-500' },
  { key: 'yellow', label: 'Yellow Tasks', color: 'bg-yellow-50 border-yellow-100', text: 'text-yellow-700', icon: AlertTriangle, iconColor: 'text-yellow-500' },
  { key: 'red', label: 'Red Tasks', color: 'bg-red-50 border-red-100', text: 'text-red-700', icon: AlertTriangle, iconColor: 'text-red-500' },
  { key: 'unmanaged_overdue', label: 'Unmanaged Overdue', color: 'bg-orange-50 border-orange-100', text: 'text-orange-700', icon: AlertTriangle, iconColor: 'text-orange-500' },
  { key: 'date_change_requested', label: 'Date Change Requested', color: 'bg-amber-50 border-amber-100', text: 'text-amber-700', icon: CalendarClock, iconColor: 'text-amber-500' },
  { key: 'week_shifted', label: 'Week Shifted', color: 'bg-purple-50 border-purple-100', text: 'text-purple-700', icon: ArrowRightLeft, iconColor: 'text-purple-500' },
];

export default function ScoreKPICards({ kpis }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {CARDS.map(card => {
        const Icon = card.icon;
        const val = kpis[card.key] ?? 0;
        return (
          <div key={card.key} className={`${card.color} border rounded-xl p-3 md:p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${card.iconColor}`} />
              <span className="text-xs font-medium text-slate-500 truncate">{card.label}</span>
            </div>
            <p className={`text-2xl font-bold ${card.text}`}>
              {val}{card.suffix || ''}
            </p>
          </div>
        );
      })}
    </div>
  );
}