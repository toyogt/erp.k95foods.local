import { Loader2 } from 'lucide-react';
import { formatIstDateTime } from '@/lib/istFormatter';

const STATUS_STYLES = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-600',
};

const TYPE_STYLES = {
  add: 'bg-blue-100 text-blue-700',
  edit: 'bg-purple-100 text-purple-700',
  delete: 'bg-red-100 text-red-700',
};

export default function PunchRequestList({ requests, isLoading, renderActions }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return <div className="text-center py-8 text-slate-500 text-sm">No requests found.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-100 text-slate-700">
            <th className="text-left px-3 py-2 font-medium">Type</th>
            <th className="text-left px-3 py-2 font-medium">Employee</th>
            <th className="text-left px-3 py-2 font-medium">Punch Time (IST)</th>
            <th className="text-left px-3 py-2 font-medium">Direction</th>
            <th className="text-left px-3 py-2 font-medium">Reason</th>
            <th className="text-left px-3 py-2 font-medium">Requested By</th>
            <th className="text-left px-3 py-2 font-medium">Status</th>
            {renderActions && <th className="text-right px-3 py-2 font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {requests.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-3 py-2">
                <span className={`text-xs px-2 py-0.5 rounded uppercase ${TYPE_STYLES[r.request_type] || 'bg-slate-100 text-slate-600'}`}>
                  {r.request_type}
                </span>
              </td>
              <td className="px-3 py-2">
                <div className="font-medium text-slate-900">{r.employee_code}</div>
                {r.employee_name && <div className="text-xs text-slate-500">{r.employee_name}</div>}
              </td>
              <td className="px-3 py-2 text-slate-700">{r.log_datetime ? formatIstDateTime(r.log_datetime) : '—'}</td>
              <td className="px-3 py-2 text-slate-600">{r.punch_direction || '—'}</td>
              <td className="px-3 py-2 text-slate-600 max-w-xs truncate" title={r.reason}>{r.reason}</td>
              <td className="px-3 py-2 text-xs text-slate-500">
                <div>{r.requested_by}</div>
                <div>{r.requested_at ? formatIstDateTime(r.requested_at) : ''}</div>
              </td>
              <td className="px-3 py-2">
                <span className={`text-xs px-2 py-0.5 rounded ${STATUS_STYLES[r.status] || 'bg-slate-100 text-slate-600'}`}>
                  {r.status}
                </span>
                {r.review_remarks && (
                  <div className="text-xs text-slate-500 mt-1 max-w-xs truncate" title={r.review_remarks}>
                    {r.review_remarks}
                  </div>
                )}
              </td>
              {renderActions && (
                <td className="px-3 py-2 text-right">{renderActions(r)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}