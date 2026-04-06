import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Building2, Package, AlertTriangle, Clock, ArrowRight, TrendingDown, CalendarClock } from 'lucide-react';
import { SkeletonCards, SkeletonList } from '@/components/store/StoreSkeleton';
import { Button } from '@/components/ui/button';

import ExportButton from '@/components/store/ExportButton';

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/70 shadow-sm p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-xl font-bold text-slate-900">{value ?? '—'}</p>
          {sub && <p className="text-xs text-slate-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function WeekBadge({ weeks }) {
  if (weeks <= 1) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Week {weeks || 1}</span>;
  if (weeks === 2) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Week {weeks}</span>;
  if (weeks === 3) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Week {weeks}</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Week {weeks}+</span>;
}

export default function SMSDashboard() {
  const [lots, setLots] = useState([]);
  const [locations, setLocations] = useState([]);
  const [stock, setStock] = useState([]);
  const [reorderConfigs, setReorderConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.auth.me(),
      base44.entities.StoreLot.list('-created_date', 200),
      base44.entities.StoreLocation.filter({ is_active: true }),
      base44.entities.StoreStockBalance.list('-created_date', 500),
      base44.entities.StoreReorderConfig.filter({ is_active: true }),
    ]).then(([u, l, loc, s, r]) => {
      setUser(u); setLots(l); setLocations(loc); setStock(s); setReorderConfigs(r);
    }).finally(() => setLoading(false));
  }, []);

  const pendingQC = lots.filter(l => l.status === 'qc_pending').length;
  const stockByItem = {};
  stock.forEach(s => { stockByItem[s.item_code] = (stockByItem[s.item_code] || 0) + (s.quantity || 0); });
  const lowStockAlerts = reorderConfigs.filter(r => (stockByItem[r.item_code] || 0) <= r.reorder_level);

  const today = new Date();
  const in30Days = new Date(today.getTime() + 30 * 86400000);
  const expiryAlerts = lots.filter(l => {
    if (!l.expiry_date || l.status === 'consumed') return false;
    const exp = new Date(l.expiry_date);
    return exp <= in30Days && exp >= today;
  });

  const quickActions = [
    { label: 'Gate Entry', path: '/GateEntry', color: 'bg-blue-600 text-white' },
    { label: 'Goods Receipt', path: '/GRNReceive', color: 'bg-teal-600 text-white' },
    { label: 'Putaway', path: '/SMSPutaway', color: 'bg-violet-600 text-white' },
    { label: 'Stock Issue', path: '/SMSStockOut', color: 'bg-orange-600 text-white' },
    { label: 'Transfer', path: '/SMSTransfer', color: 'bg-slate-700 text-white' },
    { label: 'Reports', path: '/SMSReports', color: 'bg-emerald-600 text-white' },
  ];

  const isAdmin = user?.role === 'admin';

  const stockExportCols = [
    { key: 'item_name', label: 'Item' }, { key: 'item_code', label: 'Code' },
    { key: 'lot_id', label: 'Lot ID' }, { key: 'location_code', label: 'Location' },
    { key: 'quantity', label: 'Quantity' }, { key: 'uom', label: 'Unit' },
  ];

  if (loading) return (
    <div className="space-y-5">
      <div><div className="h-6 bg-slate-200 rounded w-48 animate-pulse mb-1" /><div className="h-4 bg-slate-100 rounded w-64 animate-pulse" /></div>
      <SkeletonCards count={3} />
      <SkeletonList rows={4} />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Store Management</h1>
          <p className="text-sm text-slate-500">Inventory lifecycle — Gate Entry to Dispatch</p>
        </div>
        <div className="flex gap-2">
          <ExportButton data={stock} columns={stockExportCols} filename="current_stock" />
          <Link to="/SMSLocationManager">
            <Button variant="outline" size="sm" className="gap-2"><Building2 className="w-4 h-4" /> Locations</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Building2} label="Active Locations" value={locations.length} color="bg-blue-100 text-blue-600" />
        <StatCard icon={Package} label="Active Lots" value={lots.filter(l => !['consumed'].includes(l.status)).length} color="bg-violet-100 text-violet-600" />
        <StatCard icon={Clock} label="Pending QC" value={pendingQC} color="bg-yellow-100 text-yellow-600" sub="Awaiting approval" />
        <StatCard icon={AlertTriangle} label="Low Stock" value={lowStockAlerts.length} color="bg-red-100 text-red-600" sub="Below reorder" />
      </div>

      {/* Quick Actions */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/70 shadow-sm p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Quick Actions</p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {quickActions.map(a => (
            <Link key={a.label} to={a.path}>
              <button className={`w-full py-2.5 px-2 rounded-lg text-xs font-semibold ${a.color} hover:opacity-90 transition-opacity h-11`}>{a.label}</button>
            </Link>
          ))}
        </div>
      </div>

      {/* Current Stock Summary */}
      {stock.length > 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/70 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Package className="w-4 h-4 text-blue-500" /> Current Stock ({stock.length} entries)</p>
            <Link to="/SMSReports" className="text-xs text-blue-600 hover:underline flex items-center gap-1">Full report <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-100 text-xs text-slate-600"><th className="text-left px-3 py-2">Item</th><th className="text-left px-3 py-2">Lot</th><th className="text-left px-3 py-2">Location</th><th className="text-right px-3 py-2">Quantity</th></tr></thead>
              <tbody className="divide-y divide-slate-50">
                {stock.slice(0, 10).map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2"><p className="font-medium text-slate-800">{s.item_name}</p></td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{s.lot_id}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{s.location_code}</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-800">{s.quantity} {s.uom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {stock.length > 10 && <p className="text-xs text-slate-400 text-center py-2">Showing 10 of {stock.length} — View full report for all</p>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Low Stock */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/70 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-700 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-red-500" /> Low Stock Alerts</p>
          </div>
          {lowStockAlerts.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">All items adequately stocked</p>
          ) : lowStockAlerts.slice(0, 5).map(r => (
            <div key={r.item_code} className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2 mb-2">
              <div><p className="text-sm font-medium text-slate-800">{r.item_name || r.item_code}</p><p className="text-xs text-slate-500">Reorder at: {r.reorder_level} {r.uom}</p></div>
              <p className="text-sm font-bold text-red-600">{stockByItem[r.item_code] || 0}</p>
            </div>
          ))}
        </div>

        {/* Expiry */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/70 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-700 flex items-center gap-2"><CalendarClock className="w-4 h-4 text-orange-500" /> Expiry Alerts</p>
          </div>
          {expiryAlerts.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No lots expiring soon</p>
          ) : expiryAlerts.slice(0, 5).map(l => (
            <div key={l.id} className="flex items-center justify-between bg-orange-50 rounded-lg px-3 py-2 mb-2">
              <div><p className="text-sm font-medium text-slate-800">{l.item_name}</p><p className="text-xs text-slate-500">{l.lot_id}</p></div>
              <div className="text-right"><p className="text-sm font-bold text-orange-600">{l.expiry_date}</p><WeekBadge weeks={l.weeks_elapsed || 1} /></div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending QC */}
      {pendingQC > 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-yellow-200/70 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-yellow-700 flex items-center gap-2"><Clock className="w-4 h-4" /> {pendingQC} Lots Awaiting QC</p>
            <Link to="/SMSLotManager" className="text-xs text-blue-600 hover:underline flex items-center gap-1">View <ArrowRight className="w-3 h-3" /></Link>
          </div>
          {lots.filter(l => l.status === 'qc_pending').slice(0, 4).map(l => (
            <div key={l.id} className="flex items-center justify-between bg-yellow-50 rounded px-3 py-1.5 text-sm mb-1">
              <span className="font-medium text-slate-800">{l.lot_id}</span>
              <span className="text-slate-500">{l.item_name} — {l.quantity} {l.uom}</span>
            </div>
          ))}
        </div>
      )}


    </div>
  );
}