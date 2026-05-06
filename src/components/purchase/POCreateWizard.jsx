import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react';
import { genPONumber, logPurchaseAudit, formatINR, UNITS } from './purchaseHelpers';
import { fireFMSEvent, findFMSInstanceByRef, linkFMSRef } from '@/lib/useFMSAutoComplete';
import CreatableSupplierSelect from './CreatableSupplierSelect';
import POFollowUpForm from './POFollowUpForm';
import { useNavigate } from 'react-router-dom';

export default function POCreateWizard({ pr, prItems, user }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Step 1: item-level supplier + rate
  const [itemRows, setItemRows] = useState([]);
  const [saveMapping, setSaveMapping] = useState(true);

  // Step 2: PO details
  const [poNumber, setPoNumber] = useState(genPONumber());
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [customTerms, setCustomTerms] = useState('');
  const [quotationNumber, setQuotationNumber] = useState('');
  const [shipVia, setShipVia] = useState('');
  const [estFreight, setEstFreight] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('K95 Foods Pvt Ltd, Factory Address');
  const [termsConditions, setTermsConditions] = useState('');

  // Step 3: follow-ups
  const [followUps, setFollowUps] = useState([]);

  const { data: mappings = [] } = useQuery({
    queryKey: ['supplier-item-mappings'],
    queryFn: () => base44.entities.SupplierItemMapping.filter({ is_active: true }, '-created_date', 500).catch(() => []),
    staleTime: 60000,
  });

  const { data: quotations = [] } = useQuery({
    queryKey: ['pr-quotations-wizard', pr?.pr_number],
    queryFn: () => base44.entities.PRQuotation.filter({ pr_number: pr?.pr_number || pr?.mr_id, is_selected: true }, '-created_date', 50).catch(() => []),
    staleTime: 30000, enabled: !!pr,
  });

  useEffect(() => {
    if (prItems?.length > 0 && itemRows.length === 0) {
      setItemRows(prItems.filter(it => it.item_status === 'Approved' || it.item_status === 'Pending').map(it => {
        const mapping = mappings.find(m => m.item_code === it.item_code && m.is_preferred);
        const quotation = quotations.find(q => q.line_number === it.line_number && q.is_selected);
        return {
          ...it, supplier_id: quotation?.supplier_id || mapping?.supplier_id || '',
          supplier_name: quotation?.supplier_name || mapping?.supplier_name || '',
          rate: quotation?.quoted_rate || it.estimated_rate || 0,
          gst_percent: 18,
          suggested_supplier: mapping?.supplier_name || null,
          suggested_rate: mapping?.last_rate || null,
        };
      }));
      if (quotations.length > 0) setQuotationNumber(quotations[0].quotation_document ? 'Ref: Quotation' : '');
    }
  }, [prItems, mappings, quotations]);

  function updateItemRow(idx, updates) { setItemRows(prev => prev.map((r, i) => i === idx ? { ...r, ...updates } : r)); }

  const subtotal = itemRows.reduce((s, r) => s + (r.rate || 0) * (r.qty || r.quantity || 0), 0);
  const totalGST = itemRows.reduce((s, r) => { const amt = (r.rate || 0) * (r.qty || r.quantity || 0); return s + amt * ((r.gst_percent || 0) / 100); }, 0);
  const totalAmount = subtotal + totalGST + Number(estFreight || 0);

  async function handleCreate() {
    setLoading(true);
    const prKey = pr?.pr_number || pr?.mr_id;
    const firstSupplier = itemRows.find(r => r.supplier_name)?.supplier_name || '';
    const firstSupplierId = itemRows.find(r => r.supplier_id)?.supplier_id || '';

    const po = await base44.entities.PurchaseOrder.create({
      po_id: poNumber, pr_number: prKey, supplier_id: firstSupplierId, supplier_name: firstSupplier,
      mr_id: prKey, po_date: poDate, due_date: dueDate, status: 'Draft',
      subtotal, gst_amount: totalGST, total_amount: totalAmount,
      payment_terms: paymentTerms === 'Custom' ? customTerms : paymentTerms,
      custom_payment_terms: paymentTerms === 'Custom' ? customTerms : '',
      quotation_number: quotationNumber, ship_via: shipVia,
      estimated_freight: Number(estFreight || 0), delivery_address: deliveryAddress,
      terms_and_conditions: termsConditions,
    });

    await Promise.all(itemRows.map((it, i) =>
      base44.entities.PurchaseOrderItem.create({
        po_id: poNumber, line_number: i + 1,
        item_code: it.item_code || '', item_name: it.item_name || '',
        uom_code: it.unit || it.uom_code || '',
        qty: it.qty || it.quantity || 0, rate: it.rate || 0,
        gst_percent: it.gst_percent || 0,
        gst_amount: (it.rate || 0) * (it.qty || it.quantity || 0) * ((it.gst_percent || 0) / 100),
        amount: (it.rate || 0) * (it.qty || it.quantity || 0),
        total_amount: (it.rate || 0) * (it.qty || it.quantity || 0) * (1 + (it.gst_percent || 0) / 100),
        pending_qty: it.qty || it.quantity || 0, received_qty: 0,
        supplier_id: it.supplier_id || '', remarks: `From ${prKey}`,
      })
    ));

    // Create follow-ups
    const validFUs = followUps.filter(f => f.follow_up_date);
    if (validFUs.length > 0) {
      await Promise.all(validFUs.map(f =>
        base44.entities.POFollowUp.create({ po_id: poNumber, follow_up_date: f.follow_up_date, follow_up_mode: f.follow_up_mode || 'Call', contact_person: f.contact_person || '', status: 'Pending' })
      ));
    }

    // Save supplier-item mappings
    if (saveMapping) {
      for (const it of itemRows) {
        if (it.supplier_id && it.item_code) {
          const existing = mappings.find(m => m.supplier_id === it.supplier_id && m.item_code === it.item_code);
          if (existing) {
            await base44.entities.SupplierItemMapping.update(existing.id, { last_rate: it.rate || 0 });
          } else {
            await base44.entities.SupplierItemMapping.create({ supplier_id: it.supplier_id, supplier_name: it.supplier_name, item_code: it.item_code, item_name: it.item_name, last_rate: it.rate || 0, is_active: true });
          }
        }
      }
    }

    // Update PR status
    if (pr?.id) {
      await base44.entities.PurchaseRequest.update(pr.id, { status: 'PO Created' });
    }

    // FMS
    if (pr?.id) {
      await fireFMSEvent('purchase_order_created', pr.id);
      const instances = await findFMSInstanceByRef(pr.id);
      if (instances?.[0]) await linkFMSRef(instances[0].id, po.id);
    }

    await logPurchaseAudit({ action: `Purchase Order ${poNumber} created from Purchase Request ${prKey}`, action_type: 'create', entity_type: 'PurchaseOrder', entity_id: poNumber, user });
    setLoading(false);
    navigate('/PurchaseOrderList');
  }

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
        {['Supplier & Items', 'Order Details', 'Follow-Up & Review'].map((s, i) => (
          <span key={i} className={step === i + 1 ? 'text-blue-600' : ''}>{i + 1}. {s}{i < 2 ? ' ›' : ''}</span>
        ))}
      </div>

      {/* Step 1: Supplier per item */}
      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">Assign supplier and rate per item</p>
          {itemRows.map((row, idx) => (
            <div key={idx} className="border border-slate-200 rounded-xl p-3 space-y-2 bg-white">
              <p className="text-sm font-bold text-slate-900">#{idx + 1} {row.item_name}</p>
              {row.suggested_supplier && <p className="text-xs text-blue-600">Suggested: {row.suggested_supplier}{row.suggested_rate ? ` (Last rate: ${formatINR(row.suggested_rate)})` : ''}</p>}
              <CreatableSupplierSelect value={row.supplier_name} onChange={s => updateItemRow(idx, { supplier_id: s.supplier_id, supplier_name: s.supplier_name })} user={user} showClear />
              <div className="grid grid-cols-3 gap-2">
                <div><label className="text-xs font-medium text-slate-700">Quantity</label><input type="number" className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm mt-1" value={row.qty || row.quantity || ''} onChange={e => updateItemRow(idx, { qty: Number(e.target.value) || 0, quantity: Number(e.target.value) || 0 })} /></div>
                <div><label className="text-xs font-medium text-slate-700">Rate (₹)</label><input type="number" className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm mt-1" value={row.rate || ''} onChange={e => updateItemRow(idx, { rate: Number(e.target.value) || 0 })} /></div>
                <div><label className="text-xs font-medium text-slate-700">GST %</label><input type="number" className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm mt-1" value={row.gst_percent || ''} onChange={e => updateItemRow(idx, { gst_percent: Number(e.target.value) || 0 })} /></div>
              </div>
              <p className="text-xs text-right text-slate-500">Amount: {formatINR((row.rate || 0) * (row.qty || row.quantity || 0))}</p>
            </div>
          ))}
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="w-4 h-4 rounded" checked={saveMapping} onChange={e => setSaveMapping(e.target.checked)} /> Save supplier-item mapping for future</label>
          <div className="bg-slate-50 rounded-xl p-3 text-right"><p className="text-sm text-slate-600">Running Total: <strong className="text-lg text-slate-900">{formatINR(subtotal)}</strong></p></div>
        </div>
      )}

      {/* Step 2: PO Details */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-slate-700">Purchase Order Number</label><input className="w-full h-11 md:h-9 border border-slate-200 rounded-xl px-3 text-sm mt-1" value={poNumber} onChange={e => setPoNumber(e.target.value)} /></div>
            <div><label className="text-xs font-medium text-slate-700">Purchase Order Date</label><input type="date" className="w-full h-11 md:h-9 border border-slate-200 rounded-xl px-3 text-sm mt-1" value={poDate} onChange={e => setPoDate(e.target.value)} /></div>
            <div><label className="text-xs font-medium text-slate-700">Due Date *</label><input type="date" className="w-full h-11 md:h-9 border border-slate-200 rounded-xl px-3 text-sm mt-1" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
            <div><label className="text-xs font-medium text-slate-700">Payment Terms</label>
              <select className="w-full h-11 md:h-9 border border-slate-200 rounded-xl px-3 text-sm bg-white mt-1" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}>
                <option value="">Select</option><option value="Advance">Advance</option><option value="On Delivery">On Delivery</option>
                <option value="Net 30">Net 30</option><option value="Net 60">Net 60</option><option value="Custom">Custom</option>
              </select>
            </div>
            {paymentTerms === 'Custom' && <div className="md:col-span-2"><label className="text-xs font-medium text-slate-700">Custom Payment Terms</label><input className="w-full h-9 border border-slate-200 rounded-xl px-3 text-sm mt-1" value={customTerms} onChange={e => setCustomTerms(e.target.value)} /></div>}
            <div><label className="text-xs font-medium text-slate-700">Quotation Reference</label><input className="w-full h-9 border border-slate-200 rounded-xl px-3 text-sm mt-1" value={quotationNumber} onChange={e => setQuotationNumber(e.target.value)} placeholder="Quotation number" /></div>
            <div><label className="text-xs font-medium text-slate-700">Ship Via</label><input className="w-full h-9 border border-slate-200 rounded-xl px-3 text-sm mt-1" value={shipVia} onChange={e => setShipVia(e.target.value)} placeholder="Transporter name" /></div>
            <div><label className="text-xs font-medium text-slate-700">Estimated Freight (₹)</label><input type="number" className="w-full h-9 border border-slate-200 rounded-xl px-3 text-sm mt-1" value={estFreight} onChange={e => setEstFreight(e.target.value)} /></div>
          </div>
          <div><label className="text-xs font-medium text-slate-700">Delivery Address</label><textarea rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1 resize-none" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} /></div>
          <div><label className="text-xs font-medium text-slate-700">Terms & Conditions</label><textarea rows={3} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1 resize-none" value={termsConditions} onChange={e => setTermsConditions(e.target.value)} /></div>
        </div>
      )}

      {/* Step 3: Follow-up & Summary */}
      {step === 3 && (
        <div className="space-y-4">
          <POFollowUpForm followUps={followUps} onChange={setFollowUps} />
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-slate-900">Order Summary</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-slate-500">Purchase Order</span><span className="font-bold">{poNumber}</span>
              <span className="text-slate-500">Supplier</span><span className="font-medium">{itemRows[0]?.supplier_name || '—'}</span>
              <span className="text-slate-500">Items</span><span className="font-medium">{itemRows.length}</span>
              <span className="text-slate-500">Subtotal</span><span className="font-medium">{formatINR(subtotal)}</span>
              <span className="text-slate-500">GST</span><span className="font-medium">{formatINR(totalGST)}</span>
              {Number(estFreight) > 0 && <><span className="text-slate-500">Est. Freight</span><span className="font-medium">{formatINR(Number(estFreight))}</span></>}
              <span className="text-slate-500 font-bold">Total</span><span className="font-bold text-lg">{formatINR(totalAmount)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={step === 1 ? () => navigate('/PurchaseOrderList') : () => setStep(s => s - 1)} className="flex-1 h-11">
          <ChevronLeft className="w-4 h-4 mr-1" />{step === 1 ? 'Cancel' : 'Previous'}
        </Button>
        {step < 3 ? (
          <Button onClick={() => setStep(s => s + 1)} disabled={step === 1 ? !itemRows.some(r => r.supplier_name) : !dueDate} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700">
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