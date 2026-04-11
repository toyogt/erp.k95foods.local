/**
 * GST Compliance Engine — E-Invoice (IRN) & E-Way Bill lifecycle
 * Direct NIC Standard API integration with RSA/AES encryption
 * Uses node-forge for PKCS1v15 RSA (WebCrypto doesn't support it)
 *
 * Actions:
 *   generate_irn     — Generate IRN via IRP
 *   cancel_irn       — Cancel IRN
 *   generate_ewb     — Generate E-Way Bill (requires IRN)
 *   cancel_ewb       — Cancel E-Way Bill
 *   update_vehicle    — Update vehicle info on E-Way Bill
 *   update_transporter — Update transporter on E-Way Bill
 *   extend_validity   — Extend E-Way Bill validity
 *   fetch_ewb_status  — Fetch latest E-Way Bill status from NIC
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import forge from 'npm:node-forge@1.3.1';

// ─── Seller Constants ────────────────────────────────────────────────
const SELLER_GSTIN = '06AAHCK7191E1ZF';
const SELLER_NAME  = 'K95 Foods Private Limited';
const SELLER_ADDR  = 'Plot No. V8, M.I.E , Part - B, Bahadurgarh';
const SELLER_CITY  = 'Bahadurgarh';
const SELLER_PIN   = 124507;
const SELLER_STATE = '06';

// ─── NIC Sandbox Endpoints ──────────────────────────────────────────
const NIC_BASE_AUTH    = 'https://einv-apisandbox.nic.in/eivital/v1.04';
const NIC_BASE_CORE    = 'https://einv-apisandbox.nic.in/eicore/v1.03';
const NIC_BASE_EWB     = 'https://einv-apisandbox.nic.in/eiewb/v1.03';
const NIC_BASE_EWBAPI  = 'https://einv-apisandbox.nic.in/ewaybillapi/v1.03';

// Fallback: alternate sandbox URL (einv1api.gstsandbox.nic.in)
const NIC_ALT_AUTH   = 'https://einv1api.gstsandbox.nic.in/eivital/v1.04';
const NIC_ALT_CORE   = 'https://einv1api.gstsandbox.nic.in/eicore/v1.03';
const NIC_ALT_EWB    = 'https://einv1api.gstsandbox.nic.in/eiewb/v1.03';

// ─── State-to-PIN mapping ───────────────────────────────────────────
const STATE_PIN = {
  '01':190001,'02':171001,'03':244001,'04':160017,'05':247001,'06':124001,
  '07':110001,'08':302001,'09':226001,'10':800001,'11':194101,'12':160001,
  '13':797001,'14':795001,'15':793001,'16':793001,'17':793001,'18':781001,
  '19':700001,'20':834001,'21':751001,'22':492001,'23':462001,'24':380001,
  '25':403001,'26':396001,'27':400001,'28':520001,'29':560001,'30':682001,
  '31':600001,'32':695001,'33':600001,'34':605001,'35':744101,'36':500001,
  '37':520001,'38':361001,'97':110001,
};

function stateCode(gstin) { return gstin?.substring(0, 2) || '07'; }
function defaultPin(sc) { return STATE_PIN[sc] || 110001; }
function fmtDate(d) { const dt = d ? new Date(d) : new Date(); return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`; }

// ─── Crypto Helpers (using node-forge) ──────────────────────────────

/**
 * RSA PKCS1v15 encrypt data with a PEM public key
 * Returns base64-encoded ciphertext
 */
function rsaEncrypt(plaintext, pemPublicKey) {
  const publicKey = forge.pki.publicKeyFromPem(pemPublicKey);
  const encrypted = publicKey.encrypt(plaintext, 'RSAES-PKCS1-V1_5');
  return forge.util.encode64(encrypted);
}

/**
 * AES-256-ECB encrypt data (used for request payloads)
 * Key must be a forge.util.ByteStringBuffer or raw bytes string
 * Returns base64-encoded ciphertext
 */
function aesEncrypt(plaintext, keyBytes) {
  const cipher = forge.cipher.createCipher('AES-ECB', keyBytes);
  cipher.start();
  cipher.update(forge.util.createBuffer(plaintext, 'utf8'));
  cipher.finish();
  return forge.util.encode64(cipher.output.getBytes());
}

/**
 * AES-256-ECB decrypt data
 * Input is base64-encoded ciphertext, key is raw bytes
 * Returns decrypted string
 */
function aesDecrypt(base64Ciphertext, keyBytes) {
  const encrypted = forge.util.decode64(base64Ciphertext);
  const decipher = forge.cipher.createDecipher('AES-ECB', keyBytes);
  decipher.start();
  decipher.update(forge.util.createBuffer(encrypted));
  decipher.finish();
  return decipher.output.toString('utf8');
}

