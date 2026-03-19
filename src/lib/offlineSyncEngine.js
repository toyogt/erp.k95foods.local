/**
 * Offline Sync Engine
 * 
 * Factory-safe transaction and sync engine with:
 * - Idempotency & replay protection
 * - Module-specific conflict resolution
 * - Automatic retry with backoff
 * - Audit trail
 */

import { v4 as uuidv4 } from 'uuid';
import { base44 } from '@/api/base44Client';

// ============================================================================
// TRANSACTION QUEUE
// ============================================================================

const STORAGE_KEY = 'k95_offline_transactions';
const DEVICE_ID_KEY = 'k95_device_id';

/**
 * Get or create device ID (for tracking device-specific issues)
 */
export function getDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

/**
 * Load all transactions from localStorage
 */
function loadTransactionQueue() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to load transaction queue:', e);
    return [];
  }
}

/**
 * Save transactions to localStorage
 */
function saveTransactionQueue(transactions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (e) {
    console.error('Failed to save transaction queue:', e);
  }
}

/**
 * Create offline transaction
 */
export function createOfflineTransaction({
  module,
  entityType,
  actionType,
  payload,
  entityId = null,
  isCritical = false,
}) {
  const user = base44.auth.me?.();
  const deviceId = getDeviceId();
  
  const transaction = {
    transaction_id: `txn_${Date.now()}_${uuidv4().substr(0, 8)}`,
    idempotency_key: `${module}_${entityType}_${actionType}_${Date.now()}_${uuidv4()}`,
    user_id: user?.email || 'unknown@factory.local',
    device_id: deviceId,
    site_id: payload.site_id || 'default',
    module,
    entity_type: entityType,
    entity_id: entityId,
    action_type: actionType,
    payload,
    status: 'queued',
    created_at: new Date().toISOString(),
    retry_count: 0,
    is_critical: isCritical,
  };

  const queue = loadTransactionQueue();
  queue.push(transaction);
  saveTransactionQueue(queue);

  return transaction;
}

/**
 * Get pending transactions
 */
export function getPendingTransactions() {
  const queue = loadTransactionQueue();
  return queue.filter(t => ['queued', 'processing'].includes(t.status));
}

/**
 * Get failed transactions
 */
export function getFailedTransactions() {
  const queue = loadTransactionQueue();
  return queue.filter(t => ['failed', 'conflict'].includes(t.status));
}

/**
 * Update transaction status
 */
export function updateTransactionStatus(transactionId, updates) {
  const queue = loadTransactionQueue();
  const idx = queue.findIndex(t => t.transaction_id === transactionId);
  
  if (idx >= 0) {
    queue[idx] = { ...queue[idx], ...updates };
    saveTransactionQueue(queue);
    return queue[idx];
  }
  return null;
}

// ============================================================================
// SYNC PROCESSOR
// ============================================================================

const RETRY_DELAYS = [1000, 3000, 10000, 30000]; // Exponential backoff
const MAX_RETRIES = 3;

/**
 * Check if transaction is idempotent (already synced)
 */
export async function checkIdempotency(transaction) {
  try {
    const existing = await base44.entities.OfflineTransaction.filter({
      idempotency_key: transaction.idempotency_key,
      status: 'confirmed',
    });

    if (existing.length > 0) {
      return {
        isDuplicate: true,
        originalSync: existing[0],
      };
    }
    return { isDuplicate: false };
  } catch (e) {
    console.error('Idempotency check failed:', e);
    return { isDuplicate: false };
  }
}

/**
 * Process single transaction through sync engine
 */
export async function processSyncTransaction(transaction) {
  // Check for duplicates
  const idempotencyCheck = await checkIdempotency(transaction);
  if (idempotencyCheck.isDuplicate) {
    return updateTransactionStatus(transaction.transaction_id, {
      status: 'confirmed',
      synced_at: new Date().toISOString(),
      sync_result: idempotencyCheck.originalSync.sync_result,
    });
  }

  // Mark as processing
  updateTransactionStatus(transaction.transaction_id, {
    status: 'processing',
  });

  try {
    // Get conflict handler for module
    const conflictHandler = getConflictHandler(transaction.module, transaction.entity_type);

    // Execute sync
    let result;
    try {
      result = await executeSyncAction(transaction);
    } catch (e) {
      // Check if conflict
      if (conflictHandler && conflictHandler.canHandle(e)) {
        const conflict = await conflictHandler.analyze(transaction, e);
        return updateTransactionStatus(transaction.transaction_id, {
          status: 'conflict',
          last_error: conflict.message,
          error_code: 'CONFLICT',
          conflict_details: conflict.details,
          retry_count: transaction.retry_count + 1,
        });
      }

      // Check error type for retry
      const shouldRetry = shouldRetryError(e);
      if (shouldRetry && transaction.retry_count < MAX_RETRIES) {
        return updateTransactionStatus(transaction.transaction_id, {
          status: 'queued',
          last_error: e.message,
          error_code: classifyError(e),
          retry_count: transaction.retry_count + 1,
        });
      }

      // Permanent failure
      return updateTransactionStatus(transaction.transaction_id, {
        status: 'failed',
        last_error: e.message,
        error_code: classifyError(e),
        retry_count: transaction.retry_count + 1,
      });
    }

    // Success
    return updateTransactionStatus(transaction.transaction_id, {
      status: 'confirmed',
      synced_at: new Date().toISOString(),
      sync_result: result,
    });
  } catch (e) {
    console.error('Transaction sync error:', e);
    return updateTransactionStatus(transaction.transaction_id, {
      status: 'failed',
      last_error: e.message,
      error_code: 'SYNC_ERROR',
      retry_count: transaction.retry_count + 1,
    });
  }
}

