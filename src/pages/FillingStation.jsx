import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ScanLine, CheckCircle2, Loader2, AlertCircle, RefreshCw, Printer } from 'lucide-react';
import { saveCrate, savePallet, linkCratesToPallet, logMovement } from '@/components/wip/wipHelpers';
import { pendingCount } from '@/components/wip/offlineQueue';
import { logAudit } from '@/components/AuditLogger';
import ShiftSessionBar from '@/components/shift/ShiftSessionBar';
import { printReactComponent } from '@/components/printing/printLabel';
import CrateLabel6x4 from '@/components/printing/CrateLabel6x4';
import CalibrationLabel6x4 from '@/components/printing/CalibrationLabel6x4';

const LOC_FILLING = 'WIP-FILLING-OUT';

export default function FillingStation() {
  const [user, setUser] = useState(null);
  const [step, setStep] = useState('machine'); // machine | active | scanning | pallet_prompt | pallet_ready
  const [machine, setMachine] = useState(null);
  const [machineInput, setMachineInput] = useState('');
  const [machineError, setMachineError] = useState('');
  const [activeBatch, setActiveBatch] = useState(null); // MachineActiveBatch record
  const [activeBatchError, setActiveBatchError] = useState('');
  const [bottleType, setBottleType] = useState(null); // BottleType record
  const [crateIdScan, setCrateIdScan] = useState('');
  const [pendingCrateId, setPendingCrateId] = useState(null); // waiting for label serial
  const [labelSerialScan, setLabelSerialScan] = useState('');
  const [sessionCrates, setSessionCrates] = useState([]);
  const [capacity, setCapacity] = useState(20);
  const [cratesOnCurrentPallet, setCratesOnCurrentPallet] = useState([]);
  const [palletScan, setPalletScan] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [offline, setOffline] = useState(!navigator.onLine);
  const [reprintInput, setReprintInput] = useState('');
  const [showReprint, setShowReprint] = useState(false);

  const crateRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    loadSetupData();
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  async function loadSetupData() {
    try {
      const settings = await base44.entities.AppSetting.filter({ key: 'WIP_PALLET_CRATE_CAPACITY' });
      if (settings.length > 0) setCapacity(parseInt(settings[0].value) || 20);
    } catch { /* offline */ }
  }

  function printCrateLabel(crateId, filledAt) {
    printReactComponent(CrateLabel6x4, {
      crate_id: crateId,
      product_code: activeBatch?.product_code || '',
      batch_id: activeBatch?.batch_id || '',
      bottle_type: activeBatch?.bottle_type || '',
      filler_machine_id: machine?.machine_id || '',
      filled_at: filledAt,
      operator_name: user?.full_name || user?.email || '',
    });
  }

  async function logPrint(printType, crateId, notes) {
    const now = new Date().toISOString();
    await base44.entities.CrateLabelPrintLog.create({
      log_id: `PLG-${Date.now()}`,
      crate_id: crateId || '',
      filler_machine_id: machine?.machine_id || '',
      batch_id: activeBatch?.batch_id || '',
      product_code: activeBatch?.product_code || '',
      bottle_type: activeBatch?.bottle_type || '',
      printed_at: now,
      printed_by: user?.email || '',
      print_type: printType,
      notes: notes || '',
    }).catch(() => {});
  }

  async function handleCalibrationPrint() {
    printReactComponent(CalibrationLabel6x4, {});
    await logPrint('TEST_CALIBRATION', '', 'Calibration label');
  }

  async function handleReprintCrate() {
    if (!reprintInput.trim()) return;
    const crateId = reprintInput.trim();
    const crates = await base44.entities.Crate.filter({ crate_id: crateId }).catch(() => []);
    const c = crates[0];
    printReactComponent(CrateLabel6x4, {
      crate_id: crateId,
      product_code: c?.product_code || '',
      batch_id: c?.batch_id || '',
      bottle_type: c?.bottle_type || '',
      filler_machine_id: c?.filler_machine_id || machine?.machine_id || '',
      filled_at: c?.filled_time || '',
      operator_name: user?.full_name || user?.email || '',
    });
    await logPrint('REPRINT', crateId, 'Reprint requested');
    setReprintInput('');
    setShowReprint(false);
  }

  async function confirmMachine() {
    setMachineError('');
    if (!machineInput.trim()) return;
    setLoading(true);
    let m = null;
    try {
      const machines = await base44.entities.Machine.filter({ machine_id: machineInput.trim() });
      m = machines[0];
      if (!m) { setMachineError('Machine not found'); setLoading(false); return; }
      if (m.machine_type !== 'FILLER') { setMachineError(`Wrong type: ${m.machine_type}. Need FILLER.`); setLoading(false); return; }
    } catch {
      m = { machine_id: machineInput.trim(), display_name: machineInput.trim() };
    }
    setMachine(m);
    // Look up active batch for this machine
    await loadActiveBatch(m.machine_id);
    setLoading(false);
  }

  async function loadActiveBatch(machineId) {
    setActiveBatchError('');
    try {
      const records = await base44.entities.MachineActiveBatch.filter({ machine_id: machineId, status: 'ACTIVE' });
      if (records.length === 0) {
        setActiveBatch(null);
        setActiveBatchError('No active batch assigned to this filler. Ask Production Manager to assign in Production page.');
      } else {
        const ab = records[0];
        setActiveBatch(ab);
        // Load bottle type details
        const bts = await base44.entities.BottleType.filter({ name: ab.bottle_type });
        setBottleType(bts[0] || null);
        setStep('active');
      }
    } catch {
      setActiveBatch(null);
      setActiveBatchError('Could not check active batch (offline).');
    }
    setStep('active');
  }

  function startScanning() {
    if (!activeBatch || !bottleType) return;
    setStep('scanning');
    setTimeout(() => crateRef.current?.focus(), 100);
  }

  // Step 1: scan crate ID
  function handleCrateIdScan(val) {
    if (!val.trim()) return;
    const crateId = val.trim();
    if (cratesOnCurrentPallet.includes(crateId) || sessionCrates.includes(crateId)) {
      setMsg('⚠ Crate already scanned this session');
      setCrateIdScan('');
      return;
    }
    setPendingCrateId(crateId);
    setCrateIdScan('');
    setMsg(`Crate ${crateId} — now scan its product label serial`);
    setTimeout(() => document.getElementById('label-serial-input')?.focus(), 100);
  }

  // Step 2: scan label serial
  async function handleLabelSerialScan(val) {
    if (!val.trim() || !pendingCrateId) return;
    setLoading(true);
    const serial = val.trim();
    setLabelSerialScan('');
    setMsg('');

    // Check if serial was ever used
    const existing = await base44.entities.CrateLabelSerial.filter({ label_serial: serial }).catch(() => []);
    if (existing.length > 0) {
      setMsg(`⛔ Label serial ${serial} was already used on crate ${existing[0].crate_id}. BLOCKED.`);
      setPendingCrateId(null);
      setLoading(false);
      setTimeout(() => crateRef.current?.focus(), 100);
      return;
    }

    const now = new Date().toISOString();
    const crateId = pendingCrateId;

    // Record the serial
    await base44.entities.CrateLabelSerial.create({
      label_serial: serial,
      crate_id: crateId,
      product_code: activeBatch.product_code,
      batch_id: activeBatch.batch_id,
      filler_machine_id: machine.machine_id,
      used_time: now,
      used_by: user?.email || '',
    }).catch(() => {});

    const crateData = {
      crate_id: crateId,
      bottle_type: activeBatch.bottle_type,
      bottle_count: bottleType?.bottles_per_crate || 0,
      batch_id: activeBatch.batch_id,
      product_code: activeBatch.product_code,
      filler_machine_id: machine.machine_id,
      filled_time: now,
      current_location: LOC_FILLING,
      status: 'FILLED',
      crate_label_serial: serial,
      last_scan_time: now,
      last_scanned_by: user?.email || '',
    };
    await saveCrate(crateData, user);
    await logMovement({ entityType: 'CRATE', entityId: crateId, from: '', to: LOC_FILLING, machineId: machine.machine_id, user });
    await logAudit({ action: 'CrateScanned', entity_type: 'Crate', entity_id: crateId, user, station: machine.machine_id, details: { batch_id: activeBatch.batch_id, product_code: activeBatch.product_code, label_serial: serial } });

    // Auto-print crate label
    printCrateLabel(crateId, now);
    await logPrint('CRATE_LABEL', crateId, '');

    if (activeBatch.id) {
      const newCount = (activeBatch.created_crates || 0) + 1;
      await base44.entities.MachineActiveBatch.update(activeBatch.id, { created_crates: newCount }).catch(() => {});
      setActiveBatch(prev => ({ ...prev, created_crates: newCount }));
    }

    const newCurrent = [...cratesOnCurrentPallet, crateId];
    const newSession = [...sessionCrates, crateId];
    setCratesOnCurrentPallet(newCurrent);
    setSessionCrates(newSession);
    setPendingCrateId(null);
    setLoading(false);

    if (newCurrent.length >= capacity) {
      setStep('pallet_prompt');
    } else {
      setMsg(`✓ Crate ${crateId} + serial ${serial} saved (${newCurrent.length}/${capacity})`);
      setTimeout(() => crateRef.current?.focus(), 50);
    }
  }

  async function handleCreatePallet() {
    if (!palletScan.trim()) return;
    setLoading(true);
    const palletData = {
      pallet_id: palletScan.trim(),
      pallet_type: 'WIP',
      current_location: LOC_FILLING,
      status: 'OPEN',
      crate_count: cratesOnCurrentPallet.length,
      batch_id: activeBatch.batch_id,
      product_code: activeBatch.product_code,
      bottle_type: activeBatch.bottle_type,
    };
    await savePallet(palletData, user);
    await linkCratesToPallet(palletScan.trim(), cratesOnCurrentPallet, user);
    await logMovement({ entityType: 'PALLET', entityId: palletScan.trim(), from: '', to: LOC_FILLING, machineId: machine.machine_id, user });
    // Increment palletized_crates on active batch
    if (activeBatch?.id) {
      const newPalletized = (activeBatch.palletized_crates || 0) + cratesOnCurrentPallet.length;
      await base44.entities.MachineActiveBatch.update(activeBatch.id, { palletized_crates: newPalletized }).catch(() => {});
      setActiveBatch(prev => ({ ...prev, palletized_crates: newPalletized }));
    }
    setLoading(false);
    setStep('pallet_ready');
  }

  function continueAfterPallet() {
    setCratesOnCurrentPallet([]);
    setPalletScan('');
    setStep('scanning');
    setTimeout(() => crateRef.current?.focus(), 100);
  }

  const pending = pendingCount();

  // ── MACHINE SCREEN ─────────────────────────────────────────────────────────
  if (step === 'machine') return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Filling Station</h2>
        {offline && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-semibold">Offline</span>}
        {!offline && pending > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-semibold">{pending} Pending</span>}
      </div>
      <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Scan Filler Machine QR</p>
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
        <Button onClick={confirmMachine} disabled={!machineInput.trim() || loading} className="w-full h-11 rounded-xl">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Machine'}
        </Button>
      </div>
      {(user?.role === 'admin') && (
        <Button variant="outline" className="w-full h-10 rounded-xl gap-2 text-slate-500" onClick={handleCalibrationPrint}>
          <Printer className="w-4 h-4" /> Print Calibration Label (6×4)
        </Button>
      )}
    </div>
  );

  // ── ACTIVE BATCH SCREEN ────────────────────────────────────────────────────
  if (step === 'active') return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Filling Station</h2>
        <button onClick={() => { setMachine(null); setStep('machine'); }} className="text-xs text-slate-400 underline">Change Machine</button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Machine</p>
        <p className="font-bold text-slate-900">{machine.display_name || machine.machine_id}</p>
      </div>

      {activeBatch ? (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 space-y-2">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Active Batch</p>
          <p className="text-2xl font-black text-emerald-900">{activeBatch.batch_id}</p>
          <p className="text-sm text-emerald-700">{activeBatch.product_code} · {activeBatch.bottle_type}</p>
          {bottleType && <p className="text-xs text-emerald-600">{bottleType.bottles_per_crate} bottles/crate</p>}
          <div className="flex gap-3 pt-1">
            <div className="text-center"><p className="text-lg font-black text-emerald-900">{activeBatch.created_crates || 0}</p><p className="text-xs text-emerald-600">Created</p></div>
            <div className="text-center"><p className="text-lg font-black text-emerald-900">{activeBatch.palletized_crates || 0}</p><p className="text-xs text-emerald-600">Palletized</p></div>
            {activeBatch.expected_crates ? <div className="text-center"><p className="text-lg font-black text-slate-500">{activeBatch.expected_crates}</p><p className="text-xs text-slate-400">Expected</p></div> : null}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 space-y-2">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700 font-medium">{activeBatchError || 'No active batch assigned to this filler. Ask Production Manager to assign in Production page.'}</p>
          </div>
        </div>
      )}

      {activeBatch && bottleType && (
        <Button className="w-full rounded-xl h-12 bg-blue-600 hover:bg-blue-700" onClick={startScanning}>Start Scanning Crates</Button>
      )}
      {!activeBatch && (
        <Button variant="outline" className="w-full rounded-xl h-11 gap-2" onClick={() => loadActiveBatch(machine.machine_id)} disabled={loading}>
          <RefreshCw className="w-4 h-4" /> Retry / Refresh
        </Button>
      )}

      {/* Admin-only tools */}
      {user?.role === 'admin' && (
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <Button variant="outline" size="sm" className="w-full gap-2 text-slate-500" onClick={handleCalibrationPrint}>
            <Printer className="w-4 h-4" /> Print Calibration Label (6×4)
          </Button>
          <Button variant="outline" size="sm" className="w-full gap-2 text-slate-500" onClick={() => setShowReprint(v => !v)}>
            <Printer className="w-4 h-4" /> Reprint Crate Label
          </Button>
          {showReprint && (
            <div className="flex gap-2">
              <input
                className="flex-1 h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:border-blue-500"
                placeholder="Scan or type Crate ID…"
                value={reprintInput}
                onChange={e => setReprintInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleReprintCrate()}
              />
              <Button size="sm" onClick={handleReprintCrate} disabled={!reprintInput.trim()}>Print</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ── SCANNING SCREEN ────────────────────────────────────────────────────────
  if (step === 'scanning') return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400">Machine: {machine.machine_id}</p>
          <p className="font-bold text-slate-900">Batch: {activeBatch.batch_id}</p>
          <p className="text-xs text-slate-500">{activeBatch.product_code} · {activeBatch.bottle_type}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-blue-600">{cratesOnCurrentPallet.length}<span className="text-base font-normal text-slate-400">/{capacity}</span></p>
          <p className="text-xs text-slate-400">crates</p>
        </div>
      </div>

      {/* Step 1: Crate ID */}
      {!pendingCrateId && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Step 1 — Scan Crate ID</p>
          <div className="relative">
            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              ref={crateRef}
              className="w-full pl-10 h-14 text-lg rounded-xl border-2 border-blue-400 focus:border-blue-600 focus:outline-none font-mono"
              placeholder="Scan crate barcode…"
              value={crateIdScan}
              onChange={e => setCrateIdScan(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCrateIdScan(crateIdScan); }}
              autoFocus
              disabled={loading}
            />
          </div>
        </div>
      )}

      {/* Step 2: Label serial */}
      {pendingCrateId && (
        <div className="space-y-2">
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-center">
            <p className="text-xs text-blue-500 font-bold uppercase">Crate ID scanned</p>
            <p className="text-lg font-black text-blue-900 font-mono">{pendingCrateId}</p>
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Step 2 — Scan Product Label Serial</p>
          <div className="relative">
            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-400" />
            <input
              id="label-serial-input"
              className="w-full pl-10 h-14 text-lg rounded-xl border-2 border-amber-400 focus:border-amber-600 focus:outline-none font-mono"
              placeholder="Scan label serial barcode…"
              value={labelSerialScan}
              onChange={e => setLabelSerialScan(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleLabelSerialScan(labelSerialScan); }}
              autoFocus
              disabled={loading}
            />
          </div>
          <button className="text-xs text-slate-400 underline" onClick={() => { setPendingCrateId(null); setCrateIdScan(''); setLabelSerialScan(''); setMsg(''); setTimeout(() => crateRef.current?.focus(), 100); }}>
            Cancel — re-scan crate ID
          </button>
        </div>
      )}

      {loading && <div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Saving…</span></div>}
      {msg && <p className={`text-sm font-medium ${msg.startsWith('⛔') ? 'text-red-600' : msg.startsWith('⚠') ? 'text-amber-600' : 'text-emerald-600'}`}>{msg}</p>}

      <div className="flex gap-2">
        <p className="text-xs text-slate-400">Session: {sessionCrates.length} crates total</p>
        <button className="ml-auto text-xs text-slate-400 underline" onClick={() => setStep('active')}>← Back</button>
      </div>
    </div>
  );

  // ── PALLET PROMPT ──────────────────────────────────────────────────────────
  if (step === 'pallet_prompt') return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-center">
        <p className="text-lg font-black text-amber-900">{cratesOnCurrentPallet.length} crates ready</p>
        <p className="text-sm text-amber-700">Scan a pallet barcode to link these crates</p>
      </div>
      <div className="relative">
        <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input className="w-full pl-10 h-14 text-lg rounded-xl border-2 border-amber-400 focus:outline-none font-mono"
          placeholder="Scan pallet barcode…" value={palletScan} onChange={e => setPalletScan(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreatePallet()} autoFocus />
      </div>
      <Button onClick={handleCreatePallet} disabled={!palletScan.trim() || loading} className="w-full h-12 rounded-xl">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Pallet'}
      </Button>
    </div>
  );

  // ── PALLET READY ───────────────────────────────────────────────────────────
  if (step === 'pallet_ready') return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-emerald-500 text-white p-6 text-center">
        <CheckCircle2 className="w-14 h-14 mx-auto mb-2" />
        <p className="text-2xl font-black">PALLET CREATED</p>
        <p className="text-lg font-bold opacity-90">{palletScan}</p>
        <p className="opacity-75 mt-1">{cratesOnCurrentPallet.length} crates linked</p>
      </div>
      <Button className="w-full h-12 rounded-xl" onClick={continueAfterPallet}>
        <RefreshCw className="w-4 h-4 mr-2" /> Continue Scanning
      </Button>
    </div>
  );

  return null;
}