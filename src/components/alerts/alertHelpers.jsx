import { base44 } from '@/api/base44Client';

export async function raiseAlert({ severity = 'INFO', station_type = '', reference_type = '', reference_id = '', message = '' }) {
  const now = new Date().toISOString();
  await base44.entities.AlertEvent.create({
    event_id: 'ALT-' + Date.now().toString(36).toUpperCase(),
    severity,
    station_type,
    reference_type,
    reference_id,
    message,
    created_at: now,
    status: 'OPEN',
  }).catch(() => {}); // best-effort
}