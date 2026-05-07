/**
 * Employee code normalization helpers.
 *
 * Biometric machines and master CSVs can express the same logical employee
 * with very different codes:
 *   - "22"
 *   - "00000022"
 *   - "E00000022"
 *   - "RT001"
 *
 * normalizeEmployeeCode(raw) returns a canonical form used purely for
 * matching: trimmed, uppercased, optional single-letter prefix kept,
 * leading zeros on the numeric tail stripped.
 *
 * resolveCanonicalCode(raw, employees) walks an Employee[] list and returns
 * the master record whose stored employee_code matches `raw` (after both
 * sides are normalized). Falls back to null.
 */

export function normalizeEmployeeCode(raw) {
  if (raw === null || raw === undefined) return '';
  let s = String(raw).trim().toUpperCase();
  if (!s) return '';

  // Split optional alpha prefix from numeric tail (e.g. "E00000022" -> "E", "00000022")
  const m = s.match(/^([A-Z]*)(\d+)$/);
  if (m) {
    const prefix = m[1];
    const numeric = m[2].replace(/^0+/, '') || '0';
    return `${prefix}${numeric}`;
  }
  // Pure alpha or mixed (e.g. "RT001") — strip zeros only after trailing alpha+digits
  const m2 = s.match(/^([A-Z]+)(\d+)$/);
  if (m2) {
    return `${m2[1]}${m2[2].replace(/^0+/, '') || '0'}`;
  }
  return s;
}

export function resolveCanonicalCode(raw, employees) {
  const norm = normalizeEmployeeCode(raw);
  if (!norm || !Array.isArray(employees)) return null;
  for (const emp of employees) {
    if (normalizeEmployeeCode(emp.employee_code) === norm) return emp;
  }
  return null;
}