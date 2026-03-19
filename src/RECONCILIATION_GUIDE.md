# Factory Reconciliation & Exception Dashboard Guide

## Overview

A **daily reconciliation system** that automatically detects and exposes mismatches across factory operations—production, warehouse, labelling, GRN, sync, and approvals. Exception-first dashboards surface critical issues immediately instead of waiting for manual discovery.

**Key Principle:** Mismatches are detected by comparing expected vs actual values across workflows. High-variance items get critical severity; issues are tracked until resolved.

## What Gets Reconciled

| Module | Reconciliation Type | Expected vs Actual | Severity Logic |
|--------|---------------------|-------------------|-----------------|
| **PRODUCTION** | Planned vs Produced | Order target qty vs batch output | >20% variance = critical |
| **PRODUCTION** | Filled vs Crates | Crates created vs bottles filled | >15% variance = high |
| **PRODUCTION** | Crates vs Labelled | Crates vs labelled output | >10% variance = high |
| **PRODUCTION** | Output vs Hold/Reject | Planned qty vs (accepted + rejected) | >5% variance = high |
| **WAREHOUSE** | FG Stock vs Pallet | Expected crates per pallet vs actual linked | Mismatch = high |
| **WAREHOUSE** | Transfer Sent vs Received | Dispatch planned qty vs received | >2% variance = critical |
| **WAREHOUSE** | Dispatch Planned vs Loaded | Dispatch target vs actual loaded | >5% variance = high |
| **LABELLING** | Labels Issued vs Consumed | Labels printed vs labels used | >10% variance = critical |
| **LABELLING** | Roll Balance vs Expected | Physical count vs system | Any mismatch = high |
| **GRN** | Received vs Accepted vs Rejected | GRN qty received vs (accepted + rejected) | >2% variance = critical |
| **SYNC** | Pending Sync Queue | Transaction queue age/count | >50 pending = high |
| **SYNC** | Failed Sync | Failed transaction count | Any failed = critical |
| **APPROVAL** | Pending Beyond SLA | Active steps vs deadline | >10 overdue = critical |

## Architecture

```
┌─────────────────────────────────────────────┐
│ Daily Batch Process (Automation)            │
│ calculateDailyReconciliation.js             │
└────────────────────┬────────────────────────┘
                     ↓
        ┌─────────────────────────────┐
        │ Reconciliation Checks       │
        │ - Production (planned/actual)│
        │ - Warehouse (stock/pallet)  │
        │ - Labelling (issued/used)   │
        │ - GRN (received/accepted)   │
        │ - Sync (pending/failed)     │
        │ - Approvals (overdue)       │
        └────────────────┬────────────┘
                         ↓
        ┌─────────────────────────────┐
        │ ReconciliationSnapshot      │
        │ (one record per mismatch)   │
        │ - severity (critical/high)  │
        │ - status (open/resolving)   │
        │ - difference & variance     │
        │ - details object            │
        └────────────────┬────────────┘
                         ↓
        ┌─────────────────────────────┐
        │ ReconciliationDashboard     │
        │ - Exception-first view      │
        │ - Sorted by severity        │
        │ - Filter by module/date     │
        │ - Drill-down to details     │
        │ - Update status/assignee    │
        └─────────────────────────────┘
```

## Daily Reconciliation Run

**Automation Setup:**
```
Schedule: Daily at 6:00 AM IST (00:30 UTC)
Function: calculateDailyReconciliation
Scope: Service role (admin access)
```

The function runs all reconciliation checks and creates **ReconciliationSnapshot** records for any mismatches > configured thresholds.

## Using the Reconciliation Dashboard

**Path:** Admin → Reconciliation Dashboard

### 1. Summary Cards (Top)
- **Critical:** Count of severity=critical open issues
- **High:** Count of severity=high issues
- **Total Issues:** All open mismatches for today
- **Resolved:** Issues marked as resolved

### 2. Module Breakdown
Quick view of issues by module (Production, Warehouse, Labelling, GRN, Sync, Approval). Click to filter.

### 3. Filter Panel
- **Search:** Find by entity code, SKU, or ID
- **Module:** Filter to specific module
- **Severity:** Filter by critical/high/medium/low
- **Status:** Filter by open/investigating/resolved/false_positive
- **Date Range:** Select date range

### 4. Mismatch Cards (Exception-First List)
Each card shows:
- **Icon & Title:** Reconciliation type (e.g., "Planned vs Produced")
- **Entity Code:** User-readable ID (batch_id, pallet_id, etc.)
- **Severity Badge:** Critical/High/Medium/Low
- **Status Badge:** Open/Investigating/Resolved
- **Expected/Actual/Difference:** The three key numbers
- **Variance %:** How far off (5%, 15%, etc.)
- **Assignee:** Who's working on it
- **Root Cause:** Why it happened (if filled)

