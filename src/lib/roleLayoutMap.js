/**
 * Maps user roles to layout categories.
 * This determines whether user sees Sidebar (manager) or App Layout (operator).
 */

const ROLE_LAYOUT_MAP = {
  // OPERATORS — App-like layout (bottom nav, full-screen tiles)
  'filling_operator': 'OPERATOR',
  'chamber_operator': 'OPERATOR',
  'labelling_supervisor': 'OPERATOR',
  'warehouse_ops': 'OPERATOR',
  'line_operator': 'OPERATOR',
  'dispatch_officer': 'OPERATOR',
  'labelling_receiver': 'OPERATOR',
  'store_receiver': 'OPERATOR',
  'security_guard': 'OPERATOR',
  'pallet_builder': 'OPERATOR',
  'recipe_operator': 'OPERATOR',
  'qc_inspector': 'OPERATOR',
  'label_operator': 'OPERATOR',

  // MANAGERS — Sidebar layout (multi-page, approval workflows)
  'admin': 'MANAGER',
  'purchase_manager': 'MANAGER',
  'production_manager': 'MANAGER',
  'accounts_manager': 'MANAGER',
  'process_controller': 'MANAGER',
  'process_designer': 'MANAGER',
  'label_supervisor': 'MANAGER',
  'store_manager': 'MANAGER',
  'sales_manager': 'MANAGER',

  // VIEWERS — Use assigned role's layout
  'user': 'VIEWER',
};

/**
 * Get layout category for a role
 * @param {string} role - User role
 * @returns {'OPERATOR' | 'MANAGER' | 'VIEWER' | null}
 */
export function getRoleLayoutCategory(role) {
  return ROLE_LAYOUT_MAP[role] || null;
}

/**
 * Check if role should see operator (app-like) layout
 * @param {string} role - User role
 * @returns {boolean}
 */
export function isOperatorLayout(role) {
  return getRoleLayoutCategory(role) === 'OPERATOR';
}

/**
 * Check if role should see manager (sidebar) layout
 * @param {string} role - User role
 * @returns {boolean}
 */
export function isManagerLayout(role) {
  return getRoleLayoutCategory(role) === 'MANAGER';
}

/**
 * List of all operator roles (for queries, filtering)
 */
export const OPERATOR_ROLES = Object.entries(ROLE_LAYOUT_MAP)
  .filter(([_, category]) => category === 'OPERATOR')
  .map(([role, _]) => role);

/**
 * List of all manager roles
 */
export const MANAGER_ROLES = Object.entries(ROLE_LAYOUT_MAP)
  .filter(([_, category]) => category === 'MANAGER')
  .map(([role, _]) => role);