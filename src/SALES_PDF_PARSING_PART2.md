# K95 ERP — Sales Order PDF Parsing: Complete Code Reference (Part 2)

> **Continued from Part 1** — This part covers: SO Creation UI, Bulk Upload, Split View, Excel Import, Editable Items Table, Document Number Generator, Flow Diagrams, Product Matching Logic, ERPNext Migration Notes.

---

## 10. Document Number Generator

**File: `lib/docNumberHelper.js`** — Generates sequential numbers: `SO/25-26/005001`

```javascript
import { base44 } from '@/api/base44Client';

function getFiscalYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed; April = 3
  if (month >= 3) return `${String(year).slice(-2)}-${String(year + 1).slice(-2)}`;
  return `${String(year - 1).slice(-2)}-${String(year).slice(-2)}`;
}

export async function generateDocNumber(prefix, startFrom = 5001) {
  const fiscalYear = getFiscalYear();
  const batchKey = `${prefix}_${fiscalYear}`;
  const counters = await base44.entities.BatchSeqCounter.filter({ batch_key: batchKey });
  let nextSeq = startFrom;
  let counterId = null;
  if (counters.length > 0) {
    nextSeq = (counters[0].last_seq || startFrom - 1) + 1;
    counterId = counters[0].id;
  }
  const docNumber = `${prefix}/${fiscalYear}/${String(nextSeq).padStart(6, '0')}`;
  if (counterId) await base44.entities.BatchSeqCounter.update(counterId, { last_seq: nextSeq });
  else await base44.entities.BatchSeqCounter.create({ batch_key: batchKey, last_seq: nextSeq });
  return docNumber;
}
```

---

## 11. Sales Order Creation Modal (Single PDF)

**File: `components/sales/CreateSalesOrderModal.jsx`** — Main modal with Manual/PDF/Excel modes.

### Key Logic: handlePDFUpload (the core flow)

```javascript
async function handlePDFUpload(file) {
  setUploading(true);
  // PARALLEL: Upload file + extract text (browser-side PDF.js)
  const [uploadResult, rawText] = await Promise.all([
    base44.integrations.Core.UploadFile({ file }),
    extractTextFromFile(file).catch(() => ''),
  ]);
  const file_url = uploadResult.file_url;
  setPdfUrl(file_url);
  setUploading(false);

  setParsing(true);
  let d = null;
  // Try browser-side regex first (instant for known platforms)
  const browserParsed = rawText ? parsePDFText(rawText) : null;
  if (browserParsed && browserParsed.items?.length > 0) {
    d = await enrichParsedData(browserParsed);  // Client-side enrichment
  } else {
    // Server-side fallback (includes LLM for unknown formats)
    const res = await base44.functions.invoke('parseSalesPDF', { pdf_url: file_url, raw_text: rawText });
    if (res.data?.success) d = res.data.data;
  }
  setParsing(false);

  if (d) {
    setExtractedData(d);
    setForm(f => ({
      ...f,
      customer_name: d.customer_name || '',
      po_number: d.po_number || '',
      po_date: d.po_date || '',
      po_expiry_date: d.po_expiry_date || '',
      po_delivery_date: d.po_delivery_date || '',
      payment_terms: d.payment_terms || '',
      platform: d.platform || 'direct',
      customer_gstin: d.customer_gstin || '',
      billing_address: d.billing_address || '',
      shipping_address: d.shipping_address || '',
      taxable_amount: d.taxable_amount || 0,
      tax_amount: d.tax_amount || 0,
      total_amount: d.total_amount || 0,
      vendor_no: d.vendor_no || '',
    }));
    if (d.po_expiry_date && new Date(d.po_expiry_date) < new Date() && d.platform !== 'direct') {
      setExpiryWarning(true);
    }
    setStep('preview');
  }
}
```

### Key Logic: handleSave (creating the Sales Order)