**Sorting:** Critical → High → Medium → Low (most important first)

### 5. Drill-Down Detail Modal
Click a card to see:
- Full details grid (all fields)
- Details object (JSON breakdown)
- Root cause analysis
- Status change buttons (Investigating, Resolved, False Positive)

## Integrating Checks into Business Pages

### Production Page Example
```javascript
import { checkProductionReconciliation } from '@/lib/reconciliationHelpers';

const handleShiftEnd = async (shiftId) => {
  // Save shift data
  await saveShift(shiftData);

  // Run reconciliation check
  const mismatches = await checkProductionReconciliation(shiftId);
  
  if (mismatches.length > 0) {
    toast.warning(`${mismatches.length} reconciliation issue(s) detected`);
    // User can navigate to dashboard to investigate
  }
};
```

### Warehouse Page Example
```javascript
import { checkWarehouseReconciliation } from '@/lib/reconciliationHelpers';

const handleWarehouseClose = async (warehouseId) => {
  // Close warehouse
  await closeWarehouse(warehouseId);

  // Check stock vs pallet
  const mismatches = await checkWarehouseReconciliation(warehouseId);
  
  if (mismatches.length > 0) {
    // Flag for supervisor review
    showAlert('Reconciliation mismatches found - see Reconciliation Dashboard');
  }
};
```

### GRN Page Example
```javascript
import { checkGRNReconciliation } from '@/lib/reconciliationHelpers';

const handleGRNComplete = async (grnId) => {
  // Mark GRN complete
  await base44.entities.GRNHeader.update(grnId, { status: 'COMPLETED' });

  // Check received vs accepted/rejected
  const result = await checkGRNReconciliation(grnId);
  
  if (result.mismatch) {
    toast.warning('GRN reconciliation mismatch detected');
  }
};
```

### Manual Snapshot Creation
```javascript
import { createMismatchSnapshot } from '@/lib/reconciliationHelpers';

// When you detect a mismatch in custom logic
await createMismatchSnapshot({
  module: 'PRODUCTION',
  reconciliationType: 'planned_vs_produced',
  entityType: 'Batch',
  entityId: batch.id,
  entityCode: batch.batch_id,
  sku: batch.product,
  shiftId: currentShift.id,
  expectedValue: 1000,        // planned qty
  actualValue: 850,           // produced qty
  severity: 'high',
  details: {
    reason: 'Equipment downtime',
    downtime_minutes: 45,
  },
  remarks: 'Filler machine maintenance during shift',
});
```

## Reconciliation Snapshot Model

```javascript
{
  id: "rec_xxx",                          // Auto-generated
  snapshot_date: "2026-03-19",           // Date of check
  module: "PRODUCTION",                   // Module
  reconciliation_type: "planned_vs_produced",
  
  // Entity being checked
  entity_type: "Batch",
  entity_id: "batch_001",
  entity_code: "B001",
  sku: "PRODUCT_001",
  shift_id: "shift_20260319_A",
  warehouse_id: "WH_01",
  
  // The mismatch
  expected_value: 1000,
  actual_value: 850,
  difference: 150,
  variance_percent: 15.0,
  
  // Severity & status
  severity: "high",                       // critical/high/medium/low
  status: "open",                         // open/investigating/resolved/false_positive
  
  // Resolution tracking
  assigned_to: "supervisor@factory.local",
  assigned_to_name: "John Supervisor",
  root_cause: "Equipment downtime",
  corrective_action: "Maintenance performed",
  resolved_by: "supervisor@factory.local",
  resolved_at: "2026-03-19T14:30:00Z",
  
  // Details
  details: { /* custom data */ },
  notes: "Additional context",
  
  // Timestamps
  created_date: "2026-03-19T06:15:00Z",
  updated_date: "2026-03-19T14:30:00Z",
}
```

## Management vs Supervisor Views

### Admin/Manager View
- See all modules and all dates
- Drill down to transaction level
- Assign to supervisors/operators
- Track root causes and corrections
- Export reports for compliance

### Supervisor View
- See own module only
- Today's mismatches
- Quick status update buttons
- See assigned issues
- Add remarks

### Operator View
- Read-only (informational)
- See if own actions created issues
- Can add remarks to assigned issues

## Reconciliation Automation

**Setup (one-time):**
```
Menu → Admin → Automations
Create → Scheduled
Name: Daily Reconciliation
Function: calculateDailyReconciliation
Schedule: Every day at 6:00 AM
```

