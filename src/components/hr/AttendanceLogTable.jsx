import { Badge } from '@/components/ui/badge';
import { Loader2, Inbox } from 'lucide-react';
import { formatIstDate, formatIstTime, formatIstDateTime } from '@/lib/istFormatter';

export default function AttendanceLogTable({ logs, isLoading }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!logs?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <Inbox className="w-10 h-10 mb-2 text-slate-300" />
        <div className="text-sm">No attendance logs yet</div>
        <div className="text-xs text-slate-400 mt-1">Punches from the biometric device will appear here</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-slate-700">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Employee Code</th>
            <th className="px-3 py-2 text-left font-medium">Name</th>
            <th className="px-3 py-2 text-left font-medium">Date</th>
            <th className="px-3 py-2 text-left font-medium">Time</th>
            <th className="px-3 py-2 text-left font-medium">Direction</th>
            <th className="px-3 py-2 text-left font-medium">Device</th>
            <th className="px-3 py-2 text-left font-medium">Received</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 font-mono text-slate-900">{log.employee_code}</td>
              <td className="px-3 py-2 text-slate-700">{log.employee_name || '—'}</td>
              <td className="px-3 py-2 text-slate-700">{log.log_datetime ? formatIstDate(log.log_datetime) : (log.log_date || '—')}</td>
              <td className="px-3 py-2 font-mono text-slate-700">{log.log_datetime ? formatIstTime(log.log_datetime) : (log.log_time || '—')}</td>
              <td className="px-3 py-2">
                {log.punch_direction ? (
                  <Badge className={log.punch_direction.toUpperCase().includes('IN') ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                    {log.punch_direction}
                  </Badge>
                ) : <span className="text-slate-400">—</span>}
              </td>
              <td className="px-3 py-2 text-slate-600">
                <div className="text-xs">{log.device_name || log.device_sn || '—'}</div>
                {log.device_sn && log.device_name && (
                  <div className="text-xs text-slate-400 font-mono">{log.device_sn}</div>
                )}
              </td>
              <td className="px-3 py-2 text-xs text-slate-500">
                {formatIstDateTime(log.downloaded_at || log.created_date)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}