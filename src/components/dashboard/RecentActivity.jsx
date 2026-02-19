import moment from 'moment';

export default function RecentActivity({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Recent Activity</h3>
        <p className="text-sm text-slate-400">No activity recorded yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5">
      <h3 className="font-semibold text-slate-900 mb-4">Recent Activity</h3>
      <div className="space-y-3">
        {logs.map((log) => (
          <div key={log.id} className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-800 font-medium leading-snug">{log.action}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-500">{log.user_name || log.user_email}</span>
                <span className="text-xs text-slate-300">·</span>
                <span className="text-xs text-slate-400">{moment(log.created_date).fromNow()}</span>
              </div>
            </div>
            {log.entity_type && (
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium flex-shrink-0">
                {log.entity_type}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}