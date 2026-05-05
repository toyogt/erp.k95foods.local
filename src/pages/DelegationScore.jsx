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

const PLAN_FIELDS = [
  'this_week_planned_green', 'this_week_planned_yellow', 'this_week_planned_red',
  'next_week_planned_green', 'next_week_planned_yellow', 'next_week_planned_red',
  'meeting_remarks',
];

function emptyPlan() {
  return { this_week_planned_green: 0, this_week_planned_yellow: 0, this_week_planned_red: 0,
           next_week_planned_green: 0, next_week_planned_yellow: 0, next_week_planned_red: 0,
           meeting_remarks: '' };
}

export default function DelegationScore() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allCycles, setAllCycles] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [personFilter, setPersonFilter] = useState('all');
  const [selectedPerson, setSelectedPerson] = useState(null);

  const [currentWeekPlans, setCurrentWeekPlans] = useState({});
  const [prevWeekPlans, setPrevWeekPlans] = useState({});

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

    const [tasks, logs, currentPlans, prevPlans] = await Promise.all([
      base44.entities.DirectorTask.list('-created_date', 500),
      base44.entities.DirectorTaskLog.list('-timestamp', 5000),
      base44.entities.ExecutiveMeetingPlan.filter({ week_start_date: weekStartStr }),
      base44.entities.ExecutiveMeetingPlan.filter({ week_start_date: prevWeekStartStr }),
    ]);

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
      cycles.push(...buildScoringCycles(task, taskLogs, today));
    }
    setAllCycles(cycles);

    const aMap = new Map();
    for (const task of tasks) {
      if (task.assigned_to_email && !aMap.has(task.assigned_to_email)) {
        aMap.set(task.assigned_to_email, { email: task.assigned_to_email, name: task.assigned_to_name || task.assigned_to_email });
      }
    }
    setAssignees(Array.from(aMap.values()).sort((a, b) => (a.name || '').localeCompare(b.name || '')));

    const cwMap = {};
    for (const p of currentPlans) cwMap[p.person_email] = p;
    setCurrentWeekPlans(cwMap);

    const pwMap = {};
    for (const p of prevPlans) pwMap[p.person_email] = p;
    setPrevWeekPlans(pwMap);

    setLoading(false);
  }, [weekStartStr, prevWeekStartStr]);

  useEffect(() => { loadData(); }, [loadData]);

  // Build merged plans: this_week_planned auto-carries from prev week's next_week_planned
  const mergedPlans = useMemo(() => {
    const map = {};
    // Current week data
    for (const email of Object.keys(currentWeekPlans)) {
      const cur = currentWeekPlans[email];
      map[email] = {
        id: cur.id,
        this_week_planned_green: cur.this_week_planned_green || 0,
        this_week_planned_yellow: cur.this_week_planned_yellow || 0,
        this_week_planned_red: cur.this_week_planned_red || 0,
        next_week_planned_green: cur.next_week_planned_green || 0,
        next_week_planned_yellow: cur.next_week_planned_yellow || 0,
        next_week_planned_red: cur.next_week_planned_red || 0,
        meeting_remarks: cur.meeting_remarks || '',
      };
    }
    // Carry forward from previous week
    for (const email of Object.keys(prevWeekPlans)) {
      const prev = prevWeekPlans[email];
      if (!map[email]) map[email] = { id: null, ...emptyPlan() };
      // Only auto-fill this_week_planned if it's zero (not manually set)
      if (!map[email].this_week_planned_green && prev.next_week_planned_green) map[email].this_week_planned_green = prev.next_week_planned_green;
      if (!map[email].this_week_planned_yellow && prev.next_week_planned_yellow) map[email].this_week_planned_yellow = prev.next_week_planned_yellow;
      if (!map[email].this_week_planned_red && prev.next_week_planned_red) map[email].this_week_planned_red = prev.next_week_planned_red;
    }
    return map;
  }, [currentWeekPlans, prevWeekPlans]);

  // Save a plan field
  const handleSavePlan = async (personEmail, personName, field, value) => {
    const existing = currentWeekPlans[personEmail];
    const weekEnd = weekRange.end.format('DD/MM/YYYY');
    const weekNum = weekRange.start.isoWeek();
    const year = weekRange.start.isoWeekYear();

    if (existing) {
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
      // Create — also carry forward this_week_planned from prev week
      const prev = prevWeekPlans[personEmail];
      const newRec = await base44.entities.ExecutiveMeetingPlan.create({
        person_email: personEmail,
        person_name: personName,
        week_start_date: weekStartStr,
        week_end_date: weekEnd,
        week_number: weekNum,
        year: year,
        this_week_planned_green: prev?.next_week_planned_green || 0,
        this_week_planned_yellow: prev?.next_week_planned_yellow || 0,
        this_week_planned_red: prev?.next_week_planned_red || 0,
        next_week_planned_green: 0,
        next_week_planned_yellow: 0,
        next_week_planned_red: 0,
        meeting_remarks: '',
        [field]: value,
        updated_by_email: user?.email || '',
        updated_by_name: user?.full_name || '',
      });
      setCurrentWeekPlans(prev => ({ ...prev, [personEmail]: newRec }));
    }
  };

  const filteredCycles = useMemo(() => {
    return allCycles.filter(c => {
      if (personFilter !== 'all' && c.assigned_to_email !== personFilter) return false;
      return cycleMatchesRange(c, weekRange.start, weekRange.end);
    });
  }, [allCycles, weekRange, personFilter]);

  const kpis = useMemo(() => computeKPIs(filteredCycles), [filteredCycles]);
  const persons = useMemo(() => aggregateByPerson(filteredCycles), [filteredCycles]);

  const handleExport = () => {
    const headers = ['Person', 'Planned G', 'Planned Y', 'Planned R', 'Total', 'Green', 'Yellow', 'Red', 'Green %', 'Yellow %', 'Red %', 'Health', 'Next G', 'Next Y', 'Next R', 'Remarks'];
    const rows = persons.map(p => {
      const plan = mergedPlans[p.person_email] || emptyPlan();
      return [
        p.person_name, plan.this_week_planned_green, plan.this_week_planned_yellow, plan.this_week_planned_red,
        p.total, p.green, p.yellow, p.red, p.green_pct, p.yellow_pct, p.red_pct, p.person_health,
        plan.next_week_planned_green, plan.next_week_planned_yellow, plan.next_week_planned_red,
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

  const selectedPersonPlan = selectedPerson ? (mergedPlans[selectedPerson.person_email] || emptyPlan()) : emptyPlan();

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-12 p-3 md:p-4 lg:p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-slate-700" />
            Delegation Score
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Weekly task performance scoring — Green / Yellow / Red</p>
        </div>
        <Button variant="outline" className="h-11 md:h-9 gap-2" onClick={handleExport} disabled={persons.length === 0}>
          <Download className="w-4 h-4" />
          Export
        </Button>
      </div>

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
          <ScoreKPICards kpis={kpis} />
          <PersonScoreTable
            persons={persons}
            onSelectPerson={setSelectedPerson}
            plans={mergedPlans}
            onSavePlan={handleSavePlan}
          />
        </>
      )}

      <TaskDrilldownModal
        open={!!selectedPerson}
        onClose={() => setSelectedPerson(null)}
        person={selectedPerson}
        plan={selectedPersonPlan}
      />
    </div>
  );
}