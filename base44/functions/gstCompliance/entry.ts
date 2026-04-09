/**
 * GST Compliance Engine — E-Invoice (IRN) & E-Way Bill lifecycle
 * Uses Adaequare GSP via India Compliance ASP (asp.resilient.tech)
 *
 * Actions:
 *   generate_irn    — Generate IRN via IRP
 *   cancel_irn      — Cancel IRN
 *   generate_ewb    — Generate E-Way Bill (requires IRN)
 *   cancel_ewb      — Cancel E-Way Bill
 *   update_vehicle   — Update vehicle info on E-Way Bill
 *   update_transporter — Update transporter on E-Way Bill
 *   extend_validity  — Extend E-Way Bill validity
 *   fetch_ewb_status — Fetch latest E-Way Bill status from NIC
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const SELLER_GSTIN = '06AAHCK7191E1ZF';
const SELLER_NAME  = 'K95 Foods Private Limited';
const SELLER_ADDR  = 'Plot No. V8, M.I.E , Part - B, Bahadurgarh';
const SELLER_CITY  = 'Bahadurgarh';
const SELLER_PIN   = 124507;
const SELLER_STATE = '06';

const ASP_BASE     = 'https://asp.resilient.tech';
const API_EI       = '/ei/api';
const API_EWB      = '/ei/api';

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
function reqId() { let r = 'IC'; for (let i = 0; i < 10; i++) r += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random()*36)]; return r; }
function fmtDate(d) { const dt = d ? new Date(d) : new Date(); return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`; }

function headers() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': Deno.env.get('INDIA_COMPLIANCE_API_KEY') || '',
    'gstin': Deno.env.get('ADAEQUARE_GSTIN') || SELLER_GSTIN,
    'user_name': Deno.env.get('ADAEQUARE_USERNAME') || '',
    'password': Deno.env.get('ADAEQUARE_PASSWORD') || '',
    'requestid': reqId(),
  };
}

function buildIRNPayload(invoice, items, order) {
  const buyerGstin = invoice.customer_gstin || order?.customer_gstin || 'URP';
  const buyerState = stateCode(buyerGstin);
  const isInter = buyerState !== SELLER_STATE;

  // Use invoice.items if available, else fallback to SalesOrderItem
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
      TotItemVal: parseFloat((taxable + (isInter ? taxable * gstRate / 100 : taxable * gstRate / 100)).toFixed(2)),
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

async function callASP(path, method, body) {
  const url = `${ASP_BASE}${API_EI}${path}`;
  const opts = { method, headers: headers() };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(url, opts);
  const data = await resp.json();
  const result = Array.isArray(data) ? data[0] : data;
  return { ok: resp.ok, status: resp.status, result };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, invoice_id } = body;
    if (!action || !invoice_id) return Response.json({ error: 'action and invoice_id required' }, { status: 400 });

    if (!Deno.env.get('INDIA_COMPLIANCE_API_KEY')) {
      return Response.json({ error: 'INDIA_COMPLIANCE_API_KEY not configured' }, { status: 500 });
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
      const { ok, result } = await callASP('/invoice', 'POST', payload);

      const success = ok && result?.success !== false && result?.Success !== false;
      const irn = result?.Irn || result?.irn;
      const ackNo = result?.AckNo || result?.ack_no;
      const ackDate = result?.AckDt || result?.ack_dt;

      // Log to EInvoiceLog (always — success or fail)
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
      const { ok, result } = await callASP('/invoice/cancel', 'POST', cancelPayload);
      const success = ok && result?.success !== false;

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

      const { ok, result } = await callASP('/ewaybill', 'POST', ewbPayload);
      const success = ok && result?.success !== false;
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
      const { ok, result } = await callASP('/ewayapi', 'POST', { ...cancelPayload, action: 'CANEWB' });
      const success = ok && result?.success !== false;

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

      const { ok, result } = await callASP('/ewayapi', 'POST', { ...vehPayload, action: 'VEHEWB' });
      const success = ok && result?.success !== false;

      // Append-only vehicle update log
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
      const { ok, result } = await callASP('/ewayapi', 'POST', { ...transPayload, action: 'UPDATETRANSPORTER' });
      const success = ok && result?.success !== false;

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

      const { ok, result } = await callASP('/ewayapi', 'POST', { ...extPayload, action: 'EXTEWB' });
      const success = ok && result?.success !== false;
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
      const { ok, result } = await callASP(`/ewayapi?action=GetEwayBill&ewbNo=${invoice.eway_bill}`, 'GET', null);
      const success = ok && result;

      const ewbStatus = result?.status || result?.Status || '';
      const validUpto = result?.validUpto || result?.EwbValidTill || '';

      await base44.asServiceRole.entities.EWayBillLog.create({
        invoice_id, invoice_number: invoice.invoice_number,
        action: 'fetch_status', status: success ? 'success' : 'failed',
        eway_bill_no: invoice.eway_bill, ewb_status: ewbStatus, valid_upto: validUpto,
        request_payload: { ewbNo: invoice.eway_bill }, response_payload: result || {},
        error_message: success ? '' : 'Fetch failed',
        performed_by: user.email, performed_at: new Date().toISOString(),
      });

      if (success) {
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
    return Response.json({ error: error.message }, { status: 500 });
  }
});