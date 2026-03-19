# User Management Module

**Centralized Admin Control for Users, Roles & Permissions**

## Overview

The User Management module consolidates all user-related operations into one dedicated area:
- **Users** — Invite, deactivate, manage user accounts
- **Roles** — Define application roles and permissions
- **Permissions** — Control document-level and workflow access
- **Access Audit** — Track who accessed what and when

## Module Structure

```
USER_MANAGEMENT Module (Admin Only)
├── Users
│   ├── Invite new users
│   ├── Assign/change roles
│   ├── Deactivate accounts
│   └── View user list
├── Roles
│   ├── Create custom roles
│   ├── Define module access
│   ├── Set page-level access
│   └── View role permissions
├── Document Access
│   ├── Control who can view/edit/approve documents
│   ├── Set by workflow stage
│   └── Map to specific roles
├── Permission Policies
│   ├── Define action-level permissions
│   ├── Field-level restrictions
│   └── Workflow stage rules
└── Access Audit Log
    ├── See permission check failures
    ├── Find who was blocked
    └── Trace access patterns
```

## Pages in User Management

### 1. Users
**Route:** `/UserManagement`

**What it does:**
- View all registered users
- Invite new users to specific roles
- Change user roles
- See user registration date and role

**Features:**
- Search by name/email
- Filter by role
- Bulk role updates
- Invite form with role selector
- Last login indicator

**Actions:**
- Invite User → Email sent with login link
- Change Role → User gets new permissions immediately
- Deactivate → User cannot login (soft delete)

**Example Use Case:**
New production manager joins team:
1. Click "Invite User"
2. Enter email, select "Production Manager" role
3. System sends login link
4. User signs up and can access production pages immediately

### 2. Roles
**Route:** `/RoleManager`

**What it does:**
- Define application roles (production_manager, labelling_supervisor, etc.)
- Set which modules each role can access
- Optionally override individual page access
- See what roles exist and who has them

**Features:**
- Create custom roles (e.g., "Night Shift Supervisor")
- Module-based access (Production, Warehouse, Accounts)
- Fine-grained page overrides
- System roles (admin, user) cannot be deleted
- Inactive toggle

**Roles Included:**
```
System Roles:
- admin (full access, cannot edit)
- user (default role)

Operational Roles:
- production_manager, production_user
- labelling_supervisor, line_operator
- warehouse_ops, dispatch_officer
- purchase_manager, purchase_user
- accounts_manager, accounts_user
- qc_inspector, security_guard
- ... (customizable)
```

**Example Use Case:**
Create a new "Weekend Supervisor" role:
1. Click "Add Role"
2. Name: "Weekend Supervisor"
3. Select modules: Production, Labelling, Warehouse
4. Save
5. Assign users to this role

### 3. Document Access
**Route:** `/PermissionMatrix`

**What it does:**
- Control who can view/edit/approve specific documents
- Organized by document type and workflow stage
- Example: "Only purchase_manager can approve Purchase Orders in SUBMITTED stage"

**Features:**
- Search by document type
- Filter by role
- Set for each workflow stage (DRAFT, SUBMITTED, APPROVED, etc.)
- Permissions: Can View, Can Edit, Can Approve, Can Reject
- View/edit/create toggles

**Key Concept:**
Different roles have different access based on **stage**:
- DRAFT stage: creator can edit
- SUBMITTED stage: manager can approve
- APPROVED stage: read-only for most roles

**Example Use Case:**
Goods Receipt workflow:
- RECEIVED stage: store_receiver can edit, add QC notes
- QC_PENDING stage: qc_inspector can view/mark pass/fail
- APPROVED stage: warehouse_ops can move to putaway

### 4. Permission Policies
**Route:** `/PermissionPolicyManager`

**What it does:**
- Advanced permission rules (action-level, field-level)
- Define what actions a role can perform
- Example: "Only supervisors can override quality holds"
- Field-level restrictions

**Features:**
- Create policies per role
- Action permissions (create, update, delete, approve)
- Workflow stage restrictions
- Field visibility (who can see sensitive fields)
- System vs. custom policies

**Example Use Case:**
Only supervisor can create exception notes:
1. Open Permission Policies
2. Create policy for "supervisor" role
3. Action: "create_exception"
4. Entity: "SLAException"
5. Allowed Stages: [QC_PENDING, ON_HOLD]
6. Save

### 5. Access Audit Log
**Route:** `/AccessAuditLog`

**What it does:**
- See when access was DENIED
- Find blocked attempts
- Audit who tried to do what
- Compliance reporting

**Features:**
- Filter by user, action, date
- See why access was denied
- Show attempted action + required role
- Export for audit trail

**Example Use Case:**
Troubleshooting: "User can't see payment requests"
1. Go to Access Audit Log
2. Search for user email
3. Find "view_PaymentRequest → DENIED (requires accounts_manager)"
4. Check user's role → Fix it or update permission

## User Management Workflow

### Scenario: New Production Manager Joins

1. **Invite User** (`/UserManagement`)
   - Email: john@factory.com
   - Role: production_manager
   - System sends login link

2. **User Signs Up**
   - Sets password
   - Completes profile
   - Auto-assigned to production_manager role

