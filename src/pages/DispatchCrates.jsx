import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ScanLine, Loader2, CheckCircle2, XCircle, Truck } from 'lucide-react';
import { logMovement } from '@/components/wip/wipHelpers';
import { logAudit } from '@/components/AuditLogger';
import { Button } from '@/components/ui/button';

const LOC_TRANSIT = 'TRANSIT-TO-LABELLING';

function BigMsg({ ok, text }) {
  if (!text) return null;
  return (
    <div className={`rounded-2xl p-5 text-center text-white font-bold text-lg ${ok ? 'bg-emerald-500' : 'bg-red-500'}`}>
      {ok ? <CheckCircle2 className="w-8 h-8 mx-auto mb-1" /> : <XCircle className="w-8 h-8 mx-auto mb-1" />}
      {text}
    </div>
  );
}

export default function DispatchCrates() {
  const [user, setUser] = useState(null);
  const [scan, setScan] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [dispatched, setDispatched] = useState([]);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  async function handleScan() {
    if (!scan.trim()) return;
    const crateId = scan.trim();
    setScan('');
    setLoading(true);
    setResult(null);
    try {
      const crates = await base44.entities.Crate.filter({ crate_id: crateId });
      const crate = crates[0];
      if (!crate) { setResult({ ok: false, text: `Crate ${crateId} not found` }); setLoading(false); return; }
      const allowed = ['POST_CHAMBER', 'STORED'];
      if (!allowed.includes(crate.status)) {
        setResult({ ok: false, text: `Crate ${crateId} status is "${crate.status}" — must be POST_CHAMBER or STORED to dispatch` });
        setLoading(false); return;
      }
      await base44.entities.Crate.update(crate.id, {
        status: 'IN_TRANSIT',
        current_location: LOC_TRANSIT,
        last_scan_time: new Date().toISOString(),
        last_scanned_by: user?.email || '',
      });
      await logMovement({ entityType: 'CRATE', entityId: crateId, from: crate.current_location, to: LOC_TRANSIT, user });
      await logAudit({ action: 'CrateDispatched', entity_type: 'Crate', entity_id: crateId, user, station: 'DISPATCH', details: { from: crate.current_location } });
      setDispatched(prev => [...prev, { crateId, product_code: crate.product_code, batch_id: crate.batch_id, bottle_type: crate.bottle_type }]);
      setResult({ ok: true, text: `✓ ${crateId} dispatched` });
    } catch (e) {
      setResult({ ok: false, text: e.message || 'Error' });
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center">
          <Truck className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Dispatch Crates</h2>
          <p className="text-sm text-slate-500">Scan crates onto vehicle to labelling</p>
        </div>
      </div>

      <div className="rounded-2xl bg-teal-50 border border-teal-200 p-3 text-sm text-teal-800">
        Scan each crate as it's loaded onto the vehicle for the labelling building.
      </div>

      <div className="relative">
        <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
        <input
          className="w-full pl-12 pr-4 h-16 text-xl font-bold rounded-2xl border-2 border-teal-400 focus:border-teal-600 focus:outline-none bg-white"
          placeholder="Scan crate barcode…"
          value={scan}
          onChange={e => setScan(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleScan()}
          autoFocus
          disabled={loading}
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Saving…
        </div>
      )}

      <BigMsg ok={result?.ok} text={result?.text} />

      {dispatched.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase">Dispatched this session ({dispatched.length})</p>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {dispatched.map((d, i) => (
              <div key={i} className="flex justify-between text-sm py-1 border-b border-slate-50 last:border-0">
                <span className="font-mono font-bold">{d.crateId}</span>
                <span className="text-slate-400 text-xs">{d.product_code} · {d.batch_id}</span>
              </div>
            ))}
          </div>
          <Button
            className="w-full h-12 rounded-xl bg-teal-600 hover:bg-teal-700 mt-2"
            onClick={() => { setDispatched([]); setResult(null); }}
          >
            ✓ Clear & Start New Session ({dispatched.length} Dispatched)
          </Button>
        </div>
      )}
    </div>
  );
}