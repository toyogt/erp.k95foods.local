# Store Management System (SMS) — Flow Diagram

## Overview

The Store Management System handles the complete lifecycle of raw material and packing material inventory — from receiving stock into stores, storing it in locations, issuing it for production/dispatch, and tracking balances.

---

## Module Entry Points

```
┌───────────────────────────────────────────────────────────┐
│                    SMS Dashboard                          │
│              (Landing page for Store users)               │
│                                                           │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│   │ Stock    │  │ Pending  │  │ Recent   │              │
│   │ Summary  │  │ Actions  │  │ Activity │              │
│   └──────────┘  └──────────┘  └──────────┘              │
└───────────────┬───────────────────────────────────────────┘
                │
    ┌───────────┴───────────────────────────────────────────┐
    ▼           ▼           ▼           ▼           ▼       ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│Opening │ │Putaway │ │Stock   │ │Transfer│ │Cycle   │ │Reports │
│Stock   │ │        │ │Out     │ │        │ │Count   │ │        │
└────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
```

---

## Tab-by-Tab Flow

### 1. Opening Stock (SMSOpeningStock)
**Purpose:** Load initial stock balances when the system first starts or for new items.

```
Start here when: Setting up store for the first time or adding a new material

Flow:
  User → Opens "Opening Stock" tab
    → Selects Item (searchable dropdown)
    → Enters Lot ID, Location, Quantity, Manufacturing Date, Expiry Date
    → Clicks "Add Opening Stock"
    → System creates:
        ├── StoreLot record (lot details)
        ├── StoreStockBalance record (quantity at location)
        └── Audit log entry

  Next step: Stock is now available for Issue or Transfer
```

### 2. Putaway (SMSPutaway)
**Purpose:** Place received goods into specific storage locations after Goods Receipt.

```
Start here when: Goods Receipt (GRN) is completed and items need to be shelved

Flow:
  User → Opens "Putaway" tab
    → Views pending putaway list (from GRN receiving)
    → Scans/selects Lot QR
    → Selects destination Location (searchable)
    → Confirms putaway quantity
    → System updates:
        ├── StoreLot.current_location
        ├── StoreStockBalance (creates/updates for new location)
        ├── StorePutaway record (logged)
        └── Audit log entry

  Next step: Stock is available at the location for Issue
```

### 3. Stock Issue / Stock Out (SMSStockOut)
**Purpose:** Issue materials for production, dispatch, or internal use.

```
Start here when: Production needs raw materials or packing materials

Flow:
  User → Opens "Stock Out" tab
    → Selects Issue Type (Production / Dispatch / Internal)
    → Enters Reference Number (Production Order / Dispatch reference)
    → For each item:
        ├── Searches Item Name (searchable dropdown with code)
        ├── Searches/Scans Lot ID (searchable dropdown + camera scan)
        ├── System shows available stock per lot (FIFO locations)
        └── Enters Quantity to issue
    → Clicks "Confirm Stock Issue"
    → System processes (FIFO):
        ├── Creates StoreIssue header
        ├── Creates StoreIssueLine for each item-lot-location
        ├── Deducts StoreStockBalance (deletes if zero)
        ├── Updates StoreLot.remaining_quantity
        └── Audit log entry

  Next step: Material is consumed; balance reflects the deduction
```

### 4. Transfer (SMSTransfer)
**Purpose:** Move stock between locations within the store.

```
Start here when: Stock needs to be relocated (e.g., bulk storage → near production)

Flow:
  User → Opens "Transfer" tab
    → Scans/selects source Lot
    → Selects source Location
    → Selects destination Location
    → Enters transfer Quantity
    → Clicks "Confirm Transfer"
    → System updates:
        ├── Creates StoreTransfer record
        ├── Deducts from source StoreStockBalance
        ├── Adds to destination StoreStockBalance
        └── Audit log entry

  Receiving end:
    Destination store user → Opens "Transfer Receiving" (TransferReceiving page)
      → Views pending transfers
      → Confirms received quantity
      → System finalises the transfer

  Next step: Stock reflected at new location
```

### 5. Cycle Count (SMSCycleCount)
**Purpose:** Verify physical stock matches system records.

```
Start here when: Scheduled stock audit or discrepancy investigation

Flow:
  User → Opens "Cycle Count" tab
    → Creates new count session
    → Selects Location(s) to count
    → For each item at location:
        ├── System shows expected quantity
        ├── User enters actual physical count
        └── System calculates variance
    → Submits count results
    → System creates:
        ├── StoreCycleCount record
        ├── Variance report
        └── If adjustment needed → links to Adjustments tab

  Next step: Review variances → Create adjustments if needed
```

