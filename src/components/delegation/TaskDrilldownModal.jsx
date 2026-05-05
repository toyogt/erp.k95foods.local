import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ClipboardList, MessageSquare, CalendarClock } from 'lucide-react';

const HEALTH_COLORS = {
  Green: 'bg-green-100 text-green-700',
  Yellow: 'bg-yellow-100 text-yellow-700',
  Red: 'bg-red-100 text-red-700',
};

export default function TaskDrilldownModal({ open, onClose, person, plan }) {
  if (!person) return null;

  const cycles = person.cycles || [];
  const currentPlan = plan || {};

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {person.person_name} — Task Scoring Detail
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              person.person_health === 'Critical' ? 'bg-red-100 text-red-700'
                : person.person_health === 'Needs Follow-up' ? 'bg-yellow-100 text-yellow-700'
                : 'bg-green-100 text-green-700'
            }`}>
              {person.person_health}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Meeting Plan Comparison */}
        <PlanComparisonBar plan={currentPlan} actual={person} />

        {/* Score Summary */}
        <div className="flex gap-4 flex-wrap text-sm pb-3 border-b border-slate-100">
          <span>Total: <strong>{person.total}</strong></span>
          <span className="text-green-700">Green: <strong>{person.green}</strong> ({person.green_pct}%)</span>
          <span className="text-yellow-600">Yellow: <strong>{person.yellow}</strong> ({person.yellow_pct}%)</span>
          <span className="text-red-600">Red: <strong>{person.red}</strong> ({person.red_pct}%)</span>
        </div>

        {/* Task Scoring Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-100 text-slate-700">
                <th className="text-left px-3 py-2.5 font-medium">Task ID</th>
                <th className="text-left px-3 py-2.5 font-medium min-w-[160px]">Title</th>
                <th className="text-center px-2 py-2.5 font-medium whitespace-nowrap">Original Due</th>
                <th className="text-center px-2 py-2.5 font-medium whitespace-nowrap">Cycle Due</th>
                <th className="text-center px-2 py-2.5 font-medium whitespace-nowrap">Cycle Week</th>
                <th className="text-center px-2 py-2.5 font-medium">Status</th>
                <th className="text-center px-2 py-2.5 font-medium whitespace-nowrap">Completed</th>
                <th className="text-center px-2 py-2.5 font-medium whitespace-nowrap">Date Changes</th>
                <th className="text-center px-2 py-2.5 font-medium whitespace-nowrap">Same/Shift</th>
                <th className="text-center px-2 py-2.5 font-medium whitespace-nowrap">Overdue Days</th>
                <th className="text-center px-2 py-2.5 font-medium whitespace-nowrap">DC Penalty</th>
                <th className="text-center px-2 py-2.5 font-medium whitespace-nowrap">WS Penalty</th>
                <th className="text-center px-2 py-2.5 font-medium whitespace-nowrap">Overdue Penalty</th>
                <th className="text-center px-2 py-2.5 font-medium whitespace-nowrap">Final</th>
                <th className="text-center px-2 py-2.5 font-medium">Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cycles.map((c, i) => {
                const completedDate = c.completed_at
                  ? new Date(c.completed_at).toLocaleDateString('en-GB')
                  : '—';
                return (
                  <tr key={`${c.task_id}-${i}`} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-mono text-slate-600">{c.task_number}</td>
                    <td className="px-3 py-2.5 text-slate-900 font-medium">{c.task_name}</td>
                    <td className="text-center px-2 py-2.5 text-slate-600">{c.original_due_date}</td>
                    <td className="text-center px-2 py-2.5 text-slate-600">{c.cycle_due_date}</td>
                    <td className="text-center px-2 py-2.5 text-slate-500 whitespace-nowrap">
                      {c.cycle_week_start} – {c.cycle_week_end}
                    </td>
                    <td className="text-center px-2 py-2.5"><CycleStatusBadge status={c.cycle_status} /></td>
                    <td className="text-center px-2 py-2.5 text-slate-600">{completedDate}</td>
                    <td className="text-center px-2 py-2.5">{c.date_change_count}</td>
                    <td className="text-center px-2 py-2.5">
                      {c.week_shifted ? (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Week Shift</span>
                      ) : c.same_week_change_count > 0 ? (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Same Week ×{c.same_week_change_count}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="text-center px-2 py-2.5">
                      {c.unmanaged_overdue_days > 0 ? <span className="text-red-600 font-semibold">{c.unmanaged_overdue_days}</span> : '—'}
                    </td>
                    <td className="text-center px-2 py-2.5"><PenaltyCell val={c.date_change_penalty} /></td>
                    <td className="text-center px-2 py-2.5"><PenaltyCell val={c.week_shift_penalty} /></td>
                    <td className="text-center px-2 py-2.5"><PenaltyCell val={c.unmanaged_overdue_penalty} /></td>
                    <td className="text-center px-2 py-2.5 font-bold">{c.final_penalty}</td>
                    <td className="text-center px-2 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${HEALTH_COLORS[c.task_health]}`}>
                        {c.task_health}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Compact plan vs actual comparison bar */
