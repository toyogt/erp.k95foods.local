/**
 * Audit Integration Helper
 * Drop-in audit logging for existing action hooks
 */

import { logAudit, logStateChange, logApproval } from './auditLogEngine';

/**
 * Wrap an async action with audit logging
 */
export async function withAudit(
  action,
  {
    entityType,
    entityId,
    entityCode,
    module,
    actionType,
    user,
    beforeState,
    afterState,
    reasonCode,
    reasonText,
    criticality = 'info',
  }
) {
  try {
    // Execute action
    const result = await action();

    // Log after success
    if (afterState) {
      await logStateChange({
        entityType,
        entityId,
        entityCode,
        module,
        user,
        before: beforeState,
        after: afterState,
        reasonCode,
        reasonText,
        criticality,
      });
    } else {
      await logAudit({
        actionType,
        module,
        entityType,
        entityId,
        entityCode,
        reasonCode,
        reasonText,
        user,
        criticality,
      });
    }

    return result;
  } catch (error) {
    // Log failure
    await logAudit({
      actionType: `${actionType}_failed`,
      module,
      entityType,
      entityId,
      entityCode,
      reasonCode,
      reasonText: `Failed: ${error.message}`,
      user,
      criticality: 'warning',
      tags: ['error', 'failed'],
    });

    throw error;
  }
}

/**
 * Create audit logging middleware for React hooks
 */
export function createAuditLogger(module, entityType) {
  return {
    logCreate: async (newRecord, user, reasonCode, reasonText) => {
      await logAudit({
        actionType: 'create',
        module,
        entityType,
        entityId: newRecord.id,
        entityCode: newRecord.code || newRecord.id,
        afterState: newRecord,
        reasonCode,
        reasonText,
        user,
      });
    },

    logUpdate: async (beforeRecord, afterRecord, user, reasonCode, reasonText) => {
      await logStateChange({
        entityType,
        entityId: afterRecord.id,
        entityCode: afterRecord.code || afterRecord.id,
        module,
        user,
        before: beforeRecord,
        after: afterRecord,
        reasonCode,
        reasonText,
      });
    },

    logDelete: async (record, user, reasonCode, reasonText) => {
      await logAudit({
        actionType: 'delete',
        module,
        entityType,
        entityId: record.id,
        entityCode: record.code || record.id,
        beforeState: record,
        reasonCode,
        reasonText,
        user,
        criticality: record.status === 'DRAFT' ? 'info' : 'warning',
      });
    },

    logApproval: async (record, approved, user, reasonCode, reasonText) => {
      await logApproval({
        documentType: entityType,
        documentId: record.id,
        documentCode: record.code || record.id,
        approved,
        user,
        reasonCode,
        reasonText,
      });
    },

    logStatusChange: async (
      record,
      oldStatus,
      newStatus,
      user,
      reasonCode,
      reasonText
    ) => {
      await logStateChange({
        entityType,
        entityId: record.id,
        entityCode: record.code || record.id,
        module,
        user,
        before: { status: oldStatus },
        after: { status: newStatus },
        reasonCode,
        reasonText,
      });
    },
  };
}

/**
 * Usage in action hooks:
 *
 * const auditLogger = createAuditLogger('WAREHOUSE', 'Dispatch');
 *
 * const dispatchTransfer = async (transferId, user, reasonCode, reasonText) => {
 *   const dispatch = await base44.entities.Dispatch.create({...});
 *   await auditLogger.logCreate(dispatch, user, reasonCode, reasonText);
 *   return dispatch;
 * };
 *
 * OR with withAudit wrapper:
 *
 * const dispatch = await withAudit(
 *   () => base44.entities.Dispatch.create({...}),
 *   {
 *     entityType: 'Dispatch',
 *     module: 'WAREHOUSE',
 *     actionType: 'create',
 *     user,
 *     reasonCode,
 *     reasonText,
 *   }
 * );
 */