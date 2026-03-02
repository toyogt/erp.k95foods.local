import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ScanLine, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { movePalletWithCrates } from '@/components/wip/wipHelpers';
import ChecklistRunner from '@/components/checklist/ChecklistRunner';

const LOC_CHAMBER_IN = 'WIP-CHAMBER-IN';
const BLOCK_IN = ['POST_CHAMBER', 'IN_TRANSIT', 'RECEIVED', 'STORED', 'CLOSED'];

/**
 * Props: machine, user, onPalletMoved(pallet)
 */
export default function ChamberPalletIn({ machine, user, onPalletMoved }) {
  const [scanInput, setScanInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState(null);
  // step: 'scan' | 'checklist' | 'done'
  const [step, setStep] = useState('scan');
  const [pendingPallet, setPendingPallet] = useState(null);

  async function handleScan() {
    const palletId = scanInput.trim();
    if (!palletId) return;
    setLoading(true);
    setResultMsg(null);
    try {
      const pallets = await base44.entities.Pallet.filter({ pallet_id: palletId });
      const pallet = pallets[0];
      if (!pallet) { setResultMsg({ ok: false, text: `Pallet ${palletId} not found` }); setLoading(false); setScanInput(''); return; }
      if (pallet.status === 'IN_CHAMBER') { setResultMsg({ ok: false, text: `Pallet ${palletId} is already IN CHAMBER.` }); setLoading(false); setScanInput(''); return; }
      if (BLOCK_IN.includes(pallet.status)) { setResultMsg({ ok: false, text: `Pallet ${palletId} status "${pallet.status}" — cannot re-chamber.` }); setLoading(false); setScanInput(''); return; }
      setPendingPallet(pallet);
      setStep('checklist');
    } catch (e) { setResultMsg({ ok: false, text: e.message }); }
    setLoading(false);
    setScanInput('');
  }

  async function handleChecklistComplete(status, runId) {
    setLoading(true);
    try {
      await movePalletWithCrates({
        palletDbId: pendingPallet.id,
        palletId: pendingPallet.pallet_id,
        toLocation: LOC_CHAMBER_IN,
        toStatus: 'IN_CHAMBER',
        toCrateStatus: 'IN_CHAMBER',
        machineId: machine?.machine_id,
        user,
      });
      setStep('done');
      onPalletMoved({ ...pendingPallet, status: 'IN_CHAMBER' });
    } catch (e) { setResultMsg({ ok: false, text: e.message }); setStep('scan'); }
    setLoading(false);
  }

  if (step === 'checklist') return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 bg-blue-600 text-white">
        <p className="font-bold">Pre-load Checklist — {pendingPallet?.pallet_id}</p>
        <p className="text-xs opacity-80 mt-0.5">Complete before moving pallet into chamber</p>
      </div>
      <ChecklistRunner
        station_type="CHAMBER"
        stage="BEFORE_LOAD"
        reference_type="Pallet"
        reference_id={pendingPallet?.pallet_id}
        user={user}
        onComplete={handleChecklistComplete}
        onCancel={() => { setStep('scan'); setPendingPallet(null); }}
      />
    </div>
  );

  if (step === 'done') return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200">
        <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
        <div>
          <p className="font-bold">Pallet {pendingPallet?.pallet_id} moved IN</p>
          <p className="text-sm opacity-80">Pre-load checklist completed.</p>
        </div>
      </div>
      <Button className="w-full h-12 rounded-xl" onClick={() => { setStep('scan'); setPendingPallet(null); setResultMsg(null); }}>
        Scan Another Pallet
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 bg-blue-600 text-white">
        <p className="font-bold text-lg">⬇ Pallet IN</p>
        <p className="text-sm opacity-80">Scan pallet → complete checklist → move in</p>
      </div>
      <div className="relative">
        <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
        <input
          value={scanInput} onChange={e => setScanInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleScan()}
          placeholder="Scan pallet barcode…"
          className="w-full pl-12 pr-4 h-16 text-xl font-bold rounded-2xl border-2 border-slate-300 focus:border-blue-500 focus:outline-none bg-white"
          autoFocus disabled={loading}
        />
      </div>
      {loading && <div className="flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}
      {resultMsg && (
        <div className={`flex items-center gap-3 p-4 rounded-xl ${resultMsg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
          {resultMsg.ok ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
          <p className="font-medium text-sm">{resultMsg.text}</p>
        </div>
      )}
      <Button onClick={handleScan} disabled={!scanInput.trim() || loading} className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700">
        Confirm IN
      </Button>
    </div>
  );
}