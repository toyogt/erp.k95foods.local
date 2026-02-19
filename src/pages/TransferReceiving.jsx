import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { movePalletWithCrates, savePallet, linkCratesToPallet, logMovement } from '@/components/wip/wipHelpers';
import { pendingCount, enqueue } from '@/components/wip/offlineQueue';
import ScanInput from '@/components/wip/ScanInput';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, Truck, PackageCheck, WifiOff, ArrowLeft, X } from 'lucide-react';

const VALID_ZONES = ['ZONE-LABEL-LINE-1', 'ZONE-LABEL-LINE-2', 'WIP-LABELLING-RECEIVE'];

export default function TransferReceiving() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState(null); // DISPATCH | RECEIVE
  const [offline, setOffline] = useState(false);

  // DISPATCH state
  const [dispatchScan, setDispatchScan] = useState('');
  const [dispatchSaving, setDispatchSaving] = useState(false);
  const [dispatchResult, setDispatchResult] = useState(null);

  // RECEIVE state
  const [recvStep, setRecvStep] = useState(1); // 1=scan incoming | 2=scan crates | 3=new pallet | 4=zone | 5=complete
  const [incomingPallet, setIncomingPallet] = useState(null);
  const [incomingCrateLinks, setIncomingCrateLinks] = useState([]);
  const [scannedCrates, setScannedCrates] = useState([]);
  const [newPalletId, setNewPalletId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [recvScan, setRecvScan] = useState('');
  const [recvSaving, setRecvSaving] = useState(false);
  const [recvResult, setRecvResult] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser);
    setOffline(!navigator.onLine);
    window.addEventListener('online', () => setOffline(false));
    window.addEventListener('offline', () => setOffline(true));
  }, []);

  // ── DISPATCH ──────────────────────────────────────────────────
  async function handleDispatch(palletId) {
    setDispatchSaving(true);
    setDispatchResult(null);
    try {
      const pallets = await base44.entities.Pallet.filter({ pallet_id: palletId });
      const pallet = pallets[0];
      if (!pallet) { setDispatchResult({ error: 'Pallet not found: ' + palletId }); setDispatchSaving(false); return; }
      await movePalletWithCrates({
        palletDbId: pallet.id, palletId,
        toLocation: 'TRANSIT-TO-LABELLING',
        toStatus: 'IN_TRANSIT',
        toCrateStatus: 'IN_TRANSIT',
        user,
      });
      setDispatchResult({ ok: true, msg: `Pallet ${palletId} dispatched to labelling` });
      setDispatchScan('');
    } catch (e) {
      setDispatchResult({ error: e.message });
    }
    setDispatchSaving(false);
  }

  // ── RECEIVE step 1: scan incoming pallet ──────────────────────
  async function handleScanIncoming(palletId) {
    setRecvSaving(true);
    try {
      const pallets = await base44.entities.Pallet.filter({ pallet_id: palletId });
      const pallet = pallets[0];
      if (!pallet) { setRecvResult({ error: 'Pallet not found: ' + palletId }); setRecvSaving(false); return; }
      const links = await base44.entities.PalletCrateLink.filter({ pallet_id: palletId });
      setIncomingPallet(pallet);
      setIncomingCrateLinks(links);
      setRecvResult(null);
      setRecvStep(2);
    } catch {
      // offline: accept anyway
      setIncomingPallet({ pallet_id: palletId, id: '_offline_' });
      setIncomingCrateLinks([]);
      setRecvStep(2);
    }
    setRecvSaving(false);
  }

  // ── RECEIVE step 2: scan each crate ───────────────────────────
  function handleScanCrate(crateId) {
    if (scannedCrates.includes(crateId)) return;
    setScannedCrates(prev => [...prev, crateId]);
    setRecvScan('');
  }

  // ── RECEIVE step 3: scan new pallet ───────────────────────────
  function handleNewPallet(id) {
    setNewPalletId(id);
    setRecvScan('');
    setRecvStep(4);
  }

  // ── RECEIVE step 4: scan zone ─────────────────────────────────
  function handleZoneScan(zone) {
    const clean = zone.toUpperCase().trim();
    if (!VALID_ZONES.some(z => clean.includes(z.replace('ZONE-', '').replace('WIP-', '')))) {
      // allow any zone that contains LABEL or LINE or LABELLING
      const isValid = VALID_ZONES.some(v => clean === v) || clean.startsWith('ZONE-') || clean.includes('LABEL');
      if (!isValid) { setRecvResult({ error: 'Invalid zone QR. Must be LABEL-LINE-1 or LABEL-LINE-2' }); return; }
    }
    setZoneId(VALID_ZONES.find(v => v.includes(clean) || clean.includes(v)) || clean);
    setRecvScan('');
    setRecvStep(5);
  }

  // ── RECEIVE step 5: complete ──────────────────────────────────
  async function completeReceive() {
    setRecvSaving(true);
    const toLocation = zoneId || 'WIP-LABELLING-RECEIVE';

    // Create new pallet
    await savePallet({ pallet_id: newPalletId, pallet_type: 'WIP', current_location: toLocation, status: 'RECEIVED', crate_count: scannedCrates.length }, user);
    // Link crates to new pallet
    await linkCratesToPallet(newPalletId, scannedCrates, user);
    // Move each crate
    for (const crateId of scannedCrates) {
      try {
        const crates = await base44.entities.Crate.filter({ crate_id: crateId });
        if (crates.length > 0) {
          await base44.entities.Crate.update(crates[0].id, { current_location: toLocation, status: 'RECEIVED', last_scan_time: new Date().toISOString() });
        }
      } catch {
        enqueue({ type: 'update', entity: 'Crate', data: { crate_id: crateId, current_location: toLocation, status: 'RECEIVED' }, userEmail: user?.email });
      }
      await logMovement({ entityType: 'CRATE', entityId: crateId, from: 'TRANSIT-TO-LABELLING', to: toLocation, user });
    }
    // Close old pallet
    if (incomingPallet && !incomingPallet.id?.startsWith('_offline_')) {
      try {
        await base44.entities.Pallet.update(incomingPallet.id, { status: 'CLOSED' });
      } catch {
        enqueue({ type: 'update', entity: 'Pallet', entityId: incomingPallet.id, data: { status: 'CLOSED' }, userEmail: user?.email });
      }
    }
    await logMovement({ entityType: 'PALLET', entityId: newPalletId, from: 'TRANSIT-TO-LABELLING', to: toLocation, user });

    setRecvResult({ ok: true, msg: `Received! New pallet ${newPalletId} → ${toLocation}` });
    setRecvStep(6);
    setRecvSaving(false);
  }

  function resetReceive() {
    setRecvStep(1); setIncomingPallet(null); setIncomingCrateLinks([]); setScannedCrates([]); setNewPalletId(''); setZoneId(''); setRecvScan(''); setRecvResult(null);
  }

  // ── RENDER ─────────────────────────────────────────────────────
  if (!mode) {
    return (
      <div className="space-y-5">
        {offline && <OfflineBadge count={pendingCount()} />}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transfer / Receiving</h1>
          <p className="text-sm text-slate-500">Dispatch to labelling or receive at labelling</p>
        </div>
        <div className="grid grid-cols-1 gap-4 mt-4">
          <Button onClick={() => setMode('DISPATCH')} className="h-24 rounded-2xl text-xl font-bold bg-teal-600 hover:bg-teal-700 flex-col gap-2">
            <Truck className="w-8 h-8" /> Dispatch to Labelling
          </Button>
          <Button onClick={() => setMode('RECEIVE')} className="h-24 rounded-2xl text-xl font-bold bg-indigo-600 hover:bg-indigo-700 flex-col gap-2">
            <PackageCheck className="w-8 h-8" /> Receive at Labelling
          </Button>
        </div>
      </div>
    );
  }

  // ── DISPATCH VIEW ─────────────────────────────────────────────
  if (mode === 'DISPATCH') {
    return (
      <div className="space-y-5">
        {offline && <OfflineBadge count={pendingCount()} />}
        <button onClick={() => { setMode(null); setDispatchResult(null); }} className="flex items-center gap-1.5 text-sm text-slate-500 font-medium -ml-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="rounded-2xl bg-teal-600 text-white p-5">
          <Truck className="w-8 h-8 mb-2 text-teal-200" />
          <p className="text-xl font-bold">Dispatch to Labelling</p>
          <p className="text-teal-200 text-sm mt-1">Scan POST-CHAMBER pallet</p>
        </div>
        <ScanInput placeholder="Scan pallet ID…" value={dispatchScan} onChange={setDispatchScan} onScan={handleDispatch} />
        {dispatchSaving && <div className="flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}
        {dispatchResult?.ok && <ResultCard ok msg={dispatchResult.msg} />}
        {dispatchResult?.error && <ErrorCard msg={dispatchResult.error} />}
        <Button onClick={() => handleDispatch(dispatchScan)} disabled={!dispatchScan.trim() || dispatchSaving} className="w-full h-16 rounded-2xl text-lg font-bold bg-teal-600 hover:bg-teal-700">
          {dispatchSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Dispatch'}
        </Button>
      </div>
    );
  }

  // ── RECEIVE VIEW ──────────────────────────────────────────────
  const stepTitles = ['', 'Scan Incoming Pallet', 'Scan Each Crate', 'Scan New Pallet', 'Scan Zone QR', 'Confirm Receive', 'Done'];
  return (
    <div className="space-y-5">
      {offline && <OfflineBadge count={pendingCount()} />}
      <button onClick={() => { setMode(null); resetReceive(); }} className="flex items-center gap-1.5 text-sm text-slate-500 font-medium -ml-1">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="rounded-2xl bg-indigo-600 text-white p-5">
        <PackageCheck className="w-8 h-8 mb-2 text-indigo-200" />
        <p className="text-xl font-bold">Receive at Labelling</p>
        <p className="text-indigo-200 text-sm mt-1">Step {recvStep > 5 ? 5 : recvStep} of 5 — {stepTitles[recvStep]}</p>
      </div>

      {/* Step indicators */}
      <div className="flex gap-1">
        {[1,2,3,4,5].map(s => (
          <div key={s} className={`flex-1 h-2 rounded-full ${s <= recvStep ? 'bg-indigo-600' : 'bg-slate-200'}`} />
        ))}
      </div>

      {recvResult?.error && <ErrorCard msg={recvResult.error} onClose={() => setRecvResult(null)} />}

      {/* Step 1: scan incoming */}
      {recvStep === 1 && (
        <div className="space-y-3">
          <ScanInput placeholder="Scan incoming pallet…" value={recvScan} onChange={setRecvScan} onScan={handleScanIncoming} />
          {recvSaving && <div className="flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}
          <Button onClick={() => handleScanIncoming(recvScan)} disabled={!recvScan.trim() || recvSaving} className="w-full h-16 rounded-2xl text-lg font-bold bg-indigo-600 hover:bg-indigo-700">Scan</Button>
        </div>
      )}

      {/* Step 2: scan crates */}
      {recvStep === 2 && (
        <div className="space-y-4">
          <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-3 flex items-center justify-between">
            <span className="text-sm font-medium text-indigo-800">Incoming: {incomingPallet?.pallet_id}</span>
            <span className="font-bold text-indigo-900">{scannedCrates.length} scanned</span>
          </div>
          <ScanInput placeholder="Scan crate…" value={recvScan} onChange={setRecvScan} onScan={handleScanCrate} />
          {scannedCrates.length > 0 && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {scannedCrates.map(c => (
                <div key={c} className="flex items-center justify-between rounded-lg bg-white border border-slate-200 px-3 py-2">
                  <span className="text-sm font-mono font-medium">{c}</span>
                  <button onClick={() => setScannedCrates(prev => prev.filter(x => x !== c))}><X className="w-4 h-4 text-slate-400" /></button>
                </div>
              ))}
            </div>
          )}
          <Button onClick={() => setRecvStep(3)} disabled={scannedCrates.length === 0} className="w-full h-16 rounded-2xl text-lg font-bold bg-indigo-600 hover:bg-indigo-700">
            Done ({scannedCrates.length} crates) → Next
          </Button>
        </div>
      )}

      {/* Step 3: new pallet */}
      {recvStep === 3 && (
        <div className="space-y-3">
          <ScanInput placeholder="Scan new pallet barcode…" value={recvScan} onChange={setRecvScan} onScan={handleNewPallet} />
          <Button onClick={() => handleNewPallet(recvScan)} disabled={!recvScan.trim()} className="w-full h-16 rounded-2xl text-lg font-bold bg-indigo-600 hover:bg-indigo-700">Confirm New Pallet</Button>
        </div>
      )}

      {/* Step 4: zone */}
      {recvStep === 4 && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">New pallet: <strong>{newPalletId}</strong></p>
          <ScanInput placeholder="Scan zone QR (LINE-1 or LINE-2)…" value={recvScan} onChange={setRecvScan} onScan={handleZoneScan} />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => { setZoneId('ZONE-LABEL-LINE-1'); setRecvStep(5); }} className="h-14 rounded-xl font-bold">LINE 1</Button>
            <Button variant="outline" onClick={() => { setZoneId('ZONE-LABEL-LINE-2'); setRecvStep(5); }} className="h-14 rounded-xl font-bold">LINE 2</Button>
          </div>
        </div>
      )}

      {/* Step 5: confirm */}
      {recvStep === 5 && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-2">
            <Row label="Incoming Pallet" val={incomingPallet?.pallet_id} />
            <Row label="New Pallet" val={newPalletId} />
            <Row label="Crates" val={scannedCrates.length} />
            <Row label="Zone" val={zoneId} />
          </div>
          <Button onClick={completeReceive} disabled={recvSaving} className="w-full h-16 rounded-2xl text-lg font-bold bg-emerald-600 hover:bg-emerald-700">
            {recvSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : <><CheckCircle2 className="w-5 h-5 mr-2" /> Complete Receive</>}
          </Button>
        </div>
      )}

      {/* Step 6: done */}
      {recvStep === 6 && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-emerald-600 text-white p-8 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-3 text-emerald-200" />
            <p className="text-2xl font-bold">Received!</p>
            <p className="text-emerald-200 mt-1">{newPalletId} → {zoneId}</p>
            <p className="text-emerald-200 text-sm">{scannedCrates.length} crates</p>
          </div>
          <Button onClick={resetReceive} className="w-full h-14 rounded-2xl font-bold bg-indigo-600 hover:bg-indigo-700">Receive Another</Button>
        </div>
      )}
    </div>
  );
}

function Row({ label, val }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="font-bold text-slate-900">{val}</span>
    </div>
  );
}
function ResultCard({ ok, msg }) {
  return (
    <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
      <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
      <p className="font-semibold text-emerald-900">{msg}</p>
    </div>
  );
}
function ErrorCard({ msg, onClose }) {
  return (
    <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-center justify-between gap-2">
      <p className="text-sm text-red-700 font-medium">{msg}</p>
      {onClose && <button onClick={onClose}><X className="w-4 h-4 text-red-400" /></button>}
    </div>
  );
}
function OfflineBadge({ count }) {
  return (
    <div className="rounded-xl bg-amber-50 border border-amber-300 px-4 py-2 flex items-center gap-2">
      <WifiOff className="w-4 h-4 text-amber-600" />
      <span className="text-sm text-amber-800 font-medium">Offline — {count} action{count !== 1 ? 's' : ''} queued</span>
    </div>
  );
}