import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { formatINR, formatDateDDMMYYYY } from './purchaseHelpers';

export default function POPdfView({ po }) {
  const printRef = useRef(null);

  const { data: poItems = [] } = useQuery({
    queryKey: ['po-pdf-items', po.po_id],
    queryFn: () => base44.entities.PurchaseOrderItem.filter({ po_id: po.po_id }, 'line_number', 100),
    staleTime: 20000,
  });

  function handlePrint() {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Purchase Order ${po.po_id}</title><style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #1e293b; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
      th { background: #f1f5f9; font-size: 11px; }
      .header { text-align: center; margin-bottom: 16px; }
      .header h1 { font-size: 18px; margin: 0; }
      .meta { display: flex; justify-content: space-between; margin: 12px 0; }
      .totals { text-align: right; margin-top: 12px; }
      @media print { body { padding: 0; } }
    </style></head><body>${content.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  }

  return (
    <div className="space-y-3">
      <Button variant="outline" onClick={handlePrint} className="h-11 w-full font-bold gap-2"><Printer className="w-4 h-4" /> Print / Download PDF</Button>
      <div ref={printRef} className="bg-white border border-slate-200 rounded-xl p-6 text-sm">
        <div className="header">
          <h1>K95 Foods Pvt Ltd</h1>
          <p style={{ fontSize: '10px', color: '#64748b' }}>FSSAI: XXXXXXXXXX | GSTIN: XXXXXXXXXX | MSME: XXXXXXXXXX</p>
        </div>
        <h2 style={{ textAlign: 'center', fontSize: '16px', margin: '12px 0' }}>PURCHASE ORDER</h2>
        <div className="meta" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <p><strong>Vendor:</strong> {po.supplier_name}</p>
            {po.supplier_address && <p>{po.supplier_address}</p>}
            {po.supplier_gstin && <p>GSTIN: {po.supplier_gstin}</p>}
            {po.supplier_contact && <p>Contact: {po.supplier_contact}</p>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <p><strong>Purchase Order:</strong> {po.po_id}</p>
            <p><strong>Date:</strong> {formatDateDDMMYYYY(po.po_date)}</p>
            <p><strong>Due:</strong> {formatDateDDMMYYYY(po.due_date)}</p>
            {po.quotation_number && <p><strong>Quotation:</strong> {po.quotation_number}</p>}
          </div>
        </div>
        {po.delivery_address && (
          <div style={{ margin: '8px 0', padding: '6px', background: '#f8fafc', borderRadius: '4px' }}>
            <strong>Ship To:</strong> {po.delivery_address}
          </div>
        )}
        <table>
          <thead><tr><th>#</th><th>Item</th><th>Unit</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Rate</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
          <tbody>
            {poItems.map((it, i) => (
              <tr key={i}>
                <td>{i + 1}</td><td>{it.item_name || it.item_code}</td><td>{it.uom_code || '—'}</td>
                <td style={{ textAlign: 'right' }}>{it.qty || it.quantity || 0}</td>
                <td style={{ textAlign: 'right' }}>{formatINR(it.rate || it.unit_price)}</td>
                <td style={{ textAlign: 'right' }}>{formatINR(it.amount || (it.rate || 0) * (it.qty || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="totals" style={{ textAlign: 'right' }}>
          <p>Subtotal: <strong>{formatINR(po.subtotal)}</strong></p>
          <p>GST: <strong>{formatINR(po.gst_amount)}</strong></p>
          {po.estimated_freight > 0 && <p>Est. Freight: <strong>{formatINR(po.estimated_freight)}</strong></p>}
          <p style={{ fontSize: '14px', marginTop: '4px' }}>Total: <strong>{formatINR(po.total_amount)}</strong></p>
        </div>
        {po.payment_terms && <p style={{ marginTop: '12px' }}><strong>Payment Terms:</strong> {po.payment_terms}</p>}
        {po.terms_and_conditions && <p style={{ marginTop: '8px' }}><strong>Terms:</strong> {po.terms_and_conditions}</p>}
      </div>
    </div>
  );
}