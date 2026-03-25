import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create the global counter
    const counters = await base44.asServiceRole.entities.GlobalBatchCounter.filter({ counter_id: 'GLOBAL' });
    
    let counter;
    let nextValue;

    if (counters.length === 0) {
      // Create initial counter
      counter = await base44.asServiceRole.entities.GlobalBatchCounter.create({
        counter_id: 'GLOBAL',
        current_value: 100000,
        total_batches_created: 0,
        last_updated: new Date().toISOString(),
      });
      nextValue = 100000;
    } else {
      counter = counters[0];
      nextValue = counter.current_value;
      
      // Check if we've reached the maximum
      if (nextValue >= 999999) {
        return Response.json({ 
          error: 'Counter limit reached. Maximum 6-digit unique IDs exhausted.' 
        }, { status: 400 });
      }
    }

    // Increment the counter
    const newValue = nextValue + 1;
    await base44.asServiceRole.entities.GlobalBatchCounter.update(counter.id, {
      current_value: newValue,
      total_batches_created: (counter.total_batches_created || 0) + 1,
      last_updated: new Date().toISOString(),
    });

    return Response.json({
      unique_id: String(nextValue).padStart(6, '0'),
      next_value: newValue,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});