/**
 * Tabs: E-Invoice Log, E-Way Bill Log, Vehicle Update History
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText, Truck, RotateCcw, CheckCircle2, XCircle } from 'lucide-react';

function formatDateTime(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  if (isNaN(d.getTime())) return dt;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const TABS = [
  { key: 'einvoice', label: 'E-Invoice Log', icon: FileText },
  { key: 'ewb', label: 'E-Way Bill Log', icon: Truck },
  { key: 'vehicle', label: 'Vehicle Updates', icon: RotateCcw },
];

export default function ComplianceLogTabs({ invoiceId }) {
  const [tab, setTab] = useState('einvoice');

  const { data: einvoiceLogs = [] } = useQuery({
    queryKey: ['einvoice_logs', invoiceId],
    queryFn: () => base44.entities.EInvoiceLog.filter({ invoice_id: invoiceId }, '-created_date'),
    enabled: tab === 'einvoice' && !!invoiceId,
  });

  const { data: ewbLogs = [] } = useQuery({
    queryKey: ['ewb_logs', invoiceId],
    queryFn: () => base44.entities.EWayBillLog.filter({ invoice_id: invoiceId }, '-created_date'),
    enabled: tab === 'ewb' && !!invoiceId,
  });

  const { data: vehicleUpdates = [] } = useQuery({
    queryKey: ['vehicle_updates', invoiceId],
    queryFn: () => base44.entities.EWayVehicleUpdate.filter({ invoice_id: invoiceId }, '-created_date'),
    enabled: tab === 'vehicle' && !!invoiceId,
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Tab Bar */}
      <div className="flex gap-1 p-2 border-b border-slate-100 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}>
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="p-3">
        {tab === 'einvoice' && <EInvoiceLogTable logs={einvoiceLogs} />}
        {tab === 'ewb' && <EWBLogTable logs={ewbLogs} />}
        {tab === 'vehicle' && <VehicleUpdateTable updates={vehicleUpdates} />}
      </div>
    </div>
  );
}

function StatusIcon({ status }) {
  if (status === 'success') return <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />;
  return <XCircle className="w-3.5 h-3.5 text-red-600" />;
}

function EInvoiceLogTable({ logs }) {
  if (logs.length === 0) return <EmptyState text="No E-Invoice log entries yet" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="bg-slate-100 text-slate-700 text-xs font-medium">
          <th className="px-3 py-2 text-left">Date / Time</th>
          <th className="px-3 py-2 text-left">Action</th>
          <th className="px-3 py-2 text-left">Status</th>
          <th className="px-3 py-2 text-left">IRN</th>
          <th className="px-3 py-2 text-left">Performed By</th>
          <th className="px-3 py-2 text-left">Error</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-100">
          {logs.map(log => (
            <tr key={log.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatDateTime(log.performed_at)}</td>
              <td className="px-3 py-2 font-medium">{log.action === 'generate_irn' ? 'Generate IRN' : 'Cancel IRN'}</td>
              <td className="px-3 py-2"><span className="inline-flex items-center gap-1"><StatusIcon status={log.status} /> {log.status}</span></td>
              <td className="px-3 py-2 font-mono text-xs max-w-[200px] truncate">{log.irn || '—'}</td>
              <td className="px-3 py-2 text-slate-600">{log.performed_by || '—'}</td>
              <td className="px-3 py-2 text-red-600 text-xs max-w-[200px] truncate">{log.error_message || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EWBLogTable({ logs }) {
  if (logs.length === 0) return <EmptyState text="No E-Way Bill log entries yet" />;

  const ACTION_LABELS = {
    generate_ewb: 'Generate',
    cancel_ewb: 'Cancel',
    update_vehicle: 'Vehicle Update',
    update_transporter: 'Transporter Update',
    extend_validity: 'Extend Validity',
    fetch_status: 'Fetch Status',
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="bg-slate-100 text-slate-700 text-xs font-medium">
          <th className="px-3 py-2 text-left">Date / Time</th>
          <th className="px-3 py-2 text-left">Action</th>
          <th className="px-3 py-2 text-left">Status</th>
          <th className="px-3 py-2 text-left">E-Way Bill Number</th>
          <th className="px-3 py-2 text-left">Valid Until</th>
          <th className="px-3 py-2 text-left">Vehicle</th>
          <th className="px-3 py-2 text-left">Performed By</th>
          <th className="px-3 py-2 text-left">Error</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-100">
          {logs.map(log => (
            <tr key={log.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatDateTime(log.performed_at)}</td>
              <td className="px-3 py-2 font-medium">{ACTION_LABELS[log.action] || log.action}</td>
              <td className="px-3 py-2"><span className="inline-flex items-center gap-1"><StatusIcon status={log.status} /> {log.status}</span></td>
              <td className="px-3 py-2 font-mono text-xs">{log.eway_bill_no || '—'}</td>
              <td className="px-3 py-2 text-slate-600">{log.valid_upto || '—'}</td>
              <td className="px-3 py-2">{log.vehicle_no || '—'}</td>
              <td className="px-3 py-2 text-slate-600">{log.performed_by || '—'}</td>
              <td className="px-3 py-2 text-red-600 text-xs max-w-[200px] truncate">{log.error_message || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VehicleUpdateTable({ updates }) {
  if (updates.length === 0) return <EmptyState text="No vehicle update history yet" />;
  const MODE_LABELS = { '1': 'Road', '2': 'Rail', '3': 'Air', '4': 'Ship' };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="bg-slate-100 text-slate-700 text-xs font-medium">
          <th className="px-3 py-2 text-left">Date / Time</th>
          <th className="px-3 py-2 text-left">Vehicle Number</th>
          <th className="px-3 py-2 text-left">From Place</th>
          <th className="px-3 py-2 text-left">State</th>
          <th className="px-3 py-2 text-left">Mode</th>
          <th className="px-3 py-2 text-left">API Status</th>
          <th className="px-3 py-2 text-left">Reason</th>
          <th className="px-3 py-2 text-left">Performed By</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-100">
          {updates.map(u => (
            <tr key={u.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatDateTime(u.performed_at)}</td>
              <td className="px-3 py-2 font-mono font-medium">{u.vehicle_no}</td>
              <td className="px-3 py-2">{u.from_place || '—'}</td>
              <td className="px-3 py-2">{u.from_state || '—'}</td>
              <td className="px-3 py-2">{MODE_LABELS[u.transport_mode] || u.transport_mode || '—'}</td>
              <td className="px-3 py-2"><span className="inline-flex items-center gap-1"><StatusIcon status={u.api_status} /> {u.api_status}</span></td>
              <td className="px-3 py-2 text-xs">{u.reason_remark || '—'}</td>
              <td className="px-3 py-2 text-slate-600">{u.performed_by || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="py-8 text-center">
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}