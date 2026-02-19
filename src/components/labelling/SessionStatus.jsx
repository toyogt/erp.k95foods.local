import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

const STATE_STYLES = {
  SETUP: 'bg-slate-100 text-slate-700',
  READY: 'bg-blue-100 text-blue-800',
  RUNNING: 'bg-emerald-100 text-emerald-800',
  SOFT_STOP: 'bg-amber-100 text-amber-800',
  HARD_STOP: 'bg-red-100 text-red-800',
  COMPLETED: 'bg-purple-100 text-purple-800',
};

export default function SessionStatus({ session, wo }) {
  if (!session) return null;
  const pct = wo?.target_bottles > 0 ? Math.min(100, Math.round((session.bottles_counted / wo.target_bottles) * 100)) : 0;
  const stateStyle = STATE_STYLES[session.state] || STATE_STYLES.SETUP;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Session</p>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${stateStyle}`}>{session.state}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xl font-bold text-slate-900">{session.crates_used}</p>
          <p className="text-xs text-slate-500">Crates</p>
        </div>
        <div>
          <p className="text-xl font-bold text-slate-900">{session.bottles_counted}</p>
          <p className="text-xs text-slate-500">Bottles</p>
        </div>
        <div>
          <p className="text-xl font-bold text-slate-900">{session.cases_counted}</p>
          <p className="text-xs text-slate-500">Cases</p>
        </div>
      </div>
      {wo?.target_bottles > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Progress</span>
            <span>{pct}% of {wo.target_bottles} bottles</span>
          </div>
          <Progress value={pct} className="h-2 rounded-full" />
        </div>
      )}
      {session.reason && (
        <p className="text-sm text-amber-700 bg-amber-50 rounded-xl p-3">{session.reason}</p>
      )}
    </div>
  );
}