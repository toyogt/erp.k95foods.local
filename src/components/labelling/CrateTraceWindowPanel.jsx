import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Layers, ChevronUp, ChevronDown } from 'lucide-react';

function timeAgo(isoStr) {
  if (!isoStr) return '—';
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function CrateRow({ crate_id, scanned_at, ryan_count_at_scan, label, highlight }) {
  if (!crate_id) return (
    <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2 opacity-40">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <span className="text-xs text-slate-400 italic">—</span>
    </div>
  );
  return (
    <div className={`flex items-center justify-between rounded-xl px-3 py-2 ${highlight ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50'}`}>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold ${highlight ? 'text-blue-500' : 'text-slate-400'}`}>{label}</span>
        <span className="font-mono text-sm font-bold text-slate-800">{crate_id}</span>
      </div>
      <div className="text-right">
        {scanned_at && <p className="text-xs text-slate-500">{timeAgo(scanned_at)}</p>}
        {ryan_count_at_scan != null && (
          <p className="text-xs text-blue-600 font-medium">Ryan: {ryan_count_at_scan.toLocaleString()}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Props: session, wo_id, line_machine_id, latestTrace (CrateTraceWindow record, updated on each scan)
 */
export default function CrateTraceWindowPanel({ session, wo_id, line_machine_id, latestTrace }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <Layers className="w-4 h-4 text-slate-600" />
        <p className="font-semibold text-slate-800 text-sm">Trace Window (3 crates)</p>
      </div>

      {!latestTrace ? (
        <p className="text-xs text-slate-400 text-center py-2">No crate scans yet this session.</p>
      ) : (
        <div className="space-y-1">
          <div className="flex justify-center">
            <ChevronUp className="w-4 h-4 text-slate-300" />
          </div>
          <CrateRow
            crate_id={latestTrace.window_prev_crate_id}
            scanned_at={null}
            ryan_count_at_scan={null}
            label="PREV"
            highlight={false}
          />
          <CrateRow
            crate_id={latestTrace.crate_id}
            scanned_at={latestTrace.scanned_at}
            ryan_count_at_scan={latestTrace.ryan_count_at_scan}
            label="CURR"
            highlight={true}
          />
          <CrateRow
            crate_id={latestTrace.window_next_crate_id}
            scanned_at={null}
            ryan_count_at_scan={null}
            label="NEXT"
            highlight={false}
          />
          <div className="flex justify-center">
            <ChevronDown className="w-4 h-4 text-slate-300" />
          </div>
        </div>
      )}

      {latestTrace?.buffer_estimate_bottles != null && (
        <p className="text-xs text-slate-400 border-t border-slate-100 pt-2">
          Buffer est: ~{latestTrace.buffer_estimate_bottles} bottles
        </p>
      )}
    </div>
  );
}