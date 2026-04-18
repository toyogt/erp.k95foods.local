import { useEffect, useRef, useState } from 'react';
import { fetchRynanPodStatus } from '@/lib/rynanPrinterService';

/**
 * useDemoPrintPollStatus
 *
 * Lightweight polling hook for demo print verification.
 * Continuously polls printer via RQLP command and returns live status.
 * Does NOT write to the database — purely for UI display during demo verification.
 *
 * @param {object} printer - LblPrinterConfig record
 * @param {boolean} enabled - Start/stop polling
 * @param {number} [pollIntervalMs=2000] - How often to poll
 * @returns {{ printedCount, totalCount, allPrinted, printerPodData, isPolling, error }}
 */
export function useDemoPrintPollStatus(printer, enabled = false, pollIntervalMs = 2000) {
  const [status, setStatus] = useState({
    printedCount: 0,
    totalCount: 0,
    allPrinted: false,
    printerPodData: {},
    isPolling: false,
    error: null,
  });

  const pollIntervalRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled || !printer?.printer_id) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      setStatus(prev => ({ ...prev, isPolling: false }));
      return;
    }

    const poll = async () => {
      if (!isMountedRef.current) return;

      const result = await fetchRynanPodStatus(printer, 2); // max 2 retries per cycle

      if (!isMountedRef.current) return;

      if (!result.success) {
        console.warn('[DEMO-POLL] RQLP failed:', result.errorMessage);
        setStatus(prev => ({ ...prev, error: result.errorMessage, isPolling: true }));
        return;
      }

      setStatus({
        printedCount: result.printedCount,
        totalCount: result.totalCount,
        allPrinted: result.allPrinted,
        printerPodData: result.printerPodData || {},
        isPolling: true,
        error: null,
      });
    };

    // Poll immediately, then on interval
    poll();
    pollIntervalRef.current = setInterval(poll, pollIntervalMs);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [enabled, printer?.printer_id, pollIntervalMs]);

  return status;
}