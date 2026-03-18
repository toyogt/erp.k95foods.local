/**
 * useFMSAutoComplete — call this from any Factory Flow page/action
 * to auto-complete any FMS process steps tied to an app event.
 *
 * Usage:
 *   import { fireFMSEvent } from '@/lib/useFMSAutoComplete';
 *
 *   // When a GRN is received:
 *   await fireFMSEvent('grn_received', grnId);
 *
 *   // When a PO is approved:
 *   await fireFMSEvent('po_approved', poId);
 *
 * The event key must match the `auto_complete_event` field on an FMSProcessStep.
 * If trigger_ref_id is provided, only instances started with that ref will be matched.
 */
import { base44 } from '@/api/base44Client';

export async function fireFMSEvent(eventKey, triggerRefId = null) {
  try {
    const payload = {
      action: 'auto_complete',
      auto_complete_event: eventKey,
    };
    if (triggerRefId) payload.trigger_ref_id = triggerRefId;
    const res = await base44.functions.invoke('fmsTriggerProcess', payload);
    return res.data;
  } catch (e) {
    // Non-blocking — FMS auto-complete should never break the main app flow
    console.warn('[FMS] auto_complete failed:', e?.message);
    return null;
  }
}

/**
 * triggerFMSProcess — manually start a process instance from within Factory Flow
 *
 * Usage:
 *   import { triggerFMSProcess } from '@/lib/useFMSAutoComplete';
 *
 *   await triggerFMSProcess({
 *     triggerSource: 'gate_entry',
 *     triggerRefId: gateEntry.id,
 *     title: `Gate Entry for ${vehicleNo}`,
 *     triggerData: { vehicle_no: vehicleNo, supplier: supplierName },
 *   });
 *
 * The triggerSource must match the `trigger_source` field on an FMSProcess.
 */
export async function triggerFMSProcess({ triggerSource, triggerRefId, title, triggerData = {} }) {
  try {
    // Find the matching auto-trigger process
    const processes = await base44.entities.FMSProcess.filter({ trigger_source: triggerSource, trigger_type: 'auto', is_active: true });
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