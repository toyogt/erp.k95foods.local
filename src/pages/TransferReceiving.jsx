import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ScanLine, Loader2, CheckCircle2, Truck, PackageOpen, ArrowRight } from 'lucide-react';
import { movePalletWithCrates, savePallet, linkCratesToPallet, logMovement } from '@/components/wip/wipHelpers';
import { enqueue, pendingCount } from '@/components/wip/offlineQueue';

const LOC_TRANSIT = 'TRANSIT-TO-LABELLING';
const VALID_ZONES = ['ZONE-LABEL-LINE-1', 'ZONE-LABEL-LINE-2'];

export default function TransferReceiving() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState(null); // 'dispatch' | 'receive'
  const [offline, setOffline] = useState(!navigator.onLine);

  // DISPATCH state
  const [dispatchScan, setDispatchScan] = useState('');
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [dispatchResult, setDispatchResult] = useState(null);

  // RECEIVE state
  const [receiveStep, setReceiveStep] = useState(1); // 1–5
  const [incomingPalletId, setIncomingPalletId] = useState('');
  const [incomingPallet, setIncomingPallet] = useState(null);
  const [incomingCrateIds, setIncomingCrateIds] = useState([]); // crates linked to incoming pallet
  const [scannedCrates, setScannedCrates] = useState([]);
  const [newPalletId, setNewPalletId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [zoneError, setZoneError] = useState('');
  const [receiveLoading, setReceiveLoading] = useState(false);
  const [receiveMsg, setReceiveMsg] = useState('');
  const [scan, setScan] = useState('');

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const pending = pendingCount();

  // ─────────── DISPATCH ────────────────────────────────────────
  async function handleDispatch() {
    if (!dispatchScan.trim()) return;
    setDispatchLoading(true);
    setDispatchResult(null);
    const palletId = dispatchScan.trim();
    try {
      const pallets = await base44.entities.Pallet.filter({ pallet_id: palletId });
      const pallet = pallets[0];
      if (!pallet) { setDispatchResult({ ok: false, text: `Pallet ${palletId} not found` }); setDispatchLoading(false); setDispatchScan(''); return; }
      await movePalletWithCrates({
        palletDbId: pallet.id,
        palletId,
        toLocation: LOC_TRANSIT,
        toStatus: 'IN_TRANSIT',
        toCrateStatus: 'IN_TRANSIT',
        user,
      });
      setDispatchResult({ ok: true, text: `Pallet ${palletId} dispatched to ${LOC_TRANSIT}` });
    } catch (e) {
      setDispatchResult({ ok: false, text: e.message || 'Error dispatching pallet' });
    }
    setDispatchLoading(false);
    setDispatchScan('');
  }

  // ─────────── RECEIVE STEPS ───────────────────────────────────

  // Step 1: scan incoming pallet
  async function handleIncomingPallet() {
    if (!scan.trim()) return;
    setReceiveLoading(true);
    setReceiveMsg('');
    const palletId = scan.trim();
    try {
      const pallets = await base44.entities.Pallet.filter({ pallet_id: palletId });
      const pallet = pallets[0];
      if (!pallet) { setReceiveMsg('Pallet not found: ' + palletId); setReceiveLoading(false); return; }
      // Load linked crates
      const links = await base44.entities.PalletCrateLink.filter({ pallet_id: palletId });
      setIncomingPallet(pallet);
      setIncomingPalletId(palletId);
      setIncomingCrateIds(links.map(l => l.crate_id));
      setReceiveStep(2);
    } catch {
      // offline – accept pallet
      setIncomingPallet({ pallet_id: palletId, id: '_offline' });
      setIncomingPalletId(palletId);
      setIncomingCrateIds([]);
      setReceiveStep(2);
    }
    setScan('');
    setReceiveLoading(false);
  }

  // Step 2: scan crates
  function handleCrateScan() {
    if (!scan.trim()) return;
    const crateId = scan.trim();
    if (scannedCrates.includes(crateId)) { setScan(''); return; }
    if (incomingCrateIds.length > 0 && !incomingCrateIds.includes(crateId)) {
      setReceiveMsg(`⚠ Crate ${crateId} not linked to pallet ${incomingPalletId}`);
      setScan(''); return;
    }
    setScannedCrates(prev => [...prev, crateId]);
    setReceiveMsg(`✓ ${crateId} scanned (${scannedCrates.length + 1} total)`);
    setScan('');
  }

  // Step 3: new pallet
  function confirmNewPallet() {
    if (!scan.trim()) return;
    setNewPalletId(scan.trim());
    setScan('');
    setReceiveStep(4);
  }

  // Step 4: zone scan
  function handleZoneScan() {
    if (!scan.trim()) return;
    const z = scan.trim().toUpperCase();
    if (!VALID_ZONES.includes(z)) { setZoneError(`Invalid zone: ${z}. Must be ZONE-LABEL-LINE-1 or ZONE-LABEL-LINE-2`); setScan(''); return; }
    setZoneId(z);
    setZoneError('');
    setScan('');
    setReceiveStep(5);
  }

  // Step 5: complete
  async function handleCompleteReceive() {
    setReceiveLoading(true);
    try {
      // Create new pallet
      const newPallet = await savePallet({
        pallet_id: newPalletId,
        pallet_type: 'WIP',
        current_location: zoneId,
        status: 'RECEIVED',
        crate_count: scannedCrates.length,
        batch_id: incomingPallet?.batch_id || '',
      }, user);

      // Link crates to new pallet
      await linkCratesToPallet(newPalletId, scannedCrates, user);

      // Move each crate to zone
      for (const crateId of scannedCrates) {
        try {
          const crates = await base44.entities.Crate.filter({ crate_id: crateId });
          if (crates.length > 0) {
            await base44.entities.Crate.update(crates[0].id, { current_location: zoneId, status: 'RECEIVED', last_scan_time: new Date().toISOString() });
          }
        } catch {
          enqueue({ type: 'update', entity: 'Crate', data: { crate_id: crateId, current_location: zoneId, status: 'RECEIVED' }, userEmail: user?.email });
        }
        await logMovement({ entityType: 'CRATE', entityId: crateId, from: LOC_TRANSIT, to: zoneId, user });
      }

      await logMovement({ entityType: 'PALLET', entityId: newPalletId, from: LOC_TRANSIT, to: zoneId, user });

      // Close old pallet
      try {
        if (incomingPallet?.id && !incomingPallet.id.startsWith('_offline')) {
          await base44.entities.Pallet.update(incomingPallet.id, { status: 'CLOSED' });
        }
      } catch { /* offline */ }

      setReceiveMsg(`✓ Received! Pallet ${newPalletId} with ${scannedCrates.length} crates at ${zoneId}`);
      setReceiveStep(6);
    } catch (e) {
      setReceiveMsg('Error: ' + (e.message || 'Unknown error'));
    }
    setReceiveLoading(false);
  }

  function resetReceive() {
    setReceiveStep(1); setIncomingPalletId(''); setIncomingPallet(null);
    setIncomingCrateIds([]); setScannedCrates([]); setNewPalletId('');
    setZoneId(''); setZoneError(''); setReceiveMsg(''); setScan('');
  }

  // ─────────── HOME SCREEN ─────────────────────────────────────
  if (!mode) return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Transfer / Receiving</h2>
        {offline && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-semibold">Offline</span>}
        {!offline && pending > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-semibold">{pending} Pending</span>}
      </div>
      <div className="grid grid-cols-1 gap-4">
        <button
          onClick={() => setMode('dispatch')}
          className="bg-teal-600 text-white rounded-2xl p-6 flex items-center gap-5 active:scale-95 transition-transform shadow-md"
        >
          <Truck className="w-12 h-12 flex-shrink-0" />
          <div className="text-left">
            <p className="text-xl font-bold">Dispatch to Labelling</p>
            <p className="text-sm opacity-80 mt-1">Move post-chamber pallet to transit</p>
          </div>
        </button>
        <button
          onClick={() => { setMode('receive'); resetReceive(); }}
          className="bg-slate-800 text-white rounded-2xl p-6 flex items-center gap-5 active:scale-95 transition-transform shadow-md"
        >
          <PackageOpen className="w-12 h-12 flex-shrink-0" />
          <div className="text-left">
            <p className="text-xl font-bold">Receive at Labelling</p>
            <p className="text-sm opacity-80 mt-1">Re-palletize & assign to line zone</p>
          </div>
        </button>
      </div>
    </div>
  );

  // ─────────── DISPATCH SCREEN ──────────────────────────────────
  if (mode === 'dispatch') return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => setMode(null)} className="text-slate-400 hover:text-slate-600 text-sm underline">← Back</button>
        <h2 className="text-xl font-bold text-slate-900">Dispatch to Labelling</h2>
      </div>
      <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4">
        <p className="text-sm text-teal-800 font-medium">Scan a POST-CHAMBER pallet to dispatch it to <strong>{LOC_TRANSIT}</strong></p>
      </div>
      <div className="relative">
        <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
        <input
          value={dispatchScan}
          onChange={e => setDispatchScan(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleDispatch()}
          placeholder="Scan pallet barcode…"
          className="w-full pl-12 pr-4 h-16 text-xl font-bold rounded-2xl border-2 border-slate-300 focus:border-teal-500 focus:outline-none bg-white"
          autoFocus
          disabled={dispatchLoading}
        />
      </div>
      {dispatchLoading && <div className="flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}
      {dispatchResult && (
        <div className={`flex items-center gap-3 p-4 rounded-xl ${dispatchResult.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p className="font-medium text-sm">{dispatchResult.text}</p>
        </div>
      )}
    </div>
  );

  // ─────────── RECEIVE SCREEN ───────────────────────────────────
  const STEPS = ['Scan Incoming Pallet', 'Scan Crates', 'Scan New Pallet', 'Scan Zone', 'Complete'];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => setMode(null)} className="text-slate-400 hover:text-slate-600 text-sm underline">← Back</button>
        <h2 className="text-xl font-bold text-slate-900">Receive at Labelling</h2>
      </div>

      {/* Step indicator */}
      {receiveStep <= 5 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-1 flex-shrink-0">
              <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${i + 1 < receiveStep ? 'bg-emerald-500 text-white' : i + 1 === receiveStep ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'}`}>
                {i + 1 < receiveStep ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`w-4 h-0.5 ${i + 1 < receiveStep ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>
      )}

      {/* Step 1 */}
      {receiveStep === 1 && (
        <div className="space-y-3">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
            <p className="font-semibold text-slate-700">Step 1 · Scan Incoming Pallet</p>
            <p className="text-sm text-slate-500 mt-1">Must be a pallet in transit (TRANSIT-TO-LABELLING)</p>
          </div>
          <ScanField value={scan} onChange={setScan} onEnter={handleIncomingPallet} placeholder="Scan incoming pallet ID…" loading={receiveLoading} />
          {receiveMsg && <p className="text-sm text-red-600 px-1">{receiveMsg}</p>}
        </div>
      )}

      {/* Step 2 */}
      {receiveStep === 2 && (
        <div className="space-y-3">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
            <p className="font-semibold text-slate-700">Step 2 · Scan Crates</p>
            <p className="text-sm text-slate-500 mt-1">Pallet: <strong>{incomingPalletId}</strong> · Expected: {incomingCrateIds.length || '?'} crates</p>
            <p className="text-sm font-bold text-slate-800 mt-2">Scanned: {scannedCrates.length}</p>
          </div>
          <ScanField value={scan} onChange={setScan} onEnter={handleCrateScan} placeholder="Scan crate barcode…" />
          {receiveMsg && <p className={`text-sm px-1 ${receiveMsg.startsWith('⚠') ? 'text-orange-600' : 'text-emerald-700'}`}>{receiveMsg}</p>}
          {scannedCrates.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-3 max-h-32 overflow-y-auto">
              {scannedCrates.map(c => <p key={c} className="text-xs font-mono text-slate-600 py-0.5">{c}</p>)}
            </div>
          )}
          <Button disabled={scannedCrates.length === 0} onClick={() => { setReceiveStep(3); setScan(''); setReceiveMsg(''); }} className="w-full h-14 rounded-2xl text-base font-bold">
            {scannedCrates.length} Crates Done — Next <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}

      {/* Step 3 */}
      {receiveStep === 3 && (
        <div className="space-y-3">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
            <p className="font-semibold text-slate-700">Step 3 · Scan New Pallet Barcode</p>
            <p className="text-sm text-slate-500 mt-1">Scan the barcode on the new empty pallet</p>
          </div>
          <ScanField value={scan} onChange={setScan} onEnter={confirmNewPallet} placeholder="Scan new pallet barcode…" />
        </div>
      )}

      {/* Step 4 */}
      {receiveStep === 4 && (
        <div className="space-y-3">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
            <p className="font-semibold text-slate-700">Step 4 · Scan Zone QR</p>
            <p className="text-sm text-slate-500 mt-1">New pallet: <strong>{newPalletId}</strong></p>
            <p className="text-sm text-slate-500">Allowed zones: ZONE-LABEL-LINE-1 / ZONE-LABEL-LINE-2</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {VALID_ZONES.map(z => (
              <button key={z} onClick={() => { setZoneId(z); setZoneError(''); setReceiveStep(5); }} className="p-4 rounded-2xl border-2 border-slate-300 bg-white font-bold text-slate-800 active:scale-95 transition-transform text-sm">
                {z.replace('ZONE-', '')}
              </button>
            ))}
          </div>
          <ScanField value={scan} onChange={setScan} onEnter={handleZoneScan} placeholder="Or scan zone QR…" />
          {zoneError && <p className="text-sm text-red-600 px-1">{zoneError}</p>}
        </div>
      )}

      {/* Step 5 */}
      {receiveStep === 5 && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <p className="text-lg font-bold text-slate-900">Confirm Receive</p>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between"><span>Incoming pallet</span><strong>{incomingPalletId}</strong></div>
              <div className="flex justify-between"><span>Crates scanned</span><strong>{scannedCrates.length}</strong></div>
              <div className="flex justify-between"><span>New pallet</span><strong>{newPalletId}</strong></div>
              <div className="flex justify-between"><span>Zone</span><strong className="text-blue-700">{zoneId}</strong></div>
            </div>
          </div>
          {receiveMsg && <p className="text-sm text-red-600 px-1">{receiveMsg}</p>}
          <Button onClick={handleCompleteReceive} disabled={receiveLoading} className="w-full h-16 text-lg font-bold rounded-2xl bg-slate-900 hover:bg-slate-800">
            {receiveLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Complete Receive ✓'}
          </Button>
          <Button variant="outline" onClick={() => setReceiveStep(4)} className="w-full h-11 rounded-xl">← Back</Button>
        </div>
      )}

      {/* Step 6: done */}
      {receiveStep === 6 && (
        <div className="space-y-5">
          <div className="text-center p-8 bg-slate-900 rounded-2xl text-white">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold">Received!</h2>
            <p className="text-3xl font-mono mt-3 bg-white/10 rounded-xl px-4 py-2">{newPalletId}</p>
            <p className="text-slate-300 mt-2">{scannedCrates.length} crates · {zoneId}</p>
          </div>
          <Button onClick={resetReceive} className="w-full h-14 rounded-2xl text-base font-bold">Receive Another Pallet</Button>
          <Button variant="outline" onClick={() => setMode(null)} className="w-full h-12 rounded-xl">Back to Menu</Button>
        </div>
      )}
    </div>
  );
}

function ScanField({ value, onChange, onEnter, placeholder, loading }) {
  return (
    <div className="relative">
      <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onEnter()}
        placeholder={placeholder}
        className="w-full pl-12 pr-4 h-16 text-xl font-bold rounded-2xl border-2 border-slate-300 focus:border-slate-800 focus:outline-none bg-white"
        autoFocus
        disabled={loading}
      />
    </div>
  );
}