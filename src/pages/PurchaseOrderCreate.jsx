import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import POCreateWizard from '@/components/purchase/POCreateWizard';
import BulkPOCreate from './BulkPOCreate';

export default function PurchaseOrderCreate() {
  const urlParams = new URLSearchParams(window.location.search);
  const prParam = urlParams.get('pr');

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { base44.auth.me().then(u => { setUser(u); setLoading(false); }).catch(() => setLoading(false)); }, []);

  // Fetch PR if specified
  const { data: prList = [], isLoading: prLoading } = useQuery({
    queryKey: ['po-create-pr', prParam],
    queryFn: async () => {
      if (!prParam) return [];
      const byPr = await base44.entities.PurchaseRequest.filter({ pr_number: prParam }, '-created_date', 1).catch(() => []);
      if (byPr.length > 0) return byPr;
      return base44.entities.PurchaseRequest.filter({ mr_id: prParam }, '-created_date', 1).catch(() => []);
    },
    staleTime: 30000, enabled: !!user && !!prParam,
  });

  // Fetch PR items
  const pr = prList[0] || null;
  const prKey = pr?.pr_number || pr?.mr_id;
  const { data: prItems = [] } = useQuery({
    queryKey: ['po-create-pr-items', prKey],
    queryFn: async () => {
      if (!prKey) return [];
      const [byPr, byMr] = await Promise.all([
        base44.entities.PurchaseRequestItem.filter({ pr_number: prKey }, 'line_number', 100).catch(() => []),
        base44.entities.PurchaseRequestItem.filter({ mr_id: prKey }, 'line_number', 100).catch(() => []),
      ]);
      return byPr.length > 0 ? byPr : byMr;
    },
    staleTime: 30000, enabled: !!prKey,
  });

  // Check for existing PO
  const { data: existingPOs = [] } = useQuery({
    queryKey: ['po-create-existing', prKey],
    queryFn: () => base44.entities.PurchaseOrder.filter({ pr_number: prKey }, '-created_date', 5).catch(() => []),
    staleTime: 30000, enabled: !!prKey,
  });

  if (loading || prLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  }

  // No PR param → show Bulk wizard
  if (!prParam) return <BulkPOCreate />;

  // PR not found
  if (prParam && prList.length === 0 && !prLoading) {
    return (
      <div className="max-w-lg mx-auto text-center py-12 space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Purchase Request {prParam} not found</h2>
        <Link to="/PurchaseOrderList"><Button variant="outline" className="h-11"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Purchase Orders</Button></Link>
      </div>
    );
  }

  // Already has PO
  if (existingPOs.length > 0) {
    return (
      <div className="max-w-lg mx-auto text-center py-12 space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Purchase Order Already Exists</h2>
        <p className="text-sm text-slate-500">Purchase Order <strong>{existingPOs[0].po_id}</strong> is already linked to this Purchase Request.</p>
        <Link to="/PurchaseOrderList"><Button className="h-11">View Purchase Orders</Button></Link>
      </div>
    );
  }

  // Show wizard
  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-20">
      <div className="flex items-center gap-3">
        <Link to="/PurchaseOrderList"><button className="p-2 rounded-lg hover:bg-slate-100"><ArrowLeft className="w-5 h-5 text-slate-500" /></button></Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Create Purchase Order</h1>
          <p className="text-sm text-slate-500">From Purchase Request: {prKey}</p>
        </div>
      </div>
      <POCreateWizard pr={pr} prItems={prItems} user={user} />
    </div>
  );
}