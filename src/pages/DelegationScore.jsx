import { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Download, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import moment from 'moment';

import {
  buildScoringCycles,
  cycleMatchesRange,
  aggregateByPerson,
  computeKPIs,
} from '@/lib/delegationScoreEngine';

import ScoreKPICards from '@/components/delegation/ScoreKPICards';
import PersonScoreTable from '@/components/delegation/PersonScoreTable';
import TaskDrilldownModal from '@/components/delegation/TaskDrilldownModal';
import ScoreWeekSelector from '@/components/delegation/ScoreWeekSelector';

export default function DelegationScore() {
  const [loading, setLoading] = useState(true);
  const [allCycles, setAllCycles] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [personFilter, setPersonFilter] = useState('all');
  const [selectedPerson, setSelectedPerson] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);

    // Fetch all non-cancelled tasks and all logs
    const [tasks, logs] = await Promise.all([
      base44.entities.DirectorTask.list('-created_date', 500),
      base44.entities.DirectorTaskLog.list('-timestamp', 5000),
    ]);

    // Group logs by task_id
    const logsByTask = {};
    for (const log of logs) {
      const tid = log.task_id;
      if (!logsByTask[tid]) logsByTask[tid] = [];
      logsByTask[tid].push(log);
    }
    // Sort each group by timestamp ASC
    for (const tid of Object.keys(logsByTask)) {
      logsByTask[tid].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    const today = moment().startOf('day');
    const cycles = [];

    for (const task of tasks) {
      if (task.status === 'cancelled') continue;
      const taskLogs = logsByTask[task.id] || [];
      const taskCycles = buildScoringCycles(task, taskLogs, today);
      cycles.push(...taskCycles);
    }

    setAllCycles(cycles);

    // Build unique assignee list
    const aMap = new Map();
    for (const task of tasks) {
      if (task.assigned_to_email && !aMap.has(task.assigned_to_email)) {
        aMap.set(task.assigned_to_email, {
          email: task.assigned_to_email,
          name: task.assigned_to_name || task.assigned_to_email,
        });
      }
    }
    setAssignees(Array.from(aMap.values()).sort((a, b) => (a.name || '').localeCompare(b.name || '')));

    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Compute week range
  const weekRange = useMemo(() => {
    const start = moment().startOf('isoWeek').add(weekOffset, 'weeks');
    const end = start.clone().endOf('isoWeek');
    return { start, end };
  }, [weekOffset]);

  // Filter cycles by week range and person
  const filteredCycles = useMemo(() => {
    return allCycles.filter(c => {
      if (personFilter !== 'all' && c.assigned_to_email !== personFilter) return false;
      return cycleMatchesRange(c, weekRange.start, weekRange.end);
    });
  }, [allCycles, weekRange, personFilter]);

  const kpis = useMemo(() => computeKPIs(filteredCycles), [filteredCycles]);
  const persons = useMemo(() => aggregateByPerson(filteredCycles), [filteredCycles]);

  // Export CSV
  const handleExport = () => {
    const headers = ['Person', 'Total', 'Green', 'Yellow', 'Red', 'Green %', 'Yellow %', 'Red %', 'Date Changes', 'Week Shifts', 'Unmanaged Overdue', 'Health'];
    const rows = persons.map(p => [
      p.person_name, p.total, p.green, p.yellow, p.red, p.green_pct, p.yellow_pct, p.red_pct,
      p.date_change_requested, p.week_shifted, p.unmanaged_overdue, p.person_health,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `delegation-score-${moment().format('DD-MM-YYYY')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-12 p-3 md:p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-slate-700" />
            Delegation Score
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Weekly task performance scoring — Green / Yellow / Red
          </p>
        </div>
        <Button variant="outline" className="h-11 md:h-9 gap-2" onClick={handleExport} disabled={persons.length === 0}>
          <Download className="w-4 h-4" />
          Export
        </Button>
      </div>

      {/* Week selector + filters */}
      <ScoreWeekSelector
        weekOffset={weekOffset}
        onWeekChange={setWeekOffset}
        personFilter={personFilter}
        onPersonFilterChange={setPersonFilter}
        assignees={assignees}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <ScoreKPICards kpis={kpis} />

          {/* Person Table */}
          <PersonScoreTable persons={persons} onSelectPerson={setSelectedPerson} />
        </>
      )}

      {/* Drill-down Modal */}
      <TaskDrilldownModal
        open={!!selectedPerson}
        onClose={() => setSelectedPerson(null)}
        person={selectedPerson}
      />
    </div>
  );
}