# Event-Driven Traceability & Genealogy Guide

## Overview

A comprehensive **event-driven traceability system** that creates a complete genealogy of every material and product through the factory workflow. Enables full backward trace (sources) and forward trace (derivatives) for complaints, recalls, and yield investigation.

**Capabilities:**
- ✅ Full backward trace from finished goods to raw material sources
- ✅ Forward trace from raw material lots to all derived products and dispatches
- ✅ Visual timeline showing all transformations and movements
- ✅ Yield loss tracking and analysis
- ✅ Exportable PDF/CSV reports for regulatory compliance
- ✅ Support for multi-step production workflows
- ✅ Critical event flagging (rejects, rework, major loss)
- ✅ Event-driven (not status snapshots) = immutable audit trail

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Business Pages (Warehouse, Production, Labelling, etc.) │
│ - Receive raw materials                                 │
│ - Create batches, mix, fill crates                      │
│ - Build pallets, dispatch                               │
└────────────────────┬────────────────────────────────────┘
                     ↓
        ┌────────────────────────────────┐
        │ fireTraceEvent() Helpers        │
        │ fireRMInward()                  │
        │ fireQCRelease()                 │
        │ fireBatchCreation()             │
        │ fireFillingOutput()             │
        │ firePalletBuild()               │
        │ fireDispatch()                  │
        │ etc.                            │
        └────────────────┬────────────────┘
                         ↓
        ┌────────────────────────────────┐
        │ TraceEvent Entity (immutable)   │
        │ - Event ID (unique)             │
        │ - Source & Target entities      │
        │ - Quantity, unit, loss          │
        │ - Timestamp, user, device       │
        │ - Module context                │
        └────────────────┬────────────────┘
                         ↓
        ┌────────────────────────────────┐
        │ Traceability Engine             │
        │ getBackwardTrace()              │
        │ getForwardTrace()               │
        │ getCompleteGenealogy()          │
        │ getBatchTrace()                 │
        │ getBatchYieldAnalysis()         │
        └────────────────┬────────────────┘
                         ↓
        ┌────────────────────────────────┐
        │ Traceability Explorer UI        │
        │ - Search by batch/lot/crate     │
        │ - Visual timeline               │
        │ - Backward/forward tree         │
        │ - Export reports                │
        └────────────────────────────────┘
```

## Core Concepts

### Trace Events

Every significant action in the factory creates an immutable event:

```javascript
{
  event_id: 'evt_1234567890_abc123',
  event_type: 'FILLING_OUTPUT',              // Type of action
  timestamp: '2026-03-19T10:30:00Z',        // When it happened
  module: 'PRODUCTION',                      // Which module
  site_id: 'site_001',                       // Which factory
  
  // Source → Target transformation
  source_entity_type: 'Batch',
  source_entity_id: 'B001',
  target_entity_type: 'Crate',
  target_entity_id: 'C001',
  
  // Quantity tracking
  quantity: 100,
  unit: 'bottles',
  
  // Context references
  batch_id: 'B001',
  sku: 'PRODUCT_001',
  session_id: 'shift_20260319_001',
  
  // Who & where
  user_email: 'operator@factory.local',
  device_id: 'station_filling_01',
  
  // Loss tracking
  yield_loss: 0,
  loss_reason: null,
  is_critical: false,
  
  // Optional notes
  remarks: 'Batch completed successfully'
}
```

### Traceability Chains

Events form chains through entity IDs:

**Backward Trace Example:**
```
Raw Material Lot A
    ↓ (RM_INWARD event)
QC Released
    ↓ (ISSUE_TO_BATCH event)
Batch B001
    ↓ (BATCH_CREATION event)
Filled into Crate C001
    ↓ (FILLING_OUTPUT event)
...
Finished Dispatch DOC123
```

**Forward Trace Example:**
```
Lot A (raw material)
    ↓
Batch B001
    ↓
Crate C001
    ↓
Pallet P001
    ↓
Dispatch DOC123
    ↓ (customer received)
