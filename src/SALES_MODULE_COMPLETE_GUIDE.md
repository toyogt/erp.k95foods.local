# K95 ERP — Sales Module Complete Guide
> Version: 2026-03 | Based on JSON workflow definitions

---

## 1. MODULE OVERVIEW

The Sales Module manages the complete lifecycle of a sales order — from creation to delivery and payment. It spans 5 core document types, each with its own strict workflow:

```
[Sales Order] → [Pick List] → [Delivery Note] → [Sales Invoice] → [Payment]
     SO              PL              DN                SI             PAY
```

**Supporting entities:**
- `SalesOrderItem` — Line items on the SO
- `SalesRateList` — Price list (drives item rates)
- `SalesAuditLog` — Immutable audit trail
- `SalesReturn` — Return document (triggered from SI)
- `SalesPayment` — Payment entries against SI
- `SalesSettings` — Config for transporters, packing types, etc.
- `Distributor` — Distributor master
- `DistributorRequest` — Orders raised by distributors

---

## 2. DOCUMENT WORKFLOWS (EXACT MATCH TO JSON)

---

### 2A. SALES ORDER (SO Minimal Workflow)
**Entity:** `SalesOrder`
**Field:** `workflow_state`

```
Draft
  │
  │ [Send for Logistics Review]   — Allowed: Sales Order Creator
  ▼
Under Logistics Review
  │
  │ [Approve for Picking]         — Allowed: Logistics Executive
  ▼
Ready to Pick & Pack
  │
  │ [Cancel]                      — Allowed: Cancelled Marker
  ▼
Cancelled
```

**workflow_state enum values:**
- `draft`
- `under_logistics_review`
- `ready_to_pick`
- `cancelled`

**Status field (operational tracking, not workflow):**
- `draft → confirmed → logistics_review → picking → packing → invoiced → delivered → paid → closed → cancelled`

**Key rules:**
- SO only holds 3 active workflow states. All picking/invoicing/delivery tracking lives on downstream documents.
- Transporter and packaging_type are set during logistics review before approval.
- Stock validation happens during logistics review (checked against `WarehouseLot`).

---

### 2B. PICK LIST (PL Minimal Workflow)
**Entity:** `SalesPicklist`
**Field:** `status`

```
Draft
  │
  │ [Dispatch Date Confirmed]     — Allowed: Factory Supervisor
  ▼
Dispatch Scheduled
  │
  │ [Pick & Packing Done]         — Allowed: Factory Supervisor
  ▼
Pick & Packed
  │
  │ [Cancel]                      — Allowed: Cancelled Marker
  ▼
Cancelled
```

**status enum values:**
- `draft`
- `dispatch_scheduled`
- `pick_packed`
- `cancelled`

**Key rules:**
- Picklist is generated from SO once it reaches `ready_to_pick`.
- Picklist carries: dispatch_date, appointment_date, expiry_date, transporter, packaging_type.
- Each picklist has `items[]` array with: sales_order_item_id, item_code, description, location, required_qty, picked_qty, status (pending/picked/short).
- After Pick & Pack is done, the Delivery Note is created next.

---

### 2C. DELIVERY NOTE (DN Minimal Workflow)
**Entity:** `SalesDeliveryNote`
**Field:** `workflow_state`

```
Waiting for Transporter
  │
  │ [Transporter Arrived]         — Allowed: Factory Supervisor
  ▼
Waiting for Loading to Complete
  │
  │ [Loading Completed]           — Allowed: Factory Supervisor
  ▼
Loading Completed & Waiting for Bills to Generate
  │
  │ [Bills Generated]             — Allowed: Accounts User
  ▼
Bills Generated
  │
  │ [Bills Cancelled]             — Allowed: Accounts User   ← REVERSE (back to Loading Completed)
  ◄─────────────────────────────────────────────────────────────────┘
  │
  │ [Cancel]                      — Allowed: DN Cancel Marker
  ▼
Cancelled
```

**workflow_state enum values:**
- `waiting_for_transporter`
- `waiting_for_loading`
- `loading_completed`
- `bills_generated`
- `cancelled`

**Cancel is allowed from:**
- `loading_completed`
- `bills_generated`

**"Bills Cancelled" reverse transition:**
- `bills_generated` → `loading_completed` (revert if bills need to be regenerated)

**Key rules:**
- DN is created after Pick & Pack is complete.
- DN carries: transporter_name, vehicle_number, lr_number, packaging_type, dispatch_date, appointment_date, expiry_date, total_qty, total_boxes.
- "Bills Generated" on DN signals that the Sales Invoice has been submitted with E-Invoice & E-Way Bill.

