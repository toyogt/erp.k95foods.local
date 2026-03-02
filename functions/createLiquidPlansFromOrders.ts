import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'POST required' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.role !== 'production_manager')) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { selectedLineIds, skuProducts } = await req.json();

    if (!selectedLineIds || !Array.isArray(selectedLineIds) || selectedLineIds.length === 0) {
      return Response.json({ error: 'No lines selected' }, { status: 400 });
    }

    // Fetch order lines
    const allLines = await base44.entities.ProductionOrderLine.list('-created_date', 1000);
    const lines = allLines.filter(l => selectedLineIds.includes(l.id));

    if (lines.length === 0) {
      return Response.json({ error: 'Lines not found' }, { status: 404 });
    }

    // Fetch all products for snapshot
    const allProducts = await base44.entities.ProductMaster.list('-created_date', 500);

    // Group by recipe_id
    const grouped = {};
    for (const line of lines) {
      const product = allProducts.find(p => p.item_code === line.sku_code);
      const recipeId = product?.recipe_id || 'UNKNOWN';
      if (!grouped[recipeId]) {
        grouped[recipeId] = {
          recipe_id: recipeId,
          recipe_name: product?.recipe_id ? (await base44.entities.RecipeMaster.filter({ recipe_id: recipeId })).map(r => r.recipe_name)[0] || recipeId : recipeId,
          lines: [],
          orderIds: new Set(),
        };
      }
      grouped[recipeId].lines.push(line);
      grouped[recipeId].orderIds.add(line.order_id);
    }

    const createdPlans = [];

    // For each recipe group, create plan and allocations
    for (const [recipeId, group] of Object.entries(grouped)) {
      const planId = `LBP-${Date.now()}-${recipeId.slice(0, 5).replace(/[^A-Z0-9]/g, 'X')}`;

      // Create LiquidBatchPlan
      const plan = await base44.entities.LiquidBatchPlan.create({
        plan_id: planId,
        recipe_id: group.recipe_id,
        recipe_name: group.recipe_name,
        status: 'RELEASED',
        linked_order_ids: Array.from(group.orderIds).join(','),
      });

      // Create SKUAllocations and PackingWOs
      let woSeq = 1;
      for (const line of group.lines) {
        const allocId = `ALLOC-${planId}-${woSeq}`;

        // Create SKUAllocation
        await base44.entities.SKUAllocation.create({
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

        // Get product info for PackingWO
        const product = allProducts.find(p => p.item_code === line.sku_code);

        // Create PackingWO
        const woId = `WO-${planId}-${woSeq}`;
        await base44.entities.PackingWO.create({
          wo_id: woId,
          product: product?.product_name || line.sku_code,
          label_sku_code: line.sku_code,
          bottle_type: product?.bottle_type || '',
          target_bottles: line.required_bottles,
          assigned_line: '',
          status: 'RELEASED',
          batch_id: '',
        });

        woSeq++;
      }

      createdPlans.push({
        plan_id: planId,
        recipe_id: group.recipe_id,
        allocations: group.lines.length,
      });
    }

    return Response.json({
      success: true,
      plansCreated: createdPlans.length,
      plans: createdPlans,
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});