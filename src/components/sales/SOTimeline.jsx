import { Clock } from 'lucide-react';

export default function SOTimeline({ logs }) {
  if (!logs.length) return (
    <div className="text-center py-8 text-slate-400 text-sm">No activity recorded yet.</div>
  );

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-900">Activity Timeline</h3>
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
        <div className="space-y-4">
          {logs.map(log => (
            <div key={log.id} className="flex items-start gap-4 relative">
              <div className="w-8 h-8 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center z-10 flex-shrink-0">
                <Clock className="w-3 h-3 text-slate-400" />
              </div>
              <div className="flex-1 bg-white border border-slate-100 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate-800 capitalize">{log.action?.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-slate-400">
                    {log.created_date ? new Date(log.created_date).toLocaleString('en-IN') : ''}
                  </span>
                </div>
                {log.field_name && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {log.field_name}: <span className="line-through text-red-400">{log.old_value}</span>
                    {' → '}<span className="text-green-600 font-medium">{log.new_value}</span>
                  </p>
                )}
                {!log.field_name && log.new_value && (
                  <p className="text-xs text-slate-500 mt-0.5">{log.new_value}</p>
                )}
                {log.notes && <p className="text-xs text-slate-500 mt-0.5 italic">{log.notes}</p>}
                <p className="text-xs text-slate-400 mt-1">{log.user_email}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}