---

### 2D. SALES INVOICE (SI Minimal Workflow)
**Entity:** `SalesInvoice`
**Field:** `workflow_state`

#### FORWARD FLOW:
```
Draft
  │
  │ [Submit]                      — Allowed: Accounts User
  ▼
Waiting for E-Invoice & E-Way Bill
  │
  │ [Bills Generated]             — Allowed: Accounts User
  ▼
Waiting for Dispatch
  │
  │ [Dispatched]                  — Allowed: Dispatch Officer
  ▼
Waiting for Bilty
  │
  │ [Bilty Received]              — Allowed: Dispatch Officer
  ▼
Wait to Deliver
  │
  │ [POD Received]                — Allowed: Delivery User
  ▼
Delivered
```

#### RETURN FLOW (from Delivered):
```
Delivered
  │
  │ [Submit Return]               — Allowed: Return Creator
  ▼
Return Pending Approval
  │
  │ [Approve Return]              — Allowed: Return Approver
  ▼
Return Approved
  │
  │ [Complete Return]             — Allowed: Return Approver
  ▼
Return Completed
```

#### CANCEL (from multiple states):
- `waiting_for_e_invoice` → Cancelled
- `waiting_for_dispatch` → Cancelled
- `waiting_for_bilty` → Cancelled
- `wait_to_deliver` → Cancelled
- `delivered` → Cancelled
- `return_approved` → Cancelled
- `return_completed` → Cancelled

**workflow_state enum values:**
- `draft`
- `waiting_for_e_invoice`
- `waiting_for_dispatch`
- `waiting_for_bilty`
- `wait_to_deliver`
- `delivered`
- `return_pending_approval`
- `return_approved`
- `return_completed`
- `cancelled`

**Key rules:**
- Invoice is created from the SO Invoice panel.
- E-Invoice (IRN) and E-Way Bill are generated/entered in `waiting_for_e_invoice` state.
- LR / Bilty number is entered when moving to `wait_to_deliver`.
- POD date is captured when moving to `delivered`.
- Tally posting is a separate metadata action (NOT a workflow state) — stored as: `posted_to_tally`, `tally_voucher_no`, `tally_posted_date`, `tally_posted_by`.

---

## 3. DOCUMENT CHAIN RELATIONSHIP

```
SalesOrder (SO)
  ├── SalesOrderItem[] (line items)
  ├── SalesPicklist (PL)
  │     └── items[] (picked quantities)
  ├── SalesDeliveryNote (DN)
  └── SalesInvoice (SI)
        ├── SalesPayment[] (payment entries)
        └── SalesReturn (if returned)
```

**FMS Ref Chain:** Every document (SO, PL, DN, SI) is linked via `linkFMSRef(instanceId, docId)` so the full chain is traceable.

---

## 4. FMS EVENTS (MANDATORY — fire on every state transition)

| Event Key | Fired When | Source Doc ID |
|---|---|---|
| `sales_order_created` | SO created | SO.id |
| `sales_logistics_review` | SO → Under Logistics Review | SO.id |
| `sales_picking_started` | SO → Approved for Picking | SO.id |
| `sales_picklist_created` | PL created | SO.id |
| `sales_dispatch_scheduled` | PL → Dispatch Scheduled | PL.id |
| `sales_picklist_completed` | PL → Pick & Packed | PL.id |
| `sales_dn_created` | DN created | SO.id |
| `sales_dn_advanced` | DN advances any state | DN.id |
| `sales_dn_bills_generated` | DN → Bills Generated | DN.id |
| `sales_invoiced` | SI created | SO.id |
| `sales_invoice_submitted` | SI → Waiting for E-Invoice | SI.id |
| `sales_invoice_bills_generated` | SI → Waiting for Dispatch | SI.id |
| `sales_invoice_dispatched` | SI → Waiting for Bilty | SI.id |
| `sales_invoice_bilty_received` | SI → Wait to Deliver | SI.id |
| `sales_invoice_delivered` | SI → Delivered | SI.id |
| `sales_return_initiated` | SI → Return Pending Approval | SI.id |
| `sales_return_approved` | SI → Return Approved | SI.id |
| `sales_return_completed` | SI → Return Completed | SI.id |
| `sales_tally_posted` | Tally voucher entered on SI | SI.id |
| `sales_payment_received` | Payment recorded | SI.id |

---

