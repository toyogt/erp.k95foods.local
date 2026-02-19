import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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

export default function PullLists() {
  const [user, setUser] = useState(null);
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
    const [pallets, crates] = await Promise.all([
      base44.entities.Pallet.list('-created_date', 200).catch(() => []),
      base44.entities.Crate.list('-created_date', 500).catch(() => []),
    ]);
    // Chamber Pull List: pallets at WIP-CHAMBER-WAIT or FILLED (pre-chamber)
    setChamberWaiting(pallets.filter(p => p.status === 'OPEN' && p.current_location?.includes('CHAMBER')).sort((a, b) => new Date(a.created_date) - new Date(b.created_date)));
    // Transfer Dispatch List: pallets in POST_CHAMBER
    setDispatchReady(pallets.filter(p => p.status === 'POST_CHAMBER').sort((a, b) => new Date(a.created_date) - new Date(b.created_date)));
    // Putaway: received crates
    setPutawayList(crates.filter(c => c.status === 'RECEIVED').sort((a, b) => new Date(a.created_date) - new Date(b.created_date)));
    setLoading(false);
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-slate-300" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pull Lists</h1>
        <p className="text-sm text-slate-500">Planning board — oldest first</p>
      </div>
      <Tabs defaultValue="chamber" className="w-full">
        <TabsList className="w-full rounded-xl bg-slate-100 p-1">
          <TabsTrigger value="chamber"  className="flex-1 rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">Chamber <span className="ml-1 text-slate-400">({chamberWaiting.length})</span></TabsTrigger>
          <TabsTrigger value="dispatch" className="flex-1 rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">Dispatch <span className="ml-1 text-slate-400">({dispatchReady.length})</span></TabsTrigger>
          <TabsTrigger value="putaway"  className="flex-1 rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">Putaway <span className="ml-1 text-slate-400">({putawayList.length})</span></TabsTrigger>
        </TabsList>
        <TabsContent value="chamber" className="mt-4 space-y-2">
          <p className="text-xs text-slate-400">Pallets waiting for chamber — oldest first</p>
          {chamberWaiting.length === 0 && <p className="text-center text-slate-400 py-8">No pallets waiting</p>}
          {chamberWaiting.map(p => <PalletRow key={p.id} p={p} />)}
        </TabsContent>
        <TabsContent value="dispatch" className="mt-4 space-y-2">
          <p className="text-xs text-slate-400">Post-chamber pallets ready to dispatch</p>
          {dispatchReady.length === 0 && <p className="text-center text-slate-400 py-8">No pallets ready</p>}
          {dispatchReady.map(p => <PalletRow key={p.id} p={p} />)}
        </TabsContent>
        <TabsContent value="putaway" className="mt-4 space-y-2">
          <p className="text-xs text-slate-400">Received crates awaiting zone putaway</p>
          {putawayList.length === 0 && <p className="text-center text-slate-400 py-8">No crates awaiting</p>}
          {putawayList.map(c => <CrateRow key={c.id} c={c} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}