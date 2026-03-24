/**
 * Calculate Daily Reconciliation
 * Deno backend function to detect mismatches across modules
 * Run daily via automation
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Verify admin
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const today = new Date().toISOString().split('T')[0];
    const snapshots = [];

    // PRODUCTION RECONCILIATION
    const productionSnapshots = await reconcileProduction(base44, today);
    snapshots.push(...productionSnapshots);

    // WAREHOUSE RECONCILIATION
    const warehouseSnapshots = await reconcileWarehouse(base44, today);
    snapshots.push(...warehouseSnapshots);

    // LABELLING RECONCILIATION
    const labellingSnapshots = await reconcilelabelling(base44, today);
    snapshots.push(...labellingSnapshots);

    // GRN RECONCILIATION
    const grnSnapshots = await reconcileGRN(base44, today);
    snapshots.push(...grnSnapshots);

    // SYNC RECONCILIATION
    const syncSnapshots = await reconcileSync(base44, today);
    snapshots.push(...syncSnapshots);

    // APPROVAL RECONCILIATION
    const approvalSnapshots = await reconcileApprovals(base44, today);
    snapshots.push(...approvalSnapshots);

    // Save all snapshots
    for (const snapshot of snapshots) {
      try {
        await base44.asServiceRole.entities.ReconciliationSnapshot.create(snapshot);
      } catch (error) {
        console.error('Error saving snapshot:', error);
      }
    }

    return Response.json({
      success: true,
      snapshotsCreated: snapshots.length,
      date: today,
    });
  } catch (error) {
    console.error('Reconciliation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * PRODUCTION: Planned vs Produced
 */
