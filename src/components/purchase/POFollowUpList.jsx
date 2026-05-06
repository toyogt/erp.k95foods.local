import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, Calendar, Plus, Phone, Mail, MessageCircle, AlertTriangle } from 'lucide-react';
import { formatDateDDMMYYYY } from './purchaseHelpers';

const MODE_ICON = { Call: Phone, Email: Mail, WhatsApp: MessageCircle };
const STATUS_CLS = { Pending: 'bg-amber-100 text-amber-700', Done: 'bg-green-100 text-green-700', Rescheduled: 'bg-slate-100 text-slate-600' };

export default function POFollowUpList({ poId, user }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newMode, setNewMode] = useState('Call');
  const [newContact, setNewContact] = useState('');
  const [doneNotes, setDoneNotes] = useState({});
  const [rescheduleData, setRescheduleData] = useState({});
  const [acting, setActing] = useState(null);
  const queryClient = useQueryClient();

  const { data: followUps = [], isLoading } = useQuery({
    queryKey: ['po-followups', poId],
    queryFn: () => base44.entities.POFollowUp.filter({ po_id: poId }, 'follow_up_date', 50),
    staleTime: 15000, enabled: !!poId,
  });

  const today = new Date().toISOString().split('T')[0];

  async function handleAdd() {
    if (!newDate) return;
    setActing('add');
    await base44.entities.POFollowUp.create({ po_id: poId, follow_up_date: newDate, follow_up_mode: newMode, contact_person: newContact, status: 'Pending' });
    setShowAdd(false); setNewDate(''); setNewContact('');
    setActing(null);
    queryClient.invalidateQueries({ queryKey: ['po-followups', poId] });
  }

  async function markDone(fu) {
    setActing(fu.id);
    await base44.entities.POFollowUp.update(fu.id, { status: 'Done', notes: doneNotes[fu.id] || '', completed_by: user?.email, completed_at: new Date().toISOString() });
    setActing(null);
    queryClient.invalidateQueries({ queryKey: ['po-followups', poId] });
  }

  async function reschedule(fu) {
    const rd = rescheduleData[fu.id];
    if (!rd?.date) return;
    setActing(fu.id);
    await base44.entities.POFollowUp.update(fu.id, { status: 'Rescheduled', rescheduled_to: rd.date, reschedule_reason: rd.reason || '' });
    await base44.entities.POFollowUp.create({ po_id: poId, follow_up_date: rd.date, follow_up_mode: fu.follow_up_mode, contact_person: fu.contact_person, status: 'Pending' });
    setRescheduleData(prev => { const n = { ...prev }; delete n[fu.id]; return n; });
    setActing(null);
    queryClient.invalidateQueries({ queryKey: ['po-followups', poId] });
  }

  if (isLoading) return <div className="py-4 text-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">Follow-Ups ({followUps.length})</p>
        <Button variant="outline" size="sm" className="h-9 text-xs gap-1" onClick={() => setShowAdd(!showAdd)}><Plus className="w-3 h-3" /> Add</Button>
      </div>

      {showAdd && (
        <div className="flex items-end gap-2 border border-blue-200 bg-blue-50 rounded-xl p-3">
          <div className="flex-1"><label className="text-xs font-medium text-slate-700">Date</label><input type="date" className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm mt-1" value={newDate} onChange={e => setNewDate(e.target.value)} /></div>
          <div className="w-28"><label className="text-xs font-medium text-slate-700">Mode</label><select className="w-full h-9 border border-slate-200 rounded-lg px-2 text-sm bg-white mt-1" value={newMode} onChange={e => setNewMode(e.target.value)}><option value="Call">Call</option><option value="Email">Email</option><option value="WhatsApp">WhatsApp</option></select></div>
          <div className="flex-1"><label className="text-xs font-medium text-slate-700">Contact</label><input className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm mt-1" value={newContact} onChange={e => setNewContact(e.target.value)} placeholder="Name" /></div>
          <Button size="sm" className="h-9" onClick={handleAdd} disabled={acting === 'add' || !newDate}>{acting === 'add' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}</Button>
        </div>
      )}

      {followUps.map(fu => {
        const MIcon = MODE_ICON[fu.follow_up_mode] || Phone;
        const isOverdue = fu.status === 'Pending' && fu.follow_up_date < today;
        const rd = rescheduleData[fu.id];
        return (
          <div key={fu.id} className={`border rounded-xl p-3 space-y-2 ${isOverdue ? 'border-red-200 bg-red-50/30' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MIcon className="w-4 h-4 text-slate-400" />
                <span className="font-bold text-sm text-slate-900">{formatDateDDMMYYYY(fu.follow_up_date)}</span>
                {isOverdue && <AlertTriangle className="w-4 h-4 text-red-500" />}
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_CLS[fu.status] || ''}`}>{fu.status}</span>
              </div>
              {fu.contact_person && <span className="text-xs text-slate-500">{fu.contact_person}</span>}
            </div>
            {fu.notes && <p className="text-xs text-slate-600">{fu.notes}</p>}
            {fu.status === 'Pending' && (
              <div className="space-y-2">
                <textarea className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm" placeholder="Notes..." rows={1} value={doneNotes[fu.id] || ''} onChange={e => setDoneNotes(prev => ({ ...prev, [fu.id]: e.target.value }))} />
                <div className="flex gap-2">
                  <Button size="sm" className="h-9 bg-green-600 hover:bg-green-700 text-xs" onClick={() => markDone(fu)} disabled={acting === fu.id}>
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Mark Done
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => setRescheduleData(prev => ({ ...prev, [fu.id]: { date: '', reason: '' } }))}>
                    <Calendar className="w-3 h-3 mr-1" /> Reschedule
                  </Button>
                </div>
                {rd && (
                  <div className="flex items-end gap-2 bg-slate-50 rounded-lg p-2">
                    <div className="flex-1"><label className="text-xs text-slate-600">New Date</label><input type="date" className="w-full h-8 border border-slate-200 rounded px-2 text-sm mt-0.5" value={rd.date} onChange={e => setRescheduleData(prev => ({ ...prev, [fu.id]: { ...prev[fu.id], date: e.target.value } }))} /></div>
                    <div className="flex-1"><label className="text-xs text-slate-600">Reason</label><input className="w-full h-8 border border-slate-200 rounded px-2 text-sm mt-0.5" value={rd.reason} onChange={e => setRescheduleData(prev => ({ ...prev, [fu.id]: { ...prev[fu.id], reason: e.target.value } }))} /></div>
                    <Button size="sm" className="h-8 text-xs" onClick={() => reschedule(fu)} disabled={!rd.date || acting === fu.id}>Save</Button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {followUps.length === 0 && <p className="text-sm text-slate-400 text-center py-2">No follow-ups scheduled</p>}
    </div>
  );
}