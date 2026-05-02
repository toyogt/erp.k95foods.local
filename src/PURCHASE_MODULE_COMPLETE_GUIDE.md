# K95 ERP — Purchase Module: Complete Working Guide

> **Last updated:** 02/05/2026  
> **Scope:** Everything from Material Request to Payment Approval — all entities, dependencies, data flows, FMS events, status lifecycles, and cross-module impacts.

---

## 1. MODULE OVERVIEW

The Purchase Module covers the full procurement lifecycle:

```
ItemMaster / UOMMaster / Supplier (MASTER DATA)
         │
         ▼
[1] Material Request (MR)
         │   FMS: purchase_request_created
         ▼
[2] Purchase Order (PO)
         │   FMS: purchase_order_created → purchase_order_approved
         │   PO sent to supplier via WhatsApp or Email
         ▼
[3] Gate Entry
         │   FMS: gate_entry_created
         ▼
[4] Goods Received Note (GRN)
         │   FMS: grn_received
         │   StoreLots created → stock enters system
         ▼
[5] QC Inspection
         │   FMS: grn_qc_approved / grn_qc_rejected
         │   Stock moves between bins
         ▼
[6] Invoice Capture
         │   FMS: invoice_captured
         │   Linked to PO
         ▼
[7] 3-Way Match (PO vs GRN vs Invoice)
         │   FMS: three_way_match_done
         ▼
[8] Payment Request
         │   FMS: payment_request_created
         ▼
[9] Payment Approval (Admin Only)
         Invoice → APPROVED_FOR_PAYMENT
```

---

## 2. MASTER DATA DEPENDENCIES

These must exist **before** any purchase transaction can be created.

### 2a. Item Master (`entities/ItemMaster`)
**The single source of truth for item names and codes used across the entire Purchase Module.**

| Field | Purpose | Used In |
|-------|---------|---------|
| `item_code` | Unique code (e.g. `ITM-0001`) | All purchase docs, GRN, StoreLot |
| `item_name` | Display name shown in all dropdowns | MR, PO, GRN, Invoice |
| `is_active` | Only active items appear in search | MR Wizard, PO Form |
| `uom_code` | Default unit of measure | Pre-fills UOM in MR/PO |

**Where items are searched:**
- `MRWizard` → `base44.entities.ItemMaster.filter({ is_active: true })` — shows top 10 matching on name or code
- `POForm` → same query — items from ItemMaster are the **only selectable items** in a PO
- GRN → uses `StoreItemMaster` (a separate Store-specific item master — see Section 4)

> ⚠️ **Important:** The Purchase Module (MR + PO) uses `ItemMaster`. The GRN/Store module uses `StoreItemMaster`. These are two separate entity tables. If an item exists in ItemMaster but not StoreItemMaster, it can be ordered but **cannot be received into stock** until it's added to StoreItemMaster.

### 2b. UOM Master (`entities/UOMMaster`)
Unit of Measure definitions (e.g. Kg, Litres, Nos, Box).

| Field | Purpose |
|-------|---------|
| `uom_id` | Stored on all PO/MR/GRN lines as `uom_code` |
| `uom_name` | Displayed in dropdowns |

**Used in:** MR Wizard (step 2), PO Form, GRN Item entry, Invoice line items.

### 2c. Supplier (`entities/Supplier`)
The approved vendor list.

| Field | Purpose | Critical Dependency |
|-------|---------|---------------------|
| `supplier_id` | Unique identifier | Stored on PO, Invoice, PaymentRequest |
| `supplier_name` | Display name | Shown on all documents |
| `approval_status` | `APPROVED / PENDING / BLACKLISTED` | **Gates PO creation** |
| `phone` | WhatsApp number | Used in PO Share panel |
| `email` | Contact email | Used in PO Share panel |

**Critical Rule:** A PO can only be raised against an `APPROVED` supplier.
- If supplier is `PENDING` or `BLACKLISTED` → warning shown
- Only `admin` role can override with a mandatory written reason (`supplier_override_reason` field on PO)
- Regular `purchase_manager` **cannot** override — they will be blocked

---

## 3. STAGE 1 — MATERIAL REQUEST

**Page:** `pages/MaterialRequest.jsx`  
**Component:** `components/purchase/MRWizard.jsx` (create), `components/purchase/MRList.jsx` (list)  
**Entities:** `PurchaseRequest`, `PurchaseRequestItem`

### Who Can Create
Roles: `admin`, `purchase_manager`, `production_manager`

### 3-Step Wizard Flow

**Step 1 — Add Items:**
- Search box queries `ItemMaster` (active only, up to 500 records)
- Type to filter by `item_name` or `item_code`
- Select → `item_code` + `item_name` stored on line item
- Multiple items can be added

