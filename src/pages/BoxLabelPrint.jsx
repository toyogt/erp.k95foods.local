import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import BoxLabelForm from '@/components/labels/BoxLabelForm';
import MyRequestsList from '@/components/labels/MyRequestsList';

export default function BoxLabelPrint() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [u, prods] = await Promise.all([
      base44.auth.me(),
      base44.entities.ProductMaster.filter({ is_active: true }, 'product_name', 200),
    ]);
    setUser(u);
    setProducts(prods);
    await loadRequests(u);
    setLoading(false);
  }

  async function loadRequests(u) {
    const reqs = await base44.entities.LabelPrintRequest.filter(
      { requested_by: (u || user)?.email || '' },
      '-requested_at',
      20
    );
    setRequests(reqs);
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  );

  // Two-column on desktop, stacked on mobile
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Box Label Print</h2>
          <p className="text-sm text-slate-500">Create requests, get approval, then generate & print 6×4 labels.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Left: form */}
        <BoxLabelForm
          products={products}
          user={user}
          onSubmitted={() => loadRequests(user)}
        />

        {/* Right: requests list */}
        <MyRequestsList
          requests={requests}
          products={products}
          user={user}
          onRefresh={() => loadRequests(user)}
        />
      </div>
    </div>
  );
}