/**
 * Permission Audit Logging
 * Automatically logs all permission changes
 */

import { base44 } from '@/api/base44Client';

/**
 * Log a permission change
 */
export async function logPermissionChange(user, action, details) {
  try {
    await base44.entities.AuditLog.create({
      action: 'permission_change',
      entity_type: 'PermissionPolicy',
      user_email: user?.email,
      user_name: user?.full_name,
      details: {
        action,
        ...details,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.warn('Failed to log permission change:', e);
  }
}

/**
 * Log policy created
 */
export async function auditPolicyCreated(user, policyRoleKey, moduleAccess) {
  await logPermissionChange(user, 'policy_created', {
    role_key: policyRoleKey,
    modules_assigned: moduleAccess,
  });
}

/**
 * Log policy updated
 */
export async function auditPolicyUpdated(user, policyRoleKey, changes) {
  await logPermissionChange(user, 'policy_updated', {
    role_key: policyRoleKey,
    changes,
  });
}

/**
 * Log policy deleted
 */
export async function auditPolicyDeleted(user, policyRoleKey) {
  await logPermissionChange(user, 'policy_deleted', {
    role_key: policyRoleKey,
  });
}

/**
 * Log module assignment
 */
export async function auditModuleAssigned(user, roleKey, moduleKey) {
  await logPermissionChange(user, 'module_assigned', {
    role_key: roleKey,
    module_key: moduleKey,
  });
}

/**
 * Log action permission granted
 */
export async function auditActionPermissionGranted(user, roleKey, actionKey, entityType) {
  await logPermissionChange(user, 'action_permission_granted', {
    role_key: roleKey,
    action_key: actionKey,
    entity_type: entityType,
  });
}

/**
 * Log field restriction added
 */
export async function auditFieldRestrictionAdded(user, roleKey, entityType, fieldName, canView, canEdit) {
  await logPermissionChange(user, 'field_restriction_added', {
    role_key: roleKey,
    entity_type: entityType,
    field_name: fieldName,
    can_view: canView,
    can_edit: canEdit,
  });
}