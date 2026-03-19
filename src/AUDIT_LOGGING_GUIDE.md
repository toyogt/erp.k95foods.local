# Audit Logging & Status Registry Guide

**Standardized Audit Trail for Root-Cause Analysis**

## Overview

The audit logging system provides:
- **Central Status Registry** — Single source of truth for all statuses
- **Reason Code Registry** — Standardized codes for why actions occur
- **Structured Audit Logs** — Complete audit trail with before/after states
- **Searchable Audit Viewer** — Admin tool for investigation & compliance

## 1. Status Registry

### Purpose
Replace hardcoded status strings with centralized registry.

### Available Status Categories

```javascript
import { STATUS_REGISTRY, getStatus, getStatusLabel, getStatusColor } from '@/lib/statusRegistry';

// DOCUMENT — PO, GRN, Invoice, etc.
STATUS_REGISTRY.DOCUMENT.DRAFT
STATUS_REGISTRY.DOCUMENT.SUBMITTED
STATUS_REGISTRY.DOCUMENT.APPROVED
STATUS_REGISTRY.DOCUMENT.REJECTED
STATUS_REGISTRY.DOCUMENT.IN_PROGRESS
STATUS_REGISTRY.DOCUMENT.COMPLETED
STATUS_REGISTRY.DOCUMENT.CANCELLED
STATUS_REGISTRY.DOCUMENT.ON_HOLD

// STOCK — Inventory states
STATUS_REGISTRY.STOCK.AVAILABLE
STATUS_REGISTRY.STOCK.RESERVED
STATUS_REGISTRY.STOCK.IN_TRANSIT
STATUS_REGISTRY.STOCK.QUARANTINE
STATUS_REGISTRY.STOCK.REJECTED
STATUS_REGISTRY.STOCK.CONSUMED

// BATCH — Production batches
STATUS_REGISTRY.BATCH.PLANNED
STATUS_REGISTRY.BATCH.IN_PROGRESS
STATUS_REGISTRY.BATCH.FILLING_COMPLETE
STATUS_REGISTRY.BATCH.QC_PENDING
STATUS_REGISTRY.BATCH.APPROVED
STATUS_REGISTRY.BATCH.REJECTED

// PALLET, TRANSFER, QC, APPROVAL, CRATE — See registry file
```

### Usage in Components

```jsx
import { getStatusLabel, getStatusColor } from '@/lib/statusRegistry';

function StatusDisplay({ status }) {
  return (
    <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor('BATCH', status)}`}>
      {getStatusLabel('BATCH', status)}
    </span>
  );
}
```

### Usage in Business Logic

```javascript
import { getStatus, isValidStatusTransition } from '@/lib/statusRegistry';

// Validate status transitions
if (!isValidStatusTransition('BATCH', oldStatus, newStatus)) {
  throw new Error(`Cannot transition from ${oldStatus} to ${newStatus}`);
}

// Get status metadata
const status = getStatus('PALLET', 'IN_CHAMBER');
console.log(status.label);  // "In Chamber"
console.log(status.color);  // "blue"
console.log(status.sequence); // 2
```

## 2. Reason Code Registry

### Purpose
Standardize WHY an action occurred for root-cause analysis.

### Available Reason Code Categories

```javascript
import { REASON_CODE_REGISTRY, getReasonCode, getReasonCodesByCategory } from '@/lib/reasonCodeRegistry';

// Stock adjustments
REASON_CODE_REGISTRY.STOCK_ADJUSTMENT.PHYSICAL_COUNT
REASON_CODE_REGISTRY.STOCK_ADJUSTMENT.SPILLAGE
REASON_CODE_REGISTRY.STOCK_ADJUSTMENT.SYSTEM_ERROR
REASON_CODE_REGISTRY.STOCK_ADJUSTMENT.TRANSFER_VARIANCE

// Rework reasons
REASON_CODE_REGISTRY.REWORK.QUALITY_ISSUE
REASON_CODE_REGISTRY.REWORK.LABELLING_ERROR
REASON_CODE_REGISTRY.REWORK.BATCH_MIX_UP

// Rejection reasons
REASON_CODE_REGISTRY.REJECTION.FAILED_QC
REASON_CODE_REGISTRY.REJECTION.OUT_OF_SPEC
REASON_CODE_REGISTRY.REJECTION.CONTAMINATION

// Relabelling, Reprinting, Override, Short Receipt, Dispatch Variance
// See lib/reasonCodeRegistry.js for full list
```

### Mandatory Reason Codes

For critical actions, reason code is **MANDATORY**:

```javascript
import { isReasonCodeMandatory } from '@/lib/reasonCodeRegistry';

