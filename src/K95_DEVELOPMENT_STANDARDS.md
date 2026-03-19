# K95 ERP Development Standards & AI Instructions

**Last Updated:** 2026-03-19  
**Purpose:** Ensure all future development aligns with K95 architecture, UX standards, and business logic requirements.

---

## Part 1: ARCHITECTURE & CODE STANDARDS

### 1.1 Project Structure
```
src/
├── pages/              (Full-page views)
├── components/         (Reusable UI components)
│   ├── ui/            (shadcn/ui base components)
│   ├── fms/           (FMS-specific components)
│   ├── layouts/       (Layout wrappers)
│   └── [domain]/      (Purchase, GRN, Quality, etc.)
├── lib/               (Utilities, helpers, business logic)
├── functions/         (Backend Deno functions)
├── entities/          (Database schemas - JSON)
├── agents/            (AI agents config)
└── hooks/             (Custom React hooks)
```

### 1.2 Code Quality Rules
- **NO spaghetti code**: Break components into smaller, focused files (max 300 lines per component)
- **SINGLE RESPONSIBILITY**: Each component/function does one thing well
- **REUSABILITY**: Build small, configurable components that can be used across pages
- **NO DUPLICATION**: Extract repeated patterns into utilities or components
- **DOCUMENTATION**: Comment complex logic; explain "why" not "what"
- **TYPE SAFETY**: Use proper types even in JS (JSDoc or TypeScript)

### 1.3 File Naming
- Pages: `PascalCase` (e.g., `PurchaseOps.jsx`)
- Components: `PascalCase` (e.g., `POForm.jsx`)
- Utilities: `camelCase` (e.g., `useFMSAutoComplete.js`)
- Entities: `PascalCase` (e.g., `entities/PurchaseOrder.json`)
- Functions: `camelCase` (e.g., `functions/createLiquidPlan.js`)

### 1.4 Import Organization
```javascript
// 1. React & Core
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';

// 2. Base44 SDK
import { base44 } from '@/api/base44Client';

// 3. UI Components
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';

// 4. Custom Components
import POForm from '@/components/purchase/POForm';

// 5. Utilities
import { fireFMSEvent, linkFMSRef } from '@/lib/useFMSAutoComplete';
import { cn } from '@/lib/utils';

// 6. Icons (Lucide)
import { Plus, Pencil, Trash2 } from 'lucide-react';
```

---

## Part 2: FMS (PROCESS FLOW MANAGEMENT) INTEGRATION

### 2.1 Event Registry Rule
**MANDATORY**: `lib/fmsAppEvents.js` is the single source of truth for all events.

When building any feature that performs significant action (create, approve, receive, complete):

1. **Check** `lib/fmsAppEvents.js` for matching event
2. **If exists**: Use it immediately with `fireFMSEvent('event_key', recordId)`
3. **If missing**: ADD new entry to `fmsAppEvents.js` with:
   ```javascript
   {
     key: 'purchase_order_approved',
     label: 'Purchase Order Approved',
     category: 'PURCHASE',
     canTrigger: false,      // Can this start a process?
     canComplete: true,      // Can this complete a step?
     description: 'Triggered when PO is approved'
   }
   ```
   Then wire up `fireFMSEvent('purchase_order_approved', po.id)`

### 2.2 Document Linking (ref_chain) Rule
**MANDATORY**: Every document created from another must be linked to its FMS process instance.

When creating Document B from Document A:
```javascript
// Step 1: Create new document
const newDoc = await base44.entities.DocTypeB.create(data);

// Step 2: Fire event using SOURCE doc ID (already in chain)
await fireFMSEvent('docb_created', documentA.id);

// Step 3: Find FMS instance that owns source doc
const instances = await findFMSInstanceByRef(documentA.id);

// Step 4: Link new doc to that instance's ref_chain
for (const inst of instances) {
  await linkFMSRef(inst.id, newDoc.id);
}
```

