# Purchase Module — Complete Architecture & Data Flow

> **Last Updated:** 06/05/2026
> **Purpose:** Single source of truth for the Purchase module's structure, dependencies, data flow, and downstream impact on the K95 ERP system.

---

## 1. MODULE OVERVIEW

The Purchase module handles the entire procurement lifecycle — from a user raising a need (Purchase Request) through approval, supplier selection, Purchase Order creation, goods receipt, quality inspection, invoice matching, and payment.

**Business Goal:** Solve real procurement problems — not just data entry. Every screen exists to move a decision forward, flag a bottleneck, or prevent a duplicate spend.

---

## 2. ENTITY MAP (Database Tables)

### 2.1 Core Purchase Entities

| Entity | Purpose | Key Fields |
|--------|---------|------------|
| **PurchaseRequest** | A formal request to buy items | `pr_number`, `title`, `department`, `priority`, `status`, `requested_by`, `approved_by`, `request_date`, `required_by_date` |
| **PurchaseRequestItem** | Line items inside a PR | `pr_number`, `mr_id`, `item_code`, `item_name`, `qty`, `unit`, `estimated_rate`, `item_status`, `sample_image` |
| **PurchaseOrder** | Confirmed order to a supplier | `po_id`, `supplier_id`, `supplier_name`, `mr_id`, `linked_pr_ids[]`, `status`, `po_date`, `due_date`, `subtotal`, `gst_percent`, `gst_amount`, `total_amount`, `estimated_freight`, `actual_freight` |
| **PurchaseOrderItem** | Line items inside a PO | `po_id`, `item_code`, `item_name`, `qty`, `rate`, `amount`, `received_qty`, `pending_qty` |
| **Supplier** | Approved vendor master | `supplier_id`, `supplier_name`, `approval_status` (APPROVED/HOLD/BLOCKED), `gstin`, `payment_terms_days`, `contact_name`, `phone`, `email` |

### 2.2 Supporting Entities (Used by Purchase)

| Entity | Relationship |
|--------|-------------|
| **ItemMaster** | Unified item catalogue — PR items are selected from here |
| **StoreItemMaster** | Store-specific item catalogue — merged with ItemMaster during PR creation |
| **UOMMaster** | Units of Measure — populates unit dropdowns |
| **AuditLog** | Every purchase action is logged here |

### 2.3 Downstream Entities (Purchase Feeds Into)

| Entity | How Purchase Feeds It |
|--------|----------------------|
| **GateEntry** | When supplier delivers goods, a Gate Entry is logged |
| **GRNHeader** | Goods Receipt Note — links to `po_id` for receiving |
| **GRNItem** | Each received line item — tracks `received_qty` vs `po_qty` |
| **QCInspection** | Quality check triggered after GRN |
| **SupplierInvoice** | Invoice captured against a PO |
| **MatchResult** | 3-way match: PO ↔ GRN ↔ Invoice |
| **PaymentRequest** | Payment approval after successful match |
| **StockBalance / WarehouseLot** | GRN completion updates stock |
| **StoreLot** | Store module stock lots created from GRN |

---

## 3. STATUS LIFECYCLES

### 3.1 Purchase Request Status Flow

```
DRAFT
  ↓ (user submits)
Pending Approval
  ├── → Approved        (manager approves all items)
  ├── → Partially Approved (some items approved, some rejected/clarified)
  ├── → Rejected        (manager rejects entire request)
  └── → ORDERED         (PO created from this PR)
        → CLOSED        (all items received)
```

### 3.2 Purchase Request Item Status Flow

```
Pending
  ├── → Approved                  (manager approves this item)
  ├── → Rejected                  (manager rejects with reason)
  ├── → Sample Photo Requested    (manager asks requester for photo)
  │     └── → Pending             (requester uploads photo → resets to Pending)
  └── → Clarification Requested   (manager asks requester a question)
        └── → Pending             (requester responds → resets to Pending)
```

