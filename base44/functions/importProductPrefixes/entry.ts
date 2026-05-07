import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FILE_URL = 'https://media.base44.com/files/public/69d9e3266866e06835189ca7/bf004c64f_CopyofBatchNumberSheetFactory1.xlsx';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Extract Master Sheet — first sheet in file
    const extracted = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url: FILE_URL,
      json_schema: {
        type: 'object',
        description: 'One product row from the first sheet (Master Sheet) of the Excel file',
        properties: {
          product:    { type: 'string', description: 'Column named "Product"' },
          flavour:    { type: 'string', description: 'Column named "Flavour"' },
          product_id: { type: 'string', description: 'Column named "Product ID" — short codes like 03HC, 02GL, KFB, 01GL' },
          mrp:        { type: 'number', description: 'Column named "MRP"' },
        }
      }
    });

    if (extracted.status !== 'success' || !Array.isArray(extracted.output)) {
      return Response.json({ error: 'Extraction failed', details: extracted.details }, { status: 500 });
    }

    // Filter and deduplicate by product_id (keep first occurrence per unique product_id)
    const seenId = new Set();
    const rows = [];
    for (const r of extracted.output) {
      if (!r.product_id || !r.flavour || !r.product) continue;
      const id = r.product_id.trim().toUpperCase();
      if (seenId.has(id)) continue;
      seenId.add(id);
      rows.push({ ...r, product_id: id });
    }

    // Parse product_id → {prefix, flavour_code}
    // "01GL" → prefix="01", flavour_code="GL"
    // "KFB"  → prefix="KFB", flavour_code=""
    function parseId(id) {
      const m = id.match(/^(\d{1,2})([A-Z]{2,4})$/);
      if (m) return { prefix: m[1], flavour_code: m[2] };
      return { prefix: id, flavour_code: '' };
    }

    // Infer sugar/brand level from sheet product name
    function brandKey(product) {
      const p = (product || '').toLowerCase();
      if (p.includes('zero sugar')) return 'zero';
      if (p.includes('low sugar')) return 'low';
      if (p.includes('swiggy') || p.includes('noice')) return 'swiggy';
      if (p.includes('good trip')) return 'goodtrip';
      if (p.includes('gulabo') || p.includes('gb')) return 'gulabo';
      if (p.includes('pop edition') || p.includes('nikki')) return 'pop';
      if (p.includes('gold')) return 'gold';
      if (p.includes('darjeeling')) return 'darjeeling';
      return 'other';
    }

    function norm(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

    // Check if a ProductMaster matches the brand/sugar key
    function pmMatchesBrand(pm, key) {
      const n = norm((pm.product_name || '') + (pm.item_code || '') + (pm.brand_name || '') + (pm.flavour || ''));
      switch (key) {
        case 'zero':       return n.includes('zero') && !n.includes('low');
        case 'low':        return n.includes('low') && !n.includes('zero');
        case 'swiggy':     return n.includes('swiggy') || n.includes('noice') || n.includes('kfb');
        case 'goodtrip':   return n.includes('goodtrip') || (n.includes('good') && n.includes('trip')) || n.includes('icedte') || n.includes('icedtea');
        case 'gulabo':     return n.includes('gulabo');
        case 'pop':        return n.includes('pop') || n.includes('popedition') || n.includes('cherr');
        case 'gold':       return n.includes('gold') || n.includes('sama') || n.includes('margarita');
        case 'darjeeling': return n.includes('darj');
        default:           return true;
      }
    }

    // Load all ProductMaster records
    const products = await base44.asServiceRole.entities.ProductMaster.list('-created_date', 1000);

    function findBestMatch(row, products) {
      const flavourNorm = norm(row.flavour);
      const key = brandKey(row.product);

      // Step 1: filter by brand/sugar key FIRST (strict — no fallback)
      const brandPool = products.filter(p => pmMatchesBrand(p, key));
      if (brandPool.length === 0) return null; // no products of this brand in our DB

      // Step 2: flavour substring match within brand pool
      const flavourWords = flavourNorm.match(/[a-z]{3,}/g) || [];
      const flavourPool = brandPool.filter(p => {
        const pf = norm(p.flavour || '');
        return flavourWords.some(w => pf.includes(w));
      });

      if (flavourPool.length === 0) return null;

      // Step 3: MRP match as tiebreaker
      if (row.mrp && flavourPool.length > 1) {
        const mrpPool = flavourPool.filter(p => p.mrp && Math.abs(p.mrp - row.mrp) < 1);
        if (mrpPool.length >= 1) return mrpPool[0];
      }

      return flavourPool[0];
    }

    let updated = 0;
    let skipped = 0;
    const matched = [];
    const unmatched = [];
    const alreadyUpdated = new Set();

    for (const row of rows) {
      const { prefix, flavour_code } = parseId(row.product_id);
      const candidate = findBestMatch(row, products);

      if (!candidate) {
        unmatched.push({ product: row.product, flavour: row.flavour, product_id: row.product_id });
        skipped++;
        continue;
      }

      if (alreadyUpdated.has(candidate.id)) {
        skipped++;
        continue;
      }

      await base44.asServiceRole.entities.ProductMaster.update(candidate.id, {
        product_prefix_code: prefix,
        flavour_code,
      });

      alreadyUpdated.add(candidate.id);
      matched.push({
        item_code: candidate.item_code,
        product_name: candidate.product_name,
        sheet_product: row.product,
        sheet_flavour: row.flavour,
        product_id: row.product_id,
        prefix,
        flavour_code,
      });
      updated++;
    }

    return Response.json({
      success: true,
      total_unique_ids: rows.length,
      updated,
      skipped,
      matched,
      unmatched,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});