**Chain Example** (Purchase workflow):
```
PR created           → triggerFMSProcess({triggerRefId: pr.id})
                       ref_chain = [pr.id]
↓
PO created from PR   → fireFMSEvent('po_created', pr.id)
                     → linkFMSRef(instanceId, po.id)
                       ref_chain = [pr.id, po.id]
↓
PO approved          → fireFMSEvent('po_approved', po.id)  ← Use NEW doc now
                       ref_chain unchanged
↓
GRN received from PO → fireFMSEvent('grn_received', po.id)
                     → linkFMSRef(instanceId, grn.id)
                       ref_chain = [pr.id, po.id, grn.id]
↓
QC approved          → fireFMSEvent('qc_approved', grn.id)  ← Use latest doc
                       ref_chain unchanged
↓
Invoice matched      → fireFMSEvent('invoice_matched', grn.id)
                     → linkFMSRef(instanceId, invoice.id)
                       ref_chain = [pr.id, po.id, grn.id, invoice.id]
```

**Key Rule**: Always pass the document that's ALREADY in the chain when firing events. Only use new doc ID after linking it.

### 2.3 Imports Required
```javascript
import { 
  fireFMSEvent, 
  findFMSInstanceByRef, 
  linkFMSRef, 
  triggerFMSProcess 
} from '@/lib/useFMSAutoComplete';
```

---

## Part 3: PERMISSION & ACCESS CONTROL

### 3.1 Three-Tier Permission System
```
Module Level (Coarse)
├── RoleManager → AppRole.module_access = ['PURCHASE', 'GRN', 'QUALITY']

Entity Level (Medium)
├── PermissionMatrix → DocumentAccessRule
│   e.g., "purchase_manager" can CREATE but not DELETE PurchaseOrder

Workflow Level (Fine)
├── ApprovalRulesManager → DocumentApprovalRule
    e.g., "purchase_manager" can APPROVE PO but not REJECT
```

### 3.2 When to Check Permissions
- **Page-level**: Check user role on page load
- **Entity CRUD**: Check DocumentAccessRule before showing create/edit/delete buttons
- **Workflow actions**: Check DocumentApprovalRule + require_reason before allowing transition
- **Admin pages**: Always verify `user.role === 'admin'`

### 3.3 Permission Check Pattern
```javascript
const canViewDoc = accessRule?.can_view;
const canCreateDoc = accessRule?.can_create;
const canApprove = approvalRule?.allowed_roles.includes(user.role);

if (!canViewDoc) {
  return <div className="text-center py-12 text-slate-500">Access Denied</div>;
}
```

---

## Part 4: STANDARD UI DESIGN SYSTEM

### 4.1 Color Palette
**Primary**: `text-slate-900` / `bg-slate-900` (Dark navy-gray)
**Secondary**: `text-slate-600` / `bg-slate-100` (Medium gray)
**Muted**: `text-slate-500` / `text-slate-400` (Light gray text)
**Accents**:
- Success: `bg-green-100 text-green-700`
- Danger: `bg-red-100 text-red-700`
- Warning: `bg-amber-100 text-amber-700`
- Info: `bg-blue-100 text-blue-800`

### 4.2 Typography
```css
/* Defined in index.css & tailwind.config.js */
--font-inter: 'Inter', sans-serif;

/* Usage in components */
font-family: var(--font-inter);

/* Tailwind classes */
text-xs      → 12px, line-height 1rem
text-sm      → 14px, line-height 1.25rem
text-base    → 16px, line-height 1.5rem
text-lg      → 18px, line-height 1.75rem
text-xl      → 20px, line-height 1.75rem
text-2xl     → 24px, line-height 2rem
```

**DO**:
- Use `font-semibold` for headings
- Use `font-medium` for labels
- Use `font-mono` only for IDs, codes, serial numbers

**DON'T**:
- Use `font-light` (too hard to read)
- Mix fonts within a page
- Use ALL CAPS except for badges/labels

### 4.3 Spacing (Tailwind Scale)
```
px/py-2  → 0.5rem (8px)  - Tight spacing, labels
px/py-3  → 0.75rem (12px) - Normal spacing, list items
px/py-4  → 1rem (16px)    - Standard spacing, cards
py-6     → 1.5rem (24px)  - Section spacing
py-8     → 2rem (32px)    - Major section gap
py-12    → 3rem (48px)    - Large spacing, empty states
```

