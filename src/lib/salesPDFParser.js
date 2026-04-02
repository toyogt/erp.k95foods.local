/**
 * Browser-side sales PDF parser — pure JS, no backend needed for known platforms.
 * Ported 1:1 from functions/parseSalesPDF.js regex logic.
 */

// ─── PLATFORM DETECTION ──────────────────────────────────────────────────
export function detectPlatform(text) {
  const t = (text || '').toUpperCase();
  if (t.includes('HANDS ON TRADES') || t.includes('HOT ') || t.includes('INNOVATIVE RETAIL')) return 'blinkit';
  if (t.includes('SCOOTSY') || t.includes('CLOUDSTORE')) return 'swiggy';
  if (t.includes('ZEPTO') || t.includes('KIRANAKART')) return 'zepto';
  if (t.includes('BIGBASKET') || t.includes('SUPERMARKET GROCERY')) return 'bigbasket';
  return 'unknown';
}

// ─── HELPERS ─────────────────────────────────────────────────────────────
export function parseDate(raw) {
  if (!raw) return '';
  const monthMap = { january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12 };
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
      i++; // skip sr

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

      items.push({
        item_code: materialCode, sku_code: skuCode,
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

  return { platform: 'zepto', po_number, po_date, po_expiry_date, po_delivery_date, payment_terms, customer_name, customer_gstin: billingGstin, billing_address, shipping_address, taxable_amount, tax_amount, total_amount, items };
}

// ─── SWIGGY / SCOOTSY PARSER ─────────────────────────────────────────────
export function parseSwiggy(text) {
  const full = text;

  const po_number = (full.match(/PO\s*No[:\s]*([A-Z]*\d+)/i) || [])[1] || '';
  const po_date = parseDate((full.match(/PO\s*Date[:\s]*([\d\-\s:]+?)(?:\n|PO\s*Release)/i) || [])[1]?.trim());
  const po_expiry_date = parseDate((full.match(/PO\s*Expiry\s*Date[:\s]*([\d\-]+)/i) || [])[1]);
  const po_delivery_date = parseDate((full.match(/Expected\s*Delivery\s*Date[:\s]*([\d\-]+)/i) || [])[1]);
  const payment_terms = (full.match(/Payment\s*Terms[:\s]*(\d+\s*Days?)/i) || [])[1]?.trim() || '';

  const billingGstin = (full.match(/Billing\s*Address[\s\S]*?GSTIN[:\s]*(\d{2}[A-Z0-9]{13})/i) || [])[1] || '';

  let customer_name = '';
  const custMatch = full.match(/Billing\s*Address\s*\n\s*([A-Z][A-Z\s]+(?:PRIVATE|LIMITED|LTD|LOGISTICS)[A-Z\s]*)/i);
  customer_name = custMatch ? custMatch[1].trim() : 'SCOOTSY LOGISTICS PRIVATE LIMITED';

  const billingBlock = full.match(/Billing\s*Address([\s\S]*?)Shipping\s*Address/i);
  const billing_address = billingBlock ? billingBlock[1].replace(/\s*\n\s*/g, ' ').replace(/GSTIN.*$/i, '').replace(/PAN.*$/i, '').trim() : '';
  const shipping_address = billing_address;

  const items = [];
  const tLines = full.split('\n').map(l => l.trim()).filter(Boolean);

  let startIdx = 0;
  for (let k = 0; k < tLines.length; k++) {
    if (tLines[k].match(/^1\s+\d{3,}/)) { startIdx = k; break; }
  }

  let i = startIdx;
  while (i < tLines.length) {
    const srMatch = tLines[i].match(/^(\d{1,2})\s+(\d{3,10})$/);
    if (!srMatch) {
      if (tLines[i].match(/Total\s*Amount|Prepared\s*By|Amount\s*in\s*Words/i)) break;
      i++; continue;
    }

    const itemCode = srMatch[2]; i++;

    let desc = '';
    while (i < tLines.length) {
      if (tLines[i].match(/^\d{8}\s+\d+$/)) break;
      desc += (desc ? ' ' : '') + tLines[i];
      i++;
    }

    if (i >= tLines.length) break;
    const hsnQtyMatch = tLines[i].match(/^(\d{8})\s+(\d+)$/);
    if (!hsnQtyMatch) { i++; continue; }
    const hsn = hsnQtyMatch[1];
    const qty = num(hsnQtyMatch[2]); i++;

    if (i >= tLines.length) break;
    const mrp = num(tLines[i]); i++;
    if (i >= tLines.length) break;
    const ubc = num(tLines[i]); i++;

    if (i >= tLines.length) break;
    let taxStr = tLines[i]; i++;
    if (i < tLines.length && tLines[i].match(/^\d{1,2}$/) && !tLines[i + 1]?.match(/^\d{3,}/)) {
      if (taxStr.match(/\.\d$/) || (num(taxStr) < 100 && qty > 10)) {
        taxStr += tLines[i]; i++;
      }
    }
    const taxVal = num(taxStr);

    let igstRate = 0, igstAmt = 0, totalAmt = 0;
    const taxNums = [];
    while (i < tLines.length && taxNums.length < 10) {
      if (tLines[i].match(/^\d{1,2}\s+\d{3,}/) || tLines[i].match(/Total|Prepared|Amount/i)) break;
      if (tLines[i].match(/^[\d.]+%?$/)) { taxNums.push(num(tLines[i])); i++; }
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
      i++; // skip sr

      if (i >= tLines.length) break;

      // Collect ALL digit fragments until description text or cost line.
      // Blinkit splits each column value across lines: "101145" + "00" = "10114500" (item code)
      // Fixed widths: item code = 8 digits, HSN = 8 digits, EAN = 13 digits
      let digitStr = '';
      while (i < tLines.length) {
        const l = tLines[i];
        if (l.match(/^[A-Za-z]/) && l.length > 2) break; // description starts
        if (l.match(/^\d+\.\d{2}$/)) break; // cost line like "40.71"
        if (l.match(/^[\d\s]+$/)) { digitStr += l.replace(/\s+/g, ''); i++; }
        else break;
      }

      // Slice by fixed widths: 8 item + 8 HSN + 13 EAN = 29 total
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

      // Description — collect until cost line or totals
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

      // Each of the 6 tax/qty columns is on its own line in the extracted text.
      // Order: IGST%  CESS%  ADDT.CESS  TaxAmt  LandingRate  Qty
      // Some values like "40.00" may come as "40.0" + "0" across two lines.
      // Strategy: collect numeric tokens until we have 6, handling split decimals.
      const taxCols = [];
      while (i < tLines.length && taxCols.length < 6) {
        const l = tLines[i];
        // Multi-value line (e.g. "40.0 0.00 0 16.28 57.00 552")
        if (l.match(/^[\d.]+(?:\s+[\d.]+)+$/)) {
          l.split(/\s+/).forEach(p => taxCols.push(num(p)));
          i++;
        } else if (l.match(/^[\d.]+$/)) {
          // Could be split decimal: "31464.0" then "0" → join if prev ends with just 1 decimal digit
          const prev = taxCols.length > 0 ? String(taxCols[taxCols.length - 1]) : '';
          if (l === '0' && prev.match(/\.\d$/)) {
            // continuation of previous decimal
            taxCols[taxCols.length - 1] = num(prev + l);
          } else {
            taxCols.push(num(l));
          }
          i++;
        } else if (l === '.') {
          // Standalone decimal point — ADDT.CESS "0.00" splits as "0" "." "0" "0"
          // Consume all following single-digit tokens and attach to previous value
          i++;
          let decStr = '';
          while (i < tLines.length && tLines[i].match(/^\d$/)) { decStr += tLines[i]; i++; }
          // previous value is the integer part, decStr is fractional part
          if (taxCols.length > 0 && decStr) {
            taxCols[taxCols.length - 1] = num(Math.floor(taxCols[taxCols.length - 1]) + '.' + decStr);
          }
        } else break;
      }

      // taxCols: [igstPct, cessPct, addtCess, taxAmt, landingRate, qty]
      let igstPct = taxCols[0] || 0;
      const taxAmt = taxCols[3] || 0;
      const landingRate = taxCols[4] || 0;
      let qty = taxCols[5] || 0;

      // MRP
      if (i >= tLines.length) break;
      const mrp = num(tLines[i]); i++;

      // Margin % (skip)
      if (i >= tLines.length) break;
      i++;

      // Total — may be split "31464.0" + "0"
      if (i >= tLines.length) break;
      let totalStr = tLines[i]; i++;
      if (i < tLines.length && tLines[i].match(/^\d{1,2}$/) && totalStr.match(/\.\d$/)) {
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