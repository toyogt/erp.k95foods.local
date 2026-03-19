/**
 * Central Status Registry
 * Single source of truth for all document/record statuses
 */

export const STATUS_REGISTRY = {
  // Document statuses (PO, GRN, Invoice, etc.)
  DOCUMENT: {
    DRAFT: { key: 'DRAFT', label: 'Draft', color: 'slate', sequence: 1 },
    SUBMITTED: { key: 'SUBMITTED', label: 'Submitted', color: 'blue', sequence: 2 },
    APPROVED: { key: 'APPROVED', label: 'Approved', color: 'green', sequence: 3 },
    REJECTED: { key: 'REJECTED', label: 'Rejected', color: 'red', sequence: 4 },
    IN_PROGRESS: { key: 'IN_PROGRESS', label: 'In Progress', color: 'amber', sequence: 5 },
    COMPLETED: { key: 'COMPLETED', label: 'Completed', color: 'green', sequence: 6 },
    CANCELLED: { key: 'CANCELLED', label: 'Cancelled', color: 'slate', sequence: 7 },
    ON_HOLD: { key: 'ON_HOLD', label: 'On Hold', color: 'orange', sequence: 8 },
  },

  // Stock/Inventory statuses
  STOCK: {
    AVAILABLE: { key: 'AVAILABLE', label: 'Available', color: 'green' },
    RESERVED: { key: 'RESERVED', label: 'Reserved', color: 'blue' },
    IN_TRANSIT: { key: 'IN_TRANSIT', label: 'In Transit', color: 'amber' },
    QUARANTINE: { key: 'QUARANTINE', label: 'Quarantine', color: 'orange' },
    REJECTED: { key: 'REJECTED', label: 'Rejected', color: 'red' },
    CONSUMED: { key: 'CONSUMED', label: 'Consumed', color: 'slate' },
    RETURNED: { key: 'RETURNED', label: 'Returned', color: 'indigo' },
    ADJUSTMENT: { key: 'ADJUSTMENT', label: 'Adjustment', color: 'purple' },
  },

  // Batch statuses
  BATCH: {
    PLANNED: { key: 'PLANNED', label: 'Planned', color: 'slate' },
    IN_PROGRESS: { key: 'IN_PROGRESS', label: 'In Progress', color: 'blue' },
    FILLING_COMPLETE: { key: 'FILLING_COMPLETE', label: 'Filling Complete', color: 'amber' },
    QC_PENDING: { key: 'QC_PENDING', label: 'QC Pending', color: 'orange' },
    QC_HOLD: { key: 'QC_HOLD', label: 'QC Hold', color: 'orange' },
    APPROVED: { key: 'APPROVED', label: 'Approved', color: 'green' },
    REJECTED: { key: 'REJECTED', label: 'Rejected', color: 'red' },
    COMPLETED: { key: 'COMPLETED', label: 'Completed', color: 'green' },
    ON_HOLD: { key: 'ON_HOLD', label: 'On Hold', color: 'orange' },
  },

  // Pallet statuses
  PALLET: {
    OPEN: { key: 'OPEN', label: 'Open', color: 'slate' },
    IN_CHAMBER: { key: 'IN_CHAMBER', label: 'In Chamber', color: 'blue' },
    POST_CHAMBER: { key: 'POST_CHAMBER', label: 'Post-Chamber', color: 'amber' },
    IN_TRANSIT: { key: 'IN_TRANSIT', label: 'In Transit', color: 'blue' },
    RECEIVED: { key: 'RECEIVED', label: 'Received', color: 'green' },
    AT_ZONE: { key: 'AT_ZONE', label: 'At Zone', color: 'green' },
    EMPTY: { key: 'EMPTY', label: 'Empty', color: 'slate' },
    CLOSED: { key: 'CLOSED', label: 'Closed', color: 'slate' },
  },

  // Transfer statuses
  TRANSFER: {
    DRAFT: { key: 'DRAFT', label: 'Draft', color: 'slate' },
    INITIATED: { key: 'INITIATED', label: 'Initiated', color: 'blue' },
    IN_TRANSIT: { key: 'IN_TRANSIT', label: 'In Transit', color: 'blue' },
    RECEIVED: { key: 'RECEIVED', label: 'Received', color: 'green' },
    DISCREPANCY: { key: 'DISCREPANCY', label: 'Discrepancy', color: 'orange' },
    COMPLETED: { key: 'COMPLETED', label: 'Completed', color: 'green' },
    CANCELLED: { key: 'CANCELLED', label: 'Cancelled', color: 'red' },
  },

  // QC statuses
  QC: {
    PENDING: { key: 'PENDING', label: 'Pending', color: 'slate' },
    IN_PROGRESS: { key: 'IN_PROGRESS', label: 'In Progress', color: 'blue' },
    PASSED: { key: 'PASSED', label: 'Passed', color: 'green' },
    FAILED: { key: 'FAILED', label: 'Failed', color: 'red' },
    ON_HOLD: { key: 'ON_HOLD', label: 'On Hold', color: 'orange' },
    PARTIAL_PASS: { key: 'PARTIAL_PASS', label: 'Partial Pass', color: 'amber' },
  },

  // Approval statuses
  APPROVAL: {
    PENDING: { key: 'PENDING', label: 'Pending Approval', color: 'slate' },
    APPROVED: { key: 'APPROVED', label: 'Approved', color: 'green' },
    REJECTED: { key: 'REJECTED', label: 'Rejected', color: 'red' },
    ESCALATED: { key: 'ESCALATED', label: 'Escalated', color: 'orange' },
  },

  // Crate statuses
  CRATE: {
    FILLED: { key: 'FILLED', label: 'Filled', color: 'blue' },
    IN_CHAMBER: { key: 'IN_CHAMBER', label: 'In Chamber', color: 'blue' },
    POST_CHAMBER: { key: 'POST_CHAMBER', label: 'Post-Chamber', color: 'amber' },
    IN_TRANSIT: { key: 'IN_TRANSIT', label: 'In Transit', color: 'blue' },
    RECEIVED_UNASSIGNED: { key: 'RECEIVED_UNASSIGNED', label: 'Received (Unassigned)', color: 'orange' },
    RECEIVED: { key: 'RECEIVED', label: 'Received', color: 'green' },
    STORED: { key: 'STORED', label: 'Stored', color: 'green' },
    CONSUMED: { key: 'CONSUMED', label: 'Consumed', color: 'slate' },
    EMPTY_RETURNED: { key: 'EMPTY_RETURNED', label: 'Empty Returned', color: 'slate' },
  },
};