### 6. Adjustments (SMSAdjustments)
**Purpose:** Correct stock discrepancies found during cycle counts or damage reports.

```
Start here when: Cycle count variance detected, damage, or expiry write-off

Flow:
  User → Opens "Adjustments" tab
    → Creates new adjustment
    → Selects Item, Lot, Location
    → Enters adjustment quantity (positive = add, negative = deduct)
    → Selects Reason (Damage / Expiry / Count Variance / Other)
    → Adds notes/remarks
    → Clicks "Confirm Adjustment"
    → System updates:
        ├── Creates StoreAdjustment record
        ├── Updates StoreStockBalance
        ├── Updates StoreLot.remaining_quantity
        └── Audit log entry

  Next step: Stock corrected; visible in Reports
```

### 7. Locations (SMSLocationManager)
**Purpose:** Manage storage locations (zones, racks, bins).

```
Admin/Setup flow:
  User → Opens "Locations" tab
    → Creates locations with:
        ├── Code (e.g., ZONE-A-RACK-1-BIN-3)
        ├── Display Name
        ├── Zone grouping
        └── Active/Inactive flag

  Used by: Putaway, Transfer, Stock Out, Cycle Count
```

### 8. Lot Manager (SMSLotManager)
**Purpose:** View and manage lot records.

```
  User → Opens "Lot Manager" tab
    → Views all lots with:
        ├── Lot ID, Item, Quantity, Remaining
        ├── Manufacturing Date, Expiry Date
        ├── Status (active / consumed / expired)
        └── Current Location

  Filters: By item, status, expiry range
```

### 9. Reorder Configuration (SMSReorderConfig)
**Purpose:** Set minimum stock levels and reorder points.

```
  User → Opens "Reorder Config" tab
    → For each item:
        ├── Sets Reorder Level (trigger point)
        ├── Sets Reorder Quantity
        └── Sets Maximum Stock Level

  System alerts when stock falls below reorder level
```

### 10. Reports (SMSReports)
**Purpose:** View stock reports, movement history, and analytics.

```
  User → Opens "Reports" tab
    → Available reports:
        ├── Current Stock Summary (by item / location)
        ├── Movement History (in/out/transfer timeline)
        ├── Expiry Report (items approaching expiry)
        ├── Consumption Report (issue trends)
        └── Variance Report (from cycle counts)
```

### 11. Store Settings (SMSStoreSettings)
**Purpose:** Configure store-level settings.

```
  Admin → Opens "Store Settings" tab
    → Configures:
        ├── Manual entry allowed (QR-only vs manual + QR)
        ├── FIFO enforcement level
        ├── Default issue type
        └── Expiry warning days
```

---

## Cross-Tab Navigation Flow

```
                    ┌────────────────┐
                    │  GRN Receive   │  (Purchase module)
                    │  completes     │
                    └───────┬────────┘
                            ▼
                    ┌────────────────┐
                    │   Putaway      │  Shelve received goods
                    └───────┬────────┘
                            ▼
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
     ┌──────────────┐ ┌──────────┐ ┌──────────────┐
     │  Stock Out   │ │ Transfer │ │  Cycle Count │
     │  (Issue)     │ │          │ │              │
     └──────┬───────┘ └─────┬────┘ └──────┬───────┘
            │               │              │
            ▼               ▼              ▼
     ┌──────────────┐ ┌──────────┐ ┌──────────────┐
     │  Production  │ │ Transfer │ │  Adjustments │
     │  / Dispatch  │ │ Receiving│ │              │
     └──────────────┘ └──────────┘ └──────────────┘
                            │
                            ▼
                    ┌────────────────┐
                    │   Reports      │  View all movements
                    └────────────────┘
```

## Key Rules

1. **FIFO Enforcement:** Stock Out always deducts oldest lot first (by manufacturing date)
2. **QR Scanning:** Lot ID can be scanned via camera or typed manually (if enabled in settings)
3. **Audit Trail:** Every stock movement creates an audit log entry
4. **Real-time Balances:** StoreStockBalance is updated immediately on every transaction
5. **Lot Lifecycle:** ACTIVE → partially consumed → CONSUMED (when remaining = 0)
6. **Transfer requires receiving:** Destination must confirm receipt before balance is finalised