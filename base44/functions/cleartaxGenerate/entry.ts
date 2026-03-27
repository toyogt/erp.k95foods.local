/**
 * ClearTax API Integration — Generate E-Invoice (IRN) and E-Way Bill
 *
 * Actions:
 *   generate_irn   — Generate IRN from ClearTax e-Invoice API
 *   generate_eway  — Generate E-Way Bill after IRN is available
 *
 * Config stored in AppSetting entity:
 *   cleartax_api_key  — API token
 *   cleartax_gstin    — Seller GSTIN (K95 Foods: 06AAHCK7191E1ZF)
 *   cleartax_env      — 'sandbox' or 'production'
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const SELLER_GSTIN = '06AAHCK7191E1ZF';
const SELLER_NAME = 'K95 Foods Private Limited';
const SELLER_ADDR = 'Plot No. V8, M.I.E , Part - B, Bahadurgarh';
const SELLER_CITY = 'Bahadurgarh';
const SELLER_PIN = 124507;
const SELLER_STATE = '06';

function getStateCode(gstin) {
  return gstin?.substring(0, 2) || '07';
}

function formatDate(dateStr) {
  if (!dateStr) return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/');
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function buildInvoicePayload(invoice, items, order) {
  const buyerGstin = invoice.customer_gstin || order?.customer_gstin || 'URP';
  const buyerStateCode = getStateCode(buyerGstin);
  const isInterState = buyerStateCode !== SELLER_STATE;
  const supplyType = isInterState ? 'B2B' : 'B2B';

  const itemList = items.map((item, idx) => {
    const rate = item.unit_base_cost || item.rate_snapshot || 0;
    const qty = item.quantity || 0;
    const taxableVal = item.taxable_value || (rate * qty);
    const igstRate = item.igst_rate || 40;

    const itemEntry = {
      SlNo: String(idx + 1),
      PrdDesc: item.description || '',
      IsServc: 'N',
      HsnCd: item.hsn_code || '22029990',
      Qty: qty,
      Unit: 'NOS',
      UnitPrice: rate,
      TotAmt: taxableVal,
      Discount: 0,
      AssAmt: taxableVal,
      GstRt: igstRate,
      IgstAmt: isInterState ? (item.igst_amount || parseFloat((taxableVal * igstRate / 100).toFixed(2))) : 0,
      CgstAmt: !isInterState ? (item.cgst_amount || parseFloat((taxableVal * igstRate / 200).toFixed(2))) : 0,
      SgstAmt: !isInterState ? (item.sgst_amount || parseFloat((taxableVal * igstRate / 200).toFixed(2))) : 0,
      CesRt: 0,
      CesAmt: 0,
      TotItemVal: item.total_amount || taxableVal + (item.igst_amount || 0),
    };
    return itemEntry;
  });

  const taxableAmount = items.reduce((s, i) => s + (i.taxable_value || (i.unit_base_cost || 0) * (i.quantity || 0)), 0);
  const igstTotal = isInterState ? items.reduce((s, i) => s + (i.igst_amount || 0), 0) : 0;
  const cgstTotal = !isInterState ? items.reduce((s, i) => s + (i.cgst_amount || 0), 0) : 0;
  const sgstTotal = !isInterState ? items.reduce((s, i) => s + (i.sgst_amount || 0), 0) : 0;
  const grandTotal = invoice.total_amount || (taxableAmount + igstTotal + cgstTotal + sgstTotal);

  return {
    Version: '1.1',
    TranDtls: {
      TaxSch: 'GST',
      SupTyp: supplyType,
      RegRev: 'N',
      EcmGstin: null,
      IgstOnIntra: 'N',
    },
    DocDtls: {
      Typ: 'INV',
      No: invoice.invoice_number,
      Dt: formatDate(invoice.invoice_date),
    },
    SellerDtls: {
      Gstin: SELLER_GSTIN,
      TradNm: SELLER_NAME,
      LglNm: SELLER_NAME,
      Addr1: SELLER_ADDR,
      Loc: SELLER_CITY,
      Pin: SELLER_PIN,
      Stcd: SELLER_STATE,
    },
    BuyerDtls: {
      Gstin: buyerGstin,
      TradNm: invoice.customer_name || order?.customer_name || '',
      LglNm: invoice.customer_name || order?.customer_name || '',
      Pos: buyerStateCode,
      Addr1: invoice.shipping_address || order?.shipping_address || '',
      Loc: '',
      Pin: 110001,
      Stcd: buyerStateCode,
      Ph: '',
      Em: '',
    },
    ItemList: itemList,
    ValDtls: {
      AssVal: parseFloat(taxableAmount.toFixed(2)),
      IgstVal: parseFloat(igstTotal.toFixed(2)),
      CgstVal: parseFloat(cgstTotal.toFixed(2)),
      SgstVal: parseFloat(sgstTotal.toFixed(2)),
      CesVal: 0,
      StCesVal: 0,
      Discount: 0,
      OthChrg: 0,
      RndOffAmt: 0,
      TotInvVal: parseFloat(grandTotal.toFixed(2)),
      TotInvValFc: 0,
    },
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, invoice_id, distance_km } = await req.json();
    if (!action || !invoice_id) {
      return Response.json({ error: 'action and invoice_id are required' }, { status: 400 });
    }

    // Load ClearTax config from AppSetting
    const configSettings = await base44.asServiceRole.entities.AppSetting.filter({ key: { $in: ['cleartax_api_key', 'cleartax_gstin', 'cleartax_env'] } });
    const getConfig = (key) => configSettings.find(s => s.key === key)?.value || '';
    const apiKey = getConfig('cleartax_api_key');
    const env = getConfig('cleartax_env') || 'sandbox';

    if (!apiKey) {
      return Response.json({ error: 'ClearTax API key not configured. Please set it in Sales Settings.' }, { status: 400 });
    }

    const BASE_URL = env === 'production'
      ? 'https://api.cleartax.in'
      : 'https://api.sandbox.cleartax.in';

    // Fetch invoice + items + order
    const invoices = await base44.asServiceRole.entities.SalesInvoice.filter({ id: invoice_id });
    const invoice = invoices[0];
    if (!invoice) return Response.json({ error: 'Invoice not found' }, { status: 404 });

    const items = await base44.asServiceRole.entities.SalesOrderItem.filter({ sales_order_id: invoice.sales_order_id });
    const orders = await base44.asServiceRole.entities.SalesOrder.filter({ id: invoice.sales_order_id });
    const order = orders[0];

    if (action === 'generate_irn') {
      const payload = buildInvoicePayload(invoice, items, order);
      const resp = await fetch(`${BASE_URL}/v2/eInvoice/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cleartax-auth-token': apiKey,
          'gstin': SELLER_GSTIN,
        },
        body: JSON.stringify(payload),
      });

      const data = await resp.json();
      if (!resp.ok) {
        return Response.json({ error: data?.message || data?.error || 'ClearTax API error', details: data }, { status: resp.status });
      }

      // Save IRN + ack details to invoice
      const irn = data.Irn || data.irn;
      const ackNo = data.AckNo || data.ack_no;
      const ackDate = data.AckDt || data.ack_dt;
      await base44.asServiceRole.entities.SalesInvoice.update(invoice_id, {
        irn, ack_number: String(ackNo), ack_date: ackDate,
      });

      return Response.json({ success: true, irn, ack_number: ackNo, ack_date: ackDate, raw: data });
    }

    if (action === 'generate_eway') {
      if (!invoice.irn) {
        return Response.json({ error: 'Generate IRN first before generating E-Way Bill' }, { status: 400 });
      }

      const dn = invoice.delivery_note_id
        ? (await base44.asServiceRole.entities.SalesDeliveryNote.filter({ id: invoice.delivery_note_id }))[0]
        : null;

      const ewayPayload = {
        Irn: invoice.irn,
        Distance: distance_km || 0,
        TransMode: '1',
        TransId: null,
        TransName: dn?.transporter_name || order?.transporter || '',
        TransDocNo: dn?.lr_number || '',
        TransDocDt: formatDate(dn?.dispatch_date || new Date().toISOString()),
        VehNo: dn?.vehicle_number || '',
        VehType: 'R',
      };

      const resp = await fetch(`${BASE_URL}/v2/ewbdetails_by_irn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cleartax-auth-token': apiKey,
          'gstin': SELLER_GSTIN,
        },
        body: JSON.stringify(ewayPayload),
      });

      const data = await resp.json();
      if (!resp.ok) {
        return Response.json({ error: data?.message || data?.error || 'ClearTax E-Way Bill error', details: data }, { status: resp.status });
      }

      const ewayBillNo = data.EwbNo || data.ewb_no;
      const ewayDate = data.EwbDt || new Date().toISOString().split('T')[0];
      await base44.asServiceRole.entities.SalesInvoice.update(invoice_id, {
        eway_bill: String(ewayBillNo), eway_bill_date: ewayDate,
      });

      return Response.json({ success: true, eway_bill: ewayBillNo, eway_bill_date: ewayDate, raw: data });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});