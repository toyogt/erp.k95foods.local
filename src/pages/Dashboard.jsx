import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Store, Beaker, Droplets, Thermometer, Truck, Tag, PackageCheck, ScrollText, Settings, Loader2, WifiOff } from 'lucide-react';
import LiveCounters from '@/components/dashboard/LiveCounters';
import LocationHeatmap from '@/components/dashboard/LocationHeatmap';
import RecentActivity from '@/components/dashboard/RecentActivity';
import StationCard from '@/components/StationCard';
import { getAllowedPages } from '@/components/roles';

const ALL_STATIONS = [
  { icon: Store,        title: 'Stores Issue',        subtitle: 'Material issue',      page: 'StoresIssue',      color: 'bg-violet-600' },
  { icon: Beaker,       title: 'Recipe Station',      subtitle: 'Batch execution',     page: 'RecipeStation',    color: 'bg-rose-600'   },
  { icon: Droplets,     title: 'Filling Station',     subtitle: 'Crate creation',      page: 'FillingStation',   color: 'bg-blue-600'   },
  { icon: Thermometer,  title: 'Chamber Station',     subtitle: 'Pallet in/out',       page: 'ChamberStation',   color: 'bg-orange-600' },
  { icon: Truck,        title: 'Transfer/Receiving',  subtitle: 'Transit & receive',   page: 'TransferReceiving',color: 'bg-teal-600'   },
  { icon: Tag,          title: 'Labelling Line',      subtitle: 'Line run',            page: 'LabellingLine',    color: 'bg-pink-600'   },
  { icon: PackageCheck, title: 'FG Palletizing',      subtitle: 'Case pallets',        page: 'FGPalletizing',    color: 'bg-emerald-600'},
  { icon: ScrollText,   title: 'Audit Log',           subtitle: 'All actions',         page: 'AuditLogPage',     color: 'bg-slate-700'  },
  { icon: Settings,     title: 'Master Data',         subtitle: 'Bottles, locations…', page: 'MasterData',       color: 'bg-slate-900'  },
];

const STATE_COLOR = {
  RUNNING:   'bg-emerald-100 text-emerald-800',
  SOFT_STOP: 'bg-amber-100 text-amber-800',
  HARD_STOP: 'bg-red-100 text-red-800',
  READY:     'bg-blue-100 text-blue-800',
  SETUP:     'bg-slate-100 text-slate-700',
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ crates: 0, pallets: 0, batches: 0, jobs: 0 });
  const [wipCounters, setWipCounters] = useState({ filling: 0, chamber: 0, transit: 0, line1: 0, line2: 0 });
  const [lineStatus, setLineStatus] = useState({ line1: null, line2: null });
  const [offlineQueue, setOfflineQueue] = useState(0);
  const [cratesByLocation, setCratesByLocation] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [u, crates, pallets, batches, jobs, logs, sessions] = await Promise.all([
        base44.auth.me(),
        base44.entities.Crate.list('-created_date', 500),
        base44.entities.Pallet.list('-created_date', 200),
        base44.entities.Batch.list('-created_date', 50),
        base44.entities.Job.filter({ status: 'IN_PROGRESS' }),
        base44.entities.AuditLog.list('-created_date', 10),
        base44.entities.LineSession.list('-started_at', 20).catch(() => []),
      ]);
      setUser(u);
      const activeCrates = crates.filter(c => c.status !== 'STORED');
      const openPallets = pallets.filter(p => p.status !== 'CLOSED');
      setStats({
        crates: activeCrates.length,
        pallets: openPallets.length,
        batches: batches.filter(b => ['IN_PROGRESS', 'QC_PENDING'].includes(b.status)).length,
        jobs: jobs.length,
      });
      setWipCounters({
        filling: crates.filter(c => c.current_location === 'WIP-FILLING-OUT').length,
        chamber: pallets.filter(p => p.status === 'IN_CHAMBER').length,
        transit: pallets.filter(p => p.status === 'IN_TRANSIT').length,
        line1: crates.filter(c => c.current_location === 'ZONE-LABEL-LINE-1').length,
        line2: crates.filter(c => c.current_location === 'ZONE-LABEL-LINE-2').length,
      });
      const activeSessions = sessions.filter(s => ['SETUP','READY','RUNNING','SOFT_STOP','HARD_STOP'].includes(s.state));
      setLineStatus({
        line1: activeSessions.find(s => s.line_machine_id?.match(/1$/)) || null,
        line2: activeSessions.find(s => s.line_machine_id?.match(/2$/)) || null,
      });
      const q = JSON.parse(localStorage.getItem('factory_offline_queue') || '[]');
      setOfflineQueue(q.length);
      const locMap = {};
      activeCrates.forEach(c => { const loc = c.current_location || 'UNKNOWN'; locMap[loc] = (locMap[loc] || 0) + 1; });
      setCratesByLocation(Object.entries(locMap).map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count));
      setRecentLogs(logs);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  );

  const allowedPages = getAllowedPages(user);
  const visibleStations = ALL_STATIONS.filter(s => allowedPages.includes(s.page));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {user?.full_name ? `Hello, ${user.full_name.split(' ')[0]}` : 'Dashboard'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Factory execution overview</p>
        </div>
        {offlineQueue > 0 && (
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800 font-semibold">
            <WifiOff className="w-3.5 h-3.5" />
            {offlineQueue} pending
          </div>
        )}
      </div>

      <LiveCounters crates={stats.crates} pallets={stats.pallets} batches={stats.batches} jobs={stats.jobs} />

      {/* WIP Location counters */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Filling Out',  value: wipCounters.filling, color: 'bg-blue-50 text-blue-800 border-blue-200'     },
          { label: 'In Chamber',   value: wipCounters.chamber, color: 'bg-orange-50 text-orange-800 border-orange-200' },
          { label: 'In Transit',   value: wipCounters.transit, color: 'bg-teal-50 text-teal-800 border-teal-200'     },
          { label: 'Line 1 Crates',value: wipCounters.line1,   color: 'bg-violet-50 text-violet-800 border-violet-200'},
          { label: 'Line 2 Crates',value: wipCounters.line2,   color: 'bg-pink-50 text-pink-800 border-pink-200'     },
        ].map(c => (
          <div key={c.label} className={`rounded-2xl border p-3 ${c.color}`}>
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-xs font-semibold opacity-70 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Active line sessions */}
      {(lineStatus.line1 || lineStatus.line2) && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Active Lines</p>
          {[lineStatus.line1, lineStatus.line2].map((s, i) => s && (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Line {i + 1}</p>
                <p className="font-bold text-slate-900 text-sm">{s.wo_id}</p>
                <p className="text-xs text-slate-500">{s.bottles_counted} bottles · {s.crates_used} crates</p>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${STATE_COLOR[s.state] || STATE_COLOR.SETUP}`}>{s.state}</span>
            </div>
          ))}
        </div>
      )}

      <LocationHeatmap cratesByLocation={cratesByLocation} />

      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Stations</h2>
        <div className="space-y-3">
          {visibleStations.map(s => <StationCard key={s.page} {...s} />)}
        </div>
      </div>

      <RecentActivity logs={recentLogs} />
    </div>
  );
}