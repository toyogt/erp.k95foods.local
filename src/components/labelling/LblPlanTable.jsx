import { Link } from 'react-router-dom';
import { PLAN_STATUSES } from '@/lib/labellingHelpers';
import { ChevronRight, Loader2 } from 'lucide-react';

export default function LblPlanTable({ plans, isLoading }) {
  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }
  if (plans.length === 0) {
    return <div className="text-center py-12 bg-white border border-slate-200 rounded-lg"><p className="text-slate-500">No plans found</p></div>;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="text-left px-4 py-3 font-medium">Plan ID</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Shift</th>
              <th className="text-left px-4 py-3 font-medium">Line</th>
              <th className="text-left px-4 py-3 font-medium">Supervisor</th>
              <th className="text-left px-4 py-3 font-medium">Jobs</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {plans.map(p => {
              const st = PLAN_STATUSES[p.status] || PLAN_STATUSES.draft;
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-sm font-medium">{p.plan_id}</td>
                  <td className="px-4 py-3">{p.plan_date}</td>
                  <td className="px-4 py-3 capitalize">{p.shift_type} Shift</td>
                  <td className="px-4 py-3">{p.line_name || p.line_id}</td>
                  <td className="px-4 py-3">{p.supervisor_name || '—'}</td>
                  <td className="px-4 py-3">{p.completed_jobs || 0}/{p.total_jobs || 0}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span></td>
                  <td className="px-4 py-3">
                    <Link to={`/LblPlanDetail?planId=${p.id}`} className="text-slate-400 hover:text-slate-700"><ChevronRight className="w-4 h-4" /></Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="md:hidden divide-y divide-slate-100">
        {plans.map(p => {
          const st = PLAN_STATUSES[p.status] || PLAN_STATUSES.draft;
          return (
            <Link key={p.id} to={`/LblPlanDetail?planId=${p.id}`} className="block p-4 hover:bg-slate-50">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-sm font-semibold text-slate-900">{p.plan_id}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
              </div>
              <p className="text-sm text-slate-600">{p.plan_date} · {p.shift_type} Shift</p>
              <p className="text-sm text-slate-500">{p.line_name} · {p.completed_jobs || 0}/{p.total_jobs || 0} jobs</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}