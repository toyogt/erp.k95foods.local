/**
 * Central Rules Engine
 * Validates transactions before execution to prevent invalid operations
 */

import { base44 } from '@/api/base44Client';

// Cache for rules
let rulesCache = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load all active rules from database
 */
async function loadRules() {
  const now = Date.now();
  
  if (rulesCache && now - cacheTime < CACHE_TTL) {
    return rulesCache;
  }

  try {
    const rules = await base44.entities.RulesConfig.filter({
      is_active: true
    }, '-sort_order');
    
    rulesCache = rules;
    cacheTime = now;
    return rules;
  } catch (error) {
    console.error('Failed to load rules:', error);
    return [];
  }
}

/**
 * Clear rules cache (call after updating rules)
 */
export function invalidateRulesCache() {
  rulesCache = null;
  cacheTime = 0;
}

/**
 * Validate transaction against all applicable rules
 * Returns { valid: bool, blocks: [], warnings: [] }
 */
export async function validateTransaction({
  module,
  entityType,
  actionType,
  entityId = null,
  payload = {},
  currentData = {},
  user,
  device,
}) {
  const rules = await loadRules();
  const applicable = rules.filter(r =>
    r.module === module &&
    r.entity_type === entityType &&
    r.action_type === actionType &&
    r.is_active
  );

  const blocks = [];
  const warnings = [];

  for (const rule of applicable) {
    try {
      const result = await evaluateRule(rule, {
        entityId,
        payload,
        currentData,
        user,
        device,
      });

      if (!result.valid) {
        const violation = {
          ruleKey: rule.rule_key,
          ruleName: rule.rule_name,
          errorMessage: rule.error_message,
          severity: rule.severity,
          allowOverride: rule.allow_override,
          overrideRoles: rule.override_roles || [],
          reasonCodes: rule.reason_codes || [],
          validationDetails: result.details,
        };

        if (rule.severity === 'block') {
          blocks.push(violation);
        } else {
          warnings.push(violation);
        }
      }
    } catch (error) {
      console.error(`Rule evaluation failed: ${rule.rule_key}`, error);
    }
  }

  return {
    valid: blocks.length === 0,
    blocks,
    warnings,
    totalRulesChecked: applicable.length,
  };
}

/**
 * Evaluate a single rule
 */
async function evaluateRule(rule, context) {
  // Dispatch to module-specific validator
  const validatorFn = getModuleValidator(rule.module, rule.validation_type);
  
  if (validatorFn) {
    return await validatorFn(rule, context);
  }

  // Fallback: check conditions
  return await checkConditions(rule.conditions, context);
}

/**
 * Get module-specific validator
 */
function getModuleValidator(module, validationType) {
  const validators = {
    WAREHOUSE: getWarehouseValidator(validationType),
    PRODUCTION: getProductionValidator(validationType),
    LABELLING: getLabellingValidator(validationType),
    GRN: getGRNValidator(validationType),
    ACCOUNTS: getAccountsValidator(validationType),
  };

  return validators[module];
}

/**
 * Warehouse validators
 */
function getWarehouseValidator(type) {
  const validators = {
    stock_availability: async (rule, context) => {
      const { payload, currentData } = context;
      const locationId = payload.location_id || currentData.location_id;
      const itemCode = payload.item_code || currentData.item_code;
      const qtyNeeded = payload.quantity || 0;

      try {
        const balance = await base44.entities.StockBalance.filter({
          location_id: locationId,
          item_code: itemCode,
        });

        if (!balance || balance.length === 0) {
          return {
            valid: false,
            details: {
              issue: 'No stock in location',
              location: locationId,
              item: itemCode,
            },
          };
        }

        const available = balance[0].available_qty || 0;
        if (available < qtyNeeded) {
          return {
            valid: false,
            details: {
              issue: 'Insufficient stock',
              required: qtyNeeded,
              available,
              shortage: qtyNeeded - available,
            },
          };
        }

        return { valid: true };
      } catch (error) {
        return {
          valid: false,
          details: { error: error.message },
        };
      }
    },
    lock_status: async (rule, context) => {
      const { entityId, currentData } = context;
      const entity = currentData.locked_by || null;

      if (entity) {
        return {
          valid: false,
          details: {
            issue: 'Entity is locked',
            lockedBy: entity,
          },
        };
      }

      return { valid: true };
    },
  };

  return validators[type];
}

/**
 * Production validators
 */
function getProductionValidator(type) {
  const validators = {
    status_requirement: async (rule, context) => {
      const { payload, currentData } = context;
      const currentStatus = currentData.status;
      const allowedStatuses = rule.conditions?.allowed_from || [];

      if (!allowedStatuses.includes(currentStatus)) {
        return {
          valid: false,
          details: {
            issue: 'Invalid status for action',
            current: currentStatus,
            allowed: allowedStatuses,
          },
        };
      }

      return { valid: true };
    },
    approval_requirement: async (rule, context) => {
      const { currentData } = context;
      const isApproved = currentData.status === 'APPROVED';

      if (!isApproved) {
        return {
          valid: false,
          details: {
            issue: 'Entity not approved',
            status: currentData.status,
          },
        };
      }

      return { valid: true };
    },
  };

  return validators[type];
}