### 4.4 Buttons
```jsx
// Primary action (Save, Create, Approve)
<Button className="bg-slate-900 text-white hover:bg-slate-800">
  Save
</Button>

// Secondary action (Cancel, Clear)
<Button variant="outline" className="border-slate-200">
  Cancel
</Button>

// Destructive (Delete, Reject)
<Button className="bg-red-100 text-red-700 hover:bg-red-200">
  Delete
</Button>

// Mobile: Minimum height 44px (touch-friendly)
<Button className="h-11 text-base">Mobile Button</Button>
```

**Mobile Button Rules** (CRITICAL):
- Minimum height: `h-11` (44px) for touch targets
- Minimum width: `w-full` or `min-w-max`
- Padding: `px-4 py-3` for comfortable tapping
- Font size: `text-sm` or `text-base` (NOT `text-xs`)
- Gap between buttons: `gap-2` minimum

### 4.5 Cards & Borders
```jsx
// Standard card
<div className="border border-slate-200 rounded-lg bg-white p-4">
  Content
</div>

// Card with header
<div className="border border-slate-200 rounded-lg bg-white">
  <div className="border-b border-slate-100 p-4 font-semibold text-slate-900">
    Header
  </div>
  <div className="p-4">Content</div>
</div>

// Hover state
className="hover:shadow-md hover:border-slate-300 transition-all"
```

### 4.6 Forms
```jsx
<div className="space-y-3">
  <div>
    <Label className="text-xs font-medium text-slate-700">Field Label</Label>
    <Input className="h-9 text-sm mt-1" placeholder="Enter value" />
  </div>
  
  <div>
    <Label className="text-xs font-medium text-slate-700">Select</Label>
    <select className="w-full h-9 border border-slate-200 rounded-md px-3 text-sm">
      <option>Option 1</option>
    </select>
  </div>
</div>
```

**Form Rules**:
- Gap between fields: `space-y-3`
- Input height: `h-9` (standard), `h-11` (mobile)
- Input font: `text-sm` (standard), `text-base` (mobile)
- Labels: `text-xs` color `text-slate-700`
- Help text: `text-xs` color `text-slate-500`

### 4.7 Tables
```jsx
<div className="overflow-x-auto border border-slate-200 rounded-lg">
  <table className="w-full text-sm">
    <thead className="bg-slate-100 text-slate-700 uppercase tracking-wide">
      <tr>
        <th className="px-4 py-2 text-left font-semibold">Column</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100">
      <tr className="hover:bg-slate-50 transition-colors">
        <td className="px-4 py-2">Data</td>
      </tr>
    </tbody>
  </table>
</div>
```

### 4.8 Status Badges
```jsx
// Status: DRAFT
<span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
  DRAFT
</span>

// Status: APPROVED
<span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
  APPROVED
</span>

// Status: REJECTED
<span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
  REJECTED
</span>

// Status: PENDING
<span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
  PENDING
</span>
```

### 4.9 Empty States & Loading
```jsx
// Empty state
<div className="text-center py-12">
  <p className="text-sm text-slate-500">No data found</p>
</div>

// Loading
<div className="flex justify-center py-12">
  <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
</div>

// Error
<div className="bg-red-50 border border-red-200 rounded-lg p-4">
  <p className="text-sm text-red-700 font-medium">{error}</p>
</div>

// Info banner
<div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
  <p className="text-xs text-blue-800">Information message</p>
</div>
```

### 4.10 Mobile Responsive Breakpoints
```jsx
// Mobile-first approach
<div className="p-4 md:p-6 lg:p-8">
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {/* Content */}
  </div>
</div>

// Hidden on mobile, visible on desktop
<div className="hidden md:block">Desktop only</div>

// Visible on mobile, hidden on desktop
<div className="md:hidden">Mobile only</div>

// Responsive text
<h1 className="text-xl md:text-2xl lg:text-3xl">Heading</h1>
```

---

## Part 5: TERMINOLOGY STANDARDS

### 5.1 DO NOT Use Abbreviations
**❌ DON'T**:
- "btl" / "btls" (bottles)
- "qc" (quality control)
- "po" (purchase order) — in UI labels
- "grn" (goods receipt note)
- "sku" (stock keeping unit)
- "wo" (work order)

