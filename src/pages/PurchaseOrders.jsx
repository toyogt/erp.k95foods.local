import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import POForm from '@/components/purchase/POForm';
import POList from '@/components/purchase/POList';

export default function PurchaseOrders() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPOForm, setShowPOForm] = useState(false);
  const [poListKey, setPoListKey] = useState(0);

  useEffect(() => {
    base44.auth.me()
      .then(u => { setUser(u); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const isManager = user?.role === 'admin' || user?.role === 'purchase_manager' || user?.role === 'production_manager';
  const isAdmin = user?.role === 'admin';

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Purchase Orders</h1>
        <p className="text-sm text-slate-500">Create and manage purchase orders</p>
      </div>

      {!showPOForm && isManager && (
        <Button onClick={() => setShowPOForm(true)} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 h-11">
          <Plus className="w-4 h-4 mr-2" /> New Purchase Order
        </Button>
      )}

      {showPOForm && (
        <POForm
          user={user}
          isAdmin={isAdmin}
          sourceMR={null}
          sourceItems={[]}
          onDone={() => { setShowPOForm(false); setPoListKey(k => k + 1); }}
          onCancel={() => setShowPOForm(false)}
        />
      )}

      {!showPOForm && (
        <POList key={poListKey} user={user} isManager={isManager} />
      )}
    </div>
  );
}