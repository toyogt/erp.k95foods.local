# K95 ERP — System Architecture & Development Instructions

## 1. ROLE-BASED LAYOUT SYSTEM

### Role Categories
Every user role falls into **one** of three categories. This determines their UI layout automatically.

| Category | Roles | Layout | Use Case |
|---|---|---|---|
| **OPERATOR** | `filling_operator`, `chamber_operator`, `labelling_supervisor`, `warehouse_ops`, `line_operator`, `dispatch_officer`, `labelling_receiver`, `store_receiver`, `security_guard`, `pallet_builder`, `recipe_operator`, `qc_inspector`, `label_operator` | **App-like** (bottom nav, full-screen tiles, no sidebar) | Shop floor, mobile-first, task-focused |
| **MANAGER** | `admin`, `purchase_manager`, `production_manager`, `accounts_manager`, `process_controller`, `process_designer`, `label_supervisor` | **Sidebar** (left nav, multi-page views) | Office-based, workflow approval, reporting |
| **VIEWER** | `user` (generic role) | **Same as assigned role** | Read-only or user-determined |

### How It Works
In `Layout.jsx` / `Dashboard.jsx`:
```js
const user = await base44.auth.me();
const roleCategory = getRoleCategory(user.role); // OPERATOR | MANAGER | VIEWER

if (roleCategory === 'OPERATOR') {
  return <OperatorLayout user={user}>{children}</OperatorLayout>;
} else {
  return <SidebarLayout user={user}>{children}</SidebarLayout>;
}
```

### What Operators See
- **Home**: Big action tiles (Start Session, Receive Stock, Print Label, etc.)
- **Bottom Nav**: 3-5 main tasks (no module nesting)
- **No Sidebar**: Simple, distraction-free
- **Mobile-First**: Responsive, tap-friendly buttons

---

## 2. DOCUMENT-LEVEL ACCESS CONTROL

### Architecture
Instead of module-wide access, permissions are **document-specific** + **workflow-stage-specific**.

**Three levels of permission:**
1. **Document Type Access** — Can role see Purchase Orders? Can they see GRN?
2. **Workflow Stage Access** — Can role act on PO in DRAFT vs APPROVED state?
3. **Document Action Access** — Can role click "Approve" vs "Reject" vs "Send Back"?

### Entity: `DocumentAccessRule`
```json
{
  "doc_type": "PurchaseOrder",
  "workflow_stages": ["DRAFT", "SUBMITTED", "APPROVED"],
  "allowed_roles": ["purchase_manager", "admin"],
  "can_view": true,
  "can_edit": true,
  "can_create": true,
  "can_approve": false,
  "can_reject": false,
  "required_conditions": {}
}
```

### Entity: `DocumentApprovalRule` (Already Exists)
Already tracks **per-role actions per state transition**. Use this for "what buttons show".

### Implementation in Pages
```js
// Check access BEFORE rendering document
const canView = await checkDocumentAccess(user.role, 'PurchaseOrder', 'DRAFT');
if (!canView) return <Forbidden />;

// Show/hide actions based on approval rules
const rules = await base44.entities.DocumentApprovalRule.filter({
  doc_type: 'PurchaseOrder',
  from_state: po.status,
  allowed_roles: [user.role]
});
// Only show buttons that are in `rules`
```

---

## 3. UI CONSISTENCY & DESIGN TOKENS

### Color System (Tailwind + CSS Variables)
**Already defined in `index.css` & `tailwind.config.js`**. Use ONLY these:

#### Primary Colors
- `bg-primary` / `text-primary` → Slate-900 (buttons, active states)
- `bg-secondary` / `text-secondary` → Slate-600 (default text, borders)
- `bg-accent` / `text-accent` → Slate-100 (hover states, highlights)
- `bg-muted` / `text-muted` → Slate-400 (disabled, subtle text)

#### Status/Document Colors
- **Pending** → `bg-yellow-100 text-yellow-800`
- **Approved** → `bg-green-100 text-green-800`
- **Rejected** → `bg-red-100 text-red-800`
- **In Progress** → `bg-blue-100 text-blue-800`
- **Hold** → `bg-orange-100 text-orange-800`

