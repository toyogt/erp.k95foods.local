import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { Truck, Loader2, CheckCircle } from 'lucide-react';

const STAGING_LOCATIONS = ['STAGING-A', 'STAGING-B', 'STAGING-C', 'DISPATCH-BAY', 'COLD-STORE', 'WAREHOUSE-1', 'WAREHOUSE-2'];

export default function HandoverStep({ pallet, user, onComplete }) {
  const [stagingLocation, setStagingLocation] = useState(pallet.staging_location || '');
  const [handoverTo, setHandoverTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleHandover() {
    setLoading(true);
    await base44.entities.BoxPallet.update(pallet.id, {
      status: 'HANDED_OVER',
      staging_location: stagingLocation,
      handover_to: handoverTo,
      handed_over_at: new Date().toISOString(),
      handed_over_by: user?.email || '',
    });
    setLoading(false);
    setDone(true);
    setTimeout(() => onComplete?.(), 1200);
  }

  if (done) return (
    <div className="max-w-md mx-auto mt-10 flex flex-col items-center gap-4 text-center">
      <CheckCircle className="w-14 h-14 text-emerald-500" />
      <h3 className="font-bold text-slate-900 text-lg">Pallet Handed Over!</h3>
      <p className="text-sm text-slate-500">{pallet.pallet_id} → {stagingLocation || 'No location set'}</p>
    </div>
  );

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
          <Truck className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-base">Step 4 — Handover</h3>
          <p className="text-xs text-slate-500">Set staging location and hand off the pallet.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Staging Location</label>
          <select
            className="w-full h-10 px-3 text-sm rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-none"
            value={stagingLocation}
            onChange={e => setStagingLocation(e.target.value)}
          >
            <option value="">— Select or type below —</option>
            {STAGING_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <input
            className="w-full h-10 px-3 text-sm rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-none mt-2"
            placeholder="Or type custom location…"
            value={stagingLocation}
            onChange={e => setStagingLocation(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Handover To (name/user)</label>
          <input
            className="w-full h-10 px-3 text-sm rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-none"
            placeholder="Receiving person name…"
            value={handoverTo}
            onChange={e => setHandoverTo(e.target.value)}
          />
        </div>

        <Button
          onClick={handleHandover}
          disabled={loading}
          className="w-full h-11 bg-blue-600 hover:bg-blue-700 gap-2 rounded-xl"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Truck className="w-4 h-4" /> Mark Handed Over</>}
        </Button>
      </div>
    </div>
  );
}