import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { callEdge } from '@/components/labelling/edgeClient';

/**
 * Samples Ryan counter every 60s while the line is RUNNING.
 * Computes bottles/hour from the last 5 samples (slope over time).
 */
export function useMetricSampler({ isRunning, machineId, woId, sessionId }) {
  const samplesRef = useRef([]); // rolling buffer: [{ts, count}]
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!isRunning || !machineId) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }

    async function takeSample() {
      const now = new Date().toISOString();
      let ryanCount = null;

      try {
        const res = await callEdge('ryan_get_count', {});
        if (res?.edge_offline) return; // skip gracefully
        if (res?.count != null) ryanCount = res.count;
      } catch {
        return; // edge offline — skip
      }

      if (ryanCount == null) return;

      // Rolling buffer (keep last 10)
      const buf = [...samplesRef.current, { ts: Date.now(), count: ryanCount }].slice(-10);
      samplesRef.current = buf;

      // Compute bph from last 5 samples slope
      let bph = null;
      if (buf.length >= 2) {
        const window = buf.slice(-5);
        const deltaCount = window[window.length - 1].count - window[0].count;
        const deltaMs = window[window.length - 1].ts - window[0].ts;
        if (deltaMs > 0 && deltaCount >= 0) {
          bph = Math.round((deltaCount / deltaMs) * 3600000);
        }
      }

      const sampleId = `MS-${Date.now().toString(36).toUpperCase()}`;
      base44.entities.LineMetricSample.create({
        sample_id: sampleId,
        station_type: 'LABELLING',
        line_machine_id: machineId,
        wo_id: woId || '',
        captured_at: now,
        ryan_count: ryanCount,
        bottles_per_hour: bph,
        active_session_id: sessionId || '',
      }).catch(() => {}); // non-blocking, don't crash on offline
    }

    intervalRef.current = setInterval(takeSample, 60_000);

    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [isRunning, machineId, woId, sessionId]);
}