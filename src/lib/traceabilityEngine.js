/**
 * Traceability Engine
 * Backward and forward trace through event chain
 */

import { base44 } from '@/api/base44Client';

/**
 * Get backward trace - find all sources contributing to entity
 * E.g., which raw materials went into this finished product?
 */
export async function getBackwardTrace(entityType, entityId, depth = 10) {
  const trace = {
    entity: { type: entityType, id: entityId },
    sources: [],
    timeline: [],
  };

  const visited = new Set();
  const queue = [{ type: entityType, id: entityId }];

  while (queue.length > 0 && depth > 0) {
    const { type, id } = queue.shift();
    
    if (visited.has(`${type}_${id}`)) continue;
    visited.add(`${type}_${id}`);

    // Find events where this entity was the target
    const events = await base44.entities.TraceEvent.filter({
      target_entity_type: type,
      target_entity_id: id,
    }, '-timestamp', 100);

    if (events && events.length > 0) {
      for (const event of events) {
        trace.timeline.push(event);
        trace.sources.push({
          type: event.source_entity_type,
          id: event.source_entity_id,
          qty: event.quantity,
          unit: event.unit,
          event: event.event_type,
          timestamp: event.timestamp,
        });

        // Queue parent sources
        queue.push({
          type: event.source_entity_type,
          id: event.source_entity_id,
        });
      }
    }

    depth--;
  }

  // Sort by timestamp
  trace.timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return trace;
}

/**
 * Get forward trace - find all products derived from entity
 * E.g., which finished goods and dispatches came from this raw material lot?
 */
export async function getForwardTrace(entityType, entityId, depth = 10) {
  const trace = {
    entity: { type: entityType, id: entityId },
    derivatives: [],
    timeline: [],
    finalDispatches: [],
  };

  const visited = new Set();
  const queue = [{ type: entityType, id: entityId }];

  while (queue.length > 0 && depth > 0) {
    const { type, id } = queue.shift();
    
    if (visited.has(`${type}_${id}`)) continue;
    visited.add(`${type}_${id}`);

    // Find events where this entity was the source
    const events = await base44.entities.TraceEvent.filter({
      source_entity_type: type,
      source_entity_id: id,
    }, '-timestamp', 100);

    if (events && events.length > 0) {
      for (const event of events) {
        trace.timeline.push(event);
        trace.derivatives.push({
          type: event.target_entity_type,
          id: event.target_entity_id,
          qty: event.quantity,
          unit: event.unit,
          event: event.event_type,
          timestamp: event.timestamp,
        });

        // Track final dispatches
        if (event.event_type === 'DISPATCH') {
          trace.finalDispatches.push({
            dispatchId: event.dispatch_id,
            timestamp: event.timestamp,
            qty: event.quantity,
          });
        }

        // Queue child derivatives
        queue.push({
          type: event.target_entity_type,
          id: event.target_entity_id,
        });
      }
    }

    depth--;
  }

  // Sort by timestamp
  trace.timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return trace;
}

/**
 * Get complete genealogy (backward + forward)
 */
export async function getCompleteGenealogy(entityType, entityId) {
  const [backward, forward] = await Promise.all([
    getBackwardTrace(entityType, entityId),
    getForwardTrace(entityType, entityId),
  ]);

  // Combine and deduplicate timeline
  const allEvents = [...backward.timeline, ...forward.timeline];
  const uniqueEvents = Array.from(
    new Map(allEvents.map(e => [e.id, e])).values()
  );

  return {
    entity: { type: entityType, id: entityId },
    backward: backward,
    forward: forward,
    completeTimeline: uniqueEvents.sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    ),
    summary: {
      totalEvents: uniqueEvents.length,
      sources: backward.sources.length,
      derivatives: forward.derivatives.length,
      finalDispatches: forward.finalDispatches.length,
    },
  };
}

/**
 * Get all events for a batch
 */
export async function getBatchTrace(batchId) {
  const events = await base44.entities.TraceEvent.filter(
    { batch_id: batchId },
    '-timestamp',
    200
  );

  return {
    batchId,
    events: events || [],
    timeline: (events || []).sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    ),
  };
}