async function reconcileProduction(base44, date) {
  const snapshots = [];

  try {
    // Get production orders for date
    const orders = await base44.asServiceRole.entities.ProductionOrder.filter(
      {},
      '-created_date',
      500
    );

    if (!orders) return snapshots;

    for (const order of orders) {
      if (!order.id) continue;

      // Get liquid batch plan for this order
      const plans = await base44.asServiceRole.entities.LiquidBatchPlan.filter(
        { order_id: order.id },
        '-created_date',
        100
      );

      if (plans && plans.length > 0) {
        for (const plan of plans) {
          // Get batches created from plan
          const batches = await base44.asServiceRole.entities.Batch.filter(
            { batch_id: plan.batch_id },
            'created_date',
            10
          );

          const plannedQty = plan.planned_qty || 0;
          const producedQty = batches && batches.length > 0
            ? (batches[0]?.planned_qty_liters || 0)
            : 0;

          const difference = plannedQty - producedQty;
          const variance = plannedQty > 0 ? Math.abs(difference / plannedQty) * 100 : 0;

          if (variance > 5) { // >5% variance
            snapshots.push({
              snapshot_date: date,
              module: 'PRODUCTION',
              reconciliation_type: 'planned_vs_produced',
              entity_type: 'ProductionOrder',
              entity_id: order.id,
              entity_code: order.order_id,
              sku: order.sku,
              expected_value: plannedQty,
              actual_value: producedQty,
              difference,
              variance_percent: variance.toFixed(2),
              severity: variance > 20 ? 'critical' : variance > 10 ? 'high' : 'medium',
              status: 'open',
              details: {
                plannedQty,
                producedQty,
                batchId: plan.batch_id,
              },
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Production reconciliation error:', error);
  }

  return snapshots;
}

/**
 * WAREHOUSE: FG Stock vs Pallet Stock
 */
async function reconcileWarehouse(base44, date) {
  const snapshots = [];

  try {
    // Get pallets
    const pallets = await base44.asServiceRole.entities.Pallet.filter(
      { status: 'RECEIVED' },
      '-created_date',
      500
    );

    if (!pallets) return snapshots;

    for (const pallet of pallets) {
      if (!pallet.id) continue;

      // Get crates in pallet
      const links = await base44.asServiceRole.entities.PalletCrateLink.filter(
        { pallet_id: pallet.id },
        'created_date',
        200
      );

      // Get stock balance for pallet's SKU
      const stock = await base44.asServiceRole.entities.StockBalance.filter(
        {
          sku: pallet.product_code,
          warehouse_id: pallet.current_location,
        },
        'created_date',
        1
      );

      const crateCount = links ? links.length : 0;
      const expectedQty = pallet.crate_count || 0;
      const actualQty = crateCount;

      if (expectedQty !== actualQty) {
        snapshots.push({
          snapshot_date: date,
          module: 'WAREHOUSE',
          reconciliation_type: 'pallet_crate_count',
          entity_type: 'Pallet',
          entity_id: pallet.id,
          entity_code: pallet.pallet_id,
          sku: pallet.product_code,
          warehouse_id: pallet.current_location,
          expected_value: expectedQty,
          actual_value: actualQty,
          difference: expectedQty - actualQty,
          variance_percent: (Math.abs(expectedQty - actualQty) / expectedQty * 100).toFixed(2),
          severity: Math.abs(expectedQty - actualQty) > 10 ? 'critical' : 'high',
          status: 'open',
          details: {
            palletId: pallet.pallet_id,
            expectedCrates: expectedQty,
            actualCrates: actualQty,
            status: pallet.status,
          },
        });
      }
    }
  } catch (error) {
    console.error('Warehouse reconciliation error:', error);
  }

  return snapshots;
}

/**
 * LABELLING: Labels Issued vs Consumed
 */
async function reconcilelabelling(base44, date) {
  const snapshots = [];

  try {
    // Get label print requests
    const printRequests = await base44.asServiceRole.entities.LabelPrintRequest.filter(
      { status: 'printed' },
      '-created_date',
      500
    );

    if (!printRequests) return snapshots;

    for (const request of printRequests) {
      if (!request.id) continue;

      // Get label consumption
      const consumed = await base44.asServiceRole.entities.BoxLabelPrintLog.filter(
        { print_request_id: request.id },
        'created_date',
        200
      );

      const issued = request.qty_requested || 0;
      const usedQty = consumed ? consumed.length : 0;
      const difference = issued - usedQty;
      const variance = issued > 0 ? Math.abs(difference / issued) * 100 : 0;

      if (variance > 10) { // >10% variance
        snapshots.push({
          snapshot_date: date,
          module: 'LABELLING',
          reconciliation_type: 'labels_issued_vs_consumed',
          entity_type: 'LabelPrintRequest',
          entity_id: request.id,
          entity_code: `LBL_${request.id.substring(0, 6)}`,
          sku: request.sku,
          expected_value: issued,
          actual_value: usedQty,
          difference,
          variance_percent: variance.toFixed(2),
          severity: variance > 25 ? 'critical' : variance > 15 ? 'high' : 'medium',
          status: 'open',
          details: {
            qtyIssued: issued,
            qtyConsumed: usedQty,
            waste: difference,
            wastePercent: variance.toFixed(2),
          },
        });
      }
    }
  } catch (error) {
    console.error('Labelling reconciliation error:', error);
  }

  return snapshots;
}

/**
 * GRN: Received vs Accepted vs Rejected
 */
async function reconcileGRN(base44, date) {
  const snapshots = [];

  try {
    // Get GRN headers
    const grnHeaders = await base44.asServiceRole.entities.GRNHeader.filter(
      { status: 'COMPLETED' },
      '-created_date',
      500
    );

    if (!grnHeaders) return snapshots;

    for (const grn of grnHeaders) {
      if (!grn.id) continue;

      // Get GRN items
      const items = await base44.asServiceRole.entities.GRNItem.filter(
        { grn_id: grn.id },
        'created_date',
        200
      );

      let totalReceived = 0;
      let totalAccepted = 0;
      let totalRejected = 0;

      if (items) {
        for (const item of items) {
          totalReceived += item.qty_received || 0;
          totalAccepted += item.qty_accepted || 0;
          totalRejected += item.qty_rejected || 0;
        }
      }

      const totalExpected = totalReceived;
      const difference = totalAccepted + totalRejected - totalReceived;
      const variance = totalExpected > 0 ? Math.abs(difference / totalExpected) * 100 : 0;

      if (variance > 2) { // >2% variance
        snapshots.push({
          snapshot_date: date,
          module: 'GRN',
          reconciliation_type: 'received_vs_accepted_rejected',
          entity_type: 'GRNHeader',
          entity_id: grn.id,
          entity_code: grn.grn_number,
          expected_value: totalReceived,
          actual_value: totalAccepted + totalRejected,
          difference,
          variance_percent: variance.toFixed(2),
          severity: variance > 5 ? 'critical' : 'high',
          status: 'open',
          details: {
            qtyReceived: totalReceived,
            qtyAccepted: totalAccepted,
            qtyRejected: totalRejected,
            shortfall: totalReceived - (totalAccepted + totalRejected),
          },
        });
      }
    }
  } catch (error) {
    console.error('GRN reconciliation error:', error);
  }

  return snapshots;
}

/**
 * SYNC: Pending or Failed Transactions
 */
async function reconcileSync(base44, date) {
  const snapshots = [];

  try {
    // Get failed offline transactions
    const failed = await base44.asServiceRole.entities.OfflineTransaction.filter(
      { status: 'failed' },
      '-created_date',
      100
    );

    if (failed && failed.length > 0) {
      snapshots.push({
        snapshot_date: date,
        module: 'SYNC',
        reconciliation_type: 'failed_sync_transactions',
        entity_type: 'OfflineTransaction',
        entity_id: 'batch',
        entity_code: 'SYNC_FAILURES',
        expected_value: 0,
        actual_value: failed.length,
        difference: failed.length,
        variance_percent: 100,
        severity: 'critical',
        status: 'open',
        details: {
          failedCount: failed.length,
          byModule: groupByModule(failed),
          byDevice: groupByDevice(failed),
        },
      });
    }

    // Get pending transactions
    const pending = await base44.asServiceRole.entities.OfflineTransaction.filter(
      { status: 'queued' },
      '-created_date',
      100
    );

    if (pending && pending.length > 50) {
      snapshots.push({
        snapshot_date: date,
        module: 'SYNC',
        reconciliation_type: 'pending_sync_queue',
        entity_type: 'OfflineTransaction',
        entity_id: 'batch',
        entity_code: 'SYNC_PENDING',
        expected_value: 0,
        actual_value: pending.length,
        difference: pending.length,
        variance_percent: 100,
        severity: 'high',
        status: 'open',
        details: {
          pendingCount: pending.length,
          oldestAge: pending.length > 0 ? calculateAge(pending[0].created_at) : 0,
        },
      });
    }
  } catch (error) {
    console.error('Sync reconciliation error:', error);
  }

  return snapshots;
}

/**
 * APPROVAL: Pending Beyond SLA
 */
async function reconcileApprovals(base44, date) {
  const snapshots = [];

  try {
    // Get pending FMS step instances
    const steps = await base44.asServiceRole.entities.FMSStepInstance.filter(
      { status: 'active' },
      '-activated_at',
      200
    );

    if (!steps) return snapshots;

    const now = new Date();
    let overduCount = 0;

    for (const step of steps) {
      if (step.deadline) {
        const deadline = new Date(step.deadline);
        if (deadline < now) {
          overduCount++;
        }
      }
    }

    if (overduCount > 0) {
      snapshots.push({
        snapshot_date: date,
        module: 'APPROVAL',
        reconciliation_type: 'pending_approvals_overdue',
        entity_type: 'FMSStepInstance',
        entity_id: 'batch',
        entity_code: 'APPROVAL_OVERDUE',
        expected_value: 0,
        actual_value: overduCount,
        difference: overduCount,
        variance_percent: 100,
        severity: overduCount > 10 ? 'critical' : 'high',
        status: 'open',
        details: {
          overdueCount: overduCount,
          totalPending: steps.length,
        },
      });
    }
  } catch (error) {
    console.error('Approval reconciliation error:', error);
  }

  return snapshots;
}

// Helpers
function groupByModule(items) {
  return items.reduce((groups, item) => {
    const key = item.module || 'UNKNOWN';
    groups[key] = (groups[key] || 0) + 1;
    return groups;
  }, {});
}

function groupByDevice(items) {
  return items.reduce((groups, item) => {
    const key = item.device_id || 'UNKNOWN';
    groups[key] = (groups[key] || 0) + 1;
    return groups;
  }, {});
}

function calculateAge(createdAt) {
  const now = new Date();
  const created = new Date(createdAt);
  const hours = (now - created) / (1000 * 60 * 60);
  return Math.floor(hours);
}