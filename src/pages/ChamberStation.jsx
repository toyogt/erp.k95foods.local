import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ScanLine, Loader2, CheckCircle2, Thermometer, ArrowDownToLine, ArrowUpFromLine, RefreshCw } from 'lucide-react';
import { movePalletWithCrates } from '@/components/wip/wipHelpers';
import { pendingCount } from '@/components/wip/offlineQueue';

const LOC_CHAMBER_IN = 'WIP-CHAMBER-IN';
const LOC_POST_CHAMBER = 'WIP-POST-CHAMBER';

export default function ChamberStation() {
  const [user, setUser] = useState(null);
  const [machine, setMachine] = useState(null);
  const [machineInput, setMachineInput] = useState('');
  const [machineError, setMachineError] = useState('');
  const [mode, setMode] = useState(null); // 'in' | 'out'
  const [scanInput, setScanInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState(null); // { ok, text }
  const [palletsInChamber, setPalletsInChamber] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    loadPalletsInChamber();
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  async function loadPalletsInChamber() {
    setListLoading(true);
    try {
      const p = await base44.entities.Pallet.filter({ status: 'IN_CHAMBER' });
      setPalletsInChamber(p);
    } catch { /* offline */ }
    setListLoading(false);
  }

  async function confirmMachine() {
    setMachineError('');
    if (!machineInput.trim()) return;
    setLoading(true);
    try {
      const machines = await base44.entities.Machine.filter({ machine_id: machineInput.trim() });
      const m = machines[0];
      if (!m) { setMachineError('Machine not found'); setLoading(false); return; }
      if (m.machine_type !== 'CHAMBER') { setMachineError(`Wrong type: ${m.machine_type}. Need CHAMBER.`); setLoading(false); return; }
      setMachine(m);
    } catch {
      setMachine({ machine_id: machineInput.trim(), display_name: machineInput.trim() });
    }
    setLoading(false);
  }

  async function handleScanPallet() {
    if (!scanInput.trim()) return;
    setLoading(true);
    setResultMsg(null);
    const palletId = scanInput.trim();
    try {
      const pallets = await base44.entities.Pallet.filter({ pallet_id: palletId });
      const pallet = pallets[0];
      if (!pallet) { setResultMsg({ ok: false, text: `Pallet ${palletId} not found` }); setLoading(false); setScanInput(''); return; }

      if (mode === 'in') {
        await movePalletWithCrates({
          palletDbId: pallet.id,
          palletId,
          toLocation: LOC_CHAMBER_IN,
          toStatus: 'IN_CHAMBER',
          toCrateStatus: 'IN_CHAMBER',
          machineId: machine?.machine_id,
          user,
        });
        setResultMsg({ ok: true, text: `Pallet ${palletId} moved INTO chamber` });
        setPalletsInChamber(prev => [...prev.filter(p => p.pallet_id !== palletId), { ...pallet, status: 'IN_CHAMBER', current_location: LOC_CHAMBER_IN }]);
      } else {
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
        setPalletsInChamber(prev => prev.filter(p => p.pallet_id !== palletId));
      }
    } catch (e) {
      setResultMsg({ ok: false, text: e.message || 'Error processing pallet' });
    }
    setLoading(false);
    setScanInput('');
  }

  const pending = pendingCount();

  // ── MACHINE SETUP ─────────────────────────────────────────────
  if (!machine) return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Chamber Station</h2>
        {offline && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-semibold">Offline</span>}
      </div>
      <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-4">
        <div className="flex items-center gap-3">
          <Thermometer className="w-8 h-8 text-orange-500" />
          <div>
            <p className="font-bold text-slate-800">Scan Machine QR</p>
            <p className="text-xs text-slate-500">Must be a CHAMBER type machine</p>
          </div>
        </div>
        <div className="relative">
          <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            className="w-full pl-10 h-12 text-base rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-none"
            placeholder="Machine ID / QR"
            value={machineInput}
            onChange={e => setMachineInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && confirmMachine()}
            autoFocus
          />
        </div>
        {machineError && <p className="text-sm text-red-600">{machineError}</p>}
        <Button onClick={confirmMachine} disabled={!machineInput.trim() || loading} className="w-full h-12 rounded-xl">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
        </Button>
      </div>
    </div>
  );

  // ── MAIN SCREEN ───────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Chamber Station</h2>
          <p className="text-xs text-slate-500">{machine.display_name}</p>
        </div>
        <div className="flex items-center gap-2">
          {offline && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-semibold">Offline</span>}
          {!offline && pending > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-semibold">{pending} Pending</span>}
          <button onClick={() => setMachine(null)} className="text-xs text-slate-400 underline">Change</button>
        </div>
      </div>

      {/* Action buttons */}
      {!mode && (
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => { setMode('in'); setResultMsg(null); }}
            className="bg-blue-600 text-white rounded-2xl p-6 flex flex-col items-center gap-3 active:scale-95 transition-transform shadow-md"
          >
            <ArrowDownToLine className="w-10 h-10" />
            <span className="text-lg font-bold">Pallet IN</span>
            <span className="text-xs opacity-75">Move to Chamber</span>
          </button>
          <button
            onClick={() => { setMode('out'); setResultMsg(null); }}
            className="bg-orange-600 text-white rounded-2xl p-6 flex flex-col items-center gap-3 active:scale-95 transition-transform shadow-md"
          >
            <ArrowUpFromLine className="w-10 h-10" />
            <span className="text-lg font-bold">Pallet OUT</span>
            <span className="text-xs opacity-75">Move to Post-Chamber</span>
          </button>
        </div>
      )}

      {/* Scan input */}
      {mode && (
        <div className="space-y-3">
          <div className={`rounded-2xl p-4 text-white ${mode === 'in' ? 'bg-blue-600' : 'bg-orange-600'}`}>
            <p className="font-bold text-lg">{mode === 'in' ? '⬇ Pallet IN — Scan Pallet' : '⬆ Pallet OUT — Scan Pallet'}</p>
            <p className="text-sm opacity-80 mt-1">{mode === 'in' ? 'Moving to WIP-CHAMBER-IN' : 'Moving to WIP-POST-CHAMBER'}</p>
          </div>
          <div className="relative">
            <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
            <input
              value={scanInput}
              onChange={e => setScanInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleScanPallet()}
              placeholder="Scan pallet barcode…"
              className="w-full pl-12 pr-4 h-16 text-xl font-bold rounded-2xl border-2 border-slate-300 focus:border-blue-500 focus:outline-none bg-white"
              autoFocus
              disabled={loading}
            />
          </div>

          {loading && <div className="flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}

          {resultMsg && (
            <div className={`flex items-center gap-3 p-4 rounded-xl ${resultMsg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
              <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${resultMsg.ok ? 'text-emerald-600' : 'text-red-500'}`} />
              <p className="font-medium text-sm">{resultMsg.text}</p>
            </div>
          )}

          <Button variant="outline" className="w-full h-12 rounded-xl" onClick={() => { setMode(null); setResultMsg(null); setScanInput(''); }}>
            ← Back
          </Button>
        </div>
      )}

      {/* Pallets in chamber list */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-bold text-slate-700">Currently IN Chamber ({palletsInChamber.length})</p>
          <button onClick={loadPalletsInChamber} className="p-1 text-slate-400 hover:text-slate-600">
            <RefreshCw className={`w-4 h-4 ${listLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {palletsInChamber.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400 text-center">No pallets currently in chamber</p>
        ) : (
          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {palletsInChamber.map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <p className="font-mono font-bold text-slate-800 text-sm">{p.pallet_id}</p>
                <div className="text-right">
                  <p className="text-xs text-slate-500">{p.crate_count} crates</p>
                  {p.batch_id && <p className="text-xs text-slate-400">{p.batch_id}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}