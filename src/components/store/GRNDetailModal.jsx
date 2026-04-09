import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Printer, QrCode, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateTime, formatDate } from '@/lib/dateFormatter';

export default function GRNDetailModal({ grn, gateEntry, onClose }) {
  const [items, setItems] = useState([]);
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!grn) return;
    async function load() {
      setLoading(true);
      const [grnItems, grnLots] = await Promise.all([
        base44.entities.GRNItem.filter({ grn_id: grn.grn_id }),
        base44.entities.StoreLot.filter({ grn_id: grn.grn_id }),
      ]);
      setItems(grnItems);
      setLots(grnLots);
      setLoading(false);
    }
    load();
  }, [grn]);

  if (!grn) return null;

  function handlePrintGRN() {
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
    const fmtDT = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

    const itemsHtml = items.map((it, i) => {
      const mismatch = it.mismatch_type && it.mismatch_type !== 'none'
        ? `<span style="color:#dc2626;font-weight:600">${it.mismatch_type}${it.mismatch_reason ? ' — ' + it.mismatch_reason : ''}</span>`
        : '—';
      return `<tr>
        <td style="text-align:center">${i + 1}</td>
        <td style="font-weight:600">${it.item_name || '—'}</td>
        <td style="font-family:monospace;font-size:11px">${it.item_code || '—'}</td>
        <td style="font-family:monospace">${it.batch_or_lot_text || '—'}</td>
        <td style="text-align:right">${it.ordered_qty ?? '—'}</td>
        <td style="text-align:right;font-weight:700">${it.received_qty ?? '—'}</td>
        <td>${it.uom_code || 'Nos'}</td>
        <td>${mismatch}</td>
        <td style="font-size:11px;color:#64748b">${it.line_notes || '—'}</td>
      </tr>`;
    }).join('');

    const lotsHtml = lots.length > 0 ? `
      <p style="font-size:14px;font-weight:700;margin:24px 0 8px;padding-bottom:6px;border-bottom:2px solid #e2e8f0">Lots Created (${lots.length})</p>
      <table><thead><tr>
        <th>Lot ID</th><th>Item</th><th>Batch Number</th><th>Manufacture Date</th><th>Expiry Date</th><th style="text-align:right">Quantity</th><th style="text-align:right">Remaining</th><th>Status</th>
      </tr></thead><tbody>
      ${lots.map(l => `<tr>
        <td style="font-family:monospace;font-weight:700;font-size:11px">${l.lot_id}</td>
        <td>${l.item_name || '—'}</td>
        <td style="font-family:monospace;color:#4f46e5">${l.batch_number || '—'}</td>
        <td>${fmtDate(l.mfg_date)}</td>
        <td>${fmtDate(l.expiry_date)}</td>
        <td style="text-align:right">${l.quantity} ${l.uom || ''}</td>
        <td style="text-align:right;font-weight:700">${l.remaining_quantity ?? l.quantity} ${l.uom || ''}</td>
        <td><span style="text-transform:capitalize">${l.status || '—'}</span></td>
      </tr>`).join('')}
      </tbody></table>` : '';

    const win = window.open('', '_blank', 'width=900,height=1000');
    win.document.write(`<html><head><title>GRN - ${grn.grn_id}</title>
      <style>
        body{font-family:'Inter',Arial,sans-serif;padding:32px;color:#1e293b;max-width:900px;margin:0 auto}
        h1{font-size:22px;font-weight:700;margin:0 0 4px;color:#0f172a}
        .doc-id{font-size:13px;color:#64748b;font-family:monospace;margin:0 0 20px}
        .header-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin-bottom:20px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0}
        .header-grid .field{font-size:12px}
        .header-grid .field .label{color:#64748b}
        .header-grid .field .val{color:#1e293b;font-weight:600}
        .section-title{font-size:14px;font-weight:700;color:#0f172a;margin:24px 0 8px;padding-bottom:6px;border-bottom:2px solid #e2e8f0}
        table{width:100%;border-collapse:collapse;margin-top:4px}
        th{background:#f1f5f9;text-align:left;padding:8px 10px;font-size:11px;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0}
        td{padding:8px 10px;font-size:12px;border-bottom:1px solid #f1f5f9;vertical-align:top}
        .notes-box{margin-top:16px;padding:12px 16px;background:#f8fafc;border-radius:6px;font-size:12px;border:1px solid #e2e8f0}
        .footer{margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between}
        @media print{body{padding:12px}}
      </style></head><body>
      <h1>Goods Received Note</h1>
      <p class="doc-id">${grn.grn_id}</p>
      <div class="header-grid">
        <div class="field"><span class="label">Supplier: </span><span class="val">${grn.supplier_name || '—'}</span></div>
        <div class="field"><span class="label">Gate Entry: </span><span class="val">${grn.gate_id || '—'}</span></div>
        <div class="field"><span class="label">Invoice Number: </span><span class="val">${grn.invoice_number || '—'}</span></div>
        <div class="field"><span class="label">Invoice Date: </span><span class="val">${fmtDate(grn.invoice_date)}</span></div>
        ${grn.po_id ? `<div class="field"><span class="label">Purchase Order: </span><span class="val">${grn.po_id}</span></div>` : ''}
        <div class="field"><span class="label">Received By: </span><span class="val">${grn.received_by || '—'}</span></div>
        <div class="field"><span class="label">Received At: </span><span class="val">${fmtDT(grn.received_at)}</span></div>
        <div class="field"><span class="label">Status: </span><span class="val">${grn.status || '—'}</span></div>
      </div>
      ${grn.notes ? `<div class="notes-box"><strong>Notes:</strong> ${grn.notes}</div>` : ''}
      <p class="section-title">Items Received (${items.length})</p>
      <table><thead><tr>
        <th style="text-align:center">#</th><th>Item</th><th>Code</th><th>Batch</th><th style="text-align:right">Ordered</th><th style="text-align:right">Received</th><th>Unit</th><th>Mismatch</th><th>Notes</th>
      </tr></thead><tbody>${itemsHtml}</tbody></table>
      ${lotsHtml}
      <div class="footer"><span>K95 ERP — Store Management</span><span>Printed on ${fmtDate(new Date())}</span></div>
      <script>window.onload=function(){window.print()}<\/script>
    </body></html>`);
    win.document.close();
  }

  function handlePrintQR() {
    const lotsData = lots.length > 0 ? lots : items.map(it => ({
      lot_id: it.batch_or_lot_text || grn.grn_id,
      item_name: it.item_name,
      quantity: it.received_qty,
      uom: it.uom_code,
    }));
    const lotsHtml = lotsData.map(l => {
      const qrVal = l.lot_id || l.qr_code || '';
      if (!qrVal) return '';
      return `<div style="page-break-inside:avoid;text-align:center;margin-bottom:20px;border:1px solid #e2e8f0;border-radius:8px;padding:16px;width:3in;box-sizing:border-box;">
        <p style="font-size:11px;font-weight:600;margin:0 0 2px">${l.item_name || ''}</p>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrVal)}" style="width:160px;height:160px;margin:8px auto;display:block" />
        <p style="font-family:monospace;font-size:12px;font-weight:bold;margin:6px 0 2px">${qrVal}</p>
        ${l.batch_number ? `<p style="font-size:10px;color:#6366f1">Batch: ${l.batch_number}</p>` : ''}
        ${l.mfg_date ? `<p style="font-size:9px;color:#64748b">Manufacture: ${l.mfg_date}</p>` : ''}
        ${l.expiry_date ? `<p style="font-size:9px;color:#64748b">Expiry: ${l.expiry_date}</p>` : ''}
        <p style="font-size:10px;color:#94a3b8">${l.quantity || ''} ${l.uom || 'Nos'}</p>
      </div>`;
    }).join('');
    const win = window.open('', '_blank', 'width=500,height=700');
    win.document.write(`<html><head><title>QR - ${grn.grn_id}</title>
      <style>@page{size:3in 4in;margin:4mm}body{font-family:sans-serif;padding:8px;display:flex;flex-direction:column;align-items:center}</style>
    </head><body>${lotsHtml}<script>window.onload=function(){window.print()}</script></body></html>`);
    win.document.close();
  }

  const statusCls = grn.status === 'RECEIVED' ? 'bg-green-100 text-green-700' :
    grn.status === 'DRAFT' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Goods Received Note Details</h2>
            <p className="text-sm font-mono text-slate-500">{grn.grn_id}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <DetailField label="Gate Entry" value={grn.gate_id} />
            <DetailField label="Supplier" value={grn.supplier_name} />
            <DetailField label="Invoice Number" value={grn.invoice_number} />
            <DetailField label="Invoice Date" value={formatDate(grn.invoice_date)} />
            <DetailField label="Status" badge badgeCls={statusCls} value={grn.status} />
            <DetailField label="Received By" value={grn.received_by} />
            <DetailField label="Received At" value={formatDateTime(grn.received_at)} />
            {grn.checklist_run_id && <DetailField label="Checklist Run" value={grn.checklist_run_id} />}
          </div>

          {grn.notes && (
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs font-medium text-slate-500 mb-1">Notes</p>
              <p className="text-sm text-slate-700">{grn.notes}</p>
            </div>
          )}

          {gateEntry && (
            <div className="bg-blue-50/60 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-600 mb-2">Gate Entry Information</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {gateEntry.vehicle_number && <span>Vehicle: <strong className="text-slate-800">{gateEntry.vehicle_number}</strong></span>}
                {gateEntry.driver_name && <span>Driver: <strong className="text-slate-800">{gateEntry.driver_name}</strong></span>}
                {gateEntry.driver_number && <span>Phone: <strong className="text-slate-800">{gateEntry.driver_number}</strong></span>}
                {gateEntry.transport_type && <span>Transport: <strong className="text-slate-800">{gateEntry.transport_type}</strong></span>}
                {gateEntry.arrived_at && <span>Arrived: <strong className="text-slate-800">{formatDateTime(gateEntry.arrived_at)}</strong></span>}
              </div>
            </div>
          )}

          {/* Items */}
          <div>
            <p className="text-sm font-semibold text-slate-900 mb-2">Items ({items.length})</p>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
            ) : items.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No items found</p>
            ) : (
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={it.id || i} className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{it.item_name}</p>
                        <p className="text-xs text-slate-500 font-mono">{it.item_code}</p>
                      </div>
                      {it.mismatch_type && it.mismatch_type !== 'none' && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{it.mismatch_type}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                      <span>Ordered: <strong className="text-slate-700">{it.ordered_qty}</strong></span>
                      <span>Received: <strong className="text-slate-700">{it.received_qty}</strong></span>
                      {it.damaged_qty > 0 && <span>Damaged: <strong className="text-red-600">{it.damaged_qty}</strong></span>}
                      <span>Unit: <strong className="text-slate-700">{it.uom_code || 'Nos'}</strong></span>
                      {it.batch_or_lot_text && <span>Batch: <strong className="text-indigo-600">{it.batch_or_lot_text}</strong></span>}
                      {it.mismatch_reason && <span>Reason: <strong className="text-slate-700">{it.mismatch_reason}</strong></span>}
                      {it.line_notes && <span>Notes: <strong className="text-slate-700">{it.line_notes}</strong></span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lots */}
          {lots.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-slate-900 mb-2">Lots Created ({lots.length})</p>
              <div className="space-y-2">
                {lots.map(l => (
                  <div key={l.id} className="bg-green-50/60 border border-green-100 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{l.item_name}</p>
                        <p className="text-xs text-slate-500 font-mono">{l.lot_id}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        l.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>{l.status}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                      <span>Quantity: <strong className="text-slate-700">{l.quantity} {l.uom}</strong></span>
                      <span>Remaining: <strong className="text-slate-700">{l.remaining_quantity} {l.uom}</strong></span>
                      {l.batch_number && <span>Batch: <strong className="text-indigo-600">{l.batch_number}</strong></span>}
                      {l.mfg_date && <span>Manufacture: <strong className="text-slate-700">{formatDate(l.mfg_date)}</strong></span>}
                      {l.expiry_date && <span>Expiry: <strong className="text-slate-700">{formatDate(l.expiry_date)}</strong></span>}
                      {l.mismatch_type !== 'none' && <span>Mismatch: <strong className="text-red-600">{l.mismatch_type}</strong></span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex gap-2 p-4 border-t border-slate-200">
          <Button variant="outline" onClick={handlePrintGRN} className="h-11 flex-1 gap-2 text-sm">
            <Printer className="w-4 h-4" /> Print Goods Received Note
          </Button>
          <Button variant="outline" onClick={handlePrintQR} className="h-11 flex-1 gap-2 text-sm">
            <QrCode className="w-4 h-4" /> Print QR Codes
          </Button>
          <Button onClick={onClose} className="h-11 px-6 text-sm">Close</Button>
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, value, badge, badgeCls }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      {badge ? (
        <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium ${badgeCls}`}>{value || '—'}</span>
      ) : (
        <p className="text-sm font-medium text-slate-900 mt-0.5">{value || '—'}</p>
      )}
    </div>
  );
}