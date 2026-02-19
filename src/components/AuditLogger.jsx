import { base44 } from '@/api/base44Client';

export async function logAudit({ action, entity_type, entity_id, details, station, user }) {
  const entry = {
    action,
    entity_type: entity_type || '',
    entity_id: entity_id || '',
    user_email: user?.email || '',
    user_name: user?.full_name || '',
    details: details || {},
    station: station || '',
    synced: true,
  };

  try {
    await base44.entities.AuditLog.create(entry);
  } catch (e) {
    // If offline, store locally
    const queue = JSON.parse(localStorage.getItem('factory_offline_queue') || '[]');
    queue.push({
      type: 'create',
      entity: 'AuditLog',
      data: { ...entry, synced: false },
      auditAction: action,
      auditEntityId: entity_id,
      userEmail: user?.email,
      userName: user?.full_name,
      queued_at: new Date().toISOString(),
      id: crypto.randomUUID(),
    });
    localStorage.setItem('factory_offline_queue', JSON.stringify(queue));
  }
}