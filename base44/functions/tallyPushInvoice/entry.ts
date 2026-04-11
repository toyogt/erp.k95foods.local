import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTallyDate(dateVal) {
  if (!dateVal) return '';
  // Accepts YYYY-MM-DD or DD/MM/YYYY → outputs YYYYMMDD
  const str = String(dateVal).trim();
  if (str.includes('/')) {
    const [d, m, y] = str.split('/');
    return `${y}${m.padStart(2, '0')}${d.padStart(2, '0')}`;
  }
  return str.replace(/-/g, '');
}

function formatDisplayDate(dateVal) {
  if (!dateVal) return '';
  const str = String(dateVal).trim();
  let y, m, d;
  if (str.includes('/')) {
    [d, m, y] = str.split('/');
  } else if (str.includes('-')) {
    [y, m, d] = str.split('-');
  } else return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(d)}-${months[parseInt(m)-1]}-${y}`;
}

function escapeXml(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function qtyDisplay(qty, uom, perBox) {
  const base = Math.floor(Math.abs(qty));
  const boxes = Math.floor(Math.abs(qty) / perBox);
  return ` ${base} ${uom || 'Pcs'} = ${boxes} Box`;
}

function extractPincode(address) {
  if (!address) return '';
  const match = String(address).match(/\b(\d{6})\b/);
  return match ? match[1] : '';
}

function extractStateName(placeOfSupply) {
  if (!placeOfSupply) return '';
  // Format: "06-Haryana" → "Haryana"  or just "Haryana"
  if (placeOfSupply.includes('-')) {
    return placeOfSupply.split('-').slice(1).join('-').trim();
  }
  return placeOfSupply.trim();
}

function buildAddressLines(addressStr, tag) {
  if (!addressStr) return '';
  // Split by newline first, then by comma groups to get 2-line format
  let lines = addressStr.split(/\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 1) {
    // Try splitting long single-line addresses into 2 lines at comma boundaries
    const parts = lines[0].split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length > 3) {
      const mid = Math.ceil(parts.length / 2);
      lines = [parts.slice(0, mid).join(', '), parts.slice(mid).join(', ')];
    }
  }
  return lines.map(l => `       <${tag}>${escapeXml(l)}</${tag}>`).join('\n');
}

// ─── Determine GST nature ────────────────────────────────────────────────────

function getGstNature(isInterstate) {
  return isInterstate ? 'Interstate Sales - Taxable' : 'Local Sales - Taxable';
}

// ─── Build single item XML (ERPNext format) ──────────────────────────────────

function buildItemXml(item, isInterstate, perBox) {
  const qty = Math.floor(item.quantity || 0);
  const uom = 'Pcs';
  const qtyStr = qtyDisplay(qty, uom, perBox);
  const rate = item.unit_base_cost || item.rate_snapshot || 0;
  const amount = item.taxable_value || (rate * qty);
  const hsnCode = item.hsn_code || '22029990';
  const itemName = escapeXml(item.description || item.item_code || '');
  const nature = getGstNature(isInterstate);

  // Determine classification from HSN code
  let classification = 'Kombucha';
  if (hsnCode === '22021090') classification = 'Soda';
  else if (hsnCode === '19059010') classification = 'Iced Tea';

  const cgstRate = isInterstate ? 0 : Math.round(item.cgst_rate || 0);
  const sgstRate = isInterstate ? 0 : Math.round(item.sgst_rate || 0);
  const igstRate = isInterstate ? Math.round(item.igst_rate || 0) : 0;

  return `
      <ALLINVENTORYENTRIES.LIST>
       <GSTHSNNAME>${escapeXml(hsnCode)}</GSTHSNNAME>
       <STOCKITEMNAME>${itemName}</STOCKITEMNAME>
       <GSTOVRDNCLASSIFICATION>${escapeXml(classification)}</GSTOVRDNCLASSIFICATION>
       <GSTOVRDNINELIGIBLEITC>4 Applicable</GSTOVRDNINELIGIBLEITC>
       <GSTOVRDNISREVCHARGEAPPL>4 Not Applicable</GSTOVRDNISREVCHARGEAPPL>
       <GSTOVRDNTAXABILITY>Taxable</GSTOVRDNTAXABILITY>
       <GSTOVRDNSTOREDNATURE>${escapeXml(nature)}</GSTOVRDNSTOREDNATURE>
       <GSTSOURCETYPE>Stock Group</GSTSOURCETYPE>
       <HSNSOURCETYPE>Stock Group</HSNSOURCETYPE>
       <GSTOVRDNTYPEOFSUPPLY>Goods</GSTOVRDNTYPEOFSUPPLY>
       <GSTRATEINFERAPPLICABILITY>As per Masters/Company</GSTRATEINFERAPPLICABILITY>
       <GSTHSNINFERAPPLICABILITY>As per Masters/Company</GSTHSNINFERAPPLICABILITY>
       <HSNOVRDNCLASSIFICATION>${escapeXml(classification)}</HSNOVRDNCLASSIFICATION>
       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
       <ISGSTASSESSABLEVALUEOVERRIDDEN>No</ISGSTASSESSABLEVALUEOVERRIDDEN>
       <RATE>${rate}/${uom}</RATE>
       <AMOUNT>${amount.toFixed(2)}</AMOUNT>
       <ACTUALQTY>${qtyStr}</ACTUALQTY>
       <BILLEDQTY>${qtyStr}</BILLEDQTY>
       <BATCHALLOCATIONS.LIST>
        <GODOWNNAME>Main Location</GODOWNNAME>
        <BATCHNAME>Primary Batch</BATCHNAME>
        <AMOUNT>${amount.toFixed(2)}</AMOUNT>
        <ACTUALQTY>${qtyStr}</ACTUALQTY>
        <BILLEDQTY>${qtyStr}</BILLEDQTY>
       </BATCHALLOCATIONS.LIST>
       <ACCOUNTINGALLOCATIONS.LIST>
        <LEDGERNAME>SALES A/C</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <LEDGERFROMITEM>No</LEDGERFROMITEM>
        <ISPARTYLEDGER>No</ISPARTYLEDGER>
        <AMOUNT>${amount.toFixed(2)}</AMOUNT>
       </ACCOUNTINGALLOCATIONS.LIST>
       
       <RATEDETAILS.LIST>
        <GSTRATEDUTYHEAD>CGST</GSTRATEDUTYHEAD>
        <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>
        <GSTRATE> ${cgstRate.toFixed(2)}</GSTRATE>
       </RATEDETAILS.LIST>
       <RATEDETAILS.LIST>
        <GSTRATEDUTYHEAD>SGST/UTGST</GSTRATEDUTYHEAD>
        <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>
        <GSTRATE> ${sgstRate.toFixed(2)}</GSTRATE>
       </RATEDETAILS.LIST>
       <RATEDETAILS.LIST>
        <GSTRATEDUTYHEAD>IGST</GSTRATEDUTYHEAD>
        <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>
        <GSTRATE> ${igstRate.toFixed(2)}</GSTRATE>
       </RATEDETAILS.LIST>
       <RATEDETAILS.LIST>
        <GSTRATEDUTYHEAD>Cess</GSTRATEDUTYHEAD>
        <GSTRATEVALUATIONTYPE>&#4; Not Applicable</GSTRATEVALUATIONTYPE>
       </RATEDETAILS.LIST>
      </ALLINVENTORYENTRIES.LIST>`;
}

// ─── Build full Tally XML (ERPNext-compatible format) ─────────────────────────

function buildTallyXml(inv, items, order, customer) {
  const COMPANY = Deno.env.get('TALLY_COMPANY_NAME') || '';
  const SELLER_GSTIN = Deno.env.get('ADAEQUARE_GSTIN') || '';

  // Dates
  const dateStr = formatTallyDate(inv.invoice_date);
  const poDateStr = order?.po_date ? formatDisplayDate(order.po_date) : '';
  const referenceDateStr = order?.po_date ? formatTallyDate(order.po_date) : '';

  // Customer details
  const customerName = escapeXml(inv.customer_name || '');
  const buyerGstin = escapeXml(inv.customer_gstin || customer?.gstin || '');
  const invoiceNum = escapeXml(inv.invoice_number || '');
  const poNumber = order?.po_number || '';
  const paymentTerms = inv.payment_terms || order?.payment_terms || '30 Days';
  const transporter = order?.transporter || '';
  const expiryRef = order?.po_expiry_date ? `Expiry Date ${order.po_expiry_date}` : '';

  // State / Place of supply
  const placeOfSupply = customer?.place_of_supply || '';
  const stateName = extractStateName(placeOfSupply) || 'India';

  // Interstate detection
  const buyerGstinRaw = inv.customer_gstin || customer?.gstin || '';
  const isInterstate = buyerGstinRaw && SELLER_GSTIN
    ? buyerGstinRaw.substring(0, 2) !== SELLER_GSTIN.substring(0, 2)
    : false;

  // Address
  const billingAddr = inv.billing_address || customer?.billing_address || '';
  const shippingAddr = inv.shipping_address || customer?.shipping_address || billingAddr;
  const pincode = extractPincode(shippingAddr) || extractPincode(billingAddr);

  // Tax totals
  let igst = 0, cgst = 0, sgst = 0;
  for (const item of items) {
    igst += item.igst_amount || 0;
    cgst += item.cgst_amount || 0;
    sgst += item.sgst_amount || 0;
  }
  igst = Math.round(igst * 100) / 100;
  cgst = Math.round(cgst * 100) / 100;
  sgst = Math.round(sgst * 100) / 100;

  const grandTotal = Math.round((inv.total_amount || 0) * 100) / 100;
  const taxableTotal = Math.round((inv.taxable_amount || 0) * 100) / 100;
  const roundoff = Math.round((grandTotal - taxableTotal - igst - cgst - sgst) * 100) / 100;
  const partyAmount = -1 * grandTotal;

  // Build items XML
  let itemsXml = '';
  for (const item of items) {
    const perBox = item.packing_unit || 12;
    itemsXml += buildItemXml(item, isInterstate, perBox);
  }

  // Tax ledger entries
  let taxLedgers = '';
  if (!isInterstate) {
    if (cgst > 0) {
      taxLedgers += `
      <LEDGERENTRIES.LIST>
       <LEDGERNAME>CGST</LEDGERNAME>
       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
       <LEDGERFROMITEM>No</LEDGERFROMITEM>
       <ISPARTYLEDGER>No</ISPARTYLEDGER>
       <AMOUNT>${cgst.toFixed(2)}</AMOUNT>
       <VATEXPAMOUNT>${cgst.toFixed(2)}</VATEXPAMOUNT>
      </LEDGERENTRIES.LIST>`;
    }
    if (sgst > 0) {
      taxLedgers += `
      <LEDGERENTRIES.LIST>
       <LEDGERNAME>SGST</LEDGERNAME>
       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
       <LEDGERFROMITEM>No</LEDGERFROMITEM>
       <ISPARTYLEDGER>No</ISPARTYLEDGER>
       <AMOUNT>${sgst.toFixed(2)}</AMOUNT>
       <VATEXPAMOUNT>${sgst.toFixed(2)}</VATEXPAMOUNT>
      </LEDGERENTRIES.LIST>`;
    }
  } else {
    if (igst > 0) {
      taxLedgers += `
      <LEDGERENTRIES.LIST>
       <LEDGERNAME>IGST</LEDGERNAME>
       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
       <LEDGERFROMITEM>No</LEDGERFROMITEM>
       <ISPARTYLEDGER>No</ISPARTYLEDGER>
       <AMOUNT>${igst.toFixed(2)}</AMOUNT>
       <VATEXPAMOUNT>${igst.toFixed(2)}</VATEXPAMOUNT>
      </LEDGERENTRIES.LIST>`;
    }
  }

  // Round-off ledger
  let roundoffXml = '';
  if (Math.abs(roundoff) >= 0.01) {
    const sign = roundoff > 0 ? 'No' : 'Yes'; // positive roundoff = debit = not deemed positive in Tally convention
    // But for negative roundoff (credit), Tally wants ISDEEMEDPOSITIVE=No and negative amount
    roundoffXml = `
      <LEDGERENTRIES.LIST>
       <ROUNDTYPE>Normal Rounding</ROUNDTYPE>
       <LEDGERNAME>Round Off</LEDGERNAME>
       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
       <ISPARTYLEDGER>No</ISPARTYLEDGER>
       <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>
       <ROUNDLIMIT> 1</ROUNDLIMIT>
       <AMOUNT>${roundoff.toFixed(2)}</AMOUNT>
       <VATEXPAMOUNT>${roundoff.toFixed(2)}</VATEXPAMOUNT>
      </LEDGERENTRIES.LIST>`;
  }

  // Extract city/place from address for E-Way Bill
  const addrParts = (shippingAddr || billingAddr).split(',').map(p => p.trim()).filter(Boolean);
  // Try to find city-like part (before state, after street)
  let consigneePlace = '';
  if (addrParts.length >= 3) {
    // Usually: street, city, state, pincode pattern
    consigneePlace = addrParts[Math.max(0, addrParts.length - 3)] || '';
  }

  // Build address lines
  const addressLines = buildAddressLines(shippingAddr || billingAddr, 'ADDRESS');
  const buyerAddressLines = buildAddressLines(billingAddr || shippingAddr, 'BASICBUYERADDRESS');
  const gstBuyerLines = buildAddressLines(billingAddr || shippingAddr, 'GSTBUYERADDRESS');
  const gstConsigneeLines = buildAddressLines(shippingAddr || billingAddr, 'GSTCONSIGNEEADDRESS');
  const ewbConsigneeLines = buildAddressLines(shippingAddr || billingAddr, 'CONSIGNEEADDRESS');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Import Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>Vouchers</REPORTNAME>
    <STATICVARIABLES>
     <SVCURRENTCOMPANY>${escapeXml(COMPANY)}</SVCURRENTCOMPANY>
    </STATICVARIABLES>
   </REQUESTDESC>
   <REQUESTDATA>
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
     <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
      <ADDRESS.LIST TYPE="String">
${addressLines}
      </ADDRESS.LIST>
      <BASICBUYERADDRESS.LIST TYPE="String">
${buyerAddressLines}
      </BASICBUYERADDRESS.LIST>
      <DATE>${dateStr}</DATE>
      <VCHSTATUSDATE>${dateStr}</VCHSTATUSDATE>
      <REFERENCEDATE>${referenceDateStr}</REFERENCEDATE>
      <STATENAME>${escapeXml(stateName)}</STATENAME>
      <COUNTRYOFRESIDENCE>India</COUNTRYOFRESIDENCE>
      <PARTYGSTIN>${buyerGstin}</PARTYGSTIN>
      <PLACEOFSUPPLY>${escapeXml(stateName)}</PLACEOFSUPPLY>
      <PARTYNAME>${customerName}</PARTYNAME>
      <PARTYMAILINGNAME>${customerName}</PARTYMAILINGNAME>
      <BASICBUYERNAME>${customerName}</BASICBUYERNAME>
      <PARTYPINCODE>${escapeXml(pincode)}</PARTYPINCODE>      <CONSIGNEEMAILINGNAME>${customerName}</CONSIGNEEMAILINGNAME>
      <CONSIGNEEGSTIN>${buyerGstin}</CONSIGNEEGSTIN>
      <CONSIGNEESTATENAME>${escapeXml(stateName)}</CONSIGNEESTATENAME>
      <CONSIGNEECOUNTRYNAME>India</CONSIGNEECOUNTRYNAME>
      <CONSIGNEEPINCODE>${escapeXml(pincode)}</CONSIGNEEPINCODE>
      <CMPGSTIN>${escapeXml(SELLER_GSTIN)}</CMPGSTIN>
      <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
      <PARTYLEDGERNAME>${customerName}</PARTYLEDGERNAME>
      <VOUCHERNUMBER>${invoiceNum}</VOUCHERNUMBER>
      <REFERENCE>${escapeXml(poNumber)}</REFERENCE>
      <INVOICEORDERLIST.LIST>
       <BASICPURCHASEORDERNO>${escapeXml(poNumber)}</BASICPURCHASEORDERNO>
       <BASICORDERDATE>${escapeXml(poDateStr)}</BASICORDERDATE>
       <BASICOTHERREFERENCES>${escapeXml(expiryRef)}</BASICOTHERREFERENCES>
      </INVOICEORDERLIST.LIST>
      <CMPGSTREGISTRATIONTYPE>Regular</CMPGSTREGISTRATIONTYPE>
      <CMPGSTSTATE>Haryana</CMPGSTSTATE>
      <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
      <BASICORDERREF>${escapeXml(expiryRef)}</BASICORDERREF>
      <BASICDUEDATEOFPYMT>${escapeXml(paymentTerms)}</BASICDUEDATEOFPYMT>
      <BASICSHIPPEDBY>${escapeXml(transporter)}</BASICSHIPPEDBY>
      <EFFECTIVEDATE>${dateStr}</EFFECTIVEDATE>
      <ISINVOICE>Yes</ISINVOICE>

${itemsXml}

      <!-- Party ledger -->
      <LEDGERENTRIES.LIST>
       <LEDGERNAME>${customerName}</LEDGERNAME>
       <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
       <LEDGERFROMITEM>No</LEDGERFROMITEM>
       <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
       <AMOUNT>${partyAmount.toFixed(2)}</AMOUNT>
      </LEDGERENTRIES.LIST>
      ${taxLedgers}
      ${roundoffXml}
      <EWAYBILLDETAILS.LIST>
       <CONSIGNORADDRESS.LIST TYPE="String">
        <CONSIGNORADDRESS>${escapeXml(COMPANY)}</CONSIGNORADDRESS>
       </CONSIGNORADDRESS.LIST>
       <CONSIGNEEADDRESS.LIST TYPE="String">
${ewbConsigneeLines}
       </CONSIGNEEADDRESS.LIST>
       <DOCUMENTTYPE>Others</DOCUMENTTYPE>
       <CONSIGNEEPINCODE>${escapeXml(pincode)}</CONSIGNEEPINCODE>
       <SUBTYPE>Supply</SUBTYPE>
       <CONSIGNORPLACE>${escapeXml(consigneePlace)}</CONSIGNORPLACE>
       <CONSIGNORPINCODE>${escapeXml(pincode)}</CONSIGNORPINCODE>
       <CONSIGNEEPLACE>${escapeXml(consigneePlace)}</CONSIGNEEPLACE>
       <SHIPPEDFROMSTATE>Haryana</SHIPPEDFROMSTATE>
       <SHIPPEDTOSTATE>${escapeXml(stateName)}</SHIPPEDTOSTATE>
      </EWAYBILLDETAILS.LIST>
      <GSTBUYERADDRESS.LIST TYPE="String">
${gstBuyerLines}
      </GSTBUYERADDRESS.LIST>
      <GSTCONSIGNEEADDRESS.LIST TYPE="String">
${gstConsigneeLines}
      </GSTCONSIGNEEADDRESS.LIST>
     </VOUCHER>
    </TALLYMESSAGE>
   </REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>`;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { invoice_id } = body;

    if (!invoice_id) {
      return Response.json({ error: 'invoice_id is required' }, { status: 400 });
    }

    const TALLY_URL = Deno.env.get('TALLY_URL') || 'http://localhost:9564';
    const TALLY_COMPANY = Deno.env.get('TALLY_COMPANY_NAME') || '';

    if (!TALLY_COMPANY) {
      return Response.json({ error: 'TALLY_COMPANY_NAME secret not set' }, { status: 500 });
    }

    // 1. Fetch invoice
    const invoices = await base44.asServiceRole.entities.SalesInvoice.filter({ id: invoice_id });
    const inv = invoices?.[0];
    if (!inv) {
      return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // 2. Fetch order items (for tax rates, quantities, product details)
    const items = inv.sales_order_id
      ? await base44.asServiceRole.entities.SalesOrderItem.filter({ sales_order_id: inv.sales_order_id })
      : [];

    // 3. Fetch sales order (for PO details, transporter)
    let order = null;
    if (inv.sales_order_id) {
      const orders = await base44.asServiceRole.entities.SalesOrder.filter({ id: inv.sales_order_id });
      order = orders?.[0] || null;
    }

    // 4. Fetch customer (for address, place_of_supply, pincode)
    let customer = null;
    try {
      if (inv.customer_gstin) {
        const customers = await base44.asServiceRole.entities.Customer.filter({ gstin: inv.customer_gstin });
        customer = customers?.[0] || null;
      }
      if (!customer && inv.customer_name) {
        const customers = await base44.asServiceRole.entities.Customer.filter({ name: inv.customer_name });
        customer = customers?.[0] || null;
      }
    } catch (_) {
      // Customer lookup is non-fatal
    }

    // 5. Build XML
    const xmlBody = buildTallyXml(inv, items, order, customer);
    const pushedAt = new Date().toISOString();

    // 6. Send to Tally
    let responseText = '';
    try {
      const tallyResponse = await fetch(TALLY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
        body: xmlBody,
        signal: AbortSignal.timeout(30000),
      });
      const responseBuffer = await tallyResponse.arrayBuffer();
      responseText = new TextDecoder('utf-8').decode(responseBuffer);
    } catch (fetchErr) {
      await base44.asServiceRole.entities.TallyPushLog.create({
        invoice_id,
        invoice_number: inv.invoice_number,
        customer_name: inv.customer_name,
        status: 'network_error',
        error_message: 'Cannot reach Tally: ' + fetchErr.message,
        xml_sent_preview: xmlBody.substring(0, 800),
        pushed_by: user.email,
        pushed_at: pushedAt,
      });
      return Response.json({
        error: 'Cannot reach Tally. Check TALLY_URL and ensure Tally is running.',
        details: fetchErr.message,
        xml_preview: xmlBody.substring(0, 500),
      }, { status: 502 });
    }

    // 7. Parse Tally response
    if (responseText.includes('<CREATED>1</CREATED>')) {
      let voucherNumber = inv.invoice_number;
      const vchStart = responseText.indexOf('<VOUCHERNUMBER>');
      if (vchStart !== -1) {
        const vchEnd = responseText.indexOf('</VOUCHERNUMBER>', vchStart);
        if (vchEnd !== -1) voucherNumber = responseText.substring(vchStart + 15, vchEnd).trim();
      }

      const today = new Date().toISOString().split('T')[0];

      await Promise.all([
        base44.asServiceRole.entities.SalesInvoice.update(invoice_id, {
          posted_to_tally: true,
          tally_voucher_no: voucherNumber,
          tally_posted_date: today,
          tally_posted_by: user.email,
        }),
        base44.asServiceRole.entities.TallyPushLog.create({
          invoice_id,
          invoice_number: inv.invoice_number,
          customer_name: inv.customer_name,
          status: 'success',
          tally_voucher_no: voucherNumber,
          tally_response_preview: responseText.substring(0, 600),
          xml_sent_preview: xmlBody.substring(0, 800),
          pushed_by: user.email,
          pushed_at: pushedAt,
        }),
      ]);

      return Response.json({
        status: 'success',
        voucher_number: voucherNumber,
        message: 'Invoice successfully created in Tally!',
        tally_response_preview: responseText.substring(0, 300),
      });

    } else {
      let errorMsg = 'Voucher not created in Tally';
      const errStart = responseText.indexOf('<LINEERROR>');
      if (errStart !== -1) {
        const errEnd = responseText.indexOf('</LINEERROR>', errStart);
        if (errEnd !== -1) errorMsg = responseText.substring(errStart + 11, errEnd).trim();
      }

      await base44.asServiceRole.entities.TallyPushLog.create({
        invoice_id,
        invoice_number: inv.invoice_number,
        customer_name: inv.customer_name,
        status: 'error',
        error_message: errorMsg,
        tally_response_preview: responseText.substring(0, 600),
        xml_sent_preview: xmlBody.substring(0, 800),
        pushed_by: user.email,
        pushed_at: pushedAt,
      });

      return Response.json({
        status: 'error',
        error: errorMsg,
        tally_response_preview: responseText.substring(0, 500),
        xml_sent: xmlBody.substring(0, 1000),
      }, { status: 422 });
    }

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});