```javascript
async function handleSave() {
  if (!form.customer_name) return;
  if (!validateDates()) return;

  // Credit limit check
  const creditBlock = await checkCreditLimit(form.customer_name);
  if (creditBlock) { setCreditWarning(creditBlock); return; }

  // 1. Create Sales Order header
  const soData = {
    ...form, so_number: soNumber, source: type, status: 'confirmed',
    pdf_url: pdfUrl || null,
    expiry_override_approved: expiryWarning ? false : undefined,
  };
  const so = await base44.entities.SalesOrder.create(soData);

  // 2. Bulk create line items
  if (extractedData?.items?.length) {
    const itemPayloads = extractedData.items.map(item => ({
      ...item, sales_order_id: so.id, so_number: soNumber, stock_status: 'not_checked',
    }));
    await base44.entities.SalesOrderItem.bulkCreate(itemPayloads);
  }

  // 3. Audit log
  await base44.entities.SalesAuditLog.create({
    entity_type: 'SalesOrder', entity_id: so.id,
    reference_number: soNumber, action: 'created',
    new_value: JSON.stringify({ status: 'confirmed', source: type }),
    user_email: user?.email,
  });

  // 4. FMS workflow trigger
  await triggerFMSProcess({
    triggerSource: 'sales_order_created', triggerRefId: so.id,
    title: `Sales Order ${soNumber}`,
    triggerData: { so_number: soNumber, customer: form.customer_name },
  });

  onCreated(so);
}
```

### Credit Limit Check

```javascript
async function checkCreditLimit(customerName) {
  const customers = await base44.entities.Customer.filter({ name: customerName });
  const customer = customers[0];
  if (!customer || !customer.check_outstanding) return null;
  const maxAllowed = (customer.outstanding_limit || 0) + (customer.leverage_outstanding || 0);
  if ((customer.current_outstanding || 0) > maxAllowed) {
    return { current: customer.current_outstanding, maxAllowed, customerName };
  }
  return null;
}
```

---

## 12. Bulk PDF Upload Modal

**File: `components/sales/PDFBulkUploadModal.jsx`** — Multi-file parallel processing.

### Processing Steps Per File

```javascript
const INITIAL_STEPS = [
  { key: 'upload', label: 'Uploading PDF', status: 'pending' },
  { key: 'parse', label: 'Extracting data from PDF', status: 'pending' },
  { key: 'customer', label: 'Looking up customer', status: 'pending' },
  { key: 'pricelist', label: 'Resolving price list', status: 'pending' },
  { key: 'rates', label: 'Fetching item rates', status: 'pending' },
];
```

### Duplicate PO Detection

```javascript
if (d?.po_number) {
  const existingOrders = await base44.entities.SalesOrder.filter(
    { po_number: d.po_number, platform: d.platform || 'direct' }, undefined, 5
  ).catch(() => []);
  // Also check within current upload batch
  const batchDup = entries.find(e => e.id !== id && e.data?.po_number === d.po_number
    && e.data?.platform === (d.platform || 'direct'));
  if (existingOrders.length > 0 || batchDup) {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: 'duplicate', data: d } : e));
    return;
  }
}
```

### Parallel File Processing

```javascript
async function handleFiles(files) {
  const pdfs = Array.from(files).filter(f => f.type === 'application/pdf');
  await Promise.all(pdfs.map(f => processFile(f)));  // ALL files processed in parallel
}
```

---

## 13. PDF Split View (Side-by-Side Review)

**File: `components/sales/PDFInvoiceSplitView.jsx`** — PDF left, data right.

### Platform ID Mapping

```javascript
const PLATFORM_ID_FIELD = {
  zepto: 'zepto_item_id',
  swiggy: 'swiggy_item_id',
  blinkit: 'bigbasket_item_id',
};
```

### Rate Mismatch Detection

