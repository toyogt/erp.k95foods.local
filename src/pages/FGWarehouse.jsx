import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Package, ArrowDownToLine, ArrowUpFromLine, BarChart3, MoreHorizontal, Home } from 'lucide-react';
import LotTab from '@/components/fgwarehouse/LotTab';
import ReceiveTab from '@/components/fgwarehouse/ReceiveTab';
import DispatchTab from '@/components/fgwarehouse/DispatchTab';
import StockTab from '@/components/fgwarehouse/StockTab';
import MoreTab from '@/components/fgwarehouse/MoreTab';

const TABS = [
  { id: 'home',     label: 'Home',     icon: Home            },
  { id: 'lots',     label: 'Lots',     icon: Package         },
  { id: 'receive',  label: 'Receive',  icon: ArrowDownToLine },
  { id: 'dispatch', label: 'Dispatch', icon: ArrowUpFromLine },
  { id: 'stock',    label: 'Stock',    icon: BarChart3       },
  { id: 'more',     label: 'More',     icon: MoreHorizontal  },
];

export default function FGWarehouse() {
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('fgw_tab') || 'home');
  const [user, setUser] = useState(null);
  const [skus, setSkus] = useState([]);
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [u, s, l] = await Promise.all([
      base44.auth.me().catch(() => null),
      base44.entities.ProductMaster.list('-created_date', 200),
      base44.entities.WarehouseLot.list('-created_date', 300),
    ]);
    setUser(u);
    setSkus(s || []);
    setLots(l || []);
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh every 5 minutes silently
  useEffect(() => {
    const interval = setInterval(() => loadData(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Home stats
  const activeLots = lots.filter(l => l.status === 'ACTIVE');
  const totalSkusInStock = new Set(activeLots.map(l => l.sku_code)).size;
  const totalBoxes = activeLots.reduce((s, l) => s + (l.boxes_balance || 0), 0);
  const totalLoose = activeLots.reduce((s, l) => s + (l.loose_bottles_balance || 0), 0);

  // Persist active tab & scroll to top on tab change
  const switchTab = (tab) => {
    sessionStorage.setItem('fgw_tab', tab);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const goHome = () => switchTab('home');
  const tabProps = { skus, lots, onRefresh: () => loadData(true), user, onBack: goHome };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      );
    }
    switch (activeTab) {
      case 'home':     return <HomeTab lots={lots} activeLots={activeLots} totalSkusInStock={totalSkusInStock} totalBoxes={totalBoxes} totalLoose={totalLoose} setActiveTab={switchTab} />;
      case 'lots':     return <LotTab {...tabProps} />;
      case 'receive':  return <ReceiveTab {...tabProps} />;
      case 'dispatch': return <DispatchTab {...tabProps} />;
      case 'stock':    return <StockTab skus={skus} lots={lots} onBack={goHome} />;
      case 'more':     return <MoreTab {...tabProps} />;
      default:         return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      {/* Tab Content */}
      <div className="max-w-lg mx-auto px-4 pt-4">
        {renderContent()}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 safe-area-pb">
        <div className="max-w-lg mx-auto flex items-center">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 min-h-[64px] transition-colors ${
                  active ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-slate-900' : ''}`} />
                <span className={`text-[10px] font-semibold tracking-wide ${active ? 'text-slate-900' : ''}`}>{tab.label}</span>
                {active && <div className="w-1 h-1 rounded-full bg-slate-900 mt-0.5" />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function HomeTab({ lots, activeLots, totalSkusInStock, totalBoxes, totalLoose, setActiveTab }) {
  const trialLots = activeLots.filter(l => l.is_trial_pack);

  return (
    <div className="space-y-5">
      {/* K95 Branding Header */}
      <div className="bg-slate-900 rounded-2xl px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">K95 Foods Pvt. Ltd.</p>
          <p className="text-lg font-black text-white leading-tight">FG Warehouse</p>
          <p className="text-xs text-slate-400 mt-0.5">Finished Goods Management</p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl shrink-0">
          🏭
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Active Lots" value={activeLots.length} sub="in warehouse" color="blue" />
        <StatCard label="SKUs in Stock" value={totalSkusInStock} sub="distinct products" color="green" />
        <StatCard label="Total Boxes" value={totalBoxes.toLocaleString()} sub="in stock" color="slate" />
        <StatCard label="Loose Bottles" value={totalLoose.toLocaleString()} sub="in stock" color="amber" />
      </div>

      {trialLots.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-purple-700">🧪 {trialLots.length} Trial Pack lot(s) active</p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quick Actions</p>
        <div className="grid grid-cols-1 gap-2">
          <QuickAction
            icon="📥"
            title="Receive Stock"
            sub="Record incoming boxes from production"
            color="bg-green-600"
            onClick={() => setActiveTab('receive')}
          />
          <QuickAction
            icon="🚚"
            title="Dispatch Stock"
            sub="Shopify · Amazon · Picklist · Sales Order"
            color="bg-blue-600"
            onClick={() => setActiveTab('dispatch')}
          />
          <QuickAction
            icon="🏷️"
            title="Manage Lots"
            sub="View, create & print QR lot cards"
            color="bg-slate-700"
            onClick={() => setActiveTab('lots')}
          />
          <QuickAction
            icon="📊"
            title="Stock View"
            sub="Current inventory by SKU or lot"
            color="bg-orange-600"
            onClick={() => setActiveTab('stock')}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    slate: 'bg-slate-100 border-slate-200',
    amber: 'bg-amber-50 border-amber-200',
  };
  return (
    <div className={`border rounded-xl p-4 ${colors[color] || colors.slate}`}>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs font-semibold text-slate-700 mt-0.5">{label}</p>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  );
}

function QuickAction({ icon, title, sub, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 ${color} text-white rounded-xl px-5 py-4 text-left hover:opacity-90 active:scale-[0.98] transition-all min-h-[68px]`}
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="font-bold text-sm">{title}</p>
        <p className="text-xs opacity-80 mt-0.5">{sub}</p>
      </div>
    </button>
  );
}