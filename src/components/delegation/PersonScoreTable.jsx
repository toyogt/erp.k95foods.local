import { ChevronRight } from 'lucide-react';
import MeetingPlanCell from './MeetingPlanCell';

const HEALTH_BADGE = {
  Good: 'bg-green-100 text-green-700',
  'Needs Follow-up': 'bg-yellow-100 text-yellow-700',
  Critical: 'bg-red-100 text-red-700',
};

export default function PersonScoreTable({ persons, onSelectPerson, plans, onSavePlan }) {
  if (persons.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400 text-sm">No scoring data for the selected period</p>
      </div>
    );
  }

  const getPlan = (email) => plans?.[email] || {};

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="text-left px-4 py-3 font-medium">Person</th>
              <th className="text-left px-3 py-3 font-medium min-w-[160px]">This Week Planned</th>
              <th className="text-center px-3 py-3 font-medium">Total</th>
              <th className="text-center px-3 py-3 font-medium">
                <span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-1" />Green
              </th>
              <th className="text-center px-3 py-3 font-medium">
                <span className="inline-block w-3 h-3 rounded-full bg-yellow-400 mr-1" />Yellow
              </th>
              <th className="text-center px-3 py-3 font-medium">
                <span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-1" />Red
              </th>
              <th className="text-center px-3 py-3 font-medium">Green %</th>
              <th className="text-center px-3 py-3 font-medium">Yellow %</th>
              <th className="text-center px-3 py-3 font-medium">Red %</th>
              <th className="text-center px-3 py-3 font-medium">Health</th>
              <th className="text-left px-3 py-3 font-medium min-w-[160px]">Next Week Planned</th>
              <th className="text-left px-3 py-3 font-medium min-w-[160px]">Meeting Remarks</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {persons.map(p => {
              const plan = getPlan(p.person_email);
              return (
                <tr
                  key={p.person_email}
                  className="hover:bg-slate-50 cursor-pointer transition-colors align-top"
                  onClick={() => onSelectPerson(p)}
                >
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{p.person_name}</td>
                  <td className="px-3 py-2">
                    <MeetingPlanCell
                      value={plan.this_week_planned_notes}
                      editable={false}
                      placeholder="No plan carried over"
                    />
                  </td>
                  <td className="text-center px-3 py-3 font-semibold text-slate-900">{p.total}</td>
                  <td className="text-center px-3 py-3 font-semibold text-green-700">{p.green}</td>
                  <td className="text-center px-3 py-3 font-semibold text-yellow-600">{p.yellow}</td>
                  <td className="text-center px-3 py-3 font-semibold text-red-600">{p.red}</td>
                  <td className="text-center px-3 py-3 text-green-600">{p.green_pct}%</td>
                  <td className="text-center px-3 py-3 text-yellow-600">{p.yellow_pct}%</td>
                  <td className="text-center px-3 py-3 text-red-600 font-semibold">{p.red_pct}%</td>
                  <td className="text-center px-3 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${HEALTH_BADGE[p.person_health] || 'bg-slate-100 text-slate-500'}`}>
                      {p.person_health}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <MeetingPlanCell
                      value={plan.next_week_planned_notes}
                      onSave={(val) => onSavePlan(p.person_email, p.person_name, 'next_week_planned_notes', val)}
                      placeholder="Enter plan…"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <MeetingPlanCell
                      value={plan.meeting_remarks}
                      onSave={(val) => onSavePlan(p.person_email, p.person_name, 'meeting_remarks', val)}
                      placeholder="Add remarks…"
                    />
                  </td>
                  <td className="px-2 py-3">
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}