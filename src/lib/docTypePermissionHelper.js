/**
 * Document Type Permission Helper
 * Runtime permission checking for document-level actions
 */

// All supported actions
export const DOC_ACTIONS = [
  { key: 'create', label: 'Create', icon: 'Plus' },
  { key: 'read', label: 'Read', icon: 'Eye' },
  { key: 'edit', label: 'Edit', icon: 'Pencil' },
  { key: 'delete', label: 'Delete', icon: 'Trash2' },
  { key: 'print', label: 'Print', icon: 'Printer' },
  { key: 'export', label: 'Export', icon: 'Download' },
  { key: 'import', label: 'Import', icon: 'Upload' },
  { key: 'share', label: 'Share', icon: 'Share2' },
  { key: 'email', label: 'Email', icon: 'Mail' },
  { key: 'submit', label: 'Submit', icon: 'Send' },
  { key: 'approve', label: 'Approve', icon: 'CheckCircle' },
];

// Document types currently supported
export const DOC_TYPES = [
  { key: 'LabellingShiftPlan', label: 'Labelling Shift Plan', module: 'LBL_DEPT' },
  { key: 'LabellingJob', label: 'Labelling Job', module: 'LBL_DEPT' },
];

/**
 * Check if a user role has permission for a specific action on a document type
 * Admin always has all permissions
 */
export function hasDocPermission(permissions, role, docType, action) {
  if (role === 'admin') return true;
  
  const rule = permissions.find(
    p => p.doc_type === docType && p.role_key === role && p.is_active !== false
  );
  if (!rule) return false;
  return rule.allowed_actions?.includes(action) || false;
}

/**
 * Get all allowed actions for a role on a document type
 */
export function getAllowedActions(permissions, role, docType) {
  if (role === 'admin') return DOC_ACTIONS.map(a => a.key);
  
  const rule = permissions.find(
    p => p.doc_type === docType && p.role_key === role && p.is_active !== false
  );
  return rule?.allowed_actions || [];
}