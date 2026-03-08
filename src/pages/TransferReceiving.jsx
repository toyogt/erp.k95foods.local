import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ScanLine, Loader2, CheckCircle2, XCircle, Truck, PackageOpen, ArrowRight, RefreshCw, Package } from 'lucide-react';
import { logMovement } from '@/components/wip/wipHelpers';
import { logAudit } from '@/components/AuditLogger';

const LOC_TRANSIT = 'TRANSIT-TO-LABELLING';
const LOC_DOCK = 'LABELLING-RECEIVING-DOCK';
const VALID_ZONES = ['ZONE-LABEL-LINE-1', 'ZONE-LABEL-LINE-2'];

function BigMsg({ ok, text }) {
  if (!text) return null;
  return (
    <div className={`rounded-2xl p-5 text-center text-white font-bold text-lg ${ok ? 'bg-emerald-500' : 'bg-red-500'}`}>
      {ok ? <CheckCircle2 className="w-8 h-8 mx-auto mb-1" /> : <XCircle className="w-8 h-8 mx-auto mb-1" />}
      {text}
    </div>
  );
}

function ScanBox({ placeholder, value, onChange, onEnter, autoFocus, disabled, color = 'blue' }) {
  const border = color === 'amber' ? 'border-amber-400 focus:border-amber-600' : 'border-blue-400 focus:border-blue-600';
  return (
    <div className="relative">
      <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
      <input
        className={`w-full pl-12 pr-4 h-16 text-xl font-bold rounded-2xl border-2 ${border} focus:outline-none bg-white`}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onEnter && onEnter()}
        autoFocus={autoFocus}
        disabled={disabled}
      />
    </div>
  );
}

// ── MODE A: Dispatch crates ─────────────────────────────────────────
function DispatchMode({ user, onBack }) {
  const [scan, setScan] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [dispatched, setDispatched] = useState([]);

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
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Dispatch Crates</h2>
        <button onClick={onBack} className="text-xs text-slate-400 underline">← Back</button>
      </div>
      <div className="rounded-2xl bg-teal-50 border border-teal-200 p-3 text-sm text-teal-800">
        Scan each crate as it's loaded onto the vehicle for labelling building.
      </div>
      <ScanBox placeholder="Scan crate barcode…" value={scan} onChange={setScan} onEnter={handleScan} autoFocus disabled={loading} />
      {loading && <div className="flex items-center justify-center gap-2 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Saving…</div>}
      <BigMsg ok={result?.ok} text={result?.text} />
      {dispatched.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase">Dispatched this session ({dispatched.length})</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {dispatched.map((d, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="font-mono font-bold">{d.crateId}</span>
                <span className="text-slate-400">{d.product_code} · {d.batch_id}</span>
              </div>
            ))}
          </div>
          <Button className="w-full h-12 rounded-xl bg-teal-600 hover:bg-teal-700 mt-2" onClick={onBack}>
            ✓ Done — {dispatched.length} Crate{dispatched.length !== 1 ? 's' : ''} Dispatched
          </Button>
        </div>
      )}
    </div>
  );
}

