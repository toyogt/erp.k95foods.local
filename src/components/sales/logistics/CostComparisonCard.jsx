import { COST_HEADS } from './costHeads';
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react';

function VarianceBadge({ value }) {
  if (value === null || value === undefined) return <span className="text-xs text-slate-400">—</span>;
  const isOver = value > 0;
  const abs = Math.abs(value);
  return (
    <span className={`text-xs font-medium ${isOver ? 'text-red-600' : value < 0 ? 'text-green-600' : 'text-slate-500'}`}>
      {isOver ? '+' : value < 0 ? '-' : ''}₹{abs.toLocaleString('en-IN')}
    </span>
  );
}

export default function CostComparisonCard({ costRecord }) {
  if (!costRecord) return null;
  const sysTotal = Number(costRecord.system_total) || 0;
  const planTotal = Number(costRecord.planned_total) || 0;
  const actTotal = Number(costRecord.actual_total) || 0;
  
  if (actTotal === 0 && planTotal === 0) return null;

  const varSysVsActual = actTotal > 0 && sysTotal > 0 ? actTotal - sysTotal : null;
  const varPlanVsActual = actTotal > 0 && planTotal > 0 ? actTotal - planTotal : null;
  const accuracyPct = actTotal > 0 && planTotal > 0
    ? Math.max(0, 100 - Math.abs((actTotal - planTotal) / planTotal * 100)).toFixed(1)
    : null;

  const rows = COST_HEADS.map(h => ({
    label: h.label,
    system: Number(costRecord[`system_${h.key}`]) || 0,
    planned: Number(costRecord[`planned_${h.key}`]) || 0,
    actual: Number(costRecord[`actual_${h.key}`]) || 0,
  }));

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-slate-600" />
        <span className="text-sm font-semibold text-slate-900">Cost Comparison</span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-xs text-blue-600">System Estimate</p>
          <p className="text-lg font-bold text-blue-900">₹{sysTotal.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-600">Planned Cost</p>
          <p className="text-lg font-bold text-slate-900">₹{planTotal.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-emerald-50 rounded-lg p-3 text-center">
          <p className="text-xs text-emerald-600">Actual Cost</p>
          <p className="text-lg font-bold text-emerald-900">₹{actTotal.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Detailed breakdown table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="text-left py-2 px-2 font-medium">Cost Head</th>
              <th className="text-right py-2 px-2 font-medium">System</th>
              <th className="text-right py-2 px-2 font-medium">Planned</th>
              <th className="text-right py-2 px-2 font-medium">Actual</th>
              <th className="text-right py-2 px-2 font-medium">Variance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.filter(r => r.system > 0 || r.planned > 0 || r.actual > 0).map(r => (
              <tr key={r.label} className="hover:bg-slate-50">
                <td className="py-1.5 px-2 text-slate-700">{r.label}</td>
                <td className="py-1.5 px-2 text-right text-blue-700">₹{r.system.toLocaleString('en-IN')}</td>
                <td className="py-1.5 px-2 text-right text-slate-900">₹{r.planned.toLocaleString('en-IN')}</td>
                <td className="py-1.5 px-2 text-right text-emerald-700">₹{r.actual.toLocaleString('en-IN')}</td>
                <td className="py-1.5 px-2 text-right"><VarianceBadge value={r.actual > 0 ? r.actual - r.planned : null} /></td>
              </tr>
            ))}
            <tr className="font-semibold bg-slate-50">
              <td className="py-2 px-2">Total</td>
              <td className="py-2 px-2 text-right text-blue-700">₹{sysTotal.toLocaleString('en-IN')}</td>
              <td className="py-2 px-2 text-right">₹{planTotal.toLocaleString('en-IN')}</td>
              <td className="py-2 px-2 text-right text-emerald-700">₹{actTotal.toLocaleString('en-IN')}</td>
              <td className="py-2 px-2 text-right"><VarianceBadge value={varPlanVsActual} /></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Variance summary */}
      {actTotal > 0 && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          {varSysVsActual !== null && (
            <div className={`rounded-lg p-2 text-center ${varSysVsActual > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
              <p className="text-xs text-slate-600">System vs Actual</p>
              <div className="flex items-center justify-center gap-1">
                {varSysVsActual > 0 ? <TrendingUp className="w-3 h-3 text-red-500" /> : <TrendingDown className="w-3 h-3 text-green-500" />}
                <VarianceBadge value={varSysVsActual} />
              </div>
            </div>
          )}
          {varPlanVsActual !== null && (
            <div className={`rounded-lg p-2 text-center ${varPlanVsActual > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
              <p className="text-xs text-slate-600">Planned vs Actual</p>
              <div className="flex items-center justify-center gap-1">
                {varPlanVsActual > 0 ? <TrendingUp className="w-3 h-3 text-red-500" /> : <TrendingDown className="w-3 h-3 text-green-500" />}
                <VarianceBadge value={varPlanVsActual} />
              </div>
            </div>
          )}
          {accuracyPct !== null && (
            <div className="bg-slate-50 rounded-lg p-2 text-center">
              <p className="text-xs text-slate-600">Estimation Accuracy</p>
              <p className={`text-sm font-bold ${Number(accuracyPct) >= 90 ? 'text-green-700' : Number(accuracyPct) >= 70 ? 'text-amber-700' : 'text-red-700'}`}>
                {accuracyPct}%
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}