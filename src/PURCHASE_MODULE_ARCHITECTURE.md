# Purchase Module — Complete Architecture & Data Flow (VERIFIED)

> **Last Updated:** 06/05/2026
> **Verified Against:** Actual codebase — every statement in this document is confirmed by reading the source files.

---

## 1. MODULE OVERVIEW

The Purchase module handles the entire procurement lifecycle — from a user raising a need (Purchase Request) through approval, supplier selection, Purchase Order creation, goods receipt tracking, and follow-up management.

**Business Goal:** Solve real procurement problems — not just data entry. Every screen exists to move a decision forward, flag a bottleneck, or prevent a duplicate spend.

---

## 2. ENTITY MAP (Database Tables)

### 2.1 Core Purchase Entities

| Entity | Purpose | Key Fields |
|--------|---------|------------|
| **PurchaseRequest** | A formal request to buy items | `pr_number`, `title`, `department`, `priority`, `status`, `requested_by`, `requested_by_name`, `approved_by`, `request_date`, `required_by_date`, `internal_notes`, `expected_delivery_date`, `urgency_override`, `supporting_documents[]`, `mr_id` |
| **PurchaseRequestItem** | Line items inside a Purchase Request | `pr_number`, `line_number`, `item_code`, `item_name`, `quantity`, `qty` (legacy), `unit`, `uom_code`, `estimated_rate`, `item_status`, `sample_image`, `sample_photo_requested`, `sample_photo_request_note`, `sample_photo_submitted`, `rejection_reason`, `remarks`, `mr_id` |
| **PurchaseOrder** | Confirmed order to a supplier | `po_id`, `pr_number`, `supplier_id`, `supplier_name`, `status`, `po_date`, `due_date`, `subtotal`, `gst_amount`, `gst_rate`, `total_amount`, `payment_terms`, `custom_payment_terms`, `terms_and_conditions`, `quotation_number`, `ship_via`, `estimated_freight`, `actual_freight`, `total_freight_paid`, `delivery_address`, `supplier_gstin`, `supplier_address`, `supplier_contact`, `supplier_email`, `sent_at`, `sent_via`, `mr_id`, `erp_sync_status` |
| **PurchaseOrderItem** | Line items inside a Purchase Order | `po_id`, `item_code`, `item_name`, `uom_code`, `qty`, `rate`, `gst_percent`, `gst_amount`, `amount`, `total_amount`, `received_qty`, `pending_qty`, `supplier_id`, `remarks` |
| **POFollowUp** | Scheduled follow-ups with suppliers | `po_id`, `follow_up_date`, `follow_up_mode` (Call/Email/WhatsApp), `contact_person`, `status` (Pending/Done/Rescheduled), `notes`, `rescheduled_to`, `reschedule_reason`, `completed_by`, `completed_at` |
| **PRQuotation** | Quotation entries for approved Purchase Request items | `pr_number`, `line_number`, `supplier_id`, `supplier_name`, `quoted_rate`, `quotation_document`, `sample_requested`, `expected_sample_date`, `sample_received`, `sample_photo`, `is_selected`, `remarks` |
| **PRComment** | Threaded comments for clarification on Purchase Request line items | `pr_number`, `line_number`, `comment_type` (clarification_request/reply/note/status_change), `message`, `attachment_url`, `author_email`, `author_name` |
| **Supplier** | Approved vendor master | `supplier_id`, `supplier_name`, `approval_status` (APPROVED/HOLD/BLOCKED), `is_approved`, `gstin`, `address`, `city`, `state`, `pincode`, `payment_terms_days`, `contact_name`, `phone`, `email`, `bank_details` |
| **SupplierItemMapping** | Maps which supplier provides which item | `supplier_id`, `supplier_name`, `item_code`, `item_name`, `last_rate`, `is_preferred` |

### 2.2 Supporting Entities (Used by Purchase)

| Entity | Relationship |
|--------|-------------|
| **ItemMaster** | Unified item catalogue — Purchase Request items are selected from here |
| **StoreItemMaster** | Store-specific item catalogue — merged with ItemMaster during Purchase Request creation |
| **UOMMaster** | Units of Measure — populates unit dropdowns |
| **AuditLog** | Every purchase action is logged here via `logPurchaseAudit()` |

### 2.3 Downstream Entities (Purchase Feeds Into)

