import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import ReceiveQCTab from '@/components/warehouse/ReceiveQCTab';
import DispatchTab from '@/components/warehouse/DispatchTab';
import StockViewTab from '@/components/warehouse/StockViewTab';

const TABS = ['Receive & QC', 'Dispatch Out', 'Stock View'];

export default function WarehouseOps() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
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

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Warehouse Ops</h2>
        <p className="text-sm text-slate-500">Receive, QC, dispatch, and view stock.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {TABS.map((label, i) => (
          <button key={i} onClick={() => setActiveTab(i)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === i ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 0 && <ReceiveQCTab user={user} />}
      {activeTab === 1 && <DispatchTab user={user} />}
      {activeTab === 2 && <StockViewTab products={products} />}
    </div>
  );
}