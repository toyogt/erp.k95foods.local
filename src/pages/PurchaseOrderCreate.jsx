import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import BulkPOCreate from './BulkPOCreate';

export default function PurchaseOrderCreate() {
  const urlParams = new URLSearchParams(window.location.search);
  const prParam = urlParams.get('pr');

  const [user, setUser] = useState(null);
  const [pr, setPr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [existingPO, setExistingPO] = useState(null);

  useEffect(() => {
    async function init() {
      const u = await base44.auth.me();
      setUser(u);

      if (!prParam) { setLoading(false); return; }

      const prs = await base44.entities.PurchaseRequest.filter({ pr_number: prParam }, '-created_date', 1).catch(() => []);
      if (prs.length === 0) {
        const mrPrs = await base44.entities.PurchaseRequest.filter({ mr_id: prParam }, '-created_date', 1).catch(() => []);
        if (mrPrs.length > 0) setPr(mrPrs[0]);
        else setError(`Purchase Request ${prParam} not found`);
      } else {
        setPr(prs[0]);
      }

      const pos = await base44.entities.PurchaseOrder.filter({ mr_id: prParam }, '-created_date', 1).catch(() => []);
      if (pos.length > 0) setExistingPO(pos[0]);

      setLoading(false);
    }
    init();
  }, [prParam]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto text-center py-12 space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">{error}</h2>
        <Link to="/PurchaseOrders"><Button variant="outline" className="h-11"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Purchase Orders</Button></Link>
      </div>
    );
  }

  if (existingPO) {
    return (
      <div className="max-w-lg mx-auto text-center py-12 space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Purchase Order Already Exists</h2>
        <p className="text-sm text-slate-500">PO <strong>{existingPO.po_id}</strong> is already linked to this Purchase Request.</p>
        <Link to="/PurchaseOrders"><Button className="h-11">View Purchase Orders</Button></Link>
      </div>
    );
  }

  if (!prParam) {
    return <BulkPOCreate />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-20">
      <div className="flex items-center gap-3">
        <Link to="/PurchaseOrders"><button className="p-2 rounded-lg hover:bg-slate-100"><ArrowLeft className="w-5 h-5 text-slate-500" /></button></Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Create Purchase Order</h1>
          <p className="text-sm text-slate-500">From Purchase Request: {prParam}</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
        Use the Bulk Purchase Order wizard to complete this order. The selected PR will be pre-checked.
      </div>

      <Link to="/BulkPOCreate"><Button className="h-11 w-full">Continue to Purchase Order Wizard</Button></Link>
    </div>
  );
}