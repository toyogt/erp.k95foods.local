import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

const REASON_COLORS = ['#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b', '#0ea5e9'];

export default function AttritionFunnelPanel({ funnel }) {
  // funnel: { hiredTotal, activeTotal, exitedTotal, attritionRate, reasons:[{name,value}] }
  const { hiredTotal, activeTotal, exitedTotal, attritionRate, reasons } = funnel;

  return (
    <div className="space-y-4">
      {/* Funnel summary blocks */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-center">
          <div className="text-xs text-slate-500">Total Hired</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{hiredTotal}</div>
          <div className="text-xs text-slate-500 mt-0.5">100%</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-md p-3 text-center">
          <div className="text-xs text-slate-500">Still Active</div>
          <div className="text-2xl font-bold text-green-700 mt-1">{activeTotal}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {hiredTotal ? Math.round((activeTotal / hiredTotal) * 100) : 0}%
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-center">
          <div className="text-xs text-slate-500">Exited</div>
          <div className="text-2xl font-bold text-red-700 mt-1">{exitedTotal}</div>
          <div className="text-xs text-slate-500 mt-0.5">{attritionRate}% attrition</div>
        </div>
      </div>

      {/* Reasons pie */}
      {reasons.length > 0 && (
        <div>
          <div className="text-xs font-medium text-slate-700 mb-2">Exit Reasons</div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={reasons} dataKey="value" nameKey="name" outerRadius={70} label>
                  {reasons.map((_, i) => (
                    <Cell key={i} fill={REASON_COLORS[i % REASON_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}