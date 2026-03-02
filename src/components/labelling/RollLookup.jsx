import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Search } from 'lucide-react';

const EVENT_LABELS = {
  RECEIVED: 'Received',
  INSTALLED: 'Installed',
  SETUP_WASTE: 'Setup Waste',
  TEST_PRINT: 'Test Print',
  RUN_WASTE: 'Run Waste',
  REMOVED_LEFTOVER: 'Removed (Leftover)',
  REMOVED_FINISHED: 'Removed (Finished)',
  ADJUSTMENT: 'Adjustment',
};

const WASTE_TYPES = new Set(['SETUP_WASTE', 'TEST_PRINT', 'RUN_WASTE', 'ADJUSTMENT']);

function fmt(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleString();
}

export default function RollLookup() {
  const [query, setQuery] = useState('');
  const [roll, setRoll] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function search() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    setRoll(null);
    setEvents([]);
    try {
      const rolls = await base44.entities.LabelRoll.filter({ roll_id: q });
      if (!rolls.length) { setError('Roll not found'); setLoading(false); return; }
      setRoll(rolls[0]);
      const evts = await base44.entities.LabelRollEvent.filter({ roll_id: q }, 'created_at', 100);
      setEvents(evts);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  const totalWaste = events.filter(e => WASTE_TYPES.has(e.event_type)).reduce((s, e) => s + (e.qty_labels || 0), 0);
  const leftoverEvt = events.find(e => e.event_type === 'REMOVED_LEFTOVER');
  const leftover = leftoverEvt?.qty_labels ?? null;
  const declared = roll?.declared_qty_labels ?? null;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          className="flex-1 h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:border-blue-500"
          placeholder="Scan or enter Roll ID…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
        />
        <Button onClick={search} disabled={!query.trim() || loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {roll && (
        <div className="space-y-3">
          {/* Roll summary */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-mono font-bold text-slate-900">{roll.roll_id}</p>
                {roll.product_code && <p className="text-xs text-slate-500">{roll.product_code}</p>}
                {roll.label_variant_id && <p className="text-xs text-slate-500">Variant: {roll.label_variant_id}</p>}
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                roll.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
                roll.status === 'FINISHED' ? 'bg-slate-200 text-slate-700' :
                roll.status === 'LEFTOVER' ? 'bg-amber-100 text-amber-800' :
                roll.status === 'QUARANTINED' ? 'bg-red-100 text-red-800' :
                'bg-blue-100 text-blue-800'
              }`}>{roll.status}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-center">
              <div>
                <p className="text-lg font-black text-slate-800">{declared != null ? declared.toLocaleString() : '—'}</p>
                <p className="text-xs text-slate-500">Declared</p>
              </div>
              <div>
                <p className="text-lg font-black text-red-700">{totalWaste.toLocaleString()}</p>
                <p className="text-xs text-slate-500">Total Waste</p>
              </div>
              <div>
                <p className="text-lg font-black text-amber-700">{leftover != null ? leftover.toLocaleString() : '—'}</p>
                <p className="text-xs text-slate-500">Leftover</p>
              </div>
            </div>
          </div>

          {/* Event timeline */}
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {events.map(e => (
              <div key={e.event_id} className={`rounded-xl px-3 py-2 text-sm flex justify-between items-start ${
                WASTE_TYPES.has(e.event_type) ? 'bg-red-50 border border-red-100' :
                e.event_type === 'INSTALLED' ? 'bg-emerald-50 border border-emerald-100' :
                'bg-slate-50 border border-slate-100'
              }`}>
                <div>
                  <p className="font-semibold text-slate-800">{EVENT_LABELS[e.event_type] || e.event_type}</p>
                  {e.wo_id && <p className="text-xs text-slate-500">WO: {e.wo_id} {e.line_machine_id && `· ${e.line_machine_id}`}</p>}
                  {e.reason && <p className="text-xs text-slate-500">{e.reason}</p>}
                </div>
                <div className="text-right shrink-0 ml-2">
                  {e.qty_labels != null && <p className="text-sm font-bold">{e.qty_labels.toLocaleString()}</p>}
                  <p className="text-xs text-slate-400">{fmt(e.created_at)}</p>
                  <p className="text-xs text-slate-400">{e.created_by}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}