**Step 2 — Quantities & Dates:**
- For each selected item: enter `qty`, `uom_code` (from UOMMaster dropdown), `required_by` date
- Both `qty > 0` AND `required_by` are mandatory to proceed

**Step 3 — Confirm:**
- Optional: `department`, `notes`
- Submit creates records

### What Gets Created

```
PurchaseRequest {
  mr_id:          "MR-XXXXX"         ← random 5-char alphanumeric suffix
  request_date:   "YYYY-MM-DD"       ← today
  requested_by:   user.email
  department:     (optional)
  status:         "SUBMITTED"
  notes:          (optional)
  erp_sync_status: "NOT_SYNCED"
}

PurchaseRequestItem (one per line) {
  mr_id:       same as above
  item_code:   from ItemMaster
  item_name:   from ItemMaster
  uom_code:    from UOMMaster
  qty:         entered by user
  required_by: YYYY-MM-DD
  remarks:     (optional)
}
```

### FMS Event Fired
```js
triggerFMSProcess({
  triggerSource: 'purchase_request_created',
  triggerRefId: pr.id,           // PurchaseRequest record ID
  title: `Purchase Request ${mrId}`,
  triggerData: { mr_id, department, requested_by }
})
```
This **starts the FMS chain** — every subsequent document in this purchase cycle gets linked back to this chain.

### Audit Log
`AuditLog` created: `"MR {mrId} created and submitted"` — station: `PURCHASE`

### MR Status Lifecycle
```
SUBMITTED → APPROVED → ORDERED (when PO is raised)
          → REJECTED
```

### Approval Process
Handled by `ApprovalActionPanel` component:
1. Reads `DocumentApprovalRule` entity for `doc_type: "PurchaseRequest"`, `from_state: "SUBMITTED"`
2. Filters rules by `allowed_roles` (admin always sees all)
3. If rule has `require_reason: true` → reason textarea appears before action can proceed
4. On approval: `approved_by` + `approved_at` written to record
5. On rejection: `rejection_reason` + `rejected_by` written to record

> **Configuring approval rules:** Go to `ApprovalRulesManager` page → add a rule for `PurchaseRequest` with `from_state: SUBMITTED`, `to_state: APPROVED`, allowed roles, etc.

---

## 4. STAGE 2 — PURCHASE ORDER

**Page:** `pages/PurchaseOrders.jsx`  
**Component:** `components/purchase/POForm.jsx` (create), `components/purchase/POList.jsx` (list)  
**Entities:** `PurchaseOrder`, `PurchaseOrderItem`

### Who Can Create
Roles: `admin`, `purchase_manager`, `production_manager`

### Two Entry Points
1. **Standalone PO** — from `pages/PurchaseOrders` → "New Purchase Order" button → `POForm` with `sourceMR=null`
2. **From MR** — from `MRList` → expand an APPROVED MR → "Create Purchase Order →" → `POForm` pre-filled with MR items

### POForm Fields

**Supplier Selection:**
- Dropdown from `Supplier` entity (all suppliers, sorted by name)
- Shows approval status badge if not `APPROVED`
- Non-approved supplier → warning block with override option (admin only)

**Item Lines:**
- Same search-as-you-type from `ItemMaster` as in MR Wizard
- Per line: `item_code`, `item_name`, `uom_code` (from UOMMaster), `qty`, `rate` (₹), `schedule_date`, `remarks`
- `amount` = auto-calculated (`qty × rate`)
- `total_amount` = sum of all lines

**Terms & Conditions:** Optional text field.

### What Gets Created

```
PurchaseOrder {
  po_id:                    "PO-XXXXX"
  supplier_id:              from Supplier
  supplier_name:            from Supplier
  mr_id:                    sourceMR.mr_id (or empty if standalone)
  po_date:                  today YYYY-MM-DD
  status:                   "SUBMITTED"
  total_amount:             sum of line amounts
  terms:                    (optional)
  supplier_override_reason: (if non-approved supplier + admin)
  erp_sync_status:          "NOT_SYNCED"
}

PurchaseOrderItem (one per line) {
  po_id:          same as above
  item_code:      from ItemMaster
  item_name:      from ItemMaster
  uom_code:       from UOMMaster
  qty:            entered
  rate:           entered (₹ per unit)
  amount:         qty × rate
  schedule_date:  expected delivery date
  remarks:        (optional)
}
```

**Side effects on creation:**
- If linked to an MR → `PurchaseRequest.status` updated to `"ORDERED"`
- `AuditLog` created: `"PO {poId} created for supplier {name}"`

### FMS Events Fired

```js
// On PO creation (if linked to MR):
fireFMSEvent('purchase_order_created', sourceMR.id)
// Then link PO into the FMS chain:
const instances = await findFMSInstanceByRef(sourceMR.id)
for (const inst of instances) {
  linkFMSRef(inst.id, po.id)   // PO is now in ref_chain
}

// On PO approval (via ApprovalActionPanel):
fireFMSEvent('purchase_order_approved', po.id)
```