/**
 * Execute the actual sync action
 */
async function executeSyncAction(transaction) {
  const { module, entity_type, action_type, payload, entity_id } = transaction;

  // Route to entity handlers
  switch (action_type) {
    case 'create': {
      const created = await base44.entities[entity_type].create(payload);
      
      // Fire FMS event if applicable
      const fmsEvent = getFMSEventForAction(module, entity_type, 'create');
      if (fmsEvent) {
        try {
          const { fireFMSEvent } = await import('@/lib/useFMSAutoComplete');
          await fireFMSEvent(fmsEvent, created.id);
        } catch (e) {
          console.warn('FMS event fire failed:', e);
        }
      }
      
      return { created_id: created.id, fms_event_fired: !!fmsEvent };
    }

    case 'update': {
      const updated = await base44.entities[entity_type].update(entity_id, payload);
      
      const fmsEvent = getFMSEventForAction(module, entity_type, 'update');
      if (fmsEvent) {
        try {
          const { fireFMSEvent } = await import('@/lib/useFMSAutoComplete');
          await fireFMSEvent(fmsEvent, entity_id);
        } catch (e) {
          console.warn('FMS event fire failed:', e);
        }
      }
      
      return { updated_id: entity_id, fms_event_fired: !!fmsEvent };
    }

    case 'delete': {
      await base44.entities[entity_type].delete(entity_id);
      return { deleted_id: entity_id };
    }

    case 'approve':
    case 'reject':
    case 'receive':
    case 'dispatch':
    case 'scan':
    case 'status_change': {
      // Custom action handlers
      const handler = getActionHandler(module, entity_type, action_type);
      if (!handler) {
        throw new Error(`No handler for action: ${action_type} on ${entity_type}`);
      }
      return await handler(transaction);
    }

    default:
      throw new Error(`Unknown action type: ${action_type}`);
  }
}

// ============================================================================
// CONFLICT RESOLUTION
// ============================================================================

const conflictHandlers = {
  // Stock movement conflicts
  stock_movement: {
    canHandle: (e) => e.message?.includes('insufficient stock') || e.message?.includes('stock balance'),
    analyze: async (transaction, error) => ({
      message: 'Insufficient stock for movement (item may have been consumed)',
      details: {
        field: 'stock_balance',
        local_value: transaction.payload.quantity,
        error: error.message,
        resolution: 'Review current stock and adjust quantity',
      },
    }),
  },

  // Receiving conflicts
  receiving: {
    canHandle: (e) => e.message?.includes('already received') || e.message?.includes('duplicate'),
    analyze: async (transaction, error) => ({
      message: 'Item already received (concurrent operation detected)',
      details: {
        field: 'status',
        local_value: transaction.payload.status,
        error: error.message,
        resolution: 'Verify item was received correctly',
      },
    }),
  },

  // QC status conflicts
  qc_status: {
    canHandle: (e) => e.message?.includes('qc status') || e.message?.includes('state transition'),
    analyze: async (transaction, error) => ({
      message: 'QC status change invalid (status may have changed)',
      details: {
        field: 'status',
        error: error.message,
        resolution: 'Refresh item and resubmit QC status',
      },
    }),
  },

  // Crate creation conflicts
  crate_creation: {
    canHandle: (e) => e.message?.includes('crate_id exists') || e.message?.includes('duplicate crate'),
    analyze: async (transaction, error) => ({
      message: 'Crate ID already exists (duplicate creation)',
      details: {
        field: 'crate_id',
        local_value: transaction.payload.crate_id,
        error: error.message,
        resolution: 'Generate new crate ID',
      },
    }),
  },

  // Pallet transfer conflicts
  pallet_transfer: {
    canHandle: (e) => e.message?.includes('pallet') && (e.message?.includes('locked') || e.message?.includes('in use')),
    analyze: async (transaction, error) => ({
      message: 'Pallet is locked or in use (concurrent operation)',
      details: {
        field: 'status',
        error: error.message,
        resolution: 'Wait for other operation to complete, then retry',
      },
    }),
  },

  // Dispatch conflicts
  dispatch: {
    canHandle: (e) => e.message?.includes('dispatch') && (e.message?.includes('already') || e.message?.includes('state')),
    analyze: async (transaction, error) => ({
      message: 'Dispatch status invalid (concurrent dispatch detected)',
      details: {
        field: 'status',
        error: error.message,
        resolution: 'Refresh dispatch and verify current status',
      },
    }),
  },
};

