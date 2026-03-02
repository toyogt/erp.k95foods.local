import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import KPITable from './KPITable';

const DT_CATEGORIES = ['MECHANICAL', 'MATERIAL', 'QUALITY', 'PLANNING', 'CHANGEOVER', 'MICRO_STOP', 'OTHER'];

function toDateMs(str) { return str ? new Date(str).getTime() : 0; }

export default function LabellingKPITab({ filters }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, [filters]);

  async function load() {
    setLoading(true);

    const fromMs = filters.dateFrom ? new Date(filters.dateFrom).getTime() : 0;
    const toMs   = filters.dateTo   ? new Date(filters.dateTo + 'T23:59:59').getTime() : Date.now();

    // Fetch all relevant data in parallel
    const [sessions, samples, downtimes, rollEvents, reworks, downtimeReasons] = await Promise.all([
      base44.entities.LineSession.filter({}, '-started_at', 200).catch(() => []),
      base44.entities.LineMetricSample.filter({ station_type: 'LABELLING' }, '-captured_at', 500).catch(() => []),
      base44.entities.DowntimeEvent.filter({ station_type: 'LABELLING' }, '-started_at', 300).catch(() => []),
      base44.entities.LabelRollEvent.filter({}, '-created_at', 500).catch(() => []),
      base44.entities.ReworkEvent.filter({}, '-created_at', 500).catch(() => []),
      base44.entities.DowntimeReason.filter({ station_type: 'LABELLING' }).catch(() => []),
    ]);

    // Build reason_code → category map
    const reasonCatMap = {};
    downtimeReasons.forEach(r => { reasonCatMap[r.reason_code] = r.category; });

    // Filter sessions by date + line + operator
    const filteredSessions = sessions.filter(s => {
      const ts = toDateMs(s.started_at);
      if (ts < fromMs || ts > toMs) return false;
      if (filters.line && s.line_machine_id !== filters.line) return false;
      if (filters.operator && !s.started_by?.includes(filters.operator) && !s.ended_by?.includes(filters.operator)) return false;
      return true;
    });

    const result = filteredSessions.map(s => {
      const sessionSamples = samples.filter(m => m.active_session_id === s.session_id || m.wo_id === s.wo_id);

      // Ryan delta (max - min within session)
      const counts = sessionSamples.map(m => m.ryan_count).filter(v => v != null);
      const bottlesDelta = counts.length >= 2 ? Math.max(...counts) - Math.min(...counts) : null;

      // avg bottles/hour from samples
      const bphVals = sessionSamples.map(m => m.bottles_per_hour).filter(v => v != null && v > 0);
      const avgBph = bphVals.length ? Math.round(bphVals.reduce((a, b) => a + b, 0) / bphVals.length) : null;

      // Downtime by category
      const sessionDT = downtimes.filter(d =>
        d.machine_id === s.line_machine_id &&
        d.ended_at && d.started_at &&
        toDateMs(d.started_at) >= toDateMs(s.started_at) &&
        (!s.ended_at || toDateMs(d.ended_at) <= toDateMs(s.ended_at))
      );
      const totalDT = sessionDT.reduce((sum, d) => sum + (d.duration_minutes || 0), 0);
      const dtByCategory = {};
      DT_CATEGORIES.forEach(cat => {
        const mins = sessionDT
          .filter(d => (reasonCatMap[d.reason_code] || 'OTHER') === cat)
          .reduce((sum, d) => sum + (d.duration_minutes || 0), 0);
        if (mins > 0) dtByCategory[cat] = mins.toFixed(1);
      });

      // Roll waste
      const woRollEvents = rollEvents.filter(e =>
        e.wo_id === s.wo_id && ['SETUP_WASTE', 'RUN_WASTE'].includes(e.event_type)
      );
      const rollWasteLabels = woRollEvents.reduce((sum, e) => sum + Math.abs(e.qty_labels || 0), 0);

      // Rework
      const woReworks = reworks.filter(e => e.wo_id === s.wo_id);
      const reworkBottles = woReworks.reduce((sum, e) => sum + (e.qty_bottles || 0), 0);

      // Duration
      const durationMin = s.started_at && s.ended_at
        ? ((toDateMs(s.ended_at) - toDateMs(s.started_at)) / 60000).toFixed(0)
        : s.started_at ? 'Active' : '—';

      return {
        session_id: s.session_id,
        line: s.line_machine_id,
        wo: s.wo_id,
        started_at: s.started_at ? new Date(s.started_at).toLocaleString() : '—',
        operator: s.started_by || '—',
        duration_min: durationMin,
        bottles: bottlesDelta != null ? bottlesDelta.toLocaleString() : '—',
        avg_bph: avgBph != null ? avgBph.toLocaleString() : '—',
        total_dt_min: totalDT > 0 ? totalDT.toFixed(1) : '—',
        dt_detail: Object.entries(dtByCategory).map(([k, v]) => `${k}: ${v}m`).join(', ') || '—',
        roll_waste: rollWasteLabels > 0 ? rollWasteLabels : '—',
        rework_bottles: reworkBottles > 0 ? reworkBottles : '—',
      };
    });

    setRows(result);
    setLoading(false);
  }

  const columns = [
    { key: 'line',        label: 'Line' },
    { key: 'wo',          label: 'WO' },
    { key: 'started_at',  label: 'Started' },
    { key: 'operator',    label: 'Operator' },
    { key: 'duration_min', label: 'Duration (min)' },
    { key: 'bottles',     label: 'Bottles (Ryan Δ)' },
    { key: 'avg_bph',     label: 'Avg bph' },
    { key: 'total_dt_min', label: 'DT (min)' },
    { key: 'dt_detail',   label: 'DT by Category', render: v => <span className="text-xs text-slate-500">{v}</span> },
    { key: 'roll_waste',  label: 'Roll Waste (labels)' },
    { key: 'rework_bottles', label: 'Rework (bottles)' },
  ];

  if (loading) return (
    <div className="flex justify-center py-10">
      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Sessions" value={rows.length} />
        <StatCard label="Total Bottles" value={rows.reduce((s, r) => s + (typeof r.bottles === 'string' && r.bottles !== '—' ? parseInt(r.bottles.replace(',','')) : 0), 0).toLocaleString()} />
        <StatCard label="Total DT (min)" value={rows.reduce((s, r) => s + (r.total_dt_min !== '—' ? parseFloat(r.total_dt_min) : 0), 0).toFixed(0)} />
        <StatCard label="Total Rework" value={rows.reduce((s, r) => s + (r.rework_bottles !== '—' ? Number(r.rework_bottles) : 0), 0)} />
      </div>
      <KPITable columns={columns} rows={rows} emptyMsg="No sessions found for this filter." />
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
    </div>
  );
}