/**
 * Labelling Job Queue Dashboard — Role-based capability matrix.
 *
 * Each capability is a simple boolean check against the user's role.
 * Components read these caps to decide what to render / enable.
 */

// Roles with FULL control over the dashboard
const FULL_ACCESS_ROLES = ['admin', 'labelling_manager'];

// Roles allowed to VIEW the dashboard (filters may still be restricted)
const VIEW_ACCESS_ROLES = [
  'admin',
  'labelling_manager',
  'labelling_supervisor',
  'lbl_supervisor',
  'production_manager',
  'labelling_operator',
];

// Roles allowed to USE filters (search, sort, dates, product, lines, stat cards)
const FILTER_ACCESS_ROLES = [
  'admin',
  'labelling_manager',
  'labelling_supervisor',
  'lbl_supervisor',
  'production_manager',
];

// Roles allowed to EDIT / REORDER / DELETE jobs in the queue
const MANAGE_JOBS_ROLES = ['admin', 'labelling_manager'];

const hasRole = (role, list) => !!role && list.includes(role);

export function getLblDashboardCapabilities(role) {
  const fullAccess = hasRole(role, FULL_ACCESS_ROLES);
  const canView = hasRole(role, VIEW_ACCESS_ROLES);
  const canUseFilters = hasRole(role, FILTER_ACCESS_ROLES);
  const canManageJobs = hasRole(role, MANAGE_JOBS_ROLES);

  return {
    canViewDashboard: canView,
    canViewStats: canView,
    canUseFilters,        // show the toolbar as a whole
    canSearch: canUseFilters,
    canSort: canUseFilters,
    canFilterByDate: canUseFilters,
    canFilterByProduct: canUseFilters,
    canFilterByLine: canUseFilters,
    canFilterByStatus: canUseFilters,
    canClearFilters: canUseFilters,
    canCreateJob: canManageJobs,
    canEditJob: canManageJobs,
    canDeleteJob: canManageJobs,
    canReorderJob: canManageJobs,
    isFullAccess: fullAccess,
  };
}