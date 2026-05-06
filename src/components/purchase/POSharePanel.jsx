import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { MessageCircle, Mail, Send } from 'lucide-react';
import { formatINR, formatDateDDMMYYYY, logPurchaseAudit } from './purchaseHelpers';

export default function POSharePanel({ po, user, onSent }) {
  const msg = `Purchase Order: ${po.po_id}\nDate: ${formatDateDDMMYYYY(po.po_date)}\nDue: ${formatDateDDMMYYYY(po.due_date)}\nTotal: ${formatINR(po.total_amount)}\nPayment: ${po.payment_terms || 'As agreed'}`;

  async function markSent(via) {
    if (po.status !== 'Sent to Supplier') {
      await base44.entities.PurchaseOrder.update(po.id, { sent_at: new Date().toISOString(), sent_via: via });
      await logPurchaseAudit({ action: `Purchase Order ${po.po_id} shared via ${via}`, action_type: 'status_change', entity_type: 'PurchaseOrder', entity_id: po.po_id, user });
    }
    if (onSent) onSent();
  }

  function shareWhatsApp() {
    const phone = po.supplier_contact?.replace(/\D/g, '') || '';
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    markSent('WHATSAPP');
  }

  function shareEmail() {
    const email = po.supplier_email || '';
    const subject = `Purchase Order ${po.po_id} — ${po.supplier_name}`;
    window.open(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`, '_blank');
    markSent('EMAIL');
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-700">Share Purchase Order</p>
      <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 whitespace-pre-line font-mono">{msg}</div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={shareWhatsApp} className="flex-1 h-11 text-green-700 border-green-300 hover:bg-green-50 font-bold">
          <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
        </Button>
        <Button variant="outline" onClick={shareEmail} className="flex-1 h-11 text-blue-700 border-blue-300 hover:bg-blue-50 font-bold">
          <Mail className="w-4 h-4 mr-2" /> Email
        </Button>
      </div>
    </div>
  );
}