### 3.3 Purchase Order Status Flow

```
DRAFT
  ↓ (manager completes order form)
SUBMITTED
  ↓ (approval)
APPROVED
  ↓ (sent to supplier)
SENT
  ├── → PART_RECEIVED   (partial GRN recorded)
  └── → CLOSED          (all items fully received)
  
CANCELLED (can happen from DRAFT, SUBMITTED, or APPROVED)
```

---

## 4. PAGE TREE & NAVIGATION

```
Purchase Module (sidebar group)
│
├── 📋 My Purchase Requests     [PurchaseRequestList]
│   ├── New Purchase Request     (Dialog → PRCreateForm)
│   └── PR Detail View           (PRDetailView → PRDetailItemCard)
│       └── Continue to PO       (→ PurchaseOrderCreate)
│
├── ✅ Request Approvals         [PurchaseRequestApprovals]
│   └── PR Detail View           (PRDetailView with approval actions)
│       ├── Approve / Reject per item
│       ├── Request Sample Photo
│       ├── Request Clarification
│       └── Approve / Reject entire request
│
├── 🛒 Purchase Orders           [PurchaseOrderList]
│   ├── New Purchase Order       (→ PurchaseOrderCreate)
│   ├── Bulk Purchase Order      (→ BulkPOCreate)
│   └── View PO Timeline         (→ PurchaseOrderTimeline?po=XXX)
│
├── 🔔 Follow-Up Tracker         [POFollowUpTracker]
│   └── Overdue / Due Today / Upcoming / Completed
│
├── 📊 Order Timeline            [PurchaseOrderTimeline]
│   └── PO list with ordered vs received vs pending quantities
│
├── 📈 Purchase Reports          [PurchaseReports]
│   └── Analytics on purchase operations
│
└── 🏭 Suppliers (Admin only)    [SupplierManager]
    ├── Supplier CRUD
    ├── Status management (Approved/Hold/Blocked)
    └── Supplier-Item Mapping
```

---

## 5. COMPONENT MAP

```
pages/
├── PurchaseRequestList.jsx          — Requester's list view + create dialog
├── PurchaseRequestApprovals.jsx     — Manager's approval inbox
├── PurchaseOrderList.jsx            — PO master list
├── PurchaseOrderCreate.jsx          — PO creation router (single vs bulk)
├── BulkPOCreate.jsx                 — Bulk PO wizard (3-step)
├── PurchaseOrderTimeline.jsx        — PO tracking with GRN quantities
├── POFollowUpTracker.jsx            — Overdue PO follow-ups
├── PurchaseReports.jsx              — Analytics wrapper
├── SupplierManager.jsx              — Supplier CRUD

components/purchase/
├── purchaseHelpers.js               — Utility functions + constants
│   ├── logPurchaseAudit()           — Audit logging
│   ├── genPRNumber() / genPONumber()— ID generation
│   ├── formatDateDDMMYYYY()         — Date formatting
│   ├── formatINR()                  — Currency formatting
│   ├── DEPARTMENTS[]                — Department constants
│   └── PR_STATUS_COLOR / PO_STATUS_COLOR / PRIORITY_COLOR
│
├── PRCreateForm.jsx                 — PR creation form with line items
├── PRItemRowEnhanced.jsx            — Smart item selector (search + add new)
├── PRDetailView.jsx                 — PR detail with approval workflow
├── PRDetailItemCard.jsx             — Individual item card with actions
├── PRDetailActions.jsx              — PR-level approve/reject buttons
├── PRListFilters.jsx                — Filter controls for PR list
├── SupplierSelect.jsx               — Smart supplier selector (search + add new)
├── SupplierFormDialog.jsx           — Supplier create/edit form
├── SupplierStatusCards.jsx          — Status summary cards
├── SupplierTable.jsx                — Supplier data table
├── SupplierItemMappingPanel.jsx     — Supplier ↔ Item links
├── ApprovalActionPanel.jsx          — Approval actions
├── PurchaseReports.jsx              — Reports component
├── POList.jsx                       — PO listing component
├── POForm.jsx                       — PO form component
├── POSharePanel.jsx                 — Share PO via WhatsApp/Email
└── purchaseHindiLabels.js           — Hindi translations
```

