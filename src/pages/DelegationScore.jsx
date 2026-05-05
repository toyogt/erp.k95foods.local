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
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allCycles, setAllCycles] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [personFilter, setPersonFilter] = useState('all');
  const [selectedPerson, setSelectedPerson] = useState(null);

  // Meeting plans: { [person_email]: planRecord }
  const [currentWeekPlans, setCurrentWeekPlans] = useState({});
  const [prevWeekPlans, setPrevWeekPlans] = useState({});

  // Week range for current view
  const weekRange = useMemo(() => {
    const start = moment().startOf('isoWeek').add(weekOffset, 'weeks');
    const end = start.clone().endOf('isoWeek');
    return { start, end };
  }, [weekOffset]);

  const weekStartStr = useMemo(() => weekRange.start.format('DD/MM/YYYY'), [weekRange]);
  const prevWeekStartStr = useMemo(() => weekRange.start.clone().subtract(1, 'week').format('DD/MM/YYYY'), [weekRange]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const me = await base44.auth.me();
    setUser(me);

    // Fetch tasks, logs, and meeting plans in parallel
    const [tasks, logs, currentPlans, prevPlans] = await Promise.all([
      base44.entities.DirectorTask.list('-created_date', 500),
      base44.entities.DirectorTaskLog.list('-timestamp', 5000),
      base44.entities.ExecutiveMeetingPlan.filter({ week_start_date: weekStartStr }),
      base44.entities.ExecutiveMeetingPlan.filter({ week_start_date: prevWeekStartStr }),
    ]);

    // Group logs by task_id
    const logsByTask = {};
    for (const log of logs) {
      const tid = log.task_id;
      if (!logsByTask[tid]) logsByTask[tid] = [];
      logsByTask[tid].push(log);
    }
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

    // Index plans by person_email
    const cwMap = {};
    for (const p of currentPlans) cwMap[p.person_email] = p;
    setCurrentWeekPlans(cwMap);

    const pwMap = {};
    for (const p of prevPlans) pwMap[p.person_email] = p;
    setPrevWeekPlans(pwMap);

    setLoading(false);
  }, [weekStartStr, prevWeekStartStr]);

  useEffect(() => { loadData(); }, [loadData]);

  // Build merged plan map: this_week_planned comes from previous week's next_week_planned
  const mergedPlans = useMemo(() => {
    const map = {};
    // Start with current week plans
    for (const email of Object.keys(currentWeekPlans)) {
      const cur = currentWeekPlans[email];
      map[email] = {
        id: cur.id,
        this_week_planned_notes: cur.this_week_planned_notes || '',
        next_week_planned_notes: cur.next_week_planned_notes || '',
        meeting_remarks: cur.meeting_remarks || '',
      };
    }
    // Carry forward previous week's next_week_planned as this_week_planned
    for (const email of Object.keys(prevWeekPlans)) {
      const prev = prevWeekPlans[email];
      if (!map[email]) {
        map[email] = { id: null, this_week_planned_notes: '', next_week_planned_notes: '', meeting_remarks: '' };
      }
      // Only override this_week_planned if it's empty (auto-carry)
      if (!map[email].this_week_planned_notes && prev.next_week_planned_notes) {
        map[email].this_week_planned_notes = prev.next_week_planned_notes;
      }
    }
    return map;
  }, [currentWeekPlans, prevWeekPlans]);

  // Save a plan field for a person
  const handleSavePlan = async (personEmail, personName, field, value) => {
    const existing = currentWeekPlans[personEmail];
    const weekEnd = weekRange.end.format('DD/MM/YYYY');
    const weekNum = weekRange.start.isoWeek();
    const year = weekRange.start.isoWeekYear();

    if (existing) {
      // Update existing record
      await base44.entities.ExecutiveMeetingPlan.update(existing.id, {
        [field]: value,
        updated_by_email: user?.email || '',
        updated_by_name: user?.full_name || '',
      });
      setCurrentWeekPlans(prev => ({
        ...prev,
        [personEmail]: { ...prev[personEmail], [field]: value },
      }));
    } else {
      // Create new record
      // When creating, also carry forward this_week_planned from previous week
      const prevPlan = prevWeekPlans[personEmail];
      const newRec = await base44.entities.ExecutiveMeetingPlan.create({
        person_email: personEmail,
        person_name: personName,
        week_start_date: weekStartStr,
        week_end_date: weekEnd,
        week_number: weekNum,
        year: year,
        this_week_planned_notes: prevPlan?.next_week_planned_notes || '',
        next_week_planned_notes: '',
        meeting_remarks: '',
        [field]: value,
        updated_by_email: user?.email || '',
        updated_by_name: user?.full_name || '',
      });
      setCurrentWeekPlans(prev => ({
        ...prev,
        [personEmail]: newRec,
      }));
    }
  };

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
    const headers = ['Person', 'This Week Planned', 'Total', 'Green', 'Yellow', 'Red', 'Green %', 'Yellow %', 'Red %', 'Health', 'Next Week Planned', 'Meeting Remarks'];
    const rows = persons.map(p => {
      const plan = mergedPlans[p.person_email] || {};
      return [
        p.person_name,
        `"${(plan.this_week_planned_notes || '').replace(/"/g, '""')}"`,
        p.total, p.green, p.yellow, p.red, p.green_pct, p.yellow_pct, p.red_pct, p.person_health,
        `"${(plan.next_week_planned_notes || '').replace(/"/g, '""')}"`,
        `"${(plan.meeting_remarks || '').replace(/"/g, '""')}"`,
      ];
    });
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `delegation-score-${moment().format('DD-MM-YYYY')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get plan for selected person in drill-down
  const selectedPersonPlan = selectedPerson ? (mergedPlans[selectedPerson.person_email] || {}) : {};

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

          {/* Person Table with Meeting Plans */}
          <PersonScoreTable
            persons={persons}
            onSelectPerson={setSelectedPerson}
            plans={mergedPlans}
            onSavePlan={handleSavePlan}
          />
        </>
      )}

      {/* Drill-down Modal */}
      <TaskDrilldownModal
        open={!!selectedPerson}
        onClose={() => setSelectedPerson(null)}
        person={selectedPerson}
        plan={selectedPersonPlan}
      />
    </div>
  );
}