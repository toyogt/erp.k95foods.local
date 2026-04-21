import { useEffect, useRef, useState } from 'react';
import { fetchRynanPodStatus } from '@/lib/rynanPrinterService';

/**
 * useDemoPrintPollStatus
 *
 * Lightweight polling hook for demo print verification.
 * Continuously polls printer via RQLP command and returns live status.
 * Does NOT write to the database — purely for UI display during demo verification.
 *
 * STOP CONDITION (two-phase):
 *   Phase 1 — Printer reports total/total (allPrinted = true). We freeze the POD
 *              table snapshot at this point and set jobCompletionReported = true.
 *   Phase 2 — On the very next poll after Phase 1, if the printer resets to 0/0
 *              we stop all further RQLP polling and mark pollingComplete = true.
 *
 * @param {object} printer - LblPrinterConfig record
 * @param {boolean} enabled - Start/stop polling
 * @param {number} [pollIntervalMs=2000] - How often to poll
 * @returns {{ printedCount, totalCount, allPrinted, printerPodData, isPolling, error, pollingComplete, frozenPodData }}
 */
export function useDemoPrintPollStatus(printer, enabled = false, pollIntervalMs = 2000) {
  const [status, setStatus] = useState({
    printedCount: 0,
    totalCount: 0,
    allPrinted: false,
    printerPodData: {},
    isPolling: false,
    error: null,
    pollingComplete: false,  // true after printer resets to 0/0 post-completion
    frozenPodData: null,     // snapshot of POD data at the moment total/total was confirmed
  });

  const pollIntervalRef = useRef(null);
  const isMountedRef = useRef(true);
  // Phase tracking refs — avoid stale closures in setInterval
  const jobCompletionReportedRef = useRef(false); // Phase 1: total/total seen
  const frozenPodDataRef = useRef(null);           // POD snapshot at Phase 1

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    // Reset phase refs when polling restarts
    jobCompletionReportedRef.current = false;
    frozenPodDataRef.current = null;

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

      const { printedCount, totalCount, allPrinted, printerPodData } = result;

      // ── EARLY EXIT: Printer already at 0/0 before Phase 1 was ever seen ──
      // This happens when the page loads AFTER the printer has already finished and reset.
      // In this case we can never see the total/total snapshot, so treat it as complete.
      if (!jobCompletionReportedRef.current && printedCount === 0 && totalCount === 0) {
        console.log('[DEMO-POLL] Printer already reset to 0/0 on first observation — treating as previously completed.');
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        if (isMountedRef.current) {
          setStatus(prev => ({
            ...prev,
            printedCount: 0,
            totalCount: 0,
            allPrinted: true,       // treat as done — operator already printed
            isPolling: false,
            pollingComplete: true,
            error: null,
          }));
        }
        return;
      }

      // ── PHASE 2: After completion was reported, watch for 0/0 printer reset ──
      if (jobCompletionReportedRef.current) {
        if (printedCount === 0 && totalCount === 0) {
          // Printer has reset — job is fully closed. Stop polling.
          console.log('[DEMO-POLL] Printer reset to 0/0 after completion — stopping RQLP polling.');
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          if (isMountedRef.current) {
            setStatus(prev => ({
              ...prev,
              isPolling: false,
              pollingComplete: true,
            }));
          }
          return;
        }
        // Still showing old count — keep waiting for reset, don't update UI
        console.log(`[DEMO-POLL] Waiting for printer reset. Current: ${printedCount}/${totalCount}`);
        return;
      }

      // ── PHASE 1: Normal polling — update UI with live data ──
      if (allPrinted && totalCount > 0) {
        // Freeze the POD snapshot at this exact moment
        jobCompletionReportedRef.current = true;
        frozenPodDataRef.current = printerPodData || {};
        console.log(`[DEMO-POLL] Job complete: ${printedCount}/${totalCount}. POD data frozen. Watching for 0/0 reset.`);
      }

      setStatus({
        printedCount,
        totalCount,
        allPrinted,
        printerPodData: printerPodData || {},
        isPolling: true,
        error: null,
        pollingComplete: false,
        frozenPodData: jobCompletionReportedRef.current ? frozenPodDataRef.current : null,
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