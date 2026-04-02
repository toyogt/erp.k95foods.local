function fmtDate(d) {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  if (diffWeeks < 8) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
  return fmtDate(dateStr.split('T')[0]);
}

function buildDescription(log) {
  const action = log.action?.replace(/_/g, ' ');
  if (log.field_name && log.old_value && log.new_value) {
    return (
      <span>
        changed the value of <strong>{log.field_name}</strong> from{' '}
        <span className="text-red-500 line-through">{log.old_value}</span>{' → '}
        <span className="text-green-600 font-semibold">{log.new_value}</span>
      </span>
    );
  }
  if (log.action === 'status_change' && log.new_value) {
    return (
      <span>
        <strong>{log.new_value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</strong>
      </span>
    );
  }
  if (log.notes) {
    return <span>{action} — {log.notes}</span>;
  }
  return <span className="capitalize">{action}</span>;
}

export default function SOActivityTimeline({ auditLogs = [] }) {
  if (auditLogs.length === 0) {
    return <p className="text-sm text-slate-400 py-4 text-center">No activity recorded.</p>;
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-3 top-3 bottom-3 w-px bg-slate-200" />

      <div className="space-y-0">
        {auditLogs.map((log, idx) => {
          const userName = log.user_email?.split('@')[0] || 'System';
          const isStatusChange = log.action === 'status_change';
          const isCreated = log.action === 'created' || log.action === 'create';

          return (
            <div key={log.id || idx} className="relative flex gap-3 pl-1 py-2.5 group">
              {/* Dot */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 ${
                isStatusChange ? 'bg-blue-100' : isCreated ? 'bg-green-100' : 'bg-slate-100'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  isStatusChange ? 'bg-blue-500' : isCreated ? 'bg-green-500' : 'bg-slate-400'
                }`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 leading-relaxed">
                  <strong className="text-slate-900">{userName}</strong>{' '}
                  {buildDescription(log)}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {timeAgo(log.created_date)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}