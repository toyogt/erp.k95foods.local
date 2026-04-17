import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { fetchRynanPodStatus } from '@/lib/rynanPrinterService';

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
    if (!enabled || !job?.id || !printer?.printer_id) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    const poll = async () => {
      const result = await fetchRynanPodStatus(printer);

      if (!result.success) {
        console.warn('[POLL] RQLP query failed:', result.errorMessage);
        return;
      }

      const { printedCount, totalCount } = result;
      const planned = job.quantity_bottles_planned || 0;

      console.log('[POLL] Raw RQLP response:', result.raw);
      console.log(`[POLL] Parsed: printedCount=${printedCount}, totalCount=${totalCount}, planned=${planned}`);

      // Cap printed count to planned quantity (sanity check)
      const safePrintedCount = Math.min(printedCount, planned);

      // Only update DB if printer reports a NEW count
      if (safePrintedCount > lastPrintedCountRef.current) {
        lastPrintedCountRef.current = safePrintedCount;

        console.log(
          `[POLL] Printer reports: ${printedCount}/${totalCount}. Safe count: ${safePrintedCount}/${planned}.`
        );

        // Auto-update job's printed count
        await base44.entities.LabellingJob.update(job.id, {
          current_printed_qty: safePrintedCount,
          status:
            safePrintedCount >= planned && planned > 0
              ? 'completed'
              : job.status === 'paused'
              ? 'paused'
              : 'bulk_printing',
        });
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