```

## Using in Pages

### Step 1: Import Helper

```javascript
import { fireTraceEvent, fireFillingOutput, fireBatchCreation } from '@/lib/traceEventHelper';
import { base44 } from '@/api/base44Client';

export default function FillingPage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => setUser(u));
  }, []);
```

### Step 2: Fire Event on Action

**Batch Creation:**
```javascript
const handleCreateBatch = async (batchData) => {
  try {
    // Create batch
    const batch = await base44.entities.Batch.create(batchData);

    // Fire trace event
    await fireBatchCreation({
      batchId: batch.id,
      sku: batchData.sku,
      productName: batchData.product,
      quantity: batchData.planned_qty_liters,
      unit: 'liters',
      user,
      device: sessionStorage.getItem('device_id'),
      remarks: `Batch created for product ${batchData.product}`,
    });

    toast.success('Batch created and trace event logged');
  } catch (error) {
    toast.error(error.message);
  }
};
```

**Material Filling:**
```javascript
const handleFillCrate = async (crateData) => {
  try {
    // Fill crate
    const crate = await base44.entities.Crate.create(crateData);

    // Fire trace event
    await fireFillingOutput({
      batchId: currentBatch.id,
      crateId: crate.id,
      quantity: crateData.bottle_count,
      unit: 'bottles',
      user,
      device: sessionStorage.getItem('device_id'),
    });

    toast.success('Crate created - genealogy traced');
  } catch (error) {
    toast.error(error.message);
  }
};
```

**Dispatch:**
```javascript
const handleDispatch = async (dispatchData) => {
  try {
    // Create dispatch
    const dispatch = await base44.entities.Dispatch.create(dispatchData);

    // Fire trace event
    await fireDispatch({
      dispatchId: dispatch.id,
      palletId: dispatchData.pallet_id,
      sku: dispatchData.sku,
      quantity: dispatchData.total_bottles,
      unit: 'bottles',
      user,
      device: sessionStorage.getItem('device_id'),
      remarks: `Dispatched to customer ${dispatchData.customer}`,
    });

    toast.success('Dispatch created - forward trace complete');
  } catch (error) {
    toast.error(error.message);
  }
};
```

**Loss/Rejection:**
```javascript
const handleQCReject = async (lotId, quantity, reason) => {
  try {
    // Update lot status
    await base44.entities.Lot.update(lotId, { status: 'REJECTED' });

    // Fire critical trace event
    await fireQCReject({
      lotId,
      quantity,
      unit: 'kg',
      reason,
      user,
      device: sessionStorage.getItem('device_id'),
    });

    toast.success('Rejection logged - marked as critical event');
  } catch (error) {
    toast.error(error.message);
  }
};
```

## Traceability Explorer

**Path:** Admin → Traceability Explorer

**Features:**

1. **Search & Discovery**
   - Search by Batch, Lot, Crate, Pallet, Dispatch, or Product Code
   - Select trace direction: Backward (sources), Forward (derivatives), Complete genealogy
   - Instant results with summary statistics

2. **Visual Timeline**
   - Chronological event sequence
   - Color-coded by event type
   - Shows source→target transformation
   - Quantity and loss tracking
   - User & device info
   - Remarks for context

3. **Genealogy View**
   - Backward tree: All raw material sources
   - Forward tree: All downstream products & dispatches
   - Click to drill down into specific entities

4. **Yield Analysis**
   - Track losses at each stage
   - See loss reasons (QC reject, rework, spillage, etc.)
   - Calculate final yield percentage

5. **Export Reports**
   - PDF: Professional report for compliance/recalls
   - CSV: Data for spreadsheet analysis
   - Includes all events, loss details, and genealogy

## All Available Event Types

| Event Type | Fired When | From → To | Critical? | Use Case |
|---|---|---|---|---|
| `RM_INWARD` | Raw material arrives | Supplier → Lot | No | Track material receipt |
| `QC_RELEASE` | QC passes material | Lot → Lot | No | Approval tracking |
| `QC_REJECT` | QC fails material | Lot → Scrap | **Yes** | Complaints, recalls |
| `ISSUE_TO_BATCH` | Issue RM to batch | Lot → Batch | No | Batch composition |
| `BATCH_CREATION` | Batch is created | Order → Batch | No | Start of production |
| `MIXING_COMPLETE` | Mixing finished | Batch → Batch | No | Process milestone |
| `FILLING_OUTPUT` | Batch filled into crates | Batch → Crate | No | Output tracking |
| `CRATE_CREATION` | Crate created | Batch → Crate | No | Container tracking |
| `CHAMBER_MOVEMENT` | Crate moves through chamber | Location → Location | No | Process tracing |
| `LABELLING_ISSUE` | Labels applied | Crate → Label | No | Label tracking |
| `LABELLING_CONSUMPTION` | Label consumed | Label → Consumption | No | Inventory control |
| `REPACKING` | Items repacked | Crate → Crate | **Yes** | Quality issues |
| `REWORK` | Product reworked | Crate → Rework | **Yes** | Problem investigation |
| `PALLET_BUILD` | Crate added to pallet | Crate → Pallet | No | Pallet composition |
| `DISPATCH` | Products dispatched | Pallet → Dispatch | No | Shipment tracking |
| `STOCK_ADJUSTMENT` | Inventory corrected | Lot → Adjustment | Depends | Reconciliation |
| `RETURN` | Product returned | Customer → Lot | **Yes** | Complaints, recalls |

## Real-World Examples

### Example 1: Complaint Investigation (Backward Trace)

**Customer complains:** Product batch "LOT_MAR_2026_001" caused illness in 3 units.

1. Go to **Traceability Explorer**
2. Search: Type = "Lot", Value = "LOT_MAR_2026_001", Direction = "Backward"
3. See timeline:
   - Raw materials received (supplier A, supplier B)
   - QC test results
   - Batch B001 creation
   - Mixing parameters
   - Filling into crates
   - Which dispatch

4. **Next steps:** Contact suppliers, review mixing parameters, check operator notes

### Example 2: Recall Management (Forward Trace)

**Alert:** Supplier A's ingredient lot "ING_345" has contamination.

1. Go to **Traceability Explorer**
2. Search: Type = "Lot", Value = "ING_345", Direction = "Forward"
3. See all downstream products:
   - Batch B001 (used 500kg)
   - Batch B002 (used 200kg)
   - Crates C001, C002, ... (filled from batches)
   - Pallet P001, P002 (contains crates)
   - Dispatch DOC_20260310, DOC_20260312 (final destination)

4. **Export PDF:** Send to quality team
5. **Action:** Contact customers who received DOC_20260310, DOC_20260312

### Example 3: Yield Investigation

**Problem:** Batch B001 had low yield (68% vs expected 95%).

1. Go to **Traceability Explorer**
2. Search: Type = "Batch", Value = "B001", Direction = "Complete"
3. See all events:
   - Initial quantity: 1000 kg
   - QC loss: 50 kg (quality reject)
   - Rework attempt: 20 kg (still non-compliant)
   - Filling spillage: 30 kg
   - Final output: 900 bottles from 880 kg = 88% yield

4. **Findings:** Operator notes show "rework issues with batch B001"
5. **Action:** Review rework procedures, retrain operator

## Best Practices

### ✅ DO

- Fire event **immediately** after action (before user navigates away)
- Include batch/lot/crate/pallet ID **every time**
- Record yield loss & reason for every rejection/rework
- Mark critical events (QC reject, rework, major loss)
- Include user & device for accountability
- Add remarks explaining unusual events
- Test trace queries after major workflow changes

### ❌ DON'T

- Skip firing events (breaks genealogy)
- Fire event after creating entity (order matters)
- Forget quantity & unit (loss calculation depends on it)
- Edit or delete trace events (immutability is key)
- Use batch/lot IDs as primary search (use specific lot/batch)
- Export reports without checking event completeness

## API Reference

### Fire Events

```javascript
// Generic event
await fireTraceEvent({
  eventType: 'BATCH_CREATION',
  module: 'PRODUCTION',
  sourceType: 'Order',
  sourceId: 'order_123',
  targetType: 'Batch',
  targetId: 'batch_001',
  quantity: 1000,
  unit: 'liters',
  batchId: 'batch_001',
  user,
  device,
  remarks: 'Batch created from order',
});