/**
 * Get all events for a lot
 */
export async function getLotTrace(lotId) {
  const events = await base44.entities.TraceEvent.filter(
    { lot_id: lotId },
    '-timestamp',
    200
  );

  return {
    lotId,
    events: events || [],
    timeline: (events || []).sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    ),
  };
}

/**
 * Get all events for a crate
 */
export async function getCrateTrace(crateId) {
  const events = await base44.entities.TraceEvent.filter(
    { crate_id: crateId },
    '-timestamp',
    200
  );

  return {
    crateId,
    events: events || [],
    timeline: (events || []).sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    ),
  };
}

/**
 * Get all events for a pallet
 */
export async function getPalletTrace(palletId) {
  const events = await base44.entities.TraceEvent.filter(
    { pallet_id: palletId },
    '-timestamp',
    200
  );

  return {
    palletId,
    events: events || [],
    timeline: (events || []).sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    ),
  };
}

/**
 * Get all events for a dispatch
 */
export async function getDispatchTrace(dispatchId) {
  const events = await base44.entities.TraceEvent.filter(
    { dispatch_id: dispatchId },
    '-timestamp',
    200
  );

  return {
    dispatchId,
    events: events || [],
    timeline: (events || []).sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    ),
  };
}

/**
 * Get all events for a SKU/product
 */
export async function getSkuTrace(sku, startDate = null, endDate = null) {
  const query = { sku };
  const events = await base44.entities.TraceEvent.filter(
    query,
    '-timestamp',
    500
  );

  let filtered = events || [];
  
  if (startDate) {
    filtered = filtered.filter(e => new Date(e.timestamp) >= new Date(startDate));
  }
  if (endDate) {
    filtered = filtered.filter(e => new Date(e.timestamp) <= new Date(endDate));
  }

  return {
    sku,
    eventCount: filtered.length,
    events: filtered,
    timeline: filtered.sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    ),
  };
}

/**
 * Find critical events (rejects, rework, major loss)
 */
export async function getCriticalEvents(startDate = null, endDate = null, module = null) {
  let query = { is_critical: true };
  
  const events = await base44.entities.TraceEvent.filter(
    query,
    '-timestamp',
    500
  );

  let filtered = events || [];

  if (startDate) {
    filtered = filtered.filter(e => new Date(e.timestamp) >= new Date(startDate));
  }
  if (endDate) {
    filtered = filtered.filter(e => new Date(e.timestamp) <= new Date(endDate));
  }
  if (module) {
    filtered = filtered.filter(e => e.module === module);
  }

  return {
    criticalEventCount: filtered.length,
    events: filtered,
    byType: groupBy(filtered, 'event_type'),
  };
}

/**
 * Get yield analysis for batch
 */
export async function getBatchYieldAnalysis(batchId) {
  const events = await base44.entities.TraceEvent.filter(
    { batch_id: batchId },
    '-timestamp',
    200
  );

  if (!events || events.length === 0) return null;

  // Find batch creation event
  const creationEvent = events.find(e => e.event_type === 'BATCH_CREATION');
  if (!creationEvent) return null;

  const initialQty = creationEvent.quantity;
  let totalLoss = 0;
  const losses = [];

  for (const event of events) {
    if (event.yield_loss && event.yield_loss > 0) {
      totalLoss += event.yield_loss;
      losses.push({
        event: event.event_type,
        loss: event.yield_loss,
        reason: event.loss_reason,
        timestamp: event.timestamp,
      });
    }
  }

  const finalQty = initialQty - totalLoss;
  const yieldPercent = initialQty > 0 ? (finalQty / initialQty) * 100 : 0;

  return {
    batchId,
    initialQuantity: initialQty,
    totalLoss,
    finalQuantity: finalQty,
    yieldPercent: yieldPercent.toFixed(2),
    losses,
  };
}

/**
 * Helper: group array by property
 */
function groupBy(arr, prop) {
  return arr.reduce((groups, item) => {
    const key = item[prop];
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {});
}