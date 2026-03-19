# Offline-First Sync Engine Guide

## Overview

K95 ERP now has a **factory-safe offline transaction engine** that:

- ✅ Queues transactions offline with idempotency keys
- ✅ Auto-syncs when online with exponential backoff retry
- ✅ Detects & resolves conflicts (stock, receiving, QC, etc.)
- ✅ Prevents duplicate transactions on reconnect
- ✅ Logs all sync operations to audit trail
- ✅ Provides Sync Center UI for monitoring & supervision
- ✅ Shows sync status on business records
- ✅ Handles critical transactions (marked for audit)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│ Business Page (e.g., Receiving, QC, Dispatch)       │
└────────────────────┬────────────────────────────────┘
                     ↓
        ┌────────────────────────────┐
        │ syncIntegration.js          │
        │ createTransaction()         │
        │ - Checks if online          │
        │ - Executes or queues        │
        └────────────────┬────────────┘
                         ↓
        ┌────────────────────────────┐
        │ offlineSyncEngine.js        │
        │ OfflineTransaction entity   │
        │ - Queue management          │
        │ - Idempotency checking      │
        │ - Conflict resolution       │
        │ - Retry logic               │
        └────────────────┬────────────┘
                         ↓
        ┌────────────────────────────┐
        │ Sync Center UI              │
        │ SyncCenter.jsx              │
        │ - Monitor pending/failed    │
        │ - Supervisor override       │
        │ - Manual sync trigger       │
        └────────────────────────────┘
                         ↓
        ┌────────────────────────────┐
        │ syncAudit.js               │
        │ - Audit trail logging      │
        │ - Compliance records       │
        └────────────────────────────┘
```

## Data Structure

Every transaction includes:

```javascript
{
  transaction_id: 'txn_1234567890_abc123',    // Unique ID
  idempotency_key: 'PROD_Crate_create_...',   // Prevents duplicates
  user_id: 'operator@factory.local',          // Who created it
  device_id: 'device_1234_...',               // Which device
  site_id: 'site_001',                        // Which factory
  module: 'PRODUCTION',                       // Business module
  entity_type: 'Crate',                       // What's being modified
  entity_id: 'crate_123',                     // ID (if known)
  action_type: 'create',                      // create/update/approve/scan
  payload: { ... },                           // Transaction data
  status: 'queued',                           // queued/processing/confirmed/failed/conflict
  created_at: '2026-03-19T10:30:00Z',
  synced_at: null,
  retry_count: 0,
  last_error: null,
  error_code: null,                           // NETWORK/VALIDATION/CONFLICT/TIMEOUT
  conflict_details: null,
  sync_result: null,
  is_critical: false                          // Flag for audit
}
```

## Using in Pages

### Basic Usage

```javascript
import { createTransaction } from '@/lib/syncIntegration';

// In your page/component
const handleCreateCrate = async (crateData) => {
  const result = await createTransaction({
    module: 'PRODUCTION',
    entityType: 'Crate',
    actionType: 'create',
    payload: crateData,
    isCritical: true,  // Mark for audit
  });

  if (result.offline) {
    toast.info(`Queued for sync: ${result.transactionId}`);
  } else if (result.success) {
    toast.success('Crate created');
  } else {
    toast.error(result.error);
  }
};
```

### Update Existing Record

```javascript
const result = await createTransaction({
  module: 'PRODUCTION',
  entityType: 'Crate',
  actionType: 'update',
  entityId: crateId,
  payload: { status: 'IN_CHAMBER' },
});
```

### Custom Action Handler

Register custom action handlers for complex workflows:

```javascript
import { registerActionHandler } from '@/lib/offlineSyncEngine';

// In app initialization
registerActionHandler('PRODUCTION', 'Crate', 'seal', async (transaction) => {
  // Custom logic for sealing crate
  const result = await base44.entities.Crate.update(transaction.entity_id, {
    status: 'SEALED',
    sealed_at: new Date().toISOString(),
    sealed_by: transaction.user_id,
  });
  
  return { sealed_id: result.id };
});

