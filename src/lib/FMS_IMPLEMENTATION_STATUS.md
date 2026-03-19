# FMS Universal Document Linking — Implementation Status

**Date:** 2026-03-19  
**Goal:** Make ref_chain linking universal across all document types, not just purchase workflows

## ✅ Completed

### Phase 1: Core Utilities (Foundation)
- ✅ `lib/useFMSAutoComplete.js` — All helpers ready
  - `fireFMSEvent(eventKey, refId)` 
  - `linkFMSRef(instanceId, newRefId)`
  - `triggerFMSProcess({triggerSource, triggerRefId, title, triggerData})`
  - `findFMSInstanceByRef(refId)`

- ✅ `lib/fmsAppEvents.js` — Comprehensive event registry  
  - 31 events across 7 categories
  - All major document workflows covered
  - Ready for expansion

### Phase 2: Production Workflow (High Priority)
- ✅ **ProductionOrders** (lines 262-272 in pages/ProductionOrders)
  - New production orders trigger FMS process
  - Event: `production_order_created`
  - Pattern: Standalone order creates process instance

- ✅ **LiquidPlans** (lines 291-345 in pages/LiquidPlans)
  - New plans fire event and link to ref_chain
  - Event: `liquid_plan_created`
  - Pattern: Fires event, finds instances, links plan

### Phase 3: Purchase Workflow (Verification)
- ✅ **POForm** (lines 120-127 in components/purchase/POForm)
  - Already implements full pattern
  - Event: `purchase_order_created`
  - Properly uses source PR ID and links new PO

## 🔄 In Progress / Next Priority

### Immediate (Week 1):
1. **GRNReceive** — Link GRN to PO ref_chain
   - Event: `grn_received`
   - Pattern: Fire event with PO.id, link GRN.id
   
2. **QCInbox** — Link QC inspection results
   - Event: `qc_inspection_completed`
   - Pattern: Fire with source doc ID, link QC result
   
3. **InvoiceCapture** — Link invoice to GRN chain
   - Event: `invoice_captured`
   - Pattern: Fire with GRN.id, link invoice.id
   
4. **ThreeWayMatch** — Complete matching workflow
   - Event: `three_way_match_done`
   - Pattern: Fire with last doc in chain

### Secondary (Week 2-3):
5. **FillingStation / ChamberStation** — Batch events
   - `batch_started` → fire with plan ID
   - `batch_completed` → fire with batch ID

6. **LabellingLine** — Packing workflow
   - `packing_wo_completed` → link packed output
   - `label_*` events → fire as steps complete

7. **WarehouseOps / DispatchCrates** — Dispatch linking
   - `dispatch_created` / `dispatch_completed`
   - Link dispatch to FG tracking

8. **BoxReceivingSession** — Receiving workflow
   - `putaway_done` → complete warehouse receipt

## 📋 Implementation Checklist

For each page/component:
- [ ] Import: `import { fireFMSEvent, findFMSInstanceByRef, linkFMSRef } from '@/lib/useFMSAutoComplete'`
- [ ] On create: Save new document, fire event, link to chain
- [ ] On action (approve/complete): Fire event with current document ID
- [ ] Test: Verify ref_chain grows correctly in FMSProcessInstance
- [ ] Audit: Check AuditLog entries for document operations

## 🎯 Key Patterns

### Pattern A: Create New Document
```javascript
const newDoc = await base44.entities.DocType.create(data);
await fireFMSEvent('doc_created', sourceDocId); // Use source doc already in chain
const instances = await findFMSInstanceByRef(sourceDocId);
for (const inst of instances) {
  await linkFMSRef(inst.id, newDoc.id); // Add new doc to chain
}
```

### Pattern B: Action on Existing Document
```javascript
await base44.entities.DocType.update(docId, { status: 'APPROVED' });
await fireFMSEvent('doc_approved', docId); // Use THIS doc (now in chain)
```

### Pattern C: Multi-document Sequence
```javascript
// Step 1: Create from source
const po = await base44.entities.PurchaseOrder.create(poData);
await fireFMSEvent('po_created', pr.id); // Use PR (source)
await linkFMSRef(instanceId, po.id);

// Step 2: Later, approve PO
await base44.entities.PurchaseOrder.update(po.id, { status: 'APPROVED' });
await fireFMSEvent('po_approved', po.id); // Now use PO (in chain)

// Step 3: Receive GRN
const grn = await base44.entities.GRNHeader.create(grnData);
await fireFMSEvent('grn_received', po.id); // Use PO (source of GRN)
await linkFMSRef(instanceId, grn.id);

// Step 4: QC GRN
await base44.entities.QCInspection.update(qcId, { status: 'APPROVED' });
await fireFMSEvent('qc_approved', grn.id); // Now use GRN (in chain)
```

## 📊 Document Flow Example

**Full Purchase → GRN → Invoice Workflow:**

```
PR created (manual)
  ↓
Trigger FMS process: 'purchase_request_created'
  ref_chain = [pr.id]
  ↓
Create PO from PR
  Fire: 'purchase_order_created' with pr.id
  Link: po.id
  ref_chain = [pr.id, po.id]
  ↓
Approve PO
  Fire: 'purchase_order_approved' with po.id
  ref_chain = [pr.id, po.id] (unchanged)
  ↓
Receive GRN
  Fire: 'grn_received' with po.id
  Link: grn.id
  ref_chain = [pr.id, po.id, grn.id]
  ↓
QC Inspection completed
  Fire: 'qc_approved' with grn.id
  ref_chain = [pr.id, po.id, grn.id] (unchanged)
  ↓
Capture Invoice
  Fire: 'invoice_captured' with grn.id
  Link: invoice.id
  ref_chain = [pr.id, po.id, grn.id, invoice.id]
  ↓
3-Way Match completed
  Fire: 'three_way_match_done' with invoice.id
  ref_chain = [pr.id, po.id, grn.id, invoice.id] (final)
  ↓
Create Payment Request
  Fire: 'payment_request_created' with invoice.id
  Link: payment.id
  ref_chain = [pr.id, po.id, grn.id, invoice.id, payment.id]
```

Every document in the chain is traceable back to the originating PR and forward to all dependent documents.

## 🚀 Deployment Notes

- No database schema changes needed (ref_chain already supported)
- No breaking changes to existing workflows
- Graceful degradation if FMS process doesn't exist
- All imports from lib/useFMSAutoComplete work via Base44 SDK
- Errors logged but don't break document operations (see fireFMSEvent error handling)

## 📞 Questions?

Refer to `lib/FMS_REF_CHAIN_GUIDE.md` for detailed patterns and file-by-file implementation guide.