---

## 6. DATA FLOW — END TO END

### 6.1 Purchase Request → Purchase Order → GRN → Payment

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PURCHASE REQUEST FLOW                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User (any dept)                                                    │
│    │                                                                │
│    ▼                                                                │
│  [PRCreateForm] ──creates──→ PurchaseRequest (Pending Approval)    │
│    │                         PurchaseRequestItem[] (Pending)        │
│    │                                                                │
│    ├── FMS: triggerFMSProcess('purchase_request_created', pr.id)   │
│    └── Audit: "Purchase Request PR-XXXX created"                   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                     APPROVAL FLOW                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Manager (admin / purchase_manager / production_manager)            │
│    │                                                                │
│    ▼                                                                │
│  [PurchaseRequestApprovals] → [PRDetailView]                       │
│    │                                                                │
│    ├── Per Item: Approve / Reject / Sample Photo / Clarification   │
│    │   └── Updates PurchaseRequestItem.item_status                 │
│    │                                                                │
│    ├── Sample Photo Requested:                                      │
│    │   └── Requester sees ⚠ flag in list + upload area in detail   │
│    │   └── After upload → item_status resets to "Pending"          │
│    │                                                                │
│    ├── Full Request: Approve / Reject                              │
│    │   └── Updates PurchaseRequest.status + approved_by/at         │
│    │   └── Audit: "PR-XXXX approved/rejected"                     │
│    │                                                                │
│    └── On Approve → "Continue to Purchase Order" button appears    │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                     PURCHASE ORDER CREATION                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [BulkPOCreate] — 3-step wizard:                                   │
│    Step 1: Select approved PRs (filters out PRs with existing POs) │
│    Step 2: Enter supplier (SupplierSelect), dates, terms, GST      │
│    Step 3: Review consolidated items + totals                      │
│    │                                                                │
│    ├── Creates: PurchaseOrder (DRAFT)                              │
│    ├── Creates: PurchaseOrderItem[] (one per consolidated item)    │
│    ├── FMS: fireFMSEvent('purchase_order_created', pr.id)          │
│    ├── FMS: linkFMSRef(instanceId, po.id)                          │
│    └── Audit: "Bulk PO PO-XXXX created from N PRs"                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                     DOWNSTREAM IMPACT                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PO (SENT status) ──→ Gate Entry Module                            │
│    │                  Security logs incoming delivery               │
│    ▼                                                                │
│  [GateEntry] ──→ GRN Module                                       │
│    │             Store team receives goods against PO               │
│    ▼                                                                │
│  [GRNReceive] ──creates──→ GRNHeader + GRNItem[]                  │
│    │                        Links to po_id                          │
│    │                        Updates PurchaseOrderItem.received_qty  │
│    │                        Creates StoreLot / WarehouseLot         │
│    │                        Tracks freight_amount                   │
│    ▼                                                                │
│  [QCInbox] ──→ Quality inspection of received goods                │
│    │                                                                │
│    ▼                                                                │
│  [InvoiceCapture] ──→ SupplierInvoice against PO                  │
│    │                                                                │
│    ▼                                                                │
│  [ThreeWayMatch] ──→ PO qty ↔ GRN qty ↔ Invoice qty               │
│    │                  MatchResult entity                            │
│    ▼                                                                │
│  [PaymentRequests] ──→ Approved for payment                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. FMS (Factory Management System) INTEGRATION

The Purchase module fires FMS events to drive automated process workflows.

