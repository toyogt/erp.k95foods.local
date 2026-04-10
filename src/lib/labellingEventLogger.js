import { base44 } from '@/api/base44Client';
import { generateEventId } from '@/lib/labellingHelpers';

export async function logLabellingEvent({ action_type, job_id = null, plan_id = null, description = '', details_json = {}, user = null }) {
  const event = {
    event_id: generateEventId(),
    action_type,
    description,
    details_json,
    timestamp: new Date().toISOString(),
  };
  if (job_id) event.job_id = job_id;
  if (plan_id) event.plan_id = plan_id;
  if (user) {
    event.performed_by_email = user.email;
    event.performed_by_name = user.full_name || user.email;
  }
  await base44.entities.LblEventLog.create(event);
}