/**
 * Get status by category and key
 */
export function getStatus(category, key) {
  return STATUS_REGISTRY[category]?.[key] || { key, label: key, color: 'slate' };
}

/**
 * Get all statuses for a category
 */
export function getStatusesByCategory(category) {
  return Object.values(STATUS_REGISTRY[category] || {});
}

/**
 * Get status label
 */
export function getStatusLabel(category, key) {
  return getStatus(category, key).label;
}

/**
 * Get status color class for Tailwind
 */
export function getStatusColor(category, key) {
  const color = getStatus(category, key).color;
  const colorMap = {
    slate: 'bg-slate-100 text-slate-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
    orange: 'bg-orange-100 text-orange-700',
    purple: 'bg-purple-100 text-purple-700',
    indigo: 'bg-indigo-100 text-indigo-700',
  };
  return colorMap[color] || colorMap.slate;
}

/**
 * Check if status transition is valid
 */
export function isValidStatusTransition(category, fromStatus, toStatus) {
  const statuses = getStatusesByCategory(category);
  const fromSeq = statuses.find(s => s.key === fromStatus)?.sequence ?? 0;
  const toSeq = statuses.find(s => s.key === toStatus)?.sequence ?? 0;
  
  // Allow transitions forward, to same, or backward to certain states
  return toSeq >= fromSeq || ['DRAFT', 'ON_HOLD', 'CANCELLED'].includes(toStatus);
}