// Specific helpers (recommended)
await fireRMInward({ lotId, itemCode, quantity, unit, user, device, remarks });
await fireQCRelease({ lotId, user, device, remarks });
await fireQCReject({ lotId, quantity, unit, reason, user, device });
await fireBatchCreation({ batchId, sku, productName, quantity, unit, user, device, remarks });
await fireFillingOutput({ batchId, crateId, quantity, unit, user, device });
await firePalletBuild({ palletId, crateId, quantity, unit, user, device });
await fireDispatch({ dispatchId, palletId, sku, quantity, unit, user, device, remarks });
await fireRework({ crateId, batchId, quantity, unit, reason, user, device });
```

### Query Genealogy

```javascript
import {
  getBackwardTrace,
  getForwardTrace,
  getCompleteGenealogy,
  getBatchTrace,
  getLotTrace,
  getCrateTrace,
  getPalletTrace,
  getDispatchTrace,
  getSkuTrace,
  getBatchYieldAnalysis,
} from '@/lib/traceabilityEngine';

// Get all sources contributing to finished product
const backward = await getBackwardTrace('Crate', 'C001');
// Result: sources[], timeline[] of events that led to crate C001

// Get all products derived from raw material
const forward = await getForwardTrace('Lot', 'LOT_123');
// Result: derivatives[], timeline[], finalDispatches[] from lot

