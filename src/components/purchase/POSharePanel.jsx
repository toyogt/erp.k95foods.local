import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { MessageCircle, Mail, AlertCircle } from 'lucide-react';
import { logPurchaseAudit } from './purchaseHelpers';

export default function POSharePanel({ po, poItems, supplier, user, onStatusChanged }) {
  const [msg, setMsg] = useState('');

  async function markSent(via) {
    if (po.status !== 'SENT') {
      await base44.entities.PurchaseOrder.update(po.id, {
        status: 'SENT',
        sent_at: new Date().toISOString(),
        sent_via: via,
      });
      await logPurchaseAudit({ action: `PO_SENT via ${via}`, entity_type: 'PurchaseOrder', entity_id: po.po_id, user });
      onStatusChanged?.();
    }
  }

  function buildMessage() {
    const itemLines = (poItems || []).map(it => `• ${it.item_name || it.item_code}: ${it.qty} ${it.uom_code} @ ₹${it.rate}`).join('\n');
    return `PO ${po.po_id}\nSupplier: ${po.supplier_name}\nDate: ${po.po_date}\n\nItems:\n${itemLines}\n\nTotal: ₹${Number(po.total_amount || 0).toFixed(2)}\n\nKindly confirm receipt and expected delivery date.`;
  }

  async function handleWhatsApp() {
    const phone = supplier?.phone?.replace(/[^0-9]/g, '');
    if (!phone) { setMsg('Supplier phone missing. Please update supplier record.'); return; }
    setMsg('');
    const text = encodeURIComponent(buildMessage());
    const url = `https://wa.me/${phone}?text=${text}`;
    window.open(url, '_blank');
    await markSent('WHATSAPP');
  }

  async function handleEmail() {
    const email = supplier?.email;
    if (!email) { setMsg('Supplier email missing. Please update supplier record.'); return; }
    setMsg('');
    const subject = encodeURIComponent(`Purchase Order ${po.po_id}`);
    const body = encodeURIComponent(buildMessage());
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
    await markSent('EMAIL');
  }

  if (!['APPROVED', 'SENT'].includes(po.status)) return null;

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Share PO with Supplier</p>
      {msg && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-xl p-2.5 border border-red-100">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {msg}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={handleWhatsApp}
          className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-xl py-2.5 font-semibold text-sm transition-colors">
          <MessageCircle className="w-4 h-4" />
          WhatsApp
        </button>
        <button onClick={handleEmail}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 font-semibold text-sm transition-colors">
          <Mail className="w-4 h-4" />
          Email
        </button>
      </div>
      {po.sent_at && (
        <p className="text-xs text-slate-400 text-center">
          Last sent via {po.sent_via} at {new Date(po.sent_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}