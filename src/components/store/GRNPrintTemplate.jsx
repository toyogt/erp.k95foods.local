import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, QrCode } from 'lucide-react';
import QRCode from 'react-qr-code';

function LotQRPrint({ lots }) {
  function handlePrintQR() {
    const win = window.open('', '_blank', 'width=500,height=700');
    const lotsHtml = (lots || []).map(l => {
      const qrVal = l.lot_id || l.batch_lot || '';
      if (!qrVal) return '';
      return `
        <div style="page-break-inside:avoid;text-align:center;margin-bottom:24px;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
          <p style="font-size:14px;font-weight:600;margin:0 0 2px">${l.item_name || ''}</p>
          <p style="font-size:11px;color:#64748b;margin:0 0 8px">${l.supplier_name || ''}</p>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrVal)}" style="width:160px;height:160px" />
          <p style="font-family:monospace;font-size:12px;font-weight:bold;margin:8px 0 2px">${qrVal}</p>
          <p style="font-size:10px;color:#94a3b8">${l.quantity || ''} ${l.uom || 'Nos'}</p>
        </div>`;
    }).join('');
    win.document.write(`<html><head><title>Lot QR Codes</title>
      <style>body{font-family:sans-serif;padding:16px}@media print{body{padding:0}}</style>
      </head><body>${lotsHtml}<script>window.onload=function(){window.print()}</script></body></html>`);
    win.document.close();
  }

  if (!lots || lots.length === 0) return null;
  return (
    <Button onClick={handlePrintQR} variant="outline" className="gap-2 h-11 text-sm">
      <QrCode className="w-4 h-4" /> Print QR
    </Button>
  );
}

export { LotQRPrint };

export default function GRNPrintTemplate({ grnId, gateId, items, notes, receivedBy, receivedAt, lotItems }) {
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
        .meta p { margin: 2px 0; }
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
    <div className="flex gap-1.5 items-center">
      <Button onClick={handlePrint} variant="outline" size="sm" className="gap-1.5 h-9 text-xs">
        <Printer className="w-3.5 h-3.5" /> PDF
      </Button>
      <LotQRPrint lots={lotItems || items} />

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
                <td>{it.quantity || it.received_qty || '—'}</td>
                <td>{it.uom || it.uom_code || 'Nos'}</td>
                <td>{it.batch_lot || it.batch_or_lot_text || '—'}</td>
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