// Complete genealogy (both directions)
const genealogy = await getCompleteGenealogy('Batch', 'B001');
// Result: backward, forward, completeTimeline, summary

// Get all events for entity
const trace = await getBatchTrace('B001');
// Result: events[], timeline[]

// Analyze yield losses
const yield = await getBatchYieldAnalysis('B001');
// Result: initialQuantity, totalLoss, finalQuantity, yieldPercent, losses[]
```

## Traceability Data Model

```
TraceEvent {
  event_id: string                    // Unique ID
  event_type: enum (19 types)        // Type of action
  timestamp: datetime                 // When
  module: string                      // Which module
  site_id: string                     // Which factory
  
  source_entity_type: string          // What was consumed
  source_entity_id: string            // Specific source
  target_entity_type: string          // What was created
  target_entity_id: string            // Specific target
  
  quantity: number                    // Amount moved
  unit: string                        // Unit of measurement
  
  batch_id: string (optional)         // Batch context
  lot_id: string (optional)           // Lot context
  crate_id: string (optional)         // Crate context
  pallet_id: string (optional)        // Pallet context
  dispatch_id: string (optional)      // Dispatch context
  sku: string (optional)              // Product code
  
  session_id: string (optional)       // Shift/session
  order_id: string (optional)         // Order reference
  
  user_email: string                  // Who did it
  device_id: string                   // Where recorded
  remarks: string (optional)          // Context notes
  
  yield_loss: number                  // Quantity lost
  loss_reason: string (optional)      // Why lost
  is_critical: boolean                // Requires review?
  
  data: object (optional)             // Extensible data
}
```

---

**Key Files:**
- `entities/TraceEvent.json` - Event data model
- `lib/traceabilityEngine.js` - Query engine (backward/forward trace)
- `lib/traceEventHelper.js` - Fire event helpers
- `pages/TraceabilityExplorer.jsx` - Search & visualization UI
- `components/traceability/TraceTimeline.jsx` - Timeline visualization
- `components/traceability/TraceExportDialog.jsx` - PDF/CSV export

**Getting Started:**
1. Import helpers in your pages: `import { fireFillingOutput } from '@/lib/traceEventHelper'`
2. Fire events when entities are created: `await fireFillingOutput({...})`
3. View genealogy: Go to **Admin → Traceability Explorer**
4. Export reports for compliance/investigations