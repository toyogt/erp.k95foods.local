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