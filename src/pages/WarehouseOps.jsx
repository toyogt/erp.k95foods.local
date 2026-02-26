import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Home, PackageCheck, Truck, BarChart3, RefreshCw } from 'lucide-react';
import ReceiveQCTab from '@/components/warehouse/ReceiveQCTab';
import DispatchTab from '@/components/warehouse/DispatchTab';
import StockViewTab from '@/components/warehouse/StockViewTab';

const SCREENS = [
  { id: 'home',     label: 'Home',    Icon: Home },
  { id: 'receive',  label: 'Receive', Icon: PackageCheck },
  { id: 'dispatch', label: 'Dispatch',Icon: Truck },
  { id: 'stock',    label: 'Stock',   Icon: BarChart3 },
];

function HomeScreen({ user, onNavigate }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadStats() {
    setLoading(true);
    const pendingPallets = await base44.entities.BoxPallet.filter({ status: 'HANDED_OVER' }, '-created_date', 100);
    setStats({
      pendingReceive: pendingPallets.length,
      pallets: pendingPallets,
    });
    setLoading(false);
  }

  useEffect(() => { loadStats(); }, []);

  return (
    <div className="space-y-5 pb-4">
      {/* Greeting */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Warehouse Ops</h2>
        <p className="text-sm text-slate-500">Welcome{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}!</p>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wide">Pending Receive</p>
            <p className="text-3xl font-black text-amber-800 mt-1">{stats?.pendingReceive ?? 0}</p>
            <p className="text-xs text-amber-500 mt-0.5">pallets awaiting</p>
          </div>
          <button onClick={loadStats} className="text-amber-400 hover:text-amber-600">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pending pallets list */}
      {stats?.pallets?.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Pallets to Receive</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {stats.pallets.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 px-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="font-mono text-sm font-bold text-slate-800">{p.pallet_id}</span>
                  {p.product_name && <p className="text-xs text-slate-500 mt-0.5">{p.product_name}</p>}
                  {!p.product_name && p.item_code && <p className="text-xs text-slate-500 mt-0.5">{p.item_code}</p>}
                  {p.batch_no && <p className="text-xs text-slate-400">Batch: {p.batch_no}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <span className="text-sm font-black text-slate-700">{p.total_boxes || '?'}</span>
                    <p className="text-xs text-slate-400">boxes</p>
                  </div>
                  <button
                    onClick={() => onNavigate('receive')}
                    className="text-xs font-semibold text-sky-600 hover:text-sky-800 bg-sky-100 px-3 py-1.5 rounded-lg ml-1"
                  >
                    Receive →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action tiles */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Quick Actions</p>
        <button
          onClick={() => onNavigate('receive')}
          className="w-full bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-2xl p-5 flex items-center gap-4 transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div className="text-left">
            <p className="font-bold text-base">Receive & QC</p>
            <p className="text-sky-200 text-sm">Scan inbound pallet, verify boxes</p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('dispatch')}
          className="w-full bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-2xl p-5 flex items-center gap-4 transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div className="text-left">
            <p className="font-bold text-base">Dispatch Out</p>
            <p className="text-amber-200 text-sm">Scan boxes for outbound dispatch</p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('stock')}
          className="w-full bg-slate-700 hover:bg-slate-800 active:bg-slate-900 text-white rounded-2xl p-5 flex items-center gap-4 transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div className="text-left">
            <p className="font-bold text-base">Stock View</p>
            <p className="text-slate-400 text-sm">View current inventory levels</p>
          </div>
        </button>
      </div>
    </div>
  );
}

export default function WarehouseOps() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [activeScreen, setActiveScreen] = useState('home');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.auth.me(),
      base44.entities.ProductMaster.filter({ is_active: true }, 'product_name', 200),
    ]).then(([u, prods]) => {
      setUser(u);
      setProducts(prods);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  );

  const screenTitles = {
    home: null,
    receive: 'Receive & QC',
    dispatch: 'Dispatch Out',
    stock: 'Stock View',
  };
  const screenTitle = screenTitles[activeScreen];

  return (
    <div className="max-w-lg mx-auto flex flex-col min-h-[calc(100vh-80px)]">
      {/* Sub-header for non-home screens */}
      {screenTitle && (
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setActiveScreen('home')}
            className="p-2 -ml-1 rounded-xl hover:bg-slate-100 transition-colors text-slate-600"
          >
            ←
          </button>
          <h2 className="text-lg font-bold text-slate-900">{screenTitle}</h2>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 pb-24">
        {activeScreen === 'home'    && <HomeScreen user={user} onNavigate={setActiveScreen} />}
        {activeScreen === 'receive' && <ReceiveQCTab user={user} />}
        {activeScreen === 'dispatch'&& <DispatchTab user={user} />}
        {activeScreen === 'stock'   && <StockViewTab products={products} />}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 safe-area-bottom">
        <div className="max-w-lg mx-auto flex">
          {SCREENS.map(({ id, label, Icon }) => {
            const active = activeScreen === id;
            return (
              <button
                key={id}
                onClick={() => setActiveScreen(id)}
                className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
                  active ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-sky-600' : 'text-slate-400'}`} />
                <span className={`text-xs font-semibold ${active ? 'text-sky-600' : 'text-slate-400'}`}>
                  {label}
                </span>
                {active && <div className="absolute bottom-0 w-8 h-0.5 bg-sky-600 rounded-t-full" style={{ position: 'relative', marginTop: 2 }} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}