```javascript
const systemTaxable = items.reduce((s, i) => s + ((i.unit_base_cost || 0) * (i.quantity || 0)), 0);
const pdfTaxable = data?.taxable_amount || 0;
const taxableGap = Math.abs(systemTaxable - pdfTaxable);
const hasTotalGap = taxableGap > 0.50;  // More than ₹0.50 difference triggers warning
```

### No-Rate Block

```javascript
const noRateBlocked = !priceList && items.every(i => !i._rate_matched);
// If true → blocks SO creation, shows "Cannot Create Sales Order" screen
// User must assign price list to customer first
```

---

## 14. Excel Import Flow

**File: `components/sales/ExcelSOImport.jsx`** — BigBasket/Excel import via AI extraction.

```javascript
async function handleExcelUpload(file) {
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
    file_url,
    json_schema: {
      type: 'object',
      properties: {
        po_number: { type: 'string' }, customer_name: { type: 'string' },
        platform: { type: 'string' }, po_date: { type: 'string' },
        items: { type: 'array', items: { type: 'object', properties: {
          item_code: { type: 'string' }, description: { type: 'string' },
          hsn_code: { type: 'string' }, quantity: { type: 'number' },
          mrp: { type: 'number' }, unit_base_cost: { type: 'number' },
          igst_rate: { type: 'number' }, total_amount: { type: 'number' },
        }}},
        total_amount: { type: 'number' },
      }
    }
  });
  // Create SO + Items + Audit + FMS (same pattern as PDF flow)
}
```

---

## 15. Editable Items Table (Post-Creation)

**File: `components/sales/SOEditableItemsTable.jsx`**

### Edit Rules
- Only editable in: `draft`, `confirmed`, `logistics_review`
- Every edit requires reason (SOEditReasonModal)
- Financial recalculation after every change

### Product Matching (Multi-Layer Fallback)

```javascript
const productMap = {};     // item_code → product
const productByEAN = {};   // product_barcode → product
products.forEach(p => {
  if (p.item_code) productMap[p.item_code] = p;
  if (p.product_barcode) productByEAN[p.product_barcode.trim()] = p;
  if (p.bigbasket_item_id) productMap[p.bigbasket_item_id.trim()] = p;  // Blinkit IDs
});

const findProduct = (item) => {
  return productMap[item.item_code] || productByEAN[item.ean_number?.trim()] || null;
};
```

### Edit Save with Recalculation

```javascript
async function confirmSave(reason) {
  const qty = Number(editData.quantity) || 0;
  const rate = Number(editData.unit_base_cost) || 0;
  const taxableValue = qty * rate;
  const igstRate = item.igst_rate || 0;
  const igstAmount = taxableValue * (igstRate / 100);

  await base44.entities.SalesOrderItem.update(itemId, {
    quantity: qty, unit_base_cost: rate, rate_snapshot: rate,
    description: editData.description, taxable_value: taxableValue,
    igst_amount: igstAmount, total_amount: taxableValue + igstAmount,
  });

  // Audit log
  await base44.entities.SalesAuditLog.create({
    entity_type: 'SalesOrderItem', entity_id: itemId,
    reference_number: order.so_number, action: 'item_edited',
    old_value: changes.join('; '), new_value: `Reason: ${reason}`,
    notes: reason, user_email: user?.email,
  });

  // Recalculate SO totals
  const allItems = await base44.entities.SalesOrderItem.filter({ sales_order_id: order.id });
  const totalTaxable = allItems.reduce((s, i) => s + (i.taxable_value || 0), 0);
  const totalTax = allItems.reduce((s, i) => s + (i.igst_amount || i.cgst_amount || 0), 0);
  await base44.entities.SalesOrder.update(order.id, {
    taxable_amount: totalTaxable, tax_amount: totalTax, total_amount: totalTaxable + totalTax,
  });
}
```

---

