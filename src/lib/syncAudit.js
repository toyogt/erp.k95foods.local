/**
 * Sync Audit Trail
 * Log all sync operations for compliance and debugging
 */

import { base44 } from '@/api/base44Client';

export async function logSyncEvent({
  transactionId,
  status,
  entityType,
  entityId,
  action,
  user,
  device,
  details,
  error = null,
}) {
  try {
    // Create audit record
    await base44.entities.AuditLog.create({
      action: `SYNC_${action}`,
      entity_type: entityType,
      entity_id: entityId,
      user_email: user,
      user_name: user?.split('@')[0],
      station: device,
      details: {
        transaction_id: transactionId,
        status,
        ...details,
        error: error?.message,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error('Failed to log sync event:', e);
  }
}

/**
 * Log sync success
 */
export async function logSyncSuccess(transaction, result) {
  await logSyncEvent({
    transactionId: transaction.transaction_id,
    status: 'confirmed',
    entityType: transaction.entity_type,
    entityId: transaction.entity_id || result?.created_id,
    action: transaction.action_type,
    user: transaction.user_id,
    device: transaction.device_id,
    details: {
      retry_count: transaction.retry_count,
      sync_result: result,
    },
  });
}

/**
 * Log sync failure
 */
export async function logSyncFailure(transaction, error) {
  await logSyncEvent({
    transactionId: transaction.transaction_id,
    status: transaction.status,
    entityType: transaction.entity_type,
    entityId: transaction.entity_id,
    action: transaction.action_type,
    user: transaction.user_id,
    device: transaction.device_id,
    details: {
      retry_count: transaction.retry_count,
      error_code: transaction.error_code,
    },
    error,
  });
}

/**
 * Log conflict resolution
 */
export async function logConflictResolution(transaction, resolution) {
  await logSyncEvent({
    transactionId: transaction.transaction_id,
    status: 'conflict_resolved',
    entityType: transaction.entity_type,
    entityId: transaction.entity_id,
    action: `${transaction.action_type}_conflict_resolved`,
    user: resolution.supervisor_action_by,
    device: transaction.device_id,
    details: {
      original_conflict: transaction.conflict_details,
      resolution_notes: resolution.notes,
      resolution_type: resolution.resolution_type,
    },
  });
}