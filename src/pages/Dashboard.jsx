import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Store, Beaker, Droplets, Thermometer, Truck, Tag, PackageCheck, ScrollText, Settings } from 'lucide-react';
import LiveCounters from '@/components/dashboard/LiveCounters';
import LocationHeatmap from '@/components/dashboard/LocationHeatmap';
import RecentActivity from '@/components/dashboard/RecentActivity';
import StationCard from '@/components/StationCard';
import { getAllowedPages } from '@/components/roles';
import { Loader2 } from 'lucide-react';

const ALL_STATIONS = [
  { icon: Store,       title: 'Stores Issue',        subtitle: 'Material issue',          page: 'StoresIssue',      color: 'bg-violet-600' },
  { icon: Beaker,      title: 'Recipe Station',       subtitle: 'Batch execution',         page: 'RecipeStation',    color: 'bg-rose-600'   },
  { icon: Droplets,    title: 'Filling Station',      subtitle: 'Crate creation',          page: 'FillingStation',   color: 'bg-blue-600'   },
  { icon: Thermometer, title: 'Chamber Station',      subtitle: 'Pallet in/out',           page: 'ChamberStation',   color: 'bg-orange-600' },
  { icon: Truck,       title: 'Transfer / Receiving', subtitle: 'Transit & receive',       page: 'TransferReceiving',color: 'bg-teal-600'   },
  { icon: Tag,         title: 'Labelling Line',       subtitle: 'Line run',                page: 'LabellingLine',    color: 'bg-pink-600'   },
  { icon: PackageCheck,title: 'FG Palletizing',       subtitle: 'Case pallets',            page: 'FGPalletizing',    color: 'bg-emerald-600'},
  { icon: ScrollText,  title: 'Audit Log',            subtitle: 'All actions',             page: 'AuditLogPage',     color: 'bg-slate-700'  },
  { icon: Settings,    title: 'Master Data',          subtitle: 'Bottles, locations…',     page: 'MasterData',       color: 'bg-slate-900'  },
];

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ crates: 0, pallets: 0, batches: 0, jobs: 0 });
  const [wipCounters, setWipCounters] = useState({ filling: 0, chamber: 0, transit: 0, line1: 0, line2: 0 });
  const [cratesByLocation, setCratesByLocation] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [u, crates, pallets, batches, jobs, logs] = await Promise.all([
        base44.auth.me(),
        base44.entities.Crate.list('-created_date', 200),
        base44.entities.Pallet.filter({ status: 'OPEN' }),
        base44.entities.Batch.list('-created_date', 50),
        base44.entities.Job.filter({ status: 'IN_PROGRESS' }),
        base44.entities.AuditLog.list('-created_date', 10),
      ]);
      setUser(u);
      const activeCrates = crates.filter(c => c.status !== 'SHIPPED');
      setStats({
        crates: activeCrates.length,
        pallets: pallets.length,
        batches: batches.filter(b => ['IN_PROGRESS', 'QC_PENDING'].includes(b.status)).length,
        jobs: jobs.length,
      });
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {user?.full_name ? `Hello, ${user.full_name.split(' ')[0]}` : 'Dashboard'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">Factory execution overview</p>
      </div>

      <LiveCounters crates={stats.crates} pallets={stats.pallets} batches={stats.batches} jobs={stats.jobs} />
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