import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from 'recharts';

const STAGE_COLOR = '#3b82f6';

export default function ConversionFunnelChart({ data }) {
  // data: [{ stage, count, rate, stepRate }]
  return (
    <div className="space-y-3">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 40, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" fontSize={11} stroke="#64748b" allowDecimals={false} />
            <YAxis type="category" dataKey="stage" fontSize={11} stroke="#64748b" width={90} />
            <Tooltip formatter={(v, _n, ctx) => [v, ctx.payload.stage]} />
            <Bar dataKey="count" fill={STAGE_COLOR} radius={[0, 4, 4, 0]}>
              <LabelList dataKey="count" position="right" fontSize={11} fill="#0f172a" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Stage table */}
      <div className="grid grid-cols-5 gap-2 text-center">
        {data.map((s) => (
          <div key={s.stage} className="bg-slate-50 rounded-md p-2 border border-slate-200">
            <div className="text-xs text-slate-500 truncate">{s.stage}</div>
            <div className="text-base font-bold text-slate-900">{s.count}</div>
            <div className="text-xs text-slate-500">
              {s.rate}% of reached
            </div>
            <div className="text-xs text-blue-600">
              {s.stepRate}% step
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}