### PO Status Lifecycle
```
SUBMITTED
    │
    ├─ APPROVED   (via ApprovalActionPanel, approval rule required)
    │      │
    │      └─ SENT         (after sharing via WhatsApp / Email)
    │              │
    │              ├─ PART_RECEIVED  (manager marks manually)
    │              └─ CLOSED         (fully received / manually closed)
    │
    └─ REJECTED   (with rejection_reason)
```

### Sharing PO with Supplier
`POSharePanel` component — visible only when PO status is `APPROVED` or `SENT`:

**WhatsApp:**
- Requires `supplier.phone` to be set
- Opens `https://wa.me/{phone}?text={message}` in new tab
- Message includes: PO number, supplier, date, all items (name, qty, UOM, rate), total
- After sending: PO status → `SENT`, `sent_via: "WHATSAPP"`, `sent_at` timestamp

**Email:**
- Requires `supplier.email` to be set
- Opens `mailto:` link with pre-filled subject + body
- After sending: PO status → `SENT`, `sent_via: "EMAIL"`

---

## 5. STAGE 3 — GATE ENTRY

**Page:** `pages/GateEntry.jsx`  
**Entity:** `GateEntry`, `GateEntryChecklistRun`

### Purpose
Records the **physical arrival** of a vehicle/courier at the factory gate. This is the mandatory prerequisite for creating a GRN — you cannot receive goods into stock without a Gate Entry first.

### 3-Step Wizard

**Step 0 — Capture Photos:**
- Transport type: `vehicle` / `courier` / `on_foot`
- If vehicle: vehicle photo (mandatory) + invoice photo + material/goods photo
- If courier/on foot: invoice photo + material photo only
- Photos uploaded via `UploadFile` integration → URLs stored

**Step 1 — Enter Details:**
- `vehicle_number` (mandatory for vehicle type)
- `driver_name` (optional)
- `driver_number` (mandatory — must be valid 10-digit Indian mobile starting with 6-9)
- `notes` (optional)

**Step 2 — Review & Submit**

### What Gets Created

```
GateEntry {
  gate_id:        "GE-XXXX"     ← auto-generated via nextSerial()
  arrived_at:     ISO timestamp
  vehicle_number: (if vehicle)
  driver_name:    (optional)
  driver_number:  validated Indian mobile
  notes:          (optional)
  vehicle_photo:  file URL
  invoice_photo:  file URL
  material_photo: file URL
  status:         "OPEN"        ← key status
}
```

**Optional:** If a `ChecklistTemplate` exists for `station: "GATE_ENTRY"`, `type: "CREATE"` → checklist runs after submission. Creates `GateEntryChecklistRun` record.

### FMS Event
```js
fireFMSEvent('gate_entry_created', gateEntry.id)
```

### Gate Entry Status Lifecycle
```
OPEN  →  PROCESSED   (updated by GRN on submission)
```

### Impact on GRN
GRN page filters: `GateEntry.filter({ status: 'OPEN' })` — only OPEN entries appear for selection. Once a GRN is created against a gate entry, that gate entry is marked `PROCESSED` and will not appear again.

### UX Features
- `useDraftSave('gate_entry')` — form auto-saves to localStorage so gate guard never loses data
- Bilingual support: EN / HI (Hindi) toggle on all labels, validation messages, buttons

---

## 6. STAGE 4 — GOODS RECEIVED NOTE (GRN)

**Page:** `pages/GRNReceive.jsx`  
**Entities:** `GRNHeader`, `GRNItem`, `StoreLot`, `GateEntry` (updated)

### Purpose
Records **what was physically received** item by item against a Gate Entry. This is where **stock physically enters the system** — each GRN creates `StoreLot` records that become the stock balance.

### Prerequisite
A Gate Entry with status `OPEN` must exist.

### Item Source
GRN uses `StoreItemMaster` (NOT `ItemMaster`):
```js
base44.entities.StoreItemMaster.filter({ is_active: true }, 'item_name', 500)
```
Each `StoreItemMaster` item carries **validation rules** that are enforced per item:

| Rule Field | Behavior |
|-----------|---------|
| `batch_required` | Batch/Lot number becomes mandatory |
| `expiry_required` | Expiry date becomes mandatory |
| `mfg_date_required` | Manufacture date becomes mandatory |
| `qc_required` | Flags item for QC (informational) |
| `min_shelf_life_days` | Can be used for expiry validation |

