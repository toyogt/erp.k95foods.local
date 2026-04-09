/**
 * Status badges for E-Invoice and E-Way Bill compliance
 */
import { CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';

const EINVOICE_CONFIG = {
  not_generated: { label: 'E-Invoice Pending', color: 'bg-slate-100 text-slate-600', icon: Clock },
  generated: { label: 'E-Invoice Generated', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  cancelled: { label: 'E-Invoice Cancelled', color: 'bg-red-100 text-red-700', icon: XCircle },
};

const EWB_CONFIG = {
  not_generated: { label: 'E-Way Bill Pending', color: 'bg-slate-100 text-slate-600', icon: Clock },
  generated: { label: 'E-Way Bill Active', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  cancelled: { label: 'E-Way Bill Cancelled', color: 'bg-red-100 text-red-700', icon: XCircle },
  expired: { label: 'E-Way Bill Expired', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
};

export function EInvoiceStatusBadge({ status }) {
  const cfg = EINVOICE_CONFIG[status || 'not_generated'] || EINVOICE_CONFIG.not_generated;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

export function EWayBillStatusBadge({ status }) {
  const cfg = EWB_CONFIG[status || 'not_generated'] || EWB_CONFIG.not_generated;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}