## 5. ENTITY SCHEMAS (CORE FIELDS)

### SalesOrder
```json
{
  "so_number": "SO-XXXXXXX",
  "workflow_state": "draft | under_logistics_review | ready_to_pick | cancelled",
  "status": "draft | confirmed | logistics_review | picking | packing | invoiced | delivered | paid | closed | cancelled",
  "customer_name": "string",
  "customer_gstin": "string",
  "billing_address": "string",
  "shipping_address": "string",
  "po_number": "string",
  "po_date": "YYYY-MM-DD",
  "po_expiry_date": "YYYY-MM-DD",
  "payment_terms": "string",
  "transporter": "string",
  "packaging_type": "string",
  "taxable_amount": 0,
  "tax_amount": 0,
  "total_amount": 0,
  "source": "manual | pdf_upload | distributor_request | excel_upload",
  "platform": "blinkit | swiggy | zepto | direct | other",
  "stock_validation_status": "not_checked | full | partial | unavailable",
  "fms_instance_id": "string"
}
```

### SalesPicklist
```json
{
  "sales_order_id": "string",
  "so_number": "string",
  "picklist_number": "PL-XXXXXXX",
  "status": "draft | dispatch_scheduled | pick_packed | cancelled",
  "dispatch_date": "YYYY-MM-DD",
  "appointment_date": "YYYY-MM-DD",
  "expiry_date": "YYYY-MM-DD",
  "transporter": "string",
  "packaging_type": "string",
  "items": [
    {
      "sales_order_item_id": "string",
      "item_code": "string",
      "description": "string",
      "location": "string",
      "required_qty": 0,
      "picked_qty": 0,
      "status": "pending | picked | short"
    }
  ]
}
```

### SalesDeliveryNote
```json
{
  "sales_order_id": "string",
  "so_number": "string",
  "dn_number": "DN-XXXXXXXX",
  "workflow_state": "waiting_for_transporter | waiting_for_loading | loading_completed | bills_generated | cancelled",
  "status": "draft | loading | loaded | dispatched | delivered | cancelled",
  "transporter_name": "string",
  "vehicle_number": "string",
  "lr_number": "string",
  "packaging_type": "string",
  "dispatch_date": "YYYY-MM-DD",
  "appointment_date": "YYYY-MM-DD",
  "total_qty": 0,
  "total_boxes": 0,
  "cancellation_reason": "string"
}
```

### SalesInvoice
```json
{
  "sales_order_id": "string",
  "so_number": "string",
  "invoice_number": "INV-XXXXXXXX",
  "invoice_date": "YYYY-MM-DD",
  "workflow_state": "draft | waiting_for_e_invoice | waiting_for_dispatch | waiting_for_bilty | wait_to_deliver | delivered | return_pending_approval | return_approved | return_completed | cancelled",
  "status": "draft | sent | partially_paid | paid | overdue | cancelled",
  "customer_name": "string",
  "customer_gstin": "string",
  "taxable_amount": 0,
  "tax_amount": 0,
  "total_amount": 0,
  "irn": "string",
  "ack_number": "string",
  "ack_date": "YYYY-MM-DD",
  "eway_bill": "string",
  "eway_bill_date": "YYYY-MM-DD",
  "lr_number": "string",
  "lr_date": "YYYY-MM-DD",
  "pod_date": "YYYY-MM-DD",
  "posted_to_tally": false,
  "tally_voucher_no": "string",
  "tally_posted_date": "YYYY-MM-DD",
  "tally_posted_by": "user@email.com"
}
```

---

## 6. PAGE & COMPONENT MAP

### Pages
| Page | Route | Purpose |
|---|---|---|
| `SalesOrders` | `/SalesOrders` | List all SOs with filters |
| `SalesOrderDetail` | `/SalesOrderDetail?id=XXX` | Full SO view with all panels |
| `SalesDistributors` | `/SalesDistributors` | Distributor master management |
| `SalesRateListManager` | `/SalesRateListManager` | Price list management |
| `SalesSettingsPage` | `/SalesSettingsPage` | Transporters, packing types, MOQ, ClearTax |
| `DistributorPortal` | `/DistributorPortal` | Distributor self-service portal |

