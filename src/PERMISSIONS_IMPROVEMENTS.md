# Permission System Improvements

## Overview
We've made the permission system much more user-friendly by replacing text-based inputs with smart dropdowns and added page-level access management to roles.

---

## 1. **Permission Policy Manager - Improved UI**

### Before ❌
- Required knowing `role_key` → Had to guess or type manually
- Required `page_key` → Free-text field, error-prone
- Required `action_key` → Confusing, no suggestions
- Required `entity_type` → No autocomplete

### After ✅
- **Role Selector**: Dropdown showing all active roles with labels (e.g., "Purchase Manager")
- **Page Dropdown**: Shows all available pages with titles (e.g., "Goods Receipt" instead of "GRNReceive")
- **Action Dropdown**: Pre-defined actions (Create, Edit, Delete, Approve, Receive, Dispatch, Cancel)
- **Entity Dropdown**: Pre-defined entities (Batch, Crate, Pallet, PurchaseOrder, etc.)

### Smart Validation
- Catches missing selections before saving
- Shows helpful error messages

---

## 2. **Role Manager - Page-Level Access Control**

### New Feature: Per-Page Access in Roles

#### What It Does
Each role now has a **hierarchical access model**:
```
Module (e.g., PURCHASE)
  └── Pages in that module (e.g., PurchaseOps, Suppliers)
    └── Individual pages can be allowed/denied per role
```

#### How It Works in UI
1. **Select Module** → Checkbox to include module
2. **Expand Module** → Shows all pages in that module
3. **Select Pages** → Choose which specific pages the role can access
4. **Default**: If module is granted, all its pages are allowed (unless explicitly removed)

#### Use Cases
- **Example 1**: Grant `purchase_manager` the PURCHASE module but deny access to "Suppliers" page
- **Example 2**: Allow `production_manager` PRODUCTION module with all pages except sensitive "Recipe Builder"

#### Display
- Role cards show module count
- Shows "X custom page access overrides" if any pages were restricted

---

## 3. **Default Behavior (No Policy = Deny)**

### What Happens if NO Permission Policy is Created for a Role?
✅ **Secure Default**: Users with that role CANNOT perform any actions unless explicitly granted

### Key Scenarios
| Scenario | Result |
|----------|--------|
| Role exists, but NO policy | Default DENY ❌ |
| Policy exists, policy allows action | ALLOW ✅ |
| Policy exists, policy denies action | DENY ❌ |
| Admin role | ALLOW (always) ✅ |

### Example
```
Role: "store_receiver"
- Module PURCHASE: Granted in role ✅
- Module GRN: Granted in role ✅
- Page "Putaway" in GRN: Denied in page_access ❌

Result:
- Can access Purchase module → YES
- Can access GRN module → YES
- Can access Putaway page → NO (explicitly denied)
- Can create PurchaseOrder → Check Permission Policy:
  - If policy doesn't exist → NO (default deny)
  - If policy allows "Create" on "PurchaseOrder" → YES
```

---

## 4. **Three-Tier Permission Model**

```
┌─────────────────────────────────────────────────┐
│ TIER 1: Module + Page Access (Visibility)       │
│ - AppRole.module_access                         │
│ - AppRole.page_access (optional overrides)      │
│ → Controls what pages user sees in navigation   │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│ TIER 2: Document Type Access Rules              │
│ - DocumentAccessRule entity                     │
│ → Controls who can View/Edit/Delete by          │
│    document type and workflow status            │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│ TIER 3: Action-Level Permissions                │
│ - PermissionPolicy.action_permissions           │
│ → Controls if role can Create/Edit/Approve on   │
│    specific entities                            │
└─────────────────────────────────────────────────┘
```

---

## 5. **Common Questions**

### Q: What does "Page Access Override" mean?
A: Pages normally inherit visibility from their module. A page override explicitly allows or denies a page even if the module is granted.

### Q: Do I need to configure page overrides?
A: No. Default behavior is: if module is granted, all pages in that module are visible.

### Q: What if a user's role doesn't have a policy?
A: They get restricted access. Default is DENY for any action unless explicitly allowed.

### Q: Where do I manage approval workflows?
A: In **User Management → Approval Rules** and **User Management → Approval Workflow Hub**. These control document state transitions per role.

### Q: Why use dropdowns instead of free text?
A: Dropdowns prevent typos, show available options, and make onboarding new admins easier. You no longer need to know internal keys!

---

## 6. **Summary of Changes**

| Component | Change |
|-----------|--------|
| `PermissionPolicyForm` | ✅ Role dropdown, Page dropdown, Action dropdown, Entity dropdown |
| `RoleManager` | ✅ Added page-level access UI with expandable modules |
| `AppRole` entity | ✅ Already had `page_access` field (used for overrides) |
| `PermissionPolicyManager` | ✅ Added default behavior explanation |
| Validation | ✅ Improved error messages for selection completeness |

---

## 7. **Best Practices**

1. **Start Simple**: Only create policies for roles that need special restrictions
2. **Use Module Access First**: Assign modules, then use page overrides only when needed
3. **Audit Regularly**: Check audit logs when permissions change
4. **Document Decisions**: Note why certain pages are restricted
5. **Test Access**: After creating policies, test access as that role

---

## Next Steps

- Create sample policies for key roles (purchase_manager, store_receiver, etc.)
- Test page-level access with different roles
- Add permission policy templates for common scenarios