### GRN Form Fields
- **Supplier Name** — CreatableSelect from `Supplier` entity
- **Invoice Number** — free text (mandatory)
- **Invoice Date** — date picker (mandatory)
- **Items:** For each line:
  - Item name/code (searchable from StoreItemMaster)
  - Original quantity ordered
  - Received quantity (can differ if `qty_mismatch: 'yes'`)
  - Mismatch type: `none` / `short` / `damaged` / `excess`
  - Mismatch reason (if mismatch)
  - Batch/Lot number (if `batch_required`)
  - Expiry date (if `expiry_required`)
  - Manufacture date (if `mfg_date_required`)
  - Material photo (optional)
  - Notes

### What Gets Created

```
GRNHeader {
  grn_id:          "GRN-{timestamp}"
  gate_id:         selected gate entry's gate_id
  supplier_name:   entered
  invoice_number:  entered
  invoice_date:    entered
  status:          "RECEIVED"
  received_at:     ISO timestamp
  received_by:     user.email
  notes:           (optional)
  checklist_run_id: (if checklist completed)
}

GRNItem (one per valid item line) {
  grn_id:          same as above
  item_code:       from StoreItemMaster
  item_name:       from StoreItemMaster
  ordered_qty:     original_quantity
  received_qty:    actual quantity (may differ from ordered)
  uom_code:        from StoreItemMaster
  batch_or_lot_text: (if batch_required)
  mismatch_type:   none / short / damaged / excess
  mismatch_reason: (if mismatch)
  damaged_qty:     ordered_qty - received_qty (if damaged)
  line_notes:      (optional)
}

StoreLot (one per valid item line) — THIS IS WHERE STOCK ENTERS {
  lot_id:              "LOT-{date}-{random}"
  qr_code:             same as lot_id
  item_code:           from StoreItemMaster
  item_name:           from StoreItemMaster
  uom:                 from StoreItemMaster
  original_quantity:   ordered qty
  quantity:            received qty
  remaining_quantity:  received qty (decrements as stock is consumed)
  mismatch_type:       carried from GRNItem
  batch_number:        (if captured)
  mfg_date:            (if captured)
  expiry_date:         (if captured)
  supplier_name:       from GRN
  invoice_number:      from GRN
  invoice_date:        from GRN
  gate_entry_id:       from selected gate entry
  grn_id:              same as GRNHeader
  status:              "approved"
}
```

**Side effects:**
- `GateEntry.status` → `"PROCESSED"` (gate entry no longer appears in GRN selection)

### FMS Event
```js
fireFMSEvent('grn_received', grnHeader.id)
```

### Optional Checklist Gate
If a `ChecklistTemplate` exists for `station: "GRN"`, `type: "RECEIVE"` → user must complete checklist before GRN is finalized.

### Draft Auto-Save
`useDraftSave('grn_receive')` — GRN form saves automatically. If session breaks, storekeeper can resume from where they left off. Clear draft button available.

### Status Note
⚠️ GRN is created with status `"RECEIVED"`. The QC Inbox filters for `"SUBMITTED_TO_QC"`. **There is a missing step** — something must change the GRN status to `SUBMITTED_TO_QC` before items appear in the QC Inbox. This is a known gap in the current implementation.

---

## 7. STAGE 5 — QC INSPECTION

**Page:** `pages/QCInbox.jsx`  
**Entities:** `QCInspection`, `QCInspectionItem`, `GRNHeader` (updated), `StockBalance` (via bin moves)

### Purpose
Quality team inspects items from a GRN and marks each item PASS / HOLD / FAIL.

### Prerequisite
`GRNHeader.status === "SUBMITTED_TO_QC"` (see gap note above)

### Per-Item Results
For each `GRNItem` in the GRN:
- **PASS** — item accepted, moves to staging/putaway bin
- **HOLD** — item stays in QC Hold bin for re-inspection
- **FAIL** — item rejected, moves to Rejected/RTV bin

### Overall Result Logic
```
Any FAIL → Overall = FAIL → GRN status = "QC_FAILED"
Any HOLD → Overall = HOLD → GRN status = "QC_HOLD"
All PASS → Overall = PASS → GRN status = "QC_PASSED"
```

### What Gets Created

```
QCInspection {
  qc_id:           "QC-{timestamp}"
  grn_id:          from selected GRN
  status:          PASS / HOLD / FAIL
  inspected_by:    user.email
  inspected_at:    ISO timestamp
  notes:           overall notes
  checklist_run_id: (if checklist completed)
  photos_json:     JSON array of photo URLs
}

QCInspectionItem (one per GRNItem) {
  qc_id:          same as above
  sku_code:       item_code
  item_name:      item_name
  grn_item_ref:   GRNItem.id
  sample_qty:     inspected quantity
  received_qty:   received quantity
  result:         PASS / HOLD / FAIL
  defect_notes:   (mandatory for HOLD/FAIL)
}
```

### Stock Bin Movements
Uses `getWorkflowBin()` and `moveAfterQC()` from `components/grn/stockLedger.js`:
- PASS items: moved from `QC_HOLD` bin → `RECEIVING` or `DEFAULT_PUTAWAY` bin
- FAIL items: moved from `QC_HOLD` bin → `REJECTED` or `RTV` bin

