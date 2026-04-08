import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, QrCode } from 'lucide-react';

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
    <Button onClick={handlePrintQR} variant="outline" size="sm" className="gap-1.5 h-9 text-xs">
      <QrCode className="w-3.5 h-3.5" /> QR
    </Button>
  );
}

export { LotQRPrint };

export default function GRNPrintTemplate({ grnId, gateId, items, notes, receivedBy, receivedAt, lotItems, supplierName, invoiceNumber, invoiceDate, poId, status }) {
  const printRef = useRef(null);

  function handlePrint() {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Goods Received Note — ${grnId}</title>
      <style>
        body { font-family: 'Inter', Arial, sans-serif; padding: 32px; color: #1e293b; max-width: 800px; margin: 0 auto; }
        .doc-title { font-size: 22px; font-weight: 700; margin: 0 0 4px; color: #0f172a; }
        .doc-id { font-size: 13px; color: #64748b; font-family: monospace; margin: 0 0 20px; }
        .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 20px; padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
        .header-grid .field { font-size: 12px; }
        .header-grid .field .label { color: #64748b; font-weight: 400; }
        .header-grid .field .val { color: #1e293b; font-weight: 600; }
        .section-title { font-size: 14px; font-weight: 700; color: #0f172a; margin: 24px 0 8px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; }
        table { width: 100%; border-collapse: collapse; margin-top: 4px; }
        th { background: #f1f5f9; text-align: left; padding: 8px 10px; font-size: 11px; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; }
        td { padding: 8px 10px; font-size: 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .mono { font-family: monospace; }
        .bold { font-weight: 700; }
        .notes-box { margin-top: 16px; padding: 12px 16px; background: #f8fafc; border-radius: 6px; font-size: 12px; border: 1px solid #e2e8f0; }
        .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
        .mismatch { color: #dc2626; font-weight: 600; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 600; }
        .badge-green { background: #dcfce7; color: #15803d; }
        .badge-amber { background: #fef3c7; color: #92400e; }
        .badge-red { background: #fee2e2; color: #991b1b; }
        @media print { body { padding: 16px; } }
      </style></head><body>
      ${content.innerHTML}
      <script>window.onload = function() { window.print(); }<\/script>
      </body></html>
    `);
    win.document.close();
  }

  const dateStr = receivedAt ? new Date(receivedAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  const invDateStr = invoiceDate ? new Date(invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

  return (
    <div className="flex gap-1.5 items-center">
      <Button onClick={handlePrint} variant="outline" size="sm" className="gap-1.5 h-9 text-xs">
        <Printer className="w-3.5 h-3.5" /> PDF
      </Button>
      <LotQRPrint lots={lotItems || items} />

      {/* Hidden print content */}
      <div ref={printRef} style={{ display: 'none' }}>
        <p className="doc-title">Goods Received Note</p>
        <p className="doc-id">{grnId}</p>

        <div className="header-grid">
          <div className="field"><span className="label">Supplier: </span><span className="val">{supplierName || '—'}</span></div>
          <div className="field"><span className="label">Gate Entry: </span><span className="val">{gateId || '—'}</span></div>
          <div className="field"><span className="label">Invoice Number: </span><span className="val">{invoiceNumber || '—'}</span></div>
          <div className="field"><span className="label">Invoice Date: </span><span className="val">{invDateStr || '—'}</span></div>
          {poId && <div className="field"><span className="label">Purchase Order: </span><span className="val">{poId}</span></div>}
          <div className="field"><span className="label">Received By: </span><span className="val">{receivedBy || '—'}</span></div>
          <div className="field"><span className="label">Received Date: </span><span className="val">{dateStr}</span></div>
          {status && <div className="field"><span className="label">Status: </span><span className="val">{status}</span></div>}
        </div>

        <p className="section-title">Items Received ({items.length})</p>
        <table>
          <thead>
            <tr>
              <th className="text-center">#</th>
              <th>Item Name</th>
              <th>Item Code</th>
              <th>Batch / Lot</th>
              <th>Manufacture Date</th>
              <th>Expiry Date</th>
              <th className="text-right">Original Quantity</th>
              <th className="text-right">Received Quantity</th>
              <th>Unit</th>
              <th>Mismatch</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td className="text-center">{i + 1}</td>
                <td className="bold">{it.item_name}</td>
                <td className="mono">{it.item_code || '—'}</td>
                <td className="mono">{it.batch_lot || it.batch_or_lot_text || it.batch_number || '—'}</td>
                <td>{it.mfg_date ? new Date(it.mfg_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</td>
                <td>{it.expiry_date ? new Date(it.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</td>
                <td className="text-right">{it.original_quantity || it.ordered_qty || '—'}</td>
                <td className="text-right bold">{it.quantity || it.received_qty || '—'}</td>
                <td>{it.uom || it.uom_code || 'Nos'}</td>
                <td>{it.mismatch_type && it.mismatch_type !== 'none'
                  ? <span className="mismatch">{it.mismatch_type}{it.mismatch_reason ? ` — ${it.mismatch_reason}` : ''}</span>
                  : '—'
                }</td>
              </tr>
            ))}
          </tbody>
        </table>
        {notes && <div className="notes-box"><strong>Notes:</strong> {notes}</div>}
        <div className="footer">
          <span>K95 ERP — Store Management</span>
          <span>Printed on {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
        </div>
      </div>
    </div>
  );
}