// ── MODE B: Receive crates at dock ─────────────────────────────────
function ReceiveDockMode({ user, onBack }) {
  const [scan, setScan] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [received, setReceived] = useState([]);

  async function ensureSession() {
    if (sessionId) return sessionId;
    const sid = 'UNL-' + Date.now().toString(36).toUpperCase();
    await base44.entities.UnloadSession.create({
      session_id: sid,
      started_at: new Date().toISOString(),
      received_by: user?.email || '',
      crate_count: 0,
      status: 'OPEN',
    });
    setSessionId(sid);
    return sid;
  }

  async function handleScan() {
    if (!scan.trim()) return;
    const crateId = scan.trim();
    setScan('');
    setLoading(true);
    setResult(null);
    try {
      const crates = await base44.entities.Crate.filter({ crate_id: crateId });
      const crate = crates[0];
      if (!crate) { setResult({ ok: false, text: `Crate ${crateId} not found in system` }); setLoading(false); return; }

      // Validity checks
      if (crate.status === 'RECEIVED_UNASSIGNED' || crate.status === 'RECEIVED' || crate.status === 'STORED' || crate.status === 'CONSUMED') {
        setResult({ ok: false, text: `Crate ${crateId} already received (status: ${crate.status})` });
        setLoading(false); return;
      }
      if (crate.status === 'EMPTY_RETURNED') {
        setResult({ ok: false, text: `Crate ${crateId} is marked EMPTY_RETURNED` });
        setLoading(false); return;
      }

      const sid = await ensureSession();
      await base44.entities.Crate.update(crate.id, {
        status: 'RECEIVED_UNASSIGNED',
        current_location: LOC_DOCK,
        received_session_id: sid,
        last_scan_time: new Date().toISOString(),
        last_scanned_by: user?.email || '',
      });
      // Update session crate_count
      const sessions = await base44.entities.UnloadSession.filter({ session_id: sid });
      if (sessions[0]) {
        await base44.entities.UnloadSession.update(sessions[0].id, { crate_count: (sessions[0].crate_count || 0) + 1 });
      }
      await logAudit({ action: 'CrateReceived', entity_type: 'Crate', entity_id: crateId, user, station: 'DOCK', details: { session_id: sid } });
      setReceived(prev => [...prev, { crateId, product_code: crate.product_code, batch_id: crate.batch_id, bottle_type: crate.bottle_type }]);
      setResult({ ok: true, text: `✓ ${crateId} received\n${crate.product_code || ''} · ${crate.batch_id || ''} · ${crate.bottle_type || ''}` });
    } catch (e) {
      setResult({ ok: false, text: e.message || 'Error' });
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Receive Crates</h2>
        <button onClick={onBack} className="text-xs text-slate-400 underline">← Back</button>
      </div>
      <div className="rounded-2xl bg-slate-100 border border-slate-200 p-3 text-sm text-slate-700">
        Scan each crate as it arrives from the vehicle. No pallet ID required.
        {sessionId && <span className="ml-2 text-xs text-slate-400 font-mono">Session: {sessionId}</span>}
      </div>
      <ScanBox placeholder="Scan crate barcode…" value={scan} onChange={setScan} onEnter={handleScan} autoFocus disabled={loading} />
      {loading && <div className="flex items-center justify-center gap-2 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Saving…</div>}
      <BigMsg ok={result?.ok} text={result?.text} />
      {received.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase">Received this session ({received.length})</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {received.map((d, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="font-mono font-bold">{d.crateId}</span>
                <span className="text-slate-400 text-xs">{d.product_code} · {d.batch_id}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MODE C: Load empty crates onto return vehicle ───────────────────
function LoadEmptiesMode({ user, onBack }) {
  const [scan, setScan] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [loaded, setLoaded] = useState([]);

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
      if (crate.status !== 'CONSUMED' && crate.status !== 'EMPTY_RETURNED') {
        setResult({ ok: false, text: `Crate ${crateId} status is "${crate.status}" — only CONSUMED crates can be returned` });
        setLoading(false); return;
      }
      await base44.entities.Crate.update(crate.id, {
        status: 'EMPTY_RETURNED',
        current_location: 'TRANSIT-TO-FILLING',
        last_scan_time: new Date().toISOString(),
        last_scanned_by: user?.email || '',
      });
      await logAudit({ action: 'CrateEmptyReturned', entity_type: 'Crate', entity_id: crateId, user, station: 'DOCK' });
      setLoaded(prev => [...prev, crateId]);
      setResult({ ok: true, text: `✓ ${crateId} marked as empty return` });
    } catch (e) {
      setResult({ ok: false, text: e.message || 'Error' });
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Load Empty Crates</h2>
        <button onClick={onBack} className="text-xs text-slate-400 underline">← Back</button>
      </div>
      <div className="rounded-2xl bg-slate-100 border border-slate-200 p-3 text-sm text-slate-700">
        Scan each empty crate while loading onto the return vehicle.
      </div>
      <ScanBox placeholder="Scan empty crate barcode…" value={scan} onChange={setScan} onEnter={handleScan} autoFocus disabled={loading} />
      {loading && <div className="flex items-center justify-center gap-2 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Saving…</div>}
      <BigMsg ok={result?.ok} text={result?.text} />
      {loaded.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-500 uppercase">Loaded ({loaded.length})</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {loaded.map((id, i) => <span key={i} className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded">{id}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MODE D: Putaway to Zone ─────────────────────────────────────────
function PutawayMode({ user, onBack }) {
  const [phase, setPhase] = useState('pallet'); // pallet | crates | zone | done
  const [palletScan, setPalletScan] = useState('');
  const [currentPalletId, setCurrentPalletId] = useState('');
  const [palletMeta, setPalletMeta] = useState(null); // { product_code, batch_id, bottle_type } locked from first crate
  const [scannedCrates, setScannedCrates] = useState([]); // [{ crateId, product_code, batch_id, bottle_type }]
  const [crateScan, setCrateScan] = useState('');
  const [zoneScan, setZoneScan] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }
  const [allPallets, setAllPallets] = useState([]); // pallets used in this putaway session

  function startPallet() {
    if (!palletScan.trim()) return;
    setCurrentPalletId(palletScan.trim());
    setPalletScan('');
    setPalletMeta(null);
    setPhase('crates');
    setMsg(null);
  }

  function switchPallet() {
    // save current pallet crates to allPallets list then reset
    if (currentPalletId && scannedCrates.length > 0) {
      setAllPallets(prev => {
        const existing = prev.find(p => p.palletId === currentPalletId);
        if (existing) {
          return prev.map(p => p.palletId === currentPalletId ? { ...p, crates: [...p.crates, ...scannedCrates] } : p);
        }
        return [...prev, { palletId: currentPalletId, meta: palletMeta, crates: [...scannedCrates] }];
      });
    }
    setScannedCrates([]);
    setPalletMeta(null);
    setCurrentPalletId('');
    setPalletScan('');
    setPhase('pallet');
    setMsg({ ok: true, text: `Pallet saved. Scan next pallet or proceed to zone.` });
  }

  function proceedToZone() {
    // save current pallet crates
    if (currentPalletId && scannedCrates.length > 0) {
      setAllPallets(prev => {
        const existing = prev.find(p => p.palletId === currentPalletId);
        if (existing) {
          return prev.map(p => p.palletId === currentPalletId ? { ...p, crates: [...p.crates, ...scannedCrates] } : p);
        }
        return [...prev, { palletId: currentPalletId, meta: palletMeta, crates: [...scannedCrates] }];
      });
    }
    setScannedCrates([]);
    setCurrentPalletId('');
    setPhase('zone');
    setMsg(null);
  }

  async function handleCrateScan() {
    if (!crateScan.trim()) return;
    const crateId = crateScan.trim();
    setCrateScan('');
    setMsg(null);

    if (scannedCrates.find(c => c.crateId === crateId)) {
      setMsg({ ok: false, text: `Crate ${crateId} already scanned on this pallet` });
      return;
    }

    setLoading(true);
    try {
      const crates = await base44.entities.Crate.filter({ crate_id: crateId });
      const crate = crates[0];
      if (!crate) { setMsg({ ok: false, text: `Crate ${crateId} not found` }); setLoading(false); return; }
      if (crate.status !== 'RECEIVED_UNASSIGNED') {
        setMsg({ ok: false, text: `Crate ${crateId} is not at dock (status: ${crate.status})` });
        setLoading(false); return;
      }

      // Enforce pallet type lock
      if (!palletMeta) {
        // First crate — lock pallet to this product/batch/bottle
        if (!crate.product_code || !crate.batch_id || !crate.bottle_type) {
          setMsg({ ok: false, text: `Crate ${crateId} is missing product_code, batch_id, or bottle_type — cannot put away` });
          setLoading(false); return;
        }
        setPalletMeta({ product_code: crate.product_code, batch_id: crate.batch_id, bottle_type: crate.bottle_type });
      } else {
        // Subsequent crates — strict match
        if (crate.product_code !== palletMeta.product_code || crate.batch_id !== palletMeta.batch_id || crate.bottle_type !== palletMeta.bottle_type) {
          setMsg({ ok: false, text: `REJECTED — pallet is locked to ${palletMeta.product_code} / ${palletMeta.batch_id}. This crate is ${crate.product_code} / ${crate.batch_id}. No mixing allowed.` });
          setLoading(false); return;
        }
      }

      setScannedCrates(prev => [...prev, { crateId, product_code: crate.product_code, batch_id: crate.batch_id, bottle_type: crate.bottle_type }]);
      const currentMeta = palletMeta || { product_code: crate.product_code, batch_id: crate.batch_id, bottle_type: crate.bottle_type };
      setMsg({ ok: true, text: `✓ ${crateId} added (${scannedCrates.length + 1} crates)\n${currentMeta.product_code} · ${currentMeta.batch_id}` });
    } catch (e) {
      setMsg({ ok: false, text: e.message || 'Error' });
    }
    setLoading(false);
  }

  async function handleZoneScan() {
    if (!zoneScan.trim()) return;
    const zone = zoneScan.trim().toUpperCase();
    setZoneScan('');
    if (!VALID_ZONES.includes(zone)) {
      setMsg({ ok: false, text: `Invalid zone: ${zone}. Must be ZONE-LABEL-LINE-1 or ZONE-LABEL-LINE-2` });
      return;
    }

    setLoading(true);
    setMsg(null);
    try {
      // Check zone lock
      const locks = await base44.entities.ZoneLock.filter({ zone_id: zone, is_active: true });
      const lock = locks[0];

      // Get the representative meta from all pallets
      const allCrateMeta = allPallets.length > 0 ? allPallets[0].meta : null;
      if (!allCrateMeta) {
        setMsg({ ok: false, text: 'No crates to put away.' });
        setLoading(false); return;
      }

      if (lock) {
        // Zone is locked — check if it matches
        if (lock.product_code !== allCrateMeta.product_code || lock.batch_id !== allCrateMeta.batch_id) {
          setMsg({ ok: false, text: `Zone ${zone} is locked to ${lock.product_code} / ${lock.batch_id}.\nYour pallets are ${allCrateMeta.product_code} / ${allCrateMeta.batch_id}.\n\nTransfer existing zone contents to HOLD first.` });
          setLoading(false); return;
        }
      } else {
        // Create new zone lock
        await base44.entities.ZoneLock.create({
          zone_id: zone,
          product_code: allCrateMeta.product_code,
          batch_id: allCrateMeta.batch_id,
          locked_at: new Date().toISOString(),
          locked_by: user?.email || '',
          is_active: true,
        });
      }

      // Move all pallets + crates to zone
      const now = new Date().toISOString();
      for (const palletEntry of allPallets) {
        // Upsert pallet
        const existingPallets = await base44.entities.Pallet.filter({ pallet_id: palletEntry.palletId });
        let palletDbId;
        const palletData = {
          pallet_id: palletEntry.palletId,
          pallet_type: 'WIP',
          current_location: zone,
          status: 'AT_ZONE',
          crate_count: palletEntry.crates.length,
          batch_id: palletEntry.meta?.batch_id || '',
          product_code: palletEntry.meta?.product_code || '',
          bottle_type: palletEntry.meta?.bottle_type || '',
        };
        if (existingPallets.length > 0) {
          await base44.entities.Pallet.update(existingPallets[0].id, palletData);
          palletDbId = existingPallets[0].id;
        } else {
          const created = await base44.entities.Pallet.create(palletData);
          palletDbId = created.id;
        }
        await logMovement({ entityType: 'PALLET', entityId: palletEntry.palletId, from: LOC_DOCK, to: zone, user });

        // Link crates and update each
        for (const c of palletEntry.crates) {
          const crates = await base44.entities.Crate.filter({ crate_id: c.crateId });
          if (crates.length > 0) {
            await base44.entities.Crate.update(crates[0].id, {
              status: 'RECEIVED',
              current_location: zone,
              last_scan_time: now,
              last_scanned_by: user?.email || '',
            });
          }
          // Link to pallet
          const existing = await base44.entities.PalletCrateLink.filter({ pallet_id: palletEntry.palletId, crate_id: c.crateId });
          if (existing.length === 0) {
            await base44.entities.PalletCrateLink.create({ pallet_id: palletEntry.palletId, crate_id: c.crateId });
          }
          await logMovement({ entityType: 'CRATE', entityId: c.crateId, from: LOC_DOCK, to: zone, user });
        }
        await logAudit({ action: `PutawayComplete: pallet ${palletEntry.palletId} → ${zone}`, entity_type: 'Pallet', entity_id: palletEntry.palletId, user, station: zone });
      }

      setMsg({ ok: true, text: `✓ Putaway complete!\n${allPallets.length} pallet(s) → ${zone}` });
      setPhase('done');
    } catch (e) {
      setMsg({ ok: false, text: e.message || 'Error completing putaway' });
    }
    setLoading(false);
  }

  const totalCrates = allPallets.reduce((s, p) => s + p.crates.length, 0) + scannedCrates.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Putaway to Zone</h2>
        <button onClick={onBack} className="text-xs text-slate-400 underline">← Back</button>
      </div>

      {/* Phase: scan pallet */}
      {phase === 'pallet' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            {allPallets.length > 0
              ? `${allPallets.length} pallet(s) loaded (${totalCrates} crates). Scan next pallet or go to zone.`
              : 'Scan a pallet ID to start loading crates for putaway.'}
          </div>
          <ScanBox placeholder="Scan pallet barcode…" value={palletScan} onChange={setPalletScan} onEnter={startPallet} autoFocus color="amber" />
          <Button className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-white" onClick={startPallet} disabled={!palletScan.trim()}>
            Use This Pallet
          </Button>
          {allPallets.length > 0 && (
            <Button className="w-full h-12 rounded-xl" onClick={() => setPhase('zone')}>
              <ArrowRight className="w-4 h-4 mr-2" /> Proceed to Zone Scan
            </Button>
          )}
          {msg && <BigMsg ok={msg.ok} text={msg.text} />}
        </div>
      )}

      {/* Phase: scan crates */}
      {phase === 'crates' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-900 text-white p-4">
            <p className="text-xs text-slate-400">Pallet</p>
            <p className="font-bold text-lg">{currentPalletId}</p>
            {palletMeta && <p className="text-sm text-slate-300 mt-1">{palletMeta.product_code} · {palletMeta.batch_id} · {palletMeta.bottle_type}</p>}
            {palletMeta && <p className="text-xs text-amber-400 mt-1">LOCKED — mixed crates will be rejected</p>}
          </div>
          <div className="flex justify-between text-sm text-slate-600 font-medium">
            <span>{scannedCrates.length} crates on this pallet</span>
            <span>{totalCrates} total</span>
          </div>
          <ScanBox placeholder="Scan crate barcode…" value={crateScan} onChange={setCrateScan} onEnter={handleCrateScan} autoFocus disabled={loading} />
          {loading && <div className="flex justify-center text-slate-400 gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Checking…</div>}
          {msg && <BigMsg ok={msg.ok} text={msg.text} />}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-12 rounded-xl" onClick={switchPallet} disabled={scannedCrates.length === 0}>
              Switch Pallet
            </Button>
            <Button className="h-12 rounded-xl bg-blue-600 hover:bg-blue-700" onClick={proceedToZone} disabled={scannedCrates.length === 0}>
              Done → Zone
            </Button>
          </div>
        </div>
      )}

      {/* Phase: scan zone */}
      {phase === 'zone' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-xs text-slate-500 font-bold uppercase">Ready for Putaway</p>
            <p className="text-2xl font-black text-slate-900">{totalCrates} crates</p>
            <p className="text-sm text-slate-500">{allPallets.length} pallet(s)</p>
          </div>
          <p className="text-sm font-semibold text-slate-700 uppercase tracking-widest">Scan Zone QR</p>
          <ScanBox placeholder="Scan ZONE-LABEL-LINE-1 or …-2" value={zoneScan} onChange={setZoneScan} onEnter={handleZoneScan} autoFocus disabled={loading} />
          {loading && <div className="flex justify-center text-slate-400 gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Processing putaway…</div>}
          {msg && <BigMsg ok={msg.ok} text={msg.text} />}
        </div>
      )}

      {/* Done */}
      {phase === 'done' && (
        <div className="space-y-4">
          <BigMsg ok={true} text={msg?.text || 'Putaway complete!'} />
          <Button className="w-full h-12 rounded-xl" onClick={() => {
            setPhase('pallet'); setAllPallets([]); setScannedCrates([]);
            setPalletMeta(null); setCurrentPalletId(''); setMsg(null);
          }}>
            <RefreshCw className="w-4 h-4 mr-2" /> Start New Putaway
          </Button>
        </div>
      )}
    </div>
  );
}

// ── SUPERVISOR TRANSFERS ─────────────────────────────────────────────
function SupervisorTransfers({ user, onBack }) {
  const [subMode, setSubMode] = useState(null); // 'hold' | 'between'
  const [scan, setScan] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [targetZone, setTargetZone] = useState('');

  const isSupervisor = user?.role === 'admin' || user?.role === 'labelling_supervisor' || user?.role === 'production_manager';
  if (!isSupervisor) return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-xs text-slate-400 underline">← Back</button>
      <div className="rounded-2xl bg-red-50 border border-red-200 p-6 text-center text-red-700 font-bold">
        Supervisor access required.
      </div>
    </div>
  );

  async function handleTransferToHold() {
    if (!scan.trim()) return;
    const id = scan.trim();
    setScan(''); setResult(null); setLoading(true);
    try {
      // Try crate first
      const crates = await base44.entities.Crate.filter({ crate_id: id });
      if (crates.length > 0) {
        const crate = crates[0];
        const from = crate.current_location;
        await base44.entities.Crate.update(crate.id, { current_location: 'HOLD-LABELLING', status: 'STORED', last_scan_time: new Date().toISOString() });
        await logMovement({ entityType: 'CRATE', entityId: id, from, to: 'HOLD-LABELLING', user });
        await logAudit({ action: 'SupervisorTransferToHold', entity_type: 'Crate', entity_id: id, user, station: 'SUPERVISOR', details: { from } });
        setResult({ ok: true, text: `Crate ${id} → HOLD-LABELLING` });
        setLoading(false); return;
      }
      // Try pallet
      const pallets = await base44.entities.Pallet.filter({ pallet_id: id });
      if (pallets.length > 0) {
        const pallet = pallets[0];
        const from = pallet.current_location;
        await base44.entities.Pallet.update(pallet.id, { current_location: 'HOLD-LABELLING', status: 'RECEIVED' });
        // Move all linked crates
        const links = await base44.entities.PalletCrateLink.filter({ pallet_id: id });
        for (const link of links) {
          const cs = await base44.entities.Crate.filter({ crate_id: link.crate_id });
          if (cs.length > 0) await base44.entities.Crate.update(cs[0].id, { current_location: 'HOLD-LABELLING', status: 'STORED' });
        }
        await logMovement({ entityType: 'PALLET', entityId: id, from, to: 'HOLD-LABELLING', user });
        await logAudit({ action: 'SupervisorTransferToHold', entity_type: 'Pallet', entity_id: id, user, station: 'SUPERVISOR', details: { from, crate_count: links.length } });
        setResult({ ok: true, text: `Pallet ${id} + ${links.length} crates → HOLD-LABELLING` });
        setLoading(false); return;
      }
      setResult({ ok: false, text: `Not found: ${id}` });
    } catch (e) {
      setResult({ ok: false, text: e.message || 'Error' });
    }
    setLoading(false);
  }

  async function handleTransferBetweenLines() {
    if (!scan.trim() || !targetZone) return;
    const id = scan.trim();
    setScan(''); setResult(null); setLoading(true);
    try {
      const zone = targetZone;
      // Check zone lock
      const locks = await base44.entities.ZoneLock.filter({ zone_id: zone, is_active: true });
      const lock = locks[0];

      // Get pallet to check meta
      const pallets = await base44.entities.Pallet.filter({ pallet_id: id });
      if (pallets.length === 0) { setResult({ ok: false, text: `Pallet ${id} not found` }); setLoading(false); return; }
      const pallet = pallets[0];

      if (lock && (lock.product_code !== pallet.product_code || lock.batch_id !== pallet.batch_id)) {
        setResult({ ok: false, text: `Zone ${zone} is locked to ${lock.product_code}/${lock.batch_id}. Transfer existing content to HOLD first.` });
        setLoading(false); return;
      }

      if (!lock) {
        await base44.entities.ZoneLock.create({ zone_id: zone, product_code: pallet.product_code, batch_id: pallet.batch_id, locked_at: new Date().toISOString(), locked_by: user?.email || '', is_active: true });
      }

      const from = pallet.current_location;
      await base44.entities.Pallet.update(pallet.id, { current_location: zone, status: 'AT_ZONE' });
      const links = await base44.entities.PalletCrateLink.filter({ pallet_id: id });
      for (const link of links) {
        const cs = await base44.entities.Crate.filter({ crate_id: link.crate_id });
        if (cs.length > 0) await base44.entities.Crate.update(cs[0].id, { current_location: zone, status: 'RECEIVED' });
      }
      await logMovement({ entityType: 'PALLET', entityId: id, from, to: zone, user });
      await logAudit({ action: `SupervisorTransfer: ${id} → ${zone}`, entity_type: 'Pallet', entity_id: id, user, station: 'SUPERVISOR' });
      setResult({ ok: true, text: `Pallet ${id} → ${zone}` });
    } catch (e) {
      setResult({ ok: false, text: e.message || 'Error' });
    }
    setLoading(false);
  }

  if (!subMode) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Supervisor Transfers</h2>
        <button onClick={onBack} className="text-xs text-slate-400 underline">← Back</button>
      </div>
      <button onClick={() => setSubMode('hold')} className="w-full bg-orange-600 text-white rounded-2xl p-5 text-left">
        <p className="font-bold text-lg">Transfer to HOLD</p>
        <p className="text-sm opacity-80 mt-1">Move pallet or crate to HOLD-LABELLING area</p>
      </button>
      <button onClick={() => setSubMode('between')} className="w-full bg-purple-600 text-white rounded-2xl p-5 text-left">
        <p className="font-bold text-lg">Transfer Between Lines</p>
        <p className="text-sm opacity-80 mt-1">Move pallet from one zone to another (breakdown recovery)</p>
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">{subMode === 'hold' ? 'Transfer to HOLD' : 'Transfer Between Lines'}</h2>
        <button onClick={() => { setSubMode(null); setResult(null); }} className="text-xs text-slate-400 underline">← Back</button>
      </div>
      {subMode === 'between' && (
        <div>
          <p className="text-sm font-medium text-slate-600 mb-1">Target Zone</p>
          <div className="flex gap-2">
            {VALID_ZONES.map(z => (
              <button key={z} onClick={() => setTargetZone(z)}
                className={`flex-1 p-3 rounded-xl border text-sm font-bold ${targetZone === z ? 'bg-slate-900 text-white' : 'bg-white border-slate-300 text-slate-700'}`}>
                {z.replace('ZONE-LABEL-', '')}
              </button>
            ))}
          </div>
        </div>
      )}
      <ScanBox
        placeholder={subMode === 'hold' ? 'Scan pallet or crate…' : 'Scan pallet barcode…'}
        value={scan} onChange={setScan}
        onEnter={subMode === 'hold' ? handleTransferToHold : handleTransferBetweenLines}
        autoFocus disabled={loading || (subMode === 'between' && !targetZone)}
      />
      {loading && <div className="flex justify-center text-slate-400 gap-2"><Loader2 className="w-4 h-4 animate-spin" /></div>}
      {result && <BigMsg ok={result.ok} text={result.text} />}
    </div>
  );
}

// ── MAIN PAGE ────────────────────────────────────────────────────────
export default function TransferReceiving() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isSupervisor = user?.role === 'admin' || user?.role === 'labelling_supervisor' || user?.role === 'production_manager';

  if (mode === 'receive_dock') return <ReceiveDockMode user={user} onBack={() => setMode(null)} />;
  if (mode === 'load_empties') return <LoadEmptiesMode user={user} onBack={() => setMode(null)} />;
  if (mode === 'putaway') return <PutawayMode user={user} onBack={() => setMode(null)} />;
  if (mode === 'supervisor') return <SupervisorTransfers user={user} onBack={() => setMode(null)} />;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900">Transfer / Receiving</h2>
      <div className="space-y-3">
        <button onClick={() => setMode('receive_dock')} className="w-full bg-slate-800 text-white rounded-2xl p-5 flex items-center gap-4 active:scale-95 transition-transform">
          <PackageOpen className="w-10 h-10 flex-shrink-0" />
          <div className="text-left">
            <p className="text-lg font-bold">Receive Crates (Dock)</p>
            <p className="text-sm opacity-80">Scan crates as they arrive — no pallet needed</p>
          </div>
        </button>
        <button onClick={() => setMode('load_empties')} className="w-full bg-slate-600 text-white rounded-2xl p-5 flex items-center gap-4 active:scale-95 transition-transform">
          <Package className="w-10 h-10 flex-shrink-0" />
          <div className="text-left">
            <p className="text-lg font-bold">Load Empty Crates</p>
            <p className="text-sm opacity-80">Scan empties onto return vehicle</p>
          </div>
        </button>
        <button onClick={() => setMode('putaway')} className="w-full bg-blue-700 text-white rounded-2xl p-5 flex items-center gap-4 active:scale-95 transition-transform">
          <ArrowRight className="w-10 h-10 flex-shrink-0" />
          <div className="text-left">
            <p className="text-lg font-bold">Putaway to Line Zone</p>
            <p className="text-sm opacity-80">Pallet → crates → zone scan</p>
          </div>
        </button>
        {isSupervisor && (
          <button onClick={() => setMode('supervisor')} className="w-full bg-orange-700 text-white rounded-2xl p-5 flex items-center gap-4 active:scale-95 transition-transform">
            <RefreshCw className="w-10 h-10 flex-shrink-0" />
            <div className="text-left">
              <p className="text-lg font-bold">Supervisor Transfers</p>
              <p className="text-sm opacity-80">Transfer to HOLD or between lines</p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}