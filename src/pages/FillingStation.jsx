import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ScanLine, CheckCircle2, Loader2, PackageOpen, AlertCircle, RefreshCw } from 'lucide-react';
import { saveCrate, savePallet, linkCratesToPallet, logMovement } from '@/components/wip/wipHelpers';
import { pendingCount } from '@/components/wip/offlineQueue';

const LOC_FILLING = 'WIP-FILLING-OUT';

export default function FillingStation() {
  const [user, setUser] = useState(null);
  const [step, setStep] = useState('setup'); // setup | scanning | pallet_prompt | pallet_ready
  const [machine, setMachine] = useState(null);
  const [machineInput, setMachineInput] = useState('');
  const [machineError, setMachineError] = useState('');
  const [batches, setBatches] = useState([]);
  const [bottleTypes, setBottleTypes] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [manualBatch, setManualBatch] = useState('');
  const [selectedBottleType, setSelectedBottleType] = useState(null);
  const [crateScan, setCrateScan] = useState('');
  const [sessionCrates, setSessionCrates] = useState([]); // crate_ids scanned this session
  const [capacity, setCapacity] = useState(20);
  const [cratesOnCurrentPallet, setCratesOnCurrentPallet] = useState([]);
  const [lastPalletId, setLastPalletId] = useState('');
  const [palletScan, setPalletScan] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [offline, setOffline] = useState(!navigator.onLine);
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
      const [b, bt, settings] = await Promise.all([
        base44.entities.Batch.filter({ status: 'APPROVED' }),
        base44.entities.BottleType.list(),
        base44.entities.AppSetting.filter({ key: 'WIP_PALLET_CRATE_CAPACITY' }),
      ]);
      setBatches(b);
      setBottleTypes(bt);
      if (settings.length > 0) setCapacity(parseInt(settings[0].value) || 20);
    } catch { /* offline, continue */ }
  }

  async function confirmMachine() {
    setMachineError('');
    if (!machineInput.trim()) return;
    setLoading(true);
    try {
      const machines = await base44.entities.Machine.filter({ machine_id: machineInput.trim() });
      const m = machines[0];
      if (!m) { setMachineError('Machine not found'); setLoading(false); return; }
      if (m.machine_type !== 'FILLER') { setMachineError(`Wrong type: ${m.machine_type}. Need FILLER.`); setLoading(false); return; }
      setMachine(m);
    } catch {
      // offline – accept any entry
      setMachine({ machine_id: machineInput.trim(), display_name: machineInput.trim(), default_location: '' });
    }
    setLoading(false);
  }

  const batchId = selectedBatch || manualBatch;
  const canStartScanning = machine && batchId && selectedBottleType;

  function startScanning() {
    setStep('scanning');
    setTimeout(() => crateRef.current?.focus(), 100);
  }

  async function handleCrateScan(val) {
    if (!val.trim()) return;
    setLoading(true);
    setMsg('');
    const crateData = {
      crate_id: val.trim(),
      bottle_type: selectedBottleType.name,
      bottle_count: selectedBottleType.bottles_per_crate,
      batch_id: batchId,
      current_location: LOC_FILLING,
      status: 'FILLED',
      last_scan_time: new Date().toISOString(),
    };
    await saveCrate(crateData, user);
    await logMovement({ entityType: 'CRATE', entityId: val.trim(), from: '', to: LOC_FILLING, machineId: machine?.machine_id, user });

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
      batch_id: batchId,
    };
    await savePallet(palletData, user);
    await linkCratesToPallet(palletScan.trim(), cratesOnCurrentPallet, user);
    await logMovement({ entityType: 'PALLET', entityId: palletScan.trim(), from: '', to: LOC_FILLING, machineId: machine?.machine_id, user });
    setLastPalletId(palletScan.trim());
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

  // ── SETUP SCREEN ─────────────────────────────────────────────
  if (step === 'setup') return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Filling Station Setup</h2>
        {offline && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-semibold">Offline</span>}
        {!offline && pending > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-semibold">{pending} Pending</span>}
      </div>

      {/* Step 1: Machine */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">1 · Scan Machine QR</p>
        {machine ? (
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span className="font-semibold text-slate-800">{machine.display_name}</span>
            <button onClick={() => setMachine(null)} className="ml-auto text-xs text-slate-400 underline">Change</button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                className="w-full pl-10 h-12 text-base rounded-xl border border-slate-300 focus:border-blue-500 focus:outline-none"
                placeholder="Machine ID / QR"
                value={machineInput}
                onChange={e => setMachineInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirmMachine()}
              />
            </div>
            {machineError && <p className="text-sm text-red-600">{machineError}</p>}
            <Button onClick={confirmMachine} disabled={!machineInput.trim() || loading} className="w-full h-11 rounded-xl">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Machine'}
            </Button>
          </div>
        )}
      </div>

      {/* Step 2: Batch */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">2 · Select Batch</p>
        <select
          className="w-full h-12 rounded-xl border border-slate-300 px-3 text-base focus:outline-none focus:border-blue-500"
          value={selectedBatch}
          onChange={e => setSelectedBatch(e.target.value)}
        >
          <option value="">-- Choose approved batch --</option>
          {batches.map(b => <option key={b.id} value={b.batch_id}>{b.batch_id} — {b.product}</option>)}
        </select>
        <p className="text-xs text-slate-400 text-center">or enter manually</p>
        <input
          className="w-full h-11 rounded-xl border border-slate-300 px-3 text-base focus:outline-none focus:border-blue-500"
          placeholder="Manual batch ID"
          value={manualBatch}
          onChange={e => setManualBatch(e.target.value)}
          disabled={!!selectedBatch}
        />
      </div>

      {/* Step 3: Bottle Type */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">3 · Bottle Type</p>
        <div className="grid grid-cols-2 gap-2">
          {bottleTypes.map(bt => (
            <button
              key={bt.id}
              onClick={() => setSelectedBottleType(bt)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${selectedBottleType?.id === bt.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}
            >
              <p className="font-bold text-slate-800 text-sm">{bt.name}</p>
              <p className="text-xs text-slate-500">{bt.bottles_per_crate} btls/crate</p>
            </button>
          ))}
          {bottleTypes.length === 0 && (
            <input
              className="col-span-2 h-11 rounded-xl border border-slate-300 px-3 text-base focus:outline-none"
              placeholder="Enter bottle type manually"
              value={selectedBottleType?.name || ''}
              onChange={e => setSelectedBottleType({ name: e.target.value, bottles_per_crate: 0 })}
            />
          )}
        </div>
      </div>

      <Button
        onClick={startScanning}
        disabled={!canStartScanning}
        className="w-full h-16 text-lg font-bold rounded-2xl bg-blue-600 hover:bg-blue-700"
      >
        Start Scanning Crates →
      </Button>
    </div>
  );

  // ── SCANNING SCREEN ───────────────────────────────────────────
  if (step === 'scanning') return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Scan Crates</h2>
          <p className="text-xs text-slate-500 mt-0.5">{batchId} · {selectedBottleType?.name}</p>
        </div>
        {offline && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-semibold">Offline</span>}
        {!offline && pending > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-semibold">{pending} Pending</span>}
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-2">
        <div className="flex justify-between text-sm font-semibold text-slate-700">
          <span>Crates on current pallet</span>
          <span className={cratesOnCurrentPallet.length >= capacity ? 'text-emerald-600' : ''}>{cratesOnCurrentPallet.length}/{capacity}</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3">
          <div
            className="h-3 rounded-full bg-blue-500 transition-all"
            style={{ width: `${Math.min((cratesOnCurrentPallet.length / capacity) * 100, 100)}%` }}
          />
        </div>
        <p className="text-xs text-slate-400">Session total: {sessionCrates.length} crates</p>
      </div>

      {/* Scan input */}
      <div className="relative">
        <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
        <input
          ref={crateRef}
          value={crateScan}
          onChange={e => setCrateScan(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCrateScan(crateScan)}
          placeholder="Scan crate barcode…"
          className="w-full pl-12 pr-4 h-16 text-xl font-bold rounded-2xl border-2 border-slate-300 focus:border-blue-500 focus:outline-none bg-white"
          disabled={loading}
        />
      </div>

      {loading && <div className="flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}
      {msg && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-2 font-medium">{msg}</p>}

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => { setStep('setup'); setSessionCrates([]); setCratesOnCurrentPallet([]); }}>
          ← Setup
        </Button>
        {cratesOnCurrentPallet.length > 0 && (
          <Button className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={() => setStep('pallet_prompt')}>
            Build Pallet ({cratesOnCurrentPallet.length})
          </Button>
        )}
      </div>
    </div>
  );

  // ── PALLET PROMPT ─────────────────────────────────────────────
  if (step === 'pallet_prompt') return (
    <div className="space-y-5">
      <div className="text-center p-6 bg-emerald-50 rounded-2xl border-2 border-emerald-200">
        <PackageOpen className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900">Create Pallet</h2>
        <p className="text-slate-600 mt-1">{cratesOnCurrentPallet.length} crates ready to palletise</p>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
        <p className="text-sm font-semibold text-slate-600">Scan or enter Pallet barcode</p>
        <div className="relative">
          <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
          <input
            value={palletScan}
            onChange={e => setPalletScan(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreatePallet()}
            placeholder="Scan pallet barcode…"
            className="w-full pl-12 pr-4 h-16 text-xl font-bold rounded-2xl border-2 border-slate-300 focus:border-blue-500 focus:outline-none"
            autoFocus
          />
        </div>
      </div>

      <Button
        onClick={handleCreatePallet}
        disabled={!palletScan.trim() || loading}
        className="w-full h-16 text-lg font-bold rounded-2xl bg-emerald-600 hover:bg-emerald-700"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Pallet'}
      </Button>
    </div>
  );

  // ── PALLET READY ──────────────────────────────────────────────
  if (step === 'pallet_ready') return (
    <div className="space-y-5">
      <div className="text-center p-8 bg-slate-900 rounded-2xl text-white">
        <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold">Pallet Ready!</h2>
        <p className="text-3xl font-mono mt-3 bg-white/10 rounded-xl px-4 py-2">{lastPalletId}</p>
        <p className="text-slate-300 mt-2">{cratesOnCurrentPallet.length} crates · {LOC_FILLING}</p>
      </div>
      <Button onClick={continueAfterPallet} className="w-full h-16 text-lg font-bold rounded-2xl">
        Continue Scanning
      </Button>
      <Button variant="outline" onClick={() => { setStep('setup'); setSessionCrates([]); setCratesOnCurrentPallet([]); }} className="w-full h-12 rounded-xl">
        New Session
      </Button>
    </div>
  );
}