// Then use it:
await createTransaction({
  module: 'PRODUCTION',
  entityType: 'Crate',
  actionType: 'seal',
  entityId: crateId,
  payload: { reason: 'finished filling' },
});
```

## Show Sync Status on Records

### In Tables

```javascript
import { SyncStatusInline } from '@/components/wip/SyncStatusBadge';

<table>
  <tbody>
    {crates.map(crate => {
      const syncStatus = getSyncStatus(crate.id);
      return (
        <tr key={crate.id}>
          <td>{crate.crate_id}</td>
          <td>{crate.status}</td>
          <td>
            {syncStatus && (
              <SyncStatusInline 
                status={syncStatus.status}
                syncedAt={syncStatus.transaction?.synced_at}
              />
            )}
          </td>
        </tr>
      );
    })}
  </tbody>
</table>
```

### In Forms

```javascript
import SyncStatusBadge from '@/components/wip/SyncStatusBadge';

<div>
  <h2>Crate #{crateId}</h2>
  {syncStatus && (
    <SyncStatusBadge
      status={syncStatus.status}
      error={syncStatus.transaction?.last_error}
      retryCount={syncStatus.transaction?.retry_count}
      syncedAt={syncStatus.transaction?.synced_at}
    />
  )}
</div>
```

## Conflict Resolution

### Module-Specific Handlers

Conflicts are auto-detected for critical flows:

**Stock Movement**
- Issue: "Insufficient stock for movement"
- Resolution: Review current stock, adjust quantity, retry

**Receiving**
- Issue: "Item already received"
- Resolution: Verify item status, check for duplicates

**QC Status**
- Issue: "Invalid status transition"
- Resolution: Refresh item, resubmit with current state

**Crate Creation**
- Issue: "Crate ID already exists"
- Resolution: Generate new crate ID, retry

**Pallet Transfer**
- Issue: "Pallet locked or in use"
- Resolution: Wait for concurrent operation, retry

**Dispatch**
- Issue: "Invalid dispatch state"
- Resolution: Refresh dispatch, verify status, retry

### Supervisor Resolution

Go to **Admin → Sync Center** to:

1. View "Conflicts" tab
2. Click transaction to see details
3. Review conflict reason & local/server values
4. Add resolution notes (required)
5. Click "Resolve Conflict & Retry"

System re-queues transaction with supervisor override.

## Retry Logic

**Automatic Retry:**
- Transient errors (network, timeout): Auto-retry with backoff
- Retries: 0ms, 1s, 3s, 10s, 30s (exponential)
- Max retries: 3 times

**Manual Retry:**
- Failed transaction → Admin can manually retry from Sync Center
- Conflict transaction → Requires supervisor notes + resolution

**No Retry:**
- Validation errors (invalid data structure)
- Duplicate/conflict transactions (require supervisor)

## Monitoring & Debugging

### Sync Center Page

Navigate to **Admin → Sync Center**

Shows:
- **Stats:** Pending, Failed, Conflicts, Synced counts
- **Pending Tab:** Transactions waiting to sync
- **Failed Tab:** Transactions with permanent errors
- **Conflicts Tab:** Transactions requiring supervisor action
- **All Tab:** Complete transaction history

Actions:
- View transaction details (payload, error, conflict)
- Manually trigger sync (when online)
- Resolve conflicts (admin only)
- Clean up old transactions (30+ days)

### Check Record Sync Status

```javascript
import { getSyncStatus } from '@/lib/syncIntegration';

const status = getSyncStatus(crateId);
// Returns: { status: 'queued'|'processing'|'confirmed'|'failed'|'conflict', transaction: {...} }
```

### Auto-Sync on Reconnect

Auto-enabled. When connection restored:

```javascript
import { setupAutoSync } from '@/lib/syncIntegration';