## 16. Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USER UPLOADS PDF(s)                              │
└─────────────────┬───────────────────────────────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 1: PARALLEL — Upload to storage + Extract text (PDF.js browser)   │
│  base44.integrations.Core.UploadFile({ file })  →  file_url             │
│  extractTextFromFile(file)                      →  raw text string      │
└─────────────────┬───────────────────────────────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 2: detectPlatform(text)                                           │
│  Keywords: "HANDS ON TRADES"→blinkit, "SCOOTSY"→swiggy, "ZEPTO"→zepto  │
└─────────────────┬───────────────────────────────────────────────────────┘
          ┌───────┴────────┐
          │ Known          │ Unknown
          ▼                ▼
  ┌────────────────┐  ┌───────────────────────────────────────────────┐
  │ BROWSER REGEX  │  │ SERVER LLM FALLBACK (Gemini Flash)            │
  │ parseZepto()   │  │ functions/parseSalesPDF → InvokeLLM           │
  │ parseSwiggy()  │  │ with response_json_schema for structured data │
  │ parseBlinkit() │  └───────────────────────────────────────────────┘
  └───────┬────────┘
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 3: enrichParsedData() — All DB queries in parallel                │
│  ┌──────────┐ ┌──────────────┐ ┌──────────────┐ ┌───────────────────┐  │
│  │ Customer │ │ SalesRateList│ │ ProductMaster│ │ SKUCustomerBarcode│  │
│  └──────────┘ └──────────────┘ └──────────────┘ └───────────────────┘  │
│                                                                         │
│  A. Customer: GSTIN match → Name fuzzy match                            │
│  B. Price List: customer.price_list → group → platform fallback         │
│  C. Product Match (5-level): PlatformID → Barcode → ItemCode → EAN     │
│  D. Rate: SalesRateList by item_code + price_list                       │
│  E. Recalculate: taxable = rate × qty, tax = taxable × gst%            │
└─────────────────┬───────────────────────────────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 4: REVIEW UI (PDFInvoiceSplitView)                                │
│  Left: PDF iframe  |  Right: Data table with rate diffs, edit mode      │
│  Mismatch warning if system taxable ≠ PDF taxable (>₹0.50 gap)         │
│  No-rate block if no price list assigned                                │
└─────────────────┬───────────────────────────────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 5: CREATE SALES ORDER                                             │
│  1. generateDocNumber('SO') → "SO/25-26/005042"                         │
│  2. SalesOrder.create({ ...header, status: 'confirmed' })               │
│  3. SalesOrderItem.bulkCreate(items)                                    │
│  4. SalesAuditLog.create({ action: 'created' })                         │
│  5. triggerFMSProcess('sales_order_created', so.id)                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 17. Product Matching Priority (5 Levels)

```
Priority 1: Platform-Specific ID
  Parsed item_code  →  ProductMaster.{platform}_item_id
  Example: Swiggy "31670" → ProductMaster.swiggy_item_id = "31670"

Priority 2: SKUCustomerBarcode Mapping
  Parsed item_code  →  SKUCustomerBarcode.customer_barcode → item_code → ProductMaster

Priority 3: Direct System Item Code
  Parsed item_code  →  ProductMaster.item_code (exact match)

Priority 4: EAN Barcode
  item.ean_number  →  ProductMaster.product_barcode

Priority 5: Raw Code as EAN (fallback)
  If raw parsed code is 12-14 digits, try as ProductMaster.product_barcode
```

### Platform-to-Field Mapping

| Platform | ProductMaster Field | Notes |
|----------|-------------------|-------|
| Swiggy | `swiggy_item_id` | 4-5 digit codes |
| Zepto | `zepto_item_id` | UUIDs or material codes |
| Blinkit | `bigbasket_item_id` | Named "bigbasket" but stores Blinkit IDs |
| Amazon | `amazon_item_id` | ASIN codes |

---

## 18. Price List Resolution Logic

