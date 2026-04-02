import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Platform detection by GSTIN prefix or company name keywords
function detectPlatform(customerName, customerGstin) {
  const name = (customerName || '').toUpperCase();
  if (name.includes('HANDS ON TRADES') || name.includes('HOT ') || name.includes('INNOVATIVE RETAIL')) return 'blinkit';
  if (name.includes('SCOOTSY') || name.includes('CLOUDSTORE')) return 'swiggy';
  if (name.includes('ZEPTO') || name.includes('KIRANAKART')) return 'zepto';
  if (name.includes('BIGBASKET') || name.includes('SUPERMARKET GROCERY')) return 'bigbasket';
  return 'direct';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { pdf_url } = await req.json();
    if (!pdf_url) return Response.json({ error: 'pdf_url is required' }, { status: 400 });

    // ── PARALLEL: LLM extraction + ALL DB prefetches at the same time ──────────
    const [result, allCustomers, allRates, allProducts, allCustomerBarcodes] = await Promise.all([
      // 1. LLM extraction — tight focused prompt
      base44.asServiceRole.integrations.Core.InvokeLLM({
        model: 'gemini_3_flash',
        file_urls: [pdf_url],
        prompt: `Extract Purchase Order data from this PDF. Return JSON only.

Platform detection (customer/buyer name):
- "HANDS ON TRADES" or "HOT" → platform="blinkit"
- "SCOOTSY" or "CLOUDSTORE" → platform="swiggy"
- "ZEPTO" or "KIRANAKART" → platform="zepto"
- else → platform="direct"

Required fields:
po_number, po_date (YYYY-MM-DD), po_expiry_date (YYYY-MM-DD), po_delivery_date (YYYY-MM-DD),
payment_terms, customer_name (buyer company), customer_gstin (buyer GSTIN),
billing_address, shipping_address, vendor_no, platform,
taxable_amount, tax_amount, total_amount,
items: [{item_code, sku_code, hsn_code, ean_number, description, quantity, mrp, unit_base_cost, taxable_value, igst_rate, igst_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount, total_amount}]

Return ONLY valid JSON.`,
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
      }),

      // 2. Fetch all active customers
      base44.asServiceRole.entities.Customer.filter({ status: 'active' }),

      // 3. Fetch all active rates
      base44.asServiceRole.entities.SalesRateList.filter({ is_active: true }),

      // 4. Fetch all active products (for item code standardisation)
      base44.asServiceRole.entities.ProductMaster.filter({ is_active: true }),

      // 5. Fetch customer barcode mappings (partner item codes → our item codes)
      base44.asServiceRole.entities.SKUCustomerBarcode.list('-created_date', 2000).catch(() => []),
    ]);

    // ── BUILD FAST LOOKUP MAPS ──────────────────────────────────────────

    // Product Master lookups
    const productByCode = {};     // item_code → product
    const productByEAN = {};      // product_barcode → product
    const productByName = [];     // for fuzzy matching
    for (const p of allProducts) {
      if (p.item_code) productByCode[p.item_code.trim().toUpperCase()] = p;
      if (p.product_barcode) productByEAN[p.product_barcode.trim()] = p;
      if (p.product_name) productByName.push({ p, words: p.product_name.toLowerCase().split(' ').filter(w => w.length > 3) });
    }

    // Customer barcode → our item_code (partner platform integration)
    const barcodeToItemCode = {};
    for (const cb of allCustomerBarcodes) {
      if (cb.customer_barcode && cb.item_code) {
        barcodeToItemCode[cb.customer_barcode.trim().toUpperCase()] = cb.item_code.trim();
      }
      if (cb.customer_sku && cb.item_code) {
        barcodeToItemCode[cb.customer_sku.trim().toUpperCase()] = cb.item_code.trim();
      }
    }

    // ── POST-PROCESS ──────────────────────────────────────────────────
    let enrichedData = { ...result };

    // Ensure platform is set
    if (!enrichedData.platform || enrichedData.platform === 'direct') {
      enrichedData.platform = detectPlatform(enrichedData.customer_name, enrichedData.customer_gstin);
    }

    const extractedGstin = (enrichedData.customer_gstin || '').trim().toUpperCase();
    const extractedName = (enrichedData.customer_name || '').toLowerCase().trim();

    // Customer match: GSTIN first (exact), then name fuzzy
    const customerFound =
      allCustomers.find(c => c.gstin && c.gstin.trim().toUpperCase() === extractedGstin) ||
      allCustomers.find(c => c.name && c.name.toLowerCase().includes(extractedName.slice(0, 20))) ||
      allCustomers.find(c => c.name && extractedName.includes(c.name.toLowerCase().slice(0, 15)));

    // Price list resolution (priority order)
    let priceListUsed = null;
    let rateSource = 'none';

    if (customerFound?.price_list) {
      priceListUsed = customerFound.price_list;
      rateSource = `customer:${customerFound.name}`;
    } else if (customerFound?.customer_group) {
      const grp = customerFound.customer_group.toLowerCase();
      const allPriceLists = [...new Set(allRates.map(r => r.price_list).filter(Boolean))];
      const groupMatch = allPriceLists.find(pl =>
        pl.toLowerCase().includes(grp) || grp.includes(pl.toLowerCase())
      );
      if (groupMatch) { priceListUsed = groupMatch; rateSource = `group:${customerFound.customer_group}`; }
    }

    // Fallback: platform-based price list
    if (!priceListUsed && enrichedData.platform !== 'direct') {
      const allPriceLists = [...new Set(allRates.map(r => r.price_list).filter(Boolean))];
      const platformMatch = allPriceLists.find(pl =>
        pl.toLowerCase().includes(enrichedData.platform.toLowerCase())
      );
      if (platformMatch) { priceListUsed = platformMatch; rateSource = `platform:${enrichedData.platform}`; }
    }

    // Filter rates to the resolved price list
    const filteredRates = priceListUsed
      ? allRates.filter(r => r.price_list === priceListUsed)
      : allRates;

    // Build fast rate lookup maps
    const rateByItemCode = {};
    const rateByEAN = {};
    const rateByNameWords = [];
    for (const r of filteredRates) {
      if (r.item_code) rateByItemCode[r.item_code.trim()] = r;
      if (r.ean_number) rateByEAN[r.ean_number.trim()] = r;
      if (r.item_name) rateByNameWords.push({ r, words: r.item_name.toLowerCase().split(' ').filter(w => w.length > 3) });
    }

    // ── ENRICH ITEMS with standardised item codes ──────────────────────
    let matchedCount = 0;
    if (enrichedData.items?.length) {
      enrichedData.items = enrichedData.items.map(item => {
        // Step 1: Try to resolve partner barcode → our item code
        let resolvedItemCode = item.item_code || '';
        const pdfCode = (item.sku_code || item.item_code || '').trim().toUpperCase();
        const pdfEAN = (item.ean_number || '').trim().toUpperCase();

        if (pdfCode && barcodeToItemCode[pdfCode]) {
          resolvedItemCode = barcodeToItemCode[pdfCode];
        } else if (pdfEAN && barcodeToItemCode[pdfEAN]) {
          resolvedItemCode = barcodeToItemCode[pdfEAN];
        }

        // Step 2: Validate against Product Master
        let product = null;
        if (resolvedItemCode) {
          product = productByCode[resolvedItemCode.toUpperCase()];
        }
        if (!product && pdfEAN) {
          product = productByEAN[pdfEAN];
          if (product) resolvedItemCode = product.item_code;
        }
        if (!product && item.description) {
          const descLower = item.description.toLowerCase();
          const fuzzy = productByName.find(({ words }) =>
            words.filter(w => descLower.includes(w)).length >= Math.min(2, words.length)
          );
          if (fuzzy) { product = fuzzy.p; resolvedItemCode = fuzzy.p.item_code; }
        }

        // Step 3: Match rates
        let rateMatch =
          (resolvedItemCode && rateByItemCode[resolvedItemCode.trim()]) ||
          (item.sku_code && rateByItemCode[item.sku_code.trim()]) ||
          (item.ean_number && rateByEAN[item.ean_number.trim()]);

        if (!rateMatch && item.description) {
          const descLower = item.description.toLowerCase();
          rateMatch = rateByNameWords.find(({ words }) =>
            words.filter(w => descLower.includes(w)).length >= Math.min(2, words.length)
          )?.r;
        }

        const enriched = { ...item };
        // Apply standardised item code
        if (resolvedItemCode) enriched.item_code = resolvedItemCode;
        if (product) {
          enriched.hsn_code = product.hsn_code || enriched.hsn_code || '22029990';
          enriched.packing_unit = product.bottles_per_box || enriched.packing_unit || 12;
          enriched._product_name = product.product_name;
          enriched._product_matched = true;
        }

        if (rateMatch) {
          matchedCount++;
          enriched.item_code = rateMatch.item_code || enriched.item_code;
          enriched.hsn_code = rateMatch.hsn_code || enriched.hsn_code || '22029990';
          enriched.packing_unit = rateMatch.packing_unit || enriched.packing_unit || 12;
          enriched.rate_snapshot = rateMatch.rate;
          enriched.unit_base_cost = rateMatch.rate;
          enriched.mrp = rateMatch.mrp || enriched.mrp;
          enriched.igst_rate = rateMatch.igst_rate ?? enriched.igst_rate;
          enriched._rate_matched = true;
          enriched._price_list = priceListUsed;
        } else {
          enriched.hsn_code = enriched.hsn_code || '22029990';
          enriched._rate_matched = false;
        }

        return enriched;
      });
    }

    // Metadata for frontend
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
    enrichedData._matched_count = matchedCount;
    enrichedData._total_items = enrichedData.items?.length || 0;
    enrichedData._product_matched_count = (enrichedData.items || []).filter(i => i._product_matched).length;
    // Block flag: no price list AND no items matched
    enrichedData._no_rate = !priceListUsed && matchedCount === 0;

    return Response.json({ success: true, data: enrichedData });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});