function PlanComparisonBar({ plan, actual }) {
  const rows = [
    { label: 'Green', planKey: 'this_week_planned_green', nextKey: 'next_week_planned_green', actualVal: actual.green, color: 'green' },
    { label: 'Yellow', planKey: 'this_week_planned_yellow', nextKey: 'next_week_planned_yellow', actualVal: actual.yellow, color: 'yellow' },
    { label: 'Red', planKey: 'this_week_planned_red', nextKey: 'next_week_planned_red', actualVal: actual.red, color: 'red' },
  ];

  const colorMap = {
    green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
    red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  };

  return (
    <div className="pb-3 border-b border-slate-100 space-y-2">
      <div className="grid grid-cols-3 gap-3">
        {rows.map(r => {
          const planned = Number(plan[r.planKey]) || 0;
          const nextPlanned = Number(plan[r.nextKey]) || 0;
          const actual = r.actualVal || 0;
          const cm = colorMap[r.color];
          const diff = actual - planned;
          return (
            <div key={r.label} className={`${cm.bg} border ${cm.border} rounded-lg p-3`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold ${cm.text}`}>{r.label}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xs text-slate-500">Planned</div>
                  <div className={`text-lg font-bold ${cm.text}`}>{planned}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Actual</div>
                  <div className={`text-lg font-bold ${cm.text}`}>{actual}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Next</div>
                  <div className="text-lg font-bold text-indigo-600">{nextPlanned}</div>
                </div>
              </div>
              {planned > 0 && (
                <div className={`text-xs mt-1 text-center font-medium ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-green-600' : 'text-slate-500'}`}>
                  {diff === 0 ? 'On target' : diff > 0 ? `+${diff} over plan` : `${diff} under plan`}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {plan.this_week_notes && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-2.5 flex items-start gap-2">
          <ClipboardList className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-blue-700 mb-0.5">This Week Commitment Notes</p>
            <p className="text-sm text-blue-800 whitespace-pre-wrap">{plan.this_week_notes}</p>
          </div>
        </div>
      )}
      {plan.next_week_notes && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2.5 flex items-start gap-2">
          <CalendarClock className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-indigo-700 mb-0.5">Next Week Commitment Notes</p>
            <p className="text-sm text-indigo-800 whitespace-pre-wrap">{plan.next_week_notes}</p>
          </div>
        </div>
      )}
      {plan.meeting_remarks && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5 flex items-start gap-2">
          <MessageSquare className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 whitespace-pre-wrap">{plan.meeting_remarks}</p>
        </div>
      )}
    </div>
  );
}

function CycleStatusBadge({ status }) {
  const styles = {
    active: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    week_shifted: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] || 'bg-slate-100 text-slate-500'}`}>
      {status === 'week_shifted' ? 'Week Shifted' : status === 'active' ? 'Active' : 'Completed'}
    </span>
  );
}

function PenaltyCell({ val }) {
  if (!val) return <span className="text-slate-300">0</span>;
  const color = val >= 2 ? 'text-red-600 font-bold' : val === 1 ? 'text-yellow-600 font-semibold' : 'text-slate-400';
  return <span className={color}>{val}</span>;
}