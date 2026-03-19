/**
 * Unified Permission Resolver
 * Single source of truth for all access control checks
 * Replaces scattered permission checks throughout the app
 */

import { base44 } from '@/api/base44Client';

let permissionCache = {};
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get full permission policy for a role
 */
export async function getPermissionPolicy(roleKey) {
  const now = Date.now();
  
  // Return cached if still valid
  if (permissionCache[roleKey] && (now - cacheTimestamp) < CACHE_TTL) {
    return permissionCache[roleKey];
  }

  try {
    // Try to load from PermissionPolicy entity
    const policies = await base44.entities.PermissionPolicy.filter({ 
      role_key: roleKey, 
      is_active: true 
    });
    
    if (policies?.length > 0) {
      permissionCache[roleKey] = policies[0];
      cacheTimestamp = now;
      return policies[0];
    }

    // Fallback: construct from AppRole (legacy migration)
    const roles = await base44.entities.AppRole.filter({ 
      role_key: roleKey, 
      is_active: true 
    });
    
    if (roles?.length > 0) {
      const policy = {
        role_key: roleKey,
        module_access: roles[0].module_access || [],
        page_overrides: [],
        action_permissions: [],
        field_restrictions: [],
        is_active: true,
      };
      permissionCache[roleKey] = policy;
      cacheTimestamp = now;
      return policy;
    }

    return null;
  } catch (e) {
    console.error('Error loading permission policy:', e);
    return null;
  }
}

/**
 * Check if user can access a module
 */
export async function canAccessModule(user, moduleKey) {
  if (!user) return false;
  if (user.role === 'admin') return true;

  const policy = await getPermissionPolicy(user.role);
  return policy?.module_access?.includes(moduleKey) || false;
}

/**
 * Check if user can access a page
 */
export async function canAccessPage(user, pageKey) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (pageKey === 'Dashboard') return true; // Everyone can see dashboard

  const policy = await getPermissionPolicy(user.role);
  if (!policy) return false;

  // Check explicit page override
  const override = policy.page_overrides?.find(o => o.page_key === pageKey);
  if (override) return override.allow;

  // Default: check via moduleConfig (derived from module access)
  // This is set in moduleConfig.js
  return true; // Defer to moduleConfig logic for now
}

/**
 * Check if user can perform an action
 */
export async function canPerformAction(user, actionKey, entityType, documentStatus) {
  if (!user) return false;
  if (user.role === 'admin') return true;

  const policy = await getPermissionPolicy(user.role);
  if (!policy) return false;

  const actionPerm = policy.action_permissions?.find(a => 
    a.action_key === actionKey && 
    (!a.entity_type || a.entity_type === entityType) &&
    (!a.workflow_stages || a.workflow_stages.includes(documentStatus))
  );

  return actionPerm ? actionPerm.allow : false;
}

/**
 * Check if user can view a field
 */
export async function canViewField(user, entityType, fieldName) {
  if (!user) return false;
  if (user.role === 'admin') return true;

  const policy = await getPermissionPolicy(user.role);
  if (!policy) return true; // Default: allow if no restriction

  const fieldRestr = policy.field_restrictions?.find(f => 
    f.entity_type === entityType && f.field_name === fieldName
  );

  return fieldRestr ? fieldRestr.can_view : true;
}

/**
 * Check if user can edit a field
 */
export async function canEditField(user, entityType, fieldName) {
  if (!user) return false;
  if (user.role === 'admin') return true;

  const policy = await getPermissionPolicy(user.role);
  if (!policy) return false; // Default: deny edit if no policy

  const fieldRestr = policy.field_restrictions?.find(f => 
    f.entity_type === entityType && f.field_name === fieldName
  );

  return fieldRestr ? fieldRestr.can_edit : false;
}

/**
 * Get list of accessible modules for a user
 */
export async function getAccessibleModules(user) {
  if (!user) return [];
  if (user.role === 'admin') return ['*']; // Admin has all modules

  const policy = await getPermissionPolicy(user.role);
  return policy?.module_access || [];
}

/**
 * Clear permission cache (call after permission changes)
 */
export function clearPermissionCache(roleKey = null) {
  if (roleKey) {
    delete permissionCache[roleKey];
  } else {
    permissionCache = {};
  }
  cacheTimestamp = 0;
}

/**
 * Get debug info for super admin
 */
export async function getPermissionDebugInfo(user) {
  if (user?.role !== 'admin') return null;

  const policy = await getPermissionPolicy(user.role);
  
  return {
    user: {
      email: user.email,
      role: user.role,
      name: user.full_name,
    },
    policy,
    timestamp: new Date().toISOString(),
  };
}