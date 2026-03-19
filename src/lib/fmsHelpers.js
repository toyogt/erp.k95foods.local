// FMS shared helpers

export const FMS_ROLES = ['admin', 'process_designer', 'process_controller', 'user'];

export function getTATStatus(deadline) {
  if (!deadline) return 'unknown';
  const now = new Date();
  const dl = new Date(deadline);
  const diffMs = dl - now;
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffMs < 0) return 'overdue';
  if (diffHours <= 4) return 'at_risk';
  return 'on_time';
}

export function getTATColor(deadline) {
  const s = getTATStatus(deadline);
  if (s === 'overdue') return 'red';
  if (s === 'at_risk') return 'yellow';
  return 'green';
}

export function getTATBadgeClass(deadline) {
  const s = getTATStatus(deadline);
  if (s === 'overdue') return 'bg-red-100 text-red-700 border border-red-200';
  if (s === 'at_risk') return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
  return 'bg-green-100 text-green-700 border border-green-200';
}

export function formatDeadline(deadline) {
  if (!deadline) return '—';
  const dl = new Date(deadline);
  return dl.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function getTimeAgo(dt) {
  if (!dt) return '';
  const diff = Date.now() - new Date(dt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function getTimeRemaining(deadline) {
  if (!deadline) return '';
  const diff = new Date(deadline) - Date.now();
  if (diff < 0) {
    const abs = Math.abs(diff);
    const mins = Math.floor(abs / 60000);
    if (mins < 60) return `${mins}m overdue`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h overdue`;
    return `${Math.floor(hrs / 24)}d overdue`;
  }
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m left`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h left`;
  return `${Math.floor(hrs / 24)}d left`;
}

export function canAccessFMS(user) {
  if (!user) return false;
  return ['admin', 'process_designer', 'process_controller', 'user'].includes(user.role);
}

export function isProcessDesigner(user) {
  return user?.role === 'admin' || user?.role === 'process_designer';
}

export function isPC(user) {
  return user?.role === 'admin' || user?.role === 'process_controller';
}

export function isAdmin(user) {
  return user?.role === 'admin';
}

export const TAT_TYPE_LABELS = {
  calendar_days: 'Calendar Days',
  working_days: 'Working Days',
  hours: 'Hours',
};

export const TAT_UNIT_LABELS = {
  hours: 'Hours',
  day: 'Days',
  week: 'Weeks',
  month: 'Months',
};

export const TAT_ANCHOR_LABELS = {
  run_start: 'Run Start',
  step_start: 'Step Start',
  predecessor_completion: 'Previous Step Completion',
};

export function formatTATSummary(step) {
  if (!step?.tat_value) return '—';
  const type = TAT_TYPE_LABELS[step.tat_type] || step.tat_type || '';
  const unit = TAT_UNIT_LABELS[step.tat_unit] || step.tat_unit || '';
  const anchor = TAT_ANCHOR_LABELS[step.tat_anchor_type] || step.tat_anchor_type || '';
  const due = step.fixed_due_time ? ` at ${step.fixed_due_time}` : '';
  return `${step.tat_value} ${unit} (${type}) after ${anchor}${due}`;
}