/**
 * Generate a random 32-character hex AppKey
 */
function generateAppKey() {
  return forge.util.bytesToHex(forge.random.getBytesSync(16));
}

// ─── Session Cache (in-memory, per cold start) ──────────────────────
let sessionCache = {
  authToken: null,
  decryptedSek: null,  // raw bytes (forge ByteStringBuffer-compatible)
  expiry: null,
  appKey: null,         // 32-char hex string used for this session
};

function isSessionValid() {
  return sessionCache.authToken && sessionCache.decryptedSek && sessionCache.expiry && Date.now() < sessionCache.expiry;
}

// ─── NIC Public Key ─────────────────────────────────────────────────
// NIC sandbox public key (RSA 2048-bit)
// This is fetched once from NIC and cached. For sandbox, we use the well-known key.
let nicPublicKeyPEM = null;

async function getNicPublicKey() {
  if (nicPublicKeyPEM) return nicPublicKeyPEM;

  const clientId = Deno.env.get('ADAEQUARE_APP_KEY') || '';
  const clientSecret = Deno.env.get('ADAEQUARE_CLIENT_SECRET') || '';
  const gstin = Deno.env.get('ADAEQUARE_GSTIN') || SELLER_GSTIN;

  // Try fetching from NIC sandbox endpoint
  const urls = [
    `${NIC_ALT_AUTH}/Master/GetPublicKey`,
    `${NIC_BASE_AUTH}/Master/GetPublicKey`,
  ];

  for (const url of urls) {
    try {
      console.log('Fetching public key from:', url);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const username = Deno.env.get('ADAEQUARE_USERNAME') || '';
      const resp = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'client_id': clientId,
          'client_secret': clientSecret,
          'Gstin': gstin,
          'user_name': username,
        },
      });
      clearTimeout(timeoutId);
      const text = await resp.text();
      console.log('Public key response status:', resp.status, 'body:', text.substring(0, 500));
      if (resp.ok) {
        let parsed;
        try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
        // Response could be {Status:1, Data:"PEM"} or plain PEM
        let key = parsed?.Data || parsed?.data || parsed?.result || text;
        if (typeof key === 'string') {
          key = key.trim();
          if (key.includes('PUBLIC KEY')) {
            nicPublicKeyPEM = key;
            return nicPublicKeyPEM;
          }
          // May be raw base64 without PEM headers
          if (key.length > 100 && !key.includes(' ')) {
            nicPublicKeyPEM = `-----BEGIN PUBLIC KEY-----\n${key}\n-----END PUBLIC KEY-----`;
            return nicPublicKeyPEM;
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch public key from', url, ':', e.message);
    }
  }

  // Fallback: well-known NIC sandbox public key
  console.warn('Using hardcoded fallback NIC public key');
  nicPublicKeyPEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArxd93uLDs8HTPqcSPpxZ
rf0Dc29r3iPp0a8fFPGkJBWVGMlPe32EBJ0gpt4FibdqMEH8hFNJ4MxMEVLSXEDE
FHWKA4wh9jRahBQ8URRAS1JmhDSmr0PEbIMEdMxFD0ARAJ9EUw+KbDAoJ8o2tr7Z
VAt3Gms5rWUMjLsBTTDkrDYEW1cUwQOYSBP6I3YB+1BbEDi9Bvfh3AXXA2IdTmOH
VFNFA6PmYMnIVXYRWnbBg6slpIwfGfNpGblJtIJ7M1MONaF4JLrwiDBi2VjzTHbk
mWW/JMlvQP7VpLBXRkY/GqJEiDIGIMDhDjDMSEB9Kc0T20JvpNa9jfxxJPPqJBei
CQIDAQAB
-----END PUBLIC KEY-----`;
  return nicPublicKeyPEM;
}

// ─── Authentication ─────────────────────────────────────────────────
async function authenticate() {
  if (isSessionValid()) return;

  const clientId = Deno.env.get('ADAEQUARE_APP_KEY') || '';
  const clientSecret = Deno.env.get('ADAEQUARE_CLIENT_SECRET') || '';
  const gstin = Deno.env.get('ADAEQUARE_GSTIN') || SELLER_GSTIN;
  const username = Deno.env.get('ADAEQUARE_USERNAME') || '';
  const password = Deno.env.get('ADAEQUARE_PASSWORD') || '';

  if (!clientId || !clientSecret || !username || !password) {
    throw new Error('Missing NIC API credentials. Please set ADAEQUARE_APP_KEY (client_id), ADAEQUARE_CLIENT_SECRET, ADAEQUARE_USERNAME, ADAEQUARE_PASSWORD.');
  }

  const publicKey = await getNicPublicKey();

  // Generate a fresh 32-char app key for this session
  const appKey = generateAppKey();

  // Build auth request body
  const authData = JSON.stringify({
    UserName: username,
    Password: password,
    AppKey: appKey,
    ForceRefreshAccessToken: false,
  });

  // Encrypt: base64(authData) → RSA PKCS1v15 encrypt → base64
  const base64AuthData = forge.util.encode64(authData);
  const encryptedData = rsaEncrypt(base64AuthData, publicKey);

  // Log encryption details for debugging
  console.log('AppKey (32 chars):', appKey.length, 'chars');
  console.log('Auth JSON length:', authData.length);
  console.log('Base64 auth length:', base64AuthData.length);
  console.log('Encrypted data length:', encryptedData.length);
  console.log('Public key starts with:', publicKey.substring(0, 50));

  // Try both NIC sandbox URLs
  const authUrls = [`${NIC_BASE_AUTH}/auth`, `${NIC_ALT_AUTH}/auth`];
  let lastError = null;

  for (const authUrl of authUrls) {
    try {
      console.log('Trying auth URL:', authUrl);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      const resp = await fetch(authUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'client_id': clientId,
          'client_secret': clientSecret,
          'Gstin': gstin,
          'user_name': username,
        },
        body: JSON.stringify({ Data: encryptedData }),
      });
      clearTimeout(timeoutId);

      const respText = await resp.text();
      console.log('Auth response status:', resp.status, 'body:', respText.substring(0, 1000));
      let result;
      try { result = JSON.parse(respText); } catch { result = { raw: respText }; }

      // NIC Standard API response: {Status: 1, Data: {AuthToken, Sek}} or {Status: 1, AuthToken, Sek}
      const data = result.Data || result;
      const authToken = data.AuthToken || data.authToken;
      const encryptedSek = data.Sek || data.sek;

      if (!authToken || !encryptedSek) {
        console.error('Auth missing token/sek. Full response:', JSON.stringify(result).substring(0, 1000));
        lastError = result.ErrorDetails?.[0]?.ErrorMessage || result.error?.message || result.message || result.Message || 'Authentication failed - no token received';
        continue;
      }

      // Decrypt SEK using AES-256-ECB with the raw AppKey bytes
      // AppKey is 32 hex chars = 16 bytes when decoded from hex, but NIC expects 32-byte key
      // Actually, AppKey is base64-decoded for AES key per India Compliance code:
      //   app_key = base64.b64encode(self.app_key.encode()).decode()
      //   self.session_key = aes_decrypt_data(sek_data, base64.b64decode(app_key.encode()))
      // So: app_key is 32 chars → base64 encode → then base64 decode = original 32 chars as bytes
      const appKeyBytes = forge.util.createBuffer(appKey, 'utf8').getBytes();
      const decryptedSek = aesDecrypt(encryptedSek, appKeyBytes);

      // Store session
      sessionCache = {
        authToken,
        decryptedSek,  // this is the raw decrypted bytes
        expiry: Date.now() + (5 * 60 * 60 * 1000), // 5 hours (NIC allows 6, we use 5 for safety)
        appKey,
      };

      console.log('NIC auth successful, token obtained');
      return;
    } catch (e) {
      console.error('Auth attempt failed for', authUrl, ':', e.message, e.stack?.substring(0, 300));
      lastError = e.message;
    }
  }

  throw new Error(`NIC authentication failed: ${lastError}`);
}

// ─── API Call Helper ────────────────────────────────────────────────
async function callNIC(baseUrl, altBaseUrl, endpoint, method, payload) {
  await authenticate();

  const clientId = Deno.env.get('ADAEQUARE_APP_KEY') || '';
  const clientSecret = Deno.env.get('ADAEQUARE_CLIENT_SECRET') || '';
  const gstin = Deno.env.get('ADAEQUARE_GSTIN') || SELLER_GSTIN;
  const username = Deno.env.get('ADAEQUARE_USERNAME') || '';

  const commonHeaders = {
    'Content-Type': 'application/json',
    'client_id': clientId,
    'client_secret': clientSecret,
    'Gstin': gstin,
    'user_name': username,
    'AuthToken': sessionCache.authToken,
  };

  // Encrypt payload with decrypted SEK
  let body = undefined;
  if (payload && method === 'POST') {
    const jsonStr = JSON.stringify(payload);
    const encryptedPayload = aesEncrypt(jsonStr, sessionCache.decryptedSek);
    body = JSON.stringify({ Data: encryptedPayload });
  }

  // Try primary URL, then alternate
  const urls = [`${baseUrl}/${endpoint}`, altBaseUrl ? `${altBaseUrl}/${endpoint}` : null].filter(Boolean);
  let lastError = null;

  for (const url of urls) {
    try {
      const opts = { method, headers: commonHeaders };
      if (body) opts.body = body;

      console.log(`Calling NIC: ${method} ${url}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      opts.signal = controller.signal;
      const resp = await fetch(url, opts);
      clearTimeout(timeoutId);
      const result = await resp.json();

      console.log('NIC response status:', resp.status, 'Status field:', result.Status);

      // Check for auth token expiry (error code 1005)
      if (result.Status === 0 && result.ErrorDetails?.some(e => e.ErrorCode === '1005')) {
        console.log('Token expired, re-authenticating...');
        sessionCache.authToken = null;
        await authenticate();
        // Retry once
        opts.headers.AuthToken = sessionCache.authToken;
        if (payload && method === 'POST') {
          const jsonStr2 = JSON.stringify(payload);
          const enc2 = aesEncrypt(jsonStr2, sessionCache.decryptedSek);
          opts.body = JSON.stringify({ Data: enc2 });
        }
        const resp2 = await fetch(url, opts);
        const result2 = await resp2.json();
        return decryptNICResponse(result2, resp2.ok);
      }

      return decryptNICResponse(result, resp.ok);
    } catch (e) {
      console.error('NIC call failed for', url, ':', e.message);
      lastError = e.message;
    }
  }

  return { ok: false, result: { message: `NIC API call failed: ${lastError}` } };
}