Bin types configured in `WorkflowBinConfig` entity.

### FMS Events
```js
fireFMSEvent('grn_qc_approved', grn.id)   // if PASS
fireFMSEvent('grn_qc_rejected', grn.id)   // if FAIL
```

### Optional Checklist Gate
If `ChecklistTemplate` for `station: "QC"`, `type: "INSPECT"` exists → must complete before submitting results.

### Photos
QC inspector can add photos (via camera or file). Uploaded via `UploadFile` integration, stored as JSON array.

---

## 8. STAGE 6 — INVOICE CAPTURE

**Page:** `pages/InvoiceCapture.jsx`  
**Entities:** `SupplierInvoice`, `SupplierInvoiceItem`

### Purpose
Accounts team captures the supplier's bill — either a physical invoice or PDF — and links it to the Purchase Order for 3-Way Match.

### 3-Step Wizard

**Step 1 — Upload Invoice File:**
- Accepts PDF or image (PNG, JPG)
- Uploads via `base44.integrations.Core.UploadFile`
- Returns `file_url` stored on `SupplierInvoice.invoice_file`

**Step 2 — Invoice Header Details:**
- Supplier (from `Supplier` entity dropdown)
- Invoice number, invoice date, total amount (₹)
- **Link to PO (optional but critical for 3-Way Match):**
  - "Find PO by Supplier" → queries `PurchaseOrder` filtered by `supplier_id`, status in `[APPROVED, SENT, PART_RECEIVED]`, within last 90 days
  - User selects the matching PO → `linked_po_id` stored

**Step 3 — Line Items:**
- Item search using `ItemSelector` component (searches `IngredientMaster` / items)
- Per line: `item_code`, `item_name`, `uom_code`, `qty`, `rate`, `amount`, `remarks`

### What Gets Created

```
SupplierInvoice {
  inv_id:         "PINV-{timestamp+random}"
  supplier_id:    from Supplier
  supplier_name:  from Supplier
  invoice_number: entered
  invoice_date:   YYYY-MM-DD
  invoice_amount: ₹ total
  invoice_file:   file URL
  status:         "DRAFT"
  linked_po_id:   PO.po_id (if linked)
  notes:          (optional)
  submitted_by:   user name / email
  submitted_at:   ISO timestamp
}

SupplierInvoiceItem (one per line) {
  inv_id:     same as above
  item_code:  selected
  item_name:  selected
  uom_code:   selected
  qty:        entered
  rate:       ₹ per unit
  amount:     qty × rate
  remarks:    (optional)
}
```

### FMS Event
```js
fireFMSEvent('invoice_captured', inv.id)

// If PO linked → also join invoice into the FMS chain:
const poRecord = await PurchaseOrder.filter({ po_id: poId })
const instances = await findFMSInstanceByRef(poRecord[0].id)
for (const inst of instances) {
  linkFMSRef(inst.id, inv.id)
}
```

### Invoice Status Lifecycle
```
DRAFT
  │
  └─ SUBMITTED          (currently status stays DRAFT; "SUBMITTED" is reserved for workflow)
        │
        └─ MATCHED_OK   (after 3-Way Match passes)
        └─ EXCEPTION    (after 3-Way Match fails)
              │
              └─ APPROVED_FOR_PAYMENT  (after Payment Request approved)
                    │
                    └─ PAID  (currently no "mark as paid" step — future improvement)
```

---

## 9. STAGE 7 — 3-WAY MATCH

**Page:** `pages/ThreeWayMatch.jsx`  
**Entities:** `MatchResult`, `SupplierInvoice` (updated), `AlertEvent`, `MatchToleranceConfig`

### Purpose
Validates that what was **ordered (PO)**, **received (GRN)**, and **billed (Invoice)** are consistent within defined tolerances before payment is approved.

### Prerequisite
- `SupplierInvoice` with status `DRAFT` or `SUBMITTED`
- `linked_po_id` must be set (match button disabled without it)

### The Match Algorithm (`perform3WayMatch` in `accountsHelpers.js`)

For each invoice line item:

```
1. Find matching PO item by item_code
   → Exception if not found in PO

2. Get QC-passed received quantities:
   maxPayableQty = MIN(PO ordered qty, QC-passed GRN received qty)

3. Quantity Check:
   If invoice qty > maxPayableQty:
     variance% = ((invoiceQty - maxPayableQty) / maxPayableQty) × 100
     If variance% > qty_over_tolerance_percent → EXCEPTION

   If invoice qty < maxPayableQty AND allow_under_delivery = false → EXCEPTION

4. Price Check:
   If invoice rate > PO rate:
     variance% = ((invoiceRate - poRate) / poRate) × 100
     If variance% > price_over_tolerance_percent → EXCEPTION
```

