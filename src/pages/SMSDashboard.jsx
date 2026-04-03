import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Building2, Package, AlertTriangle, CheckCircle2, Clock, ArrowRight, TrendingDown, CalendarClock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
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

  useEffect(() => {
    Promise.all([
      base44.entities.StoreLot.list('-created_date', 200),
      base44.entities.StoreLocation.filter({ is_active: true }),
      base44.entities.StoreStockBalance.list('-created_date', 500),
      base44.entities.StoreReorderConfig.filter({ is_active: true }),
    ]).then(([l, loc, s, r]) => {
      setLots(l);
      setLocations(loc);
      setStock(s);
      setReorderConfigs(r);
    }).finally(() => setLoading(false));
  }, []);

  const pendingQC = lots.filter(l => l.status === 'qc_pending').length;
  const approvedPending = lots.filter(l => l.status === 'approved').length;

  // Compute stock totals per item
  const stockByItem = {};
  stock.forEach(s => {
    stockByItem[s.item_code] = (stockByItem[s.item_code] || 0) + (s.quantity || 0);
  });

  const lowStockAlerts = reorderConfigs.filter(r => (stockByItem[r.item_code] || 0) <= r.reorder_level);

  // Expiry within 30 days
  const today = new Date();
  const in30Days = new Date(today.getTime() + 30 * 86400000);
  const expiryAlerts = lots.filter(l => {
    if (!l.expiry_date || l.status === 'consumed') return false;
    const exp = new Date(l.expiry_date);
    return exp <= in30Days && exp >= today;
  });

  const quickActions = [
    { label: 'Gate Entry', path: '/GateEntry', color: 'bg-blue-600 text-white' },
    { label: 'GRN Receive', path: '/GRNReceive', color: 'bg-teal-600 text-white' },
    { label: 'Putaway', path: '/SMSPutaway', color: 'bg-violet-600 text-white' },
    { label: 'Stock Out', path: '/SMSStockOut', color: 'bg-orange-600 text-white' },
    { label: 'Transfer', path: '/SMSTransfer', color: 'bg-slate-700 text-white' },
    { label: 'Reports', path: '/SMSReports', color: 'bg-emerald-600 text-white' },
  ];

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Store Management</h1>
          <p className="text-sm text-slate-500">Inventory lifecycle — Gate Entry to Dispatch</p>
        </div>
        <Link to="/SMSLocationManager">
          <Button variant="outline" size="sm" className="gap-2"><Building2 className="w-4 h-4" /> Manage Locations</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Building2} label="Active Locations" value={locations.length} color="bg-blue-100 text-blue-600" />
        <StatCard icon={Package} label="Active Lots" value={lots.filter(l => !['consumed'].includes(l.status)).length} color="bg-violet-100 text-violet-600" />
        <StatCard icon={Clock} label="Pending QC" value={pendingQC} color="bg-yellow-100 text-yellow-600" sub="Awaiting approval" />
        <StatCard icon={AlertTriangle} label="Low Stock Items" value={lowStockAlerts.length} color="bg-red-100 text-red-600" sub="Below reorder level" />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Quick Actions</p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {quickActions.map(a => (
            <Link key={a.label} to={a.path}>
              <button className={`w-full py-2.5 px-2 rounded-lg text-xs font-semibold ${a.color} hover:opacity-90 transition-opacity`}>{a.label}</button>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Low Stock Alerts */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-700 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-red-500" /> Low Stock Alerts</p>
            <Link to="/SMSReports" className="text-xs text-blue-600 hover:underline flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
          </div>
          {lowStockAlerts.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">All items are adequately stocked</p>
          ) : (
            <div className="space-y-2">
              {lowStockAlerts.slice(0, 5).map(r => (
                <div key={r.item_code} className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{r.item_name || r.item_code}</p>
                    <p className="text-xs text-slate-500">Reorder at: {r.reorder_level} {r.uom}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-600">{stockByItem[r.item_code] || 0} {r.uom}</p>
                    <p className="text-xs text-slate-400">Current stock</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expiry Alerts */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-700 flex items-center gap-2"><CalendarClock className="w-4 h-4 text-orange-500" /> Expiry Alerts (30 days)</p>
          </div>
          {expiryAlerts.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No lots expiring in next 30 days</p>
          ) : (
            <div className="space-y-2">
              {expiryAlerts.slice(0, 5).map(l => (
                <div key={l.id} className="flex items-center justify-between bg-orange-50 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{l.item_name}</p>
                    <p className="text-xs text-slate-500">{l.lot_id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-orange-600">{l.expiry_date}</p>
                    <WeekBadge weeks={l.weeks_elapsed || 1} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pending QC Lots */}
      {pendingQC > 0 && (
        <div className="bg-white rounded-xl border border-yellow-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-yellow-700 flex items-center gap-2"><Clock className="w-4 h-4" /> {pendingQC} Lots Awaiting QC Approval</p>
            <Link to="/SMSLotManager" className="text-xs text-blue-600 hover:underline flex items-center gap-1">Go to Lots <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="space-y-1.5">
            {lots.filter(l => l.status === 'qc_pending').slice(0, 4).map(l => (
              <div key={l.id} className="flex items-center justify-between bg-yellow-50 rounded px-3 py-1.5 text-sm">
                <span className="font-medium text-slate-800">{l.lot_id}</span>
                <span className="text-slate-500">{l.item_name} — {l.quantity} {l.uom}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}