**✅ DO**:
- "bottle" / "bottles"
- "Quality Control"
- "Purchase Order" (in labels; `po` OK in code)
- "Goods Receipt"
- "Product Code"
- "Work Order"

### 5.2 Consistent Naming
**Document types**: Always capitalize
- "Purchase Request"
- "Purchase Order"
- "Goods Receipt Note" (or "GRN Header")
- "Quality Inspection"
- "Supplier Invoice"

**Statuses**: Use ALL CAPS in code, Title Case in UI
```javascript
// Code
status: 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'

// UI Display
<span>Draft</span>
<span>Submitted</span>
<span>Approved</span>
```

**Actions**: Use imperative verbs
- "Create"
- "Edit"
- "Delete"
- "Approve"
- "Reject"
- "Receive"
- "Complete"
- "Save"

### 5.3 Form Labels & Placeholders
```jsx
// ✅ Good
<Input placeholder="Enter serial number" />
<Label>Quantity (bottles)</Label>
<Label>Batch ID</Label>

// ❌ Bad
<Input placeholder="SN" />
<Label>Qty</Label>
<Label>Btl Count</Label>
```

---

## Part 6: BUSINESS LOGIC & DATA INTEGRITY

### 6.1 Validation Rules
- **Always validate on submit**: Don't trust frontend state
- **Show clear error messages**: "Field X is required" not "Error 400"
- **Prevent accidental data loss**: Confirm before delete
- **Check permissions before actions**: Verify user can perform action

### 6.2 State Management Pattern
```javascript
// ✅ Good: Local state for UI only, queries for data
const [formOpen, setFormOpen] = useState(false);
const [editingId, setEditingId] = useState(null);
const { data: items } = useQuery(['items'], () => base44.entities.Item.list());

// ❌ Bad: Storing data in local state instead of queries
const [items, setItems] = useState([]);
```

### 6.3 Data Fetching
```javascript
// Use @tanstack/react-query for all data
const { data, isLoading, error } = useQuery(
  ['purchaseOrders'],
  () => base44.entities.PurchaseOrder.list('-created_date', 100),
  { staleTime: 60000 }
);

// Don't fetch in render; use useEffect
useEffect(() => {
  loadData(); // OK
}, []);

// NOT in render:
// const data = await base44.entities.PurchaseOrder.list(); // WRONG
```

### 6.4 Error Handling
```javascript
// ✅ Good: Show user-friendly errors
try {
  await base44.entities.Document.update(id, data);
  toast.success('Document saved');
} catch (error) {
  toast.error(error.message || 'Failed to save');
}

// ❌ Bad: Silent failures or technical errors
try {
  await base44.entities.Document.update(id, data);
} catch (e) {
  console.log(e); // User doesn't know what happened
}
```

### 6.5 Audit Logging
Use `AuditLog` entity for tracking all significant actions:
```javascript
await base44.entities.AuditLog.create({
  action: 'APPROVED_PURCHASE_ORDER',
  entity_type: 'PurchaseOrder',
  entity_id: po.id,
  user_email: user.email,
  user_name: user.full_name,
  details: { previous_status: 'SUBMITTED', new_status: 'APPROVED' },
  station: 'PurchaseOps'
});
```

---

## Part 7: WORKFLOW & APPROVAL RULES

### 7.1 Document States
**Purchase Workflow:**
```
DRAFT → SUBMITTED → APPROVED → (PURCHASE) COMPLETE
                  ↓
                REJECTED
```

**GRN Workflow:**
```
DRAFT → SUBMITTED → RECEIVED → (PUTAWAY) COMPLETE
                  ↓
                REJECTED
```

**QC Workflow:**
```
PENDING → INSPECTED → APPROVED (or) REJECTED → COMPLETE
```

### 7.2 Approval Rules (DocumentApprovalRule)
- Only users in `allowed_roles` can perform transition
- Set `require_reason: true` for rejections
- Use `action_style` (approve/reject/neutral) for button styling
- Store reason in separate field

### 7.3 Concurrent Operations
- Lock document when user is editing to prevent conflicts
- Check `updated_at` timestamp for optimistic locking
- Show "This document was modified. Refresh?" dialog if stale

---

## Part 8: TESTING & QUALITY ASSURANCE

