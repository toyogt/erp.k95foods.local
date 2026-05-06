import { base44 } from '@/api/base44Client';

export async function logPurchaseAudit({ action, action_type, entity_type, entity_id, user, extra = '' }) {
  try {
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    await base44.entities.AuditLog.create({
      audit_id: `PUR-${Date.now()}-${rand}`,
      action,
      action_type: action_type || 'status_change',
      module: 'PURCHASE',
      entity_type,
      entity_id: String(entity_id),
      actor_email: user?.email || '',
      actor_name: user?.full_name || '',
      actor_role: user?.role || '',
      notes: extra,
    });
  } catch { /* non-blocking */ }
}

export function genId(prefix) {
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${rand}`;
}

export function genPRNumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PR-${yy}${mm}-${rand}`;
}

export function genPONumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PO-${yy}${mm}-${rand}`;
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

export const UNITS = ['kg', 'litre', 'piece', 'box', 'carton', 'other'];

export const STATUS_COLOR = {
  Draft: 'bg-slate-100 text-slate-600',
  'Pending Approval': 'bg-amber-100 text-amber-700',
  Approved: 'bg-green-100 text-green-700',
  'Partially Approved': 'bg-blue-100 text-blue-700',
  Rejected: 'bg-red-100 text-red-700',
  'Quotation Stage': 'bg-purple-100 text-purple-700',
  'PO Created': 'bg-indigo-100 text-indigo-700',
  Closed: 'bg-slate-200 text-slate-500',
  // Legacy uppercase keys for backward compat
  DRAFT: 'bg-slate-100 text-slate-600',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  ORDERED: 'bg-purple-100 text-purple-700',
  CLOSED: 'bg-slate-200 text-slate-500',
};

export const PR_STATUS_COLOR = {
  'Pending Approval': 'bg-amber-100 text-amber-700',
  Approved: 'bg-green-100 text-green-700',
  'Partially Approved': 'bg-blue-100 text-blue-700',
  Rejected: 'bg-red-100 text-red-700',
  Draft: 'bg-slate-100 text-slate-600',
  'Quotation Stage': 'bg-purple-100 text-purple-700',
  'PO Created': 'bg-indigo-100 text-indigo-700',
  Closed: 'bg-slate-200 text-slate-500',
  // Legacy
  DRAFT: 'bg-slate-100 text-slate-600',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  ORDERED: 'bg-purple-100 text-purple-700',
  CLOSED: 'bg-slate-200 text-slate-500',
};

export const PO_STATUS_COLOR = {
  Draft: 'bg-slate-100 text-slate-600',
  'Sent to Supplier': 'bg-cyan-100 text-cyan-700',
  Acknowledged: 'bg-blue-100 text-blue-700',
  'In Transit': 'bg-amber-100 text-amber-700',
  'Partially Received': 'bg-orange-100 text-orange-700',
  Delivered: 'bg-green-100 text-green-700',
  Cancelled: 'bg-red-100 text-red-500',
  // Legacy
  DRAFT: 'bg-slate-100 text-slate-600',
  SENT: 'bg-cyan-100 text-cyan-700',
  PART_RECEIVED: 'bg-amber-100 text-amber-700',
  CLOSED: 'bg-slate-200 text-slate-500',
  CANCELLED: 'bg-red-100 text-red-500',
};

export const PRIORITY_COLOR = {
  Low: 'bg-slate-100 text-slate-600',
  Medium: 'bg-blue-100 text-blue-700',
  High: 'bg-orange-100 text-orange-700',
  Urgent: 'bg-red-100 text-red-700',
};

export const PO_STATUS_FLOW = [
  'Draft',
  'Sent to Supplier',
  'Acknowledged',
  'In Transit',
  'Partially Received',
  'Delivered',
];

export function getNextPOStatus(current) {
  const idx = PO_STATUS_FLOW.indexOf(current);
  if (idx === -1 || idx >= PO_STATUS_FLOW.length - 1) return null;
  return PO_STATUS_FLOW[idx + 1];
}