| Action | FMS Event Key | Ref ID | Notes |
|--------|--------------|--------|-------|
| PR Created | `triggerFMSProcess('purchase_request_created', pr.id)` | PR record ID | Starts a new FMS process instance |
| PO Created | `fireFMSEvent('purchase_order_created', pr.id)` | PR record ID (already in chain) | Auto-completes the "Create PO" step |
| PO Linked | `linkFMSRef(instanceId, po.id)` | PO record ID | Adds PO to ref_chain for future steps |

### FMS Ref Chain Example
```
Step 1: PR created     → ref_chain = [pr.id]
Step 2: PO created     → ref_chain = [pr.id, po.id]
Step 3: PO approved    → fireFMSEvent('po_approved', po.id) matches via ref_chain
Step 4: GRN received   → fireFMSEvent('grn_received', po.id) matches via ref_chain
```

---

## 8. SMART INPUT PATTERN (Creatable Dropdowns)

Two critical smart selectors in the Purchase module:

### 8.1 Item Selection (PRItemRowEnhanced)
- **Source:** ItemMaster + StoreItemMaster (merged, deduplicated)
- **Behaviour:** Type to search → select existing → or "Add as new item"
- **On Create:** Creates ItemMaster record with category `CONSUMABLE`, code `ADHOC-XXXXX`
- **Impact:** New items immediately available across the system

### 8.2 Supplier Selection (SupplierSelect)
- **Source:** Supplier entity
- **Behaviour:** Type to search → select existing → or "Add as new supplier"
- **On Create:** Creates Supplier record with status `HOLD` (not approved)
- **Impact:** New supplier available for POs but requires admin approval before payments

---

## 9. ROLE-BASED ACCESS

| Role | Can Create PR | Can Approve PR | Can Create PO | Can Manage Suppliers |
|------|:---:|:---:|:---:|:---:|
| `user` | ✅ | ❌ | ❌ | ❌ |
| `purchase_user` | ✅ | ❌ | ❌ | ❌ |
| `purchase_manager` | ✅ | ✅ | ✅ | ❌ |
| `production_manager` | ✅ | ✅ | ✅ | ❌ |
| `admin` | ✅ | ✅ | ✅ | ✅ |

**Navigation visibility** is controlled by `lib/registryConfig.js` → `pageRegistry[]` entries for module `PURCHASE`.

---

## 10. AUDIT TRAIL

Every significant action is logged via `logPurchaseAudit()` to the `AuditLog` entity:

| Action | Logged Data |
|--------|------------|
| PR Created | "Purchase Request PR-XXXX created" |
| PR Approved | "Purchase Request PR-XXXX approved" |
| PR Rejected | "Purchase Request PR-XXXX rejected: [reason]" |
| PO Created | "Bulk PO PO-XXXX created from N PRs: PR-XXX, PR-YYY" |
| Supplier Created | "Supplier SUP-XXXX created from Purchase Order form" |

**Note:** The `logPurchaseAudit` function currently uses legacy AuditLog fields (`action`, `entity_type`, `performed_by`). The AuditLog entity schema requires `action_type`, `actor_email`, `audit_id`, `module` — this mismatch causes silent 422 validation errors. This needs to be fixed.

---

## 11. KNOWN ISSUES & GAPS

### 11.1 Audit Log Schema Mismatch ⚠️
`logPurchaseAudit()` in `purchaseHelpers.js` creates records with fields that don't match the current `AuditLog` entity schema. Required fields (`action_type`, `actor_email`, `audit_id`, `module`) are missing, causing silent 422 errors.

### 11.2 Follow-Up Tracker is Stateless ⚠️
`POFollowUpTracker` generates follow-up items in-memory from PO data. When you "Mark Done", it only updates local state — not persisted to database. A page refresh resets everything.

### 11.3 Quotation Management — Not Yet Built
The "Manage Quotations" button on approved PRs is disabled/placeholder. No quotation entity or comparison workflow exists yet.