| Entity | How Purchase Feeds It |
|--------|----------------------|
| **GateEntry** | When supplier delivers goods, a Gate Entry is logged (links via `linked_po_id`) |
| **GRNHeader** | Goods Receipt Note — links to `po_id` and `linked_po_ids[]` for receiving |
| **GRNItem** | Each received line item — tracks `received_qty` vs `ordered_qty`, includes `mismatch_type` |
| **StoreLot** | Store module stock lots created from Goods Receipt Note |
| **StockBalance** / **StoreStockBalance** | Goods Receipt Note completion updates stock |
| **QCInspection** | Quality check triggered after Goods Receipt Note |
| **SupplierInvoice** | Invoice captured against a Purchase Order |
| **MatchResult** | 3-way match: Purchase Order to Goods Receipt Note to Invoice |
| **PaymentRequest** | Payment approval after successful match |

---

## 3. STATUS LIFECYCLES

### 3.1 Purchase Request Status Flow

```
Draft
  | (user submits via PRCreateForm)
Pending Approval
  |-- -> Approved              (manager approves all items)
  |-- -> Partially Approved    (some items approved, some rejected/clarified)
  |-- -> Rejected              (manager rejects entire request with reason)
  |-- -> Quotation Stage       (quotations being collected)
  +-- -> PO Created            (Purchase Order created from this request)
        -> Closed              (all items received)
```

### 3.2 Purchase Request Item Status Flow

```
Pending
  |-- -> Approved                  (manager approves this item)
  |-- -> Rejected                  (manager rejects with reason)
  |-- -> Sample Photo Requested    (manager asks requester for photo)
  |     +-- -> Pending             (requester uploads photo -> resets to Pending)
  +-- -> Clarification Requested   (manager asks requester a question via comment thread)
        +-- -> Pending             (requester responds -> can be re-evaluated)
```

### 3.3 Purchase Order Status Flow

```
Draft
  | (manager advances status in PODetailView)
Sent to Supplier
  |
Acknowledged
  |
In Transit
  |-- -> Partially Received   (partial Goods Receipt Note recorded)
  +-- -> Delivered             (all items fully received)

Cancelled (can happen from any status except Delivered)
```

NOTE: There is NO separate "Submitted" or "Approved" step. The status flow goes directly from Draft to Sent to Supplier. The PODetailView component provides a "Move to: [Next Status]" button that advances through the flow linearly.

### 3.4 Follow-Up Status Flow

```
Pending
  |-- -> Done         (marked complete with notes)
  +-- -> Rescheduled  (original closed, new follow-up created for new date)
```

---

## 4. PAGE TREE & NAVIGATION (9 pages)

```
Purchase Module (sidebar group)
|
|-- My Purchase Requests       [PurchaseRequestList]
|   |-- New Purchase Request       (Dialog -> PRCreateForm)
|   |-- Hindi/English toggle       (full UI translation)
|   +-- Purchase Request Detail    (PRDetailView -> PRItemApprovalCard)
|       +-- Continue to Purchase Order (-> /PurchaseOrderCreate?pr=XXX)
|
|-- Request Approvals           [PurchaseRequestApprovals]
|   |-- Tabs: Pending | Reviewed | All
|   |-- Summary cards (Pending/Approved/Rejected counts)
|   +-- Purchase Request Detail    (PRDetailView with showApprovalActions=true)
|       |-- Per-item: Approve / Reject / Request Sample Photo / Request Clarification
|       |-- Full request: Approve All / Partially Approve / Reject All
|       |-- Manager fields: Expected Delivery Date, Urgency Override, Internal Notes
|       |-- Quotation management panel (PRQuotationPanel)
|       +-- "Continue to Purchase Order" button
|
|-- Purchase Orders             [PurchaseOrderList]
|   |-- New Purchase Order         (-> /PurchaseOrderCreate)
|   |-- Bulk Purchase Order        (-> /BulkPOCreate)
|   +-- Purchase Order Detail      (PODetailView)
|       |-- Status flow visualisation
|       |-- Supplier details card
|       |-- Line items table (ordered/received/pending)
|       |-- Goods Receipt History (POGRNHistory)
|       |-- Follow-up management (POFollowUpList)
|       |-- PDF view (POPdfView)
|       +-- Status advancement / Cancel actions
|
|-- Create Purchase Order       [PurchaseOrderCreate]
|   |-- From Purchase Request: pre-loads approved items
|   |-- Standalone: blank form
|   |-- Duplicate Purchase Order check
|   +-- 3-step wizard (POCreateWizard):
|       Step 1: Supplier selection per item (CreatableSupplierSelect)
|       Step 2: Purchase Order details (dates, terms, freight, delivery address)
|       Step 3: Follow-up scheduling + summary
|
|-- Bulk Purchase Order         [BulkPOCreate]
|   +-- 3-step wizard:
|       Step 1: Select approved requests (filters out requests with existing Purchase Orders)
|       Step 2: Assign single supplier + Purchase Order details
|       Step 3: Review consolidated items + totals -> Create
|
|-- Order Timeline              [PurchaseOrderTimeline]
|   |-- Purchase Order list with ordered vs received vs pending quantities
|   |-- Mobile card view + desktop table view
|   +-- Timeline detail view (POTimelineView):
|       |-- 7-step timeline (Created -> Sent -> Acknowledged -> In Transit -> Gate Entry -> Goods Receipt Note -> Delivered/Cancelled)
|       |-- Items table with partial quantity % tracking
|       |-- Freight & cost summary
|       |-- Goods Receipt Note history with per-note item details
|       |-- Follow-up list
|       +-- Audit trail
|
|-- Follow-Up Tracker          [POFollowUpTracker]
|   |-- Dashboard: Overdue / Due Today / Upcoming / Completed (with counts)
|   +-- Per follow-up: Mark Done (with notes) / Reschedule (with reason + new date)
|   FULLY PERSISTENT - reads/writes to POFollowUp entity
|
|-- Purchase Reports            [PurchaseReports]
|   |-- KPI cards: Total Purchase Orders, Active, Pending Requests, Overdue Follow-Ups
|   |-- Value KPIs: Total Purchase Order Value, Average Value, Total Freight
|   |-- Charts: Monthly Purchase Order trend (bar), Purchase Orders by Status (pie)
|   |-- Top 5 Suppliers by value
|   |-- Purchase Orders pending receipt
|   +-- Purchase Requests by status breakdown
|
+-- Suppliers (Admin only)      [SupplierManager]
    |-- Supplier CRUD with audit logging
    |-- Status management (Approved/Hold/Blocked)
    |-- Deletion guard (checks for existing purchase documents)
    +-- Supplier-Item Mapping panel (SupplierItemMappingPanel)
```

