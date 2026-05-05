import { useState, useEffect, useMemo } from 'react';
import { ChevronRight, Save, Loader2, CheckCircle2, MessageSquare, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';


const HEALTH_BADGE = {
  Good: 'bg-green-100 text-green-700',
  'Needs Follow-up': 'bg-yellow-100 text-yellow-700',
  Critical: 'bg-red-100 text-red-700',
};

function NumInput({ value, onChange, max, disabled }) {
  const display = value === 0 || value === '0' ? '0' : String(value || '');

  const handleChange = (e) => {
    if (disabled) return;
    const raw = e.target.value.replace(/[^0-9]/g, '');
    if (raw === '') { onChange(0); return; }
    const num = parseInt(raw, 10);
    if (max !== undefined && num > max) return;
    onChange(num);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      onWheel={e => e.target.blur()}
      onFocus={e => { if (display === '0') e.target.select(); }}
      disabled={disabled}
      className={`w-12 h-8 border rounded px-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400 ${disabled ? 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed' : 'border-slate-200'}`}
    />
  );
}

export default function PersonScoreTable({ persons, onSelectPerson, plans, onSaveRow, meetingFilter }) {
  const [rowErrors, setRowErrors] = useState({});

  const filteredRows = useMemo(() => {
    if (meetingFilter === 'pending') {
      return persons.filter(p => !plans?.[p.person_email]?.meeting_done);
    }
    if (meetingFilter === 'done') {
      return persons.filter(p => !!plans?.[p.person_email]?.meeting_done);
    }
    return persons;
  }, [persons, plans, meetingFilter]);

  const [drafts, setDrafts] = useState({});
  const [savingEmail, setSavingEmail] = useState(null);
  const [remarkModal, setRemarkModal] = useState(null); // { email, name }
  const [remarkText, setRemarkText] = useState('');
  const [nextWeekNotesText, setNextWeekNotesText] = useState('');

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
    if (field.startsWith('next_week_planned_')) {
      setRowErrors(prev => { const n = { ...prev }; delete n[email]; return n; });
    }
  };

  const getNextWeekTotal = (email) => {
    const g = Number(getDraft(email, 'next_week_planned_green')) || 0;
    const y = Number(getDraft(email, 'next_week_planned_yellow')) || 0;
    const r = Number(getDraft(email, 'next_week_planned_red')) || 0;
    return g + y + r;
  };

  const handleSaveRow = async (p) => {
    const total = getNextWeekTotal(p.person_email);
    if (total !== 100) {
      setRowErrors(prev => ({ ...prev, [p.person_email]: `Must total 100% (currently ${total}%)` }));
      return;
    }
    setRowErrors(prev => { const n = { ...prev }; delete n[p.person_email]; return n; });

    setSavingEmail(p.person_email);
    const d = drafts[p.person_email] || {};
    const plan = plans?.[p.person_email] || {};
    const fields = {};

    for (const field of ['next_week_planned_green', 'next_week_planned_yellow', 'next_week_planned_red', 'meeting_remarks', 'next_week_notes']) {
      const drafted = d[field] !== undefined ? d[field] : (plan[field] ?? (field === 'meeting_remarks' || field === 'next_week_notes' ? '' : 0));
      fields[field] = (field === 'meeting_remarks' || field === 'next_week_notes') ? (drafted || '').trim() : (Number(drafted) || 0);
    }
    fields.meeting_done = true;
    fields.actual_total = p.total;
    fields.actual_green = p.green;
    fields.actual_yellow = p.yellow;
    fields.actual_red = p.red;
    fields.actual_green_pct = p.green_pct;
    fields.actual_yellow_pct = p.yellow_pct;
    fields.actual_red_pct = p.red_pct;
    fields.actual_health = p.person_health;

    await onSaveRow(p.person_email, p.person_name, fields);
    setDrafts(prev => { const n = { ...prev }; delete n[p.person_email]; return n; });
    setSavingEmail(null);
  };

  const openRemarkModal = (email, name) => {
    setRemarkText(getDraft(email, 'meeting_remarks'));
    setNextWeekNotesText(getDraft(email, 'next_week_notes'));
    setRemarkModal({ email, name });
  };

  const saveRemarkModal = () => {
    if (remarkModal) {
      setDraft(remarkModal.email, 'meeting_remarks', remarkText);
      setDraft(remarkModal.email, 'next_week_notes', nextWeekNotesText);
    }
    setRemarkModal(null);
  };

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
                <th className="text-center px-2 py-3 font-medium bg-blue-50 text-blue-700" colSpan={3}>This Week Planned %</th>
                <th className="text-center px-3 py-3 font-medium">Total</th>
                <th className="text-center px-2 py-3 font-medium"><span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-0.5" />G</th>
                <th className="text-center px-2 py-3 font-medium"><span className="inline-block w-3 h-3 rounded-full bg-yellow-400 mr-0.5" />Y</th>
                <th className="text-center px-2 py-3 font-medium"><span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-0.5" />R</th>
                <th className="text-center px-2 py-3 font-medium">G%</th>
                <th className="text-center px-2 py-3 font-medium">Y%</th>
                <th className="text-center px-2 py-3 font-medium">R%</th>
                <th className="text-center px-2 py-3 font-medium bg-indigo-50 text-indigo-700" colSpan={4}>Next Week Planned %</th>
                <th className="text-center px-2 py-3 font-medium w-10"></th>
                <th className="text-center px-2 py-3 font-medium w-20">Action</th>
                <th className="w-8"></th>
              </tr>
              <tr className="bg-slate-50 text-slate-500 text-xs">
                <th className="sticky left-0 bg-slate-50 z-10"></th>
                <th className="text-center px-2 py-1.5 font-medium text-green-600 bg-blue-50/50">G</th>
                <th className="text-center px-2 py-1.5 font-medium text-yellow-600 bg-blue-50/50">Y</th>
                <th className="text-center px-2 py-1.5 font-medium text-red-600 bg-blue-50/50">R</th>
                <th colSpan={7}></th>
                <th className="text-center px-2 py-1.5 font-medium text-green-600 bg-indigo-50/50">G</th>
                <th className="text-center px-2 py-1.5 font-medium text-yellow-600 bg-indigo-50/50">Y</th>
                <th className="text-center px-2 py-1.5 font-medium text-red-600 bg-indigo-50/50">R</th>
                <th className="text-center px-2 py-1.5 font-medium text-slate-400 bg-indigo-50/50">Σ</th>
                <th colSpan={3}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map(p => {
                const plan = plans?.[p.person_email] || {};
                const isDone = !!plan.meeting_done;
                const isSaving = savingEmail === p.person_email;
                const nwTotal = getNextWeekTotal(p.person_email);
                const totalValid = nwTotal === 100;
                const hasRemark = !!(getDraft(p.person_email, 'meeting_remarks') || '').trim() || !!(getDraft(p.person_email, 'next_week_notes') || '').trim();
                const rowError = rowErrors[p.person_email];

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
                        <div>
                          <span className="text-slate-900">{p.person_name}</span>
                          {rowError && <p className="text-xs text-red-600 mt-0.5">{rowError}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="text-center px-2 py-2 bg-blue-50/30">
                      <span className={`text-sm font-semibold ${(plan.this_week_planned_green || 0) > 0 ? 'text-green-700' : 'text-slate-300'}`}>{plan.this_week_planned_green || 0}%</span>
                    </td>
                    <td className="text-center px-2 py-2 bg-blue-50/30">
                      <span className={`text-sm font-semibold ${(plan.this_week_planned_yellow || 0) > 0 ? 'text-yellow-600' : 'text-slate-300'}`}>{plan.this_week_planned_yellow || 0}%</span>
                    </td>
                    <td className="text-center px-2 py-2 bg-blue-50/30">
                      <span className={`text-sm font-semibold ${(plan.this_week_planned_red || 0) > 0 ? 'text-red-600' : 'text-slate-300'}`}>{plan.this_week_planned_red || 0}%</span>
                    </td>
                    <td className="text-center px-3 py-3 font-semibold text-slate-900">{p.total}</td>
                    <td className="text-center px-2 py-3 font-semibold text-green-700">{p.green}</td>
                    <td className="text-center px-2 py-3 font-semibold text-yellow-600">{p.yellow}</td>
                    <td className="text-center px-2 py-3 font-semibold text-red-600">{p.red}</td>
                    <td className="text-center px-2 py-3 text-green-600">{p.green_pct}%</td>
                    <td className="text-center px-2 py-3 text-yellow-600">{p.yellow_pct}%</td>
                    <td className="text-center px-2 py-3 text-red-600 font-semibold">{p.red_pct}%</td>
                    {/* Next Week Planned — locked after save */}
                    <td className="text-center px-1 py-1.5 bg-indigo-50/30" onClick={e => e.stopPropagation()}>
                      <NumInput
                        value={getDraft(p.person_email, 'next_week_planned_green')}
                        onChange={v => setDraft(p.person_email, 'next_week_planned_green', v)}
                        max={100} disabled={isDone}
                      />
                    </td>
                    <td className="text-center px-1 py-1.5 bg-indigo-50/30" onClick={e => e.stopPropagation()}>
                      <NumInput
                        value={getDraft(p.person_email, 'next_week_planned_yellow')}
                        onChange={v => setDraft(p.person_email, 'next_week_planned_yellow', v)}
                        max={100} disabled={isDone}
                      />
                    </td>
                    <td className="text-center px-1 py-1.5 bg-indigo-50/30" onClick={e => e.stopPropagation()}>
                      <NumInput
                        value={getDraft(p.person_email, 'next_week_planned_red')}
                        onChange={v => setDraft(p.person_email, 'next_week_planned_red', v)}
                        max={100} disabled={isDone}
                      />
                    </td>
                    <td className="text-center px-1 py-1.5 bg-indigo-50/30">
                      <span className={`text-xs font-bold ${totalValid ? 'text-green-600' : nwTotal > 100 ? 'text-red-600' : 'text-amber-600'}`}>
                        {nwTotal}%
                      </span>
                    </td>
                    {/* Remark icon button → opens popup */}
                    <td className="text-center px-1 py-1.5" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => openRemarkModal(p.person_email, p.person_name)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${hasRemark ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                        title={hasRemark ? 'Edit remarks' : 'Add remarks'}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    </td>
                    {/* Save / Done — non-clickable once saved */}
                    <td className="text-center px-2 py-1.5" onClick={e => e.stopPropagation()}>
                      {isDone ? (
                        <div className="flex items-center justify-center gap-1 text-green-600 text-xs font-medium">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Saved</span>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          className="h-8 px-3 text-xs gap-1"
                          disabled={isSaving}
                          onClick={() => handleSaveRow(p)}
                        >
                          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Save
                        </Button>
                      )}
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

      {/* Remark Dialog */}
      <Dialog open={!!remarkModal} onOpenChange={() => setRemarkModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Meeting Notes — {remarkModal?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* This Week Commitment Notes (read-only, carried from previous week) */}
            {(getDraft(remarkModal?.email, 'this_week_notes') || plans?.[remarkModal?.email]?.this_week_notes) && (
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">This Week Commitment Notes</label>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-wrap min-h-[60px]">
                  {getDraft(remarkModal?.email, 'this_week_notes') || plans?.[remarkModal?.email]?.this_week_notes || '—'}
                </div>
                <p className="text-xs text-slate-400 mt-1">Carried from previous week's next week notes</p>
              </div>
            )}

            {/* Next Week Commitment Notes (editable) */}
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1 block">Next Week Commitment Notes</label>
              <Textarea
                value={nextWeekNotesText}
                onChange={e => setNextWeekNotesText(e.target.value)}
                placeholder="Enter commitment notes for next week…"
                className="min-h-[80px] text-sm"
                disabled={remarkModal && !!plans?.[remarkModal.email]?.meeting_done}
              />
              <p className="text-xs text-slate-400 mt-1">Will become next week's "This Week Commitment Notes"</p>
            </div>

            {/* Meeting Remarks */}
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1 block">Meeting Remarks</label>
              <Textarea
                value={remarkText}
                onChange={e => setRemarkText(e.target.value)}
                placeholder="Enter meeting remarks, observations, action items…"
                className="min-h-[80px] text-sm"
                disabled={remarkModal && !!plans?.[remarkModal.email]?.meeting_done}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" className="h-11 md:h-9" onClick={() => setRemarkModal(null)}>Cancel</Button>
            {!(remarkModal && plans?.[remarkModal.email]?.meeting_done) && (
              <Button className="h-11 md:h-9" onClick={saveRemarkModal}>Save Notes</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}