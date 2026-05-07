import { Badge } from '@/components/ui/badge';
import { Loader2, Inbox, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatIstTime } from '@/lib/istFormatter';

const STATUS_BADGE = {
  CLEAN: { cls: 'bg-green-100 text-green-700', icon: CheckCircle2, label: 'Clean' },
  FLAGGED: { cls: 'bg-amber-100 text-amber-700', icon: AlertTriangle, label: 'Flagged' },
  MISSING_OUT: { cls: 'bg-red-100 text-red-700', icon: AlertTriangle, label: 'Missing OUT' },
  MISSING_IN: { cls: 'bg-red-100 text-red-700', icon: AlertTriangle, label: 'Missing IN' },
  NO_PUNCHES: { cls: 'bg-slate-100 text-slate-600', icon: Inbox, label: 'No Punches' },
};

function formatMinutesToHM(minutes) {
  if (!minutes || minutes <= 0) return '0h 00m';
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export default function AttendanceSummaryTable({ summaries, isLoading }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!summaries?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <Inbox className="w-10 h-10 mb-2 text-slate-300" />
        <div className="text-sm">No daily summaries yet</div>
        <div className="text-xs text-slate-400 mt-1">Run the calculation to generate summaries from punches</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-slate-700">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Employee Code</th>
            <th className="px-3 py-2 text-left font-medium">Name</th>
            <th className="px-3 py-2 text-left font-medium">Work Date</th>
            <th className="px-3 py-2 text-left font-medium">First IN</th>
            <th className="px-3 py-2 text-left font-medium">Last OUT</th>
            <th className="px-3 py-2 text-right font-medium">Total Hours</th>
            <th className="px-3 py-2 text-center font-medium">Punches</th>
            <th className="px-3 py-2 text-center font-medium">Pairs</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {summaries.map((s) => {
            const st = STATUS_BADGE[s.status] || STATUS_BADGE.CLEAN;
            const Icon = st.icon;
            return (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-slate-900">{s.employee_code}</td>
                <td className="px-3 py-2 text-slate-700">{s.employee_name || '—'}</td>
                <td className="px-3 py-2 text-slate-700">{s.work_date}</td>
                <td className="px-3 py-2 font-mono text-slate-700">{s.first_in ? formatIstTime(s.first_in) : '—'}</td>
                <td className="px-3 py-2 font-mono text-slate-700">{s.last_out ? formatIstTime(s.last_out) : '—'}</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-900">
                  {formatMinutesToHM(s.total_work_minutes)}
                </td>
                <td className="px-3 py-2 text-center text-slate-600">
                  <span className="text-xs">
                    {s.in_count || 0} IN / {s.out_count || 0} OUT
                  </span>
                </td>
                <td className="px-3 py-2 text-center text-slate-600">
                  {s.pairs?.length || 0}
                  {s.unmatched_punches?.length > 0 && (
                    <span className="text-xs text-amber-600 ml-1">
                      (+{s.unmatched_punches.length} orphan)
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Badge className={`${st.cls} gap-1`}>
                    <Icon className="w-3 h-3" />
                    {st.label}
                  </Badge>
                  {s.manual_override && (
                    <Badge className="ml-1 bg-blue-100 text-blue-700 text-xs">Manual</Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}