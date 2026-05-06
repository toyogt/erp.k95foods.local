import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, ChevronRight, ChevronLeft, ArrowLeft } from 'lucide-react';
import { genPONumber, logPurchaseAudit, formatINR, DEPARTMENTS } from '@/components/purchase/purchaseHelpers';
import { fireFMSEvent, findFMSInstanceByRef, linkFMSRef } from '@/lib/useFMSAutoComplete';
import { Link, useNavigate } from 'react-router-dom';

export default function BulkPOCreate() {
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(1);
  const [selectedPRs, setSelectedPRs] = useState(new Set());
  const [supplierName, setSupplierName] = useState('');
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [gstPercent, setGstPercent] = useState(18);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { base44.auth.me().then(u => setUser(u)).catch(() => {}); }, []);

  const { data: prs = [], isLoading } = useQuery({
    queryKey: ['bulk-po-prs'],
    queryFn: () => base44.entities.PurchaseRequest.list('-created_date', 300),
    staleTime: 30000, enabled: !!user,
  });

  const { data: existingPOs = [] } = useQuery({
    queryKey: ['bulk-po-existing'],
    queryFn: () => base44.entities.PurchaseOrder.list('-created_date', 500),
    staleTime: 30000, enabled: !!user,
  });

  const { data: allPRItems = [] } = useQuery({
    queryKey: ['bulk-po-pr-items'],
    queryFn: () => base44.entities.PurchaseRequestItem.list('-created_date', 2000),
    staleTime: 30000, enabled: !!user,
  });

  const poLinkedPRs = new Set(existingPOs.flatMap(po => [po.mr_id, ...(po.linked_pr_ids || [])]).filter(Boolean));
  const eligiblePRs = prs.filter(pr => {
    const isApproved = ['Approved', 'Partially Approved', 'APPROVED'].includes(pr.status);
    const prKey = pr.pr_number || pr.mr_id;
    return isApproved && !poLinkedPRs.has(prKey);
  });

  const selectedPRList = eligiblePRs.filter(pr => selectedPRs.has(pr.id));
  const consolidatedItems = selectedPRList.flatMap(pr => {
    const prKey = pr.pr_number || pr.mr_id;
    return allPRItems.filter(it => it.pr_number === prKey || it.mr_id === prKey);
  });

  const subtotal = consolidatedItems.reduce((s, it) => s + (it.estimated_rate || 0) * (it.qty || it.quantity || 0), 0);
  const gstAmount = subtotal * (gstPercent / 100);
  const total = subtotal + gstAmount;

  function togglePR(id) {
    setSelectedPRs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedPRs.size === eligiblePRs.length) setSelectedPRs(new Set());
    else setSelectedPRs(new Set(eligiblePRs.map(p => p.id)));
  }

  async function handleCreate() {
    if (!supplierName.trim() || !dueDate || selectedPRs.size === 0) return;
    setLoading(true);
    const poId = genPONumber();
    const prKeys = selectedPRList.map(pr => pr.pr_number || pr.mr_id);

    await base44.entities.PurchaseOrder.create({
      po_id: poId, supplier_id: supplierName, supplier_name: supplierName,
      mr_id: prKeys[0], linked_pr_ids: prKeys,
      po_date: poDate, due_date: dueDate, status: 'DRAFT',
      subtotal, gst_percent: gstPercent, gst_amount: gstAmount, total_amount: total,
      payment_terms: paymentTerms, delivery_address: deliveryAddress,
    });

    await Promise.all(consolidatedItems.map((it, i) =>
      base44.entities.PurchaseOrderItem.create({
        po_id: poId, line_number: i + 1,
        item_code: it.item_code || '', item_name: it.item_name || '',
        qty: it.qty || it.quantity || 0, quantity: it.qty || it.quantity || 0,
        uom_code: it.unit || it.uom_code || '', unit_price: it.estimated_rate || 0,
        total_price: (it.estimated_rate || 0) * (it.qty || it.quantity || 0),
      })
    ));

    for (const pr of selectedPRList) {
      await fireFMSEvent('purchase_order_created', pr.id);
      const instances = await findFMSInstanceByRef(pr.id);
      if (instances?.[0]) await linkFMSRef(instances[0].id, poId);
    }

    await logPurchaseAudit({ action: `Bulk PO ${poId} created from ${prKeys.length} PRs: ${prKeys.join(', ')}`, entity_type: 'PurchaseOrder', entity_id: poId, user });
    setLoading(false);
    navigate('/PurchaseOrders');
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-20">
      <div className="flex items-center gap-3">
        <Link to="/PurchaseOrders"><button className="p-2 rounded-lg hover:bg-slate-100"><ArrowLeft className="w-5 h-5 text-slate-500" /></button></Link>
        <div><h1 className="text-xl font-bold text-slate-900">Bulk Purchase Order</h1><p className="text-sm text-slate-500">Select multiple Purchase Requests and create a single Purchase Order</p></div>
      </div>

      <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
        {['Select Requests', 'Details', 'Review'].map((s, i) => (
          <span key={i} className={step === i + 1 ? 'text-blue-600' : ''}>{i + 1}. {s}{i < 2 ? ' ›' : ''}</span>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-3">
          {isLoading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div> : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">{eligiblePRs.length} eligible Purchase Requests</p>
                <button onClick={toggleAll} className="text-xs text-blue-600 font-medium">{selectedPRs.size === eligiblePRs.length ? 'Deselect All' : 'Select All'}</button>
              </div>
              {eligiblePRs.length === 0 ? <p className="text-center py-8 text-slate-400">No approved PRs without a PO found.</p> : (
                <div className="space-y-2">
                  {eligiblePRs.map(pr => (
                    <label key={pr.id} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${selectedPRs.has(pr.id) ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                      <input type="checkbox" className="w-4 h-4 rounded" checked={selectedPRs.has(pr.id)} onChange={() => togglePR(pr.id)} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 text-sm">{pr.pr_number || pr.mr_id}</p>
                        <p className="text-xs text-slate-500">{pr.title || '—'} · {pr.department || '—'}</p>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{pr.status}</span>
                    </label>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-slate-700">Supplier Name *</label>
              <input className="w-full h-11 md:h-9 border border-slate-200 rounded-xl px-3 text-sm mt-1" value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="Enter supplier name" />
            </div>
            <div><label className="text-xs font-medium text-slate-700">Purchase Order Date</label><input type="date" className="w-full h-11 md:h-9 border border-slate-200 rounded-xl px-3 text-sm mt-1" value={poDate} onChange={e => setPoDate(e.target.value)} /></div>
            <div><label className="text-xs font-medium text-slate-700">Due Date *</label><input type="date" className="w-full h-11 md:h-9 border border-slate-200 rounded-xl px-3 text-sm mt-1" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
            <div><label className="text-xs font-medium text-slate-700">Payment Terms</label><input className="w-full h-11 md:h-9 border border-slate-200 rounded-xl px-3 text-sm mt-1" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} placeholder="e.g. Net 30" /></div>
            <div><label className="text-xs font-medium text-slate-700">GST %</label><input type="number" className="w-full h-11 md:h-9 border border-slate-200 rounded-xl px-3 text-sm mt-1" value={gstPercent} onChange={e => setGstPercent(Number(e.target.value) || 0)} /></div>
          </div>
          <div><label className="text-xs font-medium text-slate-700">Delivery Address</label><textarea rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1 resize-none" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} /></div>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-600">Consolidated Items ({consolidatedItems.length})</div>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-50 text-xs text-slate-500"><th className="text-left px-3 py-2">Item</th><th className="text-right px-3 py-2">Qty</th><th className="text-left px-3 py-2">Unit</th><th className="text-right px-3 py-2">Rate</th><th className="text-right px-3 py-2">Amount</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{consolidatedItems.map((it, i) => (
                <tr key={i}><td className="px-3 py-2">{it.item_name || it.item_code}</td><td className="px-3 py-2 text-right">{it.qty || it.quantity || 0}</td><td className="px-3 py-2">{it.unit || it.uom_code || '—'}</td><td className="px-3 py-2 text-right">{formatINR(it.estimated_rate)}</td><td className="px-3 py-2 text-right font-bold">{formatINR((it.estimated_rate || 0) * (it.qty || it.quantity || 0))}</td></tr>
              ))}</tbody></table></div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-slate-900">Order Summary</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-slate-500">Supplier</span><span className="font-medium">{supplierName}</span>
              <span className="text-slate-500">Selected Requests</span><span className="font-medium">{selectedPRList.map(p => p.pr_number || p.mr_id).join(', ')}</span>
              <span className="text-slate-500">Items</span><span className="font-medium">{consolidatedItems.length}</span>
              <span className="text-slate-500">Subtotal</span><span className="font-medium">{formatINR(subtotal)}</span>
              <span className="text-slate-500">GST ({gstPercent}%)</span><span className="font-medium">{formatINR(gstAmount)}</span>
              <span className="text-slate-500 font-bold">Total</span><span className="font-bold text-lg">{formatINR(total)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={step === 1 ? () => navigate('/PurchaseOrders') : () => setStep(s => s - 1)} className="flex-1 h-11">
          <ChevronLeft className="w-4 h-4 mr-1" />{step === 1 ? 'Back' : 'Previous'}
        </Button>
        {step < 3 ? (
          <Button onClick={() => setStep(s => s + 1)} disabled={step === 1 ? selectedPRs.size === 0 : !supplierName.trim() || !dueDate} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700">
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleCreate} disabled={loading} className="flex-1 h-11 bg-green-600 hover:bg-green-700">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
            {loading ? 'Creating...' : 'Create Purchase Order'}
          </Button>
        )}
      </div>
    </div>
  );
}