```
Step 1: customer.price_list — Direct assignment
  Source: "customer:{name}"

Step 2: customer.customer_group → match price list name
  Source: "group:{group_name}"

Step 3: Platform name → match price list name (ONLY if no customer found)
  Source: "platform:{platform}"

Step 4: No match → _no_rate = true → UI blocks SO creation
```

---

## 19. ERPNext Migration Notes

### Doctype Mapping

| K95 Entity | ERPNext Doctype | Key Differences |
|-----------|-----------------|-----------------|
| SalesOrder | Sales Order | Status values differ |
| SalesOrderItem | Sales Order Item | `unit_base_cost` → `rate`, `taxable_value` → `amount` |
| ProductMaster | Item | Platform IDs = custom fields |
| Customer | Customer | `price_list` → `default_price_list` |
| SalesRateList | Item Price | `price_list` + `item_code` + `rate` |
| SKUCustomerBarcode | Item Customer Detail | Custom doctype |
| SalesAuditLog | Comment / Version | Use built-in versioning |
| BatchSeqCounter | Series | ERPNext naming series |

### Key Differences

1. **Numbering**: ERPNext uses naming series (`SO-.YYYY.-.#####`), not manual counters
2. **Tax**: ERPNext uses Tax Templates + Tax Rules, not inline IGST/CGST fields
3. **Price List**: ERPNext Item Price is separate; customer has `default_price_list`
4. **Workflow**: ERPNext has built-in Workflow engine vs custom `workflow_state` + FMS
5. **PDF Parsing**: Needs Custom App or Server Script in ERPNext

### ERPNext Implementation (Pseudocode)

```python
# frappe custom app: sales_pdf_import/api.py

import frappe
import fitz  # PyMuPDF for text extraction
import re

@frappe.whitelist()
def parse_and_create_so(pdf_file_url):
    # 1. Extract text
    text = extract_text_from_pdf(pdf_file_url)
    
    # 2. Detect platform
    platform = detect_platform(text)
    
    # 3. Parse using regex (port the JS parsers to Python)
    if platform == 'blinkit':
        parsed = parse_blinkit(text)
    elif platform == 'swiggy':
        parsed = parse_swiggy(text)
    elif platform == 'zepto':
        parsed = parse_zepto(text)
    else:
        # LLM fallback using frappe.call to OpenAI/Gemini
        parsed = llm_extract(pdf_file_url)
    
    # 4. Resolve customer
    customer = frappe.db.get_value("Customer", {"tax_id": parsed['customer_gstin']}, "name")
    if not customer:
        customer = frappe.db.get_value("Customer", {"customer_name": ["like", f"%{parsed['customer_name'][:20]}%"]}, "name")
    
    # 5. Create Sales Order
    so = frappe.new_doc("Sales Order")
    so.customer = customer
    so.po_no = parsed['po_number']
    so.po_date = parsed['po_date']
    so.delivery_date = parsed['po_delivery_date']
    so.selling_price_list = frappe.db.get_value("Customer", customer, "default_price_list")
    
    # 6. Add items with rate resolution
    for item_data in parsed['items']:
        item_code = resolve_item_code(item_data['item_code'], platform)
        rate = frappe.db.get_value("Item Price", {
            "item_code": item_code,
            "price_list": so.selling_price_list
        }, "price_list_rate") or item_data.get('unit_base_cost', 0)
        
        so.append("items", {
            "item_code": item_code,
            "qty": item_data['quantity'],
            "rate": rate,
        })
    
    so.save()
    so.submit()
    return so.name

def resolve_item_code(parsed_code, platform):
    """5-level product matching — same logic as K95"""
    # P1: Platform-specific custom field
    field_map = {'swiggy': 'custom_swiggy_item_id', 'zepto': 'custom_zepto_item_id', 'blinkit': 'custom_blinkit_item_id'}
    if platform in field_map:
        item = frappe.db.get_value("Item", {field_map[platform]: parsed_code}, "name")
        if item: return item
    
    # P2: Customer barcode
    item = frappe.db.get_value("Item Customer Detail", {"ref_code": parsed_code}, "parent")
    if item: return item
    
    # P3: Direct item_code
    if frappe.db.exists("Item", parsed_code): return parsed_code
    
    # P4: EAN barcode
    item = frappe.db.get_value("Item Barcode", {"barcode": parsed_code}, "parent")
    if item: return item
    
    return parsed_code  # Return as-is if no match
```

