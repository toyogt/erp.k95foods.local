import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ClipboardList, ChevronRight, Loader2 } from 'lucide-react';
import { getTATStatus } from '@/lib/fmsHelpers';

export default function MyTasksWidget({ user }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) return;
    base44.entities.FMSStepInstance
      .filter({ assignee_email: user.email, status: 'active' }, '-deadline', 20)
      .then(steps => { setTasks(steps); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

  const overdue = tasks.filter(t => getTATStatus(t.deadline) === 'overdue').length;
  const atRisk  = tasks.filter(t => getTATStatus(t.deadline) === 'at_risk').length;
  const onTime  = tasks.filter(t => getTATStatus(t.deadline) === 'on_time').length;

  if (!loading && tasks.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-blue-600" />
          <span className="font-semibold text-sm text-slate-800">My Tasks</span>
          {tasks.length > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{tasks.length}</span>
          )}
        </div>
        <Link to={createPageUrl('FMSMyTasks')} className="text-xs text-blue-600 font-medium flex items-center gap-0.5 hover:underline">
          View all <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
        </div>
      ) : (
        <div className="grid grid-cols-3 divide-x divide-slate-100">
          <div className="py-3 text-center">
            <p className={`text-2xl font-bold ${overdue > 0 ? 'text-red-600' : 'text-slate-300'}`}>{overdue}</p>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Overdue</p>
          </div>
          <div className="py-3 text-center">
            <p className={`text-2xl font-bold ${atRisk > 0 ? 'text-yellow-600' : 'text-slate-300'}`}>{atRisk}</p>
            <p className="text-xs text-slate-400 font-medium mt-0.5">At Risk</p>
          </div>
          <div className="py-3 text-center">
            <p className={`text-2xl font-bold ${onTime > 0 ? 'text-green-600' : 'text-slate-300'}`}>{onTime}</p>
            <p className="text-xs text-slate-400 font-medium mt-0.5">On Track</p>
          </div>
        </div>
      )}
    </div>
  );
}