import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { X, Loader2, Save, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { genPONumber, logPurchaseAudit, formatINR } from './purchaseHelpers';
import { fireFMSEvent, findFMSInstanceByRef, linkFMSRef } from '@/lib/useFMSAutoComplete';
import POCreateDetailsTab from './POCreateDetailsTab';
import POCreateItemsTab from './POCreateItemsTab';
import POCreateTaxesTab from './POCreateTaxesTab';
import POCreateTermsTab from './POCreateTermsTab';

const TABS = [
  { key: 'details', label: 'Details' },
  { key: 'items', label: 'Items' },
  { key: 'taxes', label: 'Taxes & Charges' },
  { key: 'terms', label: 'Terms' },
];

export default function POCreateModal({ open, onClose, user, onCreated }) {
  const [activeTab, setActiveTab] = useState('details');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    po_date: new Date().toISOString().split('T')[0],
    due_date: '',
    supplier_id: '',
    supplier_name: '',
    supplier_gstin: '',
    supplier_address: '',
    supplier_contact: '',
    supplier_email: '',
    payment_terms: '',
    custom_payment_terms: '',
    quotation_number: '',
    ship_via: '',
    delivery_address: 'K95 Foods Pvt Ltd, Factory Address',
    estimated_freight: '',
    terms_and_conditions: '',
    internal_notes: '',
    linked_pr_ids: [],
    pr_number: '',
  });

  const [items, setItems] = useState([
    { item_code: '', item_name: '', qty: 0, uom_code: '', rate: 0, gst_percent: 18, required_by: '' },
  ]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setActiveTab('details');
      setError('');
      setForm({
        po_date: new Date().toISOString().split('T')[0],
        due_date: '', supplier_id: '', supplier_name: '',
        supplier_gstin: '', supplier_address: '', supplier_contact: '', supplier_email: '',
        payment_terms: '', custom_payment_terms: '', quotation_number: '', ship_via: '',
        delivery_address: 'K95 Foods Pvt Ltd, Factory Address',
        estimated_freight: '', terms_and_conditions: '', internal_notes: '',
        linked_pr_ids: [], pr_number: '',
      });
      setItems([{ item_code: '', item_name: '', qty: 0, uom_code: '', rate: 0, gst_percent: 18, required_by: '' }]);
    }
  }, [open]);

  if (!open) return null;

  function validate() {
    if (!form.supplier_name?.trim()) return 'Supplier is required';
    if (!form.due_date) return 'Required By date is required';
    const validItems = items.filter(r => r.item_code || r.item_name);
    if (validItems.length === 0) return 'At least one item is required';
    for (let i = 0; i < validItems.length; i++) {
      if ((validItems[i].qty || 0) <= 0) return `Item ${i + 1} must have a quantity greater than 0`;
    }
    return '';
  }

  async function handleSave() {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setSaving(true);

    const poId = genPONumber();
    const validItems = items.filter(r => r.item_code || r.item_name);

    const subtotal = validItems.reduce((s, r) => s + (r.rate || 0) * (r.qty || 0), 0);
    const gstAmount = validItems.reduce((s, r) => {
      const amt = (r.rate || 0) * (r.qty || 0);
      return s + amt * ((r.gst_percent || 0) / 100);
    }, 0);
    const freight = Number(form.estimated_freight || 0);
    const totalAmount = subtotal + gstAmount + freight;

    const payTerms = form.payment_terms === 'Custom' ? form.custom_payment_terms : form.payment_terms;

    const po = await base44.entities.PurchaseOrder.create({
      po_id: poId,
      supplier_id: form.supplier_id || form.supplier_name,
      supplier_name: form.supplier_name,
      supplier_gstin: form.supplier_gstin,
      supplier_address: form.supplier_address,
      supplier_contact: form.supplier_contact,
      supplier_email: form.supplier_email,
      pr_number: form.pr_number || '',
      mr_id: form.pr_number || '',
      linked_pr_ids: form.linked_pr_ids || [],
      po_date: form.po_date,
      due_date: form.due_date,
      status: 'Draft',
      subtotal,
      gst_amount: gstAmount,
      total_amount: totalAmount,
      payment_terms: payTerms,
      custom_payment_terms: form.payment_terms === 'Custom' ? form.custom_payment_terms : '',
      quotation_number: form.quotation_number,
      ship_via: form.ship_via,
      estimated_freight: freight,
      delivery_address: form.delivery_address,
      terms_and_conditions: form.terms_and_conditions,
    });

    // Create PO items
    await Promise.all(validItems.map((it, i) =>
      base44.entities.PurchaseOrderItem.create({
        po_id: poId,
        line_number: i + 1,
        item_code: it.item_code || it.item_name || '',
        item_name: it.item_name || '',
        uom_code: it.uom_code || '',
        qty: it.qty || 0,
        rate: it.rate || 0,
        gst_percent: it.gst_percent || 0,
        gst_amount: (it.rate || 0) * (it.qty || 0) * ((it.gst_percent || 0) / 100),
        amount: (it.rate || 0) * (it.qty || 0),
        total_amount: (it.rate || 0) * (it.qty || 0) * (1 + (it.gst_percent || 0) / 100),
        pending_qty: it.qty || 0,
        received_qty: 0,
        remarks: it._source_pr ? `From ${it._source_pr}` : '',
      })
    ));

    // Update linked PRs
    const linkedPRKeys = form.linked_pr_ids || [];
    if (linkedPRKeys.length > 0) {
      const allPRs = await base44.entities.PurchaseRequest.list('-created_date', 500);
      for (const prKey of linkedPRKeys) {
        const pr = allPRs.find(p => (p.pr_number || p.mr_id) === prKey);
        if (pr) {
          await base44.entities.PurchaseRequest.update(pr.id, { status: 'PO Created' });
          await fireFMSEvent('purchase_order_created', pr.id);
          const instances = await findFMSInstanceByRef(pr.id);
          if (instances?.[0]) await linkFMSRef(instances[0].id, po.id);
        }
      }
    }

    await logPurchaseAudit({
      action: `Purchase Order ${poId} created${linkedPRKeys.length ? ` from ${linkedPRKeys.join(', ')}` : ''}`,
      action_type: 'create', entity_type: 'PurchaseOrder', entity_id: poId, user,
    });

    queryClient.invalidateQueries({ queryKey: ['po-list'] });
    setSaving(false);
    onCreated?.(poId);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-4 md:py-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-3 md:mx-auto flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-900">New Purchase Order</h2>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">Not Saved</span>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={saving} className="h-11 md:h-9 px-5 bg-slate-900 hover:bg-slate-800 font-bold text-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 shrink-0 px-5 overflow-x-auto no-scrollbar">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'details' && <POCreateDetailsTab form={form} setForm={setForm} user={user} />}
          {activeTab === 'items' && <POCreateItemsTab items={items} setItems={setItems} form={form} setForm={setForm} />}
          {activeTab === 'taxes' && <POCreateTaxesTab items={items} setItems={setItems} form={form} setForm={setForm} />}
          {activeTab === 'terms' && <POCreateTermsTab form={form} setForm={setForm} />}
        </div>
      </div>
    </div>
  );
}