// Registry of pages that support field-level permission overrides.
// Each page defines groups of capabilities that admins can toggle per role.
// Defaults come from the page's own permission helper (e.g. lblDashboardPermissions.js).

export const PAGE_PERMISSION_REGISTRY = {
  LblPlanningDashboard: {
    label: 'Labelling Planning Dashboard',
    description: 'Control which stats, filters, and job management actions each role can access on the Labelling Planning Dashboard.',
    groups: [
      {
        label: 'View Access',
        caps: [
          { key: 'canViewDashboard', label: 'View Dashboard', hint: 'Access the Labelling Planning Dashboard page.' },
          { key: 'canViewStats', label: 'View Statistics Cards', hint: 'See the total / pending / active / completed counters.' },
        ],
      },
      {
        label: 'Filters & Search',
        caps: [
          { key: 'canUseFilters', label: 'Use Filter Toolbar', hint: 'Show the filter toolbar at all.' },
          { key: 'canSearch', label: 'Search Jobs', hint: 'Use the search box to find lines or products.' },
          { key: 'canSort', label: 'Sort Queue', hint: 'Change the sort order of the job queue.' },
          { key: 'canFilterByStatus', label: 'Filter by Status', hint: 'Click stat cards to filter jobs by status.' },
          { key: 'canFilterByDate', label: 'Filter by Date', hint: 'Filter by entry or manufacturing date ranges.' },
          { key: 'canFilterByProduct', label: 'Filter by Product', hint: 'Filter jobs by product code.' },
          { key: 'canFilterByLine', label: 'Filter by Line', hint: 'Toggle which labelling lines are visible.' },
          { key: 'canClearFilters', label: 'Clear All Filters', hint: 'Reset all active filters at once.' },
        ],
      },
      {
        label: 'Job Management',
        caps: [
          { key: 'canManageJobs', label: 'Manage Jobs', hint: 'Create, reorder, and delete jobs in line queues.' },
          { key: 'canEditJob', label: 'Edit Job Details', hint: 'Edit quantities, priority, and product details on a job.' },
        ],
      },
    ],
  },
};

export function getPageRegistryEntry(pageKey) {
  return PAGE_PERMISSION_REGISTRY[pageKey] || null;
}

export function getAllCapsForPage(pageKey) {
  const entry = getPageRegistryEntry(pageKey);
  if (!entry) return [];
  return entry.groups.flatMap(g => g.caps);
}