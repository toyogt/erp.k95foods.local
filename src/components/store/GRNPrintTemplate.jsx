import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

export default function GRNPrintTemplate({ grnId, gateId, items, notes, receivedBy, receivedAt }) {
  const printRef = useRef(null);

  function handlePrint() {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Goods Received Note — ${grnId}</title>
      <style>
        body { font-family: 'Inter', Arial, sans-serif; padding: 24px; color: #1e293b; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .meta { font-size: 12px; color: #64748b; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th { background: #f1f5f9; text-align: left; padding: 8px 12px; font-size: 12px; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; }
        td { padding: 8px 12px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
        .footer { margin-top: 24px; font-size: 11px; color: #94a3b8; }
        .notes { margin-top: 12px; padding: 8px 12px; background: #f8fafc; border-radius: 6px; font-size: 12px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      ${content.innerHTML}
      <script>window.onload = function() { window.print(); }</script>
      </body></html>
    `);
    win.document.close();
  }

  const dateStr = receivedAt ? new Date(receivedAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

  return (
    <div>
      <Button onClick={handlePrint} variant="outline" className="gap-2 h-11 text-sm">
        <Printer className="w-4 h-4" /> Print PDF
      </Button>

      {/* Hidden print content */}
      <div ref={printRef} style={{ display: 'none' }}>
        <h1>Goods Received Note</h1>
        <div className="meta">
          <p><strong>GRN ID:</strong> {grnId}</p>
          <p><strong>Gate Entry:</strong> {gateId}</p>
          <p><strong>Received By:</strong> {receivedBy || '—'}</p>
          <p><strong>Date:</strong> {dateStr}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Item Name</th>
              <th>Item Code</th>
              <th>Quantity</th>
              <th>Unit</th>
              <th>Batch / Lot</th>
              <th>Supplier</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{it.item_name}</td>
                <td>{it.item_code || '—'}</td>
                <td>{it.quantity}</td>
                <td>{it.uom || 'Nos'}</td>
                <td>{it.batch_lot || '—'}</td>
                <td>{it.supplier_name || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {notes && <div className="notes"><strong>Notes:</strong> {notes}</div>}
        <div className="footer">
          <p>Printed on {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })} — K95 ERP Store Management</p>
        </div>
      </div>
    </div>
  );
}