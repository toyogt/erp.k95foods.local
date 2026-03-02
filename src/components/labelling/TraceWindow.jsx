import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Layers } from 'lucide-react';

function timeAgo(isoStr) {
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

/**
 * Props: session, bufferEstimate (number|null)
 */
export default function TraceWindow({ session, bufferEstimate }) {
  const [scans, setScans] = useState([]);

  useEffect(() => {
    if (!session?.session_id) return;
    let cancelled = false;
    async function load() {
      try {
        const rows = await base44.entities.FeederCrateScan.filter(
          { session_id: session.session_id },
          '-scanned_at',
          3
        );
        if (!cancelled) setScans(rows);
      } catch { /* offline */ }
    }
    load();
    const t = setInterval(load, 8000);
    return () => { cancelled = true; clearInterval(t); };
  }, [session?.session_id]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-slate-600" />
        <p className="font-semibold text-slate-800 text-sm">Trace: Last 3 Crates</p>
      </div>

      {scans.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-2">No crate scans yet this session.</p>
      ) : (
        <div className="space-y-2">
          {scans.map((s, i) => (
            <div key={s.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">#{scans.length - i}</span>
                <span className="font-mono text-sm font-bold text-slate-800">{s.crate_id}</span>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">{timeAgo(s.scanned_at)}</p>
                {s.ryan_count_at_scan !== null && s.ryan_count_at_scan !== undefined && (
                  <p className="text-xs text-blue-600 font-medium">Ryan: {s.ryan_count_at_scan.toLocaleString()}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {bufferEstimate !== null && bufferEstimate !== undefined && (
        <p className="text-xs text-slate-400 border-t border-slate-100 pt-2">
          Typical buffer: ~{bufferEstimate} bottles between crate switch and coder
        </p>
      )}
    </div>
  );
}