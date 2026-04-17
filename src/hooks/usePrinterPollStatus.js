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

      // Only update DB if printer reports a NEW count
      if (printedCount > lastPrintedCountRef.current) {
        lastPrintedCountRef.current = printedCount;

        console.log(
          `[POLL] Printer reports: ${printedCount} of ${totalCount} printed. Updating job to ${printedCount}/${planned}.`
        );

        // Auto-update job's printed count
        await base44.entities.LabellingJob.update(job.id, {
          current_printed_qty: printedCount,
          status:
            printedCount >= planned && planned > 0
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