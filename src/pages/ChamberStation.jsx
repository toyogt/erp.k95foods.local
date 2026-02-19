import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { movePalletWithCrates } from '@/components/wip/wipHelpers';
import { pendingCount } from '@/components/wip/offlineQueue';
import ScanInput from '@/components/wip/ScanInput';
import MachineScanner from '@/components/wip/MachineScanner';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, ArrowDown, ArrowUp, WifiOff, RefreshCw } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import moment from 'moment';

export default function ChamberStation() {
  const [user, setUser] = useState(null);
  const [machine, setMachine] = useState(null);
  const [mode, setMode] = useState(null); // IN | OUT
  const [palletScan, setPalletScan] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [inChamber, setInChamber] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser);
    loadInChamber();
    setOffline(!navigator.onLine);
    window.addEventListener('online', () => setOffline(false));
    window.addEventListener('offline', () => setOffline(true));
  }, []);

  async function loadInChamber() {
    setLoadingList(true);
    try {
      const data = await base44.entities.Pallet.filter({ status: 'IN_CHAMBER' });
      setInChamber(data);
    } catch { /* offline */ }
    setLoadingList(false);
  }

  async function handlePalletScan(palletId) {
    setSaving(true);
    setResult(null);
    try {
      const pallets = await base44.entities.Pallet.filter({ pallet_id: palletId });
      const pallet = pallets[0];
      if (!pallet) { setResult({ error: 'Pallet not found: ' + palletId }); setSaving(false); return; }

      if (mode === 'IN') {
        await movePalletWithCrates({
          palletDbId: pallet.id,
          palletId,
          toLocation: 'WIP-CHAMBER-IN',
          toStatus: 'IN_CHAMBER',
          toCrateStatus: 'IN_CHAMBER',
          machineId: machine?.machine_id,
          user,
        });
        setResult({ ok: true, msg: `Pallet ${palletId} moved INTO chamber` });
      } else {
        await movePalletWithCrates({
          palletDbId: pallet.id,
          palletId,
          toLocation: 'WIP-POST-CHAMBER',
          toStatus: 'POST_CHAMBER',
          toCrateStatus: 'POST_CHAMBER',
          machineId: machine?.machine_id,
          user,
        });
        setResult({ ok: true, msg: `Pallet ${palletId} moved OUT of chamber` });
      }
      setPalletScan('');
      loadInChamber();
    } catch (e) {
      setResult({ error: e.message });
    }
    setSaving(false);
  }

  return (
    <div className="space-y-5">
      {offline && (
        <div className="rounded-xl bg-amber-50 border border-amber-300 px-4 py-2 flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-amber-600" />
          <span className="text-sm text-amber-800 font-medium">Offline — {pendingCount()} queued</span>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Chamber Station</h1>
        <p className="text-sm text-slate-500">Move pallets in/out of chamber</p>
      </div>

      <MachineScanner stationType="CHAMBER" onConfirmed={setMachine} />

      {machine && (
        <>
          {/* Mode buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => { setMode('IN'); setResult(null); setPalletScan(''); }}
              className={`h-20 rounded-2xl text-lg font-bold flex-col gap-1 ${mode === 'IN' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            >
              <ArrowDown className="w-6 h-6" /> Pallet IN
            </Button>
            <Button
              onClick={() => { setMode('OUT'); setResult(null); setPalletScan(''); }}
              className={`h-20 rounded-2xl text-lg font-bold flex-col gap-1 ${mode === 'OUT' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            >
              <ArrowUp className="w-6 h-6" /> Pallet OUT
            </Button>
          </div>

          {mode && (
            <div className="space-y-3">
              <div className={`rounded-2xl p-4 ${mode === 'IN' ? 'bg-orange-50 border border-orange-200' : 'bg-teal-50 border border-teal-200'}`}>
                <p className={`text-sm font-semibold mb-2 ${mode === 'IN' ? 'text-orange-800' : 'text-teal-800'}`}>
                  {mode === 'IN' ? 'Scan pallet to move INTO chamber' : 'Scan pallet to move OUT of chamber'}
                </p>
                <ScanInput
                  placeholder="Scan pallet ID…"
                  value={palletScan}
                  onChange={setPalletScan}
                  onScan={handlePalletScan}
                />
              </div>

              {saving && <div className="flex justify-center py-2"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>}

              {result?.ok && (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                  <p className="font-semibold text-emerald-900">{result.msg}</p>
                </div>
              )}
              {result?.error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                  <p className="text-sm text-red-700 font-medium">{result.error}</p>
                </div>
              )}

              <Button
                onClick={() => handlePalletScan(palletScan)}
                disabled={!palletScan.trim() || saving}
                className={`w-full h-16 rounded-2xl text-lg font-bold ${mode === 'IN' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-teal-600 hover:bg-teal-700'}`}
              >
                {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : `Move ${mode}`}
              </Button>
            </div>
          )}
        </>
      )}

      {/* In-chamber list */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Currently In Chamber</h2>
          <button onClick={loadInChamber} className="p-1.5 rounded-lg hover:bg-slate-100">
            <RefreshCw className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        {loadingList ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : inChamber.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">No pallets in chamber</p>
        ) : (
          <div className="space-y-2">
            {inChamber.map(p => (
              <div key={p.id} className="rounded-xl bg-white border border-slate-200 p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">{p.pallet_id}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{moment(p.updated_date).fromNow()}</p>
                </div>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}