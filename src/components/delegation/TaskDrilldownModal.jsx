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

        {/* Meeting Plan Summary */}
        <MeetingPlanSummary plan={currentPlan} person={person} />

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
                    <td className="text-center px-2 py-2.5">
                      <CycleStatusBadge status={c.cycle_status} />
                    </td>
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
                      {c.unmanaged_overdue_days > 0 ? (
                        <span className="text-red-600 font-semibold">{c.unmanaged_overdue_days}</span>
                      ) : '—'}
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

function MeetingPlanSummary({ plan, person }) {
  const hasAnyPlan = plan.this_week_planned_notes || plan.next_week_planned_notes || plan.meeting_remarks;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pb-3 border-b border-slate-100">
      <PlanCard
        icon={<ClipboardList className="w-4 h-4 text-blue-500" />}
        title="This Week Planned"
        value={plan.this_week_planned_notes}
        emptyText="No plan carried over from last week"
        bg="bg-blue-50 border-blue-100"
      />
      <PlanCard
        icon={<CalendarClock className="w-4 h-4 text-indigo-500" />}
        title="Next Week Planned"
        value={plan.next_week_planned_notes}
        emptyText="Not entered yet"
        bg="bg-indigo-50 border-indigo-100"
      />
      <PlanCard
        icon={<MessageSquare className="w-4 h-4 text-amber-500" />}
        title="Meeting Remarks"
        value={plan.meeting_remarks}
        emptyText="No remarks"
        bg="bg-amber-50 border-amber-100"
      />
    </div>
  );
}

function PlanCard({ icon, title, value, emptyText, bg }) {
  return (
    <div className={`border rounded-lg p-3 ${bg}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs font-semibold text-slate-600">{title}</span>
      </div>
      <p className={`text-sm whitespace-pre-wrap leading-snug ${value ? 'text-slate-800' : 'text-slate-400 italic'}`}>
        {value || emptyText}
      </p>
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