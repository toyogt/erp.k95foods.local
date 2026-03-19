/**
 * SLA Engine
 * Calculates aging, determines SLA status, and manages escalations
 */

import { base44 } from '@/api/base44Client';

export const SLA_STATUSES = {
  ON_TIME: 'on_time',
  DUE_SOON: 'due_soon',
  OVERDUE: 'overdue',
  CRITICALLY_OVERDUE: 'critically_overdue',
};

/**
 * Get SLA configuration by workflow type
 */
export async function getSLAConfig(workflowType) {
  try {
    const configs = await base44.entities.SLAConfig.filter(
      { workflow_type: workflowType, is_active: true },
      null,
      1
    );
    return configs[0] || null;
  } catch (error) {
    console.error('Error fetching SLA config:', error);
    return null;
  }
}

/**
 * Calculate hours elapsed since created
 */
export function getHoursElapsed(createdDate) {
  if (!createdDate) return 0;
  const created = new Date(createdDate);
  const now = new Date();
  return (now - created) / (1000 * 60 * 60);
}

/**
 * Determine SLA status based on elapsed time
 */
export function getSLAStatus(config, hoursElapsed, priority = 'normal') {
  if (!config) return SLA_STATUSES.ON_TIME;

  // Select SLA target based on priority
  let slaTarget = config.normal_sla_hours;
  if (priority === 'urgent') slaTarget = config.urgent_sla_hours;
  if (priority === 'critical') slaTarget = config.critical_sla_hours;

  const percentageUsed = (hoursElapsed / slaTarget) * 100;
  const overdueTreshold = config.overdue_threshold_percent || 150;

  if (percentageUsed >= overdueTreshold) {
    return SLA_STATUSES.CRITICALLY_OVERDUE;
  }
  if (percentageUsed >= 100) {
    return SLA_STATUSES.OVERDUE;
  }
  if (percentageUsed >= (config.warning_threshold_percent || 75)) {
    return SLA_STATUSES.DUE_SOON;
  }
  return SLA_STATUSES.ON_TIME;
}

/**
 * Calculate aging information
 */
export function calculateAging(createdDate, config, priority = 'normal') {
  const hoursElapsed = getHoursElapsed(createdDate);
  const status = getSLAStatus(config, hoursElapsed, priority);

  // Determine target SLA
  let slaTarget = config.normal_sla_hours;
  if (priority === 'urgent') slaTarget = config.urgent_sla_hours;
  if (priority === 'critical') slaTarget = config.critical_sla_hours;

  const hoursRemaining = Math.max(0, slaTarget - hoursElapsed);
  const percentageUsed = Math.min(100, (hoursElapsed / slaTarget) * 100);

  return {
    hoursElapsed,
    hoursRemaining,
    slaTarget,
    percentageUsed,
    status,
    isOverdue: status === SLA_STATUSES.OVERDUE || status === SLA_STATUSES.CRITICALLY_OVERDUE,
    isDueSoon: status === SLA_STATUSES.DUE_SOON,
    isOnTime: status === SLA_STATUSES.ON_TIME,
  };
}

/**
 * Get color for SLA status
 */
export function getSLAStatusColor(status) {
  const colors = {
    [SLA_STATUSES.ON_TIME]: 'bg-green-100 text-green-700 border-green-300',
    [SLA_STATUSES.DUE_SOON]: 'bg-amber-100 text-amber-700 border-amber-300',
    [SLA_STATUSES.OVERDUE]: 'bg-red-100 text-red-700 border-red-300',
    [SLA_STATUSES.CRITICALLY_OVERDUE]: 'bg-red-900 text-white border-red-900',
  };
  return colors[status] || colors[SLA_STATUSES.ON_TIME];
}

/**
 * Get label for SLA status
 */
export function getSLAStatusLabel(status) {
  const labels = {
    [SLA_STATUSES.ON_TIME]: 'On Time',
    [SLA_STATUSES.DUE_SOON]: 'Due Soon',
    [SLA_STATUSES.OVERDUE]: 'Overdue',
    [SLA_STATUSES.CRITICALLY_OVERDUE]: 'Critically Overdue',
  };
  return labels[status] || 'Unknown';
}

/**
 * Check if item needs escalation
 */
export async function shouldEscalate(config, hoursOverdue, lastEscalationTime) {
  if (!config || hoursOverdue <= 0) return false;

  const escalationInterval = config.escalation_interval_hours || 4;
  const timeSinceLastEscalation = lastEscalationTime 
    ? getHoursElapsed(lastEscalationTime) 
    : escalationInterval;

  return timeSinceLastEscalation >= escalationInterval;
}

/**
 * Create escalation log entry
 */
export async function logEscalation({
  config,
  entityType,
  entityId,
  entityCode,
  workflowType,
  escalationLevel,
  escalatedToRole,
  escalatedToEmail,
  escalatedToName,
  hoursOverdue,
  reason,
}) {
  try {
    const escalation = await base44.entities.SLAEscalationLog.create({
      escalation_id: `${entityId}_${escalationLevel}_${Date.now()}`,
      workflow_type: workflowType,
      entity_type: entityType,
      entity_id: entityId,
      entity_code: entityCode,
      escalation_level: escalationLevel,
      escalated_to_role: escalatedToRole,
      escalated_to_email: escalatedToEmail,
      escalated_to_name: escalatedToName,
      hours_overdue: hoursOverdue,
      escalation_reason: reason,
      acknowledged: false,
    });

    return escalation;
  } catch (error) {
    console.error('Error logging escalation:', error);
    throw error;
  }
}

/**
 * Get next escalation path
 */
export function getNextEscalation(config, currentLevel = 0) {
  if (!config.escalation_chain || config.escalation_chain.length === 0) {
    return null;
  }

  const nextEscalation = config.escalation_chain.find(
    (e) => e.escalation_level === currentLevel + 1
  );
  return nextEscalation || null;
}

/**
 * Format hours to human-readable
 */
export function formatAgeingDuration(hours) {
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes}m`;
  }
  if (hours < 24) {
    return `${Math.round(hours)}h`;
  }
  const days = Math.round(hours / 24);
  return `${days}d`;
}

/**
 * Get aging bucket label
 */
export function getAgeingBucketLabel(status) {
  switch (status) {
    case SLA_STATUSES.ON_TIME:
      return 'On Schedule';
    case SLA_STATUSES.DUE_SOON:
      return 'Due Soon (75% consumed)';
    case SLA_STATUSES.OVERDUE:
      return 'Overdue (past SLA)';
    case SLA_STATUSES.CRITICALLY_OVERDUE:
      return 'Critically Overdue (150% past SLA)';
    default:
      return 'Unknown';
  }
}

/**
 * Get aging bucket icon
 */
export function getAgeingBucketIcon(status) {
  switch (status) {
    case SLA_STATUSES.ON_TIME:
      return '✓';
    case SLA_STATUSES.DUE_SOON:
      return '⚠';
    case SLA_STATUSES.OVERDUE:
      return '!';
    case SLA_STATUSES.CRITICALLY_OVERDUE:
      return '✕';
    default:
      return '?';
  }
}