/**
 * GST Compliance Engine — E-Invoice (IRN) & E-Way Bill lifecycle
 * Uses Adaequare GSP Enriched APIs (direct to NIC/GSTN)
 *
 * API Reference: https://gsp.adaequare.com
 * 
 * Actions:
 *   generate_irn      — Generate IRN via IRP
 *   cancel_irn        — Cancel IRN
 *   generate_ewb      — Generate E-Way Bill (requires IRN for linked, or standalone)
 *   cancel_ewb        — Cancel E-Way Bill
 *   update_vehicle    — Update vehicle info (Part-B)
 *   update_transporter — Update transporter on E-Way Bill
 *   extend_validity   — Extend E-Way Bill validity
 *   fetch_ewb_status  — Fetch latest E-Way Bill status
 *   health_check      — Check API connectivity
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─── Environment Configuration ──────────────────────────────────────────────
const GST_MODE = Deno.env.get('GST_INTEGRATION_MODE') || 'sandbox'; // 'sandbox' or 'production'
const IS_SANDBOX = GST_MODE !== 'production'; // Anything other than 'production' = sandbox

// Base URLs (same domain, /test/ prefix for sandbox)
const GSP_BASE = IS_SANDBOX 
  ? 'https://gsp.adaequare.com/test' 
  : 'https://gsp.adaequare.com';

// API endpoints per Adaequare documentation
const AUTH_URL = 'https://gsp.adaequare.com/gsp/authenticate?grant_type=token';
const EINVOICE_URL = `${GSP_BASE}/enriched/einvoice/`;
const EWAYAPI_URL = `${GSP_BASE}/enriched/ewayapi/`;

// ─── Seller Constants (K95 Foods) ───────────────────────────────────────────
// In production, ADAEQUARE_GSTIN should be set to 06AAHCK7191E1ZF
// In sandbox, it will be the test GSTIN from Adaequare
const SELLER_GSTIN = Deno.env.get('ADAEQUARE_GSTIN') || '06AAHCK7191E1ZF';
const SELLER_LEGAL_NAME = 'K95 Foods Private Limited';
const SELLER_TRADE_NAME = 'K95 Foods Private Limited';
const SELLER_ADDR1 = 'Plot No. V8, M.I.E , Part - B';
const SELLER_ADDR2 = 'Bahadurgarh';
const SELLER_CITY = 'Bahadurgarh';
const SELLER_STATE_CODE = SELLER_GSTIN.substring(0, 2);

// ─── State PIN Code Map ─────────────────────────────────────────────────────
const STATE_PIN_MAP = {
  '01':190001,'02':171001,'03':143001,'04':160017,'05':247001,'06':124001,
  '07':110001,'08':302001,'09':226001,'10':800001,'11':194101,'12':160001,
  '13':797001,'14':795001,'15':793001,'16':788001,'17':799001,'18':781001,
  '19':700001,'20':834001,'21':751001,'22':492001,'23':462001,'24':380001,
  '25':403001,'26':396001,'27':400001,'28':500001,'29':560001,'30':682001,
  '31':600001,'32':695001,'33':600001,'34':605001,'35':744101,'36':500001,
  '37':520001,'38':361001,'97':110001,'99':110001,
};

// Seller PIN — use map for sandbox GSTINs, hardcoded for production
const SELLER_PIN = IS_SANDBOX ? (STATE_PIN_MAP[SELLER_STATE_CODE] || 124507) : 124507;

// ─── UOM Mapping (NIC codes) ────────────────────────────────────────────────
const UOM_MAP = {
  'pcs': 'PCS', 'nos': 'NOS', 'kg': 'KGS', 'kgs': 'KGS', 'l': 'LTR', 'ltr': 'LTR',
  'ml': 'MLT', 'box': 'BOX', 'case': 'CTN', 'ctn': 'CTN', 'carton': 'CTN',
  'pack': 'PAC', 'unit': 'UNT', 'btl': 'NOS', 'bottle': 'NOS', 'bottles': 'NOS',
};

// ─── Cancel Reason Codes ────────────────────────────────────────────────────
const EINV_CANCEL_REASONS = { 'Duplicate': '1', 'Data Entry Error': '2', 'Order Cancelled': '3', 'Others': '4' };
const EWB_CANCEL_REASONS = { 'Duplicate': 1, 'Entered by mistake': 2, 'Order Cancelled': 3, 'Others': 4 };

// ─── Token Cache ────────────────────────────────────────────────────────────
let tokenCache = { accessToken: null, expiresAt: 0 };

// ─── Utility Functions ──────────────────────────────────────────────────────

function getStateCode(gstin) {
  if (!gstin || gstin === 'URP') return '07'; // Default Delhi for unregistered
  return gstin.substring(0, 2);
}

function getDefaultPin(stateCode) {
  return STATE_PIN_MAP[stateCode] || 110001;
}

function formatDate(dateStr) {
  // Convert to DD/MM/YYYY format
  if (!dateStr) {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }
  
  // Handle ISO date strings
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    // Try parsing DD/MM/YYYY directly
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
    return formatDate(null);
  }
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function mapUOM(unit) {
  if (!unit) return 'NOS';
  return UOM_MAP[unit.toLowerCase()] || 'NOS';
}

function sanitizeString(str, maxLen = 100) {
  if (!str) return '';
  return String(str).replace(/[^\w\s.,\-()\/&]/gi, '').substring(0, maxLen).trim() || 'NA';
}

function generateRequestId() {
  return `K95_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

// ─── GSP Authentication ─────────────────────────────────────────────────────

async function getAccessToken() {
  // Return cached token if still valid (with 5 min buffer)
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt - 300000) {
    return tokenCache.accessToken;
  }

  const clientId = Deno.env.get('ADAEQUARE_GSP_APP_ID');
  const clientSecret = Deno.env.get('ADAEQUARE_GSP_APP_SECRET');
  const username = Deno.env.get('ADAEQUARE_USERNAME');
  const password = Deno.env.get('ADAEQUARE_PASSWORD');
  const gstin = Deno.env.get('ADAEQUARE_GSTIN') || SELLER_GSTIN;

  if (!clientId || !clientSecret) {
    throw new Error('Missing ADAEQUARE_GSP_APP_ID or ADAEQUARE_GSP_APP_SECRET');
  }
  if (!username || !password) {
    throw new Error('Missing ADAEQUARE_USERNAME or ADAEQUARE_PASSWORD');
  }

  console.log(`[GSP Auth] Authenticating with Adaequare GSP (mode: ${GST_MODE})...`);
  console.log(`[GSP Auth] Using client_id: ${clientId?.substring(0, 6)}..., gstin: ${gstin}`);

  // Adaequare supports two auth header formats:
  // Format 1: client_id / client_secret (per their API doc)
  // Format 2: gspappid / gspappsecret (legacy / some portal configurations)
  // We send BOTH to maximize compatibility
  const resp = await fetch(AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'username': username,
      'password': password,
      'gstin': gstin,
      'client_id': clientId,
      'client_secret': clientSecret,
      'gspappid': clientId,
      'gspappsecret': clientSecret,
    },
  });

  const text = await resp.text();
  console.log(`[GSP Auth] Status: ${resp.status}`);

  if (!resp.ok) {
    throw new Error(`GSP authentication failed (HTTP ${resp.status}): ${text.substring(0, 300)}`);
  }

  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error('GSP auth response is not valid JSON');
  }

  if (!result.access_token) {
    throw new Error(`GSP auth failed: ${result.message || result.error || JSON.stringify(result).substring(0, 200)}`);
  }

  const expiresIn = result.expires_in || 86400; // Default 24 hours
  tokenCache = {
    accessToken: result.access_token,
    expiresAt: Date.now() + (expiresIn * 1000),
  };

  console.log('[GSP Auth] Token obtained successfully');
  return tokenCache.accessToken;
}

// ─── API Request Builder ────────────────────────────────────────────────────

async function callAdaequareAPI(url, method, action, payload = null, retryOnAuthFail = true) {
  const token = await getAccessToken();
  const username = Deno.env.get('ADAEQUARE_USERNAME');
  const gstin = Deno.env.get('ADAEQUARE_GSTIN') || SELLER_GSTIN;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'username': username,
    'gstin': gstin,
    'requestid': generateRequestId(),
  };

  // Action header is CRITICAL for Adaequare API
  if (action) {
    headers['action'] = action;
  }

  const opts = { method, headers };
  if (payload && (method === 'POST' || method === 'PUT')) {
    opts.body = JSON.stringify(payload);
  }

  console.log(`[Adaequare] ${method} ${url} | Action: ${action || 'N/A'}`);
  if (payload) {
    console.log(`[Adaequare] Payload preview: ${JSON.stringify(payload).substring(0, 500)}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);
  opts.signal = controller.signal;

  let resp;
  try {
    resp = await fetch(url, opts);
  } catch (err) {
    clearTimeout(timeoutId);
    throw new Error(`Network error calling Adaequare: ${err.message}`);
  }
  clearTimeout(timeoutId);

  const text = await resp.text();
  console.log(`[Adaequare] Response status: ${resp.status}`);
  console.log(`[Adaequare] Response preview: ${text.substring(0, 600)}`);

  let result;
  try {
    result = JSON.parse(text);
  } catch {
    result = { raw: text, parseError: true };
  }

  // Handle auth failures with retry
  if ((resp.status === 401 || resp.status === 403) && retryOnAuthFail) {
    console.log('[Adaequare] Auth failed, refreshing token...');
    tokenCache = { accessToken: null, expiresAt: 0 };
    return callAdaequareAPI(url, method, action, payload, false);
  }

  // Adaequare returns success:true/false in response body
  const success = result.success === true || (resp.ok && result.success !== false && !result.error);
  const errorMessage = result.message || result.error || result.ErrorDetails?.[0]?.ErrorMessage || '';
  const errorCode = result.ErrorDetails?.[0]?.ErrorCode || result.error_cd || '';

  return {
    ok: success,
    status: resp.status,
    result: result.result || result,
    message: errorMessage,
    errorCode,
    raw: result,
  };
}

// ─── E-Invoice Payload Builder (NIC Standard) ───────────────────────────────

function buildEInvoicePayload(invoice, items, order, customer) {
  const buyerGstin = invoice.customer_gstin || customer?.gstin || order?.customer_gstin || 'URP';
  const buyerStateCode = getStateCode(buyerGstin);
  const isInterState = buyerStateCode !== SELLER_STATE_CODE;

  // Get buyer details from Customer entity if available
  const buyerLegalName = sanitizeString(customer?.name || invoice.customer_name || order?.customer_name || 'Buyer', 100);
  const buyerTradeName = sanitizeString(customer?.name || invoice.customer_name || order?.customer_name || 'Buyer', 100);
  const buyerAddr1 = sanitizeString(customer?.billing_address || invoice.billing_address || order?.billing_address || 'Address Not Available', 100);
  const buyerAddr2 = sanitizeString(customer?.shipping_address || '', 100);
  const buyerCity = sanitizeString(customer?.territory || customer?.region || invoice.customer_name?.split(' ')[0] || 'City', 50);
  const buyerPin = customer?.place_of_supply ? getDefaultPin(customer.place_of_supply) : getDefaultPin(buyerStateCode);

  // Build item list
  const lineItems = (invoice.items && invoice.items.length > 0) ? invoice.items : items || [];
  
  const itemList = lineItems.map((item, idx) => {
    const rate = parseFloat(item.price || item.unit_base_cost || item.rate_snapshot || 0);
    const qty = parseFloat(item.quantity || 0);
    const discount = parseFloat(item.discount_amount || 0);
    const taxableAmt = parseFloat(item.taxable_amount || ((rate * qty) - discount));
    const gstRate = parseFloat(item.igst_rate || (item.cgst_rate ? item.cgst_rate * 2 : 0) || 18);

    // Calculate taxes
    let igstAmt = 0, cgstAmt = 0, sgstAmt = 0;
    if (isInterState) {
      igstAmt = parseFloat(item.igst_amount || (taxableAmt * gstRate / 100));
    } else {
      cgstAmt = parseFloat(item.cgst_amount || (taxableAmt * gstRate / 200));
      sgstAmt = parseFloat(item.sgst_amount || (taxableAmt * gstRate / 200));
    }

    const totalItemVal = parseFloat((taxableAmt + igstAmt + cgstAmt + sgstAmt).toFixed(2));

    return {
      SlNo: String(idx + 1),              // STRING for E-Invoice
      PrdDesc: sanitizeString(item.item_name || item.description || 'Product', 300),
      IsServc: 'N',
      HsnCd: String(item.hsn_code || '22029990'),  // STRING for E-Invoice
      Barcde: item.barcode || undefined,
      Qty: parseFloat(qty.toFixed(2)),
      Unit: mapUOM(item.unit),
      UnitPrice: parseFloat(rate.toFixed(2)),
      TotAmt: parseFloat((rate * qty).toFixed(2)),
      Discount: parseFloat(discount.toFixed(2)),
      AssAmt: parseFloat(taxableAmt.toFixed(2)),
      GstRt: parseFloat(gstRate.toFixed(2)),
      IgstAmt: parseFloat(igstAmt.toFixed(2)),
      CgstAmt: parseFloat(cgstAmt.toFixed(2)),
      SgstAmt: parseFloat(sgstAmt.toFixed(2)),
      CesRt: 0,
      CesAmt: 0,
      CesNonAdvlAmt: 0,
      StateCesRt: 0,
      StateCesAmt: 0,
      StateCesNonAdvlAmt: 0,
      OthChrg: 0,
      TotItemVal: totalItemVal,
    };
  });

  // Calculate totals
  const totTaxable = parseFloat(itemList.reduce((s, i) => s + i.AssAmt, 0).toFixed(2));
  const totIgst = parseFloat(itemList.reduce((s, i) => s + i.IgstAmt, 0).toFixed(2));
  const totCgst = parseFloat(itemList.reduce((s, i) => s + i.CgstAmt, 0).toFixed(2));
  const totSgst = parseFloat(itemList.reduce((s, i) => s + i.SgstAmt, 0).toFixed(2));
  const grandTotal = parseFloat((invoice.total_invoice_value || invoice.total_amount || (totTaxable + totIgst + totCgst + totSgst)).toFixed(2));
  const roundOff = parseFloat((invoice.rounding_adjustment || (grandTotal - Math.floor(grandTotal))).toFixed(2));

  const payload = {
    Version: '1.1',
    TranDtls: {
      TaxSch: 'GST',
      SupTyp: 'B2B',
      RegRev: 'N',
      IgstOnIntra: 'N',
    },
    DocDtls: {
      Typ: 'INV',
      No: invoice.invoice_number,
      Dt: formatDate(invoice.invoice_date),
    },
    SellerDtls: {
      Gstin: SELLER_GSTIN,
      LglNm: SELLER_LEGAL_NAME,
      TrdNm: SELLER_TRADE_NAME,
      Addr1: SELLER_ADDR1,
      Addr2: SELLER_ADDR2,
      Loc: SELLER_CITY,
      Pin: SELLER_PIN,
      Stcd: SELLER_STATE_CODE,   // STRING for E-Invoice
    },
    BuyerDtls: {
      Gstin: buyerGstin,
      LglNm: buyerLegalName,
      TrdNm: buyerTradeName,
      Pos: buyerStateCode,       // STRING for E-Invoice
      Addr1: buyerAddr1,
      Addr2: buyerAddr2 || undefined,
      Loc: buyerCity,
      Pin: buyerPin,
      Stcd: buyerStateCode,      // STRING for E-Invoice
    },
    ItemList: itemList,
    ValDtls: {
      AssVal: totTaxable,
      IgstVal: totIgst,
      CgstVal: totCgst,
      SgstVal: totSgst,
      CesVal: 0,
      StCesVal: 0,
      Discount: 0,
      OthChrg: 0,
      RndOffAmt: roundOff,
      TotInvVal: grandTotal,
    },
  };

  // Add shipping details if different from billing
  const shipAddr = invoice.shipping_address || customer?.shipping_address || order?.shipping_address;
  if (shipAddr && shipAddr !== buyerAddr1) {
    payload.ShipDtls = {
      Gstin: buyerGstin,
      LglNm: buyerLegalName,
      TrdNm: buyerTradeName,
      Addr1: sanitizeString(shipAddr, 100),
      Addr2: '',
      Loc: buyerCity,
      Pin: buyerPin,
      Stcd: buyerStateCode,
    };
  }

  // Payment details (optional)
  if (invoice.payment_terms || invoice.due_date) {
    payload.PayDtls = {
      Nm: '',
      AccDet: '',
      Mode: '',
      FinInsBr: '',
      PayTerm: invoice.payment_terms || '',
      PayInstr: '',
      CrTrn: '',
      DirDr: '',
      CrDay: 0,
      PaidAmt: 0,
      PaymtDue: grandTotal,
    };
  }

  return payload;
}

// ─── E-Way Bill Payload Builder (NIC Standard) ──────────────────────────────

function buildEWayBillPayload(invoice, items, order, customer, vehicleInfo = {}) {
  const buyerGstin = invoice.customer_gstin || customer?.gstin || order?.customer_gstin || 'URP';
  const buyerStateCode = getStateCode(buyerGstin);
  const isInterState = buyerStateCode !== SELLER_STATE_CODE;

  // Buyer details
  const buyerName = sanitizeString(customer?.name || invoice.customer_name || order?.customer_name || 'Buyer', 100);
  const buyerAddr1 = sanitizeString(customer?.billing_address || invoice.billing_address || order?.billing_address || 'Address', 120);
  const buyerCity = sanitizeString(customer?.territory || invoice.customer_name?.split(' ')[0] || 'City', 50);
  const buyerPin = customer?.place_of_supply ? getDefaultPin(customer.place_of_supply) : getDefaultPin(buyerStateCode);

  // Build item list
  const lineItems = (invoice.items && invoice.items.length > 0) ? invoice.items : items || [];
  
  const itemList = lineItems.map((item, idx) => {
    const rate = parseFloat(item.price || item.unit_base_cost || item.rate_snapshot || 0);
    const qty = parseFloat(item.quantity || 0);
    const taxableAmt = parseFloat(item.taxable_amount || (rate * qty));
    const gstRate = parseFloat(item.igst_rate || (item.cgst_rate ? item.cgst_rate * 2 : 0) || 18);

    return {
      itemNo: idx + 1,                          // INTEGER for E-Way Bill
      productName: '',
      productDesc: sanitizeString(item.item_name || item.description || 'Product', 100),
      hsnCode: parseInt(item.hsn_code || '22029990', 10),  // INTEGER for E-Way Bill
      quantity: parseFloat(qty.toFixed(2)),
      qtyUnit: mapUOM(item.unit),
      taxableAmount: parseFloat(taxableAmt.toFixed(2)),
      sgstRate: isInterState ? 0 : parseFloat((gstRate / 2).toFixed(2)),
      cgstRate: isInterState ? 0 : parseFloat((gstRate / 2).toFixed(2)),
      igstRate: isInterState ? parseFloat(gstRate.toFixed(2)) : 0,
      cessRate: 0,
      cessNonAdvol: 0,
    };
  });

  // Calculate totals
  const totTaxable = parseFloat(itemList.reduce((s, i) => s + i.taxableAmount, 0).toFixed(2));
  const totCgst = parseFloat(itemList.reduce((s, i) => s + (i.taxableAmount * i.cgstRate / 100), 0).toFixed(2));
  const totSgst = parseFloat(itemList.reduce((s, i) => s + (i.taxableAmount * i.sgstRate / 100), 0).toFixed(2));
  const totIgst = parseFloat(itemList.reduce((s, i) => s + (i.taxableAmount * i.igstRate / 100), 0).toFixed(2));
  const grandTotal = parseFloat((invoice.total_invoice_value || invoice.total_amount || (totTaxable + totIgst + totCgst + totSgst)).toFixed(2));

  return {
    supplyType: 'O',          // Outward
    subSupplyType: '1',       // Supply
    docType: 'INV',
    docNo: invoice.invoice_number,
    docDate: formatDate(invoice.invoice_date),
    transactionType: 1,       // Regular

    // Seller (From)
    fromGstin: SELLER_GSTIN,
    fromTrdName: SELLER_TRADE_NAME,
    fromAddr1: SELLER_ADDR1,
    fromAddr2: SELLER_ADDR2,
    fromPlace: SELLER_CITY,
    fromPincode: SELLER_PIN,
    fromStateCode: parseInt(SELLER_STATE_CODE, 10),     // INTEGER for E-Way Bill
    actFromStateCode: parseInt(SELLER_STATE_CODE, 10),

    // Buyer (To)
    toGstin: buyerGstin,
    toTrdName: buyerName,
    toAddr1: buyerAddr1,
    toAddr2: '',
    toPlace: buyerCity,
    toPincode: buyerPin,
    toStateCode: parseInt(buyerStateCode, 10),          // INTEGER for E-Way Bill
    actToStateCode: parseInt(buyerStateCode, 10),

    // Values
    totalValue: totTaxable,
    cgstValue: totCgst,
    sgstValue: totSgst,
    igstValue: totIgst,
    cessValue: 0,
    cessNonAdvolValue: 0,
    otherValue: 0,
    totInvValue: grandTotal,

    // Transport details
    transporterId: vehicleInfo.transporter_id || invoice.transporter_id || '',
    transporterName: vehicleInfo.transporter_name || invoice.transporter_name || order?.transporter || '',
    transMode: vehicleInfo.trans_mode || invoice.mode_of_transport || '1',  // 1=Road
    transDistance: vehicleInfo.distance_km || invoice.distance || 0,
    transDocNo: vehicleInfo.lr_number || invoice.lr_number || '',
    transDocDate: formatDate(vehicleInfo.lr_date || invoice.lr_date || invoice.invoice_date),
    vehicleNo: vehicleInfo.vehicle_no || invoice.vehicle_no || '',
    vehicleType: vehicleInfo.vehicle_type || 'R',  // R=Regular, O=ODC

    // Items
    itemList: itemList,
  };
}

// ─── Main Handler ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, invoice_id } = body;

    // ── HEALTH CHECK ──
    if (action === 'health_check') {
      try {
        await getAccessToken();
        return Response.json({ 
          success: true, 
          message: 'Adaequare GSP connection successful',
          mode: GST_MODE,
          gstin: SELLER_GSTIN,
        });
      } catch (err) {
        return Response.json({ 
          success: false, 
          error: err.message,
          mode: GST_MODE,
        });
      }
    }

    // Validate required params
    if (!action || !invoice_id) {
      return Response.json({ error: 'action and invoice_id required' }, { status: 400 });
    }

    // Validate credentials
    if (!Deno.env.get('ADAEQUARE_GSP_APP_ID') || !Deno.env.get('ADAEQUARE_GSP_APP_SECRET')) {
      return Response.json({ error: 'GSP credentials not configured. Set ADAEQUARE_GSP_APP_ID and ADAEQUARE_GSP_APP_SECRET.' }, { status: 500 });
    }
    if (!Deno.env.get('ADAEQUARE_USERNAME') || !Deno.env.get('ADAEQUARE_PASSWORD')) {
      return Response.json({ error: 'NIC credentials not configured. Set ADAEQUARE_USERNAME and ADAEQUARE_PASSWORD.' }, { status: 500 });
    }

    // ── Fetch Invoice ──
    const invoices = await base44.asServiceRole.entities.SalesInvoice.filter({ id: invoice_id });
    const invoice = invoices[0];
    if (!invoice) {
      return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Fetch related data
    let items = [], order = null, customer = null;
    
    if (invoice.sales_order_id) {
      const [orderItems, orders] = await Promise.all([
        base44.asServiceRole.entities.SalesOrderItem.filter({ sales_order_id: invoice.sales_order_id }),
        base44.asServiceRole.entities.SalesOrder.filter({ id: invoice.sales_order_id }),
      ]);
      items = orderItems;
      order = orders[0];
    }

    // Fetch customer by name or GSTIN
    if (invoice.customer_name) {
      const customers = await base44.asServiceRole.entities.Customer.filter({ name: invoice.customer_name });
      customer = customers[0];
    }
    if (!customer && invoice.customer_gstin) {
      const customers = await base44.asServiceRole.entities.Customer.filter({ gstin: invoice.customer_gstin });
      customer = customers[0];
    }

    // ════════════════════════════════════════════════════════════════════════
    // GENERATE IRN
    // ════════════════════════════════════════════════════════════════════════
    if (action === 'generate_irn') {
      const payload = buildEInvoicePayload(invoice, items, order, customer);
      
      const { ok, result, message, errorCode, raw } = await callAdaequareAPI(
        EINVOICE_URL, 'POST', 'GENERATEIRN', payload
      );

      const irn = result?.Irn || result?.irn || '';
      const ackNo = result?.AckNo || result?.ack_no || '';
      const ackDate = result?.AckDt || result?.ack_dt || '';
      const signedInvoice = result?.SignedInvoice || '';
      const signedQR = result?.SignedQRCode || '';
      const success = ok && irn;

      // Log the attempt
      await base44.asServiceRole.entities.EInvoiceLog.create({
        invoice_id,
        invoice_number: invoice.invoice_number,
        action: 'generate_irn',
        status: success ? 'success' : 'failed',
        irn,
        ack_no: String(ackNo),
        ack_date: ackDate,
        request_payload: payload,
        response_payload: raw || {},
        error_message: success ? '' : (message || `Error ${errorCode}: IRN generation failed`),
        performed_by: user.email,
        performed_at: new Date().toISOString(),
      });

      if (success) {
        await base44.asServiceRole.entities.SalesInvoice.update(invoice_id, {
          irn,
          ack_number: String(ackNo),
          ack_date: ackDate,
          einvoice_status: 'generated',
        });
        return Response.json({ 
          success: true, 
          irn, 
          ack_number: ackNo, 
          ack_date: ackDate,
          signed_qr: signedQR,
          mode: GST_MODE,
        });
      }

      return Response.json({ 
        success: false, 
        error: message || `Error ${errorCode}: IRN generation failed`,
        error_code: errorCode,
        details: raw,
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // CANCEL IRN
    // ════════════════════════════════════════════════════════════════════════
    if (action === 'cancel_irn') {
      if (!invoice.irn) {
        return Response.json({ error: 'No IRN exists to cancel' }, { status: 400 });
      }

      const reasonText = body.cancel_reason || 'Cancelled';
      const reasonCode = EINV_CANCEL_REASONS[reasonText] || body.cancel_reason_code || '4';

      const cancelPayload = {
        Irn: invoice.irn,
        CnlRsn: reasonCode,         // STRING "1"-"4"
        CnlRem: sanitizeString(reasonText, 100),
      };

      const { ok, result, message, raw } = await callAdaequareAPI(
        EINVOICE_URL, 'POST', 'CANCELIRN', cancelPayload
      );

      const cancelDate = result?.CancelDate || result?.CnlDt || '';
      const success = ok || !!cancelDate;

      await base44.asServiceRole.entities.EInvoiceLog.create({
        invoice_id,
        invoice_number: invoice.invoice_number,
        action: 'cancel_irn',
        status: success ? 'success' : 'failed',
        irn: invoice.irn,
        cancel_reason: reasonText,
        request_payload: cancelPayload,
        response_payload: raw || {},
        error_message: success ? '' : (message || 'IRN cancellation failed'),
        performed_by: user.email,
        performed_at: new Date().toISOString(),
      });

      if (success) {
        await base44.asServiceRole.entities.SalesInvoice.update(invoice_id, {
          einvoice_status: 'cancelled',
        });
        return Response.json({ success: true, cancel_date: cancelDate });
      }

      return Response.json({ success: false, error: message || 'IRN cancellation failed', details: raw });
    }

    // ════════════════════════════════════════════════════════════════════════
    // GENERATE E-WAY BILL
    // ════════════════════════════════════════════════════════════════════════
    if (action === 'generate_ewb') {
      // Try IRN-linked EWB first if IRN exists, otherwise standalone
      if (invoice.irn) {
        // IRN-linked E-Way Bill (simpler payload)
        const irnEwbPayload = {
          Irn: invoice.irn,
          Distance: body.distance_km || invoice.distance || 0,
          TransMode: body.trans_mode || invoice.mode_of_transport || '1',
          TransId: body.transporter_id || invoice.transporter_id || '',
          TransName: body.transporter_name || invoice.transporter_name || order?.transporter || '',
          TransDocDt: formatDate(body.lr_date || invoice.lr_date || invoice.invoice_date),
          TransDocNo: body.lr_number || invoice.lr_number || '',
          VehNo: body.vehicle_no || invoice.vehicle_no || '',
          VehType: body.vehicle_type || 'R',
        };

        const { ok, result, message, raw } = await callAdaequareAPI(
          `${GSP_BASE}/enriched/ei/api/ewaybill`, 'POST', null, irnEwbPayload
        );

        const ewbNo = result?.EwbNo || result?.ewb_no || '';
        const ewbDate = result?.EwbDt || result?.ewb_dt || '';
        const validUpto = result?.EwbValidTill || result?.valid_upto || '';
        const success = ok && ewbNo;

        await base44.asServiceRole.entities.EWayBillLog.create({
          invoice_id,
          invoice_number: invoice.invoice_number,
          action: 'generate_ewb',
          status: success ? 'success' : 'failed',
          eway_bill_no: String(ewbNo),
          valid_upto: validUpto,
          ewb_status: success ? 'Active' : '',
          distance: body.distance_km || invoice.distance,
          transporter_id: body.transporter_id || invoice.transporter_id,
          transporter_name: body.transporter_name || invoice.transporter_name,
          vehicle_no: body.vehicle_no || invoice.vehicle_no,
          request_payload: irnEwbPayload,
          response_payload: raw || {},
          error_message: success ? '' : (message || 'E-Way Bill generation failed'),
          performed_by: user.email,
          performed_at: new Date().toISOString(),
        });

        if (success) {
          await base44.asServiceRole.entities.SalesInvoice.update(invoice_id, {
            eway_bill: String(ewbNo),
            eway_bill_date: ewbDate,
            eway_valid_upto: validUpto,
            ewb_status: 'generated',
            vehicle_no: body.vehicle_no || invoice.vehicle_no,
            transporter_id: body.transporter_id || invoice.transporter_id,
            transporter_name: body.transporter_name || invoice.transporter_name,
            distance: body.distance_km || invoice.distance,
          });
          return Response.json({ 
            success: true, 
            eway_bill: ewbNo, 
            eway_bill_date: ewbDate, 
            valid_upto: validUpto,
            mode: GST_MODE,
          });
        }

        return Response.json({ success: false, error: message || 'E-Way Bill generation failed', details: raw });
      }

      // Standalone E-Way Bill (without IRN)
      const vehicleInfo = {
        vehicle_no: body.vehicle_no || invoice.vehicle_no,
        transporter_id: body.transporter_id || invoice.transporter_id,
        transporter_name: body.transporter_name || invoice.transporter_name,
        trans_mode: body.trans_mode || invoice.mode_of_transport || '1',
        distance_km: body.distance_km || invoice.distance || 0,
        lr_number: body.lr_number || invoice.lr_number,
        lr_date: body.lr_date || invoice.lr_date,
        vehicle_type: body.vehicle_type || 'R',
      };

      const payload = buildEWayBillPayload(invoice, items, order, customer, vehicleInfo);

      const { ok, result, message, raw } = await callAdaequareAPI(
        EWAYAPI_URL, 'POST', 'GENEWAYBILL', payload
      );

      const ewbNo = result?.ewayBillNo || result?.EwbNo || '';
      const ewbDate = result?.ewayBillDate || result?.EwbDt || '';
      const validUpto = result?.validUpto || result?.EwbValidTill || '';
      const success = ok && ewbNo;

      await base44.asServiceRole.entities.EWayBillLog.create({
        invoice_id,
        invoice_number: invoice.invoice_number,
        action: 'generate_ewb',
        status: success ? 'success' : 'failed',
        eway_bill_no: String(ewbNo),
        valid_upto: validUpto,
        ewb_status: success ? 'Active' : '',
        distance: vehicleInfo.distance_km,
        transporter_id: vehicleInfo.transporter_id,
        transporter_name: vehicleInfo.transporter_name,
        vehicle_no: vehicleInfo.vehicle_no,
        request_payload: payload,
        response_payload: raw || {},
        error_message: success ? '' : (message || 'E-Way Bill generation failed'),
        performed_by: user.email,
        performed_at: new Date().toISOString(),
      });

      if (success) {
        await base44.asServiceRole.entities.SalesInvoice.update(invoice_id, {
          eway_bill: String(ewbNo),
          eway_bill_date: ewbDate,
          eway_valid_upto: validUpto,
          ewb_status: 'generated',
          vehicle_no: vehicleInfo.vehicle_no,
          transporter_id: vehicleInfo.transporter_id,
          transporter_name: vehicleInfo.transporter_name,
          distance: vehicleInfo.distance_km,
        });
        return Response.json({ 
          success: true, 
          eway_bill: ewbNo, 
          eway_bill_date: ewbDate, 
          valid_upto: validUpto,
          mode: GST_MODE,
        });
      }

      return Response.json({ success: false, error: message || 'E-Way Bill generation failed', details: raw });
    }

    // ════════════════════════════════════════════════════════════════════════
    // CANCEL E-WAY BILL
    // ════════════════════════════════════════════════════════════════════════
    if (action === 'cancel_ewb') {
      if (!invoice.eway_bill) {
        return Response.json({ error: 'No E-Way Bill exists to cancel' }, { status: 400 });
      }

      const reasonText = body.cancel_reason || 'Cancelled';
      const reasonCode = EWB_CANCEL_REASONS[reasonText] || parseInt(body.cancel_reason_code, 10) || 4;

      const cancelPayload = {
        ewbNo: parseInt(invoice.eway_bill, 10),  // INTEGER
        cancelRsnCode: reasonCode,                // INTEGER
        cancelRmrk: sanitizeString(reasonText, 100),
      };

      const { ok, result, message, raw } = await callAdaequareAPI(
        EWAYAPI_URL, 'POST', 'CANEWB', cancelPayload
      );

      const success = ok || result?.cancelDate || result?.ewayBillNo;

      await base44.asServiceRole.entities.EWayBillLog.create({
        invoice_id,
        invoice_number: invoice.invoice_number,
        action: 'cancel_ewb',
        status: success ? 'success' : 'failed',
        eway_bill_no: invoice.eway_bill,
        cancel_reason: reasonText,
        request_payload: cancelPayload,
        response_payload: raw || {},
        error_message: success ? '' : (message || 'E-Way Bill cancellation failed'),
        performed_by: user.email,
        performed_at: new Date().toISOString(),
      });

      if (success) {
        await base44.asServiceRole.entities.SalesInvoice.update(invoice_id, {
          ewb_status: 'cancelled',
        });
        return Response.json({ success: true });
      }

      return Response.json({ success: false, error: message || 'E-Way Bill cancellation failed', details: raw });
    }

    // ════════════════════════════════════════════════════════════════════════
    // UPDATE VEHICLE (Part-B)
    // ════════════════════════════════════════════════════════════════════════
    if (action === 'update_vehicle') {
      if (!invoice.eway_bill) {
        return Response.json({ error: 'No E-Way Bill exists' }, { status: 400 });
      }
      if (!body.vehicle_no) {
        return Response.json({ error: 'vehicle_no is required' }, { status: 400 });
      }

      const vehiclePayload = {
        ewbNo: parseInt(invoice.eway_bill, 10),
        vehicleNo: body.vehicle_no.toUpperCase().replace(/\s/g, ''),
        fromPlace: body.from_place || SELLER_CITY,
        fromState: parseInt(body.from_state || SELLER_STATE_CODE, 10),
        reasonCode: body.reason_code || '1',  // 1=Breakdown, 2=Transshipment, etc.
        reasonRem: body.reason_remark || 'Vehicle update',
        transDocNo: body.transport_doc_no || '',
        transDocDate: body.transport_doc_date || '',
        transMode: body.transport_mode || '1',
        vehicleType: body.vehicle_type || 'R',
      };

      const { ok, result, message, raw } = await callAdaequareAPI(
        EWAYAPI_URL, 'POST', 'VEHEWB', vehiclePayload
      );

      const success = ok && !raw?.errorDetails;
      const newValidUpto = result?.validUpto || result?.EwbValidTill || invoice.eway_valid_upto;

      // Log vehicle update
      await base44.asServiceRole.entities.EWayVehicleUpdate.create({
        invoice_id,
        eway_bill_no: invoice.eway_bill,
        vehicle_no: body.vehicle_no,
        from_place: vehiclePayload.fromPlace,
        from_state: String(vehiclePayload.fromState),
        transport_mode: vehiclePayload.transMode,
        transport_doc_no: vehiclePayload.transDocNo,
        transport_doc_date: vehiclePayload.transDocDate,
        reason_code: vehiclePayload.reasonCode,
        reason_remark: vehiclePayload.reasonRem,
        api_status: success ? 'success' : 'failed',
        response_payload: raw || {},
        performed_by: user.email,
        performed_at: new Date().toISOString(),
      });

      await base44.asServiceRole.entities.EWayBillLog.create({
        invoice_id,
        invoice_number: invoice.invoice_number,
        action: 'update_vehicle',
        status: success ? 'success' : 'failed',
        eway_bill_no: invoice.eway_bill,
        vehicle_no: body.vehicle_no,
        valid_upto: newValidUpto,
        request_payload: vehiclePayload,
        response_payload: raw || {},
        error_message: success ? '' : (message || 'Vehicle update failed'),
        performed_by: user.email,
        performed_at: new Date().toISOString(),
      });

      if (success) {
        await base44.asServiceRole.entities.SalesInvoice.update(invoice_id, {
          vehicle_no: body.vehicle_no,
          eway_valid_upto: newValidUpto,
        });
        return Response.json({ success: true, valid_upto: newValidUpto });
      }

      return Response.json({ success: false, error: message || 'Vehicle update failed', details: raw });
    }

    // ════════════════════════════════════════════════════════════════════════
    // UPDATE TRANSPORTER
    // ════════════════════════════════════════════════════════════════════════
    if (action === 'update_transporter') {
      if (!invoice.eway_bill) {
        return Response.json({ error: 'No E-Way Bill exists' }, { status: 400 });
      }
      if (!body.transporter_id) {
        return Response.json({ error: 'transporter_id (GSTIN) is required' }, { status: 400 });
      }

      const transporterPayload = {
        ewbNo: parseInt(invoice.eway_bill, 10),
        transporterId: body.transporter_id,
      };

      const { ok, message, raw } = await callAdaequareAPI(
        EWAYAPI_URL, 'POST', 'UPDATETRANSPORTER', transporterPayload
      );

      const success = ok && !raw?.errorDetails;

      await base44.asServiceRole.entities.EWayBillLog.create({
        invoice_id,
        invoice_number: invoice.invoice_number,
        action: 'update_transporter',
        status: success ? 'success' : 'failed',
        eway_bill_no: invoice.eway_bill,
        transporter_id: body.transporter_id,
        transporter_name: body.transporter_name || '',
        request_payload: transporterPayload,
        response_payload: raw || {},
        error_message: success ? '' : (message || 'Transporter update failed'),
        performed_by: user.email,
        performed_at: new Date().toISOString(),
      });

      if (success) {
        await base44.asServiceRole.entities.SalesInvoice.update(invoice_id, {
          transporter_id: body.transporter_id,
          transporter_name: body.transporter_name || invoice.transporter_name,
        });
        return Response.json({ success: true });
      }

      return Response.json({ success: false, error: message || 'Transporter update failed', details: raw });
    }

    // ════════════════════════════════════════════════════════════════════════
    // EXTEND VALIDITY
    // ════════════════════════════════════════════════════════════════════════
    if (action === 'extend_validity') {
      if (!invoice.eway_bill) {
        return Response.json({ error: 'No E-Way Bill exists' }, { status: 400 });
      }

      const extendPayload = {
        ewbNo: parseInt(invoice.eway_bill, 10),
        vehicleNo: body.vehicle_no || invoice.vehicle_no || '',
        fromPlace: body.from_place || SELLER_CITY,
        fromState: parseInt(body.from_state || SELLER_STATE_CODE, 10),
        remainingDistance: parseInt(body.remaining_distance || invoice.distance || 100, 10),
        transDocNo: body.transport_doc_no || '',
        transDocDate: body.transport_doc_date || '',
        transMode: body.transport_mode || '1',
        vehicleType: body.vehicle_type || 'R',
        extnRsnCode: parseInt(body.reason_code || '1', 10),  // 1=Natural Calamity, 2=Law & Order, etc.
        extnRemarks: body.reason_remark || 'Validity extension required',
        fromPincode: parseInt(body.from_pincode || SELLER_PIN, 10),
        consignmentStatus: body.consignment_status || 'M',  // M=In Movement, T=In Transit
        transitType: '',
      };

      const { ok, result, message, raw } = await callAdaequareAPI(
        EWAYAPI_URL, 'POST', 'EXTENDVALIDITY', extendPayload
      );

      const success = ok && !raw?.errorDetails;
      const newValidUpto = result?.validUpto || result?.EwbValidTill || '';

      await base44.asServiceRole.entities.EWayBillLog.create({
        invoice_id,
        invoice_number: invoice.invoice_number,
        action: 'extend_validity',
        status: success ? 'success' : 'failed',
        eway_bill_no: invoice.eway_bill,
        valid_upto: newValidUpto,
        extended_times: (invoice.eway_extended_times || 0) + (success ? 1 : 0),
        request_payload: extendPayload,
        response_payload: raw || {},
        error_message: success ? '' : (message || 'Validity extension failed'),
        performed_by: user.email,
        performed_at: new Date().toISOString(),
      });

      if (success) {
        await base44.asServiceRole.entities.SalesInvoice.update(invoice_id, {
          eway_valid_upto: newValidUpto,
          eway_extended_times: (invoice.eway_extended_times || 0) + 1,
        });
        return Response.json({ success: true, valid_upto: newValidUpto });
      }

      return Response.json({ success: false, error: message || 'Validity extension failed', details: raw });
    }

    // ════════════════════════════════════════════════════════════════════════
    // FETCH E-WAY BILL STATUS
    // ════════════════════════════════════════════════════════════════════════
    if (action === 'fetch_ewb_status') {
      if (!invoice.eway_bill) {
        return Response.json({ error: 'No E-Way Bill exists' }, { status: 400 });
      }

      const url = `${EWAYAPI_URL}?ewbNo=${invoice.eway_bill}`;
      const { ok, result, message, raw } = await callAdaequareAPI(url, 'GET', 'GETEWB');

      const ewbStatus = result?.status || result?.Status || '';
      const validUpto = result?.validUpto || result?.EwbValidTill || '';

      await base44.asServiceRole.entities.EWayBillLog.create({
        invoice_id,
        invoice_number: invoice.invoice_number,
        action: 'fetch_status',
        status: ok ? 'success' : 'failed',
        eway_bill_no: invoice.eway_bill,
        ewb_status: ewbStatus,
        valid_upto: validUpto,
        request_payload: { ewbNo: invoice.eway_bill },
        response_payload: raw || {},
        error_message: ok ? '' : (message || 'Status fetch failed'),
        performed_by: user.email,
        performed_at: new Date().toISOString(),
      });

      if (ok) {
        // Map status codes
        const statusMap = { 'CNL': 'cancelled', 'ACT': 'generated', 'EXP': 'expired' };
        const mappedStatus = statusMap[ewbStatus] || ewbStatus || invoice.ewb_status;
        
        await base44.asServiceRole.entities.SalesInvoice.update(invoice_id, {
          ewb_status: mappedStatus,
          eway_valid_upto: validUpto || invoice.eway_valid_upto,
        });
        
        return Response.json({ 
          success: true, 
          ewb_status: ewbStatus, 
          valid_upto: validUpto,
          ewb_no: invoice.eway_bill,
        });
      }

      return Response.json({ success: false, error: message || 'Status fetch failed', details: raw });
    }

    // ── Unknown Action ──
    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (error) {
    console.error('[gstCompliance] Error:', error.message, error.stack?.substring(0, 500));
    return Response.json({ error: error.message }, { status: 500 });
  }
});