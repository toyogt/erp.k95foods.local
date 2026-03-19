/**
 * Audit Log Engine
 * Standardized audit logging for all actions
 */

import { base44 } from '@/api/base44Client';
import { isReasonCodeMandatory } from './reasonCodeRegistry';

/**
 * Create structured audit log entry
 */
export async function logAudit({
  actionType,
  module,
  entityType,
  entityId,
  entityCode,
  beforeState,
  afterState,
  reasonCode,
  reasonText,
  user,
  device = 'app',
  isOffline = false,
  affectedRecords = [],
  criticality = 'info',
  tags = [],
}) {
  try {
    // Validate mandatory reason code for critical actions
    if (isReasonCodeMandatory(actionType, entityType)) {
      if (!reasonCode && !reasonText) {
        throw new Error(`Reason code or note required for ${actionType} on ${entityType}`);
      }
    }

    // Generate audit ID
    const auditId = `AUD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create audit entry
    const auditEntry = await base44.entities.AuditLog.create({
      audit_id: auditId,
      action: `${actionType} ${entityType}`,
      action_type: actionType,
      module,
      entity_type: entityType,
      entity_id: entityId,
      entity_code: entityCode,
      before_state: beforeState,
      after_state: afterState,
      reason_code: reasonCode,
      reason_text: reasonText,
      actor_email: user?.email,
      actor_name: user?.full_name,
      actor_role: user?.role,
      device_id: device,
      session_id: sessionStorage.getItem('session_id'),
      transaction_id: generateTransactionId(),
      is_offline: isOffline,
      affected_records: affectedRecords,
      criticality,
      tags,
      user_agent: navigator.userAgent,
      ip_address: await getClientIP(),
    });

    return { success: true, auditId: auditEntry.id };
  } catch (error) {
    console.error('Audit log failed:', error);
    // Don't throw - audit failures shouldn't block operations
    return { success: false, error: error.message };
  }
}

/**
 * Log with state comparison (auto extracts before/after)
 */
export async function logStateChange({
  entityType,
  entityId,
  entityCode,
  before,
  after,
  module,
  user,
  reasonCode,
  reasonText,
  device,
  criticality = 'info',
}) {
  const changes = extractStateChanges(before, after);
  
  return logAudit({
    actionType: 'update',
    module,
    entityType,
    entityId,
    entityCode,
    beforeState: changes.before,
    afterState: changes.after,
    reasonCode,
    reasonText,
    user,
    device,
    criticality,
    tags: Object.keys(changes.before),
  });
}

/**
 * Extract only changed fields
 */
function extractStateChanges(before, after) {
  const changed = {};
  const before_state = {};
  const after_state = {};

  if (!before) {
    return { before: {}, after };
  }

  for (const key in before) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after?.[key])) {
      before_state[key] = before[key];
      after_state[key] = after?.[key];
      changed[key] = true;
    }
  }

  return { before: before_state, after: after_state };
}

/**
 * Generate idempotency key
 */
function generateTransactionId() {
  return `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
}

/**
 * Get client IP (stub - requires backend)
 */
async function getClientIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    return 'unknown';
  }
}

/**
 * Log critical exception
 */
export async function logCriticalException({
  module,
  entityType,
  entityId,
  error,
  reasonCode,
  user,
  context,
}) {
  return logAudit({
    actionType: 'exception',
    module,
    entityType,
    entityId,
    reasonCode,
    reasonText: error.message,
    user,
    criticality: 'critical',
    afterState: { error: error.message, ...context },
    tags: ['critical', 'exception'],
  });
}

/**
 * Log approval action
 */
export async function logApproval({
  documentType,
  documentId,
  documentCode,
  approved,
  user,
  reasonCode,
  reasonText,
}) {
  return logAudit({
    actionType: approved ? 'approve' : 'reject',
    module: 'APPROVAL',
    entityType: documentType,
    entityId: documentId,
    entityCode: documentCode,
    reasonCode,
    reasonText,
    user,
    criticality: 'info',
    tags: [approved ? 'approved' : 'rejected'],
  });
}

/**
 * Search audit logs (admin only)
 */
export async function searchAuditLogs({
  entityType,
  entityId,
  actionType,
  module,
  actor,
  fromDate,
  toDate,
  criticality,
  tags,
  limit = 100,
}) {
  const query = {};

  if (entityType) query.entity_type = entityType;
  if (entityId) query.entity_id = entityId;
  if (actionType) query.action_type = actionType;
  if (module) query.module = module;
  if (actor) query.actor_email = actor;
  if (criticality) query.criticality = criticality;
  if (tags?.length > 0) query.tags = { $in: tags };

  if (fromDate || toDate) {
    query.created_date = {};
    if (fromDate) query.created_date.$gte = fromDate;
    if (toDate) query.created_date.$lte = toDate;
  }

  const logs = await base44.entities.AuditLog.filter(query, '-created_date', limit);
  return logs || [];
}

/**
 * Get audit trail for entity
 */
export async function getEntityAuditTrail(entityType, entityId) {
  const logs = await base44.entities.AuditLog.filter(
    { entity_type: entityType, entity_id: entityId },
    '-created_date',
    500
  );
  return logs || [];
}