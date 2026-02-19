import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { saveCrate, savePallet, linkCratesToPallet, logMovement } from '@/components/wip/wipHelpers';
import { pendingCount } from '@/components/wip/offlineQueue';
import ScanInput from '@/components/wip/ScanInput';
import MachineScanner from '@/components/wip/MachineScanner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle2, Package, Box, WifiOff, ArrowLeft } from 'lucide-react';

export default function FillingStation() {
  const [user, setUser] = useState(null);
  const [machine, setMachine] = useState(null);
  const [batches, setBatches] = useState([]);
  const [bottleTypes, setBottleTypes] = useState([]);
  const [palletCapacity, setPalletCapacity] = useState(20);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedBottleType, setSelectedBottleType] = useState('');
  const [scannedCrates, setScannedCrates] = useState([]); // since last pallet
  const [totalCrates, setTotalCrates] = useState(0);
  const [crateScan, setCrateScan] = useState('');
  const [palletScan, setPalletScan] = useState('');
  const [view, setView] = useState('setup'); // setup | scan | pallet_prompt | pallet_done
  const [saving, setSaving] = useState(false);
  const [offline, setOffline] = useState(false);
  const [lastCrate, setLastCrate] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser);
    loadSetupData();
    setOffline(!navigator.onLine);
    window.addEventListener('online', () => setOffline(false));
    window.addEventListener('offline', () => setOffline(true));
  }, []);

  async function loadSetupData() {
    const [batchData, btData, settings] = await Promise.all([
      base44.entities.Batch.filter({ status: 'APPROVED' }),
      base44.entities.BottleType.list('name'),
      base44.entities.AppSetting.filter({ key: 'WIP_PALLET_CRATE_CAPACITY' }),
    ]);
    setBatches(batchData);
    setBottleTypes(btData);
    if (settings[0]) setPalletCapacity(Number(settings[0].value) || 20);
  }

  function handleMachineConfirmed(m) {
    setMachine(m);
  }

  function canStartScan() {
    return machine && selectedBottleType;
  }

  async function handleCrateScan(crateId) {
    if (!crateId) return;
    setSaving(true);
    const bt = bottleTypes.find(b => b.name === selectedBottleType);
    const bottleCount = bt?.bottles_per_crate || 0;

    const crateData = {
      crate_id: crateId,
      bottle_type: selectedBottleType,
      bottle_count: bottleCount,
      batch_id: selectedBatch || '',
      current_location: 'WIP-FILLING-OUT',
      status: 'FILLED',
      last_scan_time: new Date().toISOString(),
    };

    const saved = await saveCrate(crateData, user);
    await logMovement({ entityType: 'CRATE', entityId: crateId, from: '', to: 'WIP-FILLING-OUT', machineId: machine?.machine_id, user });

    const newScanned = [...scannedCrates, crateId];
    const newTotal = totalCrates + 1;
    setScannedCrates(newScanned);
    setTotalCrates(newTotal);
    setLastCrate({ id: crateId, bottleCount });
    setCrateScan('');

    if (newScanned.length >= palletCapacity) {
      setView('pallet_prompt');
    }
    setSaving(false);
  }

  async function handleCreatePallet(palletId) {
    if (!palletId) return;
    setSaving(true);
    await savePallet({
      pallet_id: palletId,
      pallet_type: 'WIP',
      current_location: 'WIP-FILLING-OUT',
      status: 'OPEN',
      crate_count: scannedCrates.length,
      batch_id: selectedBatch || '',
    }, user);
    await linkCratesToPallet(palletId, scannedCrates, user);
    await logMovement({ entityType: 'PALLET', entityId: palletId, from: '', to: 'WIP-FILLING-OUT', machineId: machine?.machine_id, user });
    setView('pallet_done');
    setSaving(false);
  }

  // ── Setup ──────────────────────────────────────────────────────
  if (view === 'setup') {
    return (
      <div className="space-y-5">
        {offline && <OfflineBadge count={pendingCount()} />}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Filling Station</h1>
          <p className="text-sm text-slate-500">Scan machine, then start crate creation</p>
        </div>

        <MachineScanner stationType="FILLER" onConfirmed={handleMachineConfirmed} />

        {machine && (
          <>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">Bottle Type *</label>
              <Select value={selectedBottleType} onValueChange={setSelectedBottleType}>
                <SelectTrigger className="h-14 rounded-xl text-base"><SelectValue placeholder="Select bottle type" /></SelectTrigger>
                <SelectContent>
                  {bottleTypes.map(bt => <SelectItem key={bt.id} value={bt.name}>{bt.name} ({bt.bottles_per_crate}/crate)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">Batch ID (optional)</label>
              <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                <SelectTrigger className="h-14 rounded-xl text-base"><SelectValue placeholder="Select approved batch" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>— No batch —</SelectItem>
                  {batches.map(b => <SelectItem key={b.id} value={b.batch_id}>{b.batch_id} · {b.product}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Button
              disabled={!canStartScan()}
              onClick={() => setView('scan')}
              className="w-full h-16 rounded-2xl text-lg font-bold bg-blue-600 hover:bg-blue-700"
            >
              Start Scanning Crates
            </Button>
          </>
        )}
      </div>
    );
  }

  // ── Scan crates ────────────────────────────────────────────────
  if (view === 'scan') {
    return (
      <div className="space-y-5">
        {offline && <OfflineBadge count={pendingCount()} />}
        <button onClick={() => setView('setup')} className="flex items-center gap-1.5 text-sm text-slate-500 font-medium -ml-1">
          <ArrowLeft className="w-4 h-4" /> Setup
        </button>

        <div className="rounded-2xl bg-blue-600 text-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-blue-200 mb-1">Filling</p>
              <p className="font-bold text-xl">{selectedBottleType}</p>
              {selectedBatch && <p className="text-blue-200 text-sm mt-0.5">{selectedBatch}</p>}
            </div>
            <div className="text-right">
              <p className="text-3xl font-black">{scannedCrates.length}</p>
              <p className="text-blue-200 text-xs">/ {palletCapacity} for pallet</p>
            </div>
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700 block mb-2">Scan Crate Barcode</label>
          <ScanInput
            placeholder="Scan crate ID…"
            value={crateScan}
            onChange={setCrateScan}
            onScan={handleCrateScan}
          />
        </div>

        {saving && <div className="flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}

        {lastCrate && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-emerald-900">{lastCrate.id}</p>
              <p className="text-sm text-emerald-700">{lastCrate.bottleCount} bottles · WIP-FILLING-OUT</p>
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium mb-2">Progress to next pallet</p>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min((scannedCrates.length / palletCapacity) * 100, 100)}%` }} />
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>{scannedCrates.length} scanned</span>
            <span>{palletCapacity - scannedCrates.length} remaining</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Pallet prompt ──────────────────────────────────────────────
  if (view === 'pallet_prompt') {
    return (
      <div className="space-y-5">
        {offline && <OfflineBadge count={pendingCount()} />}
        <div className="rounded-2xl bg-indigo-600 text-white p-6 text-center">
          <Package className="w-12 h-12 mx-auto mb-3 text-indigo-200" />
          <p className="text-xl font-bold">Pallet Full!</p>
          <p className="text-indigo-200 mt-1">{scannedCrates.length} crates ready</p>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700 block mb-2">Scan Pallet Barcode</label>
          <ScanInput
            placeholder="Scan pallet ID…"
            value={palletScan}
            onChange={setPalletScan}
            onScan={handleCreatePallet}
          />
        </div>

        {saving && <div className="flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}

        <Button
          onClick={() => handleCreatePallet(palletScan)}
          disabled={!palletScan.trim() || saving}
          className="w-full h-16 rounded-2xl text-lg font-bold bg-indigo-600 hover:bg-indigo-700"
        >
          Create Pallet
        </Button>
      </div>
    );
  }

  // ── Pallet done ────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-emerald-600 text-white p-8 text-center">
        <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-emerald-200" />
        <p className="text-2xl font-bold">Pallet Ready</p>
        <p className="text-4xl font-black mt-2">{palletScan}</p>
        <p className="text-emerald-200 mt-2">{scannedCrates.length} crates · WIP-FILLING-OUT</p>
      </div>
      <Button
        onClick={() => { setScannedCrates([]); setPalletScan(''); setCrateScan(''); setLastCrate(null); setView('scan'); }}
        className="w-full h-16 rounded-2xl text-lg font-bold bg-blue-600 hover:bg-blue-700"
      >
        <Box className="w-5 h-5 mr-2" /> Scan Next Crates
      </Button>
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