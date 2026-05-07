import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  const FILE_URL = 'https://media.base44.com/files/public/69d9e3266866e06835189ca7/520dffbfe_Item15.xlsx';

  // Extract all rows from the Excel file
  const extracted = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
    file_url: FILE_URL,
    json_schema: {
      type: 'object',
      description: 'One row from the Excel Item sheet',
      properties: {
        item_code:         { type: 'string',  description: 'Column: Item Code' },
        item_name:         { type: 'string',  description: 'Column: Item Name' },
        mrp:               { type: 'number',  description: 'Column: MRP' },
        hsn_code:          { type: 'string',  description: 'Column: HSN/SAC' },
        swiggy_item_id:    { type: 'string',  description: 'Column: Swiggy Item ID' },
        bigbasket_item_id: { type: 'string',  description: 'Column: Big Basket Item ID' },
        zepto_item_id:     { type: 'string',  description: 'Column: Zepto Item ID' },
        blinkit_item_id:   { type: 'string',  description: 'Column: Blinkit Item ID' },
        flavour:           { type: 'string',  description: 'Column: Flavour' },
        fssai_no:          { type: 'string',  description: 'Column: FSSAI No' },
        shelf_life_days:   { type: 'number',  description: 'Column: Shelf Life In Days' },
        bottles_per_box:   { type: 'number',  description: 'Column: Bottles per Box' },
        is_disabled:       { type: 'number',  description: 'Column: Disabled' },
        product_barcode:   { type: 'string',  description: 'Column: EAN Code' },
        brand_name:        { type: 'string',  description: 'Column: Brand' },
        item_group:        { type: 'string',  description: 'Column: Item Group' },
        description:       { type: 'string',  description: 'Column: Description' },
      }
    }
  });

  let rows = [];
  if (Array.isArray(extracted.output)) {
    rows = extracted.output;
  } else {
    return Response.json({ error: 'Unexpected output format', raw: JSON.stringify(extracted.output).slice(0, 300) }, { status: 500 });
  }

  // Separate finished goods (→ ProductMaster) from raw materials/consumables (→ ItemMaster)
  const PRODUCT_GROUPS = ['Kombucha', 'Finished Good', 'Finished Goods'];
  const ITEM_MASTER_GROUPS = ['Raw Material', 'Consumable', 'Packaging', 'Semi Finished Good'];

  const productRows = rows.filter(r => PRODUCT_GROUPS.some(g => (r.item_group || '').toLowerCase().includes(g.toLowerCase())));
  const itemRows = rows.filter(r => !PRODUCT_GROUPS.some(g => (r.item_group || '').toLowerCase().includes(g.toLowerCase())));

  // Map to ProductMaster schema
  const productRecords = productRows.map(r => {
    const isTrialPack = (r.item_name || '').toLowerCase().includes('trial pack') || (r.item_name || '').toLowerCase().includes('trail pack');
    return {
      item_code:           (r.item_code || '').trim(),
      product_name:        (r.item_name || '').trim(),
      mrp:                 r.mrp || 0,
      hsn_code:            r.hsn_code || '',
      swiggy_item_id:      r.swiggy_item_id || '',
      bigbasket_item_id:   r.bigbasket_item_id || '',
      zepto_item_id:       r.zepto_item_id || '',
      flavour:             r.flavour || '',
      fssai_no:            r.fssai_no || '',
      shelf_life_days:     r.shelf_life_days || 0,
      bottles_per_box:     r.bottles_per_box || 0,
      is_active:           r.is_disabled === 0 || r.is_disabled === null,
      product_barcode:     r.product_barcode || '',
      brand_name:          r.brand_name || '',
      product_family:      r.item_group || '',
      is_trial_pack:       isTrialPack,
      blinkit_item_id:     r.blinkit_item_id || '',
    };
  }).filter(r => r.item_code);

  // Map to ItemMaster schema
  const itemRecords = itemRows.map(r => {
    let category = 'CONSUMABLE';
    const group = (r.item_group || '').toLowerCase();
    if (group.includes('raw material')) category = 'INGREDIENT';
    else if (group.includes('packaging')) category = 'PACKAGING_BOX';
    else if (group.includes('consumable')) category = 'CONSUMABLE';

    return {
      item_code:  (r.item_code || '').trim(),
      item_name:  (r.item_name || '').trim(),
      category,
      base_uom:   'PCS',
      barcode:    r.product_barcode || '',
      notes:      r.description || '',
      is_active:  r.is_disabled === 0 || r.is_disabled === null,
    };
  }).filter(r => r.item_code);

  // Fetch existing records to avoid duplicates
  const [existingProducts, existingItems] = await Promise.all([
    base44.asServiceRole.entities.ProductMaster.list('-created_date', 1000),
    base44.asServiceRole.entities.ItemMaster.list('-created_date', 1000),
  ]);

  const existingProductCodes = new Set(existingProducts.map(p => p.item_code));
  const existingItemCodes = new Set(existingItems.map(i => i.item_code));

  const newProducts = productRecords.filter(p => !existingProductCodes.has(p.item_code));
  const newItems = itemRecords.filter(i => !existingItemCodes.has(i.item_code));

  const updateProducts = productRecords.filter(p => existingProductCodes.has(p.item_code));
  const updateItems = itemRecords.filter(i => existingItemCodes.has(i.item_code));

  let createdProducts = 0, createdItems = 0, updatedProducts = 0, updatedItems = 0;

  // Create new records in batches
  if (newProducts.length > 0) {
    await base44.asServiceRole.entities.ProductMaster.bulkCreate(newProducts);
    createdProducts = newProducts.length;
  }
  if (newItems.length > 0) {
    await base44.asServiceRole.entities.ItemMaster.bulkCreate(newItems);
    createdItems = newItems.length;
  }

  // Update existing records
  for (const p of updateProducts) {
    const existing = existingProducts.find(e => e.item_code === p.item_code);
    if (existing) {
      await base44.asServiceRole.entities.ProductMaster.update(existing.id, p);
      updatedProducts++;
    }
  }
  for (const i of updateItems) {
    const existing = existingItems.find(e => e.item_code === i.item_code);
    if (existing) {
      await base44.asServiceRole.entities.ItemMaster.update(existing.id, i);
      updatedItems++;
    }
  }

  return Response.json({
    success: true,
    summary: {
      total_rows_in_file: rows.length,
      product_master: { created: createdProducts, updated: updatedProducts, total: productRecords.length },
      item_master: { created: createdItems, updated: updatedItems, total: itemRecords.length },
    },
    product_codes_imported: productRecords.map(p => p.item_code),
    item_codes_imported: itemRecords.map(i => i.item_code),
  });
});