3. **Access Granted** (Next Login)
   - Can see: Production, Labelling, Warehouse modules
   - Can access: ProductionControl, ProductionOrders, FillingStation, etc.
   - Cannot see: Accounts, Payment Requests, System Admin pages

4. **Later: Promote to Supervisor**
   - Admin changes role to: supervisor
   - Next login: NEW permissions take effect
   - Can now approve Purchase Orders

### Scenario: Restrict Document Access

**Goal:** Only directors can approve large Purchase Orders (> $10,000)

1. **Create Rule** (`/ApprovalRulesManager`)
   - Document type: PurchaseOrder
   - From stage: SUBMITTED
   - To stage: APPROVED
   - Allowed roles: director
   - Action: "Approve"

2. **Result:**
   - Manager sees "Approve" button but it's disabled (no permission)
   - Manager sees message: "Only directors can approve orders"
   - Director sees green "Approve" button

### Scenario: Audit Access Denial

**Goal:** Track failed access attempts for compliance

1. **Access Audit Log** (`/AccessAuditLog`)
   - Filter: User = john@factory.com, Date = Last 30 days
   - Result: Shows all DENIED attempts
   - Export to CSV for audit report

## Best Practices

### ✅ DO

1. **Create roles for teams, not individuals**
   - ✅ "shift_supervisor" (reusable)
   - ❌ "john_supervisor" (not reusable)

2. **Use module-level access first**
   - Assign via modules (Production, Warehouse)
   - Override specific pages only when needed

3. **Document your permission structure**
   - Keep a notes file of what each role does
   - Update when adding new roles

4. **Audit permission changes**
   - Review who has what monthly
   - Remove permissions not needed
   - Export access logs for compliance

5. **Use document stages for fine control**
   - Different roles at different stages
   - Example: creator at DRAFT, manager at SUBMITTED

### ❌ DON'T

1. **Don't create too many custom roles**
   - Stick to organizational structure
   - Avoid: "john_custom_role"

2. **Don't make everything admin-only**
   - Supervisors should approve their own items
   - Operators should see only their module

3. **Don't forget to deactivate old users**
   - When someone leaves, deactivate account
   - Don't delete (breaks audit trail)

4. **Don't manually grant access outside system**
   - Always use User Management module
   - Every permission change should be logged

5. **Don't set overly restrictive permissions**
   - If roles can't do their job, fix permission
   - Test permissions with actual user first

## Common Permission Patterns

### Pattern 1: Creator → Approver → Receiver

```
Document Stage Flow:
DRAFT          → SUBMITTED         → APPROVED       → COMPLETED
Creator: RW     Manager: RO, Approve  Receiver: RO    System: Archive

R = Read (view)
W = Write (edit)
RO = Read-only
```

### Pattern 2: Role-Based Workflow

```
Purchase Order Approval:
SUBMITTED:
  - purchase_user: can view (created it)
  - purchase_manager: can approve
  - director: can approve (large orders)

APPROVED:
  - vendor: can view (read-only)
  - store_receiver: can view
  - accounts: can view
```

### Pattern 3: Escalation Path

```
GRN Quality Hold:
NORMAL: qc_inspector (can release or reject)
ESCALATED (2+ days): qc_manager (can override)
CRITICAL (5+ days): director (force approve)
```

## Troubleshooting

### Issue: User can't see a page

**Solution:**
1. Go to `/PermissionMatrix`
2. Find document type user needs
3. Check allowed_roles for their role
4. If missing: Add their role to the permission rule
5. User gets access next login

### Issue: User can see page but can't edit

**Solution:**
1. Go to `/PermissionMatrix`
2. Check "can_edit" column for their role
3. If false: Update rule to enable edit
4. Or check document stage (might be locked)

### Issue: User was accidentally given admin role

**Solution:**
1. Go to `/UserManagement`
2. Find user in list
3. Change role back to original
4. Changes take effect immediately

### Issue: Need to see who accessed documents

**Solution:**
1. Go to `/AccessAuditLog`
2. Filter by user or document type
3. See all attempts (granted + denied)
4. Export to CSV for compliance

## API & Integration

### Check User Permissions (Code)

```javascript
import { canAccessPage } from '@/lib/permissionResolver';

const hasAccess = canAccessPage('PurchaseOps', user.role);
if (!hasAccess) {
  // Show error or redirect
}
```

### Check Document Access (Code)

```javascript
import { documentAccessHelper } from '@/lib/documentAccessHelper';

const canApprove = documentAccessHelper.canApproveDocument(
  'PurchaseOrder',
  user.role,
  'SUBMITTED'
);
```

### Log Access Denial (Code)

```javascript
import { base44 } from '@/api/base44Client';

await base44.entities.BlockedAttempt.create({
  rule_key: 'purchase_approval_denied',
  user_email: user.email,
  entity_type: 'PurchaseOrder',
  action_type: 'approve',
  error_message: 'Requires purchase_manager role',
});
```

## Checklist for New Project

- [ ] Define all roles needed
- [ ] Map roles to modules
- [ ] Create permission rules for each document type
- [ ] Test with actual users
- [ ] Document permission structure
- [ ] Set up monthly audit review
- [ ] Train admins on User Management pages
- [ ] Create backup admin user
- [ ] Test deactivate user flow
- [ ] Verify audit logs capture all changes

---

**Key Goal:** One place to manage everything user-related. Simple. Audited. Compliant.