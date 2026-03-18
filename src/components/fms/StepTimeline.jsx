import { CheckCircle2, Circle, Clock, AlertCircle, SkipForward } from 'lucide-react';
import { formatDateTime, getTATBadgeClass } from '@/lib/fmsHelpers';

const STATUS_CONFIG = {
  pending:   { icon: Circle,        color: 'text-slate-400', bg: 'bg-slate-100', label: 'Pending' },
  active:    { icon: Clock,         color: 'text-blue-500',  bg: 'bg-blue-50',   label: 'In Progress' },
  completed: { icon: CheckCircle2,  color: 'text-green-500', bg: 'bg-green-50',  label: 'Completed' },
  skipped:   { icon: SkipForward,   color: 'text-slate-400', bg: 'bg-slate-50',  label: 'Skipped' },
  escalated: { icon: AlertCircle,   color: 'text-orange-500',bg: 'bg-orange-50', label: 'Escalated' },
};

export default function StepTimeline({ steps }) {
  if (!steps || steps.length === 0) return <p className="text-slate-400 text-sm">No steps yet.</p>;

  const sorted = [...steps].sort((a, b) => a.step_order - b.step_order);

  return (
    <div className="relative">
      {sorted.map((step, idx) => {
        const cfg = STATUS_CONFIG[step.status] || STATUS_CONFIG.pending;
        const Icon = cfg.icon;
        const isLast = idx === sorted.length - 1;

        return (
          <div key={step.id} className="flex gap-4">
            {/* Line + icon */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${cfg.bg} shrink-0`}>
                <Icon className={`w-4 h-4 ${cfg.color}`} />
              </div>
              {!isLast && <div className="w-0.5 flex-1 bg-slate-200 my-1" />}
            </div>

            {/* Content */}
            <div className={`pb-5 flex-1 ${isLast ? '' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">
                    {step.step_order}. {step.step_name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{step.assignee_name || step.assignee_email}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  {step.status === 'active' && step.deadline && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getTATBadgeClass(step.deadline)}`}>
                      due {new Date(step.deadline).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
              {step.description && (
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{step.description}</p>
              )}
              {step.status === 'completed' && step.completed_at && (
                <p className="text-xs text-green-600 mt-1">
                  ✓ Completed by {step.completed_by || step.assignee_email} at {formatDateTime(step.completed_at)}
                  {step.completion_note && <span className="text-slate-500"> — "{step.completion_note}"</span>}
                </p>
              )}
              {step.reassigned_from && (
                <p className="text-xs text-orange-500 mt-1">↩ Reassigned from {step.reassigned_from}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}