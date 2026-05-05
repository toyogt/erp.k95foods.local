import { useState, useEffect, useMemo } from 'react';
import { ChevronRight, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const HEALTH_BADGE = {
  Good: 'bg-green-100 text-green-700',
  'Needs Follow-up': 'bg-yellow-100 text-yellow-700',
  Critical: 'bg-red-100 text-red-700',
};

/**
 * persons: scored aggregates (from engine)
 * allAssignees: ALL people who have ever been assigned tasks [{email, name}]
 * plans: merged plan map {email: plan}
 * onSaveBatch: (changedPlans) => save all changed rows at once
 * planFilter: 'all' | 'no_plan' | 'has_plan'
 */
export default function PersonScoreTable({ persons, allAssignees, onSelectPerson, plans, onSaveBatch, planFilter }) {
  // Build rows: all assignees with score data merged
  const scoreMap = useMemo(() => {
    const m = {};
    for (const p of persons) m[p.person_email] = p;
    return m;
  }, [persons]);

  const rows = useMemo(() => {
    const seen = new Set();
    const result = [];

    // First add all scored persons
    for (const p of persons) {
      seen.add(p.person_email);
      result.push(p);
    }

    // Then add assignees with 0 tasks but who have a plan
    for (const a of allAssignees) {
      if (seen.has(a.email)) continue;
      const plan = plans?.[a.email];
      const hasPlan = plan && (plan.next_week_planned_green || plan.next_week_planned_yellow || plan.next_week_planned_red || plan.this_week_planned_green || plan.this_week_planned_yellow || plan.this_week_planned_red || plan.meeting_remarks);
      if (hasPlan) {
        result.push({
          person_email: a.email,
          person_name: a.name,
          total: 0, green: 0, yellow: 0, red: 0,
          green_pct: 0, yellow_pct: 0, red_pct: 0,
          person_health: '—',
          date_change_requested: 0, week_shifted: 0, unmanaged_overdue: 0,
          cycles: [],
        });
      }
    }

    return result;
  }, [persons, allAssignees, plans]);

  // Apply plan filter
  const filteredRows = useMemo(() => {
    if (planFilter === 'no_plan') {
      return rows.filter(r => {
        const plan = plans?.[r.person_email];
        return !plan || (!plan.next_week_planned_green && !plan.next_week_planned_yellow && !plan.next_week_planned_red && !plan.meeting_remarks);
      });
    }
    if (planFilter === 'has_plan') {
      return rows.filter(r => {
        const plan = plans?.[r.person_email];
        return plan && (plan.next_week_planned_green || plan.next_week_planned_yellow || plan.next_week_planned_red || plan.meeting_remarks);
      });
    }
    return rows;
  }, [rows, plans, planFilter]);

  // Local draft state for editable fields
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);

  // Reset drafts when plans change (e.g. week change)
  useEffect(() => {
    setDrafts({});
  }, [plans]);

  const getDraft = (email, field) => {
    if (drafts[email] && drafts[email][field] !== undefined) return drafts[email][field];
    const plan = plans?.[email] || {};
    return plan[field] ?? (field === 'meeting_remarks' ? '' : 0);
  };

  const setDraft = (email, field, value) => {
    setDrafts(prev => ({
      ...prev,
      [email]: { ...(prev[email] || {}), [field]: value },
    }));
  };

  // Check if any drafts differ from saved plans
  const hasChanges = useMemo(() => {
    for (const email of Object.keys(drafts)) {
      const plan = plans?.[email] || {};
      const d = drafts[email];
      for (const field of Object.keys(d)) {
        const saved = plan[field] ?? (field === 'meeting_remarks' ? '' : 0);
        const drafted = d[field];
        if (field === 'meeting_remarks') {
          if ((drafted || '').trim() !== (saved || '').trim()) return true;
        } else {
          if ((Number(drafted) || 0) !== (Number(saved) || 0)) return true;
        }
      }
    }
    return false;
  }, [drafts, plans]);

  const handleSaveAll = async () => {
    if (!hasChanges) return;
    setSaving(true);
    // Build changed plans
    const changed = {};
    for (const email of Object.keys(drafts)) {
      const plan = plans?.[email] || {};
      const d = drafts[email];
      const updates = {};
      let anyDiff = false;
      for (const field of Object.keys(d)) {
        const saved = plan[field] ?? (field === 'meeting_remarks' ? '' : 0);
        const drafted = d[field];
        const isDiff = field === 'meeting_remarks'
          ? (drafted || '').trim() !== (saved || '').trim()
          : (Number(drafted) || 0) !== (Number(saved) || 0);
        if (isDiff) {
          updates[field] = field === 'meeting_remarks' ? (drafted || '').trim() : (Number(drafted) || 0);
          anyDiff = true;
        }
      }
      if (anyDiff) {
        // Find person name from rows
        const row = filteredRows.find(r => r.person_email === email) || allAssignees.find(a => a.email === email);
        changed[email] = { ...updates, person_name: row?.person_name || row?.name || email };
      }
    }
    await onSaveBatch(changed);
    setDrafts({});
    setSaving(false);
  };

  if (filteredRows.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400 text-sm">
          {planFilter === 'no_plan' ? 'Everyone has a meeting plan for this week' : 'No data for the selected period'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="text-left px-4 py-3 font-medium sticky left-0 bg-slate-100 z-10">Person</th>
                <th className="text-center px-2 py-3 font-medium bg-blue-50 text-blue-700" colSpan={3}>This Week Planned</th>
                <th className="text-center px-3 py-3 font-medium">Total</th>
                <th className="text-center px-2 py-3 font-medium"><span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-0.5" />G</th>
                <th className="text-center px-2 py-3 font-medium"><span className="inline-block w-3 h-3 rounded-full bg-yellow-400 mr-0.5" />Y</th>
                <th className="text-center px-2 py-3 font-medium"><span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-0.5" />R</th>
                <th className="text-center px-2 py-3 font-medium">G%</th>
                <th className="text-center px-2 py-3 font-medium">Y%</th>
                <th className="text-center px-2 py-3 font-medium">R%</th>
                <th className="text-center px-3 py-3 font-medium">Health</th>
                <th className="text-center px-2 py-3 font-medium bg-indigo-50 text-indigo-700" colSpan={3}>Next Week Planned</th>
                <th className="text-left px-3 py-3 font-medium min-w-[160px]">Remarks</th>
                <th className="w-8"></th>
              </tr>
              <tr className="bg-slate-50 text-slate-500 text-xs">
                <th className="sticky left-0 bg-slate-50 z-10"></th>
                <th className="text-center px-2 py-1.5 font-medium text-green-600 bg-blue-50/50">G</th>
                <th className="text-center px-2 py-1.5 font-medium text-yellow-600 bg-blue-50/50">Y</th>
                <th className="text-center px-2 py-1.5 font-medium text-red-600 bg-blue-50/50">R</th>
                <th colSpan={8}></th>
                <th className="text-center px-2 py-1.5 font-medium text-green-600 bg-indigo-50/50">G</th>
                <th className="text-center px-2 py-1.5 font-medium text-yellow-600 bg-indigo-50/50">Y</th>
                <th className="text-center px-2 py-1.5 font-medium text-red-600 bg-indigo-50/50">R</th>
                <th colSpan={2}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map(p => {
                const plan = plans?.[p.person_email] || {};
                return (
                  <tr key={p.person_email} className="hover:bg-slate-50 transition-colors">
                    <td
                      className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap sticky left-0 bg-white z-10 cursor-pointer"
                      onClick={() => p.total > 0 && onSelectPerson(p)}
                    >
                      {p.person_name}
                    </td>
                    {/* This Week Planned (read-only) */}
                    <td className="text-center px-2 py-2 bg-blue-50/30">
                      <span className={`text-sm font-semibold ${(plan.this_week_planned_green || 0) > 0 ? 'text-green-700' : 'text-slate-300'}`}>{plan.this_week_planned_green || 0}</span>
                    </td>
                    <td className="text-center px-2 py-2 bg-blue-50/30">
                      <span className={`text-sm font-semibold ${(plan.this_week_planned_yellow || 0) > 0 ? 'text-yellow-600' : 'text-slate-300'}`}>{plan.this_week_planned_yellow || 0}</span>
                    </td>
                    <td className="text-center px-2 py-2 bg-blue-50/30">
                      <span className={`text-sm font-semibold ${(plan.this_week_planned_red || 0) > 0 ? 'text-red-600' : 'text-slate-300'}`}>{plan.this_week_planned_red || 0}</span>
                    </td>
                    {/* Actual Score */}
                    <td className="text-center px-3 py-3 font-semibold text-slate-900">{p.total}</td>
                    <td className="text-center px-2 py-3 font-semibold text-green-700">{p.green}</td>
                    <td className="text-center px-2 py-3 font-semibold text-yellow-600">{p.yellow}</td>
                    <td className="text-center px-2 py-3 font-semibold text-red-600">{p.red}</td>
                    <td className="text-center px-2 py-3 text-green-600">{p.green_pct}%</td>
                    <td className="text-center px-2 py-3 text-yellow-600">{p.yellow_pct}%</td>
                    <td className="text-center px-2 py-3 text-red-600 font-semibold">{p.red_pct}%</td>
                    <td className="text-center px-3 py-3">
                      {p.person_health !== '—' ? (
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${HEALTH_BADGE[p.person_health] || 'bg-slate-100 text-slate-500'}`}>
                          {p.person_health}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    {/* Next Week Planned — direct inputs */}
                    <td className="text-center px-1 py-1.5 bg-indigo-50/30" onClick={e => e.stopPropagation()}>
                      <input
                        type="number" min={0}
                        value={getDraft(p.person_email, 'next_week_planned_green')}
                        onChange={e => setDraft(p.person_email, 'next_week_planned_green', e.target.value)}
                        className="w-12 h-8 border border-slate-200 rounded px-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                      />
                    </td>
                    <td className="text-center px-1 py-1.5 bg-indigo-50/30" onClick={e => e.stopPropagation()}>
                      <input
                        type="number" min={0}
                        value={getDraft(p.person_email, 'next_week_planned_yellow')}
                        onChange={e => setDraft(p.person_email, 'next_week_planned_yellow', e.target.value)}
                        className="w-12 h-8 border border-slate-200 rounded px-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                      />
                    </td>
                    <td className="text-center px-1 py-1.5 bg-indigo-50/30" onClick={e => e.stopPropagation()}>
                      <input
                        type="number" min={0}
                        value={getDraft(p.person_email, 'next_week_planned_red')}
                        onChange={e => setDraft(p.person_email, 'next_week_planned_red', e.target.value)}
                        className="w-12 h-8 border border-slate-200 rounded px-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                      />
                    </td>
                    {/* Remarks — direct textarea */}
                    <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
                      <input
                        type="text"
                        value={getDraft(p.person_email, 'meeting_remarks')}
                        onChange={e => setDraft(p.person_email, 'meeting_remarks', e.target.value)}
                        placeholder="Remarks…"
                        className="w-full min-w-[140px] h-8 border border-slate-200 rounded px-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 placeholder:text-slate-300"
                      />
                    </td>
                    <td className="px-2 py-3">
                      {p.total > 0 && (
                        <ChevronRight
                          className="w-4 h-4 text-slate-400 cursor-pointer hover:text-slate-600"
                          onClick={() => onSelectPerson(p)}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save All button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSaveAll}
          disabled={!hasChanges || saving}
          className="h-11 md:h-9 gap-2 px-6"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save All Plans'}
        </Button>
      </div>
    </div>
  );
}