/**
 * Labelling validators
 */
function getLabellingValidator(type) {
  const validators = {
    data_consistency: async (rule, context) => {
      const { currentData } = context;
      const artworkRevision = currentData.artwork_revision;
      const labelRevision = currentData.label_revision;

      if (artworkRevision !== labelRevision) {
        return {
          valid: false,
          details: {
            issue: 'Revision mismatch',
            artwork: artworkRevision,
            label: labelRevision,
          },
        };
      }

      return { valid: true };
    },
  };

  return validators[type];
}

/**
 * GRN validators
 */
function getGRNValidator(type) {
  const validators = {
    tolerance_limit: async (rule, context) => {
      const { payload, currentData } = context;
      const received = currentData.qty_received || 0;
      const requested = currentData.qty_requested;
      const tolerance = rule.conditions?.tolerance || 0.05; // 5% default

      const allowedQty = requested * (1 + tolerance);
      if (received + payload.qty > allowedQty) {
        return {
          valid: false,
          details: {
            issue: 'Exceeds tolerance',
            requested: requested,
            tolerance: `${tolerance * 100}%`,
            allowed: allowedQty,
            total: received + payload.qty,
            excess: (received + payload.qty) - allowedQty,
          },
        };
      }

      return { valid: true };
    },
    reference_integrity: async (rule, context) => {
      const { entityId } = context;

      try {
        const item = await base44.entities.GRNItem.filter({ id: entityId });
        if (!item || item.length === 0) {
          return {
            valid: false,
            details: { issue: 'GRN item not found' },
          };
        }

        return { valid: true };
      } catch (error) {
        return {
          valid: false,
          details: { error: error.message },
        };
      }
    },
  };

  return validators[type];
}

/**
 * Accounts validators
 */
function getAccountsValidator(type) {
  const validators = {};
  return validators[type];
}

/**
 * Generic condition checker (fallback)
 */
async function checkConditions(conditions, context) {
  if (!conditions) return { valid: true };

  // Evaluate field conditions
  const { payload, currentData } = context;
  const data = { ...currentData, ...payload };

  const conditionMet = Object.entries(conditions).every(([field, rule]) => {
    const value = data[field];
    
    if (rule.operator === 'equals') return value === rule.value;
    if (rule.operator === 'notEquals') return value !== rule.value;
    if (rule.operator === 'greaterThan') return value > rule.value;
    if (rule.operator === 'lessThan') return value < rule.value;
    if (rule.operator === 'in') return rule.value.includes(value);
    if (rule.operator === 'notIn') return !rule.value.includes(value);
    
    return true;
  });

  return {
    valid: conditionMet,
    details: { conditions },
  };
}

/**
 * Log a blocked attempt to audit trail
 */
export async function logBlockedAttempt({
  ruleKey,
  module,
  entityType,
  entityId,
  actionType,
  user,
  device,
  errorMessage,
  payload,
  validationDetails,
}) {
  try {
    const attemptId = `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await base44.entities.BlockedAttempt.create({
      attempt_id: attemptId,
      rule_key: ruleKey,
      module,
      entity_type: entityType,
      entity_id: entityId,
      action_type: actionType,
      user_email: user.email,
      user_name: user.full_name,
      device_id: device,
      error_message: errorMessage,
      payload,
      validation_details: validationDetails,
      block_status: 'blocked',
    });

    return attemptId;
  } catch (error) {
    console.error('Failed to log blocked attempt:', error);
  }
}

/**
 * Record override of a block
 */
export async function recordOverride(attemptId, {
  supervisorEmail,
  supervisorName,
  reasonCode,
  comment,
}) {
  try {
    await base44.entities.BlockedAttempt.update(attemptId, {
      block_status: 'overridden',
      override_by: supervisorEmail,
      override_reason_code: reasonCode,
      override_comment: comment,
      override_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to record override:', error);
  }
}

/**
 * Check if user can override a specific rule
 */
export async function canOverrideRule(rule, user) {
  if (!rule.allow_override) return false;
  
  const roles = rule.override_roles || [];
  return roles.includes(user.role) || user.role === 'admin';
}

/**
 * Get applicable override reason codes for a rule
 */
export function getOverrideReasons(rule) {
  const standard = [
    { code: 'EMERGENCY', label: 'Emergency / Critical Issue' },
    { code: 'QUALITY_CHECK', label: 'Manual Quality Check Passed' },
    { code: 'DOCUMENTED_EXCEPTION', label: 'Documented Exception Approved' },
    { code: 'SYSTEM_CORRECTION', label: 'System Data Correction' },
    { code: 'SUPPLIER_AGREEMENT', label: 'Supplier Agreement / Contract' },
  ];

  // Merge with rule-specific codes
  const custom = rule.reason_codes || [];
  return [...custom, ...standard];
}