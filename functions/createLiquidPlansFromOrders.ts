import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function genId(prefix) {
  return prefix + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST required' }, { status: 405 });

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'production_manager')) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { selectedLineIds, optionOverrides } = await req.json();
    // optionOverrides: { [recipe_group_id]: option_id }  — optional, falls back to default option

    if (!selectedLineIds?.length) return Response.json({ error: 'No lines selected' }, { status: 400 });

    const [allLines, allProducts, allOptions] = await Promise.all([
      base44.asServiceRole.entities.ProductionOrderLine.list('-created_date', 1000),
      base44.asServiceRole.entities.ProductMaster.list('-created_date', 500),
      base44.asServiceRole.entities.RecipeOption.list('-created_date', 500).catch(() => []),
    ]);

    const lines = allLines.filter(l => selectedLineIds.includes(l.id));
    if (lines.length === 0) return Response.json({ error: 'Lines not found' }, { status: 404 });

    // Group lines by recipe_group_id
    const grouped = {};
    for (const line of lines) {
      const product = allProducts.find(p => p.item_code === line.sku_code);
      const groupId = product?.recipe_group_id || 'UNKNOWN';
      if (!grouped[groupId]) {
        grouped[groupId] = { recipe_group_id: groupId, lines: [], orderIds: new Set() };
      }
      grouped[groupId].lines.push({ ...line, _product: product });
      grouped[groupId].orderIds.add(line.order_id);
    }

    // Fetch recipe groups for names
    const recipeGroups = await base44.asServiceRole.entities.RecipeGroup.list('-created_date', 200).catch(() => []);

    const createdPlans = [];

    for (const [groupId, group] of Object.entries(grouped)) {
      const rg = recipeGroups.find(g => g.recipe_group_id === groupId);
      const planId = genId('LP');

      // Determine option: caller can pass optionOverrides[groupId], else pick default
      let optionId = optionOverrides?.[groupId] || null;
      if (!optionId) {
        const groupOpts = allOptions.filter(o => o.recipe_group_id === groupId && o.is_active !== false);
        const defaultOpt = groupOpts.find(o => o.is_default) || groupOpts[0];
        optionId = defaultOpt?.option_id || null;
      }

      // Create LiquidBatchPlan (using recipe_id/recipe_name fields for compatibility)
      await base44.asServiceRole.entities.LiquidBatchPlan.create({
        plan_id: planId,
        recipe_id: groupId,
        recipe_name: rg?.recipe_name || groupId,
        status: 'RELEASED',
        linked_order_ids: Array.from(group.orderIds).join(','),
      });

      let seq = 1;
      for (const line of group.lines) {
        const allocId = genId('AL');

        await base44.asServiceRole.entities.SKUAllocation.create({
          allocation_id: allocId,
          plan_id: planId,
          order_id: line.order_id,
          order_line_id: line.id,
          sku_code: line.sku_code,
          allocation_type: 'FIXED',
          target_bottles_requested: line.target_bottles_requested,
          required_bottles: line.required_bottles,
          produced_bottles_packed: 0,
          status: 'RELEASED',
        });

        // Create PackingWO for compatibility with downstream
        const woId = `WO-${planId}-${seq}`;
        await base44.asServiceRole.entities.PackingWO.create({
          wo_id: woId,
          product: line._product?.product_name || line.sku_code,
          label_sku_code: line.sku_code,
          bottle_type: line._product?.bottle_type || '',
          target_bottles: line.required_bottles,
          assigned_line: '',
          status: 'RELEASED',
          batch_id: '',
        });
        seq++;
      }

      createdPlans.push({ plan_id: planId, recipe_group_id: groupId, allocations: group.lines.length });
    }

    return Response.json({ success: true, plansCreated: createdPlans.length, plans: createdPlans });
  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});