### 8.1 Before Pushing to Production
- ✅ Test on both desktop AND mobile
- ✅ Test all happy paths AND error cases
- ✅ Verify permissions work (admin, role-based user)
- ✅ Check FMS event firing in logs
- ✅ Verify ref_chain linking (if multi-document)
- ✅ Test with slow network (simulate 3G)
- ✅ Verify buttons are 44px+ on mobile

### 8.2 Code Review Checklist
- [ ] No spaghetti code / complex nesting
- [ ] Components under 300 lines
- [ ] All imports organized correctly
- [ ] FMS events fired where needed
- [ ] ref_chain linking implemented (if document creation)
- [ ] Error handling present
- [ ] Mobile buttons tested and sized correctly
- [ ] Terminology follows standards (no abbreviations)
- [ ] UI uses standard colors/spacing
- [ ] No hardcoded values (use config/constants)

---

## Part 9: QUICK REFERENCE CHECKLIST

Use this when building ANY feature:

### New Page
- [ ] Create in `pages/` folder
- [ ] Add import + route to `App.jsx`
- [ ] Add to `moduleConfig` navigation
- [ ] Check user permissions on page load
- [ ] Use standard layout/spacing
- [ ] Test on mobile

### New Component
- [ ] Create in `components/[domain]/`
- [ ] Make it reusable (accept props)
- [ ] Keep under 300 lines (break up if bigger)
- [ ] Use standard UI patterns
- [ ] Export as default

### Document Create/Update
- [ ] Check `DocumentAccessRule` permissions
- [ ] Fire `fireFMSEvent()` on success
- [ ] If creating from another doc: `linkFMSRef()`
- [ ] Log to `AuditLog`
- [ ] Show success/error toast

### Document Approval/Rejection
- [ ] Check `DocumentApprovalRule` permissions
- [ ] Get reason if `require_reason: true`
- [ ] Fire `fireFMSEvent()` with current doc ID
- [ ] Update status + approval fields
- [ ] Log to `AuditLog`

### New Event Type
- [ ] Add to `lib/fmsAppEvents.js`
- [ ] Fire with `fireFMSEvent(key, recordId)`
- [ ] Document in FMS guide

---

## Part 10: FILES TO MAINTAIN/CHECK

**Critical Files** (DO NOT DELETE or major refactor without discussion):
- `lib/useFMSAutoComplete.js` — FMS core
- `lib/fmsAppEvents.js` — Event registry
- `components/nav/moduleConfig.js` — Navigation
- `App.jsx` — Router
- `layout.jsx` — Main layout
- `index.css` — Design tokens
- `tailwind.config.js` — Theme
- `entities/*.json` — Database schemas
- `lib/documentAccessHelper.js` — Permission checking

**When Modifying**:
1. Read full file first (understand context)
2. Use `find_replace` for precision edits
3. Test before pushing
4. Update this doc if patterns change
5. Communicate major refactors to team

---

## Part 11: QUICK START TEMPLATE

Use this template for new pages:

```jsx
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { fireFMSEvent } from '@/lib/useFMSAutoComplete';

export default function NewFeaturePage() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.role === 'admin') loadData();
    });
  }, []);

  const loadData = async () => {
    setLoading(true);
    const items = await base44.entities.SomeEntity.list('-created_date', 100);
    setData(items);
    setLoading(false);
  };

  if (!user) return <div className="text-center py-12 text-slate-500">Unauthorized</div>;
  if (user.role !== 'admin') return <div className="text-center py-12 text-slate-500">Admin only</div>;
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Feature Title</h1>
        <p className="text-sm text-slate-500">Description</p>
      </div>

      <div className="flex gap-2">
        <Button className="gap-1.5 text-xs h-11">
          <Plus className="w-4 h-4" /> New
        </Button>
      </div>

      <div className="border border-slate-200 rounded-lg bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Column</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map(item => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">{item.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## Summary

**This is the blueprint for all K95 development.** Follow these standards and the app will remain:
- ✅ Cohesive (single look & feel)
- ✅ Maintainable (clean architecture)
- ✅ Functional (FMS + permissions work)
- ✅ User-friendly (clear UI, mobile-ready)
- ✅ Professional (consistent terminology)

**When in doubt, refer back to this document.**