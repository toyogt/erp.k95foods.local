import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function convertDateToYYYYMMDD(dateVal) {
  if (!dateVal) return '';
  try {
    return String(dateVal).replace(/-/g, '').substring(0, 8);
  } catch {
    return '';
  }
}

function qtyDisplay(qty, uom, perBox = 6) {
  const base = Math.floor(Math.abs(qty));
  const boxes = Math.floor(Math.abs(qty) / perBox);
  if (uom) return ` ${base} ${uom} =  ${boxes} Box`;
  return ` ${base} = ${boxes} Box`;
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

// ─── XML Builder ──────────────────────────────────────────────────────────────

function buildItemsXml(items) {
  let xml = '';
  for (const item of items) {
    // Qty logic: if qty > 6, round down to nearest multiple of 6
    let qty = item.quantity || 0;
    if (qty > 6) {
      qty = Math.floor(qty / 6) * 6;
    } else {
      qty = Math.floor(qty);
    }

    const uom = item.uom || 'PCS';
    const qtyStr = qtyDisplay(qty, uom, 6);

    const cgstRate = Math.round(item.cgst_rate || 0);
    const sgstRate = Math.round(item.sgst_rate || 0);
    const igstRate = Math.round(item.igst_rate || 0);

    const stockGroup = item.item_group || 'Primary';
    const itemName = escapeXml(item.description || item.item_code || '');
    const mrpValue = item.mrp ? `MRP ${Math.round(item.mrp)}` : '';
    const rate = item.unit_base_cost || item.rate_snapshot || 0;
    const amount = item.taxable_value || (rate * qty);

    xml += `
      <ALLINVENTORYENTRIES.LIST>
      <BASICUSERDESCRIPTION.LIST TYPE="String">
        <BASICUSERDESCRIPTION>${escapeXml(mrpValue)}</BASICUSERDESCRIPTION>
       </BASICUSERDESCRIPTION.LIST>
      
       <STOCKITEMNAME>${itemName}</STOCKITEMNAME>
       <GSTOVRDNCLASSIFICATION>${escapeXml(stockGroup)}</GSTOVRDNCLASSIFICATION>
       <GSTOVRDNINELIGIBLEITC>&#4; Not Applicable</GSTOVRDNINELIGIBLEITC>
       <GSTOVRDNISREVCHARGEAPPL>&#4; Not Applicable</GSTOVRDNISREVCHARGEAPPL>
       <GSTOVRDNTAXABILITY>Taxable</GSTOVRDNTAXABILITY>
       <GSTSOURCETYPE>Stock Group</GSTSOURCETYPE>
        <HSNSOURCETYPE>Stock Group</HSNSOURCETYPE>
       <GSTOVRDNSTOREDNATURE/>
       <GSTOVRDNTYPEOFSUPPLY>Goods</GSTOVRDNTYPEOFSUPPLY>
       <GSTRATEINFERAPPLICABILITY>Use GST Classification</GSTRATEINFERAPPLICABILITY>
       <GSTHSNINFERAPPLICABILITY>Use GST Classification</GSTHSNINFERAPPLICABILITY>
       <HSNOVRDNCLASSIFICATION>${escapeXml(stockGroup)}</HSNOVRDNCLASSIFICATION>
       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
       <ISGSTASSESSABLEVALUEOVERRIDDEN>No</ISGSTASSESSABLEVALUEOVERRIDDEN>
       <STRDISGSTAPPLICABLE>No</STRDISGSTAPPLICABLE>
       <CONTENTNEGISPOS>No</CONTENTNEGISPOS>
       <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>
       <ISAUTONEGATE>No</ISAUTONEGATE>
       <ISCUSTOMSCLEARANCE>No</ISCUSTOMSCLEARANCE>
       <ISTRACKCOMPONENT>No</ISTRACKCOMPONENT>
       <ISTRACKPRODUCTION>No</ISTRACKPRODUCTION>
       <ISPRIMARYITEM>No</ISPRIMARYITEM>
       <ISSCRAP>No</ISSCRAP>
       <RATE>${rate}/${uom}</RATE>
       <AMOUNT>${amount.toFixed(2)}</AMOUNT>
       <ACTUALQTY>${qtyStr}</ACTUALQTY>
       <BILLEDQTY>${qtyStr}</BILLEDQTY>
       
       <BATCHALLOCATIONS.LIST>
        <GODOWNNAME>Main Location</GODOWNNAME>
        <BATCHNAME>Primary Batch</BATCHNAME>
        <INDENTNO>&#4; Not Applicable</INDENTNO>
        <ORDERNO>&#4; Not Applicable</ORDERNO>
        <TRACKINGNUMBER>&#4; Not Applicable</TRACKINGNUMBER>
        <DYNAMICCSTISCLEARED>No</DYNAMICCSTISCLEARED>
        <AMOUNT>${amount.toFixed(2)}</AMOUNT>
        <ACTUALQTY>${qtyStr}</ACTUALQTY>
        <BILLEDQTY>${qtyStr}</BILLEDQTY>
        <ADDITIONALDETAILS.LIST>        </ADDITIONALDETAILS.LIST>
        <VOUCHERCOMPONENTLIST.LIST>        </VOUCHERCOMPONENTLIST.LIST>
       </BATCHALLOCATIONS.LIST>
       <ACCOUNTINGALLOCATIONS.LIST>
        <OLDAUDITENTRYIDS.LIST TYPE="Number">
         <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>
        </OLDAUDITENTRYIDS.LIST>
        <LEDGERNAME>SALES A/C</LEDGERNAME>
        <GSTCLASS>General</GSTCLASS>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <LEDGERFROMITEM>No</LEDGERFROMITEM>
        <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
        <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
        <GSTOVERRIDDEN>Yes</GSTOVERRIDDEN>
        <ISGSTASSESSABLEVALUEOVERRIDDEN>No</ISGSTASSESSABLEVALUEOVERRIDDEN>
        <STRDISGSTAPPLICABLE>No</STRDISGSTAPPLICABLE>
        <STRDGSTISPARTYLEDGER>No</STRDGSTISPARTYLEDGER>
        <STRDGSTISDUTYLEDGER>No</STRDGSTISDUTYLEDGER>
        <CONTENTNEGISPOS>No</CONTENTNEGISPOS>
        <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>
        <ISCAPVATTAXALTERED>No</ISCAPVATTAXALTERED>
        <ISCAPVATNOTCLAIMED>No</ISCAPVATNOTCLAIMED>
        <AMOUNT>${amount.toFixed(2)}</AMOUNT>
        <SERVICETAXDETAILS.LIST>        </SERVICETAXDETAILS.LIST>
        <BANKALLOCATIONS.LIST>        </BANKALLOCATIONS.LIST>
        <BILLALLOCATIONS.LIST>        </BILLALLOCATIONS.LIST>
        <INTERESTCOLLECTION.LIST>        </INTERESTCOLLECTION.LIST>
        <OLDAUDITENTRIES.LIST>        </OLDAUDITENTRIES.LIST>
        <ACCOUNTAUDITENTRIES.LIST>        </ACCOUNTAUDITENTRIES.LIST>
        <AUDITENTRIES.LIST>        </AUDITENTRIES.LIST>
        <INPUTCRALLOCS.LIST>        </INPUTCRALLOCS.LIST>
        <DUTYHEADDETAILS.LIST>        </DUTYHEADDETAILS.LIST>
        <EXCISEDUTYHEADDETAILS.LIST>        </EXCISEDUTYHEADDETAILS.LIST>
        <RATEDETAILS.LIST>        </RATEDETAILS.LIST>
        <SUMMARYALLOCS.LIST>        </SUMMARYALLOCS.LIST>
        <CENVATDUTYALLOCATIONS.LIST>        </CENVATDUTYALLOCATIONS.LIST>
        <STPYMTDETAILS.LIST>        </STPYMTDETAILS.LIST>
        <EXCISEPAYMENTALLOCATIONS.LIST>        </EXCISEPAYMENTALLOCATIONS.LIST>
        <TAXBILLALLOCATIONS.LIST>        </TAXBILLALLOCATIONS.LIST>
        <TAXOBJECTALLOCATIONS.LIST>        </TAXOBJECTALLOCATIONS.LIST>
        <TDSEXPENSEALLOCATIONS.LIST>        </TDSEXPENSEALLOCATIONS.LIST>
        <VATSTATUTORYDETAILS.LIST>        </VATSTATUTORYDETAILS.LIST>
        <COSTTRACKALLOCATIONS.LIST>        </COSTTRACKALLOCATIONS.LIST>
        <REFVOUCHERDETAILS.LIST>        </REFVOUCHERDETAILS.LIST>
        <INVOICEWISEDETAILS.LIST>        </INVOICEWISEDETAILS.LIST>
        <VATITCDETAILS.LIST>        </VATITCDETAILS.LIST>
        <ADVANCETAXDETAILS.LIST>        </ADVANCETAXDETAILS.LIST>
        <TAXTYPEALLOCATIONS.LIST>        </TAXTYPEALLOCATIONS.LIST>
       </ACCOUNTINGALLOCATIONS.LIST>
       <DUTYHEADDETAILS.LIST>       </DUTYHEADDETAILS.LIST>
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
       <RATEDETAILS.LIST>
        <GSTRATEDUTYHEAD>State Cess</GSTRATEDUTYHEAD>
        <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>
       </RATEDETAILS.LIST>
       <SUPPLEMENTARYDUTYHEADDETAILS.LIST>       </SUPPLEMENTARYDUTYHEADDETAILS.LIST>
       <TAXOBJECTALLOCATIONS.LIST>       </TAXOBJECTALLOCATIONS.LIST>
       <REFVOUCHERDETAILS.LIST>       </REFVOUCHERDETAILS.LIST>
       <EXCISEALLOCATIONS.LIST>       </EXCISEALLOCATIONS.LIST>
       <EXPENSEALLOCATIONS.LIST>       </EXPENSEALLOCATIONS.LIST>
      </ALLINVENTORYENTRIES.LIST>`;
  }
  return xml;
}

function buildAddressLines(addressStr, customerName) {
  // Address stored as single string in our DB — split by comma/newline
  let addrLines = '';
  if (!addressStr) return addrLines;
  const parts = addressStr.split(/[,\n]/).map(p => p.trim()).filter(Boolean);
  for (const part of parts) {
    addrLines += `\n       <ADDRESS>${escapeXml(part)}</ADDRESS>`;
  }
  return addrLines;
}

function buildTallyXml(inv, items, order, customer) {
  const EXPECTED_COMPANY = Deno.env.get('TALLY_COMPANY_NAME') || '';

  // Dates
  const dateStr = convertDateToYYYYMMDD(inv.invoice_date);
  const poDateStr = convertDateToYYYYMMDD(order?.po_date || '');
  const lrDateStr = convertDateToYYYYMMDD(inv.lr_date || '');

  const poNo = order?.po_number || '';
  const transporter = order?.transporter || '';
  const paymentTerms = inv.payment_terms || '30 Days';

  // Place of supply / state
  const placeOfSupply = customer?.place_of_supply || '';
  const stateName = placeOfSupply.includes('-')
    ? placeOfSupply.split('-').slice(1).join('-').trim()
    : placeOfSupply || 'India';
  const destination = stateName || 'India';

  // Tax totals from invoice
  const totalIgst = Math.round((inv.tax_amount || 0) * 100) / 100; // We'll derive below
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

  // Interstate detection: compare first 2 chars of seller vs buyer GSTIN
  const sellerGstin = Deno.env.get('ADAEQUARE_GSTIN') || '';
  const buyerGstin = inv.customer_gstin || customer?.gstin || '';
  const interstate = buyerGstin && sellerGstin
    ? buyerGstin.substring(0, 2) !== sellerGstin.substring(0, 2)
    : false;

  // Party amount is always negative
  const partyAmount = -1 * grandTotal;

  // Address
  const addrStr = inv.billing_address || customer?.billing_address || '';
  const addrLines = buildAddressLines(addrStr, inv.customer_name);

  const customerName = escapeXml(inv.customer_name || '');
  const invoiceNum = escapeXml(inv.invoice_number || '');
  const customerGstin = escapeXml(buyerGstin);

  const itemsXml = buildItemsXml(items);

  // Tax ledger entries
  let taxLedgers = '';
  if (!interstate) {
    if (cgst > 0) {
      taxLedgers += `
      <LEDGERENTRIES.LIST>
       <OLDAUDITENTRYIDS.LIST TYPE="Number">
        <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>
       </OLDAUDITENTRYIDS.LIST>
       <LEDGERNAME>CGST</LEDGERNAME>
       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
       <LEDGERFROMITEM>No</LEDGERFROMITEM>
       <ISPARTYLEDGER>No</ISPARTYLEDGER>
       <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>
       <AMOUNT>${cgst.toFixed(2)}</AMOUNT>
       <VATEXPAMOUNT>${cgst.toFixed(2)}</VATEXPAMOUNT>
      </LEDGERENTRIES.LIST>`;
    }
    if (sgst > 0) {
      taxLedgers += `
      <LEDGERENTRIES.LIST>
       <OLDAUDITENTRYIDS.LIST TYPE="Number">
        <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>
       </OLDAUDITENTRYIDS.LIST>
       <LEDGERNAME>SGST</LEDGERNAME>
       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
       <LEDGERFROMITEM>No</LEDGERFROMITEM>
       <ISPARTYLEDGER>No</ISPARTYLEDGER>
       <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>
       <AMOUNT>${sgst.toFixed(2)}</AMOUNT>
       <VATEXPAMOUNT>${sgst.toFixed(2)}</VATEXPAMOUNT>
      </LEDGERENTRIES.LIST>`;
    }
  } else {
    if (igst > 0) {
      taxLedgers += `
      <LEDGERENTRIES.LIST>
       <OLDAUDITENTRYIDS.LIST TYPE="Number">
        <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>
       </OLDAUDITENTRYIDS.LIST>
       <APPROPRIATEFOR>&#4; Not Applicable</APPROPRIATEFOR>
       <ROUNDTYPE>&#4; Not Applicable</ROUNDTYPE>
       <LEDGERNAME>IGST</LEDGERNAME>
       <GSTCLASS>&#4; Not Applicable</GSTCLASS>
       <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
       <LEDGERFROMITEM>No</LEDGERFROMITEM>
       <ISPARTYLEDGER>No</ISPARTYLEDGER>
       <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>
       <AMOUNT>${igst.toFixed(2)}</AMOUNT>
       <VATEXPAMOUNT>${igst.toFixed(2)}</VATEXPAMOUNT>
      </LEDGERENTRIES.LIST>`;
    }
  }

  // Round-off ledger
  let roundoffXml = '';
  if (Math.abs(roundoff) >= 0.01) {
    const roundoffSign = roundoff > 0 ? 'No' : 'Yes';
    roundoffXml = `
              <LEDGERENTRIES.LIST>
               <OLDAUDITENTRYIDS.LIST TYPE="Number">
                <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>
               </OLDAUDITENTRYIDS.LIST>
               <ROUNDTYPE>Normal Rounding</ROUNDTYPE>
               <LEDGERNAME>Round Off</LEDGERNAME>
               <GSTCLASS>Not Applicable</GSTCLASS>
               <ISDEEMEDPOSITIVE>${roundoffSign}</ISDEEMEDPOSITIVE>
               <LEDGERFROMITEM>No</LEDGERFROMITEM>
               <ISPARTYLEDGER>No</ISPARTYLEDGER>
               <ISLASTDEEMEDPOSITIVE>${roundoffSign}</ISLASTDEEMEDPOSITIVE>
               <ROUNDLIMIT> 1</ROUNDLIMIT>
               <AMOUNT>${roundoff.toFixed(2)}</AMOUNT>
               <VATEXPAMOUNT>${roundoff.toFixed(2)}</VATEXPAMOUNT>
              </LEDGERENTRIES.LIST>`;
  }

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
     <SVCURRENTCOMPANY>${escapeXml(EXPECTED_COMPANY)}</SVCURRENTCOMPANY>
    </STATICVARIABLES>
   </REQUESTDESC>
   <REQUESTDATA>
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
     <VOUCHER REMOTEID="" VCHKEY="" VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
      <ADDRESS.LIST TYPE="String">
       <ADDRESS>${customerName}</ADDRESS>${addrLines}
      </ADDRESS.LIST>
      <BASICBUYERADDRESS.LIST TYPE="String">
       <BASICBUYERADDRESS>${customerName}</BASICBUYERADDRESS>${addrLines}
      </BASICBUYERADDRESS.LIST>
      <OLDAUDITENTRYIDS.LIST TYPE="Number">
       <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>
      </OLDAUDITENTRYIDS.LIST>
      <INVOICEORDERLIST.LIST>
           <BASICORDERDATE>${poDateStr}</BASICORDERDATE>
           <BASICPURCHASEORDERNO>${escapeXml(poNo)}</BASICPURCHASEORDERNO>
           <BASICOTHERREFERENCES></BASICOTHERREFERENCES>
        </INVOICEORDERLIST.LIST>
        <BASICFINALDESTINATION>${escapeXml(destination)}</BASICFINALDESTINATION>
        <BASICORDERREF></BASICORDERREF>
        <BASICDUEDATEOFPYMT>${escapeXml(paymentTerms)}</BASICDUEDATEOFPYMT>
        <BASICSHIPPEDBY>${escapeXml(transporter)}</BASICSHIPPEDBY>

      <DATE>${dateStr}</DATE>
      <ISINVOICE>Yes</ISINVOICE>
      <STATENAME>${escapeXml(stateName)}</STATENAME>
      <COUNTRYOFRESIDENCE>India</COUNTRYOFRESIDENCE>
      <PARTYGSTIN>${customerGstin}</PARTYGSTIN>
      <PLACEOFSUPPLY>${escapeXml(stateName)}</PLACEOFSUPPLY>
      <PARTYNAME>${customerName}</PARTYNAME>
      <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${invoiceNum}</VOUCHERNUMBER>
      <PARTYLEDGERNAME>${customerName}</PARTYLEDGERNAME>
      <CSTFORMISSUETYPE>&#4; Not Applicable</CSTFORMISSUETYPE>
      <CSTFORMRECVTYPE>&#4; Not Applicable</CSTFORMRECVTYPE>
      <FBTPAYMENTTYPE>Default</FBTPAYMENTTYPE>
      <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
      <VCHGSTCLASS>&#4; Not Applicable</VCHGSTCLASS>
      <DIFFACTUALQTY>No</DIFFACTUALQTY>
      <ISMSTFROMSYNC>No</ISMSTFROMSYNC>
      <ASORIGINAL>No</ASORIGINAL>
      <AUDITED>No</AUDITED>
      <FORJOBCOSTING>No</FORJOBCOSTING>
      <ISOPTIONAL>No</ISOPTIONAL>
      <EFFECTIVEDATE>${dateStr}</EFFECTIVEDATE>
      <USEFOREXCISE>No</USEFOREXCISE>
      <ISFORJOBWORKIN>No</ISFORJOBWORKIN>
      <ALLOWCONSUMPTION>No</ALLOWCONSUMPTION>
      <USEFORINTEREST>No</USEFORINTEREST>
      <USEFORGAINLOSS>No</USEFORGAINLOSS>
      <USEFORGODOWNTRANSFER>No</USEFORGODOWNTRANSFER>
      <USEFORCOMPOUND>No</USEFORCOMPOUND>
      <ALTERID> </ALTERID>
      <EXCISEOPENING>No</EXCISEOPENING>
      <USEFORFINALPRODUCTION>No</USEFORFINALPRODUCTION>
      <ISTDSOVERRIDDEN>No</ISTDSOVERRIDDEN>
      <ISTCSOVERRIDDEN>No</ISTCSOVERRIDDEN>
      <ISTDSTCSCASHVCH>No</ISTDSTCSCASHVCH>
      <INCLUDEADVPYMTVCH>No</INCLUDEADVPYMTVCH>
      <ISSUBWORKSCONTRACT>No</ISSUBWORKSCONTRACT>
      <ISVATOVERRIDDEN>No</ISVATOVERRIDDEN>
      <IGNOREORIGVCHDATE>No</IGNOREORIGVCHDATE>
      <ISSERVICETAXOVERRIDDEN>No</ISSERVICETAXOVERRIDDEN>
      <ISISDVOUCHER>No</ISISDVOUCHER>
      <ISEXCISEOVERRIDDEN>No</ISEXCISEOVERRIDDEN>
      <ISEXCISESUPPLYVCH>No</ISEXCISESUPPLYVCH>
      <GSTNOTEXPORTED>No</GSTNOTEXPORTED>
      <IGNOREGSTINVALIDATION>No</IGNOREGSTINVALIDATION>
      <ISGSTREFUND>No</ISGSTREFUND>
      <ISGSTSECSEVENAPPLICABLE>No</ISGSTSECSEVENAPPLICABLE>
      <ISVATPRINCIPALACCOUNT>No</ISVATPRINCIPALACCOUNT>
      <VCHSTATUSISVCHNUMUSED>No</VCHSTATUSISVCHNUMUSED>
      <VCHGSTSTATUSISAPPLICABLE>Yes</VCHGSTSTATUSISAPPLICABLE>
      <VCHGSTSTATUSISUNCERTAIN>Yes</VCHGSTSTATUSISUNCERTAIN>
      <EWAYBILLDETAILS.LIST>      </EWAYBILLDETAILS.LIST>
      <EXCLUDEDTAXATIONS.LIST>      </EXCLUDEDTAXATIONS.LIST>
      <OLDAUDITENTRIES.LIST>      </OLDAUDITENTRIES.LIST>
      <ACCOUNTAUDITENTRIES.LIST>      </ACCOUNTAUDITENTRIES.LIST>
      <AUDITENTRIES.LIST>      </AUDITENTRIES.LIST>
      <DUTYHEADDETAILS.LIST>      </DUTYHEADDETAILS.LIST>
      <GSTADVADJDETAILS.LIST>      </GSTADVADJDETAILS.LIST>
      ${itemsXml}
      <CONTRITRANS.LIST>      </CONTRITRANS.LIST>
      <EWAYBILLERRORLIST.LIST>      </EWAYBILLERRORLIST.LIST>
      <IRNERRORLIST.LIST>      </IRNERRORLIST.LIST>
      <HARYANAVAT.LIST>      </HARYANAVAT.LIST>
      <SUPPLEMENTARYDUTYHEADDETAILS.LIST>      </SUPPLEMENTARYDUTYHEADDETAILS.LIST>
      <INVOICEDELNOTES.LIST>      </INVOICEDELNOTES.LIST>
      <INVOICEORDERLIST.LIST>      </INVOICEORDERLIST.LIST>
      <INVOICEINDENTLIST.LIST>      </INVOICEINDENTLIST.LIST>
      <ATTENDANCEENTRIES.LIST>      </ATTENDANCEENTRIES.LIST>
      <ORIGINVOICEDETAILS.LIST>      </ORIGINVOICEDETAILS.LIST>
      <INVOICEEXPORTLIST.LIST>      </INVOICEEXPORTLIST.LIST>
      <LEDGERENTRIES.LIST>
       <OLDAUDITENTRYIDS.LIST TYPE="Number">
        <OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS>
       </OLDAUDITENTRYIDS.LIST>
       <LEDGERNAME>${customerName}</LEDGERNAME>
       <GSTCLASS>&#4; Not Applicable</GSTCLASS>
       <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
       <LEDGERFROMITEM>No</LEDGERFROMITEM>
       <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
       <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
       <ISLASTDEEMEDPOSITIVE>Yes</ISLASTDEEMEDPOSITIVE>
       <AMOUNT>${partyAmount.toFixed(2)}</AMOUNT>
       <SERVICETAXDETAILS.LIST>       </SERVICETAXDETAILS.LIST>
       <BANKALLOCATIONS.LIST>       </BANKALLOCATIONS.LIST>
       <BILLALLOCATIONS.LIST>       </BILLALLOCATIONS.LIST>
       <INTERESTCOLLECTION.LIST>       </INTERESTCOLLECTION.LIST>
       <OLDAUDITENTRIES.LIST>       </OLDAUDITENTRIES.LIST>
       <ACCOUNTAUDITENTRIES.LIST>       </ACCOUNTAUDITENTRIES.LIST>
       <AUDITENTRIES.LIST>       </AUDITENTRIES.LIST>
       <INPUTCRALLOCS.LIST>       </INPUTCRALLOCS.LIST>
       <DUTYHEADDETAILS.LIST>       </DUTYHEADDETAILS.LIST>
       <EXCISEDUTYHEADDETAILS.LIST>       </EXCISEDUTYHEADDETAILS.LIST>
       <RATEDETAILS.LIST>       </RATEDETAILS.LIST>
       <SUMMARYALLOCS.LIST>       </SUMMARYALLOCS.LIST>
       <CENVATDUTYALLOCATIONS.LIST>       </CENVATDUTYALLOCATIONS.LIST>
       <STPYMTDETAILS.LIST>       </STPYMTDETAILS.LIST>
       <EXCISEPAYMENTALLOCATIONS.LIST>       </EXCISEPAYMENTALLOCATIONS.LIST>
       <TAXBILLALLOCATIONS.LIST>       </TAXBILLALLOCATIONS.LIST>
       <TAXOBJECTALLOCATIONS.LIST>       </TAXOBJECTALLOCATIONS.LIST>
       <TDSEXPENSEALLOCATIONS.LIST>       </TDSEXPENSEALLOCATIONS.LIST>
       <VATSTATUTORYDETAILS.LIST>       </VATSTATUTORYDETAILS.LIST>
       <COSTTRACKALLOCATIONS.LIST>       </COSTTRACKALLOCATIONS.LIST>
       <REFVOUCHERDETAILS.LIST>       </REFVOUCHERDETAILS.LIST>
       <INVOICEWISEDETAILS.LIST>       </INVOICEWISEDETAILS.LIST>
       <VATITCDETAILS.LIST>       </VATITCDETAILS.LIST>
       <ADVANCETAXDETAILS.LIST>       </ADVANCETAXDETAILS.LIST>
       <TAXTYPEALLOCATIONS.LIST>       </TAXTYPEALLOCATIONS.LIST>
      </LEDGERENTRIES.LIST>
      ${taxLedgers}
      ${roundoffXml}
      <STKJRNLADDLCOSTDETAILS.LIST>      </STKJRNLADDLCOSTDETAILS.LIST>
      <PAYROLLMODEOFPAYMENT.LIST>      </PAYROLLMODEOFPAYMENT.LIST>
      <ATTDRECORDS.LIST>      </ATTDRECORDS.LIST>
      <GSTEWAYCONSIGNORADDRESS.LIST>      </GSTEWAYCONSIGNORADDRESS.LIST>
      <GSTEWAYCONSIGNEEADDRESS.LIST>      </GSTEWAYCONSIGNEEADDRESS.LIST>
      <TEMPGSTRATEDETAILS.LIST>      </TEMPGSTRATEDETAILS.LIST>
      <TEMPGSTADVADJUSTED.LIST>      </TEMPGSTADVADJUSTED.LIST>
      <GSTBUYERADDRESS.LIST>      </GSTBUYERADDRESS.LIST>
      <GSTCONSIGNEEADDRESS.LIST>      </GSTCONSIGNEEADDRESS.LIST>
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

    // 2. Fetch order items (for tax rates and MRP)
    const items = inv.sales_order_id
      ? await base44.asServiceRole.entities.SalesOrderItem.filter({ sales_order_id: inv.sales_order_id })
      : [];

    // 3. Fetch sales order (for PO details, transporter)
    let order = null;
    if (inv.sales_order_id) {
      const orders = await base44.asServiceRole.entities.SalesOrder.filter({ id: inv.sales_order_id });
      order = orders?.[0] || null;
    }

    // 4. Fetch customer (for address, place_of_supply)
    let customer = null;
    if (inv.customer_gstin) {
      const customers = await base44.asServiceRole.entities.Customer.filter({ gstin: inv.customer_gstin });
      customer = customers?.[0] || null;
    }
    if (!customer && inv.customer_name) {
      const customers = await base44.asServiceRole.entities.Customer.filter({ name: inv.customer_name });
      customer = customers?.[0] || null;
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
      // Log network failure
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