// In App.jsx or main layout
useEffect(() => {
  return setupAutoSync();
}, []);
```

### Manual Sync Trigger

```javascript
import { syncPendingTransactions } from '@/lib/offlineSyncEngine';

const result = await syncPendingTransactions();
console.log(`Synced: ${result.synced}, Failed: ${result.failed}`);
```

## Audit Trail

Every transaction is logged to `AuditLog` entity:

- ✅ **Create:** Record created offline
- ✅ **Sync:** Successfully synced
- ✅ **Failure:** Sync failed with error
- ✅ **Conflict:** Conflict detected & details
- ✅ **Resolution:** Supervisor resolved & details

Access logs:
- **User:** Can see their own transactions
- **Admin:** Full audit trail in Audit Log page

## Critical Transactions

Mark transactions as critical for extra audit:

```javascript
await createTransaction({
  module: 'WAREHOUSE',
  entityType: 'StockMovement',
  actionType: 'create',
  payload: stockData,
  isCritical: true,  // Flagged for audit
});
```

Critical transactions get:
- ✅ Extra audit logging
- ✅ Highlighted in Sync Center
- ✅ Supervisor review requirement

## Best Practices

### ✅ DO

- Use `isCritical: true` for stock, receiving, dispatch, QC updates
- Check online status before offering sync UI
- Show sync badges on affected records
- Let user know when transaction is queued
- Use Sync Center for monitoring
- Review failed/conflict transactions immediately

### ❌ DON'T

- Don't assume online (check `navigator.onLine`)
- Don't allow duplicate actions on same record
- Don't ignore sync failures
- Don't delete OfflineTransaction records
- Don't bypass conflict resolution

## Example: Complete Receiving Workflow

```javascript
import { createTransaction, setupAutoSync } from '@/lib/syncIntegration';
import { getSyncStatus } from '@/lib/syncIntegration';
import SyncStatusBadge from '@/components/wip/SyncStatusBadge';

export default function GRNReceiveForm() {
  useEffect(() => setupAutoSync(), []);

  const handleReceive = async (itemData) => {
    const result = await createTransaction({
      module: 'GRN',
      entityType: 'GRNItem',
      actionType: 'update',
      entityId: itemData.id,
      payload: {
        status: 'RECEIVED',
        received_at: new Date().toISOString(),
        received_by: user.email,
      },
      isCritical: true,
    });

    if (result.offline) {
      toast.info(`Item ${itemData.id} marked for sync`);
    } else if (result.success) {
      toast.success('Item received');
    }

    // Show sync status
    const syncStatus = getSyncStatus(itemData.id);
    if (syncStatus) {
      return <SyncStatusBadge status={syncStatus.status} />;
    }
  };

  return (
    <form>
      {/* Form fields */}
      <button onClick={handleReceive}>
        Receive Item
      </button>
    </form>
  );
}
```

## Cleanup

Old synced transactions are auto-archived after 30 days.

Manual cleanup:
```javascript
import { cleanupOldTransactions } from '@/lib/offlineSyncEngine';

const deleted = cleanupOldTransactions(30);  // Delete >30 days old
console.log(`Cleaned up ${deleted} transactions`);
```

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Transaction not syncing | Still offline | Check network, Sync Center shows pending |
| Sync failures repeating | Network issue | Check error code, manual sync when online |
| Duplicate records | Idempotency failed | Check transaction ID in Sync Center |
| Conflict not resolving | Invalid resolution | Supervisor must review & provide notes |
| Status badge not showing | Record not queued | Check getSyncStatus() returns null |

---

**Key Files:**
- `lib/offlineSyncEngine.js` - Core transaction engine
- `lib/syncIntegration.js` - Page integration helper
- `lib/syncAudit.js` - Audit logging
- `pages/SyncCenter.jsx` - Monitoring UI
- `components/wip/SyncStatusBadge.jsx` - Status display
- `entities/OfflineTransaction.json` - Data model

**Last Updated:** 2026-03-19