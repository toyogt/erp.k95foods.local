import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function OperatorDashboardMobile() {
  const [user, setUser] = useState(null);
  const [myTasks, setMyTasks] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userEmail = new URLSearchParams(window.location.search).get('email');
    Promise.all([
      base44.auth.me(),
      userEmail ? base44.entities.FMSStepInstance.filter({ 
        assignee_email: userEmail, 
        status: ['active', 'pending'] 
      }, '-deadline', 20) : Promise.resolve([]),
      base44.entities.AlertEvent.filter({ status: 'OPEN' }, '-created_date', 10).catch(() => []),
    ]).then(([me, tasksData, alertsData]) => {
      setUser(me);
      setMyTasks(tasksData);
      setAlerts(alertsData);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const urgentTasks = myTasks.filter(t => new Date(t.deadline) < new Date(Date.now() + 4 * 60 * 60 * 1000));

  return (
    <div className="space-y-4 pb-24">
      {/* Welcome */}
      <div className="px-4 pt-4">
        <h1 className="text-2xl font-bold text-slate-900">Hello, {user?.full_name?.split(' ')[0]}</h1>
        <p className="text-sm text-slate-500 mt-1">Today's dashboard</p>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="px-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-red-900 text-sm">{alerts.length} Alert{alerts.length !== 1 ? 's' : ''}</p>
                <p className="text-xs text-red-700 mt-0.5">{alerts[0]?.description || 'Check alerts'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Urgent Tasks */}
      {urgentTasks.length > 0 && (
        <div className="px-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Urgent (Next 4 Hours)</p>
          <div className="space-y-2">
            {urgentTasks.slice(0, 3).map(t => (
              <div key={t.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="font-semibold text-slate-900 text-sm">{t.step_name}</p>
                <p className="text-xs text-slate-600 mt-1">{t.description?.substring(0, 60)}</p>
                <div className="flex items-center gap-1 mt-2 text-xs text-amber-700">
                  <Clock className="w-3 h-3" /> {Math.round((new Date(t.deadline) - new Date()) / 60000)} mins left
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Tasks */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">All Tasks ({myTasks.length})</p>
          {myTasks.length === 0 && <CheckCircle2 className="w-4 h-4 text-green-600" />}
        </div>
        {myTasks.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No active tasks</p>
          </div>
        ) : (
          <div className="space-y-2">
            {myTasks.map(t => (
              <Link
                key={t.id}
                to={`/FMSMyTasks?task=${t.id}`}
                className="block bg-white border border-slate-200 rounded-lg p-3 active:bg-slate-50"
              >
                <p className="font-semibold text-slate-900 text-sm">{t.step_name}</p>
                <p className="text-xs text-slate-500 mt-1">{t.description?.substring(0, 50)}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="px-4 pb-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Quick Access</p>
        <div className="grid grid-cols-2 gap-2">
          <Link to={createPageUrl('FMSMyTasks')} className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center active:bg-blue-100">
            <p className="font-semibold text-blue-900 text-sm">My Tasks</p>
          </Link>
          <Link to={createPageUrl('AlertsPage')} className="bg-red-50 border border-red-200 rounded-lg p-3 text-center active:bg-red-100">
            <p className="font-semibold text-red-900 text-sm">Alerts</p>
          </Link>
        </div>
      </div>
    </div>
  );
}