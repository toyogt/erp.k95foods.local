import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Loader2, XCircle, Info } from 'lucide-react';
import { logAudit } from '@/components/AuditLogger';

const SEV_STYLE = {
  CRITICAL: 'bg-red-50 border-red-300 text-red-800',
  WARN:     'bg-amber-50 border-amber-300 text-amber-800',
  INFO:     'bg-blue-50 border-blue-200 text-blue-800',
};
const SEV_ICON = { CRITICAL: XCircle, WARN: AlertTriangle, INFO: Info };

export default function AlertsPage() {
  const [user, setUser] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('OPEN');
  const [noteInputs, setNoteInputs] = useState({});

  const isManager = user?.role === 'admin' || user?.role === 'production_manager' || user?.role === 'labelling_supervisor';

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); load(filter, u); }).catch(() => setLoading(false));
  }, []);

  async function load(status, u) {
    setLoading(true);
    const data = await base44.entities.AlertEvent.filter({ status }, '-created_at', 100).catch(() => []);
    setAlerts(data);
    setLoading(false);
  }

  async function closeAlert(alert) {
    const now = new Date().toISOString();
    await base44.entities.AlertEvent.update(alert.id, {
      status: 'CLOSED', closed_by: user?.email, closed_at: now,
      notes: noteInputs[alert.id] || alert.notes || '',
    });
    await logAudit({ action: `Alert closed: ${alert.event_id}`, entity_type: 'AlertEvent', entity_id: alert.event_id, user });
    setAlerts(prev => prev.filter(a => a.id !== alert.id));
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Alerts</h1>
        <p className="text-sm text-slate-500">Factory exceptions and warnings</p>
      </div>

      <div className="flex gap-2">
        {['OPEN', 'CLOSED'].map(s => (
          <button key={s} onClick={() => { setFilter(s); load(s, user); }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${filter === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {s}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin text-slate-300" /></div>}
      {!loading && alerts.length === 0 && <p className="text-center text-slate-400 py-10">No {filter.toLowerCase()} alerts</p>}

      <div className="space-y-3">
        {alerts.map(a => {
          const Icon = SEV_ICON[a.severity] || Info;
          return (
            <div key={a.id} className={`rounded-2xl border p-4 ${SEV_STYLE[a.severity] || SEV_STYLE.INFO}`}>
              <div className="flex items-start gap-3">
                <Icon className="w-5 h-5 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wide">{a.severity}</span>
                    {a.station_type && <span className="text-xs opacity-70">{a.station_type}</span>}
                    <span className="text-xs opacity-60 ml-auto">{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</span>
                  </div>
                  <p className="text-sm font-medium mt-1">{a.message}</p>
                  {a.reference_id && <p className="text-xs opacity-70 mt-0.5">Ref: {a.reference_type} · {a.reference_id}</p>}
                  {a.notes && <p className="text-xs mt-1 opacity-70 italic">{a.notes}</p>}
                  {filter === 'OPEN' && isManager && (
                    <div className="mt-2 space-y-1">
                      <input
                        className="w-full text-xs border border-current/20 bg-white/60 rounded-lg px-2 py-1 focus:outline-none"
                        placeholder="Notes (optional)"
                        value={noteInputs[a.id] || ''}
                        onChange={e => setNoteInputs(prev => ({ ...prev, [a.id]: e.target.value }))}
                      />
                      <button onClick={() => closeAlert(a)}
                        className="flex items-center gap-1 text-xs font-bold opacity-80 hover:opacity-100">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Close Alert
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}