**Manual Run:**
Reconciliation Dashboard → Recalculate button

## Status Lifecycle

```
        ┌─────────────────┐
        │ Open (default)  │
        └────────┬────────┘
                 │
         ┌───────▼────────┐
         │ Investigating  │ (supervisor assigned, working on it)
         └───────┬────────┘
                 │
         ┌───────▼────────────────┐
         │                        │
    ┌────▼─────┐          ┌─────▼────┐
    │ Resolved │          │False Positive│
    └──────────┘          └────────────┘
```

- **Open:** Newly detected, not yet assigned
- **Investigating:** Supervisor assigned, working on root cause
- **Resolved:** Issue fixed, corrective action taken
- **False Positive:** Detected mismatch isn't actually an issue

## Exception Card Severity Colors

- **Critical (Red):** >20% variance, >0 failed syncs, GRN shortfall
  - Immediate supervisor escalation required
  - Production hold recommended

- **High (Orange):** >10% variance, >5 pending syncs, >10% label waste
  - Supervisor investigation needed within 2 hours
  - May continue production with caution

- **Medium (Yellow):** 5-10% variance
  - Supervisor review recommended
  - Document for end-of-shift analysis

- **Low (Blue):** <5% variance
  - Monitor and track
  - Include in daily report

## Export & Reporting

Reconciliation Dashboard → Export Mismatch Report
- **Format:** PDF (for compliance) or CSV (for analysis)
- **Includes:** Date, module, entity, expected, actual, variance, severity, status, root cause

## Real-World Examples

### Example 1: Production Variance

**Scenario:** Batch B001 planned 1000 liters, but only 850 liters produced.

1. Daily automation runs at 6 AM
2. Detects 15% variance
3. Creates ReconciliationSnapshot with severity=high
4. Dashboard shows card: "Planned vs Produced - B001"
5. Supervisor clicks card → sees details
6. Types root cause: "Filler machine downtime 45 min"
7. Updates status to "Investigating"
8. After equipment fix, marks "Resolved" with corrective action
9. System records resolution timestamp

### Example 2: Warehouse Stock Mismatch

**Scenario:** Pallet P001 should have 30 crates but only 25 are linked.

1. During day-end warehouse check
2. Manual call to checkWarehouseReconciliation()
3. Creates snapshot: severity=high (5 crate shortage)
4. Warehouse supervisor sees in dashboard
5. Investigates: finds 5 crates on wrong pallet
6. Moves crates to correct pallet
7. Marks snapshot as "Resolved"

### Example 3: Label Waste

**Scenario:** Print job issued 5000 labels, only 4200 used.

1. Print request marked completed
2. Consumption tracked: 4200 actual usage
3. System calculates 16% waste
4. Creates snapshot: severity=high
5. Labelling supervisor reviews
6. Notes: "Some labels damaged in roll"
7. Documents as resolved (acceptable waste level)

## Dashboard Integration

Add **ReconciliationWidget** to home/admin dashboard:

```javascript
import ReconciliationWidget from '@/components/dashboard/ReconciliationWidget';

export default function AdminDashboard() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <ReconciliationWidget />
      {/* other widgets */}
    </div>
  );
}
```

Widget shows:
- Critical count (red)
- High count (orange)
- "See details" link → Reconciliation Dashboard

---

## Key Files

- `entities/ReconciliationSnapshot.json` - Mismatch data model
- `functions/calculateDailyReconciliation.js` - Daily batch processor
- `pages/ReconciliationDashboard.jsx` - Main dashboard UI
- `components/reconciliation/MismatchCard.jsx` - Individual exception card
- `components/reconciliation/ReconciliationFilters.jsx` - Filter controls
- `components/dashboard/ReconciliationWidget.jsx` - Home dashboard widget
- `lib/reconciliationHelpers.js` - Helper functions for checks & snapshots

## Getting Started

1. **Setup Automation:**
   - Admin → Automations → Create Scheduled
   - Function: calculateDailyReconciliation
   - Schedule: Daily 6:00 AM

2. **View Dashboard:**
   - Go to Admin → Reconciliation Dashboard
   - Click "Recalculate" to run manually

3. **Integrate into Pages:**
   - Import helpers: `import { checkProductionReconciliation } from '@/lib/reconciliationHelpers'`
   - Call after significant actions
   - Mismatches appear in dashboard within minutes

4. **Resolve Issues:**
   - Click mismatch card to drill down
   - Assign to supervisor
   - Update root cause & corrective action
   - Mark as Resolved when complete