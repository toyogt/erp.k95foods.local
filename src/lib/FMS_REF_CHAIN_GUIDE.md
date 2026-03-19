# FMS Document Linking (ref_chain) — Universal Implementation Guide

## Overview
All document types across all departments must implement ref_chain linking to maintain a complete audit trail and process traceability. Every significant action that creates a new document MUST link it into the process instance.

## Document Types by Department

### Purchase & GRN
- **PurchaseRequest** → PurchaseOrder → GRNHeader → QCInspection → SupplierInvoice → PaymentRequest
- Current: ✅ Implemented (POForm lines 120-127)
- Status: Complete ref_chain support

### Production
- **ProductionOrder** → LiquidBatchPlan → Batch → PackedOutputEvent → PackingWO → BoxPallet
- Current: ❌ Needs implementation
- Priority: High (core workflow)

### Warehouse & FG
- **BoxReceivingSession** → BoxDiscrepancyReport → BoxQCInspection → FGPallet → BoxPalletLog
- Current: ❌ Needs implementation
- Priority: Medium

### Quality (Cross-department)
- **QCInspection** (linked from GRN, Production, Warehouse)
- Current: ❌ Needs implementation
- Priority: High

### Labels & Printing
- **BoxLabelPrintRequest** → LabelPrintRequest → CrateLabelPrintLog
- Current: ❌ Needs implementation
- Priority: Medium

## Implementation Pattern

### 1. Document Creation
When a document is created (typically by form submission):
```javascript
// Save the new document
const newDoc = await base44.entities.DocType.create(data);

// Fire event with SOURCE document ID (already in chain)
await fireFMSEvent('doc_type_created', sourceDocId);

// Link the NEW document into the chain
const instances = await findFMSInstanceByRef(sourceDocId);
for (const inst of instances) {
  await linkFMSRef(inst.id, newDoc.id);
}

onSuccess();
```

### 2. Document Action (Approval/Rejection/Completion)
When a step is completed:
```javascript
// Update the document
await base44.entities.DocType.update(docId, { status: 'APPROVED' });

// Fire event with THIS document ID (now in chain)
await fireFMSEvent('doc_approved', docId);
```

### 3. Multi-step Workflows
Keep passing the CURRENT document ID to fireFMSEvent:
```javascript
// Step 1: Create from source
await fireFMSEvent('po_created', pr.id);
await linkFMSRef(instanceId, po.id);

// Step 2: Approve the PO
await fireFMSEvent('po_approved', po.id);  // ← now use po.id

// Step 3: Receive as GRN
await fireFMSEvent('grn_received', po.id);
await linkFMSRef(instanceId, grn.id);

// Step 4: QC the GRN
await fireFMSEvent('qc_approved', grn.id);  // ← now use grn.id
```

## Files to Update

### Must-do (Core Workflows)
1. **ProductionOrders** — FMS linking on order creation (primary trigger)
2. **LiquidPlans** — Link plan to order, fire liquid_plan_created
3. **FillingStation / ChamberStation** — Fire batch_started, batch_completed
4. **LabellingLine / BoxLabelPrint** — Fire packing_wo_completed, label_* events
5. **GRNReceive** — Link GRN to PO, fire grn_received
6. **QCInbox** — Link QC inspection, fire qc_inspection_completed

### Should-do (Secondary)
7. **WarehouseOps** — Link dispatch, fire dispatch_completed
8. **DispatchCrates** — Fire dispatch_completed
9. **BoxReceivingSession** — Link receiving session, fire putaway_done
10. **InvoiceCapture / ThreeWayMatch** — Link invoice, fire invoice_captured

### Nice-to-do (Admin/Config)
11. **RecipeBuilder** — Fire config changes if needed
12. **SKUSetup** — Fire sku_created (if implemented as event)

## New Events to Add

Add these to `lib/fmsAppEvents.js` if not already present:
```javascript
// Production
{ key: 'production_order_created', label: 'Production Order Created', category: 'Production', canTrigger: true, canComplete: true },

// Warehouse
{ key: 'receiving_session_completed', label: 'Receiving Session Completed', category: 'Warehouse', canTrigger: false, canComplete: true },
{ key: 'qc_inspection_created', label: 'QC Inspection Created', category: 'Quality', canTrigger: true, canComplete: true },
```

## Testing Checklist

For each document type, verify:
- [ ] Document creates successfully
- [ ] FMS event fires without errors
- [ ] Process instance's ref_chain contains new document ID
- [ ] Subsequent steps can find and match the instance
- [ ] Audit logs show document creation and linking

## Rollout Phase

**Phase 1 (Week 1):** Purchase workflow complete verification + ProductionOrders
**Phase 2 (Week 2):** Warehouse & Quality workflows
**Phase 3 (Week 3):** Labels & remaining secondary flows