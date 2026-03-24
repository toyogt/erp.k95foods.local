import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, WifiOff, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { getAllowedPagesFromDB } from '@/lib/accessControl';
import LiveCounters from './LiveCounters';
import LocationHeatmap from './LocationHeatmap';
import RecentActivity from './RecentActivity';
import MyTasksWidget from './MyTasksWidget';
import StationCard from '@/components/StationCard';
import { Droplets, Thermometer, Truck, Tag,
         ScrollText, Settings, ListChecks, Printer, Factory,
         ClipboardCheck, Layers, Warehouse, BarChart3, Upload } from 'lucide-react';

const ALL_STATIONS = [
  { icon: Factory,        title: 'Production',          subtitle: 'Batch assignments',     page: 'ProductionControl',  color: 'bg-slate-700'   },
  { icon: Droplets,       title: 'Filling Station',     subtitle: 'Crate creation',        page: 'FillingStation',     color: 'bg-blue-600'    },
  { icon: Thermometer,    title: 'Chamber Station',     subtitle: 'Pallet in/out',         page: 'ChamberStation',     color: 'bg-orange-600'  },
  { icon: Truck,          title: 'Transfer/Receiving',  subtitle: 'Transit & receive',     page: 'TransferReceiving',  color: 'bg-teal-600'    },
  { icon: Tag,            title: 'Labelling Line',      subtitle: 'Line run',              page: 'LabellingLine',      color: 'bg-pink-600'    },
  { icon: Printer,        title: 'Box Label Print',     subtitle: 'Print & register',      page: 'BoxLabelPrint',      color: 'bg-cyan-600'    },
  { icon: ClipboardCheck, title: 'Label Approvals',     subtitle: 'Approve requests',      page: 'BoxLabelApprovals',  color: 'bg-amber-600'   },
  { icon: Layers,         title: 'Pallet Build',        subtitle: 'Scan boxes to pallet',  page: 'BoxPalletBuild',     color: 'bg-emerald-600' },
  { icon: Warehouse,      title: 'Warehouse Ops',       subtitle: 'Receive, QC, dispatch', page: 'WarehouseOps',       color: 'bg-sky-700'     },
  { icon: BarChart3,      title: 'Box Stock',           subtitle: 'FG stock visibility',   page: 'BoxStockDashboard',  color: 'bg-green-700'   },
  { icon: Upload,         title: 'Opening Stock',       subtitle: 'Legacy import',         page: 'OpeningStockImport', color: 'bg-slate-600'   },
  { icon: ListChecks,     title: 'Pull Lists',          subtitle: 'Planning board',        page: 'PullLists',          color: 'bg-indigo-600'  },
  { icon: Bell,           title: 'Alerts',              subtitle: 'Exceptions',            page: 'AlertsPage',         color: 'bg-red-600'     },
  { icon: ScrollText,     title: 'Audit Log',           subtitle: 'All actions',           page: 'AuditLogPage',       color: 'bg-slate-700'   },
  { icon: Settings,       title: 'Master Data',         subtitle: 'Config & reference',    page: 'MasterData',         color: 'bg-slate-900'   },
];

const STATE_COLOR = {
  RUNNING:   'bg-emerald-100 text-emerald-800',
  SOFT_STOP: 'bg-amber-100 text-amber-800',
  HARD_STOP: 'bg-red-100 text-red-800',
  READY:     'bg-blue-100 text-blue-800',
  SETUP:     'bg-slate-100 text-slate-700',
};