---

## 20. Entity Relationship Diagram

```
┌─────────────┐     ┌──────────────────┐     ┌───────────────┐
│  Customer    │────▶│  SalesOrder      │◀────│ SalesAuditLog │
│  - name      │     │  - so_number     │     │ - entity_id   │
│  - gstin     │     │  - customer_name │     │ - action      │
│  - price_list│     │  - platform      │     │ - reason      │
└─────────────┘     │  - status        │     └───────────────┘
                    └────────┬─────────┘
                             │ 1:N
                             ▼
                    ┌──────────────────┐
                    │ SalesOrderItem   │───▶ ┌───────────────┐
                    │ - item_code      │     │ ProductMaster  │
                    │ - quantity       │     │ - item_code    │
                    │ - unit_base_cost │     │ - swiggy_id    │
                    │ - igst_rate/amt  │     │ - zepto_id     │
                    └──────────────────┘     │ - blinkit_id   │
                                             │ - product_ean  │
                    ┌──────────────────┐     └───────┬────────┘
                    │ SalesRateList    │              │
                    │ - item_code      │     ┌───────┴────────┐
                    │ - price_list     │     │SKUCustomerBarcode│
                    │ - rate           │     │- customer_barcode│
                    └──────────────────┘     │- item_code      │
                                             └─────────────────┘
                    ┌──────────────────┐
                    │ BatchSeqCounter  │
                    │ - batch_key      │  e.g. "SO_25-26"
                    │ - last_seq       │  e.g. 5042
                    └──────────────────┘
```

---

## Summary of All Source Files

| # | File Path | Purpose | Lines |
|---|-----------|---------|-------|
| 1 | `lib/pdfTextExtractor.js` | Browser-side PDF text extraction via PDF.js | 67 |
| 2 | `lib/salesPDFParser.js` | Platform detection + Zepto/Swiggy/Blinkit regex parsers | 502 |
| 3 | `lib/salesPDFEnricher.js` | Client-side DB enrichment (customer, rates, products) | 185 |
| 4 | `functions/parseSalesPDF.js` | Server-side fallback parser + LLM + enrichment | 641 |
| 5 | `lib/docNumberHelper.js` | Sequential document number generator | 45 |
| 6 | `components/sales/CreateSalesOrderModal.jsx` | Main creation modal (Manual/PDF/Excel) | 533 |
| 7 | `components/sales/PDFBulkUploadModal.jsx` | Multi-PDF parallel upload & review | 335 |
| 8 | `components/sales/PDFInvoiceSplitView.jsx` | Side-by-side PDF + data review | 375 |
| 9 | `components/sales/ExcelSOImport.jsx` | Excel/BigBasket import via AI | 163 |
| 10 | `components/sales/SOEditableItemsTable.jsx` | Post-creation item editing with audit | 322 |
| 11 | `components/sales/SOEditReasonModal.jsx` | Mandatory reason modal for edits | 61 |
| 12 | `components/sales/PDFProcessingSteps.jsx` | Visual step progress indicator | 56 |
| 13 | `components/sales/PDFPreviewPanel.jsx` | PDF iframe preview component | 26 |

---

**Document Version**: 1.0  
**Generated**: 17/04/2026  
**Source System**: K95 ERP (Base44 Platform)  
**Platforms Covered**: Blinkit, Swiggy/Instamart, Zepto, BigBasket (Excel), Unknown (LLM)