### Tolerance Configuration (`MatchToleranceConfig` entity)
| Field | Default | Meaning |
|-------|---------|---------|
| `qty_over_tolerance_percent` | 0 | % over-supply allowed (e.g. 5 = 5% over is OK) |
| `price_over_tolerance_percent` | 0 | % price increase allowed |
| `allow_under_delivery` | true | Whether under-delivery passes or fails |

### What Gets Created

```
MatchResult {
  match_id:           "MATCH-{timestamp+random}"
  inv_id:             invoice inv_id
  po_id:              linked_po_id
  status:             "OK" or "EXCEPTION"
  exception_summary:  joined exception messages
  details_json:       full per-item details (qty/price variances)
  matched_by:         user name/email
  matched_at:         ISO timestamp
}
```

**Side effects:**
- `SupplierInvoice.status` → `"MATCHED_OK"` or `"EXCEPTION"`
- If `EXCEPTION` → `AlertEvent` created (type: `INVOICE_EXCEPTION`, severity: `HIGH`, assigned to `accounts_manager`)

### FMS Event
```js
fireFMSEvent('three_way_match_done', inv.id)
```

### Impact on Payment
`PaymentRequests` page filters invoices by `status: 'MATCHED_OK'`. Only matched invoices can have a payment request raised against them. **This is the hard financial gate.**

---

## 10. STAGE 8 — PAYMENT REQUEST

**Page:** `pages/PaymentRequests.jsx`  
**Entities:** `PaymentRequest`, `SupplierInvoice` (updated)

### Prerequisite
`SupplierInvoice.status === "MATCHED_OK"` — only matched invoices appear in the dropdown.

### Create Payment Request
- Select invoice (filtered to `MATCHED_OK` only)
- Enter requested amount
- Optional notes
- Creates `PaymentRequest` with status `DRAFT`

```
PaymentRequest {
  payreq_id:         "PAY-{timestamp+random}"
  inv_id:            invoice inv_id
  supplier_id:       from invoice
  supplier_name:     from invoice
  requested_amount:  ₹ entered
  status:            "DRAFT"
  requested_by:      user name/email
  notes:             (optional)
}
```

### FMS Events
```js
fireFMSEvent('payment_request_created', inv.id)
// Link payment request into FMS chain:
const instances = await findFMSInstanceByRef(inv.id)
for (const inst of instances) {
  linkFMSRef(inst.id, payReqRecord.id)
}
```

### Payment Approval (Admin Only)
Only `user.role === 'admin'` sees Approve/Reject buttons.

**On Approve:**
- `PaymentRequest.status` → `"APPROVED"`
- `PaymentRequest.approved_by` + `approved_at` set
- `SupplierInvoice.status` → `"APPROVED_FOR_PAYMENT"`

**On Reject:**
- Prompts for rejection reason (via `prompt()` — basic browser dialog)
- `PaymentRequest.status` → `"REJECTED"`
- `rejection_reason` stored

### Payment Request Status Lifecycle
```
DRAFT → APPROVED  (admin)
      → REJECTED  (admin, with reason)
```

---

## 11. FMS CHAIN — COMPLETE TRACE

The FMS (Flow Management System) maintains a single `ref_chain` that threads all documents together. This enables full traceability from payment all the way back to the original Material Request.

```
MR created:         triggerFMSProcess({ triggerRefId: pr.id })
                    → Creates FMSProcessInstance with ref_chain = [pr.id]

PO created from MR: fireFMSEvent('purchase_order_created', mr.id)  
                    linkFMSRef(instance.id, po.id)
                    → ref_chain = [pr.id, po.id]

PO approved:        fireFMSEvent('purchase_order_approved', po.id)

Gate entry:         fireFMSEvent('gate_entry_created', gateEntry.id)
                    (Note: Gate Entry starts its own chain if not linked to PO)

GRN received:       fireFMSEvent('grn_received', grnHeader.id)

QC result:          fireFMSEvent('grn_qc_approved' OR 'grn_qc_rejected', grn.id)

Invoice captured:   fireFMSEvent('invoice_captured', inv.id)
                    linkFMSRef(instance.id, inv.id)  ← if PO linked
                    → ref_chain = [pr.id, po.id, inv.id]

3-Way Match:        fireFMSEvent('three_way_match_done', inv.id)

Payment request:    fireFMSEvent('payment_request_created', inv.id)
                    linkFMSRef(instance.id, payReq.id)
                    → ref_chain = [pr.id, po.id, inv.id, payReq.id]
```

---

## 12. ROLES & PERMISSIONS