### Components (under `components/sales/`)
| Component | Purpose |
|---|---|
| `CreateSalesOrderModal` | Create SO (manual / PDF / Excel) |
| `SOItemsTable` | Display SO line items with totals |
| `SOStockPicklistPanel` | Logistics review + Picklist workflow |
| `SODeliveryNotePanel` | Delivery Note creation & workflow |
| `SOInvoicePanel` | Create invoice from SO |
| `EInvoicePanel` | Full SI workflow (E-Invoice → Dispatch → Bilty → POD → Return) |
| `SOPaymentPanel` | Record and view payments |
| `SOReturnPanel` | Initiate and track returns |
| `SOTimeline` | Audit log timeline |
| `SalesOrderStatusBadge` | Color-coded status pill |
| `K95InvoiceTemplate` | Print-ready GST invoice layout |
| `MOQConfigManager` | Min order qty config |
| `ClearTaxSettings` | ClearTax API config |
| `ExcelSOImport` | Bulk Excel import |
| `PDFPreviewPanel` | PDF parsed order preview |
| `DistributorRequestsTab` | View/manage distributor requests |

---

## 7. SO DETAIL PAGE — PANEL TABS

The `SalesOrderDetail` page has these tabs:

| Tab Key | Label | Component |
|---|---|---|
| `items` | Items | `SOItemsTable` |
| `logistics` | Logistics & Picking | `SOStockPicklistPanel` |
| `delivery` | Delivery Note | `SODeliveryNotePanel` |
| `invoice` | Invoice | `SOInvoicePanel` + `EInvoicePanel` |
| `payments` | Payments | `SOPaymentPanel` |
| `returns` | Returns | `SOReturnPanel` |
| `timeline` | Timeline | `SOTimeline` |

---

## 8. COMPLETE WORKFLOW VISUAL (END TO END)

```
[CUSTOMER PO RECEIVED]
        │
        ▼
[SO Created — Draft]
  Source: manual / PDF upload / Excel upload / Distributor request
        │
        │ Send for Logistics Review
        ▼
[SO — Under Logistics Review]
  - Set transporter & packaging type
  - Check stock availability (vs WarehouseLot)
        │
        │ Approve for Picking
        ▼
[SO — Ready to Pick & Pack]
  - Generate Pick List (PL)
        │
        ▼
[PL — Draft]
  - Confirm dispatch date / appointment date
        │
        │ Dispatch Date Confirmed
        ▼
[PL — Dispatch Scheduled]
  - Enter picked quantities for each item
        │
        │ Pick & Packing Done
        ▼
[PL — Pick & Packed]
        │
        ▼
[DN — Created: Waiting for Transporter]
  - Enter: transporter, vehicle, packaging type
        │
        │ Transporter Arrived
        ▼
[DN — Waiting for Loading to Complete]
        │
        │ Loading Completed
        ▼
[DN — Loading Completed & Waiting for Bills]
        │
        │ Bills Generated (Accounts triggers this)
        ▼
[DN — Bills Generated]
        │
        ▼
[SI — Created: Draft]
  - Auto-populated from SO: customer, amounts, items
        │
        │ Submit (Accounts User)
        ▼
[SI — Waiting for E-Invoice & E-Way Bill]
  - Generate IRN via ClearTax or enter manually
  - Generate E-Way Bill or enter manually
        │
        │ Bills Generated (Accounts User)
        ▼
[SI — Waiting for Dispatch]
        │
        │ Dispatched (Dispatch Officer)
        ▼
[SI — Waiting for Bilty]
  - Enter LR / Bilty number + date
        │
        │ Bilty Received (Dispatch Officer)
        ▼
[SI — Wait to Deliver]
        │
        │ POD Received (Delivery User)
        ▼
[SI — Delivered] ◄────────────────────────────────────────
        │                                                  │
        │ Post to Tally (metadata, no state change)        │
        │ Record Payments                                  │
        │                                                  │
        │ [If return needed]                               │
        │ Submit Return (Return Creator)                   │
        ▼                                                  │
[SI — Return Pending Approval]                            │
        │                                                  │
        │ Approve Return (Return Approver)                 │
        ▼                                                  │
[SI — Return Approved]                                    │
        │                                                  │
        │ Complete Return (Return Approver)                │
        ▼                                                  │
[SI — Return Completed] ──────────────────────────────────┘

[CANCEL PATH — from any allowed state → Cancelled]
```

---

## 9. RATE / PRICING LOGIC

