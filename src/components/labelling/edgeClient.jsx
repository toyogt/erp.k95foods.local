import { base44 } from '@/api/base44Client';

let _hardwareEnabled = null;

async function isHardwareEnabled() {
  if (_hardwareEnabled !== null) return _hardwareEnabled;
  try {
    const settings = await base44.entities.AppSetting.filter({ key: 'HARDWARE_ENABLED' });
    _hardwareEnabled = settings[0]?.value === 'true';
  } catch {
    _hardwareEnabled = false;
  }
  return _hardwareEnabled;
}

export async function callEdge(action, payload) {
  const enabled = await isHardwareEnabled();
  if (!enabled) {
    return { success: true, edge_offline: false, hardware_disabled: true };
  }
  try {
    const res = await base44.functions.invoke('edgeHooks', { action, payload });
    return res.data;
  } catch {
    return { success: false, edge_offline: true, message: 'Edge call failed' };
  }
}