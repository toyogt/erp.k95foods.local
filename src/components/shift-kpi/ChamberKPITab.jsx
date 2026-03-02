import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, AlertTriangle } from 'lucide-react';
import KPITable from './KPITable';

const CHAMBERS = ['CHAMBER-1', 'CHAMBER-2'];

function minsBetween(a, b) {
  if (!a || !b) return null;
  return (new Date(b) - new Date(a)) / 60000;
}

function fmt(mins) {
  if (mins == null) return '—';
  return `${Math.round(mins)}m`;
}

export default function ChamberKPITab({ filters }) {
  const [rows, setRows] = useState([]);       // per-cycle rows
  const [opRows, setOpRows] = useState([]);   // late-checks-by-operator
  const [statsByMachine, setStatsByMachine] = useState({}); // machine → stats
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, [filters]);

  async function load() {
    setLoading(true);
    const fromMs = filters.dateFrom ? new Date(filters.dateFrom).getTime() : 0;
    const toMs   = filters.dateTo   ? new Date(filters.dateTo + 'T23:59:59').getTime() : Date.now();

    const [cycles, checks, downtimes] = await Promise.all([
      base44.entities.ChamberCycle.filter({}, '-started_at', 200).catch(() => []),
      base44.entities.ChamberCycleCheck.filter({}, '-due_at', 500).catch(() => []),
      base44.entities.DowntimeEvent.filter({ station_type: 'CHAMBER' }, '-started_at', 200).catch(() => []),
    ]);

    // Filter cycles by date + operator
    const filteredCycles = cycles.filter(c => {
      const ts = c.started_at ? new Date(c.started_at).getTime() : 0;
      if (ts < fromMs || ts > toMs) return false;
      if (filters.operator && !c.started_by?.includes(filters.operator)) return false;
      return true;
    });

    // Build cycle rows
    const cycleRows = filteredCycles.slice(0, 20).map(c => {
      const durationMin = minsBetween(c.started_at, c.ended_at || new Date().toISOString());

      // Checks for this cycle
      const cycleChecks = checks.filter(ch => ch.cycle_id === c.cycle_id);
      const totalChecks = cycleChecks.length;
      const lateChecks = cycleChecks.filter(ch => {
        if (!ch.due_at || !ch.completed_at) return false;
        return minsBetween(ch.due_at, ch.completed_at) > 5;
      }).length;
      const missedChecks = cycleChecks.filter(ch => !ch.completed_at).length;

      // Photo compliance — checks that have checklist_run_id (proxy for photo done)
      const photoChecks = cycleChecks.filter(ch => ch.checklist_run_id);
      const photoCompliancePct = totalChecks > 0
        ? Math.round((photoChecks.length / totalChecks) * 100)
        : null;

      // Downtime during cycle
      const cycleDT = downtimes.filter(d =>
        d.machine_id === c.chamber_machine_id &&
        d.ended_at &&
        d.started_at &&
        new Date(d.started_at) >= new Date(c.started_at) &&
        (!c.ended_at || new Date(d.ended_at) <= new Date(c.ended_at))
      );
      const dtMin = cycleDT.reduce((s, d) => s + (d.duration_minutes || 0), 0);

      return {
        cycle_id: c.cycle_id,
        machine: c.chamber_machine_id,
        pallet: c.pallet_id,
        status: c.status,
        started_at: c.started_at ? new Date(c.started_at).toLocaleString() : '—',
        operator: c.started_by || '—',
        duration: durationMin != null ? fmt(durationMin) : '—',
        total_checks: totalChecks,
        late_checks: lateChecks,
        missed_checks: missedChecks,
        photo_pct: photoCompliancePct != null ? `${photoCompliancePct}%` : '—',
        dt_min: dtMin > 0 ? dtMin.toFixed(1) : '—',
      };
    });

    // Late checks by operator
    const opMap = {};
    checks.forEach(ch => {
      if (!ch.completed_at || !ch.due_at) return;
      // Only checks belonging to filtered cycles
      const cycle = filteredCycles.find(c => c.cycle_id === ch.cycle_id);
      if (!cycle) return;
      const op = ch.completed_by || cycle.started_by || 'Unknown';
      if (!opMap[op]) opMap[op] = { operator: op, total: 0, late: 0 };
      opMap[op].total++;
      if (minsBetween(ch.due_at, ch.completed_at) > 5) opMap[op].late++;
    });
    const opTableRows = Object.values(opMap).map(o => ({
      ...o,
      late_pct: o.total > 0 ? `${Math.round((o.late / o.total) * 100)}%` : '—',
    })).sort((a, b) => b.late - a.late);

    // Stats per machine
    const stats = {};
    CHAMBERS.forEach(m => {
      const mCycles = filteredCycles.filter(c => c.chamber_machine_id === m);
      const completed = mCycles.filter(c => c.status === 'COMPLETED');
      const aborted   = mCycles.filter(c => c.status === 'ABORTED');
      const durations = completed.map(c => minsBetween(c.started_at, c.ended_at)).filter(v => v != null);
      const avgDur = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
      stats[m] = {
        total: mCycles.length,
        completed: completed.length,
        aborted: aborted.length,
        avg_duration: avgDur,
      };
    });

    setRows(cycleRows);
    setOpRows(opTableRows);
    setStatsByMachine(stats);
    setLoading(false);
  }

  const cycleColumns = [
    { key: 'machine',      label: 'Chamber' },
    { key: 'pallet',       label: 'Pallet' },
    { key: 'started_at',   label: 'Started' },
    { key: 'operator',     label: 'Operator' },
    { key: 'status',       label: 'Status', render: v => (
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
        v === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
        v === 'ABORTED'   ? 'bg-red-100 text-red-700' :
        'bg-blue-100 text-blue-700'
      }`}>{v}</span>
    )},
    { key: 'duration',     label: 'Duration' },
    { key: 'dt_min',       label: 'DT (min)' },
    { key: 'total_checks', label: 'Checks' },
    { key: 'late_checks',  label: 'Late (>5m)', render: v => (
      <span className={v > 0 ? 'text-amber-600 font-bold' : 'text-slate-500'}>{v}</span>
    )},
    { key: 'missed_checks', label: 'Missed', render: v => (
      <span className={v > 0 ? 'text-red-600 font-bold' : 'text-slate-500'}>{v}</span>
    )},
    { key: 'photo_pct',    label: 'Photo %' },
  ];

  const opColumns = [
    { key: 'operator', label: 'Operator' },
    { key: 'total',    label: 'Total Checks' },
    { key: 'late',     label: 'Late (>5m)', render: v => (
      <span className={v > 0 ? 'text-amber-600 font-bold' : ''}>{v}</span>
    )},
    { key: 'late_pct', label: 'Late %' },
  ];

  if (loading) return (
    <div className="flex justify-center py-10">
      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Per-machine stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CHAMBERS.map(m => {
          const s = statsByMachine[m] || {};
          return (
            <div key={m} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
              <p className="font-bold text-slate-800 text-sm">{m}</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <MiniStat label="Cycles" value={s.total ?? '—'} />
                <MiniStat label="Completed" value={s.completed ?? '—'} color="text-emerald-600" />
                <MiniStat label="Aborted" value={s.aborted ?? '—'} color={s.aborted > 0 ? 'text-red-600' : undefined} />
                <MiniStat label="Avg Dur" value={s.avg_duration != null ? fmt(s.avg_duration) : '—'} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Cycle table (last 20 filtered) */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-700">Cycle List (last 20)</p>
        <KPITable columns={cycleColumns} rows={rows} emptyMsg="No cycles found for this filter." />
      </div>

      {/* Late checks by operator */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-700">Late Checks by Operator</p>
        <KPITable columns={opColumns} rows={opRows} emptyMsg="No check data found." />
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div>
      <p className={`text-lg font-bold ${color || 'text-slate-900'}`}>{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}