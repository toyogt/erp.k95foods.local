import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { pdf_url } = await req.json();
    if (!pdf_url) return Response.json({ error: 'pdf_url is required' }, { status: 400 });

    // Use gemini_3_flash for speed — it handles vision + structured output well
    const prompt = `You are an expert at parsing Indian Purchase Order PDFs from e-commerce platforms (Blinkit/Hands on Trades, Swiggy/Scootsy, Zepto, BigBasket).

Extract all information from this Purchase Order PDF and return it as structured JSON.

Platform detection rules:
- If buyer contains "HANDS ON TRADES" or "HOT" or "INNOVATIVE RETAIL" → platform = "blinkit"
- If buyer contains "SCOOTSY" or "CLOUDSTORE" → platform = "swiggy"  
- If buyer contains "ZEPTO" or "KIRANAKART" → platform = "zepto"
- Otherwise → platform = "direct"

Extract these fields:
- po_number: the PO number / PO No / Order No
- po_date: date of PO (ISO format YYYY-MM-DD)
- po_expiry_date: PO expiry date (ISO format YYYY-MM-DD) — CRITICAL field
- po_delivery_date: expected delivery date (ISO format YYYY-MM-DD)
- payment_terms: payment terms string
- customer_name: buyer/purchaser company name
- customer_gstin: buyer GSTIN number
- billing_address: full billing address as single string
- shipping_address: full shipping/delivery address as single string
- vendor_no: vendor number if present
- items: array of line items, each with:
  - item_code: item/material code
  - sku_code: SKU code if present
  - hsn_code: HSN code (default 22029990 for beverages)
  - ean_number: EAN/UPC/barcode if present
  - description: full product description
  - quantity: ordered quantity (number)
  - mrp: MRP/RSP (number)
  - packing_unit: bottles per box/case (number, extract from description)
  - unit_base_cost: base cost price per unit (number)
  - taxable_value: taxable value (number)
  - igst_rate: IGST % (number)
  - igst_amount: IGST amount (number)
  - cgst_rate: CGST % (number, 0 if not present)
  - cgst_amount: CGST amount (number, 0 if not present)
  - sgst_rate: SGST % (number, 0 if not present)
  - sgst_amount: SGST amount (number, 0 if not present)
  - total_amount: total line amount including tax (number)
- taxable_amount: total taxable amount
- tax_amount: total tax amount
- total_amount: grand total

Return ONLY valid JSON.`;

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
                packing_unit: { type: 'number' },
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

    // Post-process: customer lookup → price list resolution → item rate enrichment
    let enrichedData = { ...result };
    let priceListUsed = null;
    let customerFound = null;
    let rateSource = 'none';

    try {
      // Step 1: Look up customer by name or GSTIN
      const customers = await base44.asServiceRole.entities.Customer.filter({ status: 'active' });
      const extractedName = (enrichedData.customer_name || '').toLowerCase().trim();
      const extractedGstin = (enrichedData.customer_gstin || '').trim();

      // Match by GSTIN first (most reliable), then by name (case-insensitive contains)
      customerFound = customers.find(c =>
        (extractedGstin && c.gstin && c.gstin.trim() === extractedGstin)
      ) || customers.find(c =>
        extractedName && c.name && c.name.toLowerCase().includes(extractedName.slice(0, 20))
      ) || customers.find(c =>
        extractedName && c.name && extractedName.includes(c.name.toLowerCase().slice(0, 15))
      );

      // Step 2: Resolve price list
      // Priority 1: Customer has a specific price list assigned
      if (customerFound?.price_list) {
        priceListUsed = customerFound.price_list;
        rateSource = `customer (${customerFound.name})`;
      }
      // Priority 2: Customer group — look for a price list that matches group name
      else if (customerFound?.customer_group) {
        const groupName = customerFound.customer_group.toLowerCase();
        const allRates = await base44.asServiceRole.entities.SalesRateList.filter({ is_active: true });
        const groupList = [...new Set(allRates.map(r => r.price_list).filter(Boolean))]
          .find(pl => pl.toLowerCase().includes(groupName) || groupName.includes(pl.toLowerCase()));
        if (groupList) {
          priceListUsed = groupList;
          rateSource = `customer group (${customerFound.customer_group})`;
        }
      }
      // Priority 3: Try to match by platform — e.g. platform = blinkit → look for 'blinkit' price list
      if (!priceListUsed && enrichedData.platform && enrichedData.platform !== 'direct') {
        const allRates2 = await base44.asServiceRole.entities.SalesRateList.filter({ is_active: true });
        const platformPl = [...new Set(allRates2.map(r => r.price_list).filter(Boolean))]
          .find(pl => pl.toLowerCase().includes(enrichedData.platform.toLowerCase()));
        if (platformPl) {
          priceListUsed = platformPl;
          rateSource = `platform (${enrichedData.platform})`;
        }
      }

      // Step 3: Fetch rates for resolved price list (or all active if none found)
      let rateList;
      if (priceListUsed) {
        rateList = await base44.asServiceRole.entities.SalesRateList.filter({ price_list: priceListUsed, is_active: true });
      } else {
        rateList = await base44.asServiceRole.entities.SalesRateList.filter({ is_active: true });
        rateSource = 'general (no price list matched)';
      }

      // Step 4: Enrich items with rates from resolved price list
      if (rateList.length > 0 && enrichedData.items) {
        enrichedData.items = enrichedData.items.map(item => {
          const match = rateList.find(r =>
            (item.item_code && r.item_code && r.item_code === item.item_code) ||
            (item.sku_code && r.item_code && r.item_code === item.sku_code) ||
            (item.ean_number && r.item_code && r.item_code === item.ean_number) ||
            (item.description && r.item_name && (
              r.item_name.toLowerCase().includes(item.description.toLowerCase().split(' ').slice(0, 3).join(' ')) ||
              item.description.toLowerCase().includes(r.item_name.toLowerCase().split(' ').slice(0, 3).join(' '))
            ))
          );
          if (match) {
            return {
              ...item,
              item_code: match.item_code || item.item_code,
              hsn_code: match.hsn_code || item.hsn_code || '22029990',
              packing_unit: match.packing_unit || item.packing_unit || 12,
              rate_snapshot: match.rate,
              unit_base_cost: match.rate || item.unit_base_cost,
              mrp: match.mrp || item.mrp,
              igst_rate: match.igst_rate || item.igst_rate,
              _rate_matched: true,
              _price_list: priceListUsed,
            };
          }
          return { ...item, _rate_matched: false };
        });
      }

      // Store enrichment metadata on order level
      if (customerFound) {
        enrichedData._customer_id = customerFound.id;
        enrichedData._customer_price_list = customerFound.price_list || '';
        enrichedData._customer_group = customerFound.customer_group || '';
        enrichedData.price_list = priceListUsed || '';
        enrichedData.payment_terms = enrichedData.payment_terms || customerFound.payment_terms || '';
        enrichedData.customer_gstin = enrichedData.customer_gstin || customerFound.gstin || '';
        enrichedData.billing_address = enrichedData.billing_address || customerFound.billing_address || '';
        enrichedData.shipping_address = enrichedData.shipping_address || customerFound.shipping_address || '';
      }
      enrichedData._rate_source = rateSource;
      enrichedData._price_list_used = priceListUsed;
      enrichedData._customer_found = !!customerFound;
    } catch (_e) {
      // Rate enrichment is best-effort, never fail the parse
    }

    return Response.json({ success: true, data: enrichedData });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});