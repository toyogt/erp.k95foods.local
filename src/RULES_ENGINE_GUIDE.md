# Transaction Rules Engine Guide

## Overview

A **factory-safe rules engine** that prevents impossible or invalid operational transactions by validating every critical action before execution.

**Benefits:**
- ✅ **Prevents costly mistakes** - No duplicate receipts, orphaned stock, or invalid status changes
- ✅ **Operationally clear** - Error messages explain why actions are blocked in business language
- ✅ **Supervisor overrides** - Authorized personnel can override with mandatory reason codes
- ✅ **Audit trail** - Every blocked attempt and override is logged for reconciliation analysis
- ✅ **Configurable** - Add/modify rules without changing page logic

## Architecture

```
┌─────────────────────────────────────┐
│ Business Page                        │
│ (Dispatch, Receive, Approve, etc.)   │
└────────────────┬────────────────────┘
                 ↓
┌────────────────────────────────────┐
│ useTransactionValidation Hook       │
│ - Initialize user/device            │
│ - Call validate() before action     │
│ - Show RuleBlockDialog if blocked   │
│ - Handle supervisor override        │
└────────────────┬───────────────────┘
                 ↓
┌────────────────────────────────────┐
│ rulesEngine.js                      │
│ - Load rules from RulesConfig       │
│ - Match applicable rules            │
│ - Evaluate module validators        │
│ - Return blocks/warnings            │
└────────────────┬───────────────────┘
                 ↓
┌────────────────────────────────────┐
│ Module Validators                   │
│ - Warehouse (stock, locks)          │
│ - Production (status, approval)     │
│ - GRN (tolerance, duplicates)       │
│ - Labelling (revision match)        │
│ - Accounts (QC hold)                │
└────────────────┬───────────────────┘
                 ↓
┌────────────────────────────────────┐
│ Entities                            │
│ - RulesConfig (rule definitions)    │
│ - BlockedAttempt (audit log)        │
└────────────────────────────────────┘
```

## Core Concepts

### Rule Structure

Every rule defines:

```javascript
{
  rule_key: 'DISPATCH_STOCK_CHECK',       // Unique identifier
  module: 'WAREHOUSE',                     // WAREHOUSE, PRODUCTION, GRN, LABELLING, ACCOUNTS
  entity_type: 'Dispatch',                 // What entity is validated
  action_type: 'create',                   // When to validate (create, update, dispatch, approve, etc.)
  rule_name: 'Dispatch Stock Availability',// Human readable
  validation_type: 'stock_availability',   // Category (stock_availability, status_requirement, etc.)
  error_message: 'Cannot dispatch...',     // User-friendly block message
  allow_override: true,                    // Can supervisors override?
  override_roles: ['warehouse_ops', 'admin'],  // Who can override
  reason_codes: [{                         // Mandatory reasons for override
    code: 'STOCK_IN_TRANSIT',
    label: 'Stock in transit, verified via supplier'
  }],
  severity: 'block',                       // 'block' = prevents action, 'warning' = allows with warning
  is_active: true,
  sort_order: 10                           // Evaluation order
}
```

### Validation Types

| Type | Use Case | Examples |
|------|----------|----------|
| `stock_availability` | Check inventory levels | Dispatch, stock movement |
| `status_requirement` | Validate current state | Pallet must be approved |
| `approval_requirement` | Require approval | Cannot dispatch until approved |
| `data_consistency` | Match related fields | Artwork revision = label revision |
| `lock_status` | Check entity is unlocked | Cannot reassign locked crate |
| `reference_integrity` | Verify related records exist | GRN item still exists |
| `tolerance_limit` | Check within bounds | GRN quantity ≤ tolerance |
| `custom` | Module-specific logic | Complex multi-field checks |

### Blocked Attempt Audit

Every blocked action creates a `BlockedAttempt` record:

