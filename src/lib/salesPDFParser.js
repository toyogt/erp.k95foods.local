/**
 * Browser-side sales PDF parser — pure JS, no backend needed for known platforms.
 * Ported 1:1 from functions/parseSalesPDF.js regex logic.
 */

// ─── PLATFORM DETECTION ──────────────────────────────────────────────────
export function detectPlatform(text) {
  const t = (text || '').toUpperCase();
  if (t.includes('HANDS ON TRADES') || t.includes('HOT ') || t.includes('INNOVATIVE RETAIL')) return 'blinkit';
  if (t.includes('SCOOTSY') || t.includes('CLOUDSTORE') || t.includes('INSTAMART')) return 'swiggy';
  if (t.includes('ZEPTO') || t.includes('KIRANAKART')) return 'zepto';
  if (t.includes('BIGBASKET') || t.includes('SUPERMARKET GROCERY')) return 'bigbasket';
  return 'unknown';
}

// ─── HELPERS ─────────────────────────────────────────────────────────────
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

// ─── ZEPTO PARSER ────────────────────────────────────────────────────────
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
        desc += (desc ? ' ' : '') + tLines[i];
        i++;
      }

      let skuCode = '';
      if (i < tLines.length && tLines[i].match(/^[a-f0-9]{8}-/i)) {
        skuCode = tLines[i]; i++;
        if (i < tLines.length && tLines[i].match(/^[a-f0-9]{4}-[a-f0-9]/i)) {
          skuCode += tLines[i]; i++;
        }
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

      // For Zepto: use SKU Code as item_code for matching
      items.push({
        item_code: skuCode || materialCode,
        material_code: materialCode,
        sku_code: skuCode,
        hsn_code: hsn.match(/^\d{8}$/) ? hsn : '22029990',
        ean_number: ean.match(/^\d{10,14}$/) ? ean : '',
        description: desc, quantity: qty, mrp,
        unit_base_cost: ubc, taxable_value: taxVal,
        igst_rate: igstRate, igst_amount: igstAmt,
        cgst_rate: 0, cgst_amount: 0, sgst_rate: 0, sgst_amount: 0,
        total_amount: totalAmt,
      });
    }
  }

  const taxable_amount = num((full.match(/Total\s*Taxable\s*Amount\s*\(INR\)[:\s]*([\d,.]+)/i) || [])[1]) || items.reduce((s, i) => s + i.taxable_value, 0);
  const tax_amount = num((full.match(/Total\s*Tax\s*\(INR\)[:\s]*([\d,.]+)/i) || [])[1]) || items.reduce((s, i) => s + i.igst_amount, 0);
  const total_amount = num((full.match(/Grand\s*Total\s*Amount\s*\(INR\)[:\s]*([\d,.]+)/i) || [])[1]) || taxable_amount + tax_amount;

  return { platform: 'zepto', po_number, po_date, po_release_date, po_expiry_date, po_delivery_date, payment_terms, customer_name, customer_gstin: billingGstin, billing_address, shipping_address, taxable_amount, tax_amount, total_amount, items };
}

