import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { fetchRynanPodStatus } from '@/lib/rynanPrinterService';
import { logLabellingEvent } from '@/lib/labellingEventLogger';

const MILESTONE_INCREMENT = 100; // Write to DB every 100 bottles
const MAX_LOG_RECORDS = 1000;    // Max poll log records per job

/**
 * usePrinterPollStatus
 *
 * Polls the printer via RQLP every pollIntervalMs milliseconds.
 * Live count is kept in LOCAL React state for instant UI updates — 
 * DB writes only happen at milestones and phase transitions (like demo hook).
 *
 * TWO-PHASE COMPLETION:
 *   Phase 1 — printedCount >= planned → status = 'bulk_printing_awaiting_printer_reset'
 *   Phase 2 — printer reports 0/0     → status = 'completed'
 *
 * @returns {{ livePrintedCount: number, isPolling: boolean }}
 */
export function usePrinterPollStatus(job, printer, enabled = false, pollIntervalMs = 200) {
  const [livePrintedCount, setLivePrintedCount] = useState(job?.current_printed_qty || 0);
  const [isPolling, setIsPolling]               = useState(false);

  const pollIntervalRef         = useRef(null);
  const lastDbWrittenCountRef   = useRef(job?.current_printed_qty || 0);
  const jobPlannedQtyReachedRef = useRef(false);
  const isCompletingRef         = useRef(false);
  const isMountedRef            = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (
      !enabled ||
      !job?.id ||
      !printer?.printer_id ||
      job?.status === 'completed' ||
      job?.status === 'paused'
    ) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      setIsPolling(false);
      return;
    }

    // Reset on new poll session
    jobPlannedQtyReachedRef.current = false;
    isCompletingRef.current         = false;
    lastDbWrittenCountRef.current   = job?.current_printed_qty || 0;
    setLivePrintedCount(job?.current_printed_qty || 0);

    const logPrinterStatusToDB = async (jobId, logType, printedQty, errorMsg) => {
      try {
        const recordCount = await base44.entities.LblPrintCommand.filter({ job_id: jobId });
        if (recordCount.length >= MAX_LOG_RECORDS) return;
        await base44.entities.LblPrintCommand.create({
          command_id:       `POLL-${jobId}-${Date.now()}`,
          job_id:           jobId,
          printer_id:       printer.printer_id,
          endpoint_url:     `${printer.register_app_link || printer.api_endpoint}/print`,
          command_type:     'bulk_status_poll',
          status:           logType === 'error' ? 'failed' : 'acknowledged',
          quantity:         printedQty || 0,
          request_payload:  { command: 'RQLP' },
          response_payload: { log_type: logType, printed_qty: printedQty },
          error_message:    errorMsg || null,
          sent_at:          new Date().toISOString(),
        });
      } catch (err) {
        console.error('[POLL] Failed to log status:', err.message);
      }
    };

    const poll = async () => {
      if (!isMountedRef.current) return;

      const result = await fetchRynanPodStatus(printer);

      if (!isMountedRef.current) return;

      if (!result.success) {
        console.warn('[POLL] RQLP failed:', result.errorMessage);
        return;
      }

      const { printedCount, totalCount } = result;
      const planned          = job.quantity_bottles_planned || 0;
      const safePrintedCount = Math.min(printedCount, planned);

      // ── PHASE 2: Printer reset to 0/0 after Phase 1 completion ──
      if (jobPlannedQtyReachedRef.current && printedCount === 0 && totalCount === 0) {
        if (!isCompletingRef.current) {
          isCompletingRef.current = true;
          console.log('[POLL] Phase 2: Printer idle — marking job completed.');
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          if (isMountedRef.current) setIsPolling(false);

          await base44.entities.LabellingJob.update(job.id, { status: 'completed' });
          await logLabellingEvent({
            action_type: 'job_completed',
            job_id:      job.id,
            plan_id:     job.plan_id,
            description: `Bulk print completed. All ${planned.toLocaleString()} labels printed and printer confirmed idle.`,
            user:        null,
          });
          await logPrinterStatusToDB(job.id, 'completed', planned, null);
        }
        return;
      }

      // ── PHASE 1: All labels printed — transition status ──
      if (safePrintedCount >= planned && planned > 0 && !jobPlannedQtyReachedRef.current) {
        jobPlannedQtyReachedRef.current = true;
        console.log(`[POLL] Phase 1: ${planned} labels reached. Awaiting printer idle.`);
        if (isMountedRef.current) setLivePrintedCount(planned);

        await base44.entities.LabellingJob.update(job.id, {
          current_printed_qty: planned,
          status: 'bulk_printing_awaiting_printer_reset',
        });
        await logPrinterStatusToDB(job.id, 'milestone', planned, null);
        return;
      }

      // Skip updates during awaiting-reset phase
      if (jobPlannedQtyReachedRef.current) return;

      // ── NORMAL: Update live state immediately, DB only at milestones ──
      if (safePrintedCount > lastDbWrittenCountRef.current) {
        // Always update UI instantly (no DB round-trip)
        if (isMountedRef.current) setLivePrintedCount(safePrintedCount);

        const isMilestone = safePrintedCount % MILESTONE_INCREMENT === 0;
        if (isMilestone) {
          lastDbWrittenCountRef.current = safePrintedCount;
          console.log(`[POLL] Milestone DB write: ${safePrintedCount}/${planned}`);
          await logPrinterStatusToDB(job.id, 'milestone', safePrintedCount, null);
          await base44.entities.LabellingJob.update(job.id, {
            current_printed_qty: safePrintedCount,
          });
        }
      }
    };

    setIsPolling(true);
    poll();
    pollIntervalRef.current = setInterval(poll, pollIntervalMs);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [enabled, job?.id, job?.status, printer?.printer_id, pollIntervalMs]);

  return { livePrintedCount, isPolling };
}