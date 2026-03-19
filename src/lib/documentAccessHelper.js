/**
 * Document-level access control helpers
 * Check if a user can view, edit, create, approve a specific document type
 */

import { base44 } from '@/api/base44Client';

/**
 * Get access rules for a document type + role
 * @param {string} docType - Entity name (e.g. 'PurchaseOrder')
 * @param {string} userRole - User's role
 * @param {string} docStatus - Document status (e.g. 'DRAFT', 'APPROVED')
 * @returns {Promise<Object>} Rules object with can_view, can_edit, can_approve, etc.
 */
export async function getDocumentAccessRules(docType, userRole, docStatus) {
  try {
    const rules = await base44.entities.DocumentAccessRule.filter({
      doc_type: docType,
      workflow_stages: docStatus, // Will match if docStatus is in the array
      allowed_roles: userRole,
      is_active: true
    });

    if (rules.length > 0) {
      return rules[0]; // Return first matching rule
    }

    // Fallback: No rule found
    return {
      can_view: false,
      can_edit: false,
      can_create: false,
      can_approve: false,
      can_reject: false
    };
  } catch (error) {
    console.error('Error fetching document access rules:', error);
    return {
      can_view: false,
      can_edit: false,
      can_create: false,
      can_approve: false,
      can_reject: false
    };
  }
}

/**
 * Check if user can view a specific document
 * @param {string} docType - Entity name
 * @param {string} userRole - User's role
 * @param {string} docStatus - Document status
 * @returns {Promise<boolean>}
 */
export async function canViewDocument(docType, userRole, docStatus) {
  const rules = await getDocumentAccessRules(docType, userRole, docStatus);
  return rules.can_view || userRole === 'admin';
}

/**
 * Check if user can edit a specific document
 * @param {string} docType - Entity name
 * @param {string} userRole - User's role
 * @param {string} docStatus - Document status
 * @returns {Promise<boolean>}
 */
export async function canEditDocument(docType, userRole, docStatus) {
  const rules = await getDocumentAccessRules(docType, userRole, docStatus);
  return rules.can_edit || userRole === 'admin';
}

/**
 * Check if user can create this document type
 * @param {string} docType - Entity name
 * @param {string} userRole - User's role
 * @returns {Promise<boolean>}
 */
export async function canCreateDocument(docType, userRole) {
  try {
    const rules = await base44.entities.DocumentAccessRule.filter({
      doc_type: docType,
      allowed_roles: userRole,
      is_active: true
    });

    if (rules.length > 0) {
      return rules[0].can_create || userRole === 'admin';
    }
    return userRole === 'admin';
  } catch {
    return userRole === 'admin';
  }
}

/**
 * Check if user can approve/reject (see DocumentApprovalRule for specific actions)
 * @param {string} docType - Entity name
 * @param {string} userRole - User's role
 * @param {string} docStatus - Document status
 * @returns {Promise<boolean>}
 */
export async function canApproveDocument(docType, userRole, docStatus) {
  const rules = await getDocumentAccessRules(docType, userRole, docStatus);
  return rules.can_approve || userRole === 'admin';
}