function decryptNICResponse(result, httpOk) {
  // NIC Standard API response format:
  // Success: {Status: 1, Data: "encrypted_base64", InfoDtls: [...]}
  // Error:   {Status: 0, ErrorDetails: [{ErrorCode, ErrorMessage}]}
  
  const isSuccess = result.Status === 1;

  if (isSuccess && result.Data && typeof result.Data === 'string' && sessionCache.decryptedSek) {
    try {
      // If there's a Rek (random encryption key), decrypt it first with SEK, then decrypt Data with Rek
      let decryptionKey = sessionCache.decryptedSek;
      
      if (result.Rek) {
        const decryptedRek = aesDecrypt(result.Rek, sessionCache.decryptedSek);
        decryptionKey = decryptedRek;
      }

      const decryptedData = aesDecrypt(result.Data, decryptionKey);
      const parsed = JSON.parse(decryptedData);
      return { ok: true, result: parsed };
    } catch (e) {
      console.error('Failed to decrypt NIC response:', e.message);
      // Return raw if decryption fails
      return { ok: httpOk, result };
    }
  }

  if (!isSuccess && result.ErrorDetails?.length > 0) {
    const errorMsg = result.ErrorDetails.map(e => `${e.ErrorCode}: ${e.ErrorMessage}`).join('; ');
    return { ok: false, result: { ...result, message: errorMsg } };
  }

  // For enriched/passthrough responses (no encryption)
  return { ok: httpOk && isSuccess !== false, result };
}

