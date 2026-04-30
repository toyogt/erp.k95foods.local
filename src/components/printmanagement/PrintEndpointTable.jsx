import { Loader2, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

function ageLabel(iso) {
  if (!iso) return '—';
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return '—';
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3_600_000)}h ago`;
}

export default function PrintEndpointTable({ rows, loading, onRefresh }) {
  // Dedupe by workstation_id — keep best row (probe ok + has printer wins).
  const score = (r) => (r.probe_ok ? 2 : 0) + (r.printer_name ? 1 : 0);
  const byWid = new Map();
  for (const r of rows || []) {
    const key = r.workstation_id || r.display_name || Math.random();
    const prev = byWid.get(key);
    if (!prev || score(r) > score(prev)) byWid.set(key, r);
  }
  const uniqueRows = Array.from(byWid.values());
  return (
    <div className="bg-white border border-slate-200 rounded-xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Live Endpoints</h3>
          <p className="text-xs text-slate-500">Active workstations, agents, and printers from the latest discovery probe</p>
        </div>
        <Button variant="outline" size="sm" className="h-9 gap-2 text-sm" onClick={onRefresh} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Workstation</th>
              <th className="text-left px-4 py-2 font-medium">Base URL</th>
              <th className="text-left px-4 py-2 font-medium">Printer</th>
              <th className="text-left px-4 py-2 font-medium">Size</th>
              <th className="text-left px-4 py-2 font-medium">Heartbeat</th>
              <th className="text-left px-4 py-2 font-medium">Probe</th>
              <th className="text-left px-4 py-2 font-medium">Latency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {uniqueRows.length === 0 && !loading && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No endpoints available. Configure workstations and probe to populate.</td></tr>
            )}
            {uniqueRows.map((r, i) => (
              <tr key={r.workstation_id || i} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-900">
                  <div className="font-medium">{r.display_name || r.workstation_id}</div>
                </td>
                <td className="px-4 py-2 text-slate-600 font-mono text-xs">{r.base_url || '—'}</td>
                <td className="px-4 py-2 text-slate-700">{r.printer_name || <span className="text-slate-400">none</span>}</td>
                <td className="px-4 py-2 text-slate-700">{r.size_code || '—'}</td>
                <td className="px-4 py-2 text-slate-600 text-xs">
                  <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {ageLabel(r.heartbeat)}</span>
                </td>
                <td className="px-4 py-2">
                  {r.probe_ok ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> OK
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full" title={r.probe_error || ''}>
                      <XCircle className="w-3 h-3" /> Failed
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-600 text-xs">{r.probe_latency_ms != null ? `${r.probe_latency_ms} ms` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}