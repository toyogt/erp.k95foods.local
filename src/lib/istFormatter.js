/**
 * IST (Asia/Calcutta) timestamp formatter helpers.
 * The database stores all timestamps in UTC (ISO 8601 with 'Z' suffix).
 * These helpers convert UTC -> IST for display.
 */

const IST_TZ = 'Asia/Calcutta';

function toDate(input) {
  if (!input) return null;
  const d = input instanceof Date ? input : new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

/** Formats an ISO/Date as "DD/MM/YYYY HH:mm:ss" in IST. */
export function formatIstDateTime(input) {
  const d = toDate(input);
  if (!d) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TZ,
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
}

/** Formats an ISO/Date as "DD/MM/YYYY" in IST. */
export function formatIstDate(input) {
  const d = toDate(input);
  if (!d) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TZ,
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return `${parts.day}/${parts.month}/${parts.year}`;
}

/** Formats an ISO/Date as "HH:mm:ss" in IST. */
export function formatIstTime(input) {
  const d = toDate(input);
  if (!d) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TZ,
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return `${parts.hour}:${parts.minute}:${parts.second}`;
}