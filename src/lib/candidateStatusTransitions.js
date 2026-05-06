/**
 * Candidate lead status transition rules.
 * Defines which statuses a candidate can move to from their current status.
 * Keeps the workflow guided and prevents illogical jumps.
 */

export const ALL_STATUSES = [
  'New',
  'Contacted',
  'Shortlisted',
  'Interviewed',
  'Hired',
  'Rejected',
  'On Hold',
  'Terminated',
];

export const STATUS_META = {
  New: {
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    dotColor: 'bg-slate-400',
    description: 'Lead just captured, not yet contacted',
  },
  Contacted: {
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    dotColor: 'bg-blue-500',
    description: 'Initial contact made with candidate',
  },
  Shortlisted: {
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    dotColor: 'bg-amber-500',
    description: 'Candidate matches role requirements',
  },
  Interviewed: {
    color: 'bg-violet-100 text-violet-700 border-violet-200',
    dotColor: 'bg-violet-500',
    description: 'Interview completed, awaiting decision',
  },
  Hired: {
    color: 'bg-green-100 text-green-700 border-green-200',
    dotColor: 'bg-green-500',
    description: 'Offered and joined as employee',
  },
  Rejected: {
    color: 'bg-red-100 text-red-700 border-red-200',
    dotColor: 'bg-red-500',
    description: 'Candidate not suitable for role',
  },
  'On Hold': {
    color: 'bg-slate-100 text-slate-600 border-slate-200',
    dotColor: 'bg-slate-400',
    description: 'Paused — revisit later',
  },
  Terminated: {
    color: 'bg-red-100 text-red-700 border-red-200',
    dotColor: 'bg-red-600',
    description: 'Employee exited the company',
  },
};

/**
 * Allowed transitions from each current status.
 * "Terminated" is intentionally only reachable from "Hired" (must be an employee first).
 */
const TRANSITIONS = {
  New: ['Contacted', 'Shortlisted', 'Rejected', 'On Hold'],
  Contacted: ['Shortlisted', 'Interviewed', 'Rejected', 'On Hold'],
  Shortlisted: ['Interviewed', 'Hired', 'Rejected', 'On Hold'],
  Interviewed: ['Hired', 'Shortlisted', 'Rejected', 'On Hold'],
  Hired: ['Terminated'],
  Rejected: ['New', 'Shortlisted'],
  'On Hold': ['Contacted', 'Shortlisted', 'Interviewed', 'Rejected'],
  Terminated: [],
};

export function getAllowedNextStatuses(currentStatus) {
  const key = currentStatus || 'New';
  return TRANSITIONS[key] || [];
}

export function getStatusMeta(status) {
  return STATUS_META[status] || STATUS_META.New;
}