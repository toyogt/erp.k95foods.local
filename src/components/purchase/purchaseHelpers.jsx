import { base44 } from '@/api/base44Client';

export async function logPurchaseAudit({ action, entity_type, entity_id, user, extra = '' }) {
  try {
    await base44.entities.AuditLog.create({
      action,
      entity_type,
      entity_id: String(entity_id),
      performed_by: user?.email || '',
      performed_at: new Date().toISOString(),
      notes: extra,
      station: 'PURCHASE',
    });
  } catch { /* non-blocking */ }
}

export function genId(prefix) {
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${rand}`;
}

export function genPRNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  return `PR-${ts}`;
}

export function genPONumber() {
  const ts = Date.now().toString(36).toUpperCase();
  return `PO-${ts}`;
}

export function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch { return dateStr; }
}

export function formatDateTimeDDMMYYYY(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  } catch { return dateStr; }
}

export function formatINR(amount) {
  if (amount == null || isNaN(amount)) return '₹0';
  return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const DEPARTMENTS = [
  'Production', 'Quality Control', 'Warehouse', 'Accounts',
  'Admin', 'Maintenance', 'Packaging', 'Logistics', 'Other',
];

export const STATUS_COLOR = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  ORDERED: 'bg-purple-100 text-purple-700',
  CLOSED: 'bg-slate-200 text-slate-500',
  SENT: 'bg-cyan-100 text-cyan-700',
  PART_RECEIVED: 'bg-amber-100 text-amber-700',
  CANCELLED: 'bg-red-100 text-red-500',
  HOLD: 'bg-amber-100 text-amber-700',
  BLOCKED: 'bg-red-100 text-red-700',
};

export const PR_STATUS_COLOR = {
  'Pending Approval': 'bg-amber-100 text-amber-700',
  'Approved': 'bg-green-100 text-green-700',
  'Partially Approved': 'bg-blue-100 text-blue-700',
  'Rejected': 'bg-red-100 text-red-700',
  'DRAFT': 'bg-slate-100 text-slate-600',
  'SUBMITTED': 'bg-blue-100 text-blue-700',
  'APPROVED': 'bg-green-100 text-green-700',
  'REJECTED': 'bg-red-100 text-red-700',
  'ORDERED': 'bg-purple-100 text-purple-700',
  'CLOSED': 'bg-slate-200 text-slate-500',
};

export const PO_STATUS_COLOR = {
  ...STATUS_COLOR,
};

export const PRIORITY_COLOR = {
  'Low': 'bg-slate-100 text-slate-600',
  'Medium': 'bg-blue-100 text-blue-700',
  'High': 'bg-orange-100 text-orange-700',
  'Urgent': 'bg-red-100 text-red-700',
};