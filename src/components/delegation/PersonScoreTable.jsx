import { useState, useEffect, useMemo } from 'react';
import { ChevronRight, Save, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const HEALTH_BADGE = {
  Good: 'bg-green-100 text-green-700',
  'Needs Follow-up': 'bg-yellow-100 text-yellow-700',
  Critical: 'bg-red-100 text-red-700',
};

/**
 * Shows only persons who have tasks for the week (task-based, not plan-based).
 * Each row has its own Save button for individual meeting review.
 * meetingFilter: 'all' | 'pending' | 'done'
 */
export default function PersonScoreTable({ persons, onSelectPerson, plans, onSaveRow, meetingFilter }) {
  // Filter by meeting status
  const filteredRows = useMemo(() => {
    if (meetingFilter === 'pending') {
      return persons.filter(p => {
        const plan = plans?.[p.person_email];
        return !plan?.meeting_done;
      });
    }
    if (meetingFilter === 'done') {
      return persons.filter(p => {
        const plan = plans?.[p.person_email];
        return !!plan?.meeting_done;
      });
    }
    return persons;
  }, [persons, plans, meetingFilter]);

  // Local drafts per person
  const [drafts, setDrafts] = useState({});
  const [savingEmail, setSavingEmail] = useState(null);

  // Reset drafts when plans or persons change
  useEffect(() => { setDrafts({}); }, [plans]);

  const getDraft = (email, field) => {
    if (drafts[email]?.[field] !== undefined) return drafts[email][field];
    const plan = plans?.[email] || {};
    return plan[field] ?? (field === 'meeting_remarks' ? '' : 0);
  };

  const setDraft = (email, field, value) => {
    setDrafts(prev => ({
      ...prev,
      [email]: { ...(prev[email] || {}), [field]: value },
    }));
  };

  const hasRowChanges = (email) => {
    const d = drafts[email];
    if (!d) return false;
    const plan = plans?.[email] || {};
    for (const field of Object.keys(d)) {
      const saved = plan[field] ?? (field === 'meeting_remarks' ? '' : 0);
      const drafted = d[field];
      if (field === 'meeting_remarks') {
        if ((drafted || '').trim() !== (saved || '').trim()) return true;
      } else {
        if ((Number(drafted) || 0) !== (Number(saved) || 0)) return true;
      }
    }
    return false;
  };

  const handleSaveRow = async (p) => {
    setSavingEmail(p.person_email);
    const d = drafts[p.person_email] || {};
    const plan = plans?.[p.person_email] || {};
    const fields = {};

    for (const field of ['next_week_planned_green', 'next_week_planned_yellow', 'next_week_planned_red', 'meeting_remarks']) {
      const drafted = d[field] !== undefined ? d[field] : (plan[field] ?? (field === 'meeting_remarks' ? '' : 0));
      fields[field] = field === 'meeting_remarks' ? (drafted || '').trim() : (Number(drafted) || 0);
    }
    fields.meeting_done = true;

    await onSaveRow(p.person_email, p.person_name, fields);
    setDrafts(prev => { const n = { ...prev }; delete n[p.person_email]; return n; });
    setSavingEmail(null);
  };

  // Summary counts
  const totalCount = persons.length;
  const doneCount = persons.filter(p => plans?.[p.person_email]?.meeting_done).length;
  const pendingCount = totalCount - doneCount;

  if (filteredRows.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400 text-sm">
          {meetingFilter === 'pending' ? 'All meetings are done for this week' : meetingFilter === 'done' ? 'No meetings done yet' : 'No tasks for the selected period'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Meeting progress bar */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-500">Meeting Progress:</span>
        <div className="flex-1 max-w-xs bg-slate-100 rounded-full h-2.5">
          <div
            className="bg-green-500 h-2.5 rounded-full transition-all"
            style={{ width: totalCount > 0 ? `${(doneCount / totalCount) * 100}%` : '0%' }}
          />
        </div>
        <span className="font-semibold text-slate-700">{doneCount}/{totalCount}</span>
        {pendingCount > 0 && <span className="text-amber-600 text-xs font-medium">{pendingCount} pending</span>}
      </div>

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
                <th className="text-center px-2 py-3 font-medium w-20">Save</th>
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
                <th colSpan={3}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map(p => {
                const plan = plans?.[p.person_email] || {};
                const isDone = !!plan.meeting_done;
                const isSaving = savingEmail === p.person_email;
                const rowChanged = hasRowChanges(p.person_email);

                return (
                  <tr
                    key={p.person_email}
                    className={`transition-colors ${isDone ? 'bg-green-50/40' : 'hover:bg-slate-50'}`}
                  >
                    <td
                      className={`px-4 py-3 font-medium whitespace-nowrap sticky left-0 z-10 cursor-pointer ${isDone ? 'bg-green-50/40' : 'bg-white'}`}
                      onClick={() => onSelectPerson(p)}
                    >
                      <div className="flex items-center gap-2">
                        {isDone && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                        <span className="text-slate-900">{p.person_name}</span>
                      </div>
                    </td>
                    {/* This Week Planned (read-only, from prev week's next_week_planned) */}
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
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${HEALTH_BADGE[p.person_health] || 'bg-slate-100 text-slate-500'}`}>
                        {p.person_health}
                      </span>
                    </td>
                    {/* Next Week Planned */}
                    <td className="text-center px-1 py-1.5 bg-indigo-50/30" onClick={e => e.stopPropagation()}>
                      <input type="number" min={0}
                        value={getDraft(p.person_email, 'next_week_planned_green')}
                        onChange={e => setDraft(p.person_email, 'next_week_planned_green', e.target.value)}
                        className="w-12 h-8 border border-slate-200 rounded px-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </td>
                    <td className="text-center px-1 py-1.5 bg-indigo-50/30" onClick={e => e.stopPropagation()}>
                      <input type="number" min={0}
                        value={getDraft(p.person_email, 'next_week_planned_yellow')}
                        onChange={e => setDraft(p.person_email, 'next_week_planned_yellow', e.target.value)}
                        className="w-12 h-8 border border-slate-200 rounded px-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </td>
                    <td className="text-center px-1 py-1.5 bg-indigo-50/30" onClick={e => e.stopPropagation()}>
                      <input type="number" min={0}
                        value={getDraft(p.person_email, 'next_week_planned_red')}
                        onChange={e => setDraft(p.person_email, 'next_week_planned_red', e.target.value)}
                        className="w-12 h-8 border border-slate-200 rounded px-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </td>
                    {/* Remarks */}
                    <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
                      <input type="text"
                        value={getDraft(p.person_email, 'meeting_remarks')}
                        onChange={e => setDraft(p.person_email, 'meeting_remarks', e.target.value)}
                        placeholder="Remarks…"
                        className="w-full min-w-[140px] h-8 border border-slate-200 rounded px-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300"
                      />
                    </td>
                    {/* Per-row Save */}
                    <td className="text-center px-2 py-1.5" onClick={e => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant={isDone && !rowChanged ? 'ghost' : 'default'}
                        className={`h-8 px-3 text-xs gap-1 ${isDone && !rowChanged ? 'text-green-600' : ''}`}
                        disabled={isSaving}
                        onClick={() => handleSaveRow(p)}
                      >
                        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                          isDone && !rowChanged ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                        {isDone && !rowChanged ? 'Done' : 'Save'}
                      </Button>
                    </td>
                    <td className="px-2 py-3">
                      <ChevronRight
                        className="w-4 h-4 text-slate-400 cursor-pointer hover:text-slate-600"
                        onClick={() => onSelectPerson(p)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}