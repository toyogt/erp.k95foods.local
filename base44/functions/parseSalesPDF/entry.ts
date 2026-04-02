import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ─── PLATFORM DETECTION ──────────────────────────────────────────────────
function detectPlatform(text) {
  const t = (text || '').toUpperCase();
  if (t.includes('HANDS ON TRADE') || t.includes('HOT ') || t.includes('INNOVATIVE RETAIL')) return 'blinkit';
  if (t.includes('SCOOTSY') || t.includes('CLOUDSTORE') || t.includes('SWIGGY')) return 'swiggy';
  if (t.includes('ZEPTO') || t.includes('KIRANAKART')) return 'zepto';
  if (t.includes('BIGBASKET') || t.includes('SUPERMARKET GROCERY')) return 'bigbasket';
  return 'unknown';
}

// ─── HELPERS ─────────────────────────────────────────────────────────────
function parseDate(raw) {
  if (!raw) return '';
  const monthMap = { january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12 };
  const longMatch = raw.match(/(\w+)\s+(\d{1,2}),?\s*(\d{4})/i);
  if (longMatch) {
    const m = monthMap[longMatch[1].toLowerCase()];
    if (m) return `${longMatch[3]}-${String(m).padStart(2,'0')}-${longMatch[2].padStart(2,'0')}`;
  }
  const isoMatch = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];
  const ddMatch = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (ddMatch) return `${ddMatch[3]}-${ddMatch[2]}-${ddMatch[1]}`;
  return raw.trim();
}

