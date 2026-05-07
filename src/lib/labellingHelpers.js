/**
 * Labelling Department Module — Helpers & Constants
 */

export const SHIFT_TYPES = [
  { value: 'day', label: 'Day Shift' },
  { value: 'night', label: 'Night Shift' },
];

export const PLAN_STATUSES = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700' },
  locked: { label: 'Locked', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
};

export const JOB_STATUSES = {
  pending: { label: 'Pending', color: 'bg-slate-100 text-slate-700', step: 0 },
  active: { label: 'Active', color: 'bg-blue-100 text-blue-700', step: 1 },
  stock_transferred: { label: 'Stock Transferred', color: 'bg-cyan-100 text-cyan-700', step: 2 },
  demo_print_sent: { label: 'Demo Print Sent', color: 'bg-purple-100 text-purple-700', step: 3 },
  demo_print_verified: { label: 'Demo Verified', color: 'bg-teal-100 text-teal-700', step: 4 },
  checklist_submitted: { label: 'Checklist Submitted', color: 'bg-violet-100 text-violet-700', step: 5 },
  demo_pending_approval: { label: 'Pending Approval', color: 'bg-amber-100 text-amber-700', step: 6 },
  demo_approved: { label: 'Demo Approved', color: 'bg-green-100 text-green-700', step: 7 },
  demo_rejected: { label: 'Demo Rejected', color: 'bg-red-100 text-red-700', step: -1 },
  bulk_printing: { label: 'Bulk Printing', color: 'bg-indigo-100 text-indigo-700', step: 8 },
  bulk_printing_awaiting_printer_reset: { label: 'Awaiting Printer Reset', color: 'bg-indigo-100 text-indigo-700', step: 8 },
  paused: { label: 'Paused', color: 'bg-orange-100 text-orange-700', step: 8 },
  on_hold: { label: 'On Hold', color: 'bg-amber-100 text-amber-700', step: -1 },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700', step: 9 },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700', step: -2 },
};

export function getNextOperatorAction(status) {
  const map = {
    pending: { action: 'Start Job', nextStatus: 'active', buttonColor: 'bg-blue-600 hover:bg-blue-700' },
    active: { action: 'Record Stock Transfer', nextStatus: 'stock_transferred', buttonColor: 'bg-cyan-600 hover:bg-cyan-700' },
    stock_transferred: { action: 'Send Demo Print', nextStatus: 'demo_print_sent', buttonColor: 'bg-purple-600 hover:bg-purple-700' },
    demo_print_sent: { action: 'Verify Demo Print', nextStatus: 'demo_print_verified', buttonColor: 'bg-teal-600 hover:bg-teal-700' },
    demo_print_verified: { action: 'Fill Checklist', nextStatus: 'checklist_submitted', buttonColor: 'bg-violet-600 hover:bg-violet-700' },
    demo_rejected: { action: 'Retry Demo Print', nextStatus: 'active', buttonColor: 'bg-orange-600 hover:bg-orange-700' },
    demo_approved: { action: 'Start Bulk Print', nextStatus: 'bulk_printing', buttonColor: 'bg-indigo-600 hover:bg-indigo-700' },
    bulk_printing: { action: 'Complete Job', nextStatus: 'completed', buttonColor: 'bg-green-600 hover:bg-green-700' },
    paused: { action: 'Resume Printing', nextStatus: 'bulk_printing', buttonColor: 'bg-indigo-600 hover:bg-indigo-700' },
  };
  return map[status] || null;
}

export function generatePlanId() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  const r = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `LP-${d}${m}${y}-${r}`;
}

export function generateJobId() {
  return `LJ-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

export function generateEventId() {
  return `LE-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

export function canManagePlans(role) {
  return ['admin', 'lbl_supervisor', 'labelling_supervisor', 'production_manager'].includes(role);
}

export function canApproveDemoPrint(role) {
  return ['admin', 'lbl_supervisor', 'labelling_supervisor', 'production_manager'].includes(role);
}