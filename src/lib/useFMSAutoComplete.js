/**
 * useFMSAutoComplete — FMS integration helpers for Factory Flow pages
 *
 * ═══════════════════════════════════════════════════════════════════
 * HOW STEP-SPECIFIC MATCHING WORKS (important — read this)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Every process instance has a `ref_chain` — an array of record IDs
 * linked to it across the entire process lifecycle.
 *
 * Example — Purchase Process with 3 steps:
 *
 *   STEP 1: Purchase Request received  (auto-trigger)
 *     → triggerFMSProcess({ triggerSource: 'purchase_request_created',
 *                            triggerRefId: pr.id, ... })
 *     → ref_chain = [pr.id]
 *
 *   STEP 2: Create PO against that PR  (auto-complete when PO is created)
 *     → On the PO creation page, after saving the PO:
 *        await fireFMSEvent('purchase_order_created', pr.id)
 *        // Pass pr.id (the trigger ref), NOT po.id
 *        // This matches ONLY the instance started by this PR
 *
 *     → Then link the new PO's ID into the chain so future steps can match:
 *        await linkFMSRef(instanceId, po.id)
 *        // Now ref_chain = [pr.id, po.id]
 *
 *   STEP 3: PO approved by manager (auto-complete when PO approved)
 *     → On the approval page:
 *        await fireFMSEvent('purchase_order_approved', po.id)
 *        // po.id is now in the chain → matches only this instance ✓
 *
 * KEY RULE: Always pass the ID of a record that IS already in ref_chain.
 * If you're completing a step that PRODUCES a new record, call linkFMSRef()
 * BEFORE the next fireFMSEvent so the new ID is in the chain.
 *
 * ═══════════════════════════════════════════════════════════════════
 */

import { base44 } from '@/api/base44Client';

/**
 * fireFMSEvent — auto-complete the matching active step on the instance
 * that contains `refId` in its ref_chain.
 *
 * @param {string} eventKey  - must match auto_complete_event on a step template
 * @param {string} refId     - ID of a record already linked to the process instance
 *                             (the original trigger_ref_id, or any previously linked ID)
 *
 * Without refId: completes ALL active steps with this event (use with caution).
 * With refId:    only completes the step on the instance that owns this record.
 */
export async function fireFMSEvent(eventKey, refId = null) {
  try {
    const payload = { action: 'auto_complete', auto_complete_event: eventKey };
    if (refId) payload.trigger_ref_id = refId;
    const res = await base44.functions.invoke('fmsTriggerProcess', payload);
    return res.data;
  } catch (e) {
    console.warn('[FMS] fireFMSEvent failed:', e?.message);
    return null;
  }
}

/**
 * linkFMSRef — add a new record ID into an instance's ref_chain.
 * Call this when a step action produces a new record that future steps
 * will need to reference (e.g. after creating a PO against a PR).
 *
 * @param {string} instanceId - FMSProcessInstance.id
 * @param {string} newRefId   - the new record's ID to add to the chain
 */
export async function linkFMSRef(instanceId, newRefId) {
  try {
    const res = await base44.functions.invoke('fmsTriggerProcess', {
      action: 'link_ref',
      instance_id: instanceId,
      ref_id: newRefId,
    });
    return res.data;
  } catch (e) {
    console.warn('[FMS] linkFMSRef failed:', e?.message);
    return null;
  }
}

/**
 * triggerFMSProcess — auto-start a process from an app action.
 * Returns the created instance(s) so you can store the instanceId
 * for future linkFMSRef() calls if needed.
 *
 * @param {object} opts
 * @param {string} opts.triggerSource  - must match trigger_source on an FMSProcess
 * @param {string} opts.triggerRefId   - ID of the record that started this (e.g. PR id)
 * @param {string} opts.title          - human-readable label for this instance
 * @param {object} opts.triggerData    - any extra key-value data to store
 */
export async function triggerFMSProcess({ triggerSource, triggerRefId, title, triggerData = {} }) {
  try {
    const processes = await base44.entities.FMSProcess.filter({
      trigger_source: triggerSource,
      trigger_type: 'auto',
      is_active: true,
    });
    if (!processes || processes.length === 0) return null;

    const results = [];
    for (const process of processes) {
      const res = await base44.functions.invoke('fmsTriggerProcess', {
        action: 'trigger',
        process_id: process.id,
        trigger_data: triggerData,
        title,
        trigger_source: triggerSource,
        trigger_ref_id: triggerRefId || null,
      });
      results.push(res.data);
    }
    return results;
  } catch (e) {
    console.warn('[FMS] triggerFMSProcess failed:', e?.message);
    return null;
  }
}