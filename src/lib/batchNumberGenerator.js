/**
 * Batch Number Generator
 * 
 * Supports two schemes based on the factory's Excel batch number sheet:
 *
 * SCHEME A — "excel_date" (Default for Toyo, Good Trip, etc.)
 *   Format: {product_prefix_code}{flavour_code}{excel_serial_of_filling_date}
 *   Example: 02GL46022  (02 = Toyo Zero Sugar, GL = Ginger Lemon, 46022 = Excel date for 2025-12-31)
 *   The Excel serial is calculated from the MANUFACTURING (filling) date.
 *
 * SCHEME B — "day_year_seq" (For Swiggy Noice / custom prefix products)
 *   Format: {product_prefix_code}{DD}{flavour_code_1char}{YY}{sequence_2digit}
 *   Example: KFB31L2501  (KFB = prefix, 31 = day of Dec 31, L = Lemon, 25 = year 2025, 01 = seq)
 *
 * Required ProductMaster fields:
 *   - product_prefix_code: e.g. "02", "KFB"
 *   - flavour_code: e.g. "GL", "L" (2 chars for Scheme A, 1 char for Scheme B)
 *   - batch_scheme: "excel_date" | "day_year_seq"
 */

/**
 * Convert a JS Date to Excel serial date number.
 * Excel epoch starts at 1899-12-30 (due to the famous 1900 leap year bug).
 */
export function dateToExcelSerial(date) {
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const msPerDay = 86400000;
  return Math.round((date.getTime() - excelEpoch.getTime()) / msPerDay);
}

/**
 * Parse a date string in DD/MM/YYYY format to a JS Date (UTC).
 */
function parseDDMMYYYY(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(Date.UTC(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])));
  }
  // fallback for YYYY-MM-DD
  return new Date(dateStr);
}

/**
 * Generate a batch number preview.
 *
 * @param {object} product - ProductMaster record
 * @param {string} manufacturingDate - DD/MM/YYYY format
 * @param {number|string} sequence - Only used for day_year_seq scheme (1-99)
 * @returns {string} generated batch number or empty string if required fields missing
 */
export function generateBatchNumber(product, manufacturingDate, sequence = 1) {
  const prefix = (product?.product_prefix_code || '').trim();
  const flavourCode = (product?.flavour_code || '').trim();
  const scheme = product?.batch_scheme || 'excel_date';

  if (!prefix || !flavourCode || !manufacturingDate) return '';

  const mfgDate = parseDDMMYYYY(manufacturingDate);
  if (!mfgDate || isNaN(mfgDate.getTime())) return '';

  if (scheme === 'excel_date') {
    // e.g. 02GL46022
    const serial = dateToExcelSerial(mfgDate);
    return `${prefix}${flavourCode}${serial}`;
  }

  if (scheme === 'day_year_seq') {
    // e.g. KFB31L2501
    const dd = String(mfgDate.getUTCDate()).padStart(2, '0');
    const yy = String(mfgDate.getUTCFullYear()).slice(-2);
    const seq = String(Number(sequence) || 1).padStart(2, '0');
    const fCode = flavourCode.charAt(0).toUpperCase(); // single char for this scheme
    return `${prefix}${dd}${fCode}${yy}${seq}`;
  }

  return '';
}

export const BATCH_SCHEMES = [
  {
    value: 'excel_date',
    label: 'Standard (Excel Date)',
    description: 'Prefix + Flavour Code + Excel serial of Manufacturing Date',
    example: '02GL46022',
  },
  {
    value: 'day_year_seq',
    label: 'Day / Year / Sequence',
    description: 'Prefix + Day + Flavour initial + Year (2-digit) + Sequence number',
    example: 'KFB31L2501',
  },
];