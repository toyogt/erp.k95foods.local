# K95 ERP — Sales Order PDF Parsing: Complete Code Reference (Part 1)

> **Purpose**: Exact production code for parsing Purchase Order PDFs from e-commerce platforms (Blinkit, Swiggy/Instamart, Zepto), enriching with master data, and creating Sales Orders. For AI model training or ERPNext migration.

---

## Table of Contents (Part 1)

1. [Architecture Overview](#1-architecture-overview)
2. [Data Model (Entity Schemas)](#2-data-model)
3. [PDF Text Extraction (Browser-Side)](#3-pdf-text-extraction)
4. [Platform Detection & Helpers](#4-platform-detection)
5. [Zepto Parser](#5-zepto-parser)
6. [Swiggy/Scootsy Parser](#6-swiggy-parser)
7. [Blinkit Parser](#7-blinkit-parser)
8. [DB Enrichment (Browser-Side)](#8-db-enrichment)
9. [Backend PDF Parser (Server-Side Fallback)](#9-backend-parser)

**See Part 2**: Sales Order Creation UI, Bulk Upload, Split View, Excel Import, Editable Items Table, Flow Diagrams, Product Matching Logic, ERPNext Migration Notes.

---

## 1. Architecture Overview

### Flow Summary

```
PDF File → Browser Text Extraction (PDF.js) → Platform Detection (regex)
  → Platform-Specific Parser (Blinkit/Swiggy/Zepto regex)
    → DB Enrichment (Customer, Price List, Product, Rate matching)
      → Review UI (Split View: PDF left, Data right)
        → Confirm → Create SalesOrder + SalesOrderItems + AuditLog + FMS Trigger
```

### Two-Track Processing

| Track | When Used | Speed | Method |
|-------|-----------|-------|--------|
| **Browser-side (primary)** | Known platforms (Blinkit, Swiggy, Zepto) | ~200ms | PDF.js text extraction → regex parsing → client-side DB enrichment |
| **Server-side (fallback)** | Unknown PDF formats | ~10-30s | Backend function → LLM extraction → server-side DB enrichment |

### Key Design Decisions

1. **Browser-first parsing**: PDF.js extracts text client-side in ~200ms, avoiding 10-30s server round-trip
2. **Regex over LLM**: Known platform formats use deterministic regex parsers — faster, cheaper, more reliable
3. **LLM fallback**: Unknown formats fall back to Gemini Flash for AI extraction
4. **System rates override PDF rates**: System's own rate list is authoritative; PDF rates shown for comparison
5. **Duplicate PO detection**: Checks existing Sales Orders for matching PO number + platform before creation
6. **Mandatory audit trail**: Every item edit/deletion requires a reason, logged in SalesAuditLog

---

## 2. Data Model

### SalesOrder Entity
```json
{
  "name": "SalesOrder",
  "properties": {
    "so_number": { "type": "string" },
    "source": { "type": "string", "enum": ["manual", "pdf_upload", "distributor_request", "excel_upload"] },
    "platform": { "type": "string", "enum": ["blinkit", "swiggy", "zepto", "direct", "other"] },
    "status": { "type": "string", "enum": ["draft", "confirmed", "logistics_review", "picking", "packing", "invoiced", "delivered", "paid", "closed", "cancelled"] },
    "customer_name": { "type": "string" },
    "customer_gstin": { "type": "string" },
    "billing_address": { "type": "string" },
    "shipping_address": { "type": "string" },
    "price_list": { "type": "string" },
    "po_number": { "type": "string" },
    "po_date": { "type": "string" },
    "po_expiry_date": { "type": "string" },
    "po_delivery_date": { "type": "string" },
    "planned_dispatch_date": { "type": "string" },
    "payment_terms": { "type": "string" },
    "vendor_no": { "type": "string" },
    "taxable_amount": { "type": "number" },
    "tax_amount": { "type": "number" },
    "total_amount": { "type": "number" },
    "pdf_url": { "type": "string" },
    "expiry_override_approved": { "type": "boolean" }
  },
  "required": ["customer_name", "status"]
}
```

### SalesOrderItem Entity
```json
{
  "name": "SalesOrderItem",
  "properties": {
    "sales_order_id": { "type": "string" },
    "so_number": { "type": "string" },
    "item_code": { "type": "string" },
    "sku_code": { "type": "string" },
    "hsn_code": { "type": "string" },
    "ean_number": { "type": "string" },
    "description": { "type": "string" },
    "quantity": { "type": "number" },
    "mrp": { "type": "number" },
    "unit_base_cost": { "type": "number" },
    "rate_snapshot": { "type": "number" },
    "packing_unit": { "type": "number" },
    "taxable_value": { "type": "number" },
    "igst_rate": { "type": "number" },
    "igst_amount": { "type": "number" },
    "cgst_rate": { "type": "number" },
    "cgst_amount": { "type": "number" },
    "sgst_rate": { "type": "number" },
    "sgst_amount": { "type": "number" },
    "total_amount": { "type": "number" },
    "stock_status": { "type": "string", "enum": ["full", "partial", "unavailable", "not_checked"] }
  },
  "required": ["sales_order_id", "description", "quantity"]
}
```

### ProductMaster (Key Fields for Matching)
```json
{
  "item_code": "string — unique internal code",
  "product_name": "string",
  "product_barcode": "string — EAN barcode",
  "hsn_code": "string",
  "bottles_per_box": "number",
  "swiggy_item_id": "string — Swiggy platform item ID",
  "bigbasket_item_id": "string — BigBasket/Blinkit platform item ID",
  "zepto_item_id": "string — Zepto platform item ID",
  "amazon_item_id": "string — Amazon ASIN",
  "is_active": "boolean"
}
```

### SKUCustomerBarcode (Customer-Specific Code Mapping)
```json
{
  "customer_barcode": "string — customer's barcode for this product",
  "customer_sku": "string — customer's SKU code",
  "item_code": "string — maps to ProductMaster.item_code"
}
```

### SalesRateList (Price/Rate Data)
```json
{
  "item_code": "string",
  "price_list": "string — e.g. 'Blinkit', 'Zepto', 'Standard Selling'",
  "rate": "number — selling rate per unit",
  "mrp": "number",
  "igst_rate": "number",
  "is_active": "boolean"
}
```

---

## 3. PDF Text Extraction

**File: `lib/pdfTextExtractor.js`** — Uses PDF.js from CDN to extract text entirely in browser (~200-500ms).

```javascript
let pdfjsLib = null;

async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  if (!window.pdfjsLib) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  pdfjsLib = window.pdfjsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  return pdfjsLib;
}

export async function extractTextFromPDF(pdfUrl) {
  const lib = await loadPdfJs();
  const pdf = await lib.getDocument(pdfUrl).promise;
  const pages = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join('\n');
    pages.push(pageText);
  }
  return pages.join('\n');
}

export async function extractTextFromFile(file) {
  const lib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join('\n');
    pages.push(pageText);
  }
  return pages.join('\n');
}
```

---

## 4. Platform Detection & Helpers

**File: `lib/salesPDFParser.js`** (top section)

```javascript
export function detectPlatform(text) {
  const t = (text || '').toUpperCase();
  if (t.includes('HANDS ON TRADES') || t.includes('HOT ') || t.includes('INNOVATIVE RETAIL')) return 'blinkit';
  if (t.includes('SCOOTSY') || t.includes('CLOUDSTORE') || t.includes('INSTAMART')) return 'swiggy';
  if (t.includes('ZEPTO') || t.includes('KIRANAKART')) return 'zepto';
  if (t.includes('BIGBASKET') || t.includes('SUPERMARKET GROCERY')) return 'bigbasket';
  return 'unknown';
}

export function parseDate(raw) {
  if (!raw) return '';
  const monthMap = { january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,
    jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  const longMatch = raw.match(/(\w+)\s+(\d{1,2}),?\s*(\d{4})/i);
  if (longMatch) {
    const m = monthMap[longMatch[1].toLowerCase()];
    if (m) return `${longMatch[3]}-${String(m).padStart(2,'0')}-${String(longMatch[2]).padStart(2,'0')}`;
  }
  const isoMatch = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];
  const ddMatch = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (ddMatch) return `${ddMatch[3]}-${ddMatch[2]}-${ddMatch[1]}`;
  return raw.trim();
}

export function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(/,/g, '').replace(/[^\d.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}
```

---

## 5. Zepto Parser

**Table columns**: Sr. | Material Code | Description | SKU Code (UUID) | HSN | EAN | Qty | MRP | UBC | Taxable Value | CGST R/A | SGST R/A | IGST R/A | CESS R/A | AddtlCESS | Total

```javascript
export function parseZepto(text) {
  const full = text;
  const po_number = (full.match(/PO\s*No:\s*\n\s*(P?\d+)/i) || full.match(/PO\s*No[:\s]*(P?\d+)/i) || [])[1] || '';
  const po_date = parseDate((full.match(/PO\s*Date:\s*\n\s*([\d\-]+)/i) || full.match(/PO\s*Date[:\s]*([\d\-]+)/i) || [])[1]);
  const po_release_date = parseDate((full.match(/PO\s*Release\s*Date:\s*\n\s*([\d\-]+)/i) || full.match(/PO\s*Release\s*Date[:\s]*([\d\-]+)/i) || [])[1]);
  const po_expiry_date = parseDate((full.match(/PO\s*Expiry\s*Date:\s*\n\s*([\d\-]+)/i) || full.match(/PO\s*Expiry\s*Date[:\s]*([\d\-]+)/i) || [])[1]);
  const po_delivery_date = parseDate((full.match(/Expected\s*Delivery\s*Date:\s*\n\s*([\d\-]+)/i) || full.match(/Expected\s*Delivery\s*Date[:\s]*([\d\-]+)/i) || [])[1]);
  const payment_terms = (full.match(/Payment\s*Terms:\s*\n\s*([^\n]+)/i) || full.match(/Payment\s*Terms[:\s]*([^\n]*)/i) || [])[1]?.trim() || '';
  const billingGstin = (full.match(/GSTIN:\s*\n\s*(\d{2}[A-Z0-9]{13})/i) || full.match(/GSTIN[:\s]*(\d{2}[A-Z0-9]{13})/i) || [])[1] || '';

  let customer_name = '';
  const cnMatch = full.match(/(?:Shipping|Billing)\s*Address\s*\n\s*([\s\S]*?)(?:GSTIN|PAN|\n\s*\n)/i);
  if (cnMatch) customer_name = cnMatch[1].split('\n')[0].trim();
  if (!customer_name) customer_name = 'Zepto Private Limited';

  const billingBlock = full.match(/Billing\s*Address([\s\S]*?)(?:Shipping\s*Address)/i);
  const billing_address = billingBlock ? billingBlock[1].replace(/\s*\n\s*/g, ' ').replace(/GSTIN.*$/i, '').replace(/PAN.*$/i, '').trim() : '';
  const shippingBlock = full.match(/Shipping\s*Address([\s\S]*?)(?:Sr\.|Material\s*Code|GSTIN)/i);
  const shipping_address = shippingBlock ? shippingBlock[1].replace(/\s*\n\s*/g, ' ').replace(/GSTIN.*$/i, '').replace(/PAN.*$/i, '').trim() : billing_address;

  const items = [];
  const tableStartIdx = full.search(/Sr\.\s*\n\s*Material\s*Code/i);
  const tableEndIdx = full.search(/Total\s*Taxable\s*Amount/i);
  if (tableStartIdx >= 0) {
    const tableText = full.slice(tableStartIdx, tableEndIdx > tableStartIdx ? tableEndIdx : undefined);
    const tLines = tableText.split('\n').map(l => l.trim()).filter(Boolean);
    let i = 0;
    while (i < tLines.length && !tLines[i].match(/^1$/)) i++;

    while (i < tLines.length) {
      if (!tLines[i].match(/^\d{1,2}$/)) { i++; continue; }
      i++;
      if (i >= tLines.length) break;
      const materialCode = tLines[i]; i++;
      if (!materialCode.match(/^\d{3,10}$/)) continue;

      let desc = '';
      while (i < tLines.length) {
        if (tLines[i].match(/^[a-f0-9]{8}-[a-f0-9]{4}/i)) break;
        if (tLines[i].match(/^\d{8}$/) && desc.length > 10) break;
        desc += (desc ? ' ' : '') + tLines[i]; i++;
      }

      let skuCode = '';
      if (i < tLines.length && tLines[i].match(/^[a-f0-9]{8}-/i)) {
        skuCode = tLines[i]; i++;
        if (i < tLines.length && tLines[i].match(/^[a-f0-9]{4}-[a-f0-9]/i)) { skuCode += tLines[i]; i++; }
      }
      skuCode = skuCode.replace(/\s/g, '');

      if (i >= tLines.length) break;
      const hsn = tLines[i]; i++;
      if (i >= tLines.length) break;
      const ean = tLines[i]; i++;
      if (i >= tLines.length) break;
      const qty = num(tLines[i]); i++;
      if (i >= tLines.length) break;
      const mrp = num(tLines[i]); i++;
      if (i >= tLines.length) break;
      const ubc = num(tLines[i]); i++;
      if (i >= tLines.length) break;
      const taxVal = num(tLines[i]); i++;

      let igstRate = 0, igstAmt = 0, totalAmt = 0;
      const taxNums = [];
      while (i < tLines.length && taxNums.length < 10) {
        const line = tLines[i];
        if (line.match(/^\d{1,2}$/) && taxNums.length >= 8) break;
        if (line.match(/^[\d.]+%?$/)) { taxNums.push(num(line)); i++; }
        else break;
      }
      if (taxNums.length >= 10) {
        igstRate = taxNums[4]; igstAmt = taxNums[5]; totalAmt = taxNums[9];
      } else {
        igstRate = 40;
        igstAmt = Math.round(taxVal * 0.4 * 100) / 100;
        totalAmt = Math.round(taxVal * 1.4 * 100) / 100;
      }

      items.push({
        item_code: skuCode || materialCode, material_code: materialCode, sku_code: skuCode,
        hsn_code: hsn.match(/^\d{8}$/) ? hsn : '22029990',
        ean_number: ean.match(/^\d{10,14}$/) ? ean : '',
        description: desc, quantity: qty, mrp, unit_base_cost: ubc, taxable_value: taxVal,
        igst_rate: igstRate, igst_amount: igstAmt,
        cgst_rate: 0, cgst_amount: 0, sgst_rate: 0, sgst_amount: 0, total_amount: totalAmt,
      });
    }
  }

  const taxable_amount = num((full.match(/Total\s*Taxable\s*Amount\s*\(INR\)[:\s]*([\d,.]+)/i) || [])[1]) || items.reduce((s, i) => s + i.taxable_value, 0);
  const tax_amount = num((full.match(/Total\s*Tax\s*\(INR\)[:\s]*([\d,.]+)/i) || [])[1]) || items.reduce((s, i) => s + i.igst_amount, 0);
  const total_amount = num((full.match(/Grand\s*Total\s*Amount\s*\(INR\)[:\s]*([\d,.]+)/i) || [])[1]) || taxable_amount + tax_amount;

  return { platform: 'zepto', po_number, po_date, po_release_date, po_expiry_date, po_delivery_date, payment_terms, customer_name, customer_gstin: billingGstin, billing_address, shipping_address, taxable_amount, tax_amount, total_amount, items };
}
```

---

## 6. Swiggy/Scootsy Parser

**Table columns**: S.No | Item Code | Item Desc | HSN Code | Qty | MRP | UBC (INR) | Taxable Value (INR) | CGST R | CGST A | SGST R | SGST A | IGST R | IGST A | CESS R | CESS A | Addtl CESS | Total (INR)

```javascript
export function parseSwiggy(text) {
  const full = text;
  const po_number = (full.match(/PO\s*No\s*[:\s]*([A-Z]*\d+)/i) || [])[1] || '';
  const po_date = parseDate((full.match(/PO\s*Date\s*[:\s]*([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i) || full.match(/PO\s*Date[:\s]*([\d\-]+)/i) || [])[1]?.trim());
  const po_release_date = parseDate((full.match(/PO\s*Release\s*Date\s*[:\s]*([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i) || full.match(/PO\s*Release\s*Date[:\s]*([\d\-]+)/i) || [])[1]?.trim());
  const po_expiry_date = parseDate((full.match(/PO\s*Expiry\s*Date\s*[:\s]*([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i) || full.match(/PO\s*Expiry\s*Date[:\s]*([\d\-]+)/i) || [])[1]?.trim());
  const po_delivery_date = parseDate((full.match(/Expected\s*Delivery\s*Date\s*[:\s]*([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i) || full.match(/Expected\s*Delivery\s*Date[:\s]*([\d\-]+)/i) || [])[1]?.trim());
  const payment_terms = (full.match(/Payment\s*Terms\s*[:\s]*(\d+\s*Days?)/i) || [])[1]?.trim() || '';
  const billingGstin = (full.match(/Billing\s*Address[\s\S]*?GSTIN\s*[:\s]*(\d{2}[A-Z0-9]{13})/i) || [])[1] || '';

  let customer_name = 'SCOOTSY LOGISTICS PRIVATE LIMITED';
  const custMatch = full.match(/Billing\s*Address\s*\n*\s*([A-Z][A-Z\s]+(?:PRIVATE|LIMITED|LTD|LOGISTICS)[A-Z\s]*)/i);
  if (custMatch) {
    customer_name = custMatch[1].replace(/\s+/g, ' ').trim()
      .replace(/^Shipping\s*Address\s*/i, '').replace(/^Billing\s*Address\s*/i, '')
      .replace(/\s*Survey\s*No\.?.*$/i, '').replace(/\s*Plot\s*No\.?.*$/i, '').replace(/\s*Unit\s*No\.?.*$/i, '').trim();
  }

  const billingBlock = full.match(/Billing\s*Address\s*([\s\S]*?)(?:Shipping\s*Address)/i);
  let billing_address = billingBlock ? billingBlock[1].replace(/\s*\n\s*/g, ' ').replace(/GSTIN.*$/i, '').replace(/Contact.*$/i, '').trim() : '';
  if (billing_address && customer_name) {
    billing_address = billing_address.replace(new RegExp('^' + customer_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i'), '').trim();
  }
  const shippingBlock = full.match(/Shipping\s*Address\s*([\s\S]*?)(?:S\.\s*No|Item\s*Code|Item\s*\nCode)/i);
  let shipping_address = shippingBlock ? shippingBlock[1].replace(/\s*\n\s*/g, ' ').replace(/GSTIN.*$/i, '').replace(/Contact.*$/i, '').trim() : billing_address;
  if (shipping_address && customer_name) {
    shipping_address = shipping_address.replace(new RegExp('^' + customer_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i'), '').trim();
  }

  const items = [];
  const tLines = full.split('\n').map(l => l.trim()).filter(Boolean);
  let startIdx = -1;
  for (let k = 0; k < tLines.length; k++) {
    if (tLines[k].match(/^1\s+\d{4,6}$/)) { startIdx = k; break; }
    if (tLines[k] === '1' && tLines[k + 1]?.match(/^\d{4,6}$/)) { startIdx = k; break; }
  }

  if (startIdx >= 0) {
    let i = startIdx;
    while (i < tLines.length) {
      let itemCode = null;
      const combinedMatch = tLines[i].match(/^(\d{1,3})\s+(\d{4,6})$/);
      if (combinedMatch) { itemCode = combinedMatch[2]; i++; }
      else if (tLines[i].match(/^\d{1,3}$/) && tLines[i + 1]?.match(/^\d{4,6}$/)) { i++; itemCode = tLines[i]; i++; }
      else {
        if (tLines[i].match(/Total\s*Amount|Prepared\s*By|Amount\s*in\s*Words/i)) break;
        if (tLines[i].match(/^\d{4,}\.\d{2}$/) && !tLines[i + 1]?.match(/^\d{4,6}$/)) break;
        i++; continue;
      }

      let desc = '';
      while (i < tLines.length) {
        if (tLines[i].match(/^\d{8}$/)) break;
        if (tLines[i].match(/^\d{1,3}\s+\d{4,6}$/) || tLines[i].match(/Total\s*Amount/i)) break;
        desc += (desc ? ' ' : '') + tLines[i]; i++;
      }
      desc = desc.replace(/Colour:\s*Size:\s*\w*\s*Brand:\w*/gi, '').replace(/\s+/g, ' ').trim();
      if (i >= tLines.length) break;

      const hsn = tLines[i].match(/^\d{8}$/) ? tLines[i] : '22029990';
      if (tLines[i].match(/^\d{8}$/)) i++;

      const numericValues = [];
      while (i < tLines.length && numericValues.length < 14) {
        const line = tLines[i];
        if (line.match(/^\d{1,3}\s+\d{4,6}$/) || line.match(/^\d{1,3}$/) && tLines[i + 1]?.match(/^\d{4,6}$/)) break;
        if (line.match(/Total\s*Amount|Prepared\s*By|Amount\s*in\s*Words/i)) break;
        if (line.match(/^\d{4,}\.\d{2}$/) && numericValues.length >= 13) { numericValues.push(num(line)); i++; break; }
        const matches = line.match(/[\d,.]+/g);
        if (matches) { for (const m of matches) { if (numericValues.length < 14) numericValues.push(num(m)); } i++; }
        else break;
      }

      const qty = numericValues[0] || 0, mrp = numericValues[1] || 0, ubc = numericValues[2] || 0;
      const taxableValue = numericValues[3] || 0;
      const cgstRate = numericValues[4] || 0, cgstAmt = numericValues[5] || 0;
      const sgstRate = numericValues[6] || 0, sgstAmt = numericValues[7] || 0;
      const igstRate = numericValues[8] || 0, igstAmt = numericValues[9] || 0;
      const totalAmt = numericValues[13] || 0;

      if (qty > 0) {
        items.push({ item_code: itemCode, hsn_code: hsn, ean_number: '', description: desc,
          quantity: qty, mrp, unit_base_cost: ubc, taxable_value: taxableValue,
          cgst_rate: cgstRate, cgst_amount: cgstAmt, sgst_rate: sgstRate, sgst_amount: sgstAmt,
          igst_rate: igstRate, igst_amount: igstAmt, total_amount: totalAmt });
      }
    }
  }

  const taxable_amount = num((full.match(/Total\s*Amount\s*\(INR\)\s*([\d,.]+)/i) || [])[1]) || items.reduce((s, it) => s + it.taxable_value, 0);
  const tax_amount = num((full.match(/Total\s*Tax\s*\(INR\)\s*([\d,.]+)/i) || [])[1]) || items.reduce((s, it) => s + it.igst_amount, 0);
  const total_amount = num((full.match(/Grand\s*Total\s*\(INR\)\s*([\d,.]+)/i) || [])[1]) || taxable_amount + tax_amount;

  return { platform: 'swiggy', po_number, po_date, po_release_date, po_expiry_date, po_delivery_date, payment_terms, customer_name, customer_gstin: billingGstin, billing_address, shipping_address, taxable_amount, tax_amount, total_amount, items };
}
```

---

## 7. Blinkit Parser

**Unique challenge**: Item code, HSN, and EAN are concatenated as a single digit string (e.g., `1234567822029990890123456789`).

```javascript
export function parseBlinkit(text) {
  const full = text;
  const po_number = (full.match(/P\.?O\.?\s*Number\s*\n\s*(\d+)/i) || full.match(/P\.?O\.?\s*Number\s*[:\s]*(\d+)/i) || [])[1] || '';
  const po_date_raw = (full.match(/Date\s*\n?\s*:\s*([\w\s,.:]+?)\n/i) || full.match(/Date\s*[:\s]*(\w+\s+\d{1,2},?\s*\d{4})/i) || [])[1]?.trim() || '';
  const po_date = parseDate(po_date_raw);
  const po_expiry_date = parseDate((full.match(/PO\s*expiry\s*date\s*\n?\s*[:\s]*(\w+\s+\d{1,2},?\s*\d{4}[\w\s,.:]*)/i) || [])[1]?.trim());
  const po_delivery_date = parseDate((full.match(/PO\s*delivery\s*date\s*[:\s]*(\w+\s+\d{1,2},?\s*\d{4}[\w\s,.:]*)/i) || [])[1]?.trim());
  const payment_terms = (full.match(/Payment\s*Terms\s*\n?\s*[:\s]*(\d+\s*DAYS?)/i) || [])[1]?.trim() || '';
  const vendor_no = (full.match(/Vendor\s*No\.?\s*\n?\s*[:\s]*(\d+)/i) || [])[1] || '';

  let customer_name = (full.match(/(HANDS\s+ON\s+TRADES\s+PRIVATE\s+LIMITED)/i) || [])[1] || '';
  const locMatch = full.match(/(HOT\s+[\w\s\-]+(?:Feeder|Hub|Warehouse|Store|FC|Dark)[\w\s\-]*)/i);
  const delivery_location = locMatch ? locMatch[1].trim() : '';
  const customer_gstin = (full.match(/Delivered\s*[\s\S]*?GST\s*No\.?\s*[:\s]*(\d{2}[A-Z0-9]{13})/i) || [])[1] || (full.match(/29[A-Z0-9]{13}/i) || [])[0] || '';
  const deliveredTo = full.match(/Delivered[\s\S]*?To[\s\S]*?[:]\s*(HANDS[\s\S]*?)(?:GST\s*No|Reference|\n\s*\n)/i);
  const shipping_address = deliveredTo ? deliveredTo[1].replace(/\s*\n\s*/g, ' ').trim() : '';

  const items = [];
  const tLines = full.split('\n').map(l => l.trim()).filter(Boolean);
  let startIdx = -1;
  for (let k = 0; k < tLines.length; k++) {
    if (tLines[k] === 'Total' || tLines[k].match(/^Amt$/)) continue;
    if (tLines[k] === '1' && k > 20) { if (tLines[k + 1]?.match(/^\d{6}/)) { startIdx = k; break; } }
  }

  if (startIdx >= 0) {
    let i = startIdx;
    while (i < tLines.length) {
      if (!tLines[i].match(/^\d{1,2}$/)) {
        if (tLines[i].match(/Total\s*Quantity|Total\s*Amount|Net\s*amount|Terms/i)) break;
        i++; continue;
      }
      i++;
      if (i >= tLines.length) break;

      // DIGIT BLOB: collect all digit-only lines
      let digitStr = '';
      while (i < tLines.length) {
        const l = tLines[i];
        if (l.match(/^[A-Za-z]/) && l.length > 2) break;
        if (l.match(/^\d+\.\d{2}$/)) break;
        if (l.match(/^[\d\s]+$/)) { digitStr += l.replace(/\s+/g, ''); i++; }
        else break;
      }

      // Split: first 8 = item code, next 8 = HSN, rest = EAN
      let itemCode = '', hsn = '', ean = '';
      if (digitStr.length >= 16) { itemCode = digitStr.slice(0, 8); hsn = digitStr.slice(8, 16); ean = digitStr.slice(16); }
      else if (digitStr.length >= 8) { itemCode = digitStr.slice(0, 8); hsn = '22029990'; }
      else { itemCode = digitStr; hsn = '22029990'; }
      if (ean.length < 12) ean = '';

      let desc = '';
      while (i < tLines.length) {
        if (tLines[i].match(/^\d+\.\d{2}$/) && desc.length > 5) break;
        if (tLines[i].match(/Total\s*Quantity|Total\s*Amount|Net\s*amount/i)) break;
        desc += (desc ? ' ' : '') + tLines[i]; i++;
      }
      desc = desc.replace(/\s+/g, ' ').trim();

      if (i >= tLines.length) break;
      const basicCost = num(tLines[i]); i++;

      // Tax columns with split-decimal handling
      const taxCols = [], taxColStrs = [];
      while (i < tLines.length && taxCols.length < 6) {
        const l = tLines[i];
        if (l.match(/^[\d.]+(?:\s+[\d.]+)+$/)) {
          l.split(/\s+/).forEach(p => { taxCols.push(num(p)); taxColStrs.push(p); }); i++;
        } else if (l === '.') {
          i++; let decStr = '';
          while (i < tLines.length && tLines[i].match(/^\d$/)) { decStr += tLines[i]; i++; }
          if (taxCols.length > 0 && decStr) { const joined = taxColStrs[taxColStrs.length - 1] + '.' + decStr; taxCols[taxCols.length - 1] = num(joined); taxColStrs[taxColStrs.length - 1] = joined; }
        } else if (l.match(/^[\d.]+$/)) {
          const lastStr = taxColStrs.length > 0 ? taxColStrs[taxColStrs.length - 1] : '';
          if (lastStr.match(/\.\d$/) && l.match(/^\d{1,2}$/) && num(lastStr) < 100) { const joined = lastStr + l; taxCols[taxCols.length - 1] = num(joined); taxColStrs[taxColStrs.length - 1] = joined; }
          else { taxCols.push(num(l)); taxColStrs.push(l); }
          i++;
        } else break;
      }

      let igstPct = taxCols[0] || 0;
      const landingRate = taxCols[4] || 0;
      let qty = taxCols[5] || 0;

      if (i >= tLines.length) break;
      const mrp = num(tLines[i]); i++;
      if (i >= tLines.length) break;
      i++; // margin %
      if (i >= tLines.length) break;
      let totalStr = tLines[i]; i++;
      if (i < tLines.length && tLines[i].match(/^\d{1,2}$/) && totalStr.match(/\.\d$/)) { totalStr += tLines[i]; i++; }
      const totalAmt = num(totalStr);

      if ((!qty || qty > 10000) && landingRate > 0 && totalAmt > 0) {
        const derived = Math.round(totalAmt / landingRate);
        if (derived > 0 && derived < 10000) qty = derived;
      }

      const taxableValue = igstPct > 0 ? Math.round(totalAmt / (1 + igstPct / 100) * 100) / 100 : totalAmt;
      const igstAmount = Math.round((totalAmt - taxableValue) * 100) / 100;

      items.push({ item_code: itemCode, hsn_code: hsn.length === 8 ? hsn : '22029990',
        ean_number: ean.length >= 12 ? ean : '', description: desc,
        quantity: qty, mrp, unit_base_cost: basicCost, taxable_value: taxableValue,
        igst_rate: igstPct, igst_amount: igstAmount,
        cgst_rate: 0, cgst_amount: 0, sgst_rate: 0, sgst_amount: 0, total_amount: totalAmt });
    }
  }

  const totalMatch = full.match(/Net\s*amount\s*([\d,.]+)/i) || full.match(/Total\s*Amount\s*([\d,.]+)/i);
  const total_amount = num(totalMatch?.[1]) || items.reduce((s, i) => s + i.total_amount, 0);
  const taxable_amount = items.reduce((s, i) => s + i.taxable_value, 0);
  const tax_amount = total_amount - taxable_amount;

  return { platform: 'blinkit', po_number, po_date, po_expiry_date, po_delivery_date, payment_terms, vendor_no,
    customer_name: customer_name || 'HANDS ON TRADES PRIVATE LIMITED', customer_gstin,
    billing_address: shipping_address, shipping_address,
    taxable_amount: Math.round(taxable_amount * 100) / 100, tax_amount: Math.round(tax_amount * 100) / 100,
    total_amount, items, _delivery_location: delivery_location };
}

/** Main entry point */
export function parsePDFText(rawText) {
  const platform = detectPlatform(rawText);
  if (platform === 'zepto') return parseZepto(rawText);
  if (platform === 'swiggy') return parseSwiggy(rawText);
  if (platform === 'blinkit') return parseBlinkit(rawText);
  return null; // unknown → use LLM fallback
}
```

---

## 8. DB Enrichment

**File: `lib/salesPDFEnricher.js`** — Enriches parsed data with customer, rates, and product lookups (client-side).

```javascript
import { base44 } from '@/api/base44Client';

export async function enrichParsedData(parsedData) {
  const [allCustomers, allRates, allProducts, allCustomerBarcodes] = await Promise.all([
    base44.entities.Customer.filter({ status: 'active' }),
    base44.entities.SalesRateList.filter({ is_active: true }),
    base44.entities.ProductMaster.filter({ is_active: true }),
    base44.entities.SKUCustomerBarcode.list('-created_date', 2000).catch(() => []),
  ]);

  // Build lookup maps
  const productByCode = {}, productByEAN = {};
  const productByPlatformId = { swiggy: {}, zepto: {}, bigbasket: {}, amazon: {}, blinkit: {} };
  for (const p of allProducts) {
    if (p.item_code) productByCode[p.item_code.trim().toUpperCase()] = p;
    if (p.product_barcode) productByEAN[p.product_barcode.trim()] = p;
    if (p.swiggy_item_id) productByPlatformId.swiggy[p.swiggy_item_id.trim().toUpperCase()] = p;
    if (p.zepto_item_id) productByPlatformId.zepto[p.zepto_item_id.trim().toUpperCase()] = p;
    if (p.bigbasket_item_id) {
      productByPlatformId.bigbasket[p.bigbasket_item_id.trim().toUpperCase()] = p;
      productByPlatformId.blinkit[p.bigbasket_item_id.trim().toUpperCase()] = p;
    }
    if (p.amazon_item_id) productByPlatformId.amazon[p.amazon_item_id.trim().toUpperCase()] = p;
  }
  const barcodeToItemCode = {};
  for (const cb of allCustomerBarcodes) {
    if (cb.customer_barcode && cb.item_code) barcodeToItemCode[cb.customer_barcode.trim().toUpperCase()] = cb.item_code.trim();
    if (cb.customer_sku && cb.item_code) barcodeToItemCode[cb.customer_sku.trim().toUpperCase()] = cb.item_code.trim();
  }

  const platform = (parsedData.platform || '').toLowerCase();
  const platformMap = productByPlatformId[platform] || {};

  // Customer lookup
  const extractedGstin = (parsedData.customer_gstin || '').trim().toUpperCase();
  const extractedName = (parsedData.customer_name || '').toLowerCase().trim();
  const customerFound =
    allCustomers.find(c => c.gstin && c.gstin.trim().toUpperCase() === extractedGstin) ||
    allCustomers.find(c => c.name && c.name.toLowerCase().includes(extractedName.slice(0, 20))) ||
    allCustomers.find(c => c.name && extractedName.includes(c.name.toLowerCase().slice(0, 15)));

  // Price list: customer → group → platform (only if no customer)
  let priceListUsed = null, rateSource = 'none';
  if (customerFound?.price_list) { priceListUsed = customerFound.price_list; rateSource = `customer:${customerFound.name}`; }
  else if (customerFound?.customer_group) {
    const grp = customerFound.customer_group.trim().toLowerCase();
    const pls = [...new Set(allRates.map(r => r.price_list).filter(Boolean))].filter(pl => pl !== 'Internal Transfer');
    const gm = pls.find(pl => pl.trim().toLowerCase() === grp || pl.trim().toLowerCase().startsWith(grp));
    if (gm) { priceListUsed = gm; rateSource = `group:${customerFound.customer_group}`; }
  }
  if (!priceListUsed && !customerFound && parsedData.platform && parsedData.platform !== 'direct') {
    const pls = [...new Set(allRates.map(r => r.price_list).filter(Boolean))];
    const pm = pls.find(pl => pl.trim().toLowerCase() === parsedData.platform.toLowerCase() || pl.trim().toLowerCase().startsWith(parsedData.platform.toLowerCase()));
    if (pm) { priceListUsed = pm; rateSource = `platform:${parsedData.platform}`; }
  }

  const filteredRates = priceListUsed ? allRates.filter(r => r.price_list === priceListUsed) : allRates;
  const rateByItemCode = {};
  for (const r of filteredRates) { if (r.item_code) rateByItemCode[r.item_code.trim()] = r; }

  // Enrich each item with 5-level product matching priority
  let matchedCount = 0;
  const enrichedItems = (parsedData.items || []).map(item => {
    const rawParsedCode = (item.item_code || '').trim().toUpperCase();
    let product = platformMap[rawParsedCode] || null;                              // P1: Platform ID
    let resolvedItemCode = rawParsedCode;
    if (!product && barcodeToItemCode[rawParsedCode]) {                            // P2: Customer barcode
      resolvedItemCode = barcodeToItemCode[rawParsedCode].toUpperCase();
      product = productByCode[resolvedItemCode];
    }
    if (!product) product = productByCode[resolvedItemCode];                       // P3: Direct item_code
    if (!product && item.ean_number) product = productByEAN[item.ean_number.trim()]; // P4: EAN
    if (!product && rawParsedCode.match(/^\d{12,14}$/)) product = productByEAN[rawParsedCode]; // P5: Raw as EAN

    if (product) resolvedItemCode = product.item_code.trim().toUpperCase();
    const rm = rateByItemCode[resolvedItemCode] || rateByItemCode[product?.item_code?.trim()];

    const enriched = { ...item };
    enriched.item_code = product ? product.item_code.trim() : item.item_code;
    enriched._parsed_platform_code = rawParsedCode;
    if (product) {
      enriched.description = product.product_name; enriched.sku_code = product.item_code;
      enriched.hsn_code = product.hsn_code || '22029990'; enriched.packing_unit = product.bottles_per_box || 12;
      enriched._product_name = product.product_name; enriched._product_matched = true;
    }
    if (rm) {
      matchedCount++;
      enriched.unit_base_cost = rm.rate; enriched.mrp = rm.mrp; enriched.igst_rate = rm.igst_rate;
      enriched._rate_matched = true; enriched._price_list = priceListUsed;
    } else { enriched._rate_matched = false; }

    if (enriched.unit_base_cost && enriched.quantity) {
      enriched.taxable_value = enriched.unit_base_cost * enriched.quantity;
      if (enriched.igst_rate) enriched.igst_amount = enriched.taxable_value * (enriched.igst_rate / 100);
      enriched.total_amount = (enriched.taxable_value || 0) + (enriched.igst_amount || 0);
    }
    return enriched;
  });

  const enrichedData = { ...parsedData, items: enrichedItems };
  if (customerFound) {
    enrichedData._customer_id = customerFound.id;
    enrichedData._customer_price_list = customerFound.price_list || '';
    enrichedData._customer_group = customerFound.customer_group || '';
    enrichedData._customer_region = customerFound.region || customerFound.territory || '';
    enrichedData.customer_name = customerFound.name || enrichedData.customer_name;
    enrichedData.price_list = priceListUsed || '';
    enrichedData.payment_terms = enrichedData.payment_terms || customerFound.payment_terms || '';
    enrichedData.customer_gstin = enrichedData.customer_gstin || customerFound.gstin || '';
    enrichedData.billing_address = customerFound.billing_address || enrichedData.billing_address || '';
    enrichedData.shipping_address = customerFound.shipping_address || enrichedData.shipping_address || '';
  }
  enrichedData._rate_source = rateSource; enrichedData._price_list_used = priceListUsed;
  enrichedData._customer_found = !!customerFound; enrichedData._matched_count = matchedCount;
  enrichedData._total_items = enrichedItems.length;
  enrichedData._product_matched_count = enrichedItems.filter(i => i._product_matched).length;
  enrichedData._no_rate = !priceListUsed && matchedCount === 0;
  enrichedData._parse_method = 'browser_regex';
  return enrichedData;
}
```

---

## 9. Backend PDF Parser (Server-Side Fallback)

**File: `functions/parseSalesPDF.js`** — Deno Deploy function. Contains same regex parsers + LLM fallback.

```javascript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// detectPlatform, parseDate, num — identical to browser-side
// parseZepto, parseSwiggy, parseBlinkit — identical to browser-side

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { pdf_url, raw_text } = body;
    if (!pdf_url && !raw_text) return Response.json({ error: 'pdf_url or raw_text is required' }, { status: 400 });

    // Parallel: text extraction + master data fetch
    let textPromise = raw_text ? Promise.resolve(raw_text)
      : base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
          file_url: pdf_url,
          json_schema: { type: 'object', properties: { full_text: { type: 'string' } } }
        }).then(r => r?.output?.full_text || '');

    const [rawText, allCustomers, allRates, allProducts, allCustomerBarcodes] = await Promise.all([
      textPromise,
      base44.asServiceRole.entities.Customer.filter({ status: 'active' }),
      base44.asServiceRole.entities.SalesRateList.filter({ is_active: true }),
      base44.asServiceRole.entities.ProductMaster.filter({ is_active: true }),
      base44.asServiceRole.entities.SKUCustomerBarcode.list('-created_date', 2000).catch(() => []),
    ]);

    // Regex parsing
    const platform = detectPlatform(rawText);
    let parsedData = null, parseMethod = 'regex';
    if (platform === 'zepto') parsedData = parseZepto(rawText);
    else if (platform === 'swiggy') parsedData = parseSwiggy(rawText);
    else if (platform === 'blinkit') parsedData = parseBlinkit(rawText);

    // LLM fallback
    if (!parsedData || parsedData.items.length === 0) {
      parseMethod = 'llm_fallback';
      parsedData = await base44.asServiceRole.integrations.Core.InvokeLLM({
        model: 'gemini_3_flash', file_urls: [pdf_url],
        prompt: 'Extract PO data from PDF. Return JSON with po_number, customer_name, items[{item_code, quantity}]...',
        response_json_schema: { /* structured schema */ }
      });
    }

    // Enrichment (same logic as browser-side enricher)
    // ... customer lookup, price list resolution, product matching, rate assignment ...

    return Response.json({ success: true, data: enrichedData });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
```

---

**Continued in Part 2** → Sales Order Creation UI, Bulk Upload, Split View, Excel Import, Flow Diagrams, Product Matching Logic, ERPNext Migration.