function getConflictHandler(module, entityType) {
  return conflictHandlers[entityType] || conflictHandlers[module];
}

// ============================================================================
// RETRY & ERROR HANDLING
// ============================================================================

function classifyError(error) {
  if (!navigator.onLine) return 'NETWORK';
  if (error.status === 400 || error.status === 422) return 'VALIDATION';
  if (error.status === 409) return 'CONFLICT';
  if (error.status === 408 || error.code === 'TIMEOUT') return 'TIMEOUT';
  if (error.status >= 500) return 'SERVER_ERROR';
  return 'UNKNOWN';
}

function shouldRetryError(error) {
  const code = classifyError(error);
  return ['NETWORK', 'TIMEOUT', 'SERVER_ERROR'].includes(code);
}

export function getRetryDelay(retryCount) {
  if (retryCount >= RETRY_DELAYS.length) {
    return RETRY_DELAYS[RETRY_DELAYS.length - 1];
  }
  return RETRY_DELAYS[retryCount];
}

// ============================================================================
// ACTION HANDLERS (CUSTOM BUSINESS LOGIC)
// ============================================================================

const actionHandlers = {};

export function registerActionHandler(module, entityType, actionType, handler) {
  const key = `${module}_${entityType}_${actionType}`;
  actionHandlers[key] = handler;
}

function getActionHandler(module, entityType, actionType) {
  return actionHandlers[`${module}_${entityType}_${actionType}`];
}

// ============================================================================
// FMS EVENT MAPPING
// ============================================================================

const fmsEventMap = {
  PRODUCTION: {
    Crate: { create: 'crate_created', status_change: 'crate_status_changed' },
    Pallet: { create: 'pallet_created', status_change: 'pallet_status_changed' },
    Batch: { create: 'batch_created', status_change: 'batch_status_changed' },
  },
  WAREHOUSE: {
    StockMovement: { create: 'stock_moved' },
    WarehouseReceipt: { create: 'goods_received' },
    WarehouseDispatch: { create: 'goods_dispatched' },
  },
  QC: {
    QCInspection: { create: 'qc_inspection_created', status_change: 'qc_status_changed' },
  },
};

function getFMSEventForAction(module, entityType, actionType) {
  return fmsEventMap[module]?.[entityType]?.[actionType];
}

// ============================================================================
// SYNC MANAGER
// ============================================================================

let syncInProgress = false;

/**
 * Sync all pending transactions
 */
export async function syncPendingTransactions() {
  if (syncInProgress) {
    console.log('Sync already in progress');
    return;
  }

  syncInProgress = true;

  try {
    const pending = getPendingTransactions();

    if (pending.length === 0) {
      return { synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;

    for (const txn of pending) {
      const delay = getRetryDelay(txn.retry_count);
      await new Promise(resolve => setTimeout(resolve, delay));

      try {
        const result = await processSyncTransaction(txn);
        if (result.status === 'confirmed') {
          synced++;
        } else {
          failed++;
        }
      } catch (e) {
        console.error('Sync transaction failed:', e);
        failed++;
      }
    }

    return { synced, failed };
  } finally {
    syncInProgress = false;
  }
}

/**
 * Supervisor resolves conflict
 */
export async function resolveConflict(transactionId, resolution) {
  const user = await base44.auth.me();
  const txn = updateTransactionStatus(transactionId, {
    status: 'queued',
    conflict_details: { ...loadTransactionQueue().find(t => t.transaction_id === transactionId)?.conflict_details, resolution },
    notes: resolution.notes,
    supervisor_action_by: user.email,
    supervisor_action_at: new Date().toISOString(),
    retry_count: 0, // Reset retry count
  });

  // Re-queue for sync
  return txn;
}

/**
 * Clear old synced transactions (cleanup)
 */
export function cleanupOldTransactions(daysOld = 30) {
  const queue = loadTransactionQueue();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  const filtered = queue.filter(t => {
    if (t.status !== 'confirmed') return true; // Keep non-confirmed
    const syncDate = new Date(t.synced_at);
    return syncDate > cutoff;
  });

  saveTransactionQueue(filtered);
  return queue.length - filtered.length;
}

export function getAllTransactions() {
  return loadTransactionQueue();
}