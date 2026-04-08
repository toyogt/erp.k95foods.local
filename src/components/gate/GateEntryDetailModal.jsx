import { X, Printer, Truck, Camera, FileText, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/dateFormatter';

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900 text-right">{value}</span>
    </div>
  );
}

function PhotoBlock({ url, label }) {
  if (!url) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <img src={url} alt={label} className="w-full h-40 object-cover rounded-xl border border-slate-200" />
    </div>
  );
}

export default function GateEntryDetailModal({ entry, onClose }) {
  if (!entry) return null;

  function handlePrint() {
    const printWindow = window.open('', '_blank');
    const html = `
      <!DOCTYPE html>
      <html><head><title>Gate Entry ${entry.gate_id}</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; padding: 24px; max-width: 700px; margin: auto; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .subtitle { font-size: 12px; color: #666; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        td { padding: 8px 0; border-bottom: 1px solid #eee; font-size: 13px; }
        td:first-child { color: #666; width: 40%; }
        td:last-child { font-weight: 600; text-align: right; }
        .photos { display: flex; gap: 12px; margin-top: 12px; }
        .photos img { width: 200px; height: 130px; object-fit: cover; border-radius: 8px; border: 1px solid #ddd; }
        .photo-label { font-size: 11px; color: #888; margin-bottom: 4px; }
        .status { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
        .status-OPEN { background: #fef3c7; color: #92400e; }
        .status-PROCESSED { background: #d1fae5; color: #065f46; }
        @media print { body { padding: 12px; } }
      </style></head><body>
      <h1>Gate Entry — ${entry.gate_id}</h1>
      <p class="subtitle">Printed on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-IN')}</p>
      <table>
        <tr><td>Status</td><td><span class="status status-${entry.status}">${entry.status}</span></td></tr>
        ${entry.vehicle_number ? `<tr><td>Vehicle Number</td><td>${entry.vehicle_number}</td></tr>` : ''}
        ${entry.driver_name ? `<tr><td>Driver Name</td><td>${entry.driver_name}</td></tr>` : ''}
        ${entry.driver_number ? `<tr><td>Driver Mobile</td><td>${entry.driver_number}</td></tr>` : ''}
        ${entry.arrived_at ? `<tr><td>Arrival Date & Time</td><td>${new Date(entry.arrived_at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${new Date(entry.arrived_at).toLocaleTimeString('en-IN')}</td></tr>` : ''}
        ${entry.notes ? `<tr><td>Notes</td><td>${entry.notes}</td></tr>` : ''}
        ${entry.created_by ? `<tr><td>Created By</td><td>${entry.created_by}</td></tr>` : ''}
      </table>
      <div class="photos">
        ${entry.vehicle_photo ? `<div><p class="photo-label">Vehicle Photo</p><img src="${entry.vehicle_photo}" /></div>` : ''}
        ${entry.invoice_photo ? `<div><p class="photo-label">Invoice / Document</p><img src="${entry.invoice_photo}" /></div>` : ''}
        ${entry.material_photo ? `<div><p class="photo-label">Goods / Material</p><img src="${entry.material_photo}" /></div>` : ''}
      </div>
      <script>setTimeout(() => window.print(), 500);</script>
      </body></html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3 md:p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 md:p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">Gate Entry — {entry.gate_id}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {entry.arrived_at ? formatDateTime(entry.arrived_at) : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrint} className="h-9 w-9" title="Print">
              <Printer className="w-4 h-4" />
            </Button>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 md:p-5 space-y-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              entry.status === 'PROCESSED' ? 'bg-green-100 text-green-700' :
              entry.status === 'OPEN' ? 'bg-amber-100 text-amber-700' :
              'bg-slate-100 text-slate-600'
            }`}>{entry.status}</span>
          </div>

          {/* Details */}
          <div className="bg-slate-50 rounded-xl p-3">
            <DetailRow label="Vehicle Number" value={entry.vehicle_number} />
            <DetailRow label="Driver Name" value={entry.driver_name} />
            <DetailRow label="Driver Mobile" value={entry.driver_number} />
            <DetailRow label="Arrival Date & Time" value={entry.arrived_at ? formatDateTime(entry.arrived_at) : null} />
            <DetailRow label="Notes" value={entry.notes} />
            <DetailRow label="Created By" value={entry.created_by} />
          </div>

          {/* Photos */}
          {(entry.vehicle_photo || entry.invoice_photo || entry.material_photo) && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Attached Photos</p>
              <div className="grid grid-cols-1 gap-3">
                <PhotoBlock url={entry.vehicle_photo} label="Vehicle Photo" />
                <PhotoBlock url={entry.invoice_photo} label="Invoice / Document" />
                <PhotoBlock url={entry.material_photo} label="Goods / Material" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}