export default function AdminDashboard({ user }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ crates: 0, pallets: 0, batches: 0, jobs: 0 });
  const [wipCounters, setWipCounters] = useState({ filling: 0, chamber: 0, transit: 0, line1: 0, line2: 0 });
  const [lineStatus, setLineStatus] = useState({ line1: null, line2: null });
  const [offlineQueue, setOfflineQueue] = useState(0);
  const [openAlertCount, setOpenAlertCount] = useState(0);
  const [cratesByLocation, setCratesByLocation] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [allowedPages, setAllowedPages] = useState([]);

  useEffect(() => {
    // Load user's allowed pages
    const loadPermissions = async () => {
      try {
        const pages = await getAllowedPagesFromDB(user);
        setAllowedPages(pages || []);
      } catch (e) {
        console.error('Failed to load permissions:', e);
        setAllowedPages([]);
      }
    };
    if (user) loadPermissions();
    loadData();
  }, [user]);

  async function loadData() {
    try {
      const [crates, pallets, batches, jobs, allLogs, sessions, alerts] = await Promise.all([
        base44.entities.Crate.list('-created_date', 500),
        base44.entities.Pallet.list('-created_date', 200),
        base44.entities.Batch.filter({ status: 'IN_PROGRESS' }, '-created_date', 50),
        base44.entities.Job.filter({ status: 'IN_PROGRESS' }),
        base44.entities.AuditLog.list('-created_date', 20),
        base44.entities.LineSession.list('-started_at', 20).catch(() => []),
        base44.entities.AlertEvent.filter({ status: 'OPEN' }, '-created_at', 50).catch(() => []),
      ]);

      const activeCrates = crates.filter(c => c.status !== 'STORED');
      const openPallets = pallets.filter(p => p.status !== 'CLOSED');
      setStats({
        crates: activeCrates.length,
        pallets: openPallets.length,
        batches: batches.length,
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
      const locMap = {};
      activeCrates.forEach(c => { const loc = c.current_location || 'UNKNOWN'; locMap[loc] = (locMap[loc] || 0) + 1; });
      setCratesByLocation(Object.entries(locMap).map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count));
      const filteredLogs = allLogs.filter(l =>
        !l.entity_type?.startsWith('Sales') &&
        !l.module?.startsWith('SALES')
      );
      setRecentLogs(filteredLogs);
      setOpenAlertCount(alerts.length);
      setOfflineQueue(JSON.parse(localStorage.getItem('factory_offline_queue') || '[]').length);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-bold text-slate-900">
          {user?.full_name ? `Hello, ${user.full_name.split(' ')[0]}` : 'Dashboard'}
        </h1>
        <div className="flex gap-2 flex-wrap justify-end">
          {offlineQueue > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800 font-semibold">
              <WifiOff className="w-3.5 h-3.5" />{offlineQueue} pending
            </div>
          )}
          {openAlertCount > 0 && (
            <Link to={createPageUrl('AlertsPage')}>
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-800 font-semibold">
                <Bell className="w-3.5 h-3.5" />{openAlertCount} alert{openAlertCount !== 1 ? 's' : ''}
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* KPI Counters */}
      <LiveCounters crates={stats.crates} pallets={stats.pallets} batches={stats.batches} jobs={stats.jobs} />

      {/* WIP Counters */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Filling Out',   value: wipCounters.filling, color: 'bg-blue-50 text-blue-800 border-blue-200'      },
          { label: 'In Chamber',    value: wipCounters.chamber, color: 'bg-orange-50 text-orange-800 border-orange-200' },
          { label: 'In Transit',    value: wipCounters.transit, color: 'bg-teal-50 text-teal-800 border-teal-200'       },
          { label: 'Line 1 Crates', value: wipCounters.line1,   color: 'bg-violet-50 text-violet-800 border-violet-200' },
          { label: 'Line 2 Crates', value: wipCounters.line2,   color: 'bg-pink-50 text-pink-800 border-pink-200'       },
        ].map(c => (
          <div key={c.label} className={`rounded-2xl border p-3 ${c.color}`}>
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-xs font-semibold opacity-70 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Active Lines */}
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

      <MyTasksWidget user={user} />

      <LocationHeatmap cratesByLocation={cratesByLocation} />

      {/* All Stations */}
      <div>
        <div className="flex justify-end mb-3">
          <Link to={createPageUrl('CustomizeDashboard')} className="text-xs text-blue-600 font-medium">Customize ›</Link>
        </div>
        <div className="space-y-3">
          {ALL_STATIONS.filter(s => user?.role === 'admin' || allowedPages.includes(s.page)).map(s => <StationCard key={s.page} {...s} />)}
        </div>
      </div>

      <RecentActivity logs={recentLogs} />
    </div>
  );
}