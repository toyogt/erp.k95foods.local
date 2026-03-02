import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

function fmt(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleString();
}

function TraceRow({ row, highlight }) {
  return (
    <div className={`rounded-xl px-3 py-2 text-sm space-y-0.5 ${highlight ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50'}`}>
      <div className="flex justify-between">
        <span className="font-mono font-bold text-slate-800">{row.crate_id}</span>
        <span className="text-xs text-slate-400">{fmt(row.scanned_at)}</span>
      </div>
      <div className="flex gap-3 text-xs text-slate-500 flex-wrap">
        {row.wo_id && <span>WO: {row.wo_id}</span>}
        {row.line_machine_id && <span>Line: {row.line_machine_id}</span>}
        {row.ryan_count_at_scan != null && <span className="text-blue-600 font-medium">Ryan: {row.ryan_count_at_scan.toLocaleString()}</span>}
        {row.buffer_estimate_bottles != null && <span>Buffer: ~{row.buffer_estimate_bottles}</span>}
      </div>
      <div className="flex gap-2 text-xs">
        {row.window_prev_crate_id && <span className="text-slate-400">← {row.window_prev_crate_id}</span>}
        {row.window_next_crate_id && <span className="text-slate-400">{row.window_next_crate_id} →</span>}
      </div>
    </div>
  );
}

export default function TraceSearchPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSearch() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    setResults(null);
    try {
      // Try crate_id match first
      const byId = await base44.entities.CrateTraceWindow.filter({ crate_id: q }, '-scanned_at', 10);

      if (byId.length > 0) {
        // Also fetch prev/next neighbours
        const ids = new Set();
        byId.forEach(r => {
          if (r.window_prev_crate_id) ids.add(r.window_prev_crate_id);
          if (r.window_next_crate_id) ids.add(r.window_next_crate_id);
        });
        let neighbours = [];
        for (const nid of ids) {
          const rows = await base44.entities.CrateTraceWindow.filter({ crate_id: nid }, '-scanned_at', 5);
          neighbours = neighbours.concat(rows);
        }
        // Merge + dedupe by trace_id, sort by scanned_at
        const all = [...byId, ...neighbours];
        const seen = new Set();
        const deduped = all.filter(r => { if (seen.has(r.trace_id)) return false; seen.add(r.trace_id); return true; });
        deduped.sort((a, b) => new Date(b.scanned_at) - new Date(a.scanned_at));
        setResults({ rows: deduped, matchIds: new Set(byId.map(r => r.trace_id)), searchType: 'crate_id' });
        setLoading(false);
        return;
      }

      // Try Ryan count match (numeric)
      const ryanNum = parseFloat(q);
      if (!isNaN(ryanNum)) {
        const all = await base44.entities.CrateTraceWindow.list('-scanned_at', 500);
        const nearby = all.filter(r => r.ryan_count_at_scan != null && Math.abs(r.ryan_count_at_scan - ryanNum) <= 500);
        nearby.sort((a, b) => Math.abs(a.ryan_count_at_scan - ryanNum) - Math.abs(b.ryan_count_at_scan - ryanNum));
        setResults({ rows: nearby.slice(0, 10), matchIds: new Set(), searchType: 'ryan' });
        setLoading(false);
        return;
      }

      setResults({ rows: [], matchIds: new Set(), searchType: 'none' });
    } catch (e) {
      setError('Search failed: ' + e.message);
    }
    setLoading(false);
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      <p className="font-semibold text-slate-800 text-sm flex items-center gap-2">
        <Search className="w-4 h-4" /> Trace Search
      </p>
      <p className="text-xs text-slate-400">Search by Crate ID or Ryan counter value (±500). Shows 3-crate window context.</p>
      <div className="flex gap-2">
        <input
          className="flex-1 h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:border-blue-500"
          placeholder="Crate ID or Ryan count…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <Button size="sm" onClick={handleSearch} disabled={loading || !query.trim()}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {results && (
        results.rows.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-2">No results found.</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {results.searchType === 'ryan' && (
              <p className="text-xs text-amber-600 font-medium">Nearest Ryan count matches (investigation only, not exact mapping)</p>
            )}
            {results.rows.map(row => (
              <TraceRow key={row.trace_id} row={row} highlight={results.matchIds.has(row.trace_id)} />
            ))}
          </div>
        )
      )}
    </div>
  );
}