- Rates are stored in `SalesRateList` entity.
- Each record has: `item_code`, `item_name`, `rate`, `mrp`, `igst_rate`, `packing_unit`, `price_list`, `brand`, `valid_from`, `valid_upto`.
- When creating an SO item, rate is looked up from `SalesRateList` by `item_code`.
- Rate is snapshotted on `SalesOrderItem.rate_snapshot` at time of order (so future rate changes don't affect existing orders).
- Tax is calculated as: `igst_rate` from rate list → split into CGST/SGST for intra-state, or kept as IGST for inter-state.
- `taxable_value = quantity × rate_snapshot`
- `igst_amount = taxable_value × igst_rate / 100`
- `total_amount = taxable_value + igst_amount`

---

## 10. GST / TAX CALCULATION ON INVOICE (K95InvoiceTemplate)

```
For Inter-State (IGST):
  Tax Amount = Taxable × IGST Rate%

For Intra-State (CGST + SGST):
  CGST = Taxable × (IGST Rate / 2)%
  SGST = Taxable × (IGST Rate / 2)%

Invoice Grand Total = Σ(Line taxable values) + Σ(Tax amounts)
```

State code comparison: if customer GSTIN state code ≠ company state code → IGST; else CGST+SGST.

---

## 11. AUDIT TRAIL

Every significant action writes to `SalesAuditLog`:

```json
{
  "entity_type": "SalesOrder | SalesPicklist | SalesDeliveryNote | SalesInvoice | SalesReturn | SalesPayment",
  "entity_id": "record id",
  "reference_number": "SO-XXX / PL-XXX / DN-XXX / INV-XXX",
  "action": "created | approved_for_picking | workflow_xxx | cancelled | ...",
  "field_name": "optional — which field changed",
  "old_value": "string",
  "new_value": "string",
  "user_email": "who did it",
  "notes": "optional"
}
```

---

## 12. SETTINGS (SalesSettings entity)

Stored as key-value records:

| setting_key | Purpose | Example values |
|---|---|---|
| `transporters` | List of transporter names | ["BlueDart", "DTDC", "Delhivery"] |
| `packing_types` | List of packaging types | ["Shrink Wrap", "Carton Box"] |
| `payment_terms` | Payment term options | ["30 Days", "45 Days", "Advance"] |

---

## 13. DISTRIBUTOR FLOW

```
Distributor logs into DistributorPortal
  → Raises DistributorRequest (items + quantities)
  → Sales team reviews in SalesOrders page
  → Converts to SO (source: distributor_request)
  → Normal SO flow continues
```

Distributors are managed in `SalesDistributors` page (`Distributor` entity).
Each distributor has: name, code, GSTIN, PAN, credit_limit, utilized_limit, status, payment_terms.

---

## 14. E-INVOICE INTEGRATION (ClearTax)

Backend function: `cleartaxGenerate`

Actions:
- `generate_irn` → returns `{ irn, ack_number, ack_date }`
- `generate_eway` → returns `{ eway_bill, eway_bill_date }` (requires IRN first)

Config stored in `SalesSettings` with `setting_key: 'cleartax'`.

IRN and E-Way Bill can also be entered manually if ClearTax is not configured.

---

## 15. ROLES USED IN WORKFLOWS

| Role Name | Permissions |
|---|---|
| Sales Order Creator | Create SO, send for logistics review |
| Logistics Executive | Approve SO for picking |
| Factory Supervisor | Confirm dispatch date, mark pick & pack done, transporter arrived, loading completed |
| Accounts User | Bills Generated on DN and SI, Submit SI for E-Invoice |
| Dispatch Officer | Mark Dispatched, Bilty Received on SI |
| Delivery User | Mark POD Received on SI |
| Return Creator | Submit Return from SI |
| Return Approver | Approve Return, Complete Return |
| Cancelled Marker | Cancel PL, DN, SI |
| DN Cancel Marker | Cancel DN |

---

## 16. KEY BUSINESS RULES

1. **SO cannot skip logistics review** — Every SO must go through logistics review before picking.
2. **Picklist is mandatory before Delivery Note** — DN creation assumes PL is pick_packed.
3. **IRN must be generated before E-Way Bill** — ClearTax requires IRN first.
4. **Tally posting does not change SI workflow state** — It is metadata-only.
5. **Returns can only be initiated from Delivered state** — Not from any earlier state.
6. **Rate is snapshotted at SO creation** — Changing rate list does not affect existing SOs.
7. **FMS events are mandatory** — Every state transition must fire the corresponding FMS event for traceability.
8. **All documents link into one FMS instance** — SO → PL → DN → SI all share the same `fms_instance_id`.
9. **Audit log every action** — Every create/update/cancel must write to `SalesAuditLog`.
10. **Stock check is advisory** — Logistics can approve even if stock is short (system shows warning, does not block).