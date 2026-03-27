import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const WEBHOOK_URL = Deno.env.get('GOOGLE_SHEETS_WEBHOOK_URL');

// Map K95 document types to Google Sheet names
const SHEET_MAP = {
  SalesOrder: 'SalesOrders',
  SalesInvoice: 'SalesInvoices',
  SalesDeliveryNote: 'DeliveryNotes',
  SalesPicklist: 'Picklists',
  SalesDispatch: 'Dispatch',
  SalesPayment: 'Payments',
};

async function buildRowData(entityType, record) {
  const base = {
    name: record.id || '',
    creation: record.created_date || '',
    workflow_state: record.workflow_state || '',
    status: record.status || '',
    customer_name: record.customer_name || '',
    so_number: record.so_number || '',
    total_amount: record.total_amount || 0,
    taxable_amount: record.taxable_amount || 0,
    tax_amount: record.tax_amount || 0,
  };

  switch (entityType) {
    case 'SalesOrder':
      return {
        ...base,
        platform: record.platform || '',
        po_number: record.po_number || '',
        po_date: record.po_date || '',
        po_expiry_date: record.po_expiry_date || '',
        po_delivery_date: record.po_delivery_date || '',
        payment_terms: record.payment_terms || '',
        planned_dispatch_date: record.planned_dispatch_date || '',
        price_list: record.price_list || '',
        customer_gstin: record.customer_gstin || '',
        shipping_address: record.shipping_address || '',
        vendor_no: record.vendor_no || '',
        source: record.source || '',
      };

    case 'SalesInvoice':
      return {
        ...base,
        invoice_number: record.invoice_number || '',
        invoice_date: record.invoice_date || '',
        due_date: record.due_date || '',
        irn: record.irn || '',
        ack_number: record.ack_number || '',
        eway_bill: record.eway_bill || '',
        lr_number: record.lr_number || '',
        pod_date: record.pod_date || '',
        posted_to_tally: record.posted_to_tally ? 'Yes' : 'No',
        tally_voucher_no: record.tally_voucher_no || '',
        customer_gstin: record.customer_gstin || '',
      };

    case 'SalesDeliveryNote':
      return {
        ...base,
        dn_number: record.dn_number || '',
        dispatch_date: record.dispatch_date || '',
        appointment_date: record.appointment_date || '',
        transporter_name: record.transporter_name || '',
        vehicle_number: record.vehicle_number || '',
        lr_number: record.lr_number || '',
        packaging_type: record.packaging_type || '',
        total_qty: record.total_qty || 0,
        total_boxes: record.total_boxes || 0,
        total_weight_kg: record.total_weight_kg || 0,
        shipping_address: record.shipping_address || '',
      };

    case 'SalesPicklist':
      return {
        ...base,
        picklist_number: record.picklist_number || '',
        dispatch_date: record.dispatch_date || '',
        appointment_date: record.appointment_date || '',
        transporter: record.transporter || '',
        packaging_type: record.packaging_type || '',
        generated_by: record.generated_by || '',
        items_json: JSON.stringify(record.items || []),
      };

    default:
      return base;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (!WEBHOOK_URL) {
      return Response.json({ error: 'GOOGLE_SHEETS_WEBHOOK_URL secret not configured' }, { status: 500 });
    }

    const body = await req.json();
    const { entity_type, entity_id } = body;

    if (!entity_type || !entity_id) {
      return Response.json({ error: 'entity_type and entity_id are required' }, { status: 400 });
    }

    const sheetName = SHEET_MAP[entity_type];
    if (!sheetName) {
      return Response.json({ error: `Unsupported entity type: ${entity_type}` }, { status: 400 });
    }

    // Fetch the record
    const record = await base44.asServiceRole.entities[entity_type].filter({ id: entity_id }, undefined, 1);
    if (!record?.[0]) {
      return Response.json({ error: 'Record not found' }, { status: 404 });
    }

    const rowData = await buildRowData(entity_type, record[0]);

    // POST to Google Apps Script
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meta: { doctype: entity_type, sheet_name: sheetName },
        data: { ...rowData, name: entity_id },
      }),
    });

    const result = await response.text();

    return Response.json({ success: true, sheet: sheetName, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});