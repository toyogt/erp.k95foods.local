import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Auto-sync: When a new item is created in any All Items entity
 * (ContainerType, CapType, BoxType, IngredientMaster, FlavourMaster, LabelArtwork, IngredientItem),
 * automatically create a corresponding StoreItemMaster record.
 *
 * Triggered by entity automations on "create" events.
 */

const ENTITY_CONFIG = {
  ContainerType: {
    category: 'container',
    getName: (d) => d.auto_generated_name || `${d.ml_per_container}ml ${d.colour} ${d.container_type}`,
    getCode: (d) => d.container_code || '',
    getUom: () => 'Pcs',
    getPhoto: () => '',
    defaultRules: { batch_required: false, expiry_required: false, mfg_date_required: false },
  },
  CapType: {
    category: 'cap_type',
    getName: (d) => d.cap_name || '',
    getCode: (d) => d.cap_sku_code || '',
    getUom: () => 'Nos',
    getPhoto: (d) => d.cap_photo_url || '',
    defaultRules: { batch_required: false, expiry_required: false, mfg_date_required: false },
  },
  BoxType: {
    category: 'box_type',
    getName: (d) => d.box_name || '',
    getCode: (d) => d.box_type_id || d.box_code || '',
    getUom: () => 'Nos',
    getPhoto: () => '',
    defaultRules: { batch_required: false, expiry_required: false, mfg_date_required: false },
  },
  IngredientMaster: {
    category: 'ingredient',
    getName: (d) => `${d.ingredient_name || ''}${d.short_code ? ' (' + d.short_code + ')' : ''}`,
    getCode: (d) => d.ingredient_id || d.short_code || '',
    getUom: (d) => d.uom_id || 'Kg',
    getPhoto: () => '',
    defaultRules: { batch_required: true, expiry_required: true, mfg_date_required: true },
  },
  IngredientItem: {
    category: 'ingredient',
    getName: (d) => `${d.brand_name || ''}${d.ingredient_id ? ' (' + d.ingredient_id + ')' : ''}`,
    getCode: () => '',
    getUom: (d) => d.uom || 'Kg',
    getPhoto: () => '',
    defaultRules: { batch_required: true, expiry_required: true, mfg_date_required: true },
  },
  FlavourMaster: {
    category: 'flavour',
    getName: (d) => `${d.flavour_name || ''} (${d.brand_name || ''} - ${d.family_name || ''})`,
    getCode: () => '',
    getUom: () => 'Ltr',
    getPhoto: () => '',
    defaultRules: { batch_required: true, expiry_required: true, mfg_date_required: true },
  },
  LabelArtwork: {
    category: 'label_artwork',
    getName: (d) => d.artwork_name || '',
    getCode: (d) => d.artwork_id || '',
    getUom: () => 'Nos',
    getPhoto: (d) => d.preview_url || '',
    defaultRules: { batch_required: false, expiry_required: false, mfg_date_required: false },
  },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { event, data } = body;
    if (!event || !data) {
      return Response.json({ error: 'Missing event or data' }, { status: 400 });
    }

    const entityName = event.entity_name;
    const entityId = event.entity_id;

    const config = ENTITY_CONFIG[entityName];
    if (!config) {
      return Response.json({ skipped: true, reason: `Unknown entity: ${entityName}` });
    }

    // Skip inactive items for IngredientMaster
    if (entityName === 'IngredientMaster' && data.is_active === false) {
      return Response.json({ skipped: true, reason: 'Inactive ingredient' });
    }

    // Skip IngredientItem without brand_name
    if (entityName === 'IngredientItem' && !data.brand_name) {
      return Response.json({ skipped: true, reason: 'No brand name' });
    }

    // Check if StoreItemMaster already has a record for this source
    const existing = await base44.asServiceRole.entities.StoreItemMaster.filter({
      source_entity: entityName,
      source_id: entityId,
    });

    if (existing && existing.length > 0) {
      return Response.json({ skipped: true, reason: 'Already exists in Store Item Master' });
    }

    const itemName = config.getName(data);
    if (!itemName || !itemName.trim()) {
      return Response.json({ skipped: true, reason: 'Empty item name' });
    }

    const newItem = {
      item_name: itemName.trim(),
      item_code: config.getCode(data),
      item_category: config.category,
      source_entity: entityName,
      source_id: entityId,
      uom: config.getUom(data),
      material_photo: config.getPhoto(data),
      is_active: true,
      opening_stock: 0,
      opening_lot_id: '',
      opening_stock_location_id: '',
      opening_stock_location_code: '',
      ...config.defaultRules,
      qc_required: false,
      min_shelf_life_days: 0,
    };

    const created = await base44.asServiceRole.entities.StoreItemMaster.create(newItem);

    console.log(`Auto-synced ${entityName} "${itemName}" → StoreItemMaster (id: ${created.id})`);

    return Response.json({ success: true, store_item_id: created.id, item_name: itemName });
  } catch (error) {
    console.error('Auto-sync error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});