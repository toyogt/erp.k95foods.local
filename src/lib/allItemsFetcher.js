import { base44 } from '@/api/base44Client';

/**
 * Fetches all items from the All Items source entities and normalizes them
 * into a uniform shape for display in Opening Stock and other consumers.
 */

const CATEGORY_LABELS = {
  ingredient: 'Ingredient',
  ingredient_brand: 'Ingredient (Brand)',
  box_type: 'Box Type',
  cap_type: 'Cap Type',
  container: 'Container',
  flavour: 'Flavour',
  label_artwork: 'Label Artwork',
};

export { CATEGORY_LABELS };

export async function fetchAllSystemItems() {
  const [ingredientItems, ingredientMasters, boxes, caps, containers, flavours, artworks] = await Promise.all([
    base44.entities.IngredientItem.list('brand_name', 500).catch(() => []),
    base44.entities.IngredientMaster.list('ingredient_name', 500).catch(() => []),
    base44.entities.BoxType.list('box_name', 500).catch(() => []),
    base44.entities.CapType.list('cap_name', 500).catch(() => []),
    base44.entities.ContainerType.list('auto_generated_name', 500).catch(() => []),
    base44.entities.FlavourMaster.list('flavour_name', 500).catch(() => []),
    base44.entities.LabelArtwork.list('artwork_name', 500).catch(() => []),
  ]);

  const items = [];

  // Ingredient specs
  ingredientMasters.filter(m => m.ingredient_name && m.is_active !== false).forEach(m => {
    items.push({
      id: m.id,
      item_code: m.ingredient_id || m.short_code || '',
      item_name: `${m.ingredient_name}${m.short_code ? ' (' + m.short_code + ')' : ''}`,
      item_category: 'ingredient',
      uom: m.uom_id || 'Kg',
      source_entity: 'IngredientMaster',
      source_id: m.id,
      batch_required: true,
      expiry_required: true,
      mfg_date_required: true,
    });
  });

  // Ingredient brand items
  ingredientItems.filter(i => i.brand_name).forEach(i => {
    items.push({
      id: i.id,
      item_code: i.ingredient_id || '',
      item_name: `${i.brand_name}${i.ingredient_id ? ' (' + i.ingredient_id + ')' : ''}`,
      item_category: 'ingredient_brand',
      uom: i.uom || 'Kg',
      source_entity: 'IngredientItem',
      source_id: i.id,
      batch_required: true,
      expiry_required: true,
      mfg_date_required: true,
    });
  });

  // Box types
  boxes.forEach(b => {
    items.push({
      id: b.id,
      item_code: b.box_type_id || b.box_code || '',
      item_name: b.box_name || '',
      item_category: 'box_type',
      uom: 'Nos',
      source_entity: 'BoxType',
      source_id: b.id,
      batch_required: false,
      expiry_required: false,
      mfg_date_required: false,
    });
  });

  // Cap types
  caps.forEach(c => {
    items.push({
      id: c.id,
      item_code: c.cap_sku_code || '',
      item_name: c.cap_name || '',
      item_category: 'cap_type',
      uom: 'Nos',
      source_entity: 'CapType',
      source_id: c.id,
      batch_required: false,
      expiry_required: false,
      mfg_date_required: false,
    });
  });

  // Containers
  containers.forEach(c => {
    items.push({
      id: c.id,
      item_code: c.container_code || '',
      item_name: c.auto_generated_name || `${c.ml_per_container}ml ${c.colour} ${c.container_type}`,
      item_category: 'container',
      uom: c.uom || 'Pcs',
      source_entity: 'ContainerType',
      source_id: c.id,
      batch_required: false,
      expiry_required: false,
      mfg_date_required: false,
    });
  });

  // Flavours
  flavours.forEach(f => {
    items.push({
      id: f.id,
      item_code: '',
      item_name: `${f.flavour_name || ''} (${f.brand_name || ''} - ${f.family_name || ''})`,
      item_category: 'flavour',
      uom: 'Ltr',
      source_entity: 'FlavourMaster',
      source_id: f.id,
      batch_required: true,
      expiry_required: true,
      mfg_date_required: true,
    });
  });

  // Label artworks
  artworks.forEach(a => {
    items.push({
      id: a.id,
      item_code: a.artwork_id || '',
      item_name: a.artwork_name || '',
      item_category: 'label_artwork',
      uom: 'Nos',
      source_entity: 'LabelArtwork',
      source_id: a.id,
      batch_required: false,
      expiry_required: false,
      mfg_date_required: false,
    });
  });

  return items;
}