// ─── Payload Builders ───────────────────────────────────────────────
function buildIRNPayload(invoice, items, order) {
  const buyerGstin = invoice.customer_gstin || order?.customer_gstin || 'URP';
  const buyerState = stateCode(buyerGstin);
  const isInter = buyerState !== SELLER_STATE;

  const lineItems = (invoice.items && invoice.items.length > 0) ? invoice.items : items;

  const itemList = lineItems.map((item, idx) => {
    const rate = item.price || item.unit_base_cost || item.rate_snapshot || 0;
    const qty = item.quantity || 0;
    const taxable = item.taxable_amount || parseFloat((rate * qty).toFixed(2));
    const gstRate = item.igst_rate || item.cgst_rate * 2 || 40;

    return {
      SlNo: String(idx + 1),
      PrdDesc: item.item_name || item.description || '',
      IsServc: 'N',
      HsnCd: item.hsn_code || '22029990',
      Qty: qty,
      Unit: item.unit || 'NOS',
      UnitPrice: rate,
      TotAmt: taxable,
      Discount: 0,
      AssAmt: taxable,
      GstRt: gstRate,
      IgstAmt: isInter ? parseFloat((item.igst_amount || taxable * gstRate / 100).toFixed(2)) : 0,
      CgstAmt: !isInter ? parseFloat((item.cgst_amount || taxable * gstRate / 200).toFixed(2)) : 0,
      SgstAmt: !isInter ? parseFloat((item.sgst_amount || taxable * gstRate / 200).toFixed(2)) : 0,
      CesRt: 0, CesAmt: 0,
      TotItemVal: parseFloat((taxable + (taxable * gstRate / 100)).toFixed(2)),
    };
  });

  const taxableAmt = parseFloat(itemList.reduce((s, i) => s + i.AssAmt, 0).toFixed(2));
  const igstTotal = parseFloat(itemList.reduce((s, i) => s + i.IgstAmt, 0).toFixed(2));
  const cgstTotal = parseFloat(itemList.reduce((s, i) => s + i.CgstAmt, 0).toFixed(2));
  const sgstTotal = parseFloat(itemList.reduce((s, i) => s + i.SgstAmt, 0).toFixed(2));
  const grandTotal = parseFloat((invoice.total_invoice_value || invoice.total_amount || (taxableAmt + igstTotal + cgstTotal + sgstTotal)).toFixed(2));

  return {
    Version: '1.1',
    TranDtls: { TaxSch: 'GST', SupTyp: 'B2B', RegRev: 'N', IgstOnIntra: 'N' },
    DocDtls: { Typ: 'INV', No: invoice.invoice_number, Dt: fmtDate(invoice.invoice_date) },
    SellerDtls: { Gstin: SELLER_GSTIN, TradNm: SELLER_NAME, LglNm: SELLER_NAME, Addr1: SELLER_ADDR, Loc: SELLER_CITY, Pin: SELLER_PIN, Stcd: SELLER_STATE },
    BuyerDtls: {
      Gstin: buyerGstin,
      TradNm: invoice.customer_name || order?.customer_name || '',
      LglNm: invoice.customer_name || order?.customer_name || '',
      Pos: buyerState,
      Addr1: (invoice.billing_address || invoice.shipping_address || 'Address Not Available').substring(0, 100),
      Loc: (invoice.customer_name || 'NA').substring(0, 50),
      Pin: defaultPin(buyerState),
      Stcd: buyerState,
    },
    ItemList: itemList,
    ValDtls: { AssVal: taxableAmt, IgstVal: igstTotal, CgstVal: cgstTotal, SgstVal: sgstTotal, CesVal: 0, StCesVal: 0, Discount: 0, OthChrg: 0, RndOffAmt: 0, TotInvVal: grandTotal, TotInvValFc: 0 },
  };
}

