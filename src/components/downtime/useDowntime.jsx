import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Hook for managing downtime events at a station.
 * Returns: { activeEvent, downtimeMinutesToday, startDowntime, endDowntime }
 */
export function useDowntime({ stationType, machineId, user }) {
  const [activeEvent, setActiveEvent] = useState(null); // open downtime event
  const [downtimeMinutesToday, setDowntimeMinutesToday] = useState(0);

  useEffect(() => {
    if (machineId) {
      loadActiveEvent();
      loadTodayMinutes();
    }
  }, [machineId, stationType]);

  async function loadActiveEvent() {
    const events = await base44.entities.DowntimeEvent.filter(
      { station_type: stationType, machine_id: machineId },
      '-started_at', 5
    ).catch(() => []);
    const open = events.find(e => !e.ended_at);
    setActiveEvent(open || null);
  }

  async function loadTodayMinutes() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const events = await base44.entities.DowntimeEvent.filter(
      { station_type: stationType, machine_id: machineId },
      '-started_at', 50
    ).catch(() => []);
    const todayEvents = events.filter(e => e.started_at && new Date(e.started_at) >= todayStart && e.duration_minutes != null);
    const total = todayEvents.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
    setDowntimeMinutesToday(total);
  }

  async function startDowntime({ woId, cycleId } = {}) {
    const now = new Date().toISOString();
    const eventId = `DT-${Date.now()}`;
    const ev = await base44.entities.DowntimeEvent.create({
      event_id: eventId,
      station_type: stationType,
      machine_id: machineId,
      wo_id: woId || '',
      cycle_id: cycleId || '',
      started_at: now,
      started_by: user?.email || '',
    }).catch(() => ({ event_id: eventId, started_at: now }));
    setActiveEvent(ev);
    return ev;
  }

  async function endDowntime({ reasonCode, notes, photoUrl }) {
    if (!activeEvent) return null;
    const now = new Date().toISOString();
    const durationMs = new Date(now) - new Date(activeEvent.started_at);
    const durationMin = durationMs / 60000;
    const isMicro = durationMin < 2 && !reasonCode;

    const update = {
      ended_at: now,
      ended_by: user?.email || '',
      reason_code: reasonCode || '',
      notes: notes || '',
      photo: photoUrl || '',
      duration_minutes: parseFloat(durationMin.toFixed(2)),
      is_micro_stop: isMicro,
    };

    await base44.entities.DowntimeEvent.update(activeEvent.id, update).catch(() => {});

    const closed = { ...activeEvent, ...update };
    setActiveEvent(null);
    setDowntimeMinutesToday(prev => prev + durationMin);
    return closed;
  }

  return { activeEvent, downtimeMinutesToday, startDowntime, endDowntime, reloadToday: loadTodayMinutes };
}