import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, WifiOff } from 'lucide-react';
import StationCard from '@/components/StationCard';
import { getAllowedPagesFromDB } from '@/lib/accessControl';
import { Droplets, Thermometer, Truck, Tag,
         ScrollText, Settings, ListChecks, Bell,
         Printer, ClipboardCheck, Layers, Warehouse, BarChart3, Upload } from 'lucide-react';

// Complete list — filtered by role at render time
const ALL_STATIONS = [
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

// Role-specific widget counters — purely local data
const ROLE_WIDGETS = {
  filling_operator:      ['filling_crates_today', 'filling_unpalletized'],
  chamber_operator:      ['chamber_waiting', 'chamber_in'],
  labelling_receiver:    ['transit_pallets', 'zone_crates'],
  line_operator:         ['zone_crates', 'offline_queue'],
  labelling_supervisor:  ['zone_crates', 'transit_pallets'],
  stores:                ['offline_queue'],
  qa:                    [],
  label_operator:        [],
  label_supervisor:      [],
  pallet_builder:        [],
  warehouse_ops:         ['transit_pallets'],
};

export default function OperatorDashboard({ user }) {
  const [loading, setLoading] = useState(true);
  const [offlineQueue, setOfflineQueue] = useState(0);
  const [widgetData, setWidgetData] = useState({});

  // Stations this role is allowed to see — from database AppRole
  const [allowedPages, setAllowedPages] = useState([]);
  
  useEffect(() => {
    if (user) {
      getAllowedPagesFromDB(user).then(pages => setAllowedPages(pages));
    }
  }, [user]);

  const visibleStations = allowedPages.includes('*') 
    ? ALL_STATIONS 
    : ALL_STATIONS.filter(s => allowedPages.includes(s.page));

  const widgetKeys = ROLE_WIDGETS[user?.role] || [];
  const needsData = widgetKeys.length > 0;

  useEffect(() => {
    const q = JSON.parse(localStorage.getItem('factory_offline_queue') || '[]');
    setOfflineQueue(q.length);

    if (!needsData) { setLoading(false); return; }

    // Only fetch what this role needs — not 500 crates for everyone
    Promise.all([
      base44.entities.Crate.list('-created_date', 200).catch(() => []),
      base44.entities.Pallet.list('-created_date', 100).catch(() => []),
    ]).then(([crates, pallets]) => {
      const today = new Date();
      const todayStr = today.toDateString();
      setWidgetData({
        filling_crates_today: crates.filter(c => c.filler_machine_id && c.filled_time && new Date(c.filled_time).toDateString() === todayStr).length,
        filling_unpalletized: crates.filter(c => c.current_location === 'WIP-FILLING-OUT').length,
        chamber_waiting: crates.filter(c => c.current_location === 'WIP-CHAMBER-WAIT').length,
        chamber_in: pallets.filter(p => p.status === 'IN_CHAMBER').length,
        transit_pallets: pallets.filter(p => p.status === 'IN_TRANSIT').length,
        zone_crates: crates.filter(c => ['ZONE-LABEL-LINE-1','ZONE-LABEL-LINE-2'].includes(c.current_location)).length,
        offline_queue: q.length,
      });
    }).finally(() => setLoading(false));
  }, []);

  const WIDGET_META = {
    filling_crates_today: { label: 'Crates filled today',     color: 'bg-blue-50 text-blue-800 border-blue-200'         },
    filling_unpalletized: { label: 'Crates not palletized',   color: 'bg-orange-50 text-orange-800 border-orange-200'   },
    chamber_waiting:      { label: 'Crates waiting chamber',  color: 'bg-amber-50 text-amber-800 border-amber-200'      },
    chamber_in:           { label: 'Pallets in chamber',      color: 'bg-orange-50 text-orange-800 border-orange-200'   },
    transit_pallets:      { label: 'Pallets in transit',      color: 'bg-teal-50 text-teal-800 border-teal-200'         },
    zone_crates:          { label: 'Crates in label zones',   color: 'bg-violet-50 text-violet-800 border-violet-200'   },
    offline_queue:        { label: 'Pending sync',            color: 'bg-amber-50 text-amber-800 border-amber-200'      },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-bold text-slate-900">
          {user?.full_name ? `Hello, ${user.full_name.split(' ')[0]}` : 'Dashboard'}
        </h1>
        {offlineQueue > 0 && (
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800 font-semibold">
            <WifiOff className="w-3.5 h-3.5" />{offlineQueue} pending
          </div>
        )}
      </div>

      {/* Role widgets */}
      {widgetKeys.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {widgetKeys.map(key => {
            const meta = WIDGET_META[key];
            if (!meta) return null;
            return (
              <div key={key} className={`rounded-2xl border p-4 ${meta.color}`}>
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin opacity-50" />
                ) : (
                  <>
                    <p className="text-3xl font-black">{widgetData[key] ?? '—'}</p>
                    <p className="text-xs font-semibold opacity-70 mt-1 uppercase tracking-wide">{meta.label}</p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Station cards — role-filtered, no async, instant */}
      {visibleStations.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">My Stations</p>
          {visibleStations.map(s => <StationCard key={s.page} {...s} />)}
        </div>
      ) : (
        <div className="text-center py-12 text-slate-400">
          <p className="text-sm">No stations assigned to your role.</p>
          <p className="text-xs mt-1">Contact your administrator.</p>
        </div>
      )}
    </div>
  );
}