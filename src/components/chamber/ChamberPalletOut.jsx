import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ScanLine, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { movePalletWithCrates } from '@/components/wip/wipHelpers';

const LOC_POST_CHAMBER = 'WIP-POST-CHAMBER';

/**
 * Props: machine, user, onPalletMoved(palletId)
 */
export default function ChamberPalletOut({ machine, user, onPalletMoved }) {
  const [scanInput, setScanInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState(null);

  async function handleScan() {
    const palletId = scanInput.trim();
    if (!palletId) return;
    setLoading(true);
    setResultMsg(null);
    try {
      const pallets = await base44.entities.Pallet.filter({ pallet_id: palletId });
      const pallet = pallets[0];
      if (!pallet) { setResultMsg({ ok: false, text: `Pallet ${palletId} not found` }); setLoading(false); setScanInput(''); return; }
      if (pallet.status !== 'IN_CHAMBER') { setResultMsg({ ok: false, text: `Pallet ${palletId} is not IN CHAMBER (status: "${pallet.status}").` }); setLoading(false); setScanInput(''); return; }

      // Block if there's a running cycle for this pallet
      const runningCycles = await base44.entities.ChamberCycle.filter({
        pallet_id: palletId,
        status: 'RUNNING',
      }).catch(() => []);
      if (runningCycles.length > 0) {
        setResultMsg({ ok: false, text: `Pallet ${palletId} has an active cycle running. End or abort the cycle first.`, warn: true });
        setLoading(false); setScanInput(''); return;
      }

      await movePalletWithCrates({
        palletDbId: pallet.id,
        palletId,
        toLocation: LOC_POST_CHAMBER,
        toStatus: 'POST_CHAMBER',
        toCrateStatus: 'POST_CHAMBER',
        machineId: machine?.machine_id,
        user,
      });
      setResultMsg({ ok: true, text: `Pallet ${palletId} moved OUT → Post-Chamber` });
      onPalletMoved(palletId);
    } catch (e) { setResultMsg({ ok: false, text: e.message }); }
    setLoading(false);
    setScanInput('');
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 bg-orange-600 text-white">
        <p className="font-bold text-lg">⬆ Pallet OUT</p>
        <p className="text-sm opacity-80">Scan pallet to move to Post-Chamber</p>
      </div>
      <div className="relative">
        <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
        <input
          value={scanInput} onChange={e => setScanInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleScan()}
          placeholder="Scan pallet barcode…"
          className="w-full pl-12 pr-4 h-16 text-xl font-bold rounded-2xl border-2 border-slate-300 focus:border-orange-500 focus:outline-none bg-white"
          autoFocus disabled={loading}
        />
      </div>
      {loading && <div className="flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}
      {resultMsg && (
        <div className={`flex items-start gap-3 p-4 rounded-xl ${resultMsg.ok ? 'bg-emerald-50 text-emerald-800' : resultMsg.warn ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'}`}>
          {resultMsg.ok
            ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            : resultMsg.warn
              ? <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              : <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />}
          <p className="font-medium text-sm">{resultMsg.text}</p>
        </div>
      )}
      <Button onClick={handleScan} disabled={!scanInput.trim() || loading} className="w-full h-12 rounded-xl bg-orange-600 hover:bg-orange-700">
        Confirm OUT
      </Button>
    </div>
  );
}