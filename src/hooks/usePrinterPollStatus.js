import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { fetchRynanPodStatus } from '@/lib/rynanPrinterService';
import { logLabellingEvent } from '@/lib/labellingEventLogger';

const MILESTONE_INCREMENT = 100; // Log every 100 bottles
const MAX_LOG_RECORDS = 1000;    // Max records per job

/**
 * usePrinterPollStatus
 *
 * Continuously polls the printer using RQLP command to get real-time
 * print progress and auto-updates the job's current_printed_qty.
 *
 * TWO-PHASE COMPLETION:
 *   Phase 1 — Printer reports printedCount >= planned quantity
 *             → Update job status to 'bulk_printing_awaiting_printer_reset'
 *             → Continue polling, waiting for printer to go idle
 *   Phase 2 — Printer reports 0/0 (idle reset after Phase 1)
 *             → Update job status to 'completed'
 *             → Stop all polling
 *
 * PAUSE:  Polling stops when job.status === 'paused'
 * RESUME: Polling resumes when job.status === 'bulk_printing'
 *
 * @param {object} job            - LabellingJob record
 * @param {object} printer        - LblPrinterConfig record
 * @param {boolean} enabled       - Start/stop polling
 * @param {number} pollIntervalMs - How often to poll (default 2s)
 */
export function usePrinterPollStatus(job, printer, enabled = false, pollIntervalMs = 2000) {
  const pollIntervalRef             = useRef(null);
  const lastPrintedCountRef         = useRef(job?.current_printed_qty || 0);
  const jobPlannedQtyReachedRef     = useRef(false); // Phase 1 flag
  const printerIdleAfterCompleteRef = useRef(false); // Phase 2 flag
  const isCompletingRef             = useRef(false);  // Prevent duplicate completion writes

  useEffect(() => {
    // Stop polling if disabled, no job/printer, already in terminal states, or paused
    if (
      !enabled ||
      !job?.id ||
      !printer?.printer_id ||
      job?.status === 'completed' ||
      job?.status === 'paused'
    ) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    // Reset phase flags when a new job starts
    jobPlannedQtyReachedRef.current     = false;
    printerIdleAfterCompleteRef.current = false;
    isCompletingRef.current             = false;
    lastPrintedCountRef.current         = job?.current_printed_qty || 0;

    const logPrinterStatusToDB = async (jobId, logType, printedQty, errorMsg) => {
      try {
        const recordCount = await base44.entities.LblPrintCommand.filter({ job_id: jobId });
        if (recordCount.length >= MAX_LOG_RECORDS) return;

        await base44.entities.LblPrintCommand.create({
          command_id:      `POLL-${jobId}-${Date.now()}`,
          job_id:          jobId,
          printer_id:      printer.printer_id,
          endpoint_url:    `${printer.register_app_link || printer.api_endpoint}/print`,
          command_type:    'bulk_status_poll',
          status:          logType === 'error' ? 'failed' : 'acknowledged',
          quantity:        printedQty || 0,
          request_payload: { command: 'RQLP' },
          response_payload: { log_type: logType, printed_qty: printedQty },
          error_message:   errorMsg || null,
          sent_at:         new Date().toISOString(),
        });
      } catch (err) {
        console.error('[POLL] Failed to log status:', err.message);
      }
    };

    const poll = async () => {
      let result   = null;
      let attempts = 0;
      const maxRetries = 3;

      while (attempts < maxRetries) {
        attempts++;
        result = await fetchRynanPodStatus(printer);
        if (result.success) {
          console.log(`[POLL] RQLP success on attempt ${attempts}`);
          break;
        }
        console.warn(`[POLL] RQLP attempt ${attempts}/${maxRetries} failed:`, result.errorMessage);
        if (attempts < maxRetries) await new Promise(r => setTimeout(r, 500));
      }

      if (!result.success) {
        console.error(`[POLL] RQLP failed after ${maxRetries} attempts:`, result.errorMessage);
        await logPrinterStatusToDB(job.id, 'error', null, result.errorMessage);
        return;
      }

      const { printedCount, totalCount } = result;
      const planned          = job.quantity_bottles_planned || 0;
      const safePrintedCount = Math.min(printedCount, planned);

      // ─────────────────────────────────────────────────────────────────
      // PHASE 2: Printer reset to 0/0 AFTER all labels were reported done
      // ─────────────────────────────────────────────────────────────────
      if (jobPlannedQtyReachedRef.current && printedCount === 0 && totalCount === 0) {
        if (!isCompletingRef.current) {
          isCompletingRef.current = true;
          console.log('[POLL] Phase 2: Printer reset to 0/0 — marking job as completed.');

          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

          await base44.entities.LabellingJob.update(job.id, { status: 'completed' });
          await logLabellingEvent({
            action_type:  'job_completed',
            job_id:       job.id,
            plan_id:      job.plan_id,
            description:  `Bulk print job completed. All ${planned.toLocaleString()} labels physically printed and printer confirmed idle.`,
            user:         null,
          });
          await logPrinterStatusToDB(job.id, 'completed', planned, null);
        }
        return;
      }

      // ─────────────────────────────────────────────────────────────────
      // PHASE 1: Planned quantity reached — wait for printer idle
      // ─────────────────────────────────────────────────────────────────
      const isFinal = safePrintedCount >= planned && planned > 0;

      if (isFinal && !jobPlannedQtyReachedRef.current) {
        jobPlannedQtyReachedRef.current = true;
        console.log(`[POLL] Phase 1: All ${planned} labels reached. Awaiting printer 0/0 reset.`);

        await base44.entities.LabellingJob.update(job.id, {
          current_printed_qty: planned,
          status: 'bulk_printing_awaiting_printer_reset',
        });
        await logPrinterStatusToDB(job.id, 'milestone', planned, null);
        return;
      }

      // Skip if we're already in the "awaiting reset" phase — don't overwrite status
      if (jobPlannedQtyReachedRef.current) return;

      // ─────────────────────────────────────────────────────────────────
      // NORMAL: Update printed count if it changed
      // ─────────────────────────────────────────────────────────────────
      if (safePrintedCount > lastPrintedCountRef.current) {
        lastPrintedCountRef.current = safePrintedCount;

        const isMilestone = safePrintedCount % MILESTONE_INCREMENT === 0;
        if (isMilestone) {
          console.log(`[POLL] Milestone: ${safePrintedCount}/${planned} bottles`);
          await logPrinterStatusToDB(job.id, 'milestone', safePrintedCount, null);
        }

        await base44.entities.LabellingJob.update(job.id, {
          current_printed_qty: safePrintedCount,
          status: 'bulk_printing',
        });
      }
    };

    poll();
    pollIntervalRef.current = setInterval(poll, pollIntervalMs);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [enabled, job?.id, job?.status, printer?.printer_id, pollIntervalMs]);
}