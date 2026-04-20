import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { item_name, item_category } = await req.json();
    if (!item_name?.trim()) {
      return Response.json({ error: 'Item name is required' }, { status: 400 });
    }

    // Fetch existing item codes to avoid duplicates
    const existingItems = await base44.asServiceRole.entities.StoreItemMaster.filter({}, 'item_code', 1000);
    const existingCodes = new Set(existingItems.map(i => (i.item_code || '').toUpperCase()));

    const categoryLabel = item_category || 'other';

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are an ERP item code generator. Generate a SHORT, MEANINGFUL item code for a store inventory item.

Item Name: "${item_name.trim()}"
Category: "${categoryLabel}"

RULES:
1. Code MUST be 4-10 characters long (including hyphens)
2. Use UPPERCASE letters and hyphens only (no numbers, no spaces, no special characters)
3. Code must be a meaningful abbreviation that helps identify the item at a glance
4. Use category prefix (2-3 chars) followed by hyphen, then item abbreviation (2-6 chars)
5. Category prefixes: ingredient=ING, box_type=BOX, cap_type=CAP, container=CTN, flavour=FLV, label_artwork=LBL, packaging=PKG, other=GEN
6. For the item part, pick the most recognizable abbreviation of the key words
7. Examples: "Sugar" → ING-SGR, "Mango Flavour" → FLV-MNG, "500ml PET Bottle" → CTN-PET5, "Corrugated Box 12x6" → BOX-CR12, "Red Cap 28mm" → CAP-R28

These codes already exist, so DO NOT generate any of these: ${[...existingCodes].slice(0, 200).join(', ')}

Return ONLY a JSON object, nothing else:
{"code": "YOUR-CODE", "alternatives": ["ALT-1", "ALT-2"]}`,
      response_json_schema: {
        type: "object",
        properties: {
          code: { type: "string", description: "Primary suggested item code" },
          alternatives: { type: "array", items: { type: "string" }, description: "2 alternative suggestions" }
        }
      }
    });

    // Validate primary code doesn't collide
    let finalCode = (result.code || '').toUpperCase().trim();
    const alts = (result.alternatives || []).map(a => a.toUpperCase().trim());

    if (existingCodes.has(finalCode)) {
      // Try alternatives
      const validAlt = alts.find(a => !existingCodes.has(a));
      if (validAlt) {
        finalCode = validAlt;
      } else {
        // Append a number suffix
        let suffix = 1;
        while (existingCodes.has(`${finalCode}${suffix}`)) suffix++;
        finalCode = `${finalCode}${suffix}`;
      }
    }

    return Response.json({
      item_code: finalCode,
      alternatives: alts.filter(a => a !== finalCode && !existingCodes.has(a)).slice(0, 2)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});