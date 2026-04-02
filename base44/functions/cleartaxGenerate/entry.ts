/**
 * E-Invoice (IRN) and E-Way Bill Generation
 *
 * Supports multiple modes:
 *   demo              — Returns mock data for testing UI flow (default)
 *   adaequare         — Direct Adaequare GSP integration (no India Compliance API key needed)
 *   india_compliance  — Via asp.resilient.tech (requires INDIA_COMPLIANCE_API_KEY)
 *
 * Actions: generate_irn | generate_eway | cancel_irn | cancel_eway
 *
 * Environment Variables:
 *   GST_INTEGRATION_MODE: 'demo' | 'adaequare' | 'india_compliance' (default: demo)
 *   ADAEQUARE_GSTIN, ADAEQUARE_USERNAME, ADAEQUARE_PASSWORD
 *   INDIA_COMPLIANCE_API_KEY (india_compliance mode only)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const SELLER_GSTIN = Deno.env.get('SELLER_GSTIN') || '06AAHCK7191E1ZF';
const SELLER_NAME  = Deno.env.get('SELLER_NAME') || 'K95 Foods Private Limited';
const SELLER_ADDR  = Deno.env.get('SELLER_ADDRESS') || 'Plot No. V8, M.I.E , Part - B, Bahadurgarh';
const SELLER_CITY  = Deno.env.get('SELLER_CITY') || 'Bahadurgarh';
const SELLER_PIN   = parseInt(Deno.env.get('SELLER_PIN') || '124507');
const SELLER_STATE = Deno.env.get('SELLER_STATE_CODE') || '06';

const ADAEQUARE_LIVE_URL    = 'https://gsp.adaequare.com';
const ADAEQUARE_SANDBOX_URL = 'https://gsp.adaequare.com/test';
const ASP_BASE_URL_LIVE     = 'https://asp.resilient.tech/ei/api';
const ASP_BASE_URL_SANDBOX  = 'https://asp.resilient.tech/test/ei/api';

function getIntegrationMode() {
  return (Deno.env.get('GST_INTEGRATION_MODE') || 'demo').toLowerCase();
}

function getStateCode(gstin) {
  return gstin?.substring(0, 2) || '07';
}

const STATE_DEFAULT_PIN = {
  '01':190001,'02':171001,'03':244001,'04':160017,'05':247001,'06':124001,
  '07':110001,'08':302001,'09':226001,'10':800001,'11':194101,'12':160001,
  '13':797001,'14':795001,'15':793001,'16':793001,'17':793001,'18':781001,
  '19':700001,'20':834001,'21':751001,'22':492001,'23':462001,'24':380001,
  '25':403001,'26':396001,'27':400001,'28':520001,'29':560001,'30':682001,
  '31':600001,'32':695001,'33':600001,'34':605001,'35':744101,'36':500001,
  '37':520001,'38':361001,'97':110001,
};

function getDefaultPin(stateCode) {
  return STATE_DEFAULT_PIN[stateCode] || 110001;
}

function formatDate(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function generateRequestId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'K95';
  for (let i = 0; i < 10; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

function generateMockIRN(invoiceNumber) {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `DEMO${ts}${rand}${(invoiceNumber || '').replace(/\//g, '')}`.substring(0, 64);
}

function generateMockEwayBill() {
  return `DEMO${Date.now()}`;
}

function generateMockAckNo() {
  return Math.floor(100000000000 + Math.random() * 900000000000);
}

function buildInvoicePayload(invoice, items, order) {
  const buyerGstin   = invoice.customer_gstin || order?.customer_gstin || 'URP';
  const buyerState   = getStateCode(buyerGstin);
  const isInterState = buyerState !== SELLER_STATE;

  const itemList = items.map((item, idx) => {
    const rate       = item.unit_base_cost || item.rate_snapshot || 0;
    const qty        = item.quantity || 0;
    const taxableVal = item.taxable_value || parseFloat((rate * qty).toFixed(2));
    const igstRate   = item.igst_rate || 40;
    return {
      SlNo: String(idx + 1), PrdDesc: item.description || '', IsServc: 'N',
      HsnCd: item.hsn_code || '22029990', Qty: qty, Unit: 'NOS',
      UnitPrice: rate, TotAmt: taxableVal, Discount: 0, AssAmt: taxableVal,
      GstRt: igstRate,
      IgstAmt: isInterState ? parseFloat((item.igst_amount || taxableVal * igstRate / 100).toFixed(2)) : 0,
      CgstAmt: !isInterState ? parseFloat((item.cgst_amount || taxableVal * igstRate / 200).toFixed(2)) : 0,
      SgstAmt: !isInterState ? parseFloat((item.sgst_amount || taxableVal * igstRate / 200).toFixed(2)) : 0,
      CesRt: 0, CesAmt: 0,
      TotItemVal: item.total_amount || parseFloat((taxableVal + (item.igst_amount || item.cgst_amount
        ? (item.igst_amount || (item.cgst_amount + item.sgst_amount))
        : taxableVal * igstRate / 100)).toFixed(2)),
    };
  });

  const taxableAmount = parseFloat(items.reduce((s, i) => s + (i.taxable_value || (i.unit_base_cost || 0) * (i.quantity || 0)), 0).toFixed(2));
  const igstTotal     = isInterState  ? parseFloat(items.reduce((s, i) => s + (i.igst_amount || 0), 0).toFixed(2)) : 0;
  const cgstTotal     = !isInterState ? parseFloat(items.reduce((s, i) => s + (i.cgst_amount || 0), 0).toFixed(2)) : 0;
  const sgstTotal     = !isInterState ? parseFloat(items.reduce((s, i) => s + (i.sgst_amount || 0), 0).toFixed(2)) : 0;
  const grandTotal    = parseFloat((invoice.total_amount || (taxableAmount + igstTotal + cgstTotal + sgstTotal)).toFixed(2));

  return {
    Version: '1.1',
    TranDtls: { TaxSch: 'GST', SupTyp: 'B2B', RegRev: 'N', IgstOnIntra: 'N' },
    DocDtls: { Typ: 'INV', No: invoice.invoice_number, Dt: formatDate(invoice.invoice_date) },
    SellerDtls: { Gstin: SELLER_GSTIN, TradNm: SELLER_NAME, LglNm: SELLER_NAME, Addr1: SELLER_ADDR, Loc: SELLER_CITY, Pin: SELLER_PIN, Stcd: SELLER_STATE },
    BuyerDtls: {
      Gstin: buyerGstin, TradNm: invoice.customer_name || '', LglNm: invoice.customer_name || '',
      Pos: buyerState, Addr1: (invoice.billing_address || invoice.shipping_address || 'Address Not Available').substring(0, 100),
      Loc: (invoice.customer_name || 'NA').substring(0, 50), Pin: getDefaultPin(buyerState),
      Stcd: buyerState, Ph: '9999999999', Em: 'accounts@buyer.com',
    },
    ItemList: itemList,
    ValDtls: { AssVal: taxableAmount, IgstVal: igstTotal, CgstVal: cgstTotal, SgstVal: sgstTotal, CesVal: 0, StCesVal: 0, Discount: 0, OthChrg: 0, RndOffAmt: 0, TotInvVal: grandTotal, TotInvValFc: 0 },
  };
}

function buildAspHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-key':    Deno.env.get('INDIA_COMPLIANCE_API_KEY') || '',
    'gstin':        Deno.env.get('ADAEQUARE_GSTIN') || SELLER_GSTIN,
    'user_name':    Deno.env.get('ADAEQUARE_USERNAME') || '',
    'password':     Deno.env.get('ADAEQUARE_PASSWORD') || '',
    'requestid':    generateRequestId(),
  };
}

function buildAdaequareHeaders() {
  return {
    'Content-Type': 'application/json',
    'gstin':        Deno.env.get('ADAEQUARE_GSTIN') || SELLER_GSTIN,
    'user_name':    Deno.env.get('ADAEQUARE_USERNAME') || '',
    'password':     Deno.env.get('ADAEQUARE_PASSWORD') || '',
    'requestid':    generateRequestId(),
  };
}

// ── DEMO MODE ─────────────────────────────────────────────────────────────────
async function handleDemoMode(action, invoice, items, order, distanceKm, base44, invoiceId) {
  if (action === 'generate_irn') {
    const mockIrn = generateMockIRN(invoice.invoice_number);
    const mockAckNo = generateMockAckNo();
    const mockAckDate = new Date().toISOString();
    await base44.asServiceRole.entities.SalesInvoice.update(invoiceId, {
      irn: mockIrn, ack_number: String(mockAckNo), ack_date: mockAckDate,
    });
    return { success: true, demo_mode: true, irn: mockIrn, ack_number: mockAckNo, ack_date: mockAckDate, message: 'DEMO MODE: Mock IRN generated. Set GST_INTEGRATION_MODE to adaequare or india_compliance for live integration.' };
  }

  if (action === 'generate_eway') {
    if (!invoice.irn) return { success: false, error: 'Generate IRN first before generating E-Way Bill' };
    const mockEwayBill = generateMockEwayBill();
    const mockEwayDate = new Date().toISOString().split('T')[0];
    await base44.asServiceRole.entities.SalesInvoice.update(invoiceId, {
      eway_bill: mockEwayBill, eway_bill_date: mockEwayDate,
    });
    return { success: true, demo_mode: true, eway_bill: mockEwayBill, eway_bill_date: mockEwayDate, message: 'DEMO MODE: Mock E-Way Bill generated.' };
  }

  return { success: false, error: `Unknown action: ${action}` };
}

// ── ADAEQUARE DIRECT MODE ─────────────────────────────────────────────────────
async function handleAdaequareMode(action, invoice, items, order, distanceKm, base44, invoiceId, useSandbox) {
  if (!Deno.env.get('ADAEQUARE_USERNAME') || !Deno.env.get('ADAEQUARE_PASSWORD')) {
    return { success: false, error: 'ADAEQUARE_USERNAME and ADAEQUARE_PASSWORD are required for adaequare mode' };
  }
  const BASE_URL = useSandbox ? ADAEQUARE_SANDBOX_URL : ADAEQUARE_LIVE_URL;

  if (action === 'generate_irn') {
    const payload = buildInvoicePayload(invoice, items, order);
    const resp = await fetch(`${BASE_URL}/enriched/ei/api/invoice`, {
      method: 'POST', headers: buildAdaequareHeaders(), body: JSON.stringify(payload),
    });
    const data = await resp.json();
    const result = Array.isArray(data) ? data[0] : data;
    if (!resp.ok || result?.success === false) return { success: false, error: result?.message || 'Adaequare API error', details: result };

    const irn = result.Irn || result.irn;
    const ackNo = result.AckNo || result.ack_no;
    const ackDate = result.AckDt || result.ack_dt;
    if (!useSandbox) {
      await base44.asServiceRole.entities.SalesInvoice.update(invoiceId, { irn, ack_number: String(ackNo || ''), ack_date: ackDate || new Date().toISOString() });
    }
    return { success: true, irn, ack_number: ackNo, ack_date: ackDate, mode: 'adaequare', sandbox: useSandbox };
  }

  if (action === 'generate_eway') {
    if (!invoice.irn) return { success: false, error: 'Generate IRN first before generating E-Way Bill' };
    const ewayPayload = {
      Irn: invoice.irn, Distance: distanceKm || 0, TransMode: '1',
      TransId: null, TransName: order?.transporter || '', TransDocNo: '', TransDocDt: formatDate(), VehNo: '', VehType: 'R',
    };
    const resp = await fetch(`${BASE_URL}/enriched/ei/api/ewaybill`, {
      method: 'POST', headers: buildAdaequareHeaders(), body: JSON.stringify(ewayPayload),
    });
    const data = await resp.json();
    const result = Array.isArray(data) ? data[0] : data;
    if (!resp.ok || result?.success === false) return { success: false, error: result?.message || 'E-Way Bill API error', details: result };

    const ewayBillNo = result.EwbNo || result.ewb_no;
    const ewayDate = result.EwbDt || new Date().toISOString().split('T')[0];
    if (!useSandbox) {
      await base44.asServiceRole.entities.SalesInvoice.update(invoiceId, { eway_bill: String(ewayBillNo || ''), eway_bill_date: ewayDate });
    }
    return { success: true, eway_bill: ewayBillNo, eway_bill_date: ewayDate, mode: 'adaequare', sandbox: useSandbox };
  }

  return { success: false, error: `Unknown action: ${action}` };
}

// ── INDIA COMPLIANCE ASP MODE ─────────────────────────────────────────────────
async function handleIndiaComplianceMode(action, invoice, items, order, distanceKm, base44, invoiceId, useSandbox) {
  if (!Deno.env.get('INDIA_COMPLIANCE_API_KEY')) {
    return { success: false, error: 'INDIA_COMPLIANCE_API_KEY is required for india_compliance mode' };
  }
  const ASP_BASE_URL = useSandbox ? ASP_BASE_URL_SANDBOX : ASP_BASE_URL_LIVE;

  if (action === 'generate_irn') {
    const payload = buildInvoicePayload(invoice, items, order);
    const resp = await fetch(`${ASP_BASE_URL}/invoice`, {
      method: 'POST', headers: buildAspHeaders(), body: JSON.stringify(payload),
    });
    const data = await resp.json();
    const result = Array.isArray(data) ? data[0] : data;
    if (!resp.ok || result?.success === false || result?.Success === false) {
      return { success: false, error: result?.message || result?.Message || 'ASP API error', details: result };
    }

    const irn = result.Irn || result.irn;
    const ackNo = result.AckNo || result.ack_no;
    const ackDate = result.AckDt || result.ack_dt;
    if (!useSandbox) {
      await base44.asServiceRole.entities.SalesInvoice.update(invoiceId, { irn, ack_number: String(ackNo || ''), ack_date: ackDate || new Date().toISOString() });
    }
    return { success: true, irn, ack_number: ackNo, ack_date: ackDate, mode: 'india_compliance', sandbox: useSandbox };
  }

  if (action === 'generate_eway') {
    if (!invoice.irn) return { success: false, error: 'Generate IRN first before generating E-Way Bill' };
    const dn = invoice.delivery_note_id
      ? (await base44.asServiceRole.entities.SalesDeliveryNote.filter({ id: invoice.delivery_note_id }))[0]
      : null;
    const ewayPayload = {
      Irn: invoice.irn, Distance: distanceKm || 0, TransMode: '1', TransId: null,
      TransName: dn?.transporter_name || order?.transporter || '',
      TransDocNo: dn?.lr_number || '', TransDocDt: formatDate(dn?.dispatch_date),
      VehNo: dn?.vehicle_number || '', VehType: 'R',
    };
    const resp = await fetch(`${ASP_BASE_URL}/ewaybill`, {
      method: 'POST', headers: buildAspHeaders(), body: JSON.stringify(ewayPayload),
    });
    const data = await resp.json();
    const result = Array.isArray(data) ? data[0] : data;
    if (!resp.ok || result?.success === false || result?.Success === false) {
      return { success: false, error: result?.message || result?.Message || 'E-Way Bill API error', details: result };
    }

    const ewayBillNo = result.EwbNo || result.ewb_no;
    const ewayDate = result.EwbDt || new Date().toISOString().split('T')[0];
    if (!useSandbox) {
      await base44.asServiceRole.entities.SalesInvoice.update(invoiceId, { eway_bill: String(ewayBillNo || ''), eway_bill_date: ewayDate });
    }
    return { success: true, eway_bill: ewayBillNo, eway_bill_date: ewayDate, mode: 'india_compliance', sandbox: useSandbox };
  }

  return { success: false, error: `Unknown action: ${action}` };
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, invoice_id, distance_km, sandbox } = await req.json();
    const useSandbox = sandbox === true;
    const mode = getIntegrationMode();

    if (!action || !invoice_id) {
      return Response.json({ error: 'action and invoice_id are required' }, { status: 400 });
    }

    const invoices = await base44.asServiceRole.entities.SalesInvoice.filter({ id: invoice_id });
    const invoice = invoices[0];
    if (!invoice) return Response.json({ error: 'Invoice not found' }, { status: 404 });

    const [items, orders] = await Promise.all([
      base44.asServiceRole.entities.SalesOrderItem.filter({ sales_order_id: invoice.sales_order_id }),
      base44.asServiceRole.entities.SalesOrder.filter({ id: invoice.sales_order_id }),
    ]);
    const order = orders[0];

    let result;
    switch (mode) {
      case 'adaequare':
        result = await handleAdaequareMode(action, invoice, items, order, distance_km, base44, invoice_id, useSandbox);
        break;
      case 'india_compliance':
        result = await handleIndiaComplianceMode(action, invoice, items, order, distance_km, base44, invoice_id, useSandbox);
        break;
      default: // demo
        result = await handleDemoMode(action, invoice, items, order, distance_km, base44, invoice_id);
    }

    return Response.json(result, { status: result.success ? 200 : 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});