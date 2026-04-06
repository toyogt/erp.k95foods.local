import { base44 } from '@/api/base44Client';

/**
 * Returns the next sequential serial for a given prefix, e.g. GE-0001, GRN-0002
 * Persisted in AppSetting with key `serial_counter_<prefix>`
 */
export async function nextSerial(prefix) {
  const key = `serial_counter_${prefix}`;
  const existing = await base44.entities.AppSetting.filter({ key });
  if (existing.length > 0) {
    const current = parseInt(existing[0].value, 10) || 0;
    const next = current + 1;
    await base44.entities.AppSetting.update(existing[0].id, { value: String(next) });
    return `${prefix}-${String(next).padStart(4, '0')}`;
  } else {
    await base44.entities.AppSetting.create({ key, value: '1', description: `Auto-increment counter for ${prefix}` });
    return `${prefix}-0001`;
  }
}