// Critical actions: create, update, delete, adjust, reject, override on critical entities
isReasonCodeMandatory('adjustment', 'StockBalance') // true
isReasonCodeMandatory('update', 'Batch') // true
isReasonCodeMandatory('create', 'Pallet') // true
```

## 3. Audit Log Schema

### Fields

```javascript
{
  audit_id: string,              // Unique ID
  action: string,                // "create Dispatch", "update Batch", etc.
  action_type: enum,             // create|update|delete|approve|reject|adjustment|override
  module: string,                // WAREHOUSE, PRODUCTION, QC, PURCHASE, etc.
  entity_type: string,           // Batch, Dispatch, Pallet, GRNHeader, etc.
  entity_id: string,             // Record ID
  entity_code: string,           // User-friendly code
  before_state: object,          // State before action (key fields only)
  after_state: object,           // State after action
  reason_code: string,           // Standardized reason code
  reason_text: string,           // Free-text note
  actor_email: string,           // User who performed action
  actor_name: string,            // User display name
  actor_role: string,            // User role (admin, supervisor, etc.)
  device_id: string,             // Device/station identifier
  session_id: string,            // User session ID
  transaction_id: string,        // Idempotency key
  is_offline: boolean,           // Was action offline?
  synced_at: datetime,           // When offline action synced
  ip_address: string,            // Client IP
  affected_records: array,       // Other records affected
  fms_event_id: string,          // Associated FMS event
  trace_event_id: string,        // Associated trace event
  criticality: enum,             // info|warning|critical|security
  tags: array,                   // Search tags
  notes: string,                 // Internal investigation notes
  created_date: datetime,        // Timestamp (auto)
}
```

## 4. Logging Actions

### Basic Audit Log

```javascript
import { logAudit } from '@/lib/auditLogEngine';

await logAudit({
  actionType: 'create',
  module: 'WAREHOUSE',
  entityType: 'Dispatch',
  entityId: dispatch.id,
  entityCode: dispatch.dispatch_no,
  reasonCode: 'PARTIAL_DISPATCH',
  reasonText: 'Stock unavailable for full order',
  user,
  device: 'mobile',
  criticality: 'info',
});
```

### State Change Log (Automatic Before/After)

```javascript
import { logStateChange } from '@/lib/auditLogEngine';

const oldBatch = {...};
const newBatch = {...};

await logStateChange({
  entityType: 'Batch',
  entityId: batch.id,
  entityCode: batch.batch_id,
  before: oldBatch,
  after: newBatch,
  module: 'PRODUCTION',
  user,
  reasonCode: 'QC_RELEASE',
  criticality: 'info',
});
// Automatically extracts only changed fields
```

### Approval Log

```javascript
import { logApproval } from '@/lib/auditLogEngine';

await logApproval({
  documentType: 'GRNHeader',
  documentId: grn.id,
  documentCode: grn.grn_no,
  approved: true,
  user,
  reasonCode: 'SUPERVISOR_APPROVAL',
  reasonText: 'Quality verified, ready to receive',
});
```

### Critical Exception Log

```javascript
import { logCriticalException } from '@/lib/auditLogEngine';

try {
  await processDispatch(dispatch);
} catch (error) {
  await logCriticalException({
    module: 'WAREHOUSE',
    entityType: 'Dispatch',
    entityId: dispatch.id,
    error,
    reasonCode: 'SYSTEM_ERROR',
    user,
    context: { stockChecked: false },
  });
}
```

## 5. Integration into Action Hooks

### Using withAudit Wrapper

```javascript
import { withAudit } from '@/lib/auditIntegration';

const completeDispatch = async (dispatchId, user, reasonCode, reasonText) => {
  const result = await withAudit(
    () => base44.entities.Dispatch.update(dispatchId, { status: 'COMPLETED' }),
    {
      entityType: 'Dispatch',
      entityId: dispatchId,
      module: 'WAREHOUSE',
      actionType: 'update',
      user,
      reasonCode,
      reasonText,
      criticality: 'info',
    }
  );
  return result;
};
```

### Using Audit Logger

```javascript
import { createAuditLogger } from '@/lib/auditIntegration';

