import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, ExternalLink } from 'lucide-react';
import GateEntryDetailModal from '@/components/gate/GateEntryDetailModal';

const STATUS_COLORS = {
  OPEN: 'bg-amber-100 text-amber-700',
  PROCESSED: 'bg-green-100 text-green-700',
};

export default function GateHistoryMobile() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState(null);

  useEffect(() => {
    base44.entities.GateEntry.list('-created_date', 100)
      .then(d => { setEntries(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-12 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>;
  if (entries.length === 0) return <div className="py-12 text-center text-slate-400 text-sm">No Gate Entry records yet.</div>;

  return (
    <div className="space-y-2">
      {entries.map(e => (
        <div key={e.id} className="bg-white border border-slate-200 rounded-xl p-3 cursor-pointer hover:bg-slate-50" onClick={() => setSelectedEntry(e)}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs font-bold text-slate-500">{e.gate_id}</p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5">
                {e.vehicle_number || e.driver_name || 'Gate Entry'}
              </p>
              {e.driver_name && <p className="text-xs text-slate-500">{e.driver_name}{e.driver_number ? ` · ${e.driver_number}` : ''}</p>}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[e.status] || 'bg-slate-100 text-slate-600'}`}>
                {e.status}
              </span>
              {e.arrived_at && (
                <span className="text-xs text-slate-400">
                  {new Date(e.arrived_at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>
          {(e.vehicle_photo || e.invoice_photo || e.material_photo) && (
            <div className="flex gap-2 mt-2">
              {e.vehicle_photo && <img src={e.vehicle_photo} alt="vehicle" className="w-14 h-10 object-cover rounded-lg border border-slate-200" />}
              {e.invoice_photo && <img src={e.invoice_photo} alt="invoice" className="w-14 h-10 object-cover rounded-lg border border-slate-200" />}
              {e.material_photo && <img src={e.material_photo} alt="material" className="w-14 h-10 object-cover rounded-lg border border-slate-200" />}
            </div>
          )}
          <div className="flex items-center gap-1 mt-2 text-xs text-blue-600 font-medium">
            <ExternalLink className="w-3 h-3" /> View Details
          </div>
        </div>
      ))}
      {selectedEntry && (
        <GateEntryDetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
      )}
    </div>
  );
}