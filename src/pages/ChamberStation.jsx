import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ScanLine, Loader2, Thermometer, RefreshCw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ChamberPalletIn from '@/components/chamber/ChamberPalletIn';
import ChamberPalletOut from '@/components/chamber/ChamberPalletOut';
import ActiveCyclePanel from '@/components/chamber/ActiveCyclePanel';
import StartCycleModal from '@/components/chamber/StartCycleModal';
import { pendingCount } from '@/components/wip/offlineQueue';

export default function ChamberStation() {
  const [user, setUser] = useState(null);
  const [machine, setMachine] = useState(null);
  const [machineInput, setMachineInput] = useState('');
  const [machineError, setMachineError] = useState('');
  const [loadingMachine, setLoadingMachine] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);

  // Pallets in chamber + running cycles
  const [palletsInChamber, setPalletsInChamber] = useState([]);
  const [activeCycles, setActiveCycles] = useState([]);
  const [listLoading, setListLoading] = useState(false);

  // After Pallet IN — prompt to start cycle
  const [promptCyclePallet, setPromptCyclePallet] = useState(null);
  const [activeTab, setActiveTab] = useState('in');

  const pending = pendingCount();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    if (machine) refreshData();
  }, [machine]);

  async function refreshData() {
    setListLoading(true);
    try {
      const [pallets, cycles] = await Promise.all([
        base44.entities.Pallet.filter({ status: 'IN_CHAMBER' }),
        base44.entities.ChamberCycle.filter({ chamber_machine_id: machine.machine_id, status: 'RUNNING' }, '-started_at', 10).catch(() => []),
      ]);
      setPalletsInChamber(pallets);
      setActiveCycles(cycles);
    } catch { /* offline */ }
    setListLoading(false);
  }

  async function confirmMachine() {
    setMachineError('');
    if (!machineInput.trim()) return;
    setLoadingMachine(true);
    try {
      const machines = await base44.entities.Machine.filter({ machine_id: machineInput.trim() });
      const m = machines[0];
      if (!m) { setMachineError('Machine not found'); setLoadingMachine(false); return; }
      if (m.machine_type !== 'CHAMBER') { setMachineError(`Wrong type: ${m.machine_type}. Need CHAMBER.`); setLoadingMachine(false); return; }
      setMachine(m);
    } catch {
      setMachine({ machine_id: machineInput.trim(), display_name: machineInput.trim() });
    }
    setLoadingMachine(false);
  }

  function handlePalletMoved(pallet) {
    setPalletsInChamber(prev => [...prev.filter(p => p.pallet_id !== pallet.pallet_id), pallet]);
    setPromptCyclePallet(pallet);
    setActiveTab('cycle');
  }

  function handlePalletOut(palletId) {
    setPalletsInChamber(prev => prev.filter(p => p.pallet_id !== palletId));
    setActiveCycles(prev => prev.filter(c => c.pallet_id !== palletId));
  }

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
        <Button onClick={confirmMachine} disabled={!machineInput.trim() || loadingMachine} className="w-full h-12 rounded-xl">
          {loadingMachine ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
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
          <p className="text-xs text-slate-500">{machine.display_name || machine.machine_id}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {offline && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-semibold">Offline</span>}
          {!offline && pending > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-semibold">{pending} Pending</span>}
          {activeCycles.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">{activeCycles.length} Cycle{activeCycles.length > 1 ? 's' : ''} Running</span>
          )}
          <button onClick={() => setMachine(null)} className="text-xs text-slate-400 underline">Change</button>
        </div>
      </div>

      {/* Pallets in chamber summary */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-bold text-slate-700">In Chamber ({palletsInChamber.length})</p>
          <button onClick={refreshData} className="p-1 text-slate-400 hover:text-slate-600">
            <RefreshCw className={`w-4 h-4 ${listLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {palletsInChamber.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-400 text-center">No pallets currently in chamber</p>
        ) : (
          <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto">
            {palletsInChamber.map(p => {
              const hasCycle = activeCycles.some(c => c.pallet_id === p.pallet_id);
              return (
                <div key={p.id} className="flex items-center justify-between px-4 py-2">
                  <p className="font-mono font-bold text-slate-800 text-sm">{p.pallet_id}</p>
                  <div className="flex items-center gap-2">
                    {p.batch_id && <p className="text-xs text-slate-400">{p.batch_id}</p>}
                    {hasCycle && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Cycle</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Start cycle prompt */}
      {promptCyclePallet && (
        <StartCycleModal
          machine={machine}
          user={user}
          pallet={promptCyclePallet}
          onStarted={(cycle) => {
            setActiveCycles(prev => [...prev, cycle]);
            setPromptCyclePallet(null);
            setActiveTab('cycle');
          }}
          onSkip={() => { setPromptCyclePallet(null); setActiveTab('in'); }}
        />
      )}

      {/* Tabs */}
      {!promptCyclePallet && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full rounded-xl">
            <TabsTrigger value="in" className="flex-1 rounded-xl">Pallet IN</TabsTrigger>
            <TabsTrigger value="out" className="flex-1 rounded-xl">Pallet OUT</TabsTrigger>
            <TabsTrigger value="cycle" className="flex-1 rounded-xl relative">
              Active Cycle
              {activeCycles.length > 0 && (
                <span className="ml-1.5 bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5">{activeCycles.length}</span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="in" className="mt-4">
            <ChamberPalletIn machine={machine} user={user} onPalletMoved={handlePalletMoved} />
          </TabsContent>

          <TabsContent value="out" className="mt-4">
            <ChamberPalletOut machine={machine} user={user} onPalletMoved={handlePalletOut} />
          </TabsContent>

          <TabsContent value="cycle" className="mt-4">
            <ActiveCyclePanel machine={machine} user={user} cycles={activeCycles} onRefresh={refreshData} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}