function useDispatchActions(onSuccess) {
  const auditLogger = createAuditLogger('WAREHOUSE', 'Dispatch');

  const createDispatch = async (dispatchData, user, reasonCode, reasonText) => {
    const dispatch = await base44.entities.Dispatch.create(dispatchData);
    
    // Log the creation
    await auditLogger.logCreate(dispatch, user, reasonCode, reasonText);
    
    onSuccess?.();
    return dispatch;
  };

  const updateDispatchStatus = async (dispatch, newStatus, user, reasonCode, reasonText) => {
    const oldDispatch = {...dispatch};
    const updated = await base44.entities.Dispatch.update(dispatch.id, { status: newStatus });
    
    // Log the status change
    await auditLogger.logStatusChange(dispatch, dispatch.status, newStatus, user, reasonCode, reasonText);
    
    return updated;
  };

  const approveDispatch = async (dispatch, user, reasonCode, reasonText) => {
    await base44.entities.Dispatch.update(dispatch.id, { status: 'APPROVED' });
    await auditLogger.logApproval(dispatch, true, user, reasonCode, reasonText);
  };

  return { createDispatch, updateDispatchStatus, approveDispatch };
}
```

## 6. AuditLogForm Component

Use this component to capture reason code + notes for critical actions:

```jsx
import AuditLogForm from '@/components/common/AuditLogForm';

function DispatchModal({ dispatch, onComplete }) {
  const [showForm, setShowForm] = useState(false);

  const handleDispatch = async ({ reasonCode, reasonText }) => {
    await dispatchTransfer(dispatch.id, reasonCode, reasonText);
    onComplete();
  };

  if (showForm) {
    return (
      <AuditLogForm
        actionType="dispatch"
        entityType="Dispatch"
        onSubmit={handleDispatch}
        onCancel={() => setShowForm(false)}
      />
    );
  }

  return (
    <Button onClick={() => setShowForm(true)}>
      Complete Dispatch
    </Button>
  );
}
```

## 7. Searching Audit Logs

### Global Search

```javascript
import { searchAuditLogs } from '@/lib/auditLogEngine';

const logs = await searchAuditLogs({
  module: 'WAREHOUSE',
  actionType: 'adjustment',
  criticality: 'critical',
  fromDate: new Date('2024-01-01'),
  toDate: new Date('2024-01-31'),
  limit: 100,
});
```

### Entity Audit Trail

```javascript
import { getEntityAuditTrail } from '@/lib/auditLogEngine';

// Get complete history of a specific record
const trail = await getEntityAuditTrail('Dispatch', 'dispatch_123');

// Shows all actions on that dispatch:
// - Created
// - Status updated
// - Approved
// - Completed
```

## 8. Audit Log Viewer (Admin Page)

**Route:** `/AuditLogViewer`

### Features

- **Global Search** — Filter by module, action, criticality, actor, date range
- **Entity Audit Trail** — Trace complete history of a record
- **Expand Details** — View before/after states, notes, device info
- **Export CSV** — Download audit logs for compliance

### Admin-Only Access

```javascript
// Enforced in page load
if (user?.role !== 'admin') {
  base44.auth.logout();
}
```

## 9. Best Practices

### ✅ DO

1. **Always use reason codes** for critical actions
2. **Log state transitions** using `logStateChange` to auto-capture changes
3. **Include device_id** for better traceability (mobile, station, web)
4. **Use appropriate criticality** (critical for exceptions, info for normal)
5. **Tag for search** — add tags like 'rework', 'exception', 'override'
6. **Link to FMS events** — include `fms_event_id` for workflow traceability
7. **Capture before state** for delete operations

### ❌ DON'T

1. **Skip reason codes** for critical actions — system validates
2. **Store PII in audit logs** — use email, not full address
3. **Log free-text only** — always include a reason code
4. **Modify audit logs** — they're immutable by design
5. **Forget to set criticality** — helps sort by importance

## 10. Root-Cause Analysis Workflow

### Example: Stock Discrepancy

1. **Find the exception** in ReconciliationDashboard
   - Pallet PALLET_123 missing 100 bottles

2. **Open Audit Log Viewer**
   - Search Entity Audit Trail → Pallet → PALLET_123

3. **Review complete history**
   - Created: 100 bottles
   - Received: 90 bottles (reason: DAMAGED_IN_TRANSIT)
   - Adjustment: -10 bottles (reason: SPILLAGE, notes: "Cleanroom spill")

4. **Root cause identified**
   - Actual loss: 10 bottles from spillage (recorded)
   - System matches: 90 bottles remaining
   - **No discrepancy — audit trail is complete**

### Example: Unauthorized Override

1. Find critical action in Audit Viewer
2. Filter criticality = 'critical', action = 'override'
3. Review who performed action + reason code
4. Check FMS event link if present
5. Investigate with supervisor

## 11. Integration Checklist

- [ ] Import status registry for all status displays
- [ ] Replace hardcoded status strings with registry
- [ ] Add reason code selector for critical actions
- [ ] Integrate audit logging into action hooks
- [ ] Test mandatory reason code validation
- [ ] Add timestamps to all audit entries
- [ ] Link FMS events to audit logs
- [ ] Test audit viewer search
- [ ] Verify admin-only access
- [ ] Document custom reason codes if added

---

**Next:** Run audit analysis on historical data to identify patterns and process improvements.