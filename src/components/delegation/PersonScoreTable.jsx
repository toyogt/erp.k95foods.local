import { ChevronRight } from 'lucide-react';

const HEALTH_BADGE = {
  Good: 'bg-green-100 text-green-700',
  'Needs Follow-up': 'bg-yellow-100 text-yellow-700',
  Critical: 'bg-red-100 text-red-700',
};

export default function PersonScoreTable({ persons, onSelectPerson }) {
  if (persons.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400 text-sm">No scoring data for the selected period</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="text-left px-4 py-3 font-medium">Person</th>
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
              <th className="text-center px-3 py-3 font-medium whitespace-nowrap">Date Change</th>
              <th className="text-center px-3 py-3 font-medium whitespace-nowrap">Week Shift</th>
              <th className="text-center px-3 py-3 font-medium whitespace-nowrap">Unmanaged Overdue</th>
              <th className="text-center px-3 py-3 font-medium">Health</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {persons.map(p => (
              <tr
                key={p.person_email}
                className="hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => onSelectPerson(p)}
              >
                <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{p.person_name}</td>
                <td className="text-center px-3 py-3 font-semibold text-slate-900">{p.total}</td>
                <td className="text-center px-3 py-3 font-semibold text-green-700">{p.green}</td>
                <td className="text-center px-3 py-3 font-semibold text-yellow-600">{p.yellow}</td>
                <td className="text-center px-3 py-3 font-semibold text-red-600">{p.red}</td>
                <td className="text-center px-3 py-3 text-green-600">{p.green_pct}%</td>
                <td className="text-center px-3 py-3 text-yellow-600">{p.yellow_pct}%</td>
                <td className="text-center px-3 py-3 text-red-600 font-semibold">{p.red_pct}%</td>
                <td className="text-center px-3 py-3">{p.date_change_requested}</td>
                <td className="text-center px-3 py-3">{p.week_shifted}</td>
                <td className="text-center px-3 py-3">{p.unmanaged_overdue}</td>
                <td className="text-center px-3 py-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${HEALTH_BADGE[p.person_health] || 'bg-slate-100 text-slate-500'}`}>
                    {p.person_health}
                  </span>
                </td>
                <td className="px-2 py-3">
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}