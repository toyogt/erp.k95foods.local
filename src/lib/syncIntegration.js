/**
 * Sync Integration Helper
 * Connect offline sync engine to business pages
 */

import {
  createOfflineTransaction,
  syncPendingTransactions,
  getPendingTransactions,
  getFailedTransactions,
} from '@/lib/offlineSyncEngine';
import { base44 } from '@/api/base44Client';

/**
 * Create offline transaction for entity operation
 * Use in pages/components when operating offline
 */
export async function createTransaction({
  module,
  entityType,
  actionType,
  payload,
  entityId = null,
  isCritical = false,
}) {
  const isOnline = navigator.onLine;

  if (!isOnline) {
    // Create offline transaction
    const txn = createOfflineTransaction({
      module,
      entityType,
      actionType,
      payload,
      entityId,
      isCritical,
    });

    return {
      success: true,
      offline: true,
      transactionId: txn.transaction_id,
      message: `Queued for sync when online`,
    };
  }

  // Online - execute directly
  try {
    let result;
    switch (actionType) {
      case 'create':
        result = await base44.entities[entityType].create(payload);
        return { success: true, offline: false, entityId: result.id };

      case 'update':
        result = await base44.entities[entityType].update(entityId, payload);
        return { success: true, offline: false, entityId };

      case 'delete':
        await base44.entities[entityType].delete(entityId);
        return { success: true, offline: false, entityId };

      default:
        throw new Error(`Unknown action: ${actionType}`);
    }
  } catch (error) {
    // If online request fails and appears transient, queue offline
    if (shouldFallbackToOffline(error)) {
      const txn = createOfflineTransaction({
        module,
        entityType,
        actionType,
        payload,
        entityId,
        isCritical,
      });

      return {
        success: false,
        offline: true,
        transactionId: txn.transaction_id,
        message: `Network error - queued for later sync`,
        error: error.message,
      };
    }

    throw error;
  }
}

/**
 * Automatically sync when online
 */
export function setupAutoSync() {
  const syncOnOnline = async () => {
    if (navigator.onLine) {
      const pending = getPendingTransactions();
      if (pending.length > 0) {
        await syncPendingTransactions();
      }
    }
  };

  window.addEventListener('online', syncOnOnline);
  return () => window.removeEventListener('online', syncOnOnline);
}

/**
 * Get sync status for a specific entity
 */
export function getSyncStatus(entityId) {
  const pending = getPendingTransactions();
  const failed = getFailedTransactions();

  const pendingTxn = pending.find(t => t.entity_id === entityId);
  const failedTxn = failed.find(t => t.entity_id === entityId);

  if (pendingTxn) {
    return { status: pendingTxn.status, transaction: pendingTxn };
  }
  if (failedTxn) {
    return { status: failedTxn.status, transaction: failedTxn };
  }

  return null;
}

/**
 * Wait for transaction to sync
 */
export function waitForSync(transactionId, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkStatus = () => {
      const pending = getPendingTransactions();
      const txn = pending.find(t => t.transaction_id === transactionId);

      if (!txn) {
        // Synced or failed
        resolve(txn);
        return;
      }

      if (Date.now() - startTime > timeoutMs) {
        reject(new Error('Sync timeout'));
        return;
      }

      setTimeout(checkStatus, 500);
    };

    checkStatus();
  });
}

/**
 * Determine if error warrants offline fallback
 */
function shouldFallbackToOffline(error) {
  // Network errors
  if (error.message?.includes('network') || error.message?.includes('offline')) {
    return true;
  }

  // Timeout errors
  if (error.code === 'ECONNABORTED' || error.code === 'TIMEOUT') {
    return true;
  }

  // 5xx server errors
  if (error.status >= 500) {
    return true;
  }

  // 408 Request Timeout
  if (error.status === 408) {
    return true;
  }

  return false;
}

/**
 * Batch operations with offline support
 */
export async function batchCreateWithFallback(entityType, records) {
  const isOnline = navigator.onLine;

  if (isOnline) {
    try {
      return await base44.entities[entityType].bulkCreate(records);
    } catch (error) {
      if (shouldFallbackToOffline(error)) {
        // Fall back to queuing individually
        return records.map(record =>
          createOfflineTransaction({
            module: 'BATCH',
            entityType,
            actionType: 'create',
            payload: record,
          })
        );
      }
      throw error;
    }
  }

  // Offline - queue each individually
  return records.map(record =>
    createOfflineTransaction({
      module: 'BATCH',
      entityType,
      actionType: 'create',
      payload: record,
    })
  );
}