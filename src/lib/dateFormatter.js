/**
 * Centralized date formatting utility for K95 ERP.
 * Format: DD-MM-YYYY - HH-MM-SS
 */
import moment from 'moment';

/**
 * Format a date string/object to DD-MM-YYYY - HH-MM-SS
 * @param {string|Date} dateStr - ISO date string or Date object
 * @param {boolean} includeTime - whether to include time portion (default: true)
 * @returns {string} formatted date string or '—' if invalid
 */
export function formatDateTime(dateStr, includeTime = true) {
  if (!dateStr) return '—';
  const m = moment(dateStr);
  if (!m.isValid()) return '—';
  return includeTime
    ? m.format('DD-MM-YYYY - HH-mm-ss')
    : m.format('DD-MM-YYYY');
}

/**
 * Format a date string to DD-MM-YYYY only (no time)
 */
export function formatDate(dateStr) {
  return formatDateTime(dateStr, false);
}