```javascript
{
  attempt_id: 'attempt_1234567890_abc123',
  rule_key: 'DISPATCH_STOCK_CHECK',
  module: 'WAREHOUSE',
  entity_type: 'Dispatch',
  entity_id: 'disp_001',
  action_type: 'create',
  user_email: 'operator@factory.local',
  device_id: 'device_123...',
  error_message: 'Cannot dispatch. Required stock not available.',
  payload: { /* attempted data */ },
  validation_details: { /* technical info */ },
  block_status: 'blocked',  // or 'overridden', 'escalated'
  override_by: 'supervisor@factory.local',
  override_reason_code: 'STOCK_IN_TRANSIT',
  override_comment: 'Supplier confirmed stock arrival tomorrow',
  override_at: '2026-03-19T10:30:00Z',
}
```

## Using in Pages

### Step 1: Initialize Hook

```javascript
import { useTransactionValidation } from '@/hooks/useTransactionValidation';
import RuleBlockDialog from '@/components/rules/RuleBlockDialog';

export default function DispatchPage() {
  const {
    initializeValidation,
    validate,
    validation,
    blockDialogOpen,
    setBlockDialogOpen,
    attemptId,
    onOverride,
    getOverride,
    user,
  } = useTransactionValidation();

  useEffect(() => {
    initializeValidation();
  }, [initializeValidation]);
```

### Step 2: Validate Before Action

```javascript
const handleCreateDispatch = async (dispatchData) => {
  // Validate transaction
  const { canProceed, validation, attemptId } = await validate({
    module: 'WAREHOUSE',
    entityType: 'Dispatch',
    actionType: 'create',
    payload: dispatchData,
  });

  if (!canProceed) {
    // Block dialog will show automatically
    return;
  }

  // Check if override occurred
  const override = getOverride();
  
  // Proceed with creation
  try {
    const result = await base44.entities.Dispatch.create({
      ...dispatchData,
      override_reason: override?.reasonCode,
      override_comment: override?.comment,
    });

    toast.success('Dispatch created');
  } catch (error) {
    toast.error(error.message);
  }
};
```

### Step 3: Render Block Dialog

```javascript
return (
  <>
    {/* Your page content */}
    <button onClick={handleCreateDispatch}>Create Dispatch</button>

    {/* Block dialog shows automatically when blocked */}
    <RuleBlockDialog
      isOpen={blockDialogOpen}
      blocks={validation?.blocks || []}
      warnings={validation?.warnings || []}
      user={user}
      attemptId={attemptId}
      onDismiss={() => setBlockDialogOpen(false)}
      onOverride={onOverride}
    />
  </>
);
```

## Complete Example: Dispatch Page

```javascript
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useTransactionValidation } from '@/hooks/useTransactionValidation';
import RuleBlockDialog from '@/components/rules/RuleBlockDialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function DispatchPage() {
  const [dispatch, setDispatch] = useState({
    item_code: '',
    quantity: 0,
    location_id: '',
  });

  const {
    initializeValidation,
    validate,
    validation,
    blockDialogOpen,
    setBlockDialogOpen,
    attemptId,
    onOverride,
    getOverride,
    user,
  } = useTransactionValidation();

  useEffect(() => {
    initializeValidation();
  }, [initializeValidation]);

  const handleDispatch = async () => {
    // 1. Validate
    const { canProceed } = await validate({
      module: 'WAREHOUSE',
      entityType: 'Dispatch',
      actionType: 'create',
      payload: dispatch,
    });

    if (!canProceed) return;

    // 2. Check for override
    const override = getOverride();

    // 3. Create dispatch (with override info if overridden)
    try {
      await base44.entities.Dispatch.create({
        ...dispatch,
        ...(override && {
          override_reason_code: override.reasonCode,
          override_comment: override.comment,
        }),
      });

      toast.success('Dispatch created successfully');
      setDispatch({ item_code: '', quantity: 0, location_id: '' });
    } catch (error) {
      toast.error(`Failed: ${error.message}`);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Create Dispatch</h1>

      <div className="space-y-3 mb-6">
        <input
          type="text"
          placeholder="Item Code"
          value={dispatch.item_code}
          onChange={e => setDispatch({ ...dispatch, item_code: e.target.value })}
          className="w-full px-3 py-2 border rounded"
        />
        <input
          type="number"
          placeholder="Quantity"
          value={dispatch.quantity}
          onChange={e => setDispatch({ ...dispatch, quantity: parseInt(e.target.value) })}
          className="w-full px-3 py-2 border rounded"
        />
        <input
          type="text"
          placeholder="Location ID"
          value={dispatch.location_id}
          onChange={e => setDispatch({ ...dispatch, location_id: e.target.value })}
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      <Button onClick={handleDispatch} className="w-full mb-4">
        Create Dispatch
      </Button>

      {/* Block dialog (shown automatically) */}
      <RuleBlockDialog
        isOpen={blockDialogOpen}
        blocks={validation?.blocks || []}
        warnings={validation?.warnings || []}
        user={user}
        attemptId={attemptId}
        onDismiss={() => setBlockDialogOpen(false)}
        onOverride={onOverride}
      />
    </div>
  );
}
```

