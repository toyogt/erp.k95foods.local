import { ArrowRight } from 'lucide-react';
import moment from 'moment';

/**
 * Reusable card for history records across Store module.
 * @param {object} props
 * @param {string} props.id - record ID (e.g. PUT-xxx, TRF-xxx)
 * @param {string} props.title - main title (item name)
 * @param {string} props.subtitle - secondary line
 * @param {Array} props.details - [{label, value}]
 * @param {string} props.status - status text
 * @param {string} props.statusColor - 'green' | 'amber' | 'blue' | 'red'
 * @param {string} props.date - ISO date string
 * @param {string} props.from - source location (for transfers)
 * @param {string} props.to - destination location (for transfers)
 */
export default function HistoryCard({ id, title, subtitle, details = [], status, statusColor = 'green', date, from, to }) {
  const colorMap = {
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
    red: 'bg-red-100 text-red-700',
    slate: 'bg-slate-100 text-slate-600',
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs font-bold text-slate-500">{id}</p>
          <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate">{title}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {status && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${colorMap[statusColor] || colorMap.green}`}>
              {status}
            </span>
          )}
          {date && (
            <span className="text-xs text-slate-400">
              {moment(date).format('DD/MM/YYYY')}
            </span>
          )}
        </div>
      </div>

      {/* Transfer arrow */}
      {from && to && (
        <div className="flex items-center gap-2 mt-2 bg-slate-50 rounded-lg px-3 py-1.5">
          <span className="font-mono text-xs font-bold text-slate-700">{from}</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="font-mono text-xs font-bold text-slate-700">{to}</span>
        </div>
      )}

      {/* Detail chips */}
      {details.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
          {details.map((d, i) => (
            <span key={i}>
              {d.label}: <strong className="text-slate-700">{d.value}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}