function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(/,/g, '').replace(/[^\d.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

// ─── ZEPTO PARSER (line-by-line extracted text) ──────────────────────────
function parseZepto(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const full = text;

  // Header fields — Zepto text has labels and values on separate lines
  // Look for the value AFTER the label line
  const po_number = (full.match(/PO\s*No:\s*\n\s*(P?\d+)/i) || full.match(/PO\s*No[:\s]*(P?\d+)/i) || [])[1] || '';
  const po_date = parseDate((full.match(/PO\s*Date:\s*\n\s*([\d\-]+)/i) || full.match(/PO\s*Date[:\s]*([\d\-]+)/i) || [])[1]);
  const po_expiry_date = parseDate((full.match(/PO\s*Expiry\s*Date:\s*\n\s*([\d\-]+)/i) || full.match(/PO\s*Expiry\s*Date[:\s]*([\d\-]+)/i) || [])[1]);
  const po_delivery_date = parseDate((full.match(/Expected\s*Delivery\s*Date:\s*\n\s*([\d\-]+)/i) || full.match(/Expected\s*Delivery\s*Date[:\s]*([\d\-]+)/i) || [])[1]);
  const payment_terms = (full.match(/Payment\s*Terms:\s*\n\s*([^\n]+)/i) || full.match(/Payment\s*Terms[:\s]*([^\n]*)/i) || [])[1]?.trim() || '';
  const billingGstin = (full.match(/GSTIN:\s*\n\s*(\d{2}[A-Z0-9]{13})/i) || full.match(/GSTIN[:\s]*(\d{2}[A-Z0-9]{13})/i) || [])[1] || '';

  // Customer name
  let customer_name = '';
  const cnMatch = full.match(/(?:Shipping|Billing)\s*Address\s*\n\s*([\s\S]*?)(?:GSTIN|PAN|\n\s*\n)/i);
  if (cnMatch) {
    const firstLine = cnMatch[1].split('\n')[0].trim();
    customer_name = firstLine;
  }
  if (!customer_name) customer_name = 'Zepto Private Limited';

  const billingBlock = full.match(/Billing\s*Address([\s\S]*?)(?:Shipping\s*Address)/i);
  const billing_address = billingBlock ? billingBlock[1].replace(/\s*\n\s*/g, ' ').replace(/GSTIN.*$/i, '').replace(/PAN.*$/i, '').trim() : '';
  const shippingBlock = full.match(/Shipping\s*Address([\s\S]*?)(?:Sr\.|Material\s*Code|GSTIN)/i);
  const shipping_address = shippingBlock ? shippingBlock[1].replace(/\s*\n\s*/g, ' ').replace(/GSTIN.*$/i, '').replace(/PAN.*$/i, '').trim() : billing_address;

  // Items — parse line by line
  // Pattern in extracted text:
  // Line: "1" (sr number)
  // Line: "142286" (material code)
  // Lines: description (may span multiple lines)
  // Line: UUID sku code like "020a60fe-f2ec-450d-\na127-87b660ea2754"
  // Line: "22029990" (HSN)
  // Line: "8906164010560" (EAN, 13 digits)
  // Line: "156" (quantity)
  // Line: "95.00" (MRP)
  // Line: "42.07" (unit base cost)
  // Line: "6563.14" (taxable value)
  // Then tax lines: "0.00%", "0.00", "0.00%", "0.00", "40.00%", "2625.26", "0.00%", "0.00", "0.00", "9188.40"

  const items = [];
  
  // Find the item table region
  const tableStartIdx = full.search(/Sr\.\s*\n\s*Material\s*Code/i);
  const tableEndIdx = full.search(/Total\s*Taxable\s*Amount/i);
  if (tableStartIdx >= 0) {
    const tableText = full.slice(tableStartIdx, tableEndIdx > tableStartIdx ? tableEndIdx : undefined);
    const tLines = tableText.split('\n').map(l => l.trim()).filter(Boolean);
    
    let i = 0;
    // Skip header lines
    while (i < tLines.length && !tLines[i].match(/^1$/)) i++;
    
    while (i < tLines.length) {
      // Sr number
      if (!tLines[i].match(/^\d{1,2}$/)) { i++; continue; }
      const sr = tLines[i]; i++;
      
      // Material code (digits, 3-10 chars)
      if (i >= tLines.length) break;
      const materialCode = tLines[i]; i++;
      if (!materialCode.match(/^\d{3,10}$/)) continue;
      
      // Description — collect lines until we hit a UUID-like pattern or HSN code
      let desc = '';
      while (i < tLines.length) {
        if (tLines[i].match(/^[a-f0-9]{8}-[a-f0-9]{4}/i)) break; // UUID SKU code start
        if (tLines[i].match(/^\d{8}$/) && desc.length > 10) break; // HSN code (if no SKU)
        desc += (desc ? ' ' : '') + tLines[i];
        i++;
      }
      
      // SKU code (UUID, may span 2 lines)
      let skuCode = '';
      if (i < tLines.length && tLines[i].match(/^[a-f0-9]{8}-/i)) {
        skuCode = tLines[i]; i++;
        // UUID continuation
        if (i < tLines.length && tLines[i].match(/^[a-f0-9]{4}-[a-f0-9]/i)) {
          skuCode += tLines[i]; i++;
        }
      }
      skuCode = skuCode.replace(/\s/g, '');
      
      // HSN code
      if (i >= tLines.length) break;
      const hsn = tLines[i]; i++;
      
      // EAN (13 digits)
      if (i >= tLines.length) break;
      const ean = tLines[i]; i++;
      
      // Quantity
      if (i >= tLines.length) break;
      const qty = num(tLines[i]); i++;
      
      // MRP
      if (i >= tLines.length) break;
      const mrp = num(tLines[i]); i++;
      
      // Unit base cost
      if (i >= tLines.length) break;
      const ubc = num(tLines[i]); i++;
      
      // Taxable value
      if (i >= tLines.length) break;
      const taxVal = num(tLines[i]); i++;
      
      // Tax lines: CGST rate, amt, SGST rate, amt, IGST rate, amt, CESS rate, amt, addtl cess, total
      let igstRate = 0, igstAmt = 0, totalAmt = 0;
      const taxNums = [];
      while (i < tLines.length && taxNums.length < 10) {
        const line = tLines[i];
        if (line.match(/^\d{1,2}$/) && taxNums.length >= 8) break; // next Sr number
        if (line.match(/^[\d.]+%?$/)) {
          taxNums.push(num(line));
          i++;
        } else break;
      }
      // taxNums: [cgstRate, cgstAmt, sgstRate, sgstAmt, igstRate, igstAmt, cessRate, cessAmt, addtlCess, total]
      if (taxNums.length >= 10) {
        igstRate = taxNums[4];
        igstAmt = taxNums[5];
        totalAmt = taxNums[9];
      } else {
        igstRate = 40;
        igstAmt = Math.round(taxVal * 0.4 * 100) / 100;
        totalAmt = Math.round(taxVal * 1.4 * 100) / 100;
      }

      items.push({
        item_code: materialCode,
        sku_code: skuCode,
        hsn_code: hsn.match(/^\d{8}$/) ? hsn : '22029990',
        ean_number: ean.match(/^\d{10,14}$/) ? ean : '',
        description: desc,
        quantity: qty,
        mrp,
        unit_base_cost: ubc,
        taxable_value: taxVal,
        igst_rate: igstRate, igst_amount: igstAmt,
        cgst_rate: 0, cgst_amount: 0, sgst_rate: 0, sgst_amount: 0,
        total_amount: totalAmt,
      });
    }
  }

  const taxable_amount = num((full.match(/Total\s*Taxable\s*Amount\s*\(INR\)[:\s]*([\d,.]+)/i) || [])[1]) || items.reduce((s, i) => s + i.taxable_value, 0);
  const tax_amount = num((full.match(/Total\s*Tax\s*\(INR\)[:\s]*([\d,.]+)/i) || [])[1]) || items.reduce((s, i) => s + i.igst_amount, 0);
  const total_amount = num((full.match(/Grand\s*Total\s*Amount\s*\(INR\)[:\s]*([\d,.]+)/i) || [])[1]) || taxable_amount + tax_amount;

  return { platform: 'zepto', po_number, po_date, po_expiry_date, po_delivery_date, payment_terms, customer_name, customer_gstin: billingGstin, billing_address, shipping_address, taxable_amount, tax_amount, total_amount, items };
}

// ─── SWIGGY / SCOOTSY PARSER ────────────────────────────────────────────
function parseSwiggy(text) {
  const full = text;

  const po_number = (full.match(/PO\s*No[:\s]*([A-Z]*\d+)/i) || [])[1] || '';
  const po_date = parseDate((full.match(/PO\s*Date[:\s]*([\d\-\s:]+?)(?:\n|PO\s*Release)/i) || [])[1]?.trim());
  const po_expiry_date = parseDate((full.match(/PO\s*Expiry\s*Date[:\s]*([\d\-]+)/i) || [])[1]);
  const po_delivery_date = parseDate((full.match(/Expected\s*Delivery\s*Date[:\s]*([\d\-]+)/i) || [])[1]);
  const payment_terms = (full.match(/Payment\s*Terms[:\s]*(\d+\s*Days?)/i) || [])[1]?.trim() || '';

  const billingGstin = (full.match(/Billing\s*Address[\s\S]*?GSTIN[:\s]*(\d{2}[A-Z0-9]{13})/i) || [])[1] || '';
  
  // Customer name
  let customer_name = '';
  const custMatch = full.match(/Billing\s*Address\s*\n\s*([A-Z][A-Z\s]+(?:PRIVATE|LIMITED|LTD|LOGISTICS)[A-Z\s]*)/i);
  customer_name = custMatch ? custMatch[1].trim() : 'SCOOTSY LOGISTICS PRIVATE LIMITED';

  const billingBlock = full.match(/Billing\s*Address([\s\S]*?)Shipping\s*Address/i);
  const billing_address = billingBlock ? billingBlock[1].replace(/\s*\n\s*/g, ' ').replace(/GSTIN.*$/i, '').replace(/PAN.*$/i, '').trim() : '';
  const shipping_address = billing_address; // Swiggy bills and ships same

  // Items — Swiggy extracted text pattern:
  // "1 31670" (sr + item code on same line)
  // description lines
  // "22029990 60" (HSN + Qty on same line)
  // "95.00" (MRP)
  // "46.82" (unit base cost)
  // "2809.29" or "2809.2\n9" (taxable value, sometimes split across lines)
  // tax lines...

  const items = [];
  const tLines = full.split('\n').map(l => l.trim()).filter(Boolean);
  
  // Find table start
  let startIdx = 0;
  for (let k = 0; k < tLines.length; k++) {
    if (tLines[k].match(/^1\s+\d{3,}/)) { startIdx = k; break; }
  }
  
  let i = startIdx;
  while (i < tLines.length) {
    // Match "Sr ItemCode" pattern e.g. "1 31670"
    const srMatch = tLines[i].match(/^(\d{1,2})\s+(\d{3,10})$/);
    if (!srMatch) { 
      // Check if it's the totals section
      if (tLines[i].match(/Total\s*Amount|Prepared\s*By|Amount\s*in\s*Words/i)) break;
      i++; 
      continue; 
    }
    
    const itemCode = srMatch[2]; i++;
    
    // Description — collect until HSN+Qty line
    let desc = '';
    while (i < tLines.length) {
      if (tLines[i].match(/^\d{8}\s+\d+$/)) break; // HSN + Qty
      desc += (desc ? ' ' : '') + tLines[i];
      i++;
    }
    
    // HSN + Qty
    if (i >= tLines.length) break;
    const hsnQtyMatch = tLines[i].match(/^(\d{8})\s+(\d+)$/);
    if (!hsnQtyMatch) { i++; continue; }
    const hsn = hsnQtyMatch[1];
    const qty = num(hsnQtyMatch[2]); i++;
    
    // MRP
    if (i >= tLines.length) break;
    const mrp = num(tLines[i]); i++;
    
    // Unit base cost
    if (i >= tLines.length) break;
    const ubc = num(tLines[i]); i++;
    
    // Taxable value — may be split across 2 lines like "2809.2\n9"
    if (i >= tLines.length) break;
    let taxStr = tLines[i]; i++;
    // Check if next line is a single digit continuation
    if (i < tLines.length && tLines[i].match(/^\d{1,2}$/) && !tLines[i + 1]?.match(/^\d{3,}/)) {
      // Could be continuation of taxable value OR next Sr#
      // Heuristic: if the current taxStr has a decimal and looks incomplete
      if (taxStr.match(/\.\d$/) || (num(taxStr) < 100 && qty > 10)) {
        taxStr += tLines[i]; i++;
      }
    }
    const taxVal = num(taxStr);
    
    // Tax lines: 0.00% 0.00 0.00% 0.00 40.00% amt 0.00% 0.00 0.00 total
    let igstRate = 0, igstAmt = 0, totalAmt = 0;
    const taxNums = [];
    while (i < tLines.length && taxNums.length < 10) {
      if (tLines[i].match(/^\d{1,2}\s+\d{3,}/) || tLines[i].match(/Total|Prepared|Amount/i)) break;
      if (tLines[i].match(/^[\d.]+%?$/)) {
        taxNums.push(num(tLines[i]));
        i++;
      } else break;
    }
    if (taxNums.length >= 10) {
      igstRate = taxNums[4]; igstAmt = taxNums[5]; totalAmt = taxNums[9];
    } else {
      igstRate = 40;
      igstAmt = Math.round(taxVal * 0.4 * 100) / 100;
      totalAmt = Math.round(taxVal * 1.4 * 100) / 100;
    }

    items.push({
      item_code: itemCode, hsn_code: hsn, ean_number: '', description: desc,
      quantity: qty, mrp, unit_base_cost: ubc, taxable_value: taxVal,
      igst_rate: igstRate, igst_amount: igstAmt,
      cgst_rate: 0, cgst_amount: 0, sgst_rate: 0, sgst_amount: 0,
      total_amount: totalAmt,
    });
  }

  const taxable_amount = num((full.match(/Total\s*Amount\s*\(INR\)[:\s]*([\d,.]+)/i) || [])[1]) || items.reduce((s, i) => s + i.taxable_value, 0);
  const tax_amount = num((full.match(/Total\s*Tax\s*\(INR\)[:\s]*([\d,.]+)/i) || [])[1]) || items.reduce((s, i) => s + i.igst_amount, 0);
  const total_amount = num((full.match(/Grand\s*Total\s*\(INR\)[:\s]*([\d,.]+)/i) || [])[1]) || taxable_amount + tax_amount;

  return { platform: 'swiggy', po_number, po_date, po_expiry_date, po_delivery_date, payment_terms, customer_name, customer_gstin: billingGstin, billing_address, shipping_address, taxable_amount, tax_amount, total_amount, items };
}

// ─── BLINKIT PARSER ──────────────────────────────────────────────────────
function parseBlinkit(text) {
  const full = text;

  // Blinkit has values on the line AFTER the label
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
  const customer_gstin = (full.match(/Delivered\s*[\s\S]*?GST\s*No\.?\s*[:\s]*(\d{2}[A-Z0-9]{13})/i) || [])[1] ||
                          (full.match(/29[A-Z0-9]{13}/i) || [])[0] || '';

  const deliveredTo = full.match(/Delivered[\s\S]*?To[\s\S]*?[:]\s*(HANDS[\s\S]*?)(?:GST\s*No|Reference|\n\s*\n)/i);
  const shipping_address = deliveredTo ? deliveredTo[1].replace(/\s*\n\s*/g, ' ').trim() : '';

  // Items — Blinkit extracted text pattern (line by line):
  // "1" (sr)
  // "101145 2202 890616"  (item code partial + HSN partial + EAN partial)
  // "00     9990 401058"  (continuations)
  // "4"                   (EAN last digit)
  // "Toyo" "Kombucha" ... (description on multiple lines)
  // "40.71" (basic cost)
  // "40.0 0.00 0 16.28 57.00 552" (IGST% CESS% ADDT.CESS TaxAmt LandingRate Qty)
  // "0"  (continuation of IGST% → 40.00)
  // "95.00" (MRP)
  // "40.0" (Margin%)
  // "31464.0" or "31464.00" (Total, may split)

  const items = [];
  const tLines = full.split('\n').map(l => l.trim()).filter(Boolean);

  // Find item table — look for first "1\n" after the column headers
  let startIdx = -1;
  for (let k = 0; k < tLines.length; k++) {
    if (tLines[k] === 'Total' || tLines[k].match(/^Amt$/)) continue;
    if (tLines[k] === '1' && k > 20) {
      // Verify next line has item code pattern
      if (tLines[k + 1]?.match(/^\d{6}/)) {
        startIdx = k;
        break;
      }
    }
  }
  
  if (startIdx >= 0) {
    let i = startIdx;
    while (i < tLines.length) {
      // Sr number
      if (!tLines[i].match(/^\d{1,2}$/)) {
        if (tLines[i].match(/Total\s*Quantity|Total\s*Amount|Net\s*amount|Terms/i)) break;
        i++; continue;
      }
      i++; // skip sr
      
      // Next 2-3 lines: ItemCode(split) HSN(split) EAN(split) in columnar format
      // Line1: "101145 2202 890616"  (top halves of 3 columns)
      // Line2: "00     9990 401058"  (bottom halves)
      // Line3: "4"                    (EAN last digit)
      if (i >= tLines.length) break;
      
      // Collect 2-3 lines of digit data
      const digitLines = [];
      while (i < tLines.length && digitLines.length < 4) {
        if (tLines[i].match(/^[A-Z]/i) && tLines[i].length > 3) break;
        if (tLines[i].match(/^\d+\.\d{2}$/)) break; // cost line
        digitLines.push(tLines[i]);
        i++;
      }
      
      // Parse columns: line1 has 3 groups, line2 has 3 groups, pair them vertically
      let itemCode = '', hsn = '', ean = '';
      if (digitLines.length >= 2) {
        const g1 = (digitLines[0] || '').trim().split(/\s+/);
        const g2 = (digitLines[1] || '').trim().split(/\s+/);
        const g3 = (digitLines[2] || '').trim();
        
        // Pair: col1 = g1[0]+g2[0], col2 = g1[1]+g2[1], col3 = g1[2]+g2[2]+g3
        itemCode = (g1[0] || '') + (g2[0] || '');
        hsn = (g1[1] || '') + (g2[1] || '');
        ean = (g1[2] || '') + (g2[2] || '') + (g3 || '');
        
        // Validate and fix
        if (hsn.length !== 8) hsn = '22029990';
        if (ean.length < 12) ean = '';
      } else if (digitLines.length === 1) {
        const parts = digitLines[0].split(/\s+/);
        itemCode = parts[0] || '';
        hsn = parts[1] || '22029990';
        ean = parts[2] || '';
      }
      
      // Description — collect until we hit cost line (decimal like "40.71")
      let desc = '';
      while (i < tLines.length) {
        if (tLines[i].match(/^\d+\.\d{2}$/) && desc.length > 5) break;
        if (tLines[i].match(/Total\s*Quantity|Total\s*Amount|Net\s*amount/i)) break;
        desc += (desc ? ' ' : '') + tLines[i];
        i++;
      }
      desc = desc.replace(/\s+/g, ' ').trim();
      
      // Basic cost price (e.g. "40.71")
      if (i >= tLines.length) break;
      const basicCost = num(tLines[i]); i++;
      
      // Combined line: "40.0 0.00 0 16.28 57.00 552"
      // = IGST% CESS% ADDT_CESS TaxAmt LandingRate Qty
      if (i >= tLines.length) break;
      const comboLine = tLines[i]; i++;
      const comboParts = comboLine.split(/\s+/).map(num);
      
      let igstPct = 0, taxAmt = 0, landingRate = 0, qty = 0;
      if (comboParts.length >= 6) {
        igstPct = comboParts[0]; taxAmt = comboParts[3]; landingRate = comboParts[4]; qty = comboParts[5];
      } else if (comboParts.length >= 3) {
        igstPct = comboParts[0]; qty = comboParts[comboParts.length - 1];
      }
      
      // Skip stray "0" line (continuation artifact)
      if (i < tLines.length && tLines[i] === '0') i++;
      
      // MRP
      if (i >= tLines.length) break;
      const mrp = num(tLines[i]); i++;
      
      // Margin %
      if (i >= tLines.length) break;
      i++; // skip margin
      
      // Total amount — may be split "31464.0\n0" → "31464.00"
      if (i >= tLines.length) break;
      let totalStr = tLines[i]; i++;
      if (i < tLines.length && tLines[i] === '0' && !totalStr.match(/\.00$/)) {
        totalStr += tLines[i]; i++;
      }
      const totalAmt = num(totalStr);
      
      const taxableValue = igstPct > 0 ? Math.round(totalAmt / (1 + igstPct / 100) * 100) / 100 : totalAmt;
      const igstAmount = Math.round((totalAmt - taxableValue) * 100) / 100;

      items.push({
        item_code: itemCode, hsn_code: hsn.length === 8 ? hsn : '22029990',
        ean_number: ean.length >= 12 ? ean : '', description: desc,
        quantity: qty, mrp, unit_base_cost: basicCost,
        taxable_value: taxableValue,
        igst_rate: igstPct, igst_amount: igstAmount,
        cgst_rate: 0, cgst_amount: 0, sgst_rate: 0, sgst_amount: 0,
        total_amount: totalAmt,
      });
    }
  }

  const totalMatch = full.match(/Net\s*amount\s*([\d,.]+)/i) || full.match(/Total\s*Amount\s*([\d,.]+)/i);
  const total_amount = num(totalMatch?.[1]) || items.reduce((s, i) => s + i.total_amount, 0);
  const taxable_amount = items.reduce((s, i) => s + i.taxable_value, 0);
  const tax_amount = total_amount - taxable_amount;

  return { platform: 'blinkit', po_number, po_date, po_expiry_date, po_delivery_date, payment_terms, vendor_no, customer_name: customer_name || 'HANDS ON TRADES PRIVATE LIMITED', customer_gstin, billing_address: shipping_address, shipping_address, taxable_amount: Math.round(taxable_amount * 100) / 100, tax_amount: Math.round(tax_amount * 100) / 100, total_amount, items, _delivery_location: delivery_location };
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { pdf_url, raw_text } = body;
    if (!pdf_url && !raw_text) return Response.json({ error: 'pdf_url or raw_text is required' }, { status: 400 });

    const t0 = Date.now();

    // ── STEP 1: Get text — if frontend sent raw_text, use it; otherwise extract ──
    let textPromise;
    if (raw_text) {
      textPromise = Promise.resolve(raw_text);
    } else {
      textPromise = base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
        file_url: pdf_url,
        json_schema: { type: 'object', properties: { full_text: { type: 'string', description: 'Complete raw text of the PDF' } } }
      }).then(r => r?.output?.full_text || '');
    }

    // Parallel: text extraction + all DB lookups
    const [rawText, allCustomers, allRates, allProducts, allCustomerBarcodes] = await Promise.all([
      textPromise,
      base44.asServiceRole.entities.Customer.filter({ status: 'active' }),
      base44.asServiceRole.entities.SalesRateList.filter({ is_active: true }),
      base44.asServiceRole.entities.ProductMaster.filter({ is_active: true }),
      base44.asServiceRole.entities.SKUCustomerBarcode.list('-created_date', 2000).catch(() => []),
    ]);

    const extractTime = Date.now() - t0;

    // ── STEP 2: Detect platform and parse ───────────────────────────────
    const platform = detectPlatform(rawText);
    let parsedData = null;
    let parseMethod = 'regex';

    if (platform === 'zepto') parsedData = parseZepto(rawText);
    else if (platform === 'swiggy') parsedData = parseSwiggy(rawText);
    else if (platform === 'blinkit') parsedData = parseBlinkit(rawText);

    // LLM fallback for unknown
    if (!parsedData || parsedData.items.length === 0) {
      parseMethod = 'llm_fallback';
      parsedData = await base44.asServiceRole.integrations.Core.InvokeLLM({
        model: 'gemini_3_flash', file_urls: [pdf_url],
        prompt: `Extract PO data from PDF. Return JSON: po_number, po_date (YYYY-MM-DD), po_expiry_date, po_delivery_date, payment_terms, customer_name, customer_gstin, billing_address, shipping_address, vendor_no, platform, taxable_amount, tax_amount, total_amount, items: [{item_code, sku_code, hsn_code, ean_number, description, quantity, mrp, unit_base_cost, taxable_value, igst_rate, igst_amount, total_amount}]`,
        response_json_schema: {
          type: 'object', properties: {
            platform:{type:'string'}, po_number:{type:'string'}, po_date:{type:'string'}, po_expiry_date:{type:'string'},
            po_delivery_date:{type:'string'}, payment_terms:{type:'string'}, customer_name:{type:'string'},
            customer_gstin:{type:'string'}, billing_address:{type:'string'}, shipping_address:{type:'string'},
            vendor_no:{type:'string'}, taxable_amount:{type:'number'}, tax_amount:{type:'number'}, total_amount:{type:'number'},
            items:{type:'array',items:{type:'object',properties:{item_code:{type:'string'},sku_code:{type:'string'},hsn_code:{type:'string'},ean_number:{type:'string'},description:{type:'string'},quantity:{type:'number'},mrp:{type:'number'},unit_base_cost:{type:'number'},taxable_value:{type:'number'},igst_rate:{type:'number'},igst_amount:{type:'number'},total_amount:{type:'number'}}}}
          }
        }
      });
      if (!parsedData.platform) parsedData.platform = 'direct';
    }

    let enrichedData = { ...parsedData };

    // ── STEP 3: Lookup maps ─────────────────────────────────────────────
    const productByCode = {}, productByEAN = {}, productByName = [];
    for (const p of allProducts) {
      if (p.item_code) productByCode[p.item_code.trim().toUpperCase()] = p;
      if (p.product_barcode) productByEAN[p.product_barcode.trim()] = p;
      if (p.product_name) productByName.push({ p, words: p.product_name.toLowerCase().split(' ').filter(w => w.length > 3) });
    }
    const barcodeToItemCode = {};
    for (const cb of allCustomerBarcodes) {
      if (cb.customer_barcode && cb.item_code) barcodeToItemCode[cb.customer_barcode.trim().toUpperCase()] = cb.item_code.trim();
      if (cb.customer_sku && cb.item_code) barcodeToItemCode[cb.customer_sku.trim().toUpperCase()] = cb.item_code.trim();
    }

    // ── STEP 4: Customer + price list ───────────────────────────────────
    const extractedGstin = (enrichedData.customer_gstin || '').trim().toUpperCase();
    const extractedName = (enrichedData.customer_name || '').toLowerCase().trim();
    const customerFound =
      allCustomers.find(c => c.gstin && c.gstin.trim().toUpperCase() === extractedGstin) ||
      allCustomers.find(c => c.name && c.name.toLowerCase().includes(extractedName.slice(0, 20))) ||
      allCustomers.find(c => c.name && extractedName.includes(c.name.toLowerCase().slice(0, 15)));

    let priceListUsed = null, rateSource = 'none';
    if (customerFound?.price_list) { priceListUsed = customerFound.price_list; rateSource = `customer:${customerFound.name}`; }
    else if (customerFound?.customer_group) {
      const grp = customerFound.customer_group.toLowerCase();
      const pls = [...new Set(allRates.map(r => r.price_list).filter(Boolean))];
      const gm = pls.find(pl => pl.toLowerCase().includes(grp) || grp.includes(pl.toLowerCase()));
      if (gm) { priceListUsed = gm; rateSource = `group:${customerFound.customer_group}`; }
    }
    if (!priceListUsed && enrichedData.platform !== 'direct' && enrichedData.platform !== 'unknown') {
      const pls = [...new Set(allRates.map(r => r.price_list).filter(Boolean))];
      const pm = pls.find(pl => pl.toLowerCase().includes(enrichedData.platform.toLowerCase()));
      if (pm) { priceListUsed = pm; rateSource = `platform:${enrichedData.platform}`; }
    }

    const filteredRates = priceListUsed ? allRates.filter(r => r.price_list === priceListUsed) : allRates;
    const rateByItemCode = {}, rateByEAN = {}, rateByNameWords = [];
    for (const r of filteredRates) {
      if (r.item_code) rateByItemCode[r.item_code.trim()] = r;
      if (r.ean_number) rateByEAN[r.ean_number.trim()] = r;
      if (r.item_name) rateByNameWords.push({ r, words: r.item_name.toLowerCase().split(' ').filter(w => w.length > 3) });
    }

    // ── STEP 5: Enrich items ────────────────────────────────────────────
    let matchedCount = 0;
    if (enrichedData.items?.length) {
      enrichedData.items = enrichedData.items.map(item => {
        let resolvedItemCode = item.item_code || '';
        const pdfCode = (item.sku_code || item.item_code || '').trim().toUpperCase();
        const pdfEAN = (item.ean_number || '').trim().toUpperCase();
        if (pdfCode && barcodeToItemCode[pdfCode]) resolvedItemCode = barcodeToItemCode[pdfCode];
        else if (pdfEAN && barcodeToItemCode[pdfEAN]) resolvedItemCode = barcodeToItemCode[pdfEAN];

        let product = resolvedItemCode ? productByCode[resolvedItemCode.toUpperCase()] : null;
        if (!product && pdfEAN) { product = productByEAN[pdfEAN]; if (product) resolvedItemCode = product.item_code; }
        if (!product && item.description) {
          const dl = item.description.toLowerCase();
          const f = productByName.find(({ words }) => words.filter(w => dl.includes(w)).length >= Math.min(2, words.length));
          if (f) { product = f.p; resolvedItemCode = f.p.item_code; }
        }

        let rm = (resolvedItemCode && rateByItemCode[resolvedItemCode.trim()]) || (item.sku_code && rateByItemCode[item.sku_code.trim()]) || (item.ean_number && rateByEAN[item.ean_number.trim()]);
        if (!rm && item.description) {
          const dl = item.description.toLowerCase();
          rm = rateByNameWords.find(({ words }) => words.filter(w => dl.includes(w)).length >= Math.min(2, words.length))?.r;
        }

        const enriched = { ...item };
        if (resolvedItemCode) enriched.item_code = resolvedItemCode;
        if (product) {
          enriched.hsn_code = product.hsn_code || enriched.hsn_code || '22029990';
          enriched.packing_unit = product.bottles_per_box || enriched.packing_unit || 12;
          enriched._product_name = product.product_name;
          enriched._product_matched = true;
        }
        if (rm) {
          matchedCount++;
          enriched.item_code = rm.item_code || enriched.item_code;
          enriched.hsn_code = rm.hsn_code || enriched.hsn_code || '22029990';
          enriched.packing_unit = rm.packing_unit || enriched.packing_unit || 12;
          enriched.rate_snapshot = rm.rate; enriched.unit_base_cost = rm.rate;
          enriched.mrp = rm.mrp || enriched.mrp;
          enriched.igst_rate = rm.igst_rate ?? enriched.igst_rate;
          enriched._rate_matched = true; enriched._price_list = priceListUsed;
        } else { enriched.hsn_code = enriched.hsn_code || '22029990'; enriched._rate_matched = false; }
        return enriched;
      });
    }

    // ── STEP 6: Metadata ────────────────────────────────────────────────
    if (customerFound) {
      enrichedData._customer_id = customerFound.id;
      enrichedData._customer_price_list = customerFound.price_list || '';
      enrichedData._customer_group = customerFound.customer_group || '';
      enrichedData.price_list = priceListUsed || '';
      enrichedData.payment_terms = enrichedData.payment_terms || customerFound.payment_terms || '';
      enrichedData.customer_gstin = enrichedData.customer_gstin || customerFound.gstin || '';
      enrichedData.billing_address = enrichedData.billing_address || customerFound.billing_address || '';
      enrichedData.shipping_address = enrichedData.shipping_address || customerFound.shipping_address || '';
    }

    enrichedData._parse_method = parseMethod;
    enrichedData._extract_time_ms = extractTime;
    enrichedData._total_time_ms = Date.now() - t0;
    enrichedData._rate_source = rateSource;
    enrichedData._price_list_used = priceListUsed;
    enrichedData._customer_found = !!customerFound;
    enrichedData._matched_count = matchedCount;
    enrichedData._total_items = enrichedData.items?.length || 0;
    enrichedData._product_matched_count = (enrichedData.items || []).filter(i => i._product_matched).length;
    enrichedData._no_rate = !priceListUsed && matchedCount === 0;

    return Response.json({ success: true, data: enrichedData });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});