// ─── Main Handler ───────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, invoice_id } = body;
    if (!action || !invoice_id) return Response.json({ error: 'action and invoice_id required' }, { status: 400 });

    // Validate credentials are set
    if (!Deno.env.get('ADAEQUARE_APP_KEY') || !Deno.env.get('ADAEQUARE_CLIENT_SECRET')) {
      return Response.json({ error: 'NIC API credentials not configured. Please set ADAEQUARE_APP_KEY (client_id) and ADAEQUARE_CLIENT_SECRET.' }, { status: 500 });
    }

    const invoices = await base44.asServiceRole.entities.SalesInvoice.filter({ id: invoice_id });
    const invoice = invoices[0];
    if (!invoice) return Response.json({ error: 'Invoice not found' }, { status: 404 });

    const items = invoice.sales_order_id
      ? await base44.asServiceRole.entities.SalesOrderItem.filter({ sales_order_id: invoice.sales_order_id })
      : [];
    const orders = invoice.sales_order_id
      ? await base44.asServiceRole.entities.SalesOrder.filter({ id: invoice.sales_order_id })
      : [];
    const order = orders[0];

    // ── GENERATE IRN ──
    if (action === 'generate_irn') {
      const payload = buildIRNPayload(invoice, items, order);
      const { ok, result } = await callNIC(NIC_BASE_CORE, NIC_ALT_CORE, 'Invoice', 'POST', payload);

      const success = ok && (result?.Irn || result?.irn);
      const irn = result?.Irn || result?.irn;
      const ackNo = result?.AckNo || result?.ack_no;
      const ackDate = result?.AckDt || result?.ack_dt;

      await base44.asServiceRole.entities.EInvoiceLog.create({
        invoice_id, invoice_number: invoice.invoice_number,
        action: 'generate_irn', status: success ? 'success' : 'failed',
        irn: irn || '', ack_no: String(ackNo || ''), ack_date: ackDate || '',
        request_payload: payload, response_payload: result || {},
        error_message: success ? '' : (result?.message || result?.Message || 'API error'),
        performed_by: user.email, performed_at: new Date().toISOString(),
      });

      if (success) {
        await base44.asServiceRole.entities.SalesInvoice.update(invoice_id, {
          irn, ack_number: String(ackNo || ''), ack_date: ackDate || '',
          einvoice_status: 'generated',
        });
        return Response.json({ success: true, irn, ack_number: ackNo, ack_date: ackDate });
      }
      return Response.json({ success: false, error: result?.message || result?.Message || 'IRN generation failed', details: result });
    }

    // ── CANCEL IRN ──
    if (action === 'cancel_irn') {
      if (!invoice.irn) return Response.json({ error: 'No IRN to cancel' }, { status: 400 });
      const cancelPayload = { Irn: invoice.irn, CnlRsn: body.cancel_reason_code || '1', CnlRem: body.cancel_reason || 'Cancelled' };
      const { ok, result } = await callNIC(NIC_BASE_CORE, NIC_ALT_CORE, 'Invoice/Cancel', 'POST', cancelPayload);
      const success = ok && result?.success !== false && !result?.ErrorDetails;

      await base44.asServiceRole.entities.EInvoiceLog.create({
        invoice_id, invoice_number: invoice.invoice_number,
        action: 'cancel_irn', status: success ? 'success' : 'failed',
        irn: invoice.irn, cancel_reason: body.cancel_reason || '',
        request_payload: cancelPayload, response_payload: result || {},
        error_message: success ? '' : (result?.message || 'Cancel failed'),
        performed_by: user.email, performed_at: new Date().toISOString(),
      });

      if (success) {
        await base44.asServiceRole.entities.SalesInvoice.update(invoice_id, { einvoice_status: 'cancelled' });
        return Response.json({ success: true });
      }
      return Response.json({ success: false, error: result?.message || 'Cancel failed', details: result });
    }

    // ── GENERATE E-WAY BILL ──
    if (action === 'generate_ewb') {
      if (!invoice.irn) return Response.json({ error: 'IRN is mandatory before generating E-Way Bill' }, { status: 400 });

      const ewbPayload = {
        Irn: invoice.irn,
        Distance: body.distance_km || invoice.distance || 0,
        TransMode: invoice.mode_of_transport || '1',
        TransId: invoice.transporter_id || '',
        TransName: invoice.transporter_name || order?.transporter || '',
        TransDocNo: invoice.lr_number || '',
        TransDocDt: fmtDate(invoice.lr_date || invoice.invoice_date),
        VehNo: invoice.vehicle_no || '',
        VehType: 'R',
      };

      const { ok, result } = await callNIC(NIC_BASE_EWB, NIC_ALT_EWB, 'ewaybill', 'POST', ewbPayload);
      const success = ok && (result?.EwbNo || result?.ewb_no);
      const ewbNo = result?.EwbNo || result?.ewb_no;
      const ewbDate = result?.EwbDt || new Date().toISOString();
      const validUpto = result?.EwbValidTill || result?.valid_upto || '';

      await base44.asServiceRole.entities.EWayBillLog.create({
        invoice_id, invoice_number: invoice.invoice_number,
        action: 'generate_ewb', status: success ? 'success' : 'failed',
        eway_bill_no: String(ewbNo || ''), valid_upto: validUpto,
        ewb_status: success ? 'Active' : '', distance: body.distance_km || invoice.distance,
        transporter_id: invoice.transporter_id, transporter_name: invoice.transporter_name,
        vehicle_no: invoice.vehicle_no,
        request_payload: ewbPayload, response_payload: result || {},
        error_message: success ? '' : (result?.message || 'EWB generation failed'),
        performed_by: user.email, performed_at: new Date().toISOString(),
      });

      if (success) {
        await base44.asServiceRole.entities.SalesInvoice.update(invoice_id, {
          eway_bill: String(ewbNo || ''), eway_bill_date: ewbDate,
          eway_valid_upto: validUpto, ewb_status: 'generated',
        });
        return Response.json({ success: true, eway_bill: ewbNo, eway_bill_date: ewbDate, valid_upto: validUpto });
      }
      return Response.json({ success: false, error: result?.message || 'EWB generation failed', details: result });
    }

    // ── CANCEL E-WAY BILL ──
    if (action === 'cancel_ewb') {
      if (!invoice.eway_bill) return Response.json({ error: 'No E-Way Bill to cancel' }, { status: 400 });
      const cancelPayload = { ewbNo: parseInt(invoice.eway_bill), cancelRsnCode: parseInt(body.cancel_reason_code) || 2, cancelRmrk: body.cancel_reason || 'Cancelled' };
      const { ok, result } = await callNIC(NIC_BASE_EWBAPI, null, 'ewayapi', 'POST', cancelPayload);
      const success = ok && result?.success !== false && !result?.ErrorDetails;

      await base44.asServiceRole.entities.EWayBillLog.create({
        invoice_id, invoice_number: invoice.invoice_number,
        action: 'cancel_ewb', status: success ? 'success' : 'failed',
        eway_bill_no: invoice.eway_bill, cancel_reason: body.cancel_reason || '',
        request_payload: cancelPayload, response_payload: result || {},
        error_message: success ? '' : (result?.message || 'Cancel failed'),
        performed_by: user.email, performed_at: new Date().toISOString(),
      });

      if (success) {
        await base44.asServiceRole.entities.SalesInvoice.update(invoice_id, { ewb_status: 'cancelled' });
        return Response.json({ success: true });
      }
      return Response.json({ success: false, error: result?.message || 'EWB cancel failed', details: result });
    }

    // ── UPDATE VEHICLE ──
    if (action === 'update_vehicle') {
      if (!invoice.eway_bill) return Response.json({ error: 'No E-Way Bill exists' }, { status: 400 });
      const vehPayload = {
        ewbNo: parseInt(invoice.eway_bill),
        vehicleNo: body.vehicle_no,
        fromPlace: body.from_place || SELLER_CITY,
        fromState: parseInt(body.from_state || SELLER_STATE),
        reasonCode: body.reason_code || '1',
        reasonRem: body.reason_remark || 'Vehicle update',
        transDocNo: body.transport_doc_no || '',
        transDocDt: body.transport_doc_date || '',
        transMode: body.transport_mode || '1',
        vehicleType: 'R',
      };

      const { ok, result } = await callNIC(NIC_BASE_EWBAPI, null, 'ewayapi', 'POST', vehPayload);
      const success = ok && result?.success !== false && !result?.ErrorDetails;

      await base44.asServiceRole.entities.EWayVehicleUpdate.create({
        invoice_id, eway_bill_no: invoice.eway_bill,
        vehicle_no: body.vehicle_no, from_place: body.from_place || SELLER_CITY,
        from_state: body.from_state || SELLER_STATE, transport_mode: body.transport_mode || '1',
        transport_doc_no: body.transport_doc_no || '', transport_doc_date: body.transport_doc_date || '',
        reason_code: body.reason_code || '1', reason_remark: body.reason_remark || '',
        api_status: success ? 'success' : 'failed', response_payload: result || {},
        performed_by: user.email, performed_at: new Date().toISOString(),
      });

      await base44.asServiceRole.entities.EWayBillLog.create({
        invoice_id, invoice_number: invoice.invoice_number,
        action: 'update_vehicle', status: success ? 'success' : 'failed',
        eway_bill_no: invoice.eway_bill, vehicle_no: body.vehicle_no,
        request_payload: vehPayload, response_payload: result || {},
        error_message: success ? '' : (result?.message || 'Vehicle update failed'),
        performed_by: user.email, performed_at: new Date().toISOString(),
      });

      if (success) {
        await base44.asServiceRole.entities.SalesInvoice.update(invoice_id, { vehicle_no: body.vehicle_no });
        return Response.json({ success: true });
      }
      return Response.json({ success: false, error: result?.message || 'Vehicle update failed', details: result });
    }

    // ── UPDATE TRANSPORTER ──
    if (action === 'update_transporter') {
      if (!invoice.eway_bill) return Response.json({ error: 'No E-Way Bill exists' }, { status: 400 });
      const transPayload = {
        ewbNo: parseInt(invoice.eway_bill),
        transporterId: body.transporter_id,
      };
      const { ok, result } = await callNIC(NIC_BASE_EWBAPI, null, 'ewayapi', 'POST', transPayload);
      const success = ok && result?.success !== false && !result?.ErrorDetails;

      await base44.asServiceRole.entities.EWayBillLog.create({
        invoice_id, invoice_number: invoice.invoice_number,
        action: 'update_transporter', status: success ? 'success' : 'failed',
        eway_bill_no: invoice.eway_bill,
        transporter_id: body.transporter_id, transporter_name: body.transporter_name || '',
        request_payload: transPayload, response_payload: result || {},
        error_message: success ? '' : (result?.message || 'Transporter update failed'),
        performed_by: user.email, performed_at: new Date().toISOString(),
      });

      if (success) {
        await base44.asServiceRole.entities.SalesInvoice.update(invoice_id, {
          transporter_id: body.transporter_id,
          transporter_name: body.transporter_name || invoice.transporter_name,
        });
        return Response.json({ success: true });
      }
      return Response.json({ success: false, error: result?.message || 'Transporter update failed' });
    }

    // ── EXTEND VALIDITY ──
    if (action === 'extend_validity') {
      if (!invoice.eway_bill) return Response.json({ error: 'No E-Way Bill exists' }, { status: 400 });
      const extPayload = {
        ewbNo: parseInt(invoice.eway_bill),
        vehicleNo: invoice.vehicle_no || body.vehicle_no || '',
        fromPlace: body.from_place || SELLER_CITY,
        fromState: parseInt(body.from_state || SELLER_STATE),
        remainingDistance: body.remaining_distance || invoice.distance || 0,
        transDocNo: body.transport_doc_no || '',
        transDocDt: body.transport_doc_date || '',
        transMode: body.transport_mode || '1',
        extnRsnCode: body.reason_code || '1',
        extnRemarks: body.reason_remark || 'Validity extension',
        fromPincode: parseInt(body.from_pincode || SELLER_PIN),
        consignmentStatus: 'M',
        transitType: '',
        addressLine1: body.address || SELLER_ADDR,
        addressLine2: '',
        addressLine3: '',
      };

      const { ok, result } = await callNIC(NIC_BASE_EWBAPI, null, 'ewayapi', 'POST', extPayload);
      const success = ok && result?.success !== false && !result?.ErrorDetails;
      const newValidUpto = result?.validUpto || result?.EwbValidTill || '';

      await base44.asServiceRole.entities.EWayBillLog.create({
        invoice_id, invoice_number: invoice.invoice_number,
        action: 'extend_validity', status: success ? 'success' : 'failed',
        eway_bill_no: invoice.eway_bill, valid_upto: newValidUpto,
        extended_times: (invoice.eway_extended_times || 0) + 1,
        request_payload: extPayload, response_payload: result || {},
        error_message: success ? '' : (result?.message || 'Extension failed'),
        performed_by: user.email, performed_at: new Date().toISOString(),
      });

      if (success) {
        await base44.asServiceRole.entities.SalesInvoice.update(invoice_id, {
          eway_valid_upto: newValidUpto,
          eway_extended_times: (invoice.eway_extended_times || 0) + 1,
        });
        return Response.json({ success: true, valid_upto: newValidUpto });
      }
      return Response.json({ success: false, error: result?.message || 'Extension failed' });
    }

    // ── FETCH E-WAY BILL STATUS ──
    if (action === 'fetch_ewb_status') {
      if (!invoice.eway_bill) return Response.json({ error: 'No E-Way Bill exists' }, { status: 400 });
      // GET request - no payload encryption needed, but we still need auth
      await authenticate();

      const clientId = Deno.env.get('ADAEQUARE_APP_KEY') || '';
      const clientSecret = Deno.env.get('ADAEQUARE_CLIENT_SECRET') || '';
      const gstin = Deno.env.get('ADAEQUARE_GSTIN') || SELLER_GSTIN;
      const username = Deno.env.get('ADAEQUARE_USERNAME') || '';

      const urls = [
        `${NIC_BASE_EWB}/ewaybill/irn/${invoice.eway_bill}`,
        `${NIC_ALT_EWB}/ewaybill/irn/${invoice.eway_bill}`,
      ];

      let fetchResult = null;
      for (const url of urls) {
        try {
          const resp = await fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'client_id': clientId,
              'client_secret': clientSecret,
              'Gstin': gstin,
              'user_name': username,
              'AuthToken': sessionCache.authToken,
            },
          });
          const result = await resp.json();
          fetchResult = decryptNICResponse(result, resp.ok);
          if (fetchResult.ok) break;
        } catch (_e) {
          // try next
        }
      }

      if (!fetchResult) fetchResult = { ok: false, result: {} };
      const { ok, result } = fetchResult;

      const ewbStatus = result?.status || result?.Status || '';
      const validUpto = result?.validUpto || result?.EwbValidTill || '';

      await base44.asServiceRole.entities.EWayBillLog.create({
        invoice_id, invoice_number: invoice.invoice_number,
        action: 'fetch_status', status: ok ? 'success' : 'failed',
        eway_bill_no: invoice.eway_bill, ewb_status: ewbStatus, valid_upto: validUpto,
        request_payload: { ewbNo: invoice.eway_bill }, response_payload: result || {},
        error_message: ok ? '' : 'Fetch failed',
        performed_by: user.email, performed_at: new Date().toISOString(),
      });

      if (ok) {
        const statusMap = { 'CNL': 'cancelled', 'ACT': 'generated', 'EXP': 'expired' };
        const mappedStatus = statusMap[ewbStatus] || invoice.ewb_status;
        await base44.asServiceRole.entities.SalesInvoice.update(invoice_id, {
          ewb_status: mappedStatus, eway_valid_upto: validUpto,
        });
        return Response.json({ success: true, ewb_status: ewbStatus, valid_upto: validUpto, raw: result });
      }
      return Response.json({ success: false, error: 'Status fetch failed' });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('gstCompliance error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});