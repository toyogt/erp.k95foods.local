import { base44 } from '@/api/base44Client';
import moment from 'moment';

/**
 * Generate next task number DT-XXXX
 */
export async function generateTaskNumber() {
  const existing = await base44.entities.DirectorTask.list('-created_date', 1);
  if (existing.length === 0) return 'DT-0001';
  const last = existing[0].task_number || 'DT-0000';
  const num = parseInt(last.replace('DT-', ''), 10) || 0;
  return `DT-${String(num + 1).padStart(4, '0')}`;
}

/**
 * Log a task action
 */
export async function logTaskAction(task, action, user, details, oldValue, newValue) {
  await base44.entities.DirectorTaskLog.create({
    task_id: task.id,
    task_number: task.task_number,
    action,
    performed_by_email: user?.email || 'system',
    performed_by_name: user?.full_name || 'System',
    details: details || '',
    old_value: oldValue || '',
    new_value: newValue || '',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Parse DD/MM/YYYY to moment
 */
export function parseDDMMYYYY(dateStr) {
  if (!dateStr) return null;
  return moment(dateStr, 'DD/MM/YYYY', true);
}

/**
 * Format date for display
 */
export function formatTaskDate(dateStr, timeStr) {
  if (!dateStr) return '—';
  let display = dateStr;
  if (timeStr) display += ` ${timeStr}`;
  return display;
}

/**
 * Check if a task is overdue.
 * A task due today is NOT overdue — it becomes overdue from the next calendar day.
 * Comparison is date-only: today > due date means overdue.
 */
export function isTaskOverdue(task) {
  if (!task.end_date || task.status === 'completed' || task.status === 'cancelled') return false;
  const endMoment = parseDDMMYYYY(task.end_date);
  if (!endMoment || !endMoment.isValid()) return false;
  
  const todayStart = moment().startOf('day');
  const dueDay = endMoment.startOf('day');
  
  return todayStart.isAfter(dueDay);
}

/**
 * Get task urgency level
 */
export function getTaskUrgency(task) {
  if (task.status === 'completed' || task.status === 'cancelled') return 'done';
  if (isTaskOverdue(task)) return 'overdue';
  
  const endMoment = parseDDMMYYYY(task.end_date);
  if (!endMoment || !endMoment.isValid()) return 'normal';
  
  const now = moment();
  const hoursLeft = endMoment.diff(now, 'hours');
  if (hoursLeft <= 24) return 'due_today';
  if (hoursLeft <= 72) return 'due_soon';
  return 'normal';
}

/**
 * Get EAs for a director email
 */
export async function getEAsForDirector(directorEmail) {
  const mappings = await base44.entities.EADirectorMapping.filter({
    director_email: directorEmail,
    is_active: true,
  });
  return mappings.map(m => ({ email: m.ea_email, name: m.ea_name }));
}

/**
 * Get directors for an EA email
 */
export async function getDirectorsForEA(eaEmail) {
  const mappings = await base44.entities.EADirectorMapping.filter({
    ea_email: eaEmail,
    is_active: true,
  });
  return mappings.map(m => ({ email: m.director_email, name: m.director_name }));
}

/**
 * Status display config
 */
export const TASK_STATUS_CONFIG = {
  blocked: { label: 'Blocked', color: 'bg-purple-100 text-purple-700', icon: '🔒' },
  open: { label: 'Open', color: 'bg-blue-100 text-blue-700', icon: '📋' },
  pending_verification: { label: 'Pending Verification', color: 'bg-yellow-100 text-yellow-700', icon: '⏳' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: '✅' },
  date_change_requested: { label: 'Date Change Requested', color: 'bg-orange-100 text-orange-700', icon: '📅' },
  cancelled: { label: 'Cancelled', color: 'bg-slate-100 text-slate-500', icon: '❌' },
};