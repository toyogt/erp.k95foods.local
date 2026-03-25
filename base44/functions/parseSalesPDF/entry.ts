import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { pdf_url } = await req.json();
    if (!pdf_url) return Response.json({ error: 'pdf_url is required' }, { status: 400 });

    const prompt = `You are an expert at parsing Indian Purchase Order PDFs from e-commerce platforms (Blinkit/Hands on Trades, Swiggy/Scootsy, Zepto).

Extract all information from this Purchase Order PDF and return it as structured JSON.

Detect the platform:
- If buyer is "HANDS ON TRADES" or "HOT" → platform = "blinkit"
- If buyer is "SCOOTSY LOGISTICS" → platform = "swiggy"
- If buyer is "ZEPTO" → platform = "zepto"
- Otherwise → platform = "direct"

Extract:
- po_number: the PO number / PO No
- po_date: date of PO (ISO format YYYY-MM-DD)
- po_expiry_date: PO expiry date (ISO format YYYY-MM-DD) — CRITICAL, must extract
- po_delivery_date: expected delivery date (ISO format YYYY-MM-DD)
- payment_terms: payment terms string
- customer_name: buyer/purchaser company name
- customer_gstin: buyer GSTIN
- billing_address: full billing address
- shipping_address: full shipping/delivery address
- vendor_no: vendor number if present
- items: array of line items with:
  - item_code: item/material code
  - sku_code: SKU code if present
  - hsn_code: HSN code
  - ean_number: EAN/UPC/barcode if present
  - description: full product description
  - quantity: ordered quantity (number)
  - mrp: MRP/RSP (number)
  - unit_base_cost: base cost price (number)
  - taxable_value: taxable value (number)
  - igst_rate: IGST % (number)
  - igst_amount: IGST amount (number)
  - cgst_rate: CGST % (number, 0 if not present)
  - cgst_amount: CGST amount (number, 0 if not present)
  - sgst_rate: SGST % (number, 0 if not present)
  - sgst_amount: SGST amount (number, 0 if not present)
  - total_amount: total line amount (number)
- taxable_amount: total taxable amount
- tax_amount: total tax amount
- total_amount: grand total

Return ONLY valid JSON. No explanation.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: 'gemini_3_flash',
      file_urls: [pdf_url],
      response_json_schema: {
        type: 'object',
        properties: {
          platform: { type: 'string' },
          po_number: { type: 'string' },
          po_date: { type: 'string' },
          po_expiry_date: { type: 'string' },
          po_delivery_date: { type: 'string' },
          payment_terms: { type: 'string' },
          customer_name: { type: 'string' },
          customer_gstin: { type: 'string' },
          billing_address: { type: 'string' },
          shipping_address: { type: 'string' },
          vendor_no: { type: 'string' },
          taxable_amount: { type: 'number' },
          tax_amount: { type: 'number' },
          total_amount: { type: 'number' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                item_code: { type: 'string' },
                sku_code: { type: 'string' },
                hsn_code: { type: 'string' },
                ean_number: { type: 'string' },
                description: { type: 'string' },
                quantity: { type: 'number' },
                mrp: { type: 'number' },
                unit_base_cost: { type: 'number' },
                taxable_value: { type: 'number' },
                igst_rate: { type: 'number' },
                igst_amount: { type: 'number' },
                cgst_rate: { type: 'number' },
                cgst_amount: { type: 'number' },
                sgst_rate: { type: 'number' },
                sgst_amount: { type: 'number' },
                total_amount: { type: 'number' }
              }
            }
          }
        }
      }
    });

    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});