### 11.4 PO Approval Workflow — Missing
POs are created in DRAFT status but there's no approval step to move them to APPROVED → SENT. Currently only the list displays status — no UI to change PO status.

### 11.5 PO Detail/Edit View — Missing
No dedicated PO detail page exists. The "View" button on PO list links to the Timeline page, which is a read-only tracking view — no editing capability.

### 11.6 PR → PO Item-Level Traceability — Weak
When a PO is created from multiple PRs, individual PR item → PO item traceability is lost. The PO stores `linked_pr_ids[]` but doesn't track which specific PR item became which PO item.

### 11.7 Supplier Override Reason — Unused
`PurchaseOrder.supplier_override_reason` field exists but no UI captures it. Meant for when a non-approved supplier is selected.

---

## 12. DEPENDENCY GRAPH

```
                    ┌──────────────┐
                    │  ItemMaster  │
                    │ StoreItemMaster│
                    └──────┬───────┘
                           │ items lookup
                           ▼
┌──────────┐    ┌──────────────────────┐    ┌──────────────┐
│ UOMMaster │───→│  PurchaseRequest     │    │   Supplier   │
└──────────┘    │  PurchaseRequestItem │    └──────┬───────┘
                └──────────┬───────────┘           │
                           │ approval               │ supplier selection
                           ▼                        ▼
                ┌──────────────────────────────────────┐
                │         PurchaseOrder                │
                │         PurchaseOrderItem             │
                └──────────┬───────────────────────────┘
                           │
            ┌──────────────┼──────────────────┐
            ▼              ▼                  ▼
    ┌──────────────┐ ┌──────────┐    ┌──────────────────┐
    │  GateEntry   │ │ GRNHeader│    │ SupplierInvoice  │
    └──────────────┘ │ GRNItem  │    └────────┬─────────┘
                     └────┬─────┘             │
                          │                    │
                          ▼                    ▼
                 ┌────────────────┐   ┌──────────────┐
                 │ QCInspection   │   │ MatchResult  │
                 │ StoreLot       │   │ (3-Way Match)│
                 │ StockBalance   │   └──────┬───────┘
                 │ WarehouseLot   │          │
                 └────────────────┘          ▼
                                    ┌────────────────┐
                                    │ PaymentRequest │
                                    └────────────────┘
```

---

## 13. WHAT HAPPENS IF...

| Scenario | System Behaviour |
|----------|-----------------|
| User creates PR with unknown item | Smart selector creates it in ItemMaster (ADHOC code, CONSUMABLE category) |
| Manager requests sample photo | Item status → "Sample Photo Requested", requester sees ⚠ flag + upload area |
| PO created for non-approved supplier | Supplier created with HOLD status. Admin must approve separately |
| Partial delivery against PO | PO status → PART_RECEIVED, PurchaseOrderItem.received_qty updated, pending_qty recalculated |
| GRN recorded against PO | Stock lots created, warehouse stock updated, QC inspection triggered if configured |
| 3-way match passes | Payment request auto-generated or flagged for approval |
| PR has no items with quantity | Validation blocks submission |
| Duplicate supplier name entered | Currently NOT blocked — duplicate prevention is missing |

---

## 14. FILES REFERENCE

| File | Purpose |
|------|---------|
| `entities/PurchaseRequest.json` | PR entity schema |
| `entities/PurchaseRequestItem.json` | PR item entity schema |
| `entities/PurchaseOrder.json` | PO entity schema |
| `entities/PurchaseOrderItem.json` | PO item entity schema |
| `entities/Supplier.json` | Supplier entity schema |
| `lib/registryConfig.js` | Page routing & module registration |
| `lib/useFMSAutoComplete.js` | FMS event helpers |
| `components/purchase/purchaseHelpers.js` | Shared utilities |
| `App.jsx` | Route definitions |

---

*This document covers the Purchase module as it exists today. Review against your business requirements and flag any gaps or changes needed.*