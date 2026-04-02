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
  const productByCode = {}, productByEAN = {}, productByName = [];
  for (const p of allProducts) {
    if (p.item_code) productByCode[p.item_code.trim().toUpperCase()] = p;
    if (p.product_barcode) productByEAN[p.product_barcode.trim()] = p;
    if (p.product_name) productByName.push({ p, words: p.product_name.toLowerCase().split(' ').filter(w => w.length > 3) });
  }
  const barcodeToItemCode = {};
  for (const cb of allCustomerBarcodes) {
    if (cb.customer_barcode && cb.item_code) barcodeToItemCode[cb.customer_barcode.trim().toUpperCase()] = cb.item_code.trim();
    if (cb.customer_sku && cb.item_code) barcodeToItemCode[cb.customer_sku.trim().toUpperCase()] = cb.item_code.trim();
  }

  // Customer lookup
  const extractedGstin = (parsedData.customer_gstin || '').trim().toUpperCase();
  const extractedName = (parsedData.customer_name || '').toLowerCase().trim();
  const customerFound =
    allCustomers.find(c => c.gstin && c.gstin.trim().toUpperCase() === extractedGstin) ||
    allCustomers.find(c => c.name && c.name.toLowerCase().includes(extractedName.slice(0, 20))) ||
    allCustomers.find(c => c.name && extractedName.includes(c.name.toLowerCase().slice(0, 15)));

  // Price list resolution
  let priceListUsed = null, rateSource = 'none';
  if (customerFound?.price_list) {
    priceListUsed = customerFound.price_list;
    rateSource = `customer:${customerFound.name}`;
  } else if (customerFound?.customer_group) {
    const grp = customerFound.customer_group.toLowerCase();
    const pls = [...new Set(allRates.map(r => r.price_list).filter(Boolean))];
    const gm = pls.find(pl => pl.toLowerCase().includes(grp) || grp.includes(pl.toLowerCase()));
    if (gm) { priceListUsed = gm; rateSource = `group:${customerFound.customer_group}`; }
  }
  if (!priceListUsed && parsedData.platform !== 'direct' && parsedData.platform !== 'unknown') {
    const pls = [...new Set(allRates.map(r => r.price_list).filter(Boolean))];
    const pm = pls.find(pl => pl.toLowerCase().includes(parsedData.platform.toLowerCase()));
    if (pm) { priceListUsed = pm; rateSource = `platform:${parsedData.platform}`; }
  }

  const filteredRates = priceListUsed ? allRates.filter(r => r.price_list === priceListUsed) : allRates;
  const rateByItemCode = {}, rateByEAN = {}, rateByNameWords = [];
  for (const r of filteredRates) {
    if (r.item_code) rateByItemCode[r.item_code.trim()] = r;
    if (r.ean_number) rateByEAN[r.ean_number.trim()] = r;
    if (r.item_name) rateByNameWords.push({ r, words: r.item_name.toLowerCase().split(' ').filter(w => w.length > 3) });
  }

  // Enrich items
  let matchedCount = 0;
  const enrichedItems = (parsedData.items || []).map(item => {
    let resolvedItemCode = item.item_code || '';
    const pdfCode = (item.sku_code || item.item_code || '').trim().toUpperCase();
    const pdfEAN = (item.ean_number || '').trim().toUpperCase();
    if (pdfCode && barcodeToItemCode[pdfCode]) resolvedItemCode = barcodeToItemCode[pdfCode];
    else if (pdfEAN && barcodeToItemCode[pdfEAN]) resolvedItemCode = barcodeToItemCode[pdfEAN];

    let product = resolvedItemCode ? productByCode[resolvedItemCode.toUpperCase()] : null;
    if (!product && pdfEAN) { product = productByEAN[pdfEAN]; if (product) resolvedItemCode = product.item_code; }
    if (!product && item.description) {
      const dl = item.description.toLowerCase();
      const f = productByName.find(({ words }) => words.filter(w => dl.includes(w)).length >= Math.min(2, words.length));
      if (f) { product = f.p; resolvedItemCode = f.p.item_code; }
    }

    let rm = (resolvedItemCode && rateByItemCode[resolvedItemCode.trim()])
      || (item.sku_code && rateByItemCode[item.sku_code.trim()])
      || (item.ean_number && rateByEAN[item.ean_number.trim()]);
    if (!rm && item.description) {
      const dl = item.description.toLowerCase();
      rm = rateByNameWords.find(({ words }) => words.filter(w => dl.includes(w)).length >= Math.min(2, words.length))?.r;
    }

    const enriched = { ...item };
    if (resolvedItemCode) enriched.item_code = resolvedItemCode;
    if (product) {
      enriched.hsn_code = product.hsn_code || enriched.hsn_code || '22029990';
      enriched.packing_unit = product.bottles_per_box || enriched.packing_unit || 12;
      enriched._product_name = product.product_name;
      enriched._product_matched = true;
    }
    if (rm) {
      matchedCount++;
      enriched.item_code = rm.item_code || enriched.item_code;
      enriched.hsn_code = rm.hsn_code || enriched.hsn_code || '22029990';
      enriched.packing_unit = rm.packing_unit || enriched.packing_unit || 12;
      enriched.rate_snapshot = rm.rate;
      enriched.unit_base_cost = rm.rate;
      enriched.mrp = rm.mrp || enriched.mrp;
      enriched.igst_rate = rm.igst_rate ?? enriched.igst_rate;
      enriched._rate_matched = true;
      enriched._price_list = priceListUsed;
    } else {
      enriched.hsn_code = enriched.hsn_code || '22029990';
      enriched._rate_matched = false;
    }
    return enriched;
  });

  const enrichedData = { ...parsedData, items: enrichedItems };

  // Merge customer fields
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
  enrichedData._total_items = enrichedItems.length;
  enrichedData._product_matched_count = enrichedItems.filter(i => i._product_matched).length;
  enrichedData._no_rate = !priceListUsed && matchedCount === 0;
  enrichedData._parse_method = 'browser_regex';

  return enrichedData;
}