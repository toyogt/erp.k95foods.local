/**
 * Admin Action Audit Logging
 * Centralized audit trail for all administrative actions
 */

import { base44 } from '@/api/base44Client';

/**
 * Generic audit log entry creator
 */
async function createAuditLog(user, actionType, module, entityType, action, details = {}) {
  try {
    await base44.entities.AuditLog.create({
      audit_id: `${actionType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      action_type: actionType,
      module: module,
      entity_type: entityType,
      action: action,
      actor_email: user?.email,
      actor_name: user?.full_name,
      actor_role: user?.role,
      reason_text: JSON.stringify(details),
      criticality: 'security', // All admin actions are security-sensitive
      tags: ['admin_action', actionType],
      synced: true,
    });
  } catch (e) {
    console.warn('Failed to log admin action:', e);
    // Don't throw - audit logging should not block operations
  }
}

/**
 * Log user invitation
 */
export async function auditUserInvited(user, invitedEmail, invitedRole) {
  await createAuditLog(
    user,
    'create',
    'USER_MANAGEMENT',
    'User',
    'invited user',
    {
      invited_email: invitedEmail,
      invited_role: invitedRole,
    }
  );
}

/**
 * Log user role change
 */
export async function auditUserRoleChanged(user, targetEmail, fromRole, toRole) {
  await createAuditLog(
    user,
    'update',
    'USER_MANAGEMENT',
    'User',
    'changed user role',
    {
      target_email: targetEmail,
      from_role: fromRole,
      to_role: toRole,
    }
  );
}

/**
 * Log role created
 */
export async function auditRoleCreated(user, roleKey, roleLabel, moduleAccess) {
  await createAuditLog(
    user,
    'create',
    'USER_MANAGEMENT',
    'AppRole',
    'created role',
    {
      role_key: roleKey,
      role_label: roleLabel,
      module_access: moduleAccess,
    }
  );
}

/**
 * Log role updated
 */
export async function auditRoleUpdated(user, roleKey, roleLabel, moduleAccess) {
  await createAuditLog(
    user,
    'update',
    'USER_MANAGEMENT',
    'AppRole',
    'updated role',
    {
      role_key: roleKey,
      role_label: roleLabel,
      module_access: moduleAccess,
    }
  );
}

/**
 * Log role deactivated (soft delete)
 */
export async function auditRoleDeactivated(user, roleKey, roleLabel) {
  await createAuditLog(
    user,
    'update',
    'USER_MANAGEMENT',
    'AppRole',
    'deactivated role',
    {
      role_key: roleKey,
      role_label: roleLabel,
      reason: 'soft delete - role marked inactive',
    }
  );
}

/**
 * Log approval rule created
 */
export async function auditApprovalRuleCreated(user, docType, fromState, toState, actionLabel) {
  await createAuditLog(
    user,
    'create',
    'ADMIN',
    'DocumentApprovalRule',
    'created approval rule',
    {
      doc_type: docType,
      from_state: fromState,
      to_state: toState,
      action_label: actionLabel,
    }
  );
}

/**
 * Log approval rule updated
 */
export async function auditApprovalRuleUpdated(user, docType, fromState, toState) {
  await createAuditLog(
    user,
    'update',
    'ADMIN',
    'DocumentApprovalRule',
    'updated approval rule',
    {
      doc_type: docType,
      from_state: fromState,
      to_state: toState,
    }
  );
}

/**
 * Log approval rule deleted
 */
export async function auditApprovalRuleDeleted(user, docType, actionLabel) {
  await createAuditLog(
    user,
    'delete',
    'ADMIN',
    'DocumentApprovalRule',
    'deleted approval rule',
    {
      doc_type: docType,
      action_label: actionLabel,
    }
  );
}

/**
 * Log permission policy created
 */
export async function auditPermissionPolicyCreated(user, roleKey, moduleAccess) {
  await createAuditLog(
    user,
    'create',
    'USER_MANAGEMENT',
    'PermissionPolicy',
    'created permission policy',
    {
      role_key: roleKey,
      module_access: moduleAccess,
    }
  );
}

/**
 * Log permission policy updated
 */
export async function auditPermissionPolicyUpdated(user, roleKey, changes) {
  await createAuditLog(
    user,
    'update',
    'USER_MANAGEMENT',
    'PermissionPolicy',
    'updated permission policy',
    {
      role_key: roleKey,
      changes,
    }
  );
}

/**
 * Log permission policy deleted
 */
export async function auditPermissionPolicyDeleted(user, roleKey) {
  await createAuditLog(
    user,
    'delete',
    'USER_MANAGEMENT',
    'PermissionPolicy',
    'deleted permission policy',
    {
      role_key: roleKey,
    }
  );
}

/**
 * Log document access rule created/updated
 */
export async function auditDocumentAccessRuleChanged(user, docType, roleKey, action) {
  await createAuditLog(
    user,
    'update',
    'USER_MANAGEMENT',
    'DocumentAccessRule',
    `${action} document access rule`,
    {
      doc_type: docType,
      role_key: roleKey,
    }
  );
}