## Admin Pages

### Rules Manager
**Path:** Admin → Rules Manager

**Features:**
- View all active/inactive rules
- Create new rules (with validation type specific config)
- Edit existing rules
- Activate/deactivate rules
- Delete rules (will be removed from future evaluations)

**Use When:**
- Setting up new validation requirements
- Adjusting tolerance limits, approved statuses, etc.
- Disabling rules during exception periods

### Blocked Attempts Viewer
**Path:** Admin → Blocked Attempts

**Features:**
- View all blocked transaction attempts
- Filter by status (blocked, overridden, escalated)
- See why action was blocked (error message + technical details)
- Review supervisor overrides (who approved, reason, comment)
- See original payload that was attempted

**Use When:**
- Analyzing operational issues ("Why can't we dispatch?")
- Reviewing supervisor overrides for audit
- Identifying patterns in blocked attempts
- Training operators on rules

## Adding New Rules

### 1. Define Rule in RulesConfig

Go to **Admin → Rules Manager** → **Add Rule**

Fill in:
- **Rule Key:** Unique identifier (e.g., `MY_NEW_CHECK`)
- **Module:** Where it applies
- **Entity Type:** What's being validated
- **Action Type:** When to check (create, approve, receive, etc.)
- **Validation Type:** Category of check
- **Rule Name:** Display name
- **Error Message:** User-friendly block reason
- **Allow Override:** Can supervisors override?
- **Override Roles:** Who can override
- **Reason Codes:** Options for "why" overriding

### 2. Add Validator Function (If Complex)

For complex logic, add a validator in `lib/rulesEngine.js`:

```javascript
function getWarehouseValidator(type) {
  const validators = {
    my_custom_type: async (rule, context) => {
      const { payload, currentData } = context;
      
      // Your validation logic
      const isValid = checkSomeCondition(payload, currentData);
      
      return {
        valid: isValid,
        details: { explanation: 'why it failed' },
      };
    },
  };
  return validators[type];
}
```

### 3. Configure via Rules Manager

Use the admin UI to configure the rule without code changes.

## Default Rules Included

The system ships with these core factory rules:

**Warehouse:**
- Dispatch Stock Check - Prevent dispatch if stock unavailable
- Location Lock Check - Prevent movement from locked locations

**Production:**
- Pallet Approval Check - Require manager approval before dispatch
- Pallet Fully Built - Cannot close incomplete pallets
- Crate Lock Check - Cannot reassign crate in closed pallet

**GRN:**
- Tolerance Limit - Quantity must be within tolerance
- Duplicate Receive - Prevent receiving same GRN item twice

**Labelling:**
- Artwork Revision Match - Artwork ≠ label revision warning

**Accounts:**
- QC Hold Stock Block - Cannot issue stock on QC hold

