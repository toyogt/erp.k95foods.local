import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, XCircle, WifiOff, Clock } from 'lucide-react';

function statusIcon(status) {
  if (status === 'success') return <CheckCircle2 className="w-4 h-4 text-green-600" />;
  if (status === 'network_error') return <WifiOff className="w-4 h-4 text-orange-500" />;
  return <XCircle className="w-4 h-4 text-red-500" />;
}

function statusBadge(status) {
  if (status === 'success') return 'bg-green-100 text-green-700';
  if (status === 'network_error') return 'bg-orange-100 text-orange-700';
  return 'bg-red-100 text-red-700';
}

function statusLabel(status) {
  if (status === 'success') return 'Success';
  if (status === 'network_error') return 'Network Error';
  return 'Error';
}

function formatDt(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

export default function TallyPushLogViewer({ invoiceId }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['tally-push-log', invoiceId],
    queryFn: () => base44.entities.TallyPushLog.filter({ invoice_id: invoiceId }, '-pushed_at', 20),
    enabled: !!invoiceId,
    refetchInterval: 10000,
  });

  if (isLoading) return <p className="text-xs text-slate-400 py-2">Loading push history...</p>;
  if (logs.length === 0) return <p className="text-xs text-slate-400 py-2">No push attempts recorded yet.</p>;

  return (
    <div className="space-y-2 mt-2">
      {logs.map(log => (
        <div key={log.id} className="border border-slate-200 rounded-lg p-3 text-xs space-y-1">
          <div className="flex items-center gap-2">
            {statusIcon(log.status)}
            <span className={`px-2 py-0.5 rounded-full font-semibold ${statusBadge(log.status)}`}>
              {statusLabel(log.status)}
            </span>
            <span className="text-slate-400 flex items-center gap-1 ml-auto">
              <Clock className="w-3 h-3" /> {formatDt(log.pushed_at)}
            </span>
          </div>

          {log.status === 'success' && log.tally_voucher_no && (
            <p className="text-green-700">Tally Voucher: <span className="font-semibold">{log.tally_voucher_no}</span></p>
          )}
          {log.error_message && (
            <p className="text-red-600 bg-red-50 rounded p-1.5">{log.error_message}</p>
          )}
          {log.pushed_by && (
            <p className="text-slate-400">Pushed by: {log.pushed_by}</p>
          )}
          {log.tally_response_preview && (
            <details className="mt-1">
              <summary className="cursor-pointer text-slate-400 hover:text-slate-600">View Tally response</summary>
              <pre className="mt-1 text-xs bg-slate-50 p-2 rounded overflow-x-auto max-h-32 whitespace-pre-wrap break-all border border-slate-200">
                {log.tally_response_preview}
              </pre>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}