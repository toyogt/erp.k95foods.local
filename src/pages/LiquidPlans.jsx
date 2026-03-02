import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, ChevronDown } from 'lucide-react';

export default function LiquidPlans() {
  const [user, setUser] = useState(null);
  const [plans, setPlans] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedPlan, setExpandedPlan] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.role !== 'admin' && u?.role !== 'production_manager') {
        alert('Access denied');
        return;
      }
      loadData();
    });
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [pls, alcs, prods, packedEvents] = await Promise.all([
      base44.entities.LiquidBatchPlan.list('-created_date', 500),
      base44.entities.SKUAllocation.list('-created_date', 1000),
      base44.entities.ProductMaster.list('-created_date', 500),
      base44.entities.PackedOutputEvent.filter({ status: 'ACTIVE' }, '-created_date', 5000).catch(() => []),
    ]);
    
    // Compute produced_bottles_packed from PackedOutputEvent for each allocation
    for (const alloc of alcs) {
      const events = packedEvents.filter(e => e.allocation_id === alloc.allocation_id);
      alloc.produced_bottles_packed = events.reduce((sum, e) => sum + (e.packed_bottles || 0), 0);
    }
    
    setPlans(pls);
    setAllocations(alcs);
    setProducts(prods);
    setLoading(false);
  };

  const getAllocationsByPlan = (planId) => allocations.filter(a => a.plan_id === planId);

  const getProductInfo = (skuCode) => products.find(p => p.item_code === skuCode);

  const getMfgDate = (plan) => {
    if (!plan.started_at) return '—';
    return new Date(plan.started_at).toLocaleDateString('en-IN');
  };

  const getStatusColor = (status) => {
    const colors = {
      DRAFT: 'bg-slate-100 text-slate-700',
      RELEASED: 'bg-blue-100 text-blue-700',
      STARTED: 'bg-amber-100 text-amber-700',
      COMPLETED: 'bg-green-100 text-green-700',
      CLOSED: 'bg-slate-200 text-slate-700',
    };
    return colors[status] || colors.DRAFT;
  };

  const getAllocationStatusColor = (status) => {
    const colors = {
      RELEASED: 'bg-blue-100 text-blue-700',
      RUNNING: 'bg-amber-100 text-amber-700',
      DONE: 'bg-green-100 text-green-700',
    };
    return colors[status] || colors.RELEASED;
  };

  const filteredPlans = plans.filter(p =>
    !search || p.plan_id?.toLowerCase().includes(search.toLowerCase()) ||
    p.recipe_id?.toLowerCase().includes(search.toLowerCase()) ||
    p.recipe_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!user) return <div className="text-center py-12 text-slate-500">Unauthorized</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Liquid Batch Plans</h1>
        <p className="text-sm text-slate-500">Track recipe batches and SKU allocations</p>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
        <Input
          className="pl-8 w-56 text-sm"
          placeholder="Search plans…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {filteredPlans.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">No plans found</div>
        ) : (
          filteredPlans.map(plan => {
            const planAllocs = getAllocationsByPlan(plan.plan_id);
            const totalProduced = planAllocs.reduce((sum, a) => sum + (a.produced_bottles_packed || 0), 0);
            const totalRequired = planAllocs.reduce((sum, a) => sum + (a.required_bottles || 0), 0);
            const isExpanded = expandedPlan === plan.id;

            return (
              <div key={plan.id} className="border border-slate-200 rounded-lg bg-white">
                {/* Plan Header */}
                <div
                  className="p-4 flex justify-between items-start cursor-pointer hover:bg-slate-50"
                  onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{plan.plan_id}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(plan.status)}`}>
                        {plan.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Recipe: <span className="font-mono font-semibold">{plan.recipe_id}</span> — {plan.recipe_name}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      MFG Date: {getMfgDate(plan)} | Allocations: {planAllocs.length} | Produced: <span className="font-semibold text-green-700">{totalProduced}</span> / <span className="text-slate-600">{totalRequired}</span> bottles
                    </p>
                    {plan.linked_order_ids && (
                      <p className="text-xs text-slate-600 mt-1">Orders: {plan.linked_order_ids}</p>
                    )}
                    {plan.notes && <p className="text-xs text-slate-600 mt-1">{plan.notes}</p>}
                  </div>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>

                {/* Plan Allocations (Expanded) */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-4 space-y-3 bg-slate-50">
                    {planAllocs.length === 0 ? (
                      <p className="text-sm text-slate-500">No allocations</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-100 text-slate-700 text-xs uppercase tracking-wide">
                            <tr>
                              <th className="px-3 py-2 text-left">SKU</th>
                              <th className="px-3 py-2 text-left">Type</th>
                              <th className="px-3 py-2 text-right">Requested</th>
                              <th className="px-3 py-2 text-right">Required</th>
                              <th className="px-3 py-2 text-right">Produced</th>
                              <th className="px-3 py-2 text-right">Pending</th>
                              <th className="px-3 py-2 text-center">Status</th>
                              <th className="px-3 py-2 text-center">Order</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {planAllocs.map(alloc => {
                              const prod = getProductInfo(alloc.sku_code);
                              const pending = Math.max(0, alloc.required_bottles - alloc.produced_bottles_packed);
                              const progress = alloc.required_bottles > 0 ? Math.round((alloc.produced_bottles_packed / alloc.required_bottles) * 100) : 0;

                              return (
                                <tr key={alloc.id} className="hover:bg-slate-50">
                                  <td className="px-3 py-2 font-mono text-xs font-semibold">
                                    {alloc.sku_code}
                                    {prod && <p className="text-xs text-slate-600 font-normal mt-0.5">{prod.product_name}</p>}
                                  </td>
                                  <td className="px-3 py-2 text-xs font-medium text-slate-600">{alloc.allocation_type}</td>
                                  <td className="px-3 py-2 text-right text-slate-600">{alloc.target_bottles_requested}</td>
                                  <td className="px-3 py-2 text-right font-medium text-slate-800">{alloc.required_bottles}</td>
                                  <td className="px-3 py-2 text-right font-semibold text-green-700">{alloc.produced_bottles_packed}</td>
                                  <td className="px-3 py-2 text-right font-semibold text-orange-700">{pending}</td>
                                  <td className="px-3 py-2 text-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAllocationStatusColor(alloc.status)}`}>
                                      {alloc.status}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-center text-xs font-mono text-slate-600">{alloc.order_id || '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Progress Bar */}
                    {planAllocs.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-lg p-3">
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-xs font-semibold text-slate-700">Overall Progress</p>
                          <p className="text-xs font-bold text-slate-800">{totalProduced} / {totalRequired} bottles ({totalRequired > 0 ? Math.round((totalProduced / totalRequired) * 100) : 0}%)</p>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full transition-all"
                            style={{ width: `${totalRequired > 0 ? (totalProduced / totalRequired) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}