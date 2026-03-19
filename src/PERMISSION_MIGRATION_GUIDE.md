# Permission System Migration Guide

**Status:** Active Migration (Old and New Systems Coexist)

## What Changed

| Aspect | Before | After |
|--------|--------|-------|
| Source of truth | Hardcoded `ACCESS_MAP` in `components/roles/index.js` | `PermissionPolicy` entity in database |
| Page access | `canAccess(user, page)` | `canAccessPage(user, page)` via resolver |
| Module gating | Hardcoded module lists | Database-driven module assignment |
| Admin config | Scattered UI pages | Single `PermissionPolicyManager` |
| Caching | None | 5-minute policy cache |
| Audit | Manual logging | Automatic via `AuditLog` entity |

## Migration Phases

### Phase 1: Data Migration (Done)
- ✅ Created `PermissionPolicy` entity
- ✅ Created `permissionResolver.js` service
- ✅ Created admin UI to configure policies

### Phase 2: Route Guard Transition (In Progress)
- ✅ Updated `layout.jsx` to use resolver
- ⬜ Replace `getAllowedPagesFromDB` with `canAccessPage`

### Phase 3: Component Updates (Backlog)
- ⬜ Replace all `user.role === 'admin'` checks
- ⬜ Replace action button permission checks
- ⬜ Replace sidebar visibility logic

### Phase 4: Legacy Removal (Future)
- ⬜ Remove `components/roles/index.js`
- ⬜ Remove `lib/roleLayoutMap.js` (merge into policies)
- ⬜ Archive old permission entities

---

## Step-by-Step Migration

### For Existing Pages

**Before:**
```javascript
// Old: Hardcoded role check
if (user?.role === 'admin' || user?.role === 'production_manager') {
  return <AdminDashboard />;
}
```

**After:**
```javascript
// New: Use resolver
import { canAccessPage } from '@/lib/permissionResolver';

const [canAccess, setCanAccess] = useState(false);

useEffect(() => {
  canAccessPage(user, 'Dashboard').then(setCanAccess);
}, [user]);

if (!canAccess) return <AccessDenied />;
return <Dashboard />;
```

### For Action Buttons

**Before:**
```javascript
// Old: Check user role
const canApprove = user?.role === 'purchase_manager' || user?.role === 'admin';

<Button disabled={!canApprove}>Approve</Button>
```

**After:**
```javascript
// New: Use resolver
import { canPerformAction } from '@/lib/permissionResolver';

const [canApprove, setCanApprove] = useState(false);

useEffect(() => {
  canPerformAction(user, 'approve_po', 'PurchaseOrder', document.status)
    .then(setCanApprove);
}, [user, document.status]);

<Button disabled={!canApprove}>Approve</Button>
```

### For Sidebar Visibility

**Before:**
```javascript
// Old: Check hardcoded ACCESS_MAP
const visiblePages = ACCESS_MAP[user.role] || [];
```

**After:**
```javascript
// New: Use moduleConfig derived from policies
import { getVisiblePages } from '@/components/nav/moduleConfig';

const visiblePages = getVisiblePages(activeModule, user);
```

---

## Admin Configuration

### Setting Up a Role's Permissions

1. **Go to:** Admin Menu → Permission Policy Manager
2. **Create policy for role:**
   - Select role (or enter custom role_key)
   - Check required modules (PRODUCTION, WAREHOUSE, etc.)
   - (Optional) Add page overrides for non-standard access
   - (Optional) Add action permissions for fine-grained control
3. **Save** → Automatic cache flush

### Example: Production Manager

```
Role: production_manager
Modules: [PRODUCTION, WAREHOUSE]
Page Overrides: none
Action Permissions: [
  { action_key: "create_batch", entity_type: "Batch", allow: true },
  { action_key: "approve_batch", entity_type: "Batch", allow: true }
]
```

---

## Testing the New System

### Enable Debug Panel
As admin, look for **🔐 Permission Debug** in bottom-right.
Click to expand and verify:
- Your role
- Assigned modules
- Granted pages
- Any overrides

### Test Page Access
1. Login as test user
2. Try navigating to pages
3. Check debug panel to see why access is allowed/denied

### Test Actions
1. Open a page with restricted actions
2. Check if buttons appear/disappear based on policies
3. Verify debug panel shows action permissions

---

## Troubleshooting

### User Can't See Page But Should

1. Open PermissionPolicyManager
2. Find user's role policy
3. Check if module is assigned
4. If not in module, add page override: `page_key: "PageName"`, `allow: true`

### Button Not Appearing

1. Check PermissionDebugPanel for action_permissions
2. Verify action_key matches code
3. Check workflow_stages match document status

### Cache Issues

Call `clearPermissionCache()` in browser console to force reload.

---

## Deprecation Timeline

| Date | Action |
|------|--------|
| Now | New system live, old system still works |
| Mar 2026 | Mark old checks as `DEPRECATED` |
| May 2026 | Remove old hardcoded ACCESS_MAP |
| Jul 2026 | Full legacy cleanup |

---

## FAQ

**Q: Can I still use `user.role === 'admin'`?**  
A: Yes, but not recommended. Use `canAccessPage()` or `canAccessModule()` instead.

**Q: What if I have custom logic?**  
A: Add to `PermissionPolicy.action_permissions` or contact admin to extend resolver.

**Q: How do I debug permission issues?**  
A: Use the Permission Debug Panel (bottom-right for admins) to see exact permissions.

**Q: Can I migrate gradually?**  
A: Yes. Both systems coexist. Migrate page by page.

**Q: What about audit logging?**  
A: All permission changes auto-logged in `AuditLog` entity. View in Access Audit Log page.

---

## Support

For permission-related issues:
1. Check PermissionDebugPanel
2. Review UNIFIED_PERMISSION_ARCHITECTURE.md
3. Check Access Audit Log for recent changes
4. Contact admin to adjust PermissionPolicy

---

**Last Updated:** 2026-03-19