**DO NOT** use custom hex colors (#ff0000). Always use Tailwind classes.

### Icons
- **Lucide React ONLY** — no emojis, no custom SVGs
- Common icons:
  - Actions: `Check`, `X`, `Plus`, `Edit2`, `Trash2`, `Download`, `Upload`
  - Status: `AlertCircle`, `CheckCircle2`, `Clock`, `Zap`, `AlertTriangle`
  - Navigation: `Menu`, `ChevronDown`, `ChevronRight`, `ArrowLeft`, `Home`
  - Entities: `Package`, `ShoppingCart`, `Warehouse`, `Factory`, `FileText`

### Typography
- **Headings**: `text-2xl font-bold` (pages), `text-lg font-semibold` (sections), `text-sm font-medium` (cards)
- **Body**: `text-sm` (default), `text-xs` (secondary)
- **Font**: Inter (already loaded in `index.css`)

### Button Sizes & Spacing
#### Desktop
- **Primary CTA**: `h-10 px-6` → 40px tall, comfortable tap
- **Secondary**: `h-9 px-4` → 36px tall
- **Small**: `h-8 px-3` → Icon buttons, quick actions

#### Mobile (ALL devices ≤ 768px)
- **Primary CTA**: `h-12 px-6` → 48px tall (thumb-friendly)
- **Secondary**: `h-10 px-4` → 40px tall
- Use `text-base` (16px) for form inputs (prevents auto-zoom on iOS)

**Implementation:**
```jsx
<button className="h-9 px-4 md:h-12 md:px-6 text-sm md:text-base">
  Action
</button>
```

### Cards & Spacing
- Card padding: `p-4` (mobile), `p-6` (desktop)
- Gap between items: `gap-3` (mobile), `gap-4` (desktop)
- Max width: `max-w-screen-2xl` (never wider on desktop)

### Forms
- Label: `text-sm font-medium mb-2`
- Input: `h-9 px-3` (desktop), `h-12 px-3` (mobile), `text-base` always
- Select/Dropdown: Same as input
- Error text: `text-xs text-red-600 mt-1`

---

## 4. FMS APP EVENTS & DOCUMENT LINKING

### Rule 1: Every Significant Action Needs an FMS Event
Actions that change state: approve, reject, receive, create, complete, etc.

**Step 1:** Check `lib/fmsAppEvents.js` for matching event key.
```js
// Example from fmsAppEvents.js
{
  key: 'po_approved',
  label: 'PO Approved',
  category: 'purchase',
  canTrigger: true,
  canComplete: true
}
```

**Step 2:** Wire the event at the point of completion.
```js
import { useFMSAutoComplete } from '@/lib/useFMSAutoComplete';

const { fireFMSEvent } = useFMSAutoComplete();

// Inside approval handler
await base44.entities.PurchaseOrder.update(po.id, { status: 'APPROVED' });
await fireFMSEvent('po_approved', po.id);
```

**Step 3:** If event doesn't exist, ADD it to `lib/fmsAppEvents.js`, then wire it.

### Rule 2: Document Linking (ref_chain)
When a new document is created FROM an existing one, link them.

**Example:** Purchase flow
```
PR created (id: pr_123)
  → PO created (id: po_456) — Link to PR
  → GRN created (id: grn_789) — Link to PO
  → Invoice (id: inv_999) — Link to GRN
```

**Implementation:**
```js
import { useFMSAutoComplete } from '@/lib/useFMSAutoComplete';

const { fireFMSEvent, linkFMSRef, triggerFMSProcess } = useFMSAutoComplete();

// Step 1: Create PR (start process)
const pr = await base44.entities.PurchaseRequest.create({...});
const instance = await triggerFMSProcess({
  trigger_source: 'purchase_request_created',
  triggerRefId: pr.id
});
// ref_chain = [pr.id]

// Step 2: Create PO from PR
const po = await base44.entities.PurchaseOrder.create({...});
await fireFMSEvent('po_created', pr.id); // Fire with SOURCE doc
await linkFMSRef(instance.id, po.id); // Add new doc to chain
// ref_chain = [pr.id, po.id]

// Step 3: Approve PO
await base44.entities.PurchaseOrder.update(po.id, { status: 'APPROVED' });
await fireFMSEvent('po_approved', po.id); // Fire with LATEST doc
// No new link needed (same doc)

// Step 4: Receive GRN
const grn = await base44.entities.GRNHeader.create({...});
await fireFMSEvent('grn_received', po.id); // Fire with SOURCE
await linkFMSRef(instance.id, grn.id); // Add new doc to chain
// ref_chain = [pr.id, po.id, grn.id]
```

**Golden Rule:** Every document created from another MUST be linked. Every approval/status change fires an event with the document's own ID (not newly created).

---

## 5. NEW PAGE / DOCUMENT CREATION CHECKLIST

When adding a new page or document entity, DO THIS IN ORDER:

### A. Entity Definition
- [ ] Create entity JSON in `entities/{DocumentName}.json`
- [ ] Include: name, type, description, properties (with descriptions), required array
- [ ] Consider audit fields: user_email, timestamp, status

### B. Routing (if new page)
- [ ] Add import at top of `App.jsx`
- [ ] Add explicit `<Route>` with `<LayoutWrapper>` (do NOT rely on pagesConfig loop)
- [ ] Test route is accessible

### C. Module Navigation (if new workflow)
- [ ] Add module/page to `components/nav/moduleConfig.js` with icon, role list
- [ ] Add entry to `MODULES` array with `key`, `label`, `pages[]`
- [ ] Test sidebar shows/hides based on user role

### D. FMS Events (if document changes state)
- [ ] Check `lib/fmsAppEvents.js` for matching events
- [ ] If missing, add entries: document_created, document_approved, document_rejected
- [ ] Wire `fireFMSEvent()` at each state transition point
- [ ] Wire `triggerFMSProcess()` if this is a trigger document

### E. Access Control (if multi-role)
- [ ] Add `DocumentAccessRule` or extend `AppRole.module_access`
- [ ] Check user role BEFORE rendering sensitive UI
- [ ] Show/hide actions based on `DocumentApprovalRule`

### F. Document Linking (if part of larger workflow)
- [ ] Identify the source document (PR, PO, etc.)
- [ ] On new document creation: call `linkFMSRef(instanceId, newDocId)`
- [ ] Fire event with SOURCE document ID, then link new document

### G. Audit Logging
- [ ] All create/update actions logged to `AuditLog` entity
- [ ] Include: action, entity_type, entity_id, user_email, user_name, details

### H. UI Implementation
- [ ] Use Lucide icons only (no emojis)
- [ ] Use design tokens from `index.css` (no custom colors)
- [ ] Mobile buttons: `h-12 px-6` (mobile), `h-9 px-4` (desktop)
- [ ] Form inputs: `text-base` always (iOS zoom prevention)
- [ ] Status badges: use color system (green=approved, red=rejected, yellow=pending)
- [ ] Cards: consistent padding, spacing, borders

### I. Testing
- [ ] Test as admin (full access)
- [ ] Test as manager (restricted actions)
- [ ] Test as operator (operator layout, action buttons)
- [ ] Test mobile (button sizes, responsive layout)
- [ ] Test FMS event fires correctly

---

## 6. MOBILE VS DESKTOP RESPONSIVE DESIGN

### Breakpoints
- `md:` (768px+) → Desktop layout
- No prefix → Mobile-first (default mobile)

### Navigation
- **Mobile**: Bottom nav or full-screen overlay (no sidebar)
- **Desktop**: Sidebar (always visible or collapsible)

### Buttons
```jsx
{/* Primary action */}
<button className="h-12 px-6 md:h-10 md:px-6">Save</button>

{/* Secondary */}
<button className="h-10 px-4 md:h-9 md:px-4">Cancel</button>

{/* Form inputs */}
<input className="h-12 px-3 md:h-9 md:px-3 text-base" />
```

### Layout
```jsx
{/* Mobile: stack, Desktop: grid */}
<div className="flex flex-col gap-3 md:grid md:grid-cols-3 md:gap-4">
  {/* items */}
</div>
```

### Typography
- Mobile text is slightly larger (readability on small screens)
- Use `text-sm md:text-base` for body text
- Headings stay the same size (already large enough)

---

## 7. NAMING & TERMINOLOGY

### Do NOT use abbreviations
- ❌ btl, btls, qty, pcs, grn, pr, po
- ✅ bottle, bottles, quantity, pieces, goods receipt, purchase request, purchase order

### Document Naming
- Entity: `PurchaseRequest`, `PurchaseOrder`, `GRNHeader`, `SupplierInvoice`, `PaymentRequest`
- Status: `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `COMPLETED`, `ON_HOLD`
- Never: `PR`, `PO`, `GRN` (use full names in UI)

---

## 8. QUICK REFERENCE: WHAT TO DO WHEN...

| Scenario | Steps |
|---|---|
| **Add new document type** | 1. Create entity 2. Add to RoleManager 3. Create FMS events 4. Wire approval rules 5. Build UI page with access checks |
| **Add new role** | 1. Create in UserManagement 2. Assign module access 3. Map to document access rules 4. Test with FMS |
| **Build new page** | 1. Check FMS events exist 2. Create component/page 3. Add explicit route to App.jsx 4. Add to moduleConfig 5. Follow checklist #5 |
| **Change user permissions** | 1. Update AppRole.module_access 2. Update DocumentAccessRule 3. Re-assign DocumentApprovalRule 4. Test in RoleManager view |
| **Add status to document** | 1. Update entity enum 2. Add FMS events for transitions 3. Add approval rules 4. Update status badge colors 5. Test workflow |
| **Mobile issue** | 1. Check button: h-12 px-6 (mobile), h-9 px-4 (md:) 2. Check input: text-base always 3. Check layout: flex md:grid 4. Test on real phone (not just browser) |

---

## Summary
- **Roles** → Determine layout (operator vs manager)
- **Documents** → Have access rules + approval rules
- **FMS** → Tracks state changes + document relationships
- **UI** → Consistent colors, icons, buttons, typography
- **Mobile** → Bigger buttons, readable text, responsive layout
- **New anything** → Follow the 8-point checklist, wire FMS, link documents