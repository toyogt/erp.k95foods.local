/**
 * E-Invoice (IRN) and E-Way Bill Generation
 * via India Compliance ASP (asp.resilient.tech) → Adaequare GSP → NIC
 *
 * Uses the "Enriched" API path — no AES encryption required,
 * credentials passed as request headers, GSP handles crypto.
 *
 * Actions:
 *   generate_irn   — Generate IRN
 *   generate_eway  — Generate E-Way Bill (requires IRN)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const SELLER_GSTIN = '06AAHCK7191E1ZF';
const SELLER_NAME  = 'K95 Foods Private Limited';
const SELLER_ADDR  = 'Plot No. V8, M.I.E , Part - B, Bahadurgarh';
const SELLER_CITY  = 'Bahadurgarh';
const SELLER_PIN   = 124507;
const SELLER_STATE = '06';

const ASP_BASE_URL_LIVE    = 'https://asp.resilient.tech/ei/api';
const ASP_BASE_URL_SANDBOX = 'https://asp.resilient.tech/test/ei/api';

// Adaequare GSP sandbox test credentials (public, used by India Compliance)
const SANDBOX_GSTIN    = '02AMBPG7773M002';
const SANDBOX_USERNAME = 'adqgsphpusr1';
const SANDBOX_PASSWORD = 'Gsp@1234';

function getStateCode(gstin) {
  return gstin?.substring(0, 2) || '07';
}

function formatDate(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const dd   = String(d.getDate()).padStart(2, '0');
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function generateRequestId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'IC';
  for (let i = 0; i < 10; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

function buildInvoicePayload(invoice, items, order) {
  const buyerGstin   = invoice.customer_gstin || order?.customer_gstin || 'URP';
  const buyerState   = getStateCode(buyerGstin);
  const isInterState = buyerState !== SELLER_STATE;

  const itemList = items.map((item, idx) => {
    const rate        = item.unit_base_cost || item.rate_snapshot || 0;
    const qty         = item.quantity || 0;
    const taxableVal  = item.taxable_value || parseFloat((rate * qty).toFixed(2));
    const igstRate    = item.igst_rate || 40;

    return {
      SlNo:       String(idx + 1),
      PrdDesc:    item.description || '',
      IsServc:    'N',
      HsnCd:      item.hsn_code || '22029990',
      Qty:        qty,
      Unit:       'NOS',
      UnitPrice:  rate,
      TotAmt:     taxableVal,
      Discount:   0,
      AssAmt:     taxableVal,
      GstRt:      igstRate,
      IgstAmt:    isInterState ? parseFloat((item.igst_amount || taxableVal * igstRate / 100).toFixed(2)) : 0,
      CgstAmt:    !isInterState ? parseFloat((item.cgst_amount || taxableVal * igstRate / 200).toFixed(2)) : 0,
      SgstAmt:    !isInterState ? parseFloat((item.sgst_amount || taxableVal * igstRate / 200).toFixed(2)) : 0,
      CesRt:      0,
      CesAmt:     0,
      TotItemVal: item.total_amount || parseFloat((taxableVal + (item.igst_amount || item.cgst_amount ? (item.igst_amount || (item.cgst_amount + item.sgst_amount)) : taxableVal * igstRate / 100)).toFixed(2)),
    };
  });

  const taxableAmount = parseFloat(items.reduce((s, i) => s + (i.taxable_value || (i.unit_base_cost || 0) * (i.quantity || 0)), 0).toFixed(2));
  const igstTotal     = isInterState  ? parseFloat(items.reduce((s, i) => s + (i.igst_amount || 0), 0).toFixed(2)) : 0;
  const cgstTotal     = !isInterState ? parseFloat(items.reduce((s, i) => s + (i.cgst_amount || 0), 0).toFixed(2)) : 0;
  const sgstTotal     = !isInterState ? parseFloat(items.reduce((s, i) => s + (i.sgst_amount || 0), 0).toFixed(2)) : 0;
  const grandTotal    = parseFloat((invoice.total_amount || (taxableAmount + igstTotal + cgstTotal + sgstTotal)).toFixed(2));

  return {
    Version: '1.1',
    TranDtls: {
      TaxSch:      'GST',
      SupTyp:      'B2B',
      RegRev:      'N',
      EcmGstin:    null,
      IgstOnIntra: 'N',
    },
    DocDtls: {
      Typ: 'INV',
      No:  invoice.invoice_number,
      Dt:  formatDate(invoice.invoice_date),
    },
    SellerDtls: {
      Gstin: SELLER_GSTIN,
      TradNm: SELLER_NAME,
      LglNm:  SELLER_NAME,
      Addr1:  SELLER_ADDR,
      Loc:    SELLER_CITY,
      Pin:    SELLER_PIN,
      Stcd:   SELLER_STATE,
    },
    BuyerDtls: {
      Gstin:  buyerGstin,
      TradNm: invoice.customer_name || order?.customer_name || '',
      LglNm:  invoice.customer_name || order?.customer_name || '',
      Pos:    buyerState,
      Addr1:  invoice.billing_address || order?.billing_address || invoice.shipping_address || '',
      Loc:    '',
      Pin:    110001,
      Stcd:   buyerState,
      Ph:     '',
      Em:     '',
    },
    ItemList: itemList,
    ValDtls: {
      AssVal:      taxableAmount,
      IgstVal:     igstTotal,
      CgstVal:     cgstTotal,
      SgstVal:     sgstTotal,
      CesVal:      0,
      StCesVal:    0,
      Discount:    0,
      OthChrg:     0,
      RndOffAmt:   0,
      TotInvVal:   grandTotal,
      TotInvValFc: 0,
    },
  };
}

function buildAspHeaders(sandbox = false) {
  return {
    'Content-Type': 'application/json',
    'x-api-key':    Deno.env.get('INDIA_COMPLIANCE_API_KEY') || '',
    'gstin':        sandbox ? SANDBOX_GSTIN    : (Deno.env.get('ADAEQUARE_GSTIN') || SELLER_GSTIN),
    'user_name':    sandbox ? SANDBOX_USERNAME : (Deno.env.get('ADAEQUARE_USERNAME') || ''),
    'password':     sandbox ? SANDBOX_PASSWORD : (Deno.env.get('ADAEQUARE_PASSWORD') || ''),
    'requestid':    generateRequestId(),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, invoice_id, distance_km, sandbox } = await req.json();
    const isSandbox = sandbox === true;
    const ASP_BASE_URL = isSandbox ? ASP_BASE_URL_SANDBOX : ASP_BASE_URL_LIVE;
    if (!action || !invoice_id) {
      return Response.json({ error: 'action and invoice_id are required' }, { status: 400 });
    }

    // Validate env secrets are set
    if (!Deno.env.get('INDIA_COMPLIANCE_API_KEY')) {
      return Response.json({ error: 'INDIA_COMPLIANCE_API_KEY secret is not configured' }, { status: 500 });
    }

    // Fetch invoice + items + order in parallel
    const [invoices, itemsRaw] = await Promise.all([
      base44.asServiceRole.entities.SalesInvoice.filter({ id: invoice_id }),
      base44.asServiceRole.entities.SalesOrderItem.filter({ sales_order_id: undefined }),
    ]);

    const invoice = invoices[0];
    if (!invoice) return Response.json({ error: 'Invoice not found' }, { status: 404 });

    const [items, orders] = await Promise.all([
      base44.asServiceRole.entities.SalesOrderItem.filter({ sales_order_id: invoice.sales_order_id }),
      base44.asServiceRole.entities.SalesOrder.filter({ id: invoice.sales_order_id }),
    ]);
    const order = orders[0];

    // ── Generate IRN ────────────────────────────────────────────────────
    if (action === 'generate_irn') {
      const payload = buildInvoicePayload(invoice, items, order);

      const resp = await fetch(`${ASP_BASE_URL}/invoice`, {
        method:  'POST',
        headers: buildAspHeaders(isSandbox),
        body:    JSON.stringify(payload),
      });

      const data = await resp.json();

      // Enriched API may return list on duplicate IRN
      const result = Array.isArray(data) ? data[0] : data;

      if (!resp.ok || result?.success === false || result?.Success === false) {
        const msg = result?.message || result?.Message || result?.error || 'ASP API error';
        return Response.json({ error: msg, details: result }, { status: resp.status || 400 });
      }

      const irn     = result.Irn     || result.irn;
      const ackNo   = result.AckNo   || result.ack_no;
      const ackDate = result.AckDt   || result.ack_dt;

      // Only persist to DB if NOT sandbox
      if (!isSandbox) {
        await base44.asServiceRole.entities.SalesInvoice.update(invoice_id, {
          irn,
          ack_number: String(ackNo || ''),
          ack_date:   ackDate || new Date().toISOString(),
        });
      }

      return Response.json({ success: true, irn, ack_number: ackNo, ack_date: ackDate, sandbox: isSandbox, raw: result });
    }

    // ── Generate E-Way Bill ─────────────────────────────────────────────
    if (action === 'generate_eway') {
      if (!invoice.irn) {
        return Response.json({ error: 'Generate IRN first before generating E-Way Bill' }, { status: 400 });
      }

      const dn = invoice.delivery_note_id
        ? (await base44.asServiceRole.entities.SalesDeliveryNote.filter({ id: invoice.delivery_note_id }))[0]
        : null;

      const ewayPayload = {
        Irn:         invoice.irn,
        Distance:    distance_km || 0,
        TransMode:   '1',
        TransId:     null,
        TransName:   dn?.transporter_name || order?.transporter || '',
        TransDocNo:  dn?.lr_number || '',
        TransDocDt:  formatDate(dn?.dispatch_date),
        VehNo:       dn?.vehicle_number || '',
        VehType:     'R',
      };

      const resp = await fetch(`${ASP_BASE_URL}/ewaybill`, {
        method:  'POST',
        headers: buildAspHeaders(isSandbox),
        body:    JSON.stringify(ewayPayload),
      });

      const data = await resp.json();
      const result = Array.isArray(data) ? data[0] : data;

      if (!resp.ok || result?.success === false || result?.Success === false) {
        const msg = result?.message || result?.Message || result?.error || 'E-Way Bill API error';
        return Response.json({ error: msg, details: result }, { status: resp.status || 400 });
      }

      const ewayBillNo = result.EwbNo || result.ewb_no;
      const ewayDate   = result.EwbDt || new Date().toISOString().split('T')[0];

      if (!isSandbox) {
        await base44.asServiceRole.entities.SalesInvoice.update(invoice_id, {
          eway_bill:      String(ewayBillNo || ''),
          eway_bill_date: ewayDate,
        });
      }

      return Response.json({ success: true, eway_bill: ewayBillNo, eway_bill_date: ewayDate, sandbox: isSandbox, raw: result });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});