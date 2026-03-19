/**
 * Reconciliation Helpers
 * Utilities for creating reconciliation snapshots
 */

import { base44 } from '@/api/base44Client';

/**
 * Create a reconciliation snapshot
 * Call when you detect a mismatch in business logic
 */
export async function createMismatchSnapshot({
  module,
  reconciliationType,
  entityType,
  entityId,
  entityCode,
  sku = null,
  shiftId = null,
  warehouseId = null,
  expectedValue,
  actualValue,
  severity = 'medium',
  details = null,
  remarks = null,
}) {
  try {
    const difference = expectedValue - actualValue;
    const variance = expectedValue > 0 
      ? (Math.abs(difference) / expectedValue) * 100 
      : 0;

    const snapshot = {
      snapshot_date: new Date().toISOString().split('T')[0],
      module,
      reconciliation_type: reconciliationType,
      entity_type: entityType,
      entity_id: entityId,
      entity_code: entityCode,
      sku,
      shift_id: shiftId,
      warehouse_id: warehouseId,
      expected_value: expectedValue,
      actual_value: actualValue,
      difference,
      variance_percent: variance.toFixed(2),
      severity,
      status: 'open',
      details,
      notes: remarks,
    };

    await base44.entities.ReconciliationSnapshot.create(snapshot);
    return { success: true };
  } catch (error) {
    console.error('Failed to create snapshot:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check production reconciliation at shift end
 */
export async function checkProductionReconciliation(shiftId) {
  try {
    // Get production orders for shift
    const orders = await base44.entities.ProductionOrder.filter(
      { shift_id: shiftId },
      'created_date',
      100
    );

    const mismatches = [];

    for (const order of orders) {
      // Get planned vs actual
      const planned = order.target_bottles || 0;
      const batches = await base44.entities.Batch.filter(
        { order_id: order.id },
        'created_date',
        100
      );

      let actual = 0;
      if (batches) {
        for (const batch of batches) {
          const crates = await base44.entities.Crate.filter(
            { batch_id: batch.id },
            'created_date',
            100
          );
          actual += (crates ? crates.length : 0) * (batch.bottle_count || 0);
        }
      }

      const variance = planned > 0 ? Math.abs(planned - actual) / planned * 100 : 0;
      if (variance > 5) {
        mismatches.push({
          module: 'PRODUCTION',
          reconciliationType: 'planned_vs_produced',
          entityType: 'ProductionOrder',
          entityId: order.id,
          entityCode: order.order_id,
          sku: order.sku,
          shiftId,
          expectedValue: planned,
          actualValue: actual,
          severity: variance > 20 ? 'critical' : variance > 10 ? 'high' : 'medium',
        });
      }
    }

    // Create snapshots
    for (const mismatch of mismatches) {
      await createMismatchSnapshot(mismatch);
    }

    return mismatches;
  } catch (error) {
    console.error('Production reconciliation check failed:', error);
    return [];
  }
}

/**
 * Check warehouse reconciliation
 */
export async function checkWarehouseReconciliation(warehouseId) {
  try {
    // Get all pallets in warehouse
    const pallets = await base44.entities.Pallet.filter(
      {
        current_location: warehouseId,
        status: 'RECEIVED',
      },
      'created_date',
      500
    );

    const mismatches = [];

    for (const pallet of pallets) {
      // Get crates linked to pallet
      const links = await base44.entities.PalletCrateLink.filter(
        { pallet_id: pallet.id },
        'created_date',
        200
      );

      const expected = pallet.crate_count || 0;
      const actual = links ? links.length : 0;

      if (expected !== actual) {
        mismatches.push({
          module: 'WAREHOUSE',
          reconciliationType: 'pallet_crate_count',
          entityType: 'Pallet',
          entityId: pallet.id,
          entityCode: pallet.pallet_id,
          sku: pallet.product_code,
          warehouseId,
          expectedValue: expected,
          actualValue: actual,
          severity: Math.abs(expected - actual) > 10 ? 'critical' : 'high',
          details: {
            expectedCrates: expected,
            actualCrates: actual,
            status: pallet.status,
          },
        });
      }
    }

    // Create snapshots
    for (const mismatch of mismatches) {
      await createMismatchSnapshot(mismatch);
    }

    return mismatches;
  } catch (error) {
    console.error('Warehouse reconciliation check failed:', error);
    return [];
  }
}

/**
 * Check label reconciliation
 */
export async function checkLabelReconciliation() {
  try {
    // Get label print requests from today
    const today = new Date().toISOString().split('T')[0];
    const requests = await base44.entities.LabelPrintRequest.filter(
      { status: 'printed' },
      '-created_date',
      200
    );

    const mismatches = [];

    for (const request of requests) {
      const created = new Date(request.created_date).toISOString().split('T')[0];
      if (created !== today) continue;

      // Get consumption
      const consumed = await base44.entities.BoxLabelPrintLog.filter(
        { print_request_id: request.id },
        'created_date',
        200
      );

      const issued = request.qty_requested || 0;
      const used = consumed ? consumed.length : 0;
      const waste = issued - used;
      const variance = issued > 0 ? (waste / issued) * 100 : 0;

      if (variance > 10) {
        mismatches.push({
          module: 'LABELLING',
          reconciliationType: 'labels_issued_vs_consumed',
          entityType: 'LabelPrintRequest',
          entityId: request.id,
          entityCode: `LBL_${request.id.substring(0, 6)}`,
          sku: request.sku,
          expectedValue: issued,
          actualValue: used,
          severity: variance > 25 ? 'critical' : 'high',
          details: {
            qtyIssued: issued,
            qtyConsumed: used,
            waste,
            wastePercent: variance.toFixed(2),
          },
        });
      }
    }

    // Create snapshots
    for (const mismatch of mismatches) {
      await createMismatchSnapshot(mismatch);
    }

    return mismatches;
  } catch (error) {
    console.error('Label reconciliation check failed:', error);
    return [];
  }
}

/**
 * Check GRN reconciliation
 */
export async function checkGRNReconciliation(grnId) {
  try {
    const grn = await base44.entities.GRNHeader.list().then(all =>
      all.find(g => g.id === grnId)
    );

    if (!grn) return { success: false, error: 'GRN not found' };

    // Get items
    const items = await base44.entities.GRNItem.filter(
      { grn_id: grnId },
      'created_date',
      200
    );

    let totalReceived = 0;
    let totalAccepted = 0;
    let totalRejected = 0;

    for (const item of items) {
      totalReceived += item.qty_received || 0;
      totalAccepted += item.qty_accepted || 0;
      totalRejected += item.qty_rejected || 0;
    }

    const difference = (totalAccepted + totalRejected) - totalReceived;
    const variance = totalReceived > 0 ? Math.abs(difference / totalReceived) * 100 : 0;

    if (variance > 2) {
      await createMismatchSnapshot({
        module: 'GRN',
        reconciliationType: 'received_vs_accepted_rejected',
        entityType: 'GRNHeader',
        entityId: grnId,
        entityCode: grn.grn_number,
        expectedValue: totalReceived,
        actualValue: totalAccepted + totalRejected,
        severity: variance > 5 ? 'critical' : 'high',
        details: {
          qtyReceived: totalReceived,
          qtyAccepted: totalAccepted,
          qtyRejected: totalRejected,
          shortfall: totalReceived - (totalAccepted + totalRejected),
        },
      });

      return { success: true, mismatch: true };
    }

    return { success: true, mismatch: false };
  } catch (error) {
    console.error('GRN reconciliation check failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check sync reconciliation
 */
export async function checkSyncReconciliation() {
  try {
    // Get failed transactions
    const failed = await base44.entities.OfflineTransaction.filter(
      { status: 'failed' },
      '-created_date',
      100
    );

    if (failed && failed.length > 0) {
      await createMismatchSnapshot({
        module: 'SYNC',
        reconciliationType: 'failed_sync_transactions',
        entityType: 'OfflineTransaction',
        entityId: 'batch',
        entityCode: 'SYNC_FAILURES',
        expectedValue: 0,
        actualValue: failed.length,
        severity: 'critical',
        details: {
          failedCount: failed.length,
          byModule: groupByField(failed, 'module'),
          byDevice: groupByField(failed, 'device_id'),
        },
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Sync reconciliation check failed:', error);
    return { success: false, error: error.message };
  }
}

function groupByField(items, field) {
  return items.reduce((groups, item) => {
    const key = item[field] || 'UNKNOWN';
    groups[key] = (groups[key] || 0) + 1;
    return groups;
  }, {});
}