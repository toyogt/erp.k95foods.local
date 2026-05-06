import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Phone, Mail, MessageCircle, CheckCircle2, AlertTriangle, Clock, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateDDMMYYYY } from '@/components/purchase/purchaseHelpers';

export default function POFollowUpTracker() {
  const [user, setUser] = useState(null);
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followUps, setFollowUps] = useState([]);
  const [tab, setTab] = useState('overdue');

  useEffect(() => {
    async function load() {
      const u = await base44.auth.me();
      setUser(u);
      const poList = await base44.entities.PurchaseOrder.filter({ status: 'SENT' }, '-created_date', 200).catch(() => []);
      const poSentList = await base44.entities.PurchaseOrder.filter({ status: 'PART_RECEIVED' }, '-created_date', 200).catch(() => []);
      setPos([...poList, ...poSentList]);

      const fups = [...poList, ...poSentList].map(po => ({
        id: po.id, po_id: po.po_id, supplier: po.supplier_name,
        contact: '', mode: 'Call',
        due_date: po.due_date || po.po_date,
        notes: '', status: 'Pending',
      }));
      setFollowUps(fups);
      setLoading(false);
    }
    load();
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  const overdue = followUps.filter(f => f.status === 'Pending' && f.due_date && f.due_date < today);
  const dueToday = followUps.filter(f => f.status === 'Pending' && f.due_date === today);
  const upcoming = followUps.filter(f => f.status === 'Pending' && f.due_date > today && f.due_date <= in7Days);
  const completed = followUps.filter(f => f.status === 'Done');

  const tabData = { overdue, today: dueToday, upcoming, completed };
  const currentList = tabData[tab] || [];

  const modeIcon = { Call: Phone, Email: Mail, WhatsApp: MessageCircle };

  function markDone(id) {
    setFollowUps(prev => prev.map(f => f.id === id ? { ...f, status: 'Done' } : f));
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

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
            const MIcon = modeIcon[f.mode] || Phone;
            return (
              <div key={f.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{f.po_id}</span>
                    {tab === 'overdue' && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Overdue</span>}
                  </div>
                  <MIcon className="w-4 h-4 text-slate-400" />
                </div>
                <p className="text-sm text-slate-600">{f.supplier || '—'}</p>
                <p className="text-xs text-slate-500">Due: {formatDateDDMMYYYY(f.due_date)}</p>
                {f.status === 'Pending' && (
                  <Button size="sm" onClick={() => markDone(f.id)} className="h-9 text-sm bg-green-600 hover:bg-green-700">
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Mark Done
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}