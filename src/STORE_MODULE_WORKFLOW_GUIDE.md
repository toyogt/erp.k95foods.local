# K95 ERP — Store Management System (SMS)
## Complete Workflow Guide for First-Time Users

> **Version:** 1.0  
> **Last Updated:** 09/04/2026  
> **Audience:** Store Operators, Store Managers, Admins  
> **Module:** Store Management System (SMS)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Getting Started — Initial Setup](#2-getting-started--initial-setup)
3. [Store Item Master](#3-store-item-master)
4. [Store Dashboard](#4-store-dashboard)
5. [Gate Entry](#5-gate-entry)
6. [Goods Receipt Note (GRN)](#6-goods-receipt-note-grn)
7. [Putaway](#7-putaway)
8. [Lot Manager](#8-lot-manager)
9. [Stock Issue (Stock Out)](#9-stock-issue-stock-out)
10. [Internal Transfer](#10-internal-transfer)
11. [Cycle Count](#11-cycle-count)
12. [Stock Adjustments](#12-stock-adjustments)
13. [Reorder Configuration](#13-reorder-configuration)
14. [Reports](#14-reports)
15. [Location Manager](#15-location-manager)
16. [Complete Workflow — End to End](#16-complete-workflow--end-to-end)
17. [Frequently Asked Questions](#17-frequently-asked-questions)
18. [Glossary](#18-glossary)

---

## 1. Overview

The **Store Management System (SMS)** is the central module for tracking raw materials, packaging materials, and other store items from the moment they arrive at your factory gate until they are issued for production or dispatched.

### What SMS Does

- Tracks every item that enters the factory (Gate Entry → Goods Receipt → Putaway)
- Maintains real-time stock visibility across all storage locations
- Manages lot-level traceability with QR codes
- Enables FIFO-based stock issuance
- Provides alerts for low stock and expiry
- Supports physical stock verification (Cycle Count)
- Generates comprehensive reports for management

### The Core Flow

```
Supplier delivers material
        ↓
   Gate Entry (Security records the arrival)
        ↓
   Goods Receipt Note (Store verifies items + quantities)
        ↓
   Putaway (Items placed at specific rack/shelf locations)
        ↓
   Stock available for Issue / Transfer
        ↓
   Stock Issue (Material sent to Production / Dispatch)
```

---

## 2. Getting Started — Initial Setup

Before you start receiving materials, you need to set up two things:

### Step 1: Create Storage Locations

**Navigate to:** Store Management → Location Manager

Locations are the physical places where you store materials — racks, shelves, cold rooms, bins, etc.

1. Click **"Add Location"**
2. Enter a **Location Code** (e.g., `RACK-A1`, `COLD-01`, `BIN-05`)
3. Enter a **Display Name** (e.g., "Rack A - Shelf 1", "Cold Room 1")
4. Optionally assign a **Zone** (e.g., "Dry Store", "Cold Storage", "Chemical Store")
5. Click **Save**

> **Tip:** Keep location codes short and logical. Operators will scan or type these codes during putaway.

### Step 2: Set Up the Item Master

**Navigate to:** Store Management → Item Master

The Item Master is your centralized catalogue of all items that your store handles.

**Two ways to add items:**

**Option A — Import from System Masters** (Recommended for existing data)
1. Click **"Import from System"** button
2. You will see tabs for: Ingredients, Box Types, Caps, Containers, Flavours, Label Artworks
3. Select the items you want to track in the store
4. Click **"Import Selected"**
5. Items are created automatically with the correct category and unit of measure

**Option B — Create Manually**
1. Click **"Add Item"** (or the + button)
2. Fill in: Item Name, Category, Unit of Measure
3. Optionally upload a **Material Photo** (helps operators identify items visually)
4. Set **Validation Rules**:
   - **Batch Number Required** — forces batch entry during Goods Receipt
   - **Expiry Date Required** — forces expiry date entry
   - **Manufacture Date Required** — forces manufacture date entry
5. Enter **Opening Stock** if you have existing inventory
6. Click **Save**

> **Important:** Items imported from system masters (Ingredients, Boxes, Caps, etc.) show a "System" badge. Their core details (name, category, unit) are read-only to maintain consistency. You can still add a photo and edit opening stock.

---

## 3. Store Item Master

**Page:** Store Management → Item Master  
**Purpose:** Central repository of all items managed by the store

### What You See

| Column | Description |
|--------|-------------|
| Item Name | Name of the material (with photo thumbnail if uploaded) |
| Category | Type: Ingredient, Box Type, Cap Type, Container, Flavour, Label Artwork, Packaging, Other |
| Unit | Unit of Measure (Kg, Ltr, Nos, etc.) |
| Opening Stock | Initial stock quantity entered during setup |
| Current Stock | Live stock from all storage locations combined |
| Pending for Putaway | Quantity received via Goods Receipt but not yet placed at a storage location |
| Rules | Badges showing which validations are active (Batch, Expiry, Manufacture Date) |
| Status | Active or Inactive |

### Key Actions

- **Edit** (pencil icon): Update item details, photo, validation rules, opening stock
- **Delete** (trash icon): Remove an item (only if not referenced in any lot or transaction)
- **Search**: Filter items by name, category, or item code
- **Category Filter**: Dropdown to view items of a specific category only

---

## 4. Store Dashboard

**Page:** Store Management → Dashboard  
**Purpose:** At-a-glance view of your store's health

### Dashboard Cards

| Card | What It Shows |
|------|--------------|
| **Active Locations** | Number of storage locations currently in use |
| **Active Lots** | Total lot records that are not fully consumed |
| **Pending for Putaway** | Number of lots that have been received (via Goods Receipt) but not yet placed at a storage location |
| **Low Stock** | Number of items below their configured reorder level |

### Quick Actions

Six shortcut buttons to the most-used pages:
- Gate Entry
- Goods Receipt
- Putaway
- Stock Issue
- Transfer
- Reports

### Dashboard Sections

- **Current Stock Summary** — Top 10 stock entries (item, lot, location, quantity). Click "Full report" for the complete view.
- **Low Stock Alerts** — Items that have fallen below their reorder threshold. Red highlighted.
- **Expiry Alerts** — Lots expiring within the next 30 days. Shows aging badge (Week 1, Week 2, etc.).

---

## 5. Gate Entry

**Page:** Store Management → Gate Entry  
**Purpose:** Record the arrival of vehicles/deliveries at the factory gate

### When to Use

Every time a supplier vehicle arrives at the factory, the security personnel creates a Gate Entry.

### How It Works

1. **Open Gate Entry page** and click **"New Gate Entry"**
2. Fill in:
   - **Vehicle Number** — Truck / tempo registration number
   - **Driver Name** — Name of the driver
   - **Transporter Name** — Transport company name (smart searchable dropdown, you can add new transporters on the fly)
   - **Transport Type** — Select from available options (Truck, Tempo, Courier, etc.)
   - **Supplier Name** — Who is sending the material
   - **Purchase Order Reference** — Link to the Purchase Order number if available
   - **Invoice Photo** — Take a photo of the supplier's invoice (camera opens on mobile)
   - **Material Photo** — Take a photo of the delivered material for documentation
3. **Add Line Items** — List the materials being delivered:
   - Item Name (search from Item Master)
   - Quantity as per invoice
   - Unit of Measure
4. Click **"Submit Gate Entry"**

### What Happens Next

- A unique **Gate Entry ID** is generated (e.g., `GE-20260409-0001`)
- The entry appears in the **Gate Inbox** for the store team
- The store team will process this gate entry via the Goods Receipt Note

### Gate Entry History

- All past gate entries are shown in a list
- You can view details, see attached photos, and print the entry
- Use search to find entries by vehicle number, supplier, or Gate Entry ID

---

## 6. Goods Receipt Note (GRN)

**Page:** Store Management → Goods Receipt  
**Purpose:** Verify delivered items against the invoice and formally receive them into the store

### When to Use

After a Gate Entry is created, the store team processes it by creating a Goods Receipt Note. This is where you:
- Verify actual quantities against what was invoiced
- Record batch numbers, manufacture dates, expiry dates
- Note any mismatches (shortages, damages, excess)
- Assign a supplier and invoice number

### How It Works

1. Open the **Goods Receipt** page
2. You'll see a list of **Pending Gate Entries** — these are deliveries waiting to be processed
3. Click on a Gate Entry to start the Goods Receipt
4. **Step 1 — Supplier & Invoice Details:**
   - Select or search for the **Supplier** (dropdown shows suppliers mapped to the items in this delivery first)
   - Enter the **Invoice Number** from the supplier's invoice
   - Enter the **Invoice Date**
5. **Step 2 — Item Verification:**
   For each item in the delivery:
   - The system shows the expected quantity (from Gate Entry)
   - Enter the **Actual Received Quantity**
   - If there's a mismatch, select the **Mismatch Type**: Shortage, Excess, or Damage
   - Enter a **Mismatch Reason** if applicable
   - Enter **Batch Number** (if the item's validation rules require it)
   - Enter **Manufacture Date** (if required)
   - Enter **Expiry Date** (if required)
6. **Step 3 — Checklist** (Optional):
   - If quality checklists are configured, complete the checklist items
7. Click **"Submit Goods Receipt Note"**

### What Happens After Submission

- A unique **Goods Receipt Note ID** is generated (e.g., `GRN-20260409-0001`)
- **Lots are created automatically** — each line item becomes a **Store Lot** with:
  - A unique Lot ID (e.g., `LOT-20260409-0001`)
  - A QR code for scanning
  - Status set to **"Approved"** (ready for putaway)
  - All batch, date, and supplier information recorded
- The Gate Entry status is updated to **"Received"**
- An audit log entry is created for traceability

### Goods Receipt Note History

- All processed Goods Receipt Notes are listed with pagination
- Click **"View"** to see full details of any Goods Receipt Note
- Click **"Print"** to generate a printable Goods Receipt Note document

---

## 7. Putaway

**Page:** Store Management → Putaway  
**Purpose:** Assign received lots to physical storage locations

### When to Use

After a Goods Receipt Note is submitted, the lots are in "Approved" status — they have been received but don't have a storage location yet. Putaway is the process of placing these items at a specific rack/shelf/bin.

### How It Works

1. Open the **Putaway** page
2. You'll see two tabs:
   - **Pending** — Lots waiting to be stored (shows item name, lot ID, pending quantity)
   - **History** — Previously completed putaway records

3. **Adding Putaway Entries:**
   - Each entry requires:
     - **Location** — Search and select the storage location (e.g., RACK-A1)
     - **Lot** — Search and select the lot to store (shows item name and available quantity)
     - **Quantity** — How much to place at this location (can split a lot across multiple locations)
     - **Notes** — Optional remarks

4. **QR Scanning** (Mobile-friendly):
   - Click **"Scan Lot QR"** to scan a lot's QR code — it auto-fills the lot field
   - Click **"Scan Location"** to scan a location's QR code — it auto-fills the location field
   - You can also type codes manually

5. Click **"Add More Lots"** to add multiple putaway entries in one batch

6. Click **"Confirm Putaway"** to save all entries

### What Happens After Putaway

- A **Putaway Record** is created for each entry
- **Stock Balance** is updated — the system now knows exactly what's at each location
- The lot status changes to **"Putaway"** (if fully stored) or remains **"Approved"** (if partially stored)
- The Dashboard's "Pending for Putaway" count decreases

### Splitting a Lot

You can split one lot across multiple locations. For example:
- Lot LOT-20260409-0001: 100 Kg total
- Put 60 Kg at RACK-A1
- Put 40 Kg at RACK-B2

Just add two entries with different locations and quantities.

---

## 8. Lot Manager

**Page:** Store Management → Lot Manager  
**Purpose:** Complete visibility into all lots — their lifecycle, stock levels, and traceability

### What You See

The Lot Manager provides the most detailed view of every lot in the system. For each lot, you can see:

| Column | Description |
|--------|-------------|
| Lot ID | Unique system-generated identifier |
| Item | Item name and code |
| Batch | Batch number (if recorded) |
| Supplier | Supplier who delivered this lot |
| Original Quantity | Quantity as received in the Goods Receipt Note |
| Stored Stock | Quantity currently sitting at storage locations |
| Issued / Consumed | Quantity that has been issued for production or dispatch |
| Remaining Quantity | Stored Stock minus Issued (what's still available) |
| Pending to Store | Original minus Stored (what hasn't been put away yet) |
| Stored At | Which locations hold this lot's stock (with quantity at each) |
| Manufacture Date | When the material was manufactured |
| Expiry | When the material expires |
| Goods Receipt Note Age | Days since the Goods Receipt Note was created |
| Stock Age | Days since manufacture date |
| Status | Pending Putaway / Available for Issue / Partially Consumed / Fully Consumed / Rejected / Damaged |

### Key Features

- **Aging Legend** — Color-coded badges show how old each lot is (0–7 days green, 8–14 yellow, 15–30 orange, 30+ red)
- **QR Code** — Click the QR icon to view and print a 3" × 4" QR label for any lot
- **Invoice Preview** — Click the eye icon to view the supplier invoice photo attached during Gate Entry
- **Search & Filter** — Search by Lot ID, item name, supplier. Filter by status.
- **Export** — Download the full lot data as a CSV file

---

## 9. Stock Issue (Stock Out)

**Page:** Store Management → Stock Issue  
**Purpose:** Record material being taken out of the store — for production, dispatch, or internal use

### When to Use

When the production team needs ingredients, when packaging materials are sent to the labelling line, or when any item leaves the store.

### How It Works

1. Open the **Stock Issue** page
2. You'll see two tabs:
   - **New Issue** — Create a new stock issue
   - **Issue History** — View past issues

3. **Creating a Stock Issue:**
   - **Step 1 — Select Item:** Search for the item in the dropdown. It shows current stock levels.
   - **Step 2 — Select Lot:** The system shows available lots for this item, sorted by FIFO (First In, First Out — oldest first). Each lot shows:
     - Lot ID
     - Batch number
     - Manufacture date and expiry date
     - Available quantity at each location
   - **Step 3 — Select Location & Quantity:**
     - Choose which location to pick from (shows available stock per location)
     - Enter the quantity to issue
     - You can add multiple rows to pick from different locations/lots
   - **Step 4 — Issue Type:** Select the purpose (Production, Dispatch, Internal, Sample, Wastage, etc.)
   - **Step 5 — Notes** (optional)

4. Click **"Confirm Issue"**

### What Happens After Issue

- **Store Issue** and **Issue Line** records are created
- **Stock Balance** is deducted from the selected location
- **Lot status** is updated if fully consumed
- FIFO order is maintained for traceability
- The transaction appears in the Issue History

### Issue History

- Shows all past issues with item, lot, quantity, location, type, and who issued it
- Exportable to CSV for records

---

## 10. Internal Transfer

**Page:** Store Management → Transfer  
**Purpose:** Move stock from one storage location to another within the store

### When to Use

When you need to reorganize stock — moving items from one rack to another, consolidating partial quantities, or moving items to a different zone.

### Two Modes

**Manual Entry Mode:**
1. Select **Source Location** (dropdown shows all active locations)
2. Select **Lot** (dropdown shows lots available at the source location, with quantities)
3. Select **Destination Location**
4. Enter **Quantity** to transfer
5. Enter **Reason** (mandatory — e.g., "Reorganization", "Consolidation", "Space optimization")
6. Review the **Transfer Summary** (From → To with quantity)
7. Click **"Confirm Transfer"**

**QR / Barcode Scan Mode:**
1. **Step 1** — Scan or type the Source Location QR code
2. **Step 2** — Scan or type the Lot QR code (system verifies lot exists at this location)
3. **Step 3** — Scan or type the Destination Location QR code
4. Enter Quantity and Reason
5. Click **"Confirm Transfer"**

### What Happens After Transfer

- A **Transfer Record** is created with a unique Transfer ID
- Source location's stock balance is **decreased**
- Destination location's stock balance is **increased** (or created if the lot wasn't there before)
- The transfer appears in Transfer History

### Transfer History

- Shows all past transfers with source, destination, item, lot, quantity, reason, and timestamp
- Exportable to CSV

---

## 11. Cycle Count

**Page:** Store Management → Cycle Count  
**Purpose:** Physical stock verification — compare actual (counted) quantities with system quantities

### When to Use

Periodically (weekly, monthly, quarterly) to ensure the system's stock records match what's physically in the store. This is a standard inventory audit practice.

### How It Works

**Starting a Count Session:**
1. Enter a **Session Name** (e.g., "Monthly Count April 2026")
2. Click **"Start Session"**
3. The system automatically creates count entries for every item at every location (from current Stock Balance records)

**Performing the Count:**
For each entry, you'll see:
- Item name, Lot ID, Location
- **System Quantity** — What the system thinks is there

You need to:
1. Physically go to each location and count the actual quantity
2. Enter the **Physical Count**
3. Add **Notes** if needed
4. Click **"Record"**

**Handling Discrepancies:**
- If your physical count matches the system → **No variance** → Recorded as a perfect count
- If there's a difference → A **Discrepancy Modal** appears showing:
  - System quantity vs. Physical count
  - The variance (positive or negative)
  - Two options:
    - **Proceed** — Record the discrepancy without adjusting stock (for investigation)
    - **Adjust Putaway** — Immediately update the stock balance to match the physical count (enter adjusted quantity and reason)

**Session Progress:**
- Each session shows a progress bar (e.g., "15/42 counted — 36%")
- Sessions track how many discrepancies were found

---

## 12. Stock Adjustments

**Page:** Store Management → Adjustments  
**Purpose:** Formally request manual corrections to stock quantities

### When to Use

When stock needs to be adjusted outside normal transactions — for example:
- Damaged material discovered during storage
- Material found that wasn't in the system
- Spillage or breakage
- Correction after investigation

### Important: Approval Required

Stock adjustments are **not instant**. They follow a request → approval workflow:

1. **Any user** can submit an adjustment request
2. **Only admins** can approve or reject the request
3. Stock is only modified after admin approval

### How It Works

**Submitting a Request:**
1. Click **"Request Adjustment"**
2. Search and select the **Lot** (shows current stock)
3. Select **Adjustment Type**:
   - **Decrease** — Stock lost (damage, spillage, expiry)
   - **Increase** — Stock found (return, miscount correction)
4. Enter the **Quantity** to adjust
5. Select the **Location** where the adjustment applies
6. Enter a **Reason** (mandatory — detailed explanation)
7. Review the preview (Before → After quantity)
8. Click **"Submit Request"**

**Admin Approval:**
- Admins see all pending requests
- For each request, they can:
  - **Approve** ✓ — Stock balance is updated immediately
  - **Reject** ✗ — No change to stock

### What Happens After Approval

- **Decrease:** Stock balance at the selected location is reduced. If reduced to zero, the balance record is removed.
- **Increase:** Stock balance is increased (or a new balance record created).
- The lot's remaining quantity and status are recalculated automatically.

---

## 13. Reorder Configuration

**Page:** Store Management → Reorder Configuration  
**Purpose:** Set minimum stock thresholds and get alerts when items run low

### How It Works

1. Click **"Add Alert"**
2. Search and select an **Item** from the Item Master
3. Set the **Reorder Level** — the minimum stock quantity. When current stock falls to or below this level, an alert is triggered
4. Set **Suggested Reorder Quantity** (optional) — how much to order when restocking
5. Add **Alert Email Recipients** — comma-separated email addresses to notify
6. Click **Save**

### Alert Features

- Items below reorder level are highlighted in **red** on the dashboard
- Click the **Send Alert** button (mail icon) to immediately email all configured recipients with a formatted low-stock notification
- The email includes: item name, current stock, reorder level, and suggested order quantity

### Bulk Import

You can import reorder configs from a CSV/Excel file:
- Click **"Bulk Import"**
- Upload a file with columns: `item_code`, `item_name`, `uom`, `reorder_quantity`
- Records are created automatically

---

## 14. Reports

**Page:** Store Management → Reports  
**Purpose:** Comprehensive stock visibility and analysis across multiple dimensions

### Available Report Tabs

#### 1. Item Level Report
The most detailed view — shows every item with its total stock, broken down by lot and location.

**Features:**
- Search by item name or code
- Filter by location
- **Export to Excel** — Downloads all visible data as a CSV file
- For each item, shows: Lot ID, Location, Batch Number, Manufacture Date, Available Quantity, Expiry Date, Stored On date

#### 2. Stock by Location
Groups all stock entries by their storage location. Useful for:
- Knowing what's in each rack/shelf
- Planning physical walks for cycle count
- Identifying overloaded or empty locations

#### 3. Stock by Lot
Shows the master view of all lots with: Lot ID, Item, Supplier, Original Quantity, Remaining, Manufacture Date, Expiry, Aging badge, Status

#### 4. Batch Report
Groups lots by their Batch Number. Useful for:
- Tracing a specific supplier batch
- Quality investigations
- Recall scenarios

#### 5. Expiry Report
Sorted by expiry date (soonest first). Shows:
- Days until expiry (color-coded: expired, <7 days, <30 days)
- Remaining quantity
- Helps prioritize FIFO usage

#### 6. Manufacture Date Report
Shows stock age based on manufacture date. Color-coded:
- 0–7 days (green), 8–14 (yellow), 15–30 (orange), 30+ (red)
- Helps monitor freshness

#### 7. Transfer History
All internal transfers with: Transfer ID, Item/Lot, From, To, Quantity, Reason, Who/When

#### 8. Reorder Alerts
Shows all items currently below their reorder level with current stock and suggested order quantity

---

## 15. Location Manager

**Page:** Store Management → Location Manager  
**Purpose:** Create and manage physical storage locations

### How It Works

1. Click **"Add Location"**
2. Fill in:
   - **Location Code** — Short, unique identifier (e.g., `RACK-A1`, `COLD-01`)
   - **Display Name** — Human-friendly name (e.g., "Rack A - Shelf 1")
   - **Zone** (optional) — Logical grouping (e.g., "Dry Store", "Cold Room", "Chemical Store")
3. Toggle **Active/Inactive** to enable or disable a location

### Location Codes

Location codes are used throughout the system:
- In Putaway — to assign items to locations
- In Stock Issue — to pick from specific locations
- In Transfer — as source and destination
- In QR scanning — codes can be printed as QR labels for locations

---

## 16. Complete Workflow — End to End

Here's the complete journey of a material from arrival to consumption, step by step:

### Day 1: Material Arrives

```
1. Security creates GATE ENTRY
   → Records vehicle, driver, supplier, takes invoice photo
   → Gate Entry ID: GE-20260409-0001
   
2. Store team processes GOODS RECEIPT NOTE
   → Verifies quantities, records batch/expiry/mfg dates
   → Notes any shortages or damages
   → Goods Receipt Note ID: GRN-20260409-0001
   → Lots auto-created: LOT-20260409-0001, LOT-20260409-0002
   
3. Store team does PUTAWAY
   → Places LOT-20260409-0001 at RACK-A1 (60 Kg)
   → Places LOT-20260409-0001 at RACK-A2 (40 Kg)
   → Places LOT-20260409-0002 at COLD-01 (25 Ltr)
```

### Day 3: Production Needs Material

```
4. Production request comes in → Store team creates STOCK ISSUE
   → Selects item: "Cranberry Flavour"
   → System suggests LOT-20260409-0002 (oldest first — FIFO)
   → Issues 10 Ltr from COLD-01
   → Stock balance: 25 → 15 Ltr remaining
```

### Day 5: Stock Reorganization

```
5. Store team does INTERNAL TRANSFER
   → Moves 20 Kg from RACK-A1 to RACK-C3
   → Reason: "Space optimization for new delivery"
   → RACK-A1: 60 → 40 Kg
   → RACK-C3: 0 → 20 Kg
```

### End of Month: Stock Verification

```
6. Store manager starts CYCLE COUNT
   → Session: "Monthly Count April 2026"
   → System creates entries for all 45 stock balance records
   → Team physically counts each location
   → 2 discrepancies found and investigated
   → 1 adjustment approved by admin
```

### Ongoing: Monitoring

```
7. DASHBOARD shows:
   → 3 items below reorder level (Low Stock Alerts)
   → 2 lots expiring within 30 days (Expiry Alerts)
   → Reorder email sent to purchase team
```

---

## 17. Frequently Asked Questions

**Q: Can I undo a Goods Receipt Note?**  
A: No. Once submitted, a Goods Receipt Note cannot be reversed. If there's an error, use Stock Adjustments to correct quantities and note the reason.

**Q: What happens if I receive less quantity than expected?**  
A: During Goods Receipt, select "Shortage" as the mismatch type. The lot is created with the actual received quantity, and the mismatch is recorded for investigation.

**Q: Can I issue stock from multiple locations in one transaction?**  
A: Yes. In Stock Issue, add multiple rows — each row can pick from a different lot and location.

**Q: How does FIFO work?**  
A: When selecting lots for Stock Issue, the system sorts available lots by manufacture date (oldest first) and then expiry date. This ensures older stock is used before newer stock.

**Q: What's the difference between a Lot and a Batch?**  
A: A **Lot** is a system-generated record for each line item in a Goods Receipt Note. A **Batch** is the supplier's batch/production number. Multiple lots can have the same batch number (e.g., if the same batch arrives in two deliveries).

**Q: Can multiple users work simultaneously?**  
A: Yes. The system handles concurrent access. However, it's best to coordinate putaway and stock issue to avoid picking from the same stock simultaneously.

**Q: How do I track who did what?**  
A: Every transaction records the user's email and timestamp. The Lot Manager shows all movements. The Audit Log (accessible to admins) provides a complete trail.

**Q: What if my physical count shows more stock than the system?**  
A: During Cycle Count, record the actual quantity. Then submit a Stock Adjustment (Increase type) with the reason. Admin approves, and the system is corrected.

---

## 18. Glossary

| Term | Definition |
|------|-----------|
| **Gate Entry** | Record of a vehicle/delivery arriving at the factory gate |
| **Goods Receipt Note (GRN)** | Formal verification and acceptance of delivered materials into the store |
| **Lot** | A system-generated record representing a specific quantity of an item received in one Goods Receipt transaction. Has a unique ID and QR code |
| **Putaway** | The process of placing received material at a specific storage location |
| **Stock Balance** | The current quantity of a lot at a specific location |
| **Stock Issue** | Record of material being taken out of the store (for production, dispatch, etc.) |
| **FIFO** | First In, First Out — the principle of using the oldest stock first |
| **Cycle Count** | Physical verification of stock quantities against system records |
| **Stock Adjustment** | A formal request to manually correct stock quantities (requires admin approval) |
| **Reorder Level** | The minimum stock threshold below which a low-stock alert is triggered |
| **Internal Transfer** | Moving stock from one storage location to another within the store |
| **Mismatch** | Discrepancy between expected and actual quantity during Goods Receipt (Shortage, Excess, or Damage) |
| **QR Code** | A scannable code on each lot label, used for quick identification during putaway, issue, and transfer |
| **Store Item Master** | The central catalogue of all items managed by the store, with validation rules |
| **Location Code** | Unique identifier for a physical storage position (rack, shelf, bin) |
| **Zone** | Logical grouping of locations (e.g., "Dry Store", "Cold Room") |

---

*This guide covers the complete Store Management System workflow. For technical setup, permissions, or system administration, please refer to the K95 Development Standards documentation or contact your system administrator.*