// ─── SWIGGY / SCOOTSY PARSER ─────────────────────────────────────────────
// Handles the "SCOOTSY LOGISTICS PRIVATE LIMITED" / Swiggy Instamart PO format.
// Table columns: S.No | Item Code | Item Desc | HSN Code | Qty | MRP | Unit Base Cost (INR) | Taxable Value (INR) | CGST Rate | CGST Amt | SGST Rate | SGST Amt | IGST Rate | IGST Amt | CESS Rate | CESS Amt | Additional CESS | Total (INR)
export function parseSwiggy(text) {
  const full = text;

  // Header extraction — handles "Mar 10, 2026" style dates and ISO dates
  const po_number = (full.match(/PO\s*No\s*[:\s]*([A-Z]*\d+)/i) || [])[1] || '';
  const po_date = parseDate((full.match(/PO\s*Date\s*[:\s]*([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i) || full.match(/PO\s*Date[:\s]*([\d\-]+)/i) || [])[1]?.trim());
  const po_release_date = parseDate((full.match(/PO\s*Release\s*Date\s*[:\s]*([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i) || full.match(/PO\s*Release\s*Date[:\s]*([\d\-]+)/i) || [])[1]?.trim());
  const po_expiry_date = parseDate((full.match(/PO\s*Expiry\s*Date\s*[:\s]*([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i) || full.match(/PO\s*Expiry\s*Date[:\s]*([\d\-]+)/i) || [])[1]?.trim());
  const po_delivery_date = parseDate((full.match(/Expected\s*Delivery\s*Date\s*[:\s]*([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i) || full.match(/Expected\s*Delivery\s*Date[:\s]*([\d\-]+)/i) || [])[1]?.trim());
  const payment_terms = (full.match(/Payment\s*Terms\s*[:\s]*(\d+\s*Days?)/i) || [])[1]?.trim() || '';

  // Customer GSTIN (from Billing Address block)
  const billingGstin = (full.match(/Billing\s*Address[\s\S]*?GSTIN\s*[:\s]*(\d{2}[A-Z0-9]{13})/i) || [])[1] || '';

  // Customer name
  let customer_name = 'SCOOTSY LOGISTICS PRIVATE LIMITED';
  const custMatch = full.match(/Billing\s*Address\s*\n*\s*([A-Z][A-Z\s]+(?:PRIVATE|LIMITED|LTD|LOGISTICS)[A-Z\s]*)/i);
  if (custMatch) customer_name = custMatch[1].replace(/\s+/g, ' ').trim();

  // Addresses
  const billingBlock = full.match(/Billing\s*Address\s*([\s\S]*?)(?:Shipping\s*Address)/i);
  const billing_address = billingBlock ? billingBlock[1].replace(/\s*\n\s*/g, ' ').replace(/GSTIN.*$/i, '').replace(/Contact.*$/i, '').trim() : '';
  const shippingBlock = full.match(/Shipping\s*Address\s*([\s\S]*?)(?:S\.\s*No|Item\s*Code|Item\s*\nCode)/i);
  const shipping_address = shippingBlock ? shippingBlock[1].replace(/\s*\n\s*/g, ' ').replace(/GSTIN.*$/i, '').replace(/Contact.*$/i, '').trim() : billing_address;

  // --- Line Item Parsing ---
  const items = [];
  const tLines = full.split('\n').map(l => l.trim()).filter(Boolean);

  // Find the start of data rows: "1 31670" or "1" then "31670"
  let startIdx = -1;
  for (let k = 0; k < tLines.length; k++) {
    if (tLines[k].match(/^1\s+\d{4,6}$/)) { startIdx = k; break; }
    if (tLines[k] === '1' && tLines[k + 1]?.match(/^\d{4,6}$/)) { startIdx = k; break; }
  }

  if (startIdx >= 0) {
    let i = startIdx;
    while (i < tLines.length) {
      // Detect start of an item row
      let itemCode = null;
      const combinedMatch = tLines[i].match(/^(\d{1,3})\s+(\d{4,6})$/);
      if (combinedMatch) {
        itemCode = combinedMatch[2];
        i++;
      } else if (tLines[i].match(/^\d{1,3}$/) && tLines[i + 1]?.match(/^\d{4,6}$/)) {
        i++; // skip sr
        itemCode = tLines[i]; i++;
      } else {
        // Stop at footer
        if (tLines[i].match(/Total\s*Amount|Prepared\s*By|Amount\s*in\s*Words/i)) break;
        // Stop at totals row (e.g. "81469.29")
        if (tLines[i].match(/^\d{4,}\.\d{2}$/) && !tLines[i + 1]?.match(/^\d{4,6}$/)) break;
        i++;
        continue;
      }

      // Collect description text until HSN code (8 digits)
      let desc = '';
      while (i < tLines.length) {
        if (tLines[i].match(/^\d{8}$/)) break;
        // Stop if next item or total
        if (tLines[i].match(/^\d{1,3}\s+\d{4,6}$/) || tLines[i].match(/Total\s*Amount/i)) break;
        desc += (desc ? ' ' : '') + tLines[i];
        i++;
      }
      desc = desc.replace(/Colour:\s*Size:\s*\w*\s*Brand:\w*/gi, '').replace(/\s+/g, ' ').trim();

      if (i >= tLines.length) break;

      // HSN Code
      const hsn = tLines[i].match(/^\d{8}$/) ? tLines[i] : '22029990';
      if (tLines[i].match(/^\d{8}$/)) i++;

      // Collect ALL remaining numeric values for this row.
      // Expected: Qty, MRP, UBC, TaxableValue, CGST_Rate, CGST_Amt, SGST_Rate, SGST_Amt, IGST_Rate, IGST_Amt, CESS_Rate, CESS_Amt, Addtl_CESS, Total
      // Total = 14 values
      const numericValues = [];
      while (i < tLines.length && numericValues.length < 14) {
        const line = tLines[i];
        // Stop at next item row or footer
        if (line.match(/^\d{1,3}\s+\d{4,6}$/) || line.match(/^\d{1,3}$/) && tLines[i + 1]?.match(/^\d{4,6}$/)) break;
        if (line.match(/Total\s*Amount|Prepared\s*By|Amount\s*in\s*Words/i)) break;
        // Stop at standalone totals row (no more items after it)
        if (line.match(/^\d{4,}\.\d{2}$/) && numericValues.length >= 13) {
          // This is the Total value (14th)
          numericValues.push(num(line));
          i++;
          break;
        }

        // Try to extract numbers from this line
        const matches = line.match(/[\d,.]+/g);
        if (matches && matches.length > 0) {
          for (const m of matches) {
            if (numericValues.length < 14) numericValues.push(num(m));
          }
          i++;
        } else {
          break;
        }
      }

      // Map values: [Qty, MRP, UBC, TaxVal, CGST_R, CGST_A, SGST_R, SGST_A, IGST_R, IGST_A, CESS_R, CESS_A, ADDTL_CESS, Total]
      const qty = numericValues[0] || 0;
      const mrp = numericValues[1] || 0;
      const ubc = numericValues[2] || 0;
      const taxableValue = numericValues[3] || 0;
      const cgstRate = numericValues[4] || 0;
      const cgstAmt = numericValues[5] || 0;
      const sgstRate = numericValues[6] || 0;
      const sgstAmt = numericValues[7] || 0;
      const igstRate = numericValues[8] || 0;
      const igstAmt = numericValues[9] || 0;
      const cessRate = numericValues[10] || 0;
      const cessAmt = numericValues[11] || 0;
      const totalAmt = numericValues[13] || 0;

      if (qty > 0) {
        items.push({
          item_code: itemCode,
          hsn_code: hsn,
          ean_number: '',
          description: desc,
          quantity: qty,
          mrp,
          unit_base_cost: ubc,
          taxable_value: taxableValue,
          cgst_rate: cgstRate,
          cgst_amount: cgstAmt,
          sgst_rate: sgstRate,
          sgst_amount: sgstAmt,
          igst_rate: igstRate,
          igst_amount: igstAmt,
          total_amount: totalAmt,
        });
      }
    }
  }

  // Footer totals
  const taxable_amount = num((full.match(/Total\s*Amount\s*\(INR\)\s*([\d,.]+)/i) || [])[1]) || items.reduce((s, it) => s + it.taxable_value, 0);
  const tax_amount = num((full.match(/Total\s*Tax\s*\(INR\)\s*([\d,.]+)/i) || [])[1]) || items.reduce((s, it) => s + it.igst_amount, 0);
  const total_amount = num((full.match(/Grand\s*Total\s*\(INR\)\s*([\d,.]+)/i) || [])[1]) || taxable_amount + tax_amount;

  return {
    platform: 'swiggy',
    po_number,
    po_date,
    po_release_date,
    po_expiry_date,
    po_delivery_date,
    payment_terms,
    customer_name,
    customer_gstin: billingGstin,
    billing_address,
    shipping_address,
    taxable_amount,
    tax_amount,
    total_amount,
    items,
  };
}

// ─── BLINKIT PARSER ──────────────────────────────────────────────────────
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
  const customer_gstin = (full.match(/Delivered\s*[\s\S]*?GST\s*No\.?\s*[:\s]*(\d{2}[A-Z0-9]{13})/i) || [])[1] ||
                          (full.match(/29[A-Z0-9]{13}/i) || [])[0] || '';

  const deliveredTo = full.match(/Delivered[\s\S]*?To[\s\S]*?[:]\s*(HANDS[\s\S]*?)(?:GST\s*No|Reference|\n\s*\n)/i);
  const shipping_address = deliveredTo ? deliveredTo[1].replace(/\s*\n\s*/g, ' ').trim() : '';

  const items = [];
  const tLines = full.split('\n').map(l => l.trim()).filter(Boolean);

  let startIdx = -1;
  for (let k = 0; k < tLines.length; k++) {
    if (tLines[k] === 'Total' || tLines[k].match(/^Amt$/)) continue;
    if (tLines[k] === '1' && k > 20) {
      if (tLines[k + 1]?.match(/^\d{6}/)) { startIdx = k; break; }
    }
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

      let digitStr = '';
      while (i < tLines.length) {
        const l = tLines[i];
        if (l.match(/^[A-Za-z]/) && l.length > 2) break;
        if (l.match(/^\d+\.\d{2}$/)) break;
        if (l.match(/^[\d\s]+$/)) { digitStr += l.replace(/\s+/g, ''); i++; }
        else break;
      }

      let itemCode = '', hsn = '', ean = '';
      if (digitStr.length >= 16) {
        itemCode = digitStr.slice(0, 8);
        hsn = digitStr.slice(8, 16);
        ean = digitStr.slice(16);
      } else if (digitStr.length >= 8) {
        itemCode = digitStr.slice(0, 8);
        hsn = '22029990';
      } else {
        itemCode = digitStr;
        hsn = '22029990';
      }
      if (ean.length < 12) ean = '';

      let desc = '';
      while (i < tLines.length) {
        if (tLines[i].match(/^\d+\.\d{2}$/) && desc.length > 5) break;
        if (tLines[i].match(/Total\s*Quantity|Total\s*Amount|Net\s*amount/i)) break;
        desc += (desc ? ' ' : '') + tLines[i];
        i++;
      }
      desc = desc.replace(/\s+/g, ' ').trim();

      if (i >= tLines.length) break;
      const basicCost = num(tLines[i]); i++;

      const taxCols = [], taxColStrs = [];
      while (i < tLines.length && taxCols.length < 6) {
        const l = tLines[i];
        if (l.match(/^[\d.]+(?:\s+[\d.]+)+$/)) {
          l.split(/\s+/).forEach(p => { taxCols.push(num(p)); taxColStrs.push(p); });
          i++;
        } else if (l === '.') {
          i++;
          let decStr = '';
          while (i < tLines.length && tLines[i].match(/^\d$/)) { decStr += tLines[i]; i++; }
          if (taxCols.length > 0 && decStr) {
            const joined = taxColStrs[taxColStrs.length - 1] + '.' + decStr;
            taxCols[taxCols.length - 1] = num(joined);
            taxColStrs[taxColStrs.length - 1] = joined;
          }
        } else if (l.match(/^[\d.]+$/)) {
          const lastStr = taxColStrs.length > 0 ? taxColStrs[taxColStrs.length - 1] : '';
          if (lastStr.match(/\.\d$/) && l.match(/^\d{1,2}$/) && num(lastStr) < 100) {
            const joined = lastStr + l;
            taxCols[taxCols.length - 1] = num(joined);
            taxColStrs[taxColStrs.length - 1] = joined;
          } else {
            taxCols.push(num(l)); taxColStrs.push(l);
          }
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
      if (i < tLines.length && tLines[i].match(/^\d{1,2}$/) && totalStr.match(/\.\d$/)) {
        totalStr += tLines[i]; i++;
      }
      const totalAmt = num(totalStr);

      if ((!qty || qty > 10000) && landingRate > 0 && totalAmt > 0) {
        const derived = Math.round(totalAmt / landingRate);
        if (derived > 0 && derived < 10000) qty = derived;
      }

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

  return {
    platform: 'blinkit', po_number, po_date, po_expiry_date, po_delivery_date,
    payment_terms, vendor_no, customer_name: customer_name || 'HANDS ON TRADES PRIVATE LIMITED',
    customer_gstin, billing_address: shipping_address, shipping_address,
    taxable_amount: Math.round(taxable_amount * 100) / 100,
    tax_amount: Math.round(tax_amount * 100) / 100,
    total_amount, items, _delivery_location: delivery_location,
  };
}

/**
 * Main entry point — detect platform and parse.
 * Returns null if platform is unknown (caller should fall back to LLM).
 */
export function parsePDFText(rawText) {
  const platform = detectPlatform(rawText);
  if (platform === 'zepto') return parseZepto(rawText);
  if (platform === 'swiggy') return parseSwiggy(rawText);
  if (platform === 'blinkit') return parseBlinkit(rawText);
  return null; // unknown → use LLM fallback
}