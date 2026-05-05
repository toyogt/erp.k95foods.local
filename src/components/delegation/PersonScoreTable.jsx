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
              <th className="text-left px-4 py-3 font-medium sticky left-0 bg-slate-100 z-10">Person</th>
              {/* This Week Planned */}
              <th className="text-center px-2 py-3 font-medium bg-blue-50 text-blue-700" colSpan={3}>This Week Planned</th>
              {/* Actual Score */}
              <th className="text-center px-3 py-3 font-medium">Total</th>
              <th className="text-center px-2 py-3 font-medium">
                <span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-0.5" />Green
              </th>
              <th className="text-center px-2 py-3 font-medium">
                <span className="inline-block w-3 h-3 rounded-full bg-yellow-400 mr-0.5" />Yellow
              </th>
              <th className="text-center px-2 py-3 font-medium">
                <span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-0.5" />Red
              </th>
              <th className="text-center px-2 py-3 font-medium">Green %</th>
              <th className="text-center px-2 py-3 font-medium">Yellow %</th>
              <th className="text-center px-2 py-3 font-medium">Red %</th>
              <th className="text-center px-3 py-3 font-medium">Health</th>
              {/* Next Week Planned */}
              <th className="text-center px-2 py-3 font-medium bg-indigo-50 text-indigo-700" colSpan={3}>Next Week Planned</th>
              <th className="text-left px-3 py-3 font-medium min-w-[140px]">Remarks</th>
              <th className="w-8"></th>
            </tr>
            <tr className="bg-slate-50 text-slate-500 text-xs">
              <th className="sticky left-0 bg-slate-50 z-10"></th>
              {/* This Week sub-headers */}
              <th className="text-center px-2 py-1.5 font-medium text-green-600 bg-blue-50/50">G</th>
              <th className="text-center px-2 py-1.5 font-medium text-yellow-600 bg-blue-50/50">Y</th>
              <th className="text-center px-2 py-1.5 font-medium text-red-600 bg-blue-50/50">R</th>
              {/* Actual spacers */}
              <th></th><th></th><th></th><th></th><th></th><th></th><th></th><th></th>
              {/* Next Week sub-headers */}
              <th className="text-center px-2 py-1.5 font-medium text-green-600 bg-indigo-50/50">G</th>
              <th className="text-center px-2 py-1.5 font-medium text-yellow-600 bg-indigo-50/50">Y</th>
              <th className="text-center px-2 py-1.5 font-medium text-red-600 bg-indigo-50/50">R</th>
              <th></th><th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {persons.map(p => {
              const plan = getPlan(p.person_email);
              return (
                <tr
                  key={p.person_email}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => onSelectPerson(p)}
                >
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap sticky left-0 bg-white z-10">{p.person_name}</td>
                  {/* This Week Planned (read-only, carried forward) */}
                  <td className="text-center px-2 py-2 bg-blue-50/30">
                    <span className={`text-sm font-semibold ${plan.this_week_planned_green > 0 ? 'text-green-700' : 'text-slate-300'}`}>{plan.this_week_planned_green || 0}</span>
                  </td>
                  <td className="text-center px-2 py-2 bg-blue-50/30">
                    <span className={`text-sm font-semibold ${plan.this_week_planned_yellow > 0 ? 'text-yellow-600' : 'text-slate-300'}`}>{plan.this_week_planned_yellow || 0}</span>
                  </td>
                  <td className="text-center px-2 py-2 bg-blue-50/30">
                    <span className={`text-sm font-semibold ${plan.this_week_planned_red > 0 ? 'text-red-600' : 'text-slate-300'}`}>{plan.this_week_planned_red || 0}</span>
                  </td>
                  {/* Actual Score */}
                  <td className="text-center px-3 py-3 font-semibold text-slate-900">{p.total}</td>
                  <td className="text-center px-2 py-3 font-semibold text-green-700">{p.green}</td>
                  <td className="text-center px-2 py-3 font-semibold text-yellow-600">{p.yellow}</td>
                  <td className="text-center px-2 py-3 font-semibold text-red-600">{p.red}</td>
                  <td className="text-center px-2 py-3 text-green-600">{p.green_pct}%</td>
                  <td className="text-center px-2 py-3 text-yellow-600">{p.yellow_pct}%</td>
                  <td className="text-center px-2 py-3 text-red-600 font-semibold">{p.red_pct}%</td>
                  <td className="text-center px-3 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${HEALTH_BADGE[p.person_health] || 'bg-slate-100 text-slate-500'}`}>
                      {p.person_health}
                    </span>
                  </td>
                  {/* Next Week Planned (editable) */}
                  <td className="text-center px-2 py-2 bg-indigo-50/30">
                    <MeetingPlanCell
                      value={plan.next_week_planned_green}
                      mode="number"
                      onSave={val => onSavePlan(p.person_email, p.person_name, 'next_week_planned_green', val)}
                    />
                  </td>
                  <td className="text-center px-2 py-2 bg-indigo-50/30">
                    <MeetingPlanCell
                      value={plan.next_week_planned_yellow}
                      mode="number"
                      onSave={val => onSavePlan(p.person_email, p.person_name, 'next_week_planned_yellow', val)}
                    />
                  </td>
                  <td className="text-center px-2 py-2 bg-indigo-50/30">
                    <MeetingPlanCell
                      value={plan.next_week_planned_red}
                      mode="number"
                      onSave={val => onSavePlan(p.person_email, p.person_name, 'next_week_planned_red', val)}
                    />
                  </td>
                  {/* Remarks */}
                  <td className="px-3 py-2">
                    <MeetingPlanCell
                      value={plan.meeting_remarks}
                      mode="text"
                      onSave={val => onSavePlan(p.person_email, p.person_name, 'meeting_remarks', val)}
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