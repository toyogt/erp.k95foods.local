import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, ScrollText } from 'lucide-react';
import moment from 'moment';

const ACTION_COLORS = {
  created: 'text-blue-600 bg-blue-50',
  marked_done: 'text-green-600 bg-green-50',
  verified: 'text-green-700 bg-green-100',
  reopened: 'text-orange-600 bg-orange-50',
  date_change_requested: 'text-amber-600 bg-amber-50',
  date_change_approved: 'text-emerald-600 bg-emerald-50',
  date_change_rejected: 'text-red-600 bg-red-50',
  edited: 'text-slate-600 bg-slate-50',
  cancelled: 'text-slate-500 bg-slate-100',
  overdue_notification_sent: 'text-red-500 bg-red-50',
};

/**
 * Renders log details without duplicating date info.
 * For date_change_requested: shows reason only (dates are in old→new)
 * For date_change_approved: shows "Date change approved" + old→new
 * For others: shows details as-is
 */
function LogDetails({ log }) {
  const hasDateValues = log.old_value && log.new_value;

  if (log.action === 'date_change_requested' && hasDateValues) {
    // Extract reason from details: "Requested date change from X to Y. Reason: Z"
    const reasonMatch = log.details?.match(/Reason:\s*(.+)/i);
    const reason = reasonMatch ? reasonMatch[1] : '';
    return (
      <>
        <span className="text-slate-600">
          Date change requested: {log.old_value} → {log.new_value}
        </span>
        {reason && (
          <span className="block text-slate-500 mt-0.5 italic">Reason: {reason}</span>
        )}
      </>
    );
  }

  if (log.action === 'date_change_approved' && hasDateValues) {
    return (
      <span className="text-slate-600">
        Date change approved: {log.old_value} → {log.new_value}
      </span>
    );
  }

  if (log.action === 'date_change_rejected') {
    return <span className="text-slate-600">Date change request rejected</span>;
  }

  // Default: show details, skip old→new if already embedded in details
  return <span className="text-slate-600">{log.details}</span>;
}

export default function DirectorTaskLogPanel({ taskId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!taskId) return;
    base44.entities.DirectorTaskLog.filter({ task_id: taskId }, '-timestamp', 50)
      .then(setLogs)
      .finally(() => setLoading(false));
  }, [taskId]);

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;
  if (logs.length === 0) return <p className="text-xs text-slate-400 text-center py-4">No activity yet</p>;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5">
        <ScrollText className="w-3.5 h-3.5" /> Activity Log
      </h4>
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {logs.map(log => (
          <div key={log.id} className="flex gap-2 text-xs">
            <div className={`shrink-0 px-1.5 py-0.5 rounded font-medium ${ACTION_COLORS[log.action] || 'text-slate-500 bg-slate-50'}`}>
              {log.action?.replace(/_/g, ' ')}
            </div>
            <div className="flex-1 min-w-0">
              <LogDetails log={log} />
              <span className="text-slate-400 ml-1.5">
                — {log.performed_by_name || 'System'}, {moment(log.timestamp).format('DD/MM/YYYY HH:mm')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}