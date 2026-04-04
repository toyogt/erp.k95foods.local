import { base44 } from '@/api/base44Client';

export function genId(prefix) {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase().slice(-5)}${rand}`;
}

export async function logGrnAudit({ action, entity_type, entity_id, details, user }) {
  try {
    await base44.entities.AuditLog.create({
      action,
      entity_type: entity_type || '',
      entity_id: entity_id || '',
      user_email: user?.email || '',
      user_name: user?.full_name || '',
      details: details || {},
      station: 'RECEIVING',
      synced: true,
    });
  } catch (_) {}
}

export const GRN_STATUS_COLOR = {
  DRAFT:     'bg-slate-100 text-slate-600',
  RECEIVED:  'bg-green-100 text-green-700',
  CANCELLED: 'bg-slate-200 text-slate-500',
};

export const GATE_STATUS_COLOR = {
  OPEN:         'bg-green-100 text-green-700',
  IN_REVIEW:    'bg-blue-100 text-blue-700',
  LINKED_TO_PO: 'bg-purple-100 text-purple-700',
  CLOSED:       'bg-slate-200 text-slate-500',
};

/** Lookup the checklist template configured for a doc_type + step */
export async function getChecklistTemplate(docType, step) {
  try {
    const configs = await base44.entities.WorkflowChecklistConfig.filter({ doc_type: docType, step, is_active: true });
    if (!configs.length) return null;
    const config = configs[0];
    const templates = await base44.entities.ChecklistTemplate.filter({ template_id: config.checklist_template_id, is_active: true });
    return templates[0] || null;
  } catch (_) {
    return null;
  }
}