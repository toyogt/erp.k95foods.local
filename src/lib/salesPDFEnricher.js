/**
 * Browser-side DB enrichment for parsed sales PDF data.
 * Runs completely client-side — no backend function needed.
 * Mirrors the enrichment logic in functions/parseSalesPDF.js Steps 3-6.
 */
import { base44 } from '@/api/base44Client';

/**
 * Enrich parsed PDF data with customer, rate, and product lookups.
 * All DB queries run in parallel for speed.
 */
export async function enrichParsedData(parsedData) {
  // Parallel DB fetch
  const [allCustomers, allRates, allProducts, allCustomerBarcodes] = await Promise.all([
    base44.entities.Customer.filter({ status: 'active' }),
    base44.entities.SalesRateList.filter({ is_active: true }),
    base44.entities.ProductMaster.filter({ is_active: true }),
    base44.entities.SKUCustomerBarcode.list('-created_date', 2000).catch(() => []),
  ]);

  // Build lookup maps
  const productByCode = {}, productByEAN = {};
  // Platform-specific ID maps: parsed item_code → ProductMaster record
  const productByPlatformId = {
    swiggy: {},
    zepto: {},
    bigbasket: {},
    amazon: {},
    blinkit: {},  // Blinkit uses same item_code as system
  };
  for (const p of allProducts) {
    if (p.item_code) productByCode[p.item_code.trim().toUpperCase()] = p;
    if (p.product_barcode) productByEAN[p.product_barcode.trim()] = p;
    // Map platform-specific IDs
    if (p.swiggy_item_id) productByPlatformId.swiggy[p.swiggy_item_id.trim().toUpperCase()] = p;
    if (p.zepto_item_id) productByPlatformId.zepto[p.zepto_item_id.trim().toUpperCase()] = p;
    if (p.bigbasket_item_id) productByPlatformId.bigbasket[p.bigbasket_item_id.trim().toUpperCase()] = p;
    if (p.amazon_item_id) productByPlatformId.amazon[p.amazon_item_id.trim().toUpperCase()] = p;
  }
  const barcodeToItemCode = {};
  for (const cb of allCustomerBarcodes) {
    if (cb.customer_barcode && cb.item_code) barcodeToItemCode[cb.customer_barcode.trim().toUpperCase()] = cb.item_code.trim();
    if (cb.customer_sku && cb.item_code) barcodeToItemCode[cb.customer_sku.trim().toUpperCase()] = cb.item_code.trim();
  }

  // Determine which platform map to use
  const platform = (parsedData.platform || '').toLowerCase();
  const platformMap = productByPlatformId[platform] || {};

  // Customer lookup
  const extractedGstin = (parsedData.customer_gstin || '').trim().toUpperCase();
  const extractedName = (parsedData.customer_name || '').toLowerCase().trim();
  const customerFound =
    allCustomers.find(c => c.gstin && c.gstin.trim().toUpperCase() === extractedGstin) ||
    allCustomers.find(c => c.name && c.name.toLowerCase().includes(extractedName.slice(0, 20))) ||
    allCustomers.find(c => c.name && extractedName.includes(c.name.toLowerCase().slice(0, 15)));

  // Price list resolution — strict priority: customer → group → platform (only if no customer)
  let priceListUsed = null, rateSource = 'none';
  if (customerFound?.price_list) {
    priceListUsed = customerFound.price_list;
    rateSource = `customer:${customerFound.name}`;
  } else if (customerFound?.customer_group) {
    const grp = customerFound.customer_group.trim().toLowerCase();
    const pls = [...new Set(allRates.map(r => r.price_list).filter(Boolean))];
    const gm = pls.find(pl => pl.trim().toLowerCase() === grp || pl.trim().toLowerCase().startsWith(grp));
    if (gm) { priceListUsed = gm; rateSource = `group:${customerFound.customer_group}`; }
  }

  // Platform fallback ONLY when no customer found
  if (!priceListUsed && !customerFound && parsedData.platform && parsedData.platform !== 'direct' && parsedData.platform !== 'unknown') {
    const pls = [...new Set(allRates.map(r => r.price_list).filter(Boolean))];
    const pm = pls.find(pl => pl.trim().toLowerCase() === parsedData.platform.toLowerCase()
      || pl.trim().toLowerCase().startsWith(parsedData.platform.toLowerCase()));
    if (pm) { priceListUsed = pm; rateSource = `platform:${parsedData.platform}`; }
  }

  const filteredRates = priceListUsed ? allRates.filter(r => r.price_list === priceListUsed) : allRates;
  const rateByItemCode = {};
  for (const r of filteredRates) {
    if (r.item_code) rateByItemCode[r.item_code.trim()] = r;
  }

  // Enrich items
  let matchedCount = 0;
  const enrichedItems = (parsedData.items || []).map(item => {
    const rawParsedCode = (item.item_code || '').trim().toUpperCase();

    // Priority 1: Match via platform-specific ID (swiggy_item_id, zepto_item_id, etc.)
    let product = platformMap[rawParsedCode] || null;

    // Priority 2: Match via SKUCustomerBarcode mapping
    let resolvedItemCode = rawParsedCode;
    if (!product && barcodeToItemCode[rawParsedCode]) {
      resolvedItemCode = barcodeToItemCode[rawParsedCode].toUpperCase();
      product = productByCode[resolvedItemCode];
    }

    // Priority 3: Direct system item_code match
    if (!product) {
      product = productByCode[resolvedItemCode];
    }

    // Priority 4: Try EAN barcode match (material_code from Zepto can be EAN)
    if (!product && item.ean_number) {
      product = productByEAN[item.ean_number.trim()];
    }

    // Once matched, use the system item_code for rate lookup and storage
    if (product) {
      resolvedItemCode = product.item_code.trim().toUpperCase();
    }

    const rm = rateByItemCode[resolvedItemCode] || rateByItemCode[product?.item_code?.trim()];

    const enriched = { ...item };
    enriched.item_code = product ? product.item_code.trim() : item.item_code; // Store system item_code
    enriched._parsed_platform_code = rawParsedCode; // Keep original parsed code for reference
    if (product) {
      enriched.description = product.product_name;
      enriched.sku_code = product.item_code;
      enriched.hsn_code = product.hsn_code || '22029990';
      enriched.packing_unit = product.bottles_per_box || 12;
      enriched._product_name = product.product_name;
      enriched._product_matched = true;
    }
    if (rm) {
      matchedCount++;
      enriched.unit_base_cost = rm.rate;
      enriched.mrp = rm.mrp;
      enriched.igst_rate = rm.igst_rate;
      enriched._rate_matched = true;
      enriched._price_list = priceListUsed;
    } else {
      enriched._rate_matched = false;
    }

    // Recalculate financial fields based on system data
    if (enriched.unit_base_cost && enriched.quantity) {
      enriched.taxable_value = enriched.unit_base_cost * enriched.quantity;
      if (enriched.igst_rate) {
        enriched.igst_amount = enriched.taxable_value * (enriched.igst_rate / 100);
      }
      enriched.total_amount = (enriched.taxable_value || 0) + (enriched.igst_amount || 0);
    }

    return enriched;
  });

  const enrichedData = { ...parsedData, items: enrichedItems };

  // Merge customer fields
  if (customerFound) {
    enrichedData._customer_id = customerFound.id;
    enrichedData._customer_price_list = customerFound.price_list || '';
    enrichedData._customer_group = customerFound.customer_group || '';
    enrichedData._customer_region = customerFound.region || customerFound.territory || '';
    enrichedData.customer_name = customerFound.name || enrichedData.customer_name;
    enrichedData.price_list = priceListUsed || '';
    enrichedData.payment_terms = enrichedData.payment_terms || customerFound.payment_terms || '';
    enrichedData.customer_gstin = enrichedData.customer_gstin || customerFound.gstin || '';
    enrichedData.billing_address = customerFound.billing_address || enrichedData.billing_address || '';
    enrichedData.shipping_address = customerFound.shipping_address || enrichedData.shipping_address || '';
  }

  enrichedData._rate_source = rateSource;
  enrichedData._price_list_used = priceListUsed;
  enrichedData._customer_found = !!customerFound;
  enrichedData._matched_count = matchedCount;
  enrichedData._total_items = enrichedItems.length;
  enrichedData._product_matched_count = enrichedItems.filter(i => i._product_matched).length;
  enrichedData._no_rate = !priceListUsed && matchedCount === 0;
  enrichedData._parse_method = 'browser_regex';

  return enrichedData;
}