| Role | Can Create MR | Can Approve MR | Can Create PO | Can Approve PO | Can Override Supplier | Can Approve Payment |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `purchase_manager` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `production_manager` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `accounts_manager` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `store_manager` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> MR/PO approval rules are **configurable** via `DocumentApprovalRule` entity — the above table reflects the code-level role checks. Approval panel also reads `DocumentApprovalRule` and `WorkflowChecklistConfig`.

---

## 13. COMPLETE ENTITY REFERENCE

| Entity | Module Stage | Key Fields | Links To |
|--------|-------------|-----------|---------|
| `ItemMaster` | Master | `item_code`, `item_name`, `is_active` | MR items, PO items |
| `UOMMaster` | Master | `uom_id`, `uom_name` | MR, PO, GRN lines |
| `Supplier` | Master | `supplier_id`, `approval_status`, `phone`, `email` | PO, Invoice, PayReq |
| `PurchaseRequest` | MR | `mr_id`, `status`, `requested_by`, `department` | PurchaseRequestItem |
| `PurchaseRequestItem` | MR | `mr_id`, `item_code`, `qty`, `required_by` | from ItemMaster |
| `PurchaseOrder` | PO | `po_id`, `supplier_id`, `mr_id`, `status`, `total_amount` | PurchaseOrderItem, Supplier |
| `PurchaseOrderItem` | PO | `po_id`, `item_code`, `qty`, `rate`, `amount` | from ItemMaster |
| `GateEntry` | Gate | `gate_id`, `status`, `vehicle_number`, `driver_number` | GRNHeader |
| `GRNHeader` | GRN | `grn_id`, `gate_id`, `supplier_name`, `status` | GRNItem, StoreLot |
| `GRNItem` | GRN | `grn_id`, `item_code`, `received_qty`, `mismatch_type` | from StoreItemMaster |
| `StoreLot` | GRN/Stock | `lot_id`, `item_code`, `remaining_quantity`, `grn_id` | Stock system |
| `StoreItemMaster` | GRN/Store | `item_code`, `batch_required`, `qc_required` | GRN validation |
| `QCInspection` | QC | `qc_id`, `grn_id`, `status` | QCInspectionItem |
| `QCInspectionItem` | QC | `qc_id`, `item_code`, `result`, `defect_notes` | GRNItem |
| `SupplierInvoice` | Invoice | `inv_id`, `linked_po_id`, `status`, `invoice_amount` | SupplierInvoiceItem |
| `SupplierInvoiceItem` | Invoice | `inv_id`, `item_code`, `qty`, `rate`, `amount` | — |
| `MatchToleranceConfig` | 3-Way Match | `qty_over_tolerance_percent`, `price_over_tolerance_percent` | controls match rules |
| `MatchResult` | 3-Way Match | `match_id`, `inv_id`, `po_id`, `status`, `exception_summary` | — |
| `PaymentRequest` | Payment | `payreq_id`, `inv_id`, `requested_amount`, `status` | SupplierInvoice |
| `DocumentApprovalRule` | Workflow | `doc_type`, `from_state`, `to_state`, `allowed_roles` | MR/PO approval |
| `WorkflowChecklistConfig` | Workflow | `doc_type`, `step`, `is_active` | Approval gates |
| `AuditLog` | Cross-cutting | `action`, `entity_type`, `entity_id`, `station` | All stages |
| `AlertEvent` | Cross-cutting | `event_type`, `severity`, `status` | 3-Way Match exceptions |

---

## 14. ID GENERATION PATTERNS

| Document | Pattern | Example |
|----------|---------|---------|
| Material Request | `MR-{5 random alphanum}` | `MR-K3P7X` |
| Purchase Order | `PO-{5 random alphanum}` | `PO-A9M2Q` |
| Gate Entry | `GE-{serial counter}` | `GE-0042` |
| GRN | `GRN-{timestamp base36 upper}` | `GRN-LQ4F8R` |
| QC Inspection | `QC-{timestamp base36 upper}` | `QC-LQ4G1T` |
| Supplier Invoice | `PINV-{timestamp+random}` | `PINV-LQ4G1TXYZ` |
| Match Result | `MATCH-{timestamp+random}` | `MATCH-LQ4G2QABC` |
| Payment Request | `PAY-{timestamp+random}` | `PAY-LQ4G3RPQR` |

---

## 15. KNOWN GAPS & IMPROVEMENT OPPORTUNITIES

