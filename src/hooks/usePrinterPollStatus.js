import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { fetchRynanPodStatus } from '@/lib/rynanPrinterService';

const MILESTONE_INCREMENT = 100; // Log every 100 bottles
const MAX_LOG_RECORDS = 1000;    // Max records per job

/**
 * usePrinterPollStatus
 *
 * Continuously polls the printer using RQLP command to get real-time
 * print progress and auto-updates the job's current_printed_qty based
 * on what the printer actually reports.
 *
 * @param {object} job - LabellingJob record
 * @param {object} printer - LblPrinterConfig record
 * @param {boolean} enabled - Start/stop polling
 * @param {number} [pollIntervalMs=2000] - How often to poll (default 2s)
 * @returns {{ printedCount, totalCount, progress, allPrinted, isPolling, error }}
 */
export function usePrinterPollStatus(job, printer, enabled = false, pollIntervalMs = 2000) {
  const pollIntervalRef = useRef(null);
  const lastPrintedCountRef = useRef(job?.current_printed_qty || 0);

  useEffect(() => {
    if (!enabled || !job?.id || !printer?.printer_id || job?.status === 'completed') {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    const poll = async () => {
      let result = null;
      let attempts = 0;
      const maxRetries = 3;

      // Retry RQLP command up to 3 times
      while (attempts < maxRetries) {
        attempts++;
        result = await fetchRynanPodStatus(printer);

        if (result.success) {
          console.log(`[POLL] RQLP success on attempt ${attempts}`);
          break;
        }

        console.warn(`[POLL] RQLP attempt ${attempts}/${maxRetries} failed:`, result.errorMessage);
        if (attempts < maxRetries) {
          await new Promise(r => setTimeout(r, 500)); // Wait 500ms before retry
        }
      }

      // If all retries failed, log error and skip this poll cycle
      if (!result.success) {
        console.error(`[POLL] RQLP failed after ${maxRetries} attempts:`, result.errorMessage);
        await logPrinterStatusToDB(job.id, 'error', null, result.errorMessage);
        return;
      }

      const { printedCount, totalCount } = result;
      const planned = job.quantity_bottles_planned || 0;
      // Cap printed count at planned target (printer may over-report)
      const safePrintedCount = Math.min(printedCount, planned);

      // Only update DB if printer reports a NEW count
      if (safePrintedCount > lastPrintedCountRef.current) {
        lastPrintedCountRef.current = safePrintedCount;

        // Log milestone every 100 bottles + final count
        const isMilestone = safePrintedCount % MILESTONE_INCREMENT === 0;
        const isFinal = safePrintedCount >= planned && planned > 0;

        if (isMilestone || isFinal) {
          console.log(`[POLL] Milestone: ${safePrintedCount}/${planned} bottles`);
          await logPrinterStatusToDB(job.id, 'milestone', safePrintedCount, null);
        }

        // Auto-update job's printed count
        await base44.entities.LabellingJob.update(job.id, {
          current_printed_qty: safePrintedCount,
          status:
            isFinal
              ? 'completed'
              : job.status === 'paused'
              ? 'paused'
              : 'bulk_printing',
        });
      }
    };

    // Log milestone or error to LblPrintCommand
    const logPrinterStatusToDB = async (jobId, logType, printedQty, errorMsg) => {
      try {
        const recordCount = await base44.entities.LblPrintCommand.filter({ job_id: jobId });
        if (recordCount.length >= MAX_LOG_RECORDS) return; // Skip if at limit

        await base44.entities.LblPrintCommand.create({
          command_id: `POLL-${jobId}-${Date.now()}`,
          job_id: jobId,
          printer_id: printer.printer_id,
          endpoint_url: `${printer.register_app_link || printer.api_endpoint}/print`,
          command_type: 'bulk_status_poll',
          status: logType === 'error' ? 'failed' : 'acknowledged',
          quantity: printedQty || 0,
          request_payload: { command: 'RQLP' },
          response_payload: { log_type: logType, printed_qty: printedQty },
          error_message: errorMsg || null,
          sent_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[POLL] Failed to log status:', err.message);
      }
    };

    // Poll immediately, then every N ms
    poll();
    pollIntervalRef.current = setInterval(poll, pollIntervalMs);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [enabled, job?.id, printer?.printer_id, pollIntervalMs]);
}