See `functions/seedDefaultRules.js` to initialize these.

## Reason Codes

Standard reason codes for all overrides:

| Code | Label | Use When |
|------|-------|----------|
| `EMERGENCY` | Emergency / Critical Issue | Production emergency requires immediate action |
| `QUALITY_CHECK` | Manual Quality Check Passed | Manual verification confirms it's safe |
| `DOCUMENTED_EXCEPTION` | Documented Exception Approved | Management pre-approved this exception |
| `SYSTEM_CORRECTION` | System Data Correction | Correcting system data error |
| `SUPPLIER_AGREEMENT` | Supplier Agreement / Contract | Covered by contract terms |

Rule-specific codes (per rule) are also supported.

## Best Practices

### ✅ DO

- Use clear, non-technical error messages
- Include reason codes for common override scenarios
- Mark critical overrides in audit (is_critical: true)
- Review blocked attempts regularly for patterns
- Add rules before problems occur
- Use warnings for informational blocks
- Let operators know why they're blocked

### ❌ DON'T

- Block without allowing override (unless truly impossible)
- Use abbreviations (QC, PO, SKU) in error messages
- Make rules too strict (causes frustration)
- Delete rules without archiving
- Ignore patterns of blocked attempts
- Skip logging overrides

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Rule not blocking | Rule is inactive | Check Rules Manager, verify is_active=true |
| Wrong error message | Bad rule message | Edit rule, update error_message |
| Cannot override | No override role | Add user role to override_roles |
| Multiple blocks shown | Multiple rules matched | Review validation details in BlockedAttempts |
| Rule cache stale | Cached rules need refresh | invalidateRulesCache() called after rule change |

## API Reference

### validateTransaction()

```javascript
const result = await validateTransaction({
  module: 'WAREHOUSE',
  entityType: 'Dispatch',
  actionType: 'create',
  entityId: null,
  payload: { item_code: 'ABC123', qty: 10 },
  currentData: {},
  user,
  device,
});

// result = {
//   valid: false,
//   blocks: [
//     {
//       ruleKey: 'DISPATCH_STOCK_CHECK',
//       ruleName: 'Dispatch Stock Availability',
//       errorMessage: 'Cannot dispatch...',
//       allowOverride: true,
//       overrideRoles: ['warehouse_ops', 'admin'],
//       reasonCodes: [...]
//     }
//   ],
//   warnings: [],
//   totalRulesChecked: 5
// }
```

### logBlockedAttempt()

```javascript
const attemptId = await logBlockedAttempt({
  ruleKey: 'DISPATCH_STOCK_CHECK',
  module: 'WAREHOUSE',
  entityType: 'Dispatch',
  entityId: 'disp_001',
  actionType: 'create',
  user,
  device,
  errorMessage: 'Cannot dispatch...',
  payload,
  validationDetails,
});
```

### recordOverride()

```javascript
await recordOverride(attemptId, {
  supervisorEmail: 'supervisor@factory.local',
  supervisorName: 'John Manager',
  reasonCode: 'STOCK_IN_TRANSIT',
  comment: 'Supplier confirmed delivery tomorrow.',
});
```

---

**Files:**
- `lib/rulesEngine.js` - Core engine
- `hooks/useTransactionValidation.js` - Hook for pages
- `components/rules/RuleBlockDialog.jsx` - Block UI
- `pages/RulesManager.jsx` - Admin rule config
- `pages/BlockedAttemptsViewer.jsx` - Admin audit view
- `entities/RulesConfig.json` - Rule definitions
- `entities/BlockedAttempt.json` - Audit log
- `functions/seedDefaultRules.js` - Initialize default rules

**Next Steps:**
1. Call `seedDefaultRules` function to initialize core rules
2. Review rules in Rules Manager
3. Add validation to critical pages (Dispatch, Receive, Approve)
4. Monitor BlockedAttempts for patterns
5. Refine rules based on operational feedback