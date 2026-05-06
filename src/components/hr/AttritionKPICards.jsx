import { Users, UserCheck, UserX, TrendingDown, TrendingUp, Clock } from 'lucide-react';

function StatCard({ icon: Icon, label, value, sub, color = 'text-slate-900', iconBg = 'bg-slate-100', iconColor = 'text-slate-600' }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 md:p-4">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-slate-500">{label}</div>
          <div className={`text-xl md:text-2xl font-bold mt-0.5 ${color}`}>{value}</div>
          {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

export default function AttritionKPICards({ kpis }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatCard
        icon={Users}
        label="Total Leads"
        value={kpis.total}
        iconBg="bg-slate-100"
        iconColor="text-slate-600"
      />
      <StatCard
        icon={UserCheck}
        label="Hired (Total)"
        value={kpis.hired}
        sub={`${kpis.conversionRate.toFixed(1)}% conversion`}
        color="text-green-700"
        iconBg="bg-green-100"
        iconColor="text-green-600"
      />
      <StatCard
        icon={TrendingUp}
        label="Currently Active"
        value={kpis.active}
        color="text-blue-700"
        iconBg="bg-blue-100"
        iconColor="text-blue-600"
      />
      <StatCard
        icon={UserX}
        label="Terminated"
        value={kpis.terminated}
        color="text-red-700"
        iconBg="bg-red-100"
        iconColor="text-red-600"
      />
      <StatCard
        icon={TrendingDown}
        label="Attrition Rate"
        value={`${kpis.attritionRate.toFixed(1)}%`}
        sub={`of ${kpis.hired} hired`}
        color="text-amber-700"
        iconBg="bg-amber-100"
        iconColor="text-amber-600"
      />
      <StatCard
        icon={Clock}
        label="Avg Tenure"
        value={`${kpis.avgTenure}d`}
        sub="exited employees"
        color="text-violet-700"
        iconBg="bg-violet-100"
        iconColor="text-violet-600"
      />
    </div>
  );
}