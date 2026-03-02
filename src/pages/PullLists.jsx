import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Clock, Droplets, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

function age(isoStr) {
  if (!isoStr) return '—';
  try { return formatDistanceToNow(new Date(isoStr), { addSuffix: true }); } catch { return '—'; }
}

function PalletRow({ p }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-start justify-between">
      <div>
        <p className="font-bold font-mono text-slate-900 text-sm">{p.pallet_id}</p>
        <p className="text-xs text-slate-500">{p.batch_id || '—'}</p>
        <p className="text-xs text-slate-400">{p.current_location}</p>
      </div>
      <div className="text-right">
        <p className="text-xs font-semibold text-slate-500">{p.crate_count ?? 0} crates</p>
        <p className="text-xs text-slate-400 flex items-center gap-1 justify-end mt-1">
          <Clock className="w-3 h-3" />{age(p.created_date)}
        </p>
      </div>
    </div>
  );
}

function CrateRow({ c }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-start justify-between">
      <div>
        <p className="font-bold font-mono text-slate-900 text-sm">{c.crate_id}</p>
        <p className="text-xs text-slate-500">{c.product_code || '—'} · {c.batch_id || '—'}</p>
        <p className="text-xs text-slate-400">{c.current_location}</p>
      </div>
      <p className="text-xs text-slate-400 flex items-center gap-1">
        <Clock className="w-3 h-3" />{age(c.filled_time || c.created_date)}
      </p>
    </div>
  );
}

function FillerBatchCard({ machine, batch }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4 text-blue-500" />
          <span className="font-bold text-slate-900 text-sm font-mono">{machine?.display_name || machine?.machine_id}</span>
        </div>
        {batch ? (
          <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">ACTIVE</span>
        ) : (
          <span className="text-xs bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full">IDLE</span>
        )}
      </div>
      {batch ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div><span className="text-slate-400">Product: </span><span className="font-medium text-slate-700">{batch.product_code}</span></div>
          <div><span className="text-slate-400">Batch: </span><span className="font-medium text-slate-700 font-mono">{batch.batch_id}</span></div>
          <div><span className="text-slate-400">Bottle: </span><span className="font-medium text-slate-700">{batch.bottle_type}</span></div>
          <div><span className="text-slate-400">Crates: </span><span className="font-medium text-slate-700">{batch.created_crates ?? 0}</span></div>
          <div className="col-span-2 text-slate-400 mt-0.5">Updated {age(batch.updated_date || batch.assigned_at)}</div>
        </div>
      ) : (
        <p className="text-xs text-slate-400">No batch assigned</p>
      )}
    </div>
  );
}

export default function PullLists() {
  const [user, setUser] = useState(null);
  const [fillers, setFillers] = useState([]);
  const [activeBatches, setActiveBatches] = useState([]);
  const [chamberWaiting, setChamberWaiting] = useState([]);
  const [dispatchReady, setDispatchReady] = useState([]);
  const [putawayList, setPutawayList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [machines, mabs, pallets, crates] = await Promise.all([
      base44.entities.Machine.filter({ machine_type: 'FILLER', is_active: true }, 'machine_id').catch(() => []),
      base44.entities.MachineActiveBatch.filter({ status: 'ACTIVE' }, '-assigned_at').catch(() => []),
      base44.entities.Pallet.list('-created_date', 200).catch(() => []),
      base44.entities.Crate.list('-created_date', 500).catch(() => []),
    ]);
    setFillers(machines);
    setActiveBatches(mabs);
    setChamberWaiting(pallets.filter(p => p.status === 'OPEN').sort((a, b) => new Date(a.created_date) - new Date(b.created_date)));
    setDispatchReady(pallets.filter(p => p.status === 'POST_CHAMBER').sort((a, b) => new Date(a.created_date) - new Date(b.created_date)));
    setPutawayList(crates.filter(c => c.status === 'RECEIVED').sort((a, b) => new Date(a.created_date) - new Date(b.created_date)));
    setLoading(false);
  }

  const isManager = user?.role === 'admin' || user?.role === 'production_manager';

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-slate-300" /></div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Production Board</h1>
          <p className="text-sm text-slate-500">WIP visibility — oldest first</p>
        </div>
        {isManager && (
          <Link to={createPageUrl('ProductionControl')}
            className="flex items-center gap-1.5 bg-slate-900 text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-slate-700 transition-colors">
            Production Assignments <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      {/* Filling Status */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Filling Status</p>
        <div className="space-y-2">
          {fillers.length === 0 && <p className="text-xs text-slate-400">No active fillers configured.</p>}
          {fillers.map(machine => {
            const batch = activeBatches.find(b => b.machine_id === machine.machine_id);
            return <FillerBatchCard key={machine.id} machine={machine} batch={batch} />;
          })}
        </div>
      </div>

      {/* WIP Tabs */}
      <Tabs defaultValue="chamber" className="w-full">
        <TabsList className="w-full rounded-xl bg-slate-100 p-1">
          <TabsTrigger value="chamber"  className="flex-1 rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">Chamber <span className="ml-1 text-slate-400">({chamberWaiting.length})</span></TabsTrigger>
          <TabsTrigger value="dispatch" className="flex-1 rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">Dispatch <span className="ml-1 text-slate-400">({dispatchReady.length})</span></TabsTrigger>
          <TabsTrigger value="putaway"  className="flex-1 rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">Putaway <span className="ml-1 text-slate-400">({putawayList.length})</span></TabsTrigger>
        </TabsList>
        <TabsContent value="chamber" className="mt-4 space-y-2">
          <p className="text-xs text-slate-400">Open pallets waiting for chamber staging — oldest first</p>
          {chamberWaiting.length === 0 && <p className="text-center text-slate-400 py-8">No pallets waiting</p>}
          {chamberWaiting.map(p => <PalletRow key={p.id} p={p} />)}
        </TabsContent>
        <TabsContent value="dispatch" className="mt-4 space-y-2">
          <p className="text-xs text-slate-400">Post-chamber pallets ready to dispatch — oldest first</p>
          {dispatchReady.length === 0 && <p className="text-center text-slate-400 py-8">No pallets ready</p>}
          {dispatchReady.map(p => <PalletRow key={p.id} p={p} />)}
        </TabsContent>
        <TabsContent value="putaway" className="mt-4 space-y-2">
          <p className="text-xs text-slate-400">Received crates awaiting zone putaway — oldest first</p>
          {putawayList.length === 0 && <p className="text-center text-slate-400 py-8">No crates awaiting</p>}
          {putawayList.map(c => <CrateRow key={c.id} c={c} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}