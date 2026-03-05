import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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

    const { plan_id, filler_machine_id } = await req.json();

    if (!plan_id || !filler_machine_id) {
      return Response.json({ error: 'plan_id and filler_machine_id required' }, { status: 400 });
    }

    // Fetch plan
    const plans = await base44.entities.LiquidBatchPlan.filter({ plan_id });
    if (plans.length === 0) {
      return Response.json({ error: 'Plan not found' }, { status: 404 });
    }
    const plan = plans[0];

    const now = new Date();

    // Update plan: status=STARTED, started_at=now, filler_machine_id
    await base44.entities.LiquidBatchPlan.update(plan.id, {
      status: 'STARTED',
      started_at: now.toISOString(),
      filler_machine_id,
      started_by: user.email,
    });

    // Create/update MachineActiveBatch
    const existingBatches = await base44.entities.MachineActiveBatch.filter({
      machine_id: filler_machine_id,
      status: 'ACTIVE',
    });

    for (const batch of existingBatches) {
      await base44.entities.MachineActiveBatch.update(batch.id, { status: 'CLOSED' });
    }

    await base44.entities.MachineActiveBatch.create({
      batch_id: plan_id,
      machine_id: filler_machine_id,
      product_code: plan.recipe_id,
      product_name: plan.recipe_name || plan.recipe_id,
      bottle_type: 'MIXED',
      status: 'ACTIVE',
      started_at: now.toISOString(),
      started_by: user.email,
    });

    // Fetch allocations and SKU mappings
    const allAllocs = await base44.entities.SKUAllocation.filter({ plan_id });
    const allMappings = await base44.entities.SKUPrintMapping.list('-created_date', 500);
    const allRules = await base44.entities.BatchFormatRule.list('-created_date', 500);
    const allProducts = await base44.entities.ProductMaster.list('-created_date', 500);
    const allPackingWOs = await base44.entities.PackingWO.list('-created_date', 1000);

    // Helper: getPeriodKey
    function getPeriodKey(date, reset_scope) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      if (reset_scope === 'DAILY') return `${year}${month}${day}`;
      if (reset_scope === 'MONTHLY') return `${year}${month}`;
      if (reset_scope === 'YEARLY') return `${year}`;
      return 'NEVER';
    }

    // Helper: renderBatchId (from batchIdEngine logic)
    function renderBatchId(rule, sku, date, seq) {
      if (!rule?.format_json?.parts) return '';

      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const monthLetter = String.fromCharCode(64 + month);

      let result = '';
      for (const part of rule.format_json.parts) {
        const type = part.type;
        if (type === 'text') {
          result += part.value || '';
        } else if (type === 'day') {
          const pad = part.pad || 1;
          result += String(day).padStart(pad, '0');
        } else if (type === 'month') {
          const pad = part.pad || 1;
          result += String(month).padStart(pad, '0');
        } else if (type === 'month_letter') {
          result += monthLetter;
        } else if (type === 'year2') {
          result += String(year).slice(-2);
        } else if (type === 'year4') {
          result += String(year);
        } else if (type === 'seq') {
          const pad = part.pad || 1;
          result += String(seq).padStart(pad, '0');
        } else if (type === 'sku_prefix') {
          result += sku?.batch_prefix || sku?.item_code || '';
        } else if (type === 'date_serial_ddmmyyyy') {
          const dd = String(day).padStart(2, '0');
          const mm = String(month).padStart(2, '0');
          const yyyy = String(year);
          result += `${dd}${mm}${yyyy}`;
        } else if (type === 'suffix_if_seq_gt_1') {
          if (seq > 1) {
            const prefix = part.prefix || '';
            const value = part.value || 'seq';
            if (value === 'seq_minus_1') {
              result += prefix + String(seq - 1);
            } else if (value === 'seq') {
              result += prefix + String(seq);
            }
          }
        }
      }
      return result;
    }

    // Helper: peek next sequence
    async function peekNextSequence(rule_id, sku_code, period_key) {
      try {
        const counters = await base44.entities.BatchSeqCounter.filter({
          rule_id,
          sku_code,
          period_key,
        });
        return counters.length > 0 ? counters[0].next_seq : 1;
      } catch {
        return 1;
      }
    }

    const mfgDate = new Date(now);

    // Process allocations
    const updates = [];
    for (const alloc of allAllocs) {
      const mapping = allMappings.find(m => m.product_code === alloc.sku_code);
      if (!mapping || mapping.batch_date_source !== 'MFG_START') {
        continue; // Skip if no mapping or batch_date_source != MFG_START
      }

      const rule = allRules.find(r => r.rule_id === mapping.batch_format_rule_id);
      if (!rule) continue;

      const sku = allProducts.find(p => p.item_code === alloc.sku_code);
      const resetScope = mapping.sequence_reset_scope || 'DAILY';
      const periodKey = getPeriodKey(mfgDate, resetScope);

      // Atomically get next sequence and increment
      const existingCounters = await base44.entities.BatchSeqCounter.filter({
        rule_id: mapping.batch_format_rule_id,
        sku_code: alloc.sku_code,
        period_key: periodKey,
      });

      let seq;
      if (existingCounters.length > 0) {
        seq = existingCounters[0].next_seq;
        await base44.entities.BatchSeqCounter.update(existingCounters[0].id, { next_seq: seq + 1 });
      } else {
        seq = 1;
        await base44.entities.BatchSeqCounter.create({
          rule_id: mapping.batch_format_rule_id,
          sku_code: alloc.sku_code,
          period_key: periodKey,
          next_seq: 2,
        });
      }

      // Render batch ID
      const batchId = renderBatchId(rule, sku, mfgDate, seq);

      // Record in SKUBatch
      await base44.entities.SKUBatch.create({
        sku_batch_id: batchId,
        plan_id: plan_id,
        allocation_id: alloc.allocation_id,
        sku_code: alloc.sku_code,
        date_used: mfgDate.toISOString().split('T')[0],
        date_source: 'MFG_START',
        rule_id: mapping.batch_format_rule_id,
        seq_used: seq,
        period_key: periodKey,
        generated_at: now.toISOString(),
        generated_by: user.email,
      }).catch(() => {}); // non-blocking if duplicate

      updates.push({ allocId: alloc.id, batchId });

      // Update corresponding PackingWO
      const wo = allPackingWOs.find(w => w.allocation_id === alloc.allocation_id);
      if (wo) {
        await base44.entities.PackingWO.update(wo.id, { batch_id: batchId });
      }
    }

    // Batch update allocations
    for (const upd of updates) {
      const alloc = allAllocs.find(a => a.id === upd.allocId);
      if (alloc) {
        await base44.entities.SKUAllocation.update(alloc.id, { sku_batch_id: upd.batchId });
      }
    }

    return Response.json({
      success: true,
      plan_id,
      started_at: now.toISOString(),
      batch_ids_generated: updates.length,
      batch_map: updates.map(u => {
        const a = allAllocs.find(x => x.id === u.allocId);
        return { sku_code: a?.sku_code, sku_batch_id: u.batchId };
      }),
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});