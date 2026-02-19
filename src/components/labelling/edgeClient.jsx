import { base44 } from '@/api/base44Client';

export async function callEdge(action, payload) {
  try {
    const res = await base44.functions.invoke('edgeHooks', { action, payload });
    return res.data;
  } catch {
    return { success: false, edge_offline: true, message: 'Edge call failed' };
  }
}