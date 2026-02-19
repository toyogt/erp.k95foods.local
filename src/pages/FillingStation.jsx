import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ScanLine, CheckCircle2, Loader2, AlertCircle, RefreshCw, ShieldAlert, Lock } from 'lucide-react';
import { saveCrate, savePallet, linkCratesToPallet, logMovement } from '@/components/wip/wipHelpers';
import { pendingCount } from '@/components/wip/offlineQueue';
import { logAudit } from '@/components/AuditLogger';
import { raiseAlert } from '@/components/alerts/alertHelpers';

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
  const [crateScan, setCrateScan] = useState('');
  const [sessionCrates, setSessionCrates] = useState([]);
  const [capacity, setCapacity] = useState(20);
  const [cratesOnCurrentPallet, setCratesOnCurrentPallet] = useState([]);
  const [palletScan, setPalletScan] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [offline, setOffline] = useState(!navigator.onLine);
  // Supervisor panel
  const [showSupervisorPanel, setShowSupervisorPanel] = useState(false);
  const [supervisorAction, setSupervisorAction] = useState(''); // assign | close | change
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedBottleTypeStr, setSelectedBottleTypeStr] = useState('');
  const [productCodeInput, setProductCodeInput] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [bottleTypes, setBottleTypes] = useState([]);
  // Close batch enforcement
  const [closeBlockMsg, setCloseBlockMsg] = useState('');
  const [showCloseOverride, setShowCloseOverride] = useState(false);
  const [closeOverridePIN, setCloseOverridePIN] = useState('');
  const [closeOverrideReason, setCloseOverrideReason] = useState('');
  const SUPERVISOR_PIN = '1234'; // In prod, store in AppSetting

  const crateRef = useRef(null);

  const isSupervisor = user?.role === 'admin' || user?.role === 'labelling_supervisor' || user?.role === 'production_manager';

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
      const [bt, settings, batchList] = await Promise.all([
        base44.entities.BottleType.list(),
        base44.entities.AppSetting.filter({ key: 'WIP_PALLET_CRATE_CAPACITY' }),
        base44.entities.Batch.filter({ status: 'APPROVED' }),
      ]);
      setBottleTypes(bt);
      setBatches(batchList);
      if (settings.length > 0) setCapacity(parseInt(settings[0].value) || 20);
    } catch { /* offline */ }
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
        setActiveBatchError('No active batch assigned to this machine. A supervisor must assign a batch.');
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
  }

  function startScanning() {
    if (!activeBatch || !bottleType) return;
    setStep('scanning');
    setTimeout(() => crateRef.current?.focus(), 100);
  }

  async function handleCrateScan(val) {
    if (!val.trim()) return;
    setLoading(true);
    setMsg('');
    const now = new Date().toISOString();
    const crateData = {
      crate_id: val.trim(),
      bottle_type: activeBatch.bottle_type,
      bottle_count: bottleType?.bottles_per_crate || 0,
      batch_id: activeBatch.batch_id,
      product_code: activeBatch.product_code,
      filler_machine_id: machine.machine_id,
      filled_time: now,
      current_location: LOC_FILLING,
      status: 'FILLED',
      last_scan_time: now,
      last_scanned_by: user?.email || '',
    };
    await saveCrate(crateData, user);
    await logMovement({ entityType: 'CRATE', entityId: val.trim(), from: '', to: LOC_FILLING, machineId: machine.machine_id, user });
    await logAudit({ action: 'CrateScanned', entity_type: 'Crate', entity_id: val.trim(), user, station: machine.machine_id, details: { batch_id: activeBatch.batch_id, product_code: activeBatch.product_code } });

    const newCurrent = [...cratesOnCurrentPallet, val.trim()];
    const newSession = [...sessionCrates, val.trim()];
    setCratesOnCurrentPallet(newCurrent);
    setSessionCrates(newSession);
    setCrateScan('');
    setLoading(false);

    if (newCurrent.length >= capacity) {
      setStep('pallet_prompt');
    } else {
      setMsg(`✓ Crate ${val.trim()} scanned (${newCurrent.length}/${capacity})`);
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
    };
    await savePallet(palletData, user);
    await linkCratesToPallet(palletScan.trim(), cratesOnCurrentPallet, user);
    await logMovement({ entityType: 'PALLET', entityId: palletScan.trim(), from: '', to: LOC_FILLING, machineId: machine.machine_id, user });
    setLoading(false);
    setStep('pallet_ready');
  }

  function continueAfterPallet() {
    setCratesOnCurrentPallet([]);
    setPalletScan('');
    setStep('scanning');
    setTimeout(() => crateRef.current?.focus(), 100);
  }

  // Supervisor actions
  async function handleAssignBatch() {
    if (!selectedBatch || !selectedBottleTypeStr || !productCodeInput.trim()) { alert('Fill all fields'); return; }
    setLoading(true);
    const now = new Date().toISOString();
    // Close any existing active batch
    const existing = await base44.entities.MachineActiveBatch.filter({ machine_id: machine.machine_id, status: 'ACTIVE' }).catch(() => []);
    for (const e of existing) {
      await base44.entities.MachineActiveBatch.update(e.id, { status: 'CLOSED', closed_by: user?.email, closed_at: now, change_reason: changeReason || 'Replaced by new assignment' }).catch(() => {});
    }
    await base44.entities.MachineActiveBatch.create({
      machine_id: machine.machine_id,
      batch_id: selectedBatch,
      product_code: productCodeInput.trim(),
      bottle_type: selectedBottleTypeStr,
      status: 'ACTIVE',
      assigned_by: user?.email || '',
      assigned_at: now,
    });
    await logAudit({ action: `BatchAssigned to ${machine.machine_id}`, entity_type: 'MachineActiveBatch', entity_id: machine.machine_id, user, details: { batch_id: selectedBatch, product_code: productCodeInput } });
    setShowSupervisorPanel(false);
    setSupervisorAction('');
    setChangeReason('');
    await loadActiveBatch(machine.machine_id);
    setLoading(false);
  }

  async function handleCloseBatch() {
    if (!activeBatch) return;
    setLoading(true);
    await base44.entities.MachineActiveBatch.update(activeBatch.id, { status: 'CLOSED', closed_by: user?.email, closed_at: new Date().toISOString() });
    await logAudit({ action: `BatchClosed on ${machine.machine_id}`, entity_type: 'MachineActiveBatch', entity_id: machine.machine_id, user });
    setActiveBatch(null);
    setBottleType(null);
    setActiveBatchError('Batch closed. Assign a new batch to continue.');
    setStep('active');
    setShowSupervisorPanel(false);
    setLoading(false);
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
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Scan Machine QR</p>
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
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 space-y-1">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Active Batch</p>
          <p className="text-2xl font-black text-emerald-900">{activeBatch.batch_id}</p>
          <p className="text-sm text-emerald-700">{activeBatch.product_code} · {activeBatch.bottle_type}</p>
          {bottleType && <p className="text-xs text-emerald-600">{bottleType.bottles_per_crate} bottles/crate</p>}
        </div>
      ) : (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{activeBatchError || 'No active batch.'}</p>
        </div>
      )}

      <div className="flex gap-2">
        {activeBatch && bottleType && (
          <Button className="flex-1 rounded-xl h-12 bg-blue-600 hover:bg-blue-700" onClick={startScanning}>Start Scanning Crates</Button>
        )}
        {isSupervisor && (
          <Button variant="outline" className="rounded-xl h-12 gap-2" onClick={() => setShowSupervisorPanel(!showSupervisorPanel)}>
            <ShieldAlert className="w-4 h-4" /> Supervisor
          </Button>
        )}
      </div>

      {isSupervisor && showSupervisorPanel && (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Supervisor Controls</p>
          {['assign', 'close', 'change'].map(action => (
            <Button key={action} variant={supervisorAction === action ? 'default' : 'outline'} size="sm"
              className="rounded-xl mr-2 capitalize" onClick={() => setSupervisorAction(supervisorAction === action ? '' : action)}>
              {action === 'assign' ? 'Assign Batch' : action === 'close' ? 'Close Batch' : 'Change Batch'}
            </Button>
          ))}

          {(supervisorAction === 'assign' || supervisorAction === 'change') && (
            <div className="space-y-2 pt-2">
              {supervisorAction === 'change' && (
                <div>
                  <label className="text-xs text-slate-500 font-medium">Change Reason *</label>
                  <input value={changeReason} onChange={e => setChangeReason(e.target.value)}
                    className="w-full mt-1 h-10 rounded-xl border border-slate-300 px-3 text-sm focus:outline-none" />
                </div>
              )}
              <div>
                <label className="text-xs text-slate-500 font-medium">Select Batch</label>
                <select value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)}
                  className="w-full mt-1 h-10 rounded-xl border border-slate-300 px-3 text-sm bg-white focus:outline-none">
                  <option value="">-- Approved Batch --</option>
                  {batches.map(b => <option key={b.id} value={b.batch_id}>{b.batch_id} — {b.product}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium">Product Code</label>
                <input value={productCodeInput} onChange={e => setProductCodeInput(e.target.value)}
                  className="w-full mt-1 h-10 rounded-xl border border-slate-300 px-3 text-sm focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium">Bottle Type</label>
                <select value={selectedBottleTypeStr} onChange={e => setSelectedBottleTypeStr(e.target.value)}
                  className="w-full mt-1 h-10 rounded-xl border border-slate-300 px-3 text-sm bg-white focus:outline-none">
                  <option value="">-- Select --</option>
                  {bottleTypes.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
              </div>
              <Button className="w-full rounded-xl" onClick={handleAssignBatch} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Assign Batch'}
              </Button>
            </div>
          )}

          {supervisorAction === 'close' && activeBatch && (
            <div className="space-y-2 pt-2">
              <p className="text-sm text-slate-600">Close active batch <strong>{activeBatch.batch_id}</strong>?</p>
              <Button className="w-full rounded-xl bg-red-600 hover:bg-red-700" onClick={handleCloseBatch} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Close Batch'}
              </Button>
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

      <div className="relative">
        <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          ref={crateRef}
          className="w-full pl-10 h-14 text-lg rounded-xl border-2 border-blue-400 focus:border-blue-600 focus:outline-none font-mono"
          placeholder="Scan crate barcode…"
          value={crateScan}
          onChange={e => setCrateScan(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { handleCrateScan(crateScan); } }}
          autoFocus
        />
      </div>

      {loading && <div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Saving…</span></div>}
      {msg && <p className="text-sm text-emerald-600 font-medium">{msg}</p>}

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