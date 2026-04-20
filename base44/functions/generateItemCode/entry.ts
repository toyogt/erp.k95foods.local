import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { item_name, item_category } = await req.json();

    if (!item_name || !item_name.trim()) {
      return Response.json({ error: 'Item name is required' }, { status: 400 });
    }

    // Category prefix map
    const CATEGORY_PREFIX = {
      ingredient: 'ING',
      box_type: 'BOX',
      cap_type: 'CAP',
      container: 'CNT',
      flavour: 'FLV',
      label_artwork: 'LBL',
      packaging: 'PKG',
      other: 'GEN',
    };

    const prefix = CATEGORY_PREFIX[item_category] || 'GEN';

    // Use AI to generate a short, meaningful suffix from the item name
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate a SHORT item code suffix for an inventory item.

Item Name: "${item_name.trim()}"
Category: "${item_category || 'other'}"

Rules:
- Output ONLY the suffix (no prefix, no explanation)
- Must be 3-8 characters long
- Use UPPERCASE letters and numbers only
- No spaces, no hyphens, no special characters
- Make it a meaningful abbreviation of the item name
- Extract the most important/distinctive parts of the name
- Examples:
  "Sodium Benzoate Powder" → "SBNZT"
  "Corrugated Box 12x8" → "CB12X8"
  "HDPE Cap Blue 28mm" → "HCBL28"
  "Mango Flavour Concentrate" → "MNGCON"
  "Shrink Wrap Film 100mm" → "SWF100"
  "Glass Bottle 500ml" → "GB500"
  "Orange Peel Extract" → "OPEXT"

Output ONLY the code suffix, nothing else.`,
      response_json_schema: {
        type: "object",
        properties: {
          suffix: { type: "string", description: "The generated code suffix, 3-8 uppercase alphanumeric chars" }
        },
        required: ["suffix"]
      }
    });

    let suffix = (result.suffix || '').toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8);

    // Fallback: if AI returned empty, create one from the item name
    if (!suffix || suffix.length < 2) {
      suffix = item_name.trim().toUpperCase()
        .replace(/[^A-Z0-9\s]/g, '')
        .split(/\s+/)
        .map(w => w.substring(0, 2))
        .join('')
        .substring(0, 8);
    }

    const baseCode = `${prefix}-${suffix}`;

    // Check for duplicates and add numeric suffix if needed
    const existing = await base44.asServiceRole.entities.StoreItemMaster.filter(
      {}, 'item_code', 500
    );
    const existingCodes = new Set(existing.map(e => (e.item_code || '').toUpperCase()));

    let finalCode = baseCode;
    let counter = 1;
    while (existingCodes.has(finalCode.toUpperCase())) {
      finalCode = `${baseCode}-${String(counter).padStart(2, '0')}`;
      counter++;
    }

    return Response.json({ item_code: finalCode });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});