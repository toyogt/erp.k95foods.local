import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Phone, Mail, MessageCircle, CheckCircle2, AlertTriangle, Clock, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateDDMMYYYY } from '@/components/purchase/purchaseHelpers';

const MODE_ICON = { Call: Phone, Email: Mail, WhatsApp: MessageCircle };

export default function POFollowUpTracker() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('overdue');
  const [doneNotes, setDoneNotes] = useState({});
  const [rescheduleData, setRescheduleData] = useState({});
  const [acting, setActing] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => { base44.auth.me().then(u => setUser(u)).catch(() => {}); }, []);

  const { data: followUps = [], isLoading } = useQuery({
    queryKey: ['all-followups'],
    queryFn: () => base44.entities.POFollowUp.list('follow_up_date', 500),
    staleTime: 30000, enabled: !!user,
  });

  const today = new Date().toISOString().split('T')[0];
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  const overdue = followUps.filter(f => f.status === 'Pending' && f.follow_up_date && f.follow_up_date < today);
  const dueToday = followUps.filter(f => f.status === 'Pending' && f.follow_up_date === today);
  const upcoming = followUps.filter(f => f.status === 'Pending' && f.follow_up_date > today && f.follow_up_date <= in7Days);
  const completed = followUps.filter(f => f.status === 'Done' || f.status === 'Rescheduled');

  const tabData = { overdue, today: dueToday, upcoming, completed };
  const currentList = tabData[tab] || [];

  async function markDone(fu) {
    setActing(fu.id);
    await base44.entities.POFollowUp.update(fu.id, {
      status: 'Done', notes: doneNotes[fu.id] || '',
      completed_by: user?.email, completed_at: new Date().toISOString(),
    });
    setActing(null);
    queryClient.invalidateQueries({ queryKey: ['all-followups'] });
  }

  async function reschedule(fu) {
    const rd = rescheduleData[fu.id];
    if (!rd?.date) return;
    setActing(fu.id);
    await base44.entities.POFollowUp.update(fu.id, { status: 'Rescheduled', rescheduled_to: rd.date, reschedule_reason: rd.reason || '' });
    await base44.entities.POFollowUp.create({ po_id: fu.po_id, follow_up_date: rd.date, follow_up_mode: fu.follow_up_mode, contact_person: fu.contact_person, status: 'Pending' });
    setRescheduleData(prev => { const n = { ...prev }; delete n[fu.id]; return n; });
    setActing(null);
    queryClient.invalidateQueries({ queryKey: ['all-followups'] });
  }

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-4 pb-20">
      <h1 className="text-xl md:text-2xl font-bold text-slate-900">Purchase Order Follow-Up Tracker</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: 'overdue', label: 'Overdue', count: overdue.length, icon: AlertTriangle, color: 'text-red-600 bg-red-50 border-red-200' },
          { key: 'today', label: 'Due Today', count: dueToday.length, icon: Clock, color: 'text-amber-600 bg-amber-50 border-amber-200' },
          { key: 'upcoming', label: 'Upcoming', count: upcoming.length, icon: CalendarDays, color: 'text-blue-600 bg-blue-50 border-blue-200' },
          { key: 'completed', label: 'Completed', count: completed.length, icon: CheckCircle2, color: 'text-green-600 bg-green-50 border-green-200' },
        ].map(c => (
          <button key={c.key} onClick={() => setTab(c.key)} className={`border rounded-xl p-3 text-center transition-colors ${tab === c.key ? c.color : 'bg-white border-slate-200'}`}>
            <c.icon className="w-5 h-5 mx-auto" />
            <p className="text-2xl font-bold mt-1">{c.count}</p>
            <p className="text-xs">{c.label}</p>
          </button>
        ))}
      </div>

      {currentList.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">No follow-ups in this category.</div>
      ) : (
        <div className="space-y-3">
          {currentList.map(f => {
            const MIcon = MODE_ICON[f.follow_up_mode] || Phone;
            const isOverdue = f.status === 'Pending' && f.follow_up_date < today;
            const rd = rescheduleData[f.id];
            return (
              <div key={f.id} className={`bg-white border rounded-xl p-4 space-y-2 ${isOverdue ? 'border-red-200' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{f.po_id}</span>
                    {isOverdue && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Overdue</span>}
                    {f.status === 'Done' && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Done</span>}
                    {f.status === 'Rescheduled' && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Rescheduled</span>}
                  </div>
                  <MIcon className="w-4 h-4 text-slate-400" />
                </div>
                {f.contact_person && <p className="text-sm text-slate-600">Contact: {f.contact_person}</p>}
                <p className="text-xs text-slate-500">Date: {formatDateDDMMYYYY(f.follow_up_date)}</p>
                {f.notes && <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-2 py-1">{f.notes}</p>}
                {f.rescheduled_to && <p className="text-xs text-slate-500">Rescheduled to: {formatDateDDMMYYYY(f.rescheduled_to)}{f.reschedule_reason ? ` — ${f.reschedule_reason}` : ''}</p>}

                {f.status === 'Pending' && (
                  <div className="space-y-2 pt-1">
                    <textarea className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm" placeholder="Notes..." rows={1} value={doneNotes[f.id] || ''} onChange={e => setDoneNotes(prev => ({ ...prev, [f.id]: e.target.value }))} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => markDone(f)} className="h-11 flex-1 bg-green-600 hover:bg-green-700 text-sm font-bold" disabled={acting === f.id}>
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Mark Done
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setRescheduleData(prev => ({ ...prev, [f.id]: { date: '', reason: '' } }))} className="h-11 flex-1 text-sm font-bold" disabled={acting === f.id}>
                        <CalendarDays className="w-4 h-4 mr-1" /> Reschedule
                      </Button>
                    </div>
                    {rd && (
                      <div className="flex items-end gap-2 bg-slate-50 rounded-lg p-2">
                        <div className="flex-1"><label className="text-xs text-slate-600">New Date *</label><input type="date" className="w-full h-9 border border-slate-200 rounded px-2 text-sm mt-0.5" value={rd.date} onChange={e => setRescheduleData(prev => ({ ...prev, [f.id]: { ...prev[f.id], date: e.target.value } }))} /></div>
                        <div className="flex-1"><label className="text-xs text-slate-600">Reason</label><input className="w-full h-9 border border-slate-200 rounded px-2 text-sm mt-0.5" value={rd.reason} onChange={e => setRescheduleData(prev => ({ ...prev, [f.id]: { ...prev[f.id], reason: e.target.value } }))} /></div>
                        <Button size="sm" className="h-9" onClick={() => reschedule(f)} disabled={!rd.date || acting === f.id}>Save</Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}