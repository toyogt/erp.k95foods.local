# Unified Permission Architecture

## Overview

K95 ERP now uses a **single source of truth** for all access control. All permission checks—modules, pages, actions, approvals, and fields—flow through `permissionResolver.js`.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│         Permission Policy (Database Entity)                  │
│  - role_key                                                  │
│  - module_access (modules granted to role)                   │
│  - page_overrides (explicit page allow/deny)                 │
│  - action_permissions (fine-grained actions)                 │
│  - field_restrictions (field-level view/edit)                │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│    Permission Resolver (lib/permissionResolver.js)           │
│  - Cached policy loading                                     │
│  - Module access checks                                      │
│  - Page access checks (module-derived + overrides)           │
│  - Action permission checks                                  │
│  - Field-level checks (view/edit)                            │
└─────────────────────────────────────────────────────────────┘
                           ↓
         ┌─────────────────┬─────────────────┐
         ↓                 ↓                 ↓
    Route Guards      UI Components     Permission Debug
    (Layout.jsx)    (Buttons, Forms)    (Admin Panel)
```

## Key Files

| File | Purpose |
|------|---------|
| `entities/PermissionPolicy.json` | Schema for storing policies |
| `lib/permissionResolver.js` | Core resolver with caching |
| `lib/usePermissions.js` | React hook for components |
| `pages/PermissionPolicyManager.jsx` | Admin UI to manage policies |
| `components/admin/PermissionPolicyForm.jsx` | Policy editor form |
| `components/admin/PermissionDebugPanel.jsx` | Super admin debug panel |
| `layout.jsx` | Route guard using resolver |

## Usage Patterns

### Check Module Access
```javascript
import { canAccessModule } from '@/lib/permissionResolver';

const canView = await canAccessModule(user, 'PRODUCTION');
```

### Check Page Access
```javascript
import { canAccessPage } from '@/lib/permissionResolver';

const canView = await canAccessPage(user, 'Dashboard');
```

### Check Action Permission
```javascript
import { canPerformAction } from '@/lib/permissionResolver';

const canApprove = await canPerformAction(
  user,
  'approve_purchase_order',
  'PurchaseOrder',
  'SUBMITTED'
);
```

### React Hook
```javascript
import { usePermissions } from '@/lib/usePermissions';

export default function MyComponent() {
  const user = useAuth();
  const perms = usePermissions(user);

  const handleAction = async () => {
    const allowed = await perms.canPerformAction('create_order', 'Order', 'DRAFT');
    if (allowed) {
      // proceed
    }
  };
}
```

## Permission Hierarchy

```
1. Role
   └─ 2. Module Access (PRODUCTION, WAREHOUSE, PURCHASE, GRN, etc.)
       └─ 3. Page Access (derived from module, or explicit override)
           └─ 4. Action Permissions (fine-grained create/edit/approve/reject)
               └─ 5. Field Restrictions (view/edit specific fields)
```

**Flow:**
1. Admin assigns role → role has module access
2. Modules determine which pages are visible
3. Pages contain actions (buttons)
4. Each action checked against permission policy
5. Field-level: certain fields only viewable/editable for specific roles

## Migration from Legacy System

### Step 1: Create PermissionPolicy Records
Run script to convert existing AppRole + DocumentAccessRule:

```javascript
// Migration: AppRole → PermissionPolicy
const appRole = { role_key: 'production_manager', module_access: ['PRODUCTION'] };
const policy = {
  role_key: appRole.role_key,
  module_access: appRole.module_access,
  page_overrides: [],
  action_permissions: [],
  field_restrictions: [],
  is_active: true,
};
await base44.entities.PermissionPolicy.create(policy);
```

### Step 2: Replace Hardcoded Checks

**BEFORE (❌ Old):**
```javascript
if (user?.role === 'admin' || user?.role === 'production_manager') {
  return <Approved />;
}
```

**AFTER (✅ New):**
```javascript
import { canAccessPage } from '@/lib/permissionResolver';

if (await canAccessPage(user, 'ProductionControl')) {
  return <Approved />;
}
```

### Step 3: Update Components to Use Resolver
Replace all `user.role ===` checks with resolver calls.

### Step 4: Enable Debug Panel
Super admin sees permission debug in bottom-right corner:
- Current user info
- Granted modules
- Page overrides
- Action permissions

## Admin Flow

1. Go to **Permission Policy Manager**
2. Select role to configure
3. Assign modules (e.g., PRODUCTION, WAREHOUSE)
4. (Optional) Add page overrides for non-standard access
5. (Optional) Add fine-grained action permissions
6. (Optional) Add field restrictions
7. Save → Cache cleared automatically

## Audit Logging

Every permission change is logged:
```
Action: "permission_change"
Entity: "PermissionPolicy"
User: admin@company.com
Details: { role_key: "production_manager", changes: [...] }
```

See **Access Audit Log** page to view all permission changes.

## Backward Compatibility

During transition:
- `AppRole.module_access` still works (fallback)
- `DocumentAccessRule` still evaluated (but PermissionPolicy takes precedence)
- Legacy `user.role ===` checks still function but **discouraged**

Mark deprecated checks with:
```javascript
// DEPRECATED: Use permissionResolver instead
if (user?.role === 'admin') { ... }
```

## Performance

- **Caching:** Policies cached for 5 minutes per role
- **Cache invalidation:** Automatic on policy change
- **Database queries:** Minimized via cache
- **No N+1 queries:** Single policy load per role per TTL

## Debug Panel (Super Admin Only)

Shows:
- Logged-in user email, role, name
- Assigned modules
- Page overrides (allow/deny)
- Copy to clipboard: Full debug JSON

Appears bottom-right on all pages if user is admin.

## Common Scenarios

### Scenario 1: Give Operator Access to New Page
1. Open PermissionPolicyManager
2. Edit `filling_operator` policy
3. Add page override: `page_key: "NewReport"`, `allow: true`
4. Save

### Scenario 2: Restrict Field from Edit
1. Edit policy for `qc_inspector`
2. Add field restriction: `entity_type: "BatchData"`, `field_name: "final_verdict"`, `can_edit: false`
3. Save

### Scenario 3: Module-Level Access
1. Create policy for `warehouse_supervisor`
2. Select modules: `WAREHOUSE`, `GRN`
3. All pages under those modules auto-allowed
4. Save

## Checklist for New Features

When adding new pages/actions:

- [ ] Identify required module(s)
- [ ] Assign to PermissionPolicy via admin UI
- [ ] Import and call resolver in component
- [ ] Test with different roles via debug panel
- [ ] Add audit log if permission-related action
- [ ] Document expected role in feature README

---

**Last Updated:** 2026-03-19  
**Stable:** ✅ Yes  
**Replaces:** AppRole access_map, hardcoded role checks, scattered approval logic