| # | Gap | Location | Impact | Fix |
|---|-----|---------|--------|-----|
| 1 | **QC Status Gap** | `GRNReceive.jsx` creates status `RECEIVED` but `QCInbox.jsx` filters `SUBMITTED_TO_QC` | Items never appear in QC Inbox automatically | Add "Submit to QC" button on GRN detail, or auto-set `SUBMITTED_TO_QC` on creation if QC required |
| 2 | **No GRN↔PO Link** | GRN has no `po_id` field | 3-Way Match cannot trace GRN back to PO; relies only on Invoice↔PO link | Add `po_id` to GRNHeader; populate during gate entry or GRN creation |
| 3 | **Duplicate item masters** | ItemMaster (Purchase) vs StoreItemMaster (GRN) | Item can be ordered but not receivable if not in both | Sync/merge or use single source |
| 4 | **No "Mark as Paid"** | `PaymentRequests.jsx` — after APPROVED, lifecycle ends | No actual payment recording with date/cheque/NEFT reference | Add `PAID` status with `paid_at`, `payment_ref`, `payment_mode` |
| 5 | **No PO Acknowledgement** | PO goes `SUBMITTED → APPROVED → SENT` | No supplier confirmation recorded | Add `ACKNOWLEDGED` status + field for supplier confirmation reference |
| 6 | **Invoice line items manually re-entered** | `InvoiceCapture` has no "pull from GRN" feature | Data entry duplication, error risk | Add "Pull from GRN" to auto-fill invoice lines from matched GRN |
| 7 | **Supplier override not auditable** | `supplier_override_reason` stored on PO but not separately queryable | Compliance risk | Add dedicated alert or report for overridden POs |
| 8 | **Rejection dialog uses browser `prompt()`** | `PaymentRequests.jsx` — handleReject | Poor UX, can't be styled | Replace with proper modal/dialog component |
| 9 | **GRN ID uses `Date.now()`** | `GRNReceive.jsx` | Risk of duplicate IDs if two submissions happen in the same millisecond | Use `nextSerial('GRN')` like Gate Entry |

---

## 16. COMPONENT FILE MAP

```
pages/
  MaterialRequest.jsx       ← MR page shell
  PurchaseOrders.jsx        ← PO page shell
  GateEntry.jsx             ← Gate entry wizard
  GRNReceive.jsx            ← GRN creation + master list
  QCInbox.jsx               ← QC inspection page
  InvoiceCapture.jsx        ← Invoice capture wizard
  ThreeWayMatch.jsx         ← 3-way match page
  PaymentRequests.jsx       ← Payment requests page
  PurchaseReports.jsx       ← Reports

components/purchase/
  MRWizard.jsx              ← 3-step MR creation wizard
  MRList.jsx                ← MR accordion list
  POForm.jsx                ← PO creation form
  POList.jsx                ← PO accordion list with status actions
  POSharePanel.jsx          ← WhatsApp / Email PO sharing
  ApprovalActionPanel.jsx   ← Reusable approve/reject driven by DocumentApprovalRule
  WorkflowBanner.jsx        ← Status banner showing next steps
  purchaseHelpers.js        ← genId(), logPurchaseAudit(), STATUS_COLOR map

components/accounts/
  accountsHelpers.js        ← genId(), perform3WayMatch(), findCandidatePOs(),
                               logAccountsAudit(), INVOICE_STATUS_COLOR, PAYMENT_STATUS_COLOR
  ItemSelector.jsx          ← Item search component for Invoice

components/grn/
  grnHelpers.js             ← logGrnAudit(), getChecklistTemplate(), GRN_STATUS_COLOR
  ChecklistGate.jsx         ← Checklist completion flow
  stockLedger.js            ← getWorkflowBin(), moveAfterQC()

components/store/
  GRNItemCard.jsx           ← Per-item entry card in GRN
  GRNManualSupplierSelect.jsx ← Supplier search for GRN
  GRNDetailModal.jsx        ← View GRN details
  GRNPrintTemplate.jsx      ← Print GRN
  InvoicePreviewModal.jsx   ← View invoice photo

lib/
  useFMSAutoComplete.js     ← fireFMSEvent(), triggerFMSProcess(),
                               findFMSInstanceByRef(), linkFMSRef()
  fmsAppEvents.js           ← All FMS event key definitions
  serialCounter.js          ← nextSerial() for sequential IDs
  dateFormatter.js          ← formatDate(), formatDateTime()
```

---

## 17. SETUP CHECKLIST (For New Deployment)

Before the Purchase Module can be used, ensure the following master data is configured:

- [ ] **ItemMaster** — at least some active items with `item_code` and `item_name`
- [ ] **UOMMaster** — units of measure (Kg, Litres, Nos, Box, etc.)
- [ ] **Supplier** — at least one supplier with `approval_status: APPROVED`
- [ ] **StoreItemMaster** — for GRN to work; sync with ItemMaster or create separately
- [ ] **MatchToleranceConfig** — at least one active record (even with 0% tolerance)
- [ ] **DocumentApprovalRule** — configure approval rules for `PurchaseRequest` and `PurchaseOrder`
- [ ] **WorkflowBinConfig** — configure `QC_HOLD`, `RECEIVING`, `REJECTED`, `RTV` bins (for QC stock moves)
- [ ] **FMS Process** — configure an FMS process with `trigger_source: purchase_request_created` if workflow automation is needed