---

## 5. COMPONENT MAP

### Pages (11 files)

| File | Purpose |
|------|---------|
| `pages/PurchaseRequestList.jsx` | Requester's list + create dialog + Hindi toggle |
| `pages/PurchaseRequestApprovals.jsx` | Manager's approval inbox with tabs |
| `pages/PurchaseOrders.jsx` | Wrapper that renders PurchaseOrderList |
| `pages/PurchaseOrderList.jsx` | Purchase Order master list with detail view |
| `pages/PurchaseOrderCreate.jsx` | Purchase Order creation router (single vs bulk) |
| `pages/BulkPOCreate.jsx` | Bulk Purchase Order wizard (3-step) |
| `pages/PurchaseOrderTimeline.jsx` | Purchase Order tracking with quantities |
| `pages/POFollowUpTracker.jsx` | Overdue Purchase Order follow-ups |
| `pages/PurchaseReports.jsx` | Analytics wrapper page |
| `pages/SupplierManager.jsx` | Supplier CRUD + mapping |
| `pages/MaterialRequest.jsx` | Wrapper that renders PurchaseRequestList |

### Components (22 files)

| File | Purpose |
|------|---------|
| `components/purchase/purchaseHelpers.js` | Utilities + constants (logPurchaseAudit, genPRNumber, genPONumber, formatDateDDMMYYYY, formatINR, DEPARTMENTS, UNITS, STATUS_COLOR, PO_STATUS_FLOW) |
| `components/purchase/purchaseHindiLabels.js` | Hindi translations |
| `components/purchase/PRCreateForm.jsx` | Purchase Request creation form with ItemSelectWithStock |
| `components/purchase/PRItemRowEnhanced.jsx` | Enhanced line item row with ItemSelectWithStock, description, sample upload |
| `components/purchase/ItemSelectWithStock.jsx` | Smart item selector with real-time stock levels and lot info |
| `components/purchase/CreatableSupplierSelect.jsx` | Smart supplier dropdown with save-to-master prompt |
| `components/purchase/PRDetailView.jsx` | Purchase Request detail with approval workflow, manager fields, quotation panel |
| `components/purchase/PRItemApprovalCard.jsx` | Per-item approval card with 4 actions + comment thread |
| `components/purchase/PRSamplePhotoUploader.jsx` | Sample photo upload for requesters |
| `components/purchase/PRCommentThread.jsx` | Threaded comment system (full-screen overlay) |
| `components/purchase/PRQuotationPanel.jsx` | Quotation management for approved items |
| `components/purchase/PRListFilters.jsx` | Filter controls |
| `components/purchase/POCreateWizard.jsx` | 3-step Purchase Order creation wizard with per-item supplier |
| `components/purchase/PODetailView.jsx` | Purchase Order detail (status flow, supplier card, items, GRN history, follow-ups) |
| `components/purchase/POTimelineView.jsx` | 7-step timeline with items tracking, freight, GRN history, audit trail |
| `components/purchase/POGRNHistory.jsx` | Goods Receipt Note history (dual search: po_id + linked_po_ids) |
| `components/purchase/POFollowUpList.jsx` | Follow-up CRUD within Purchase Order detail |
| `components/purchase/POFollowUpForm.jsx` | Follow-up scheduling form (used in POCreateWizard step 3) |
| `components/purchase/POPdfView.jsx` | Purchase Order PDF generation (print window) |
| `components/purchase/POSharePanel.jsx` | Share via WhatsApp/Email |
| `components/purchase/POPartialReceive.jsx` | Partial goods receiving (creates GRN, updates PO items/status) |
| `components/purchase/PurchaseReports.jsx` | Analytics component (KPIs, charts, top suppliers) |

---

## 6. FMS INTEGRATION

| Action | FMS Call | Ref ID |
|--------|---------|--------|
| Purchase Request Created | `triggerFMSProcess('purchase_request_created', pr.id)` | Purchase Request record ID |
| Purchase Order Created (single) | `fireFMSEvent('purchase_order_created', sourcePR.id)` | Source Purchase Request ID |
| Purchase Order Linked | `linkFMSRef(instanceId, po.id)` | Purchase Order record ID |
| Goods Received | `fireFMSEvent('grn_received', po.id)` | Purchase Order record ID |

### FMS Ref Chain Example
```
Step 1: Purchase Request created  -> ref_chain = [pr.id]
Step 2: Purchase Order created    -> ref_chain = [pr.id, po.id]
Step 3: Goods Received            -> fireFMSEvent('grn_received', po.id) matches via ref_chain
```

---

## 7. SMART INPUT PATTERNS

### 7.1 Item Selection (ItemSelectWithStock)
- Source: ItemMaster + StoreItemMaster (merged, deduplicated)
- Modes: search | selected | manual
- Shows stock per location, active lots with expiry warnings (color-coded)
- "Add [text] as new item" for manual entry

### 7.2 Supplier Selection (CreatableSupplierSelect)
- Source: Supplier entity
- Shows approval_status badge for non-approved suppliers
- "Save to master?" prompt after manual entry
- In POCreateWizard: shows SupplierItemMapping suggestions

---

## 8. ROLE-BASED ACCESS

| Role | Create PR | Approve PR | Create PO | Manage Suppliers |
|------|:---------:|:----------:|:---------:|:----------------:|
| user | Yes | No | No | No |
| purchase_manager | Yes | Yes | Yes | No |
| production_manager | Yes | Yes | Yes | No |
| admin | Yes | Yes | Yes | Yes |

Manager check: `user.role === 'admin' || user.role === 'purchase_manager' || user.role === 'production_manager'`

PR list visibility: Managers see ALL, regular users see only their own.

---

## 9. AUDIT TRAIL

`logPurchaseAudit()` creates AuditLog records with: `audit_id`, `action`, `action_type`, `module: 'PURCHASE'`, `entity_type`, `entity_id`, `actor_email`, `actor_name`, `actor_role`, `notes`.

Logged actions: PR created/approved/rejected, item-level actions, PO created/status changes/cancelled, supplier created, goods received.

---

## 10. KNOWN GAPS

| # | Gap | Severity |
|---|-----|----------|
| 1 | No Purchase Order edit capability | Medium |
| 2 | No Purchase Order approval step | Low |
| 3 | Weak PR to PO item traceability | Medium |
| 4 | Supplier override reason unused | Low |
| 5 | No duplicate supplier prevention | Low |

---

## 11. ENTITY SCHEMAS

| File | Purpose |
|------|---------|
| `entities/PurchaseRequest.json` | Purchase Request |
| `entities/PurchaseRequestItem.json` | Purchase Request item |
| `entities/PurchaseOrder.json` | Purchase Order |
| `entities/PurchaseOrderItem.json` | Purchase Order item |
| `entities/POFollowUp.json` | Follow-up |
| `entities/PRQuotation.json` | Quotation |
| `entities/PRComment.json` | Comment |
| `entities/Supplier.json` | Supplier |
| `entities/SupplierItemMapping.json` | Supplier-item mapping |