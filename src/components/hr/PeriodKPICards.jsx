import { Users, UserCheck, UserX, Percent, Clock } from 'lucide-react';

function MiniStat({ icon: Icon, label, value, sub, iconBg, iconColor, valueColor }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-md ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-slate-500">{label}</div>
          <div className={`text-lg font-bold ${valueColor || 'text-slate-900'}`}>{value}</div>
          {sub && <div className="text-xs text-slate-500">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

export default function PeriodKPICards({ kpis }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <MiniStat
        icon={Users}
        label="Reached"
        value={kpis.reached}
        sub="in period"
        iconBg="bg-slate-100"
        iconColor="text-slate-600"
      />
      <MiniStat
        icon={UserCheck}
        label="Converted"
        value={kpis.converted}
        sub="hired in period"
        iconBg="bg-green-100"
        iconColor="text-green-600"
        valueColor="text-green-700"
      />
      <MiniStat
        icon={Percent}
        label="Conversion Rate"
        value={`${kpis.conversionRate}%`}
        sub="of reached"
        iconBg="bg-blue-100"
        iconColor="text-blue-600"
        valueColor="text-blue-700"
      />
      <MiniStat
        icon={UserX}
        label="Exited"
        value={kpis.exited}
        sub="in period"
        iconBg="bg-red-100"
        iconColor="text-red-600"
        valueColor="text-red-700"
      />
      <MiniStat
        icon={Clock}
        label="Avg Tenure"
        value={`${kpis.avgTenure}d`}
        sub="period exits"
        iconBg="bg-violet-100"
        iconColor="text-violet-600"
        valueColor="text-violet-700"
      />
    </div>
  );
}