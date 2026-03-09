import { base44 } from '@/api/base44Client';

export function genId(prefix) {
  return prefix + '-' + Date.now().toString(36).toUpperCase().slice(-6);
}

export function todayStr() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

export function formatLotId(date, seq) {
  // LOT-09-03-2026-001
  const d = new Date(date + 'T00:00:00');
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const s = String(seq).padStart(3, '0');
  return `LOT-${dd}-${mm}-${yyyy}-${s}`;
}

export async function getNextLotSeq(dateStr) {
  const lots = await base44.entities.WarehouseLot.filter({ lot_date: dateStr }, '-lot_seq', 1).catch(() => []);
  return lots.length > 0 ? (lots[0].lot_seq || 0) + 1 : 1;
}

export function totalBottles(boxes, looseBottles, bottlesPerBox) {
  return (Number(boxes) || 0) * (Number(bottlesPerBox) || 1) + (Number(looseBottles) || 0);
}