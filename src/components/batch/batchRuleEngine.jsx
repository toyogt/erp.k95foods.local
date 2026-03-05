/**
 * batchRuleEngine.js
 * Renders a batch ID from a format_json parts list + context.
 * Used in preview panels and at runtime.
 */

export const MONTH_CODES = {
  '01':'A','02':'B','03':'C','04':'D','05':'E','06':'F',
  '07':'G','08':'H','09':'I','10':'J','11':'K','12':'L',
};

/**
 * Render a single batch ID.
 * @param {object} formatObj  - parsed format_json (has .parts array)
 * @param {object} ctx        - { date: Date, seq: number, skuPrefix: string }
 * @returns {string}
 */
export function renderBatchId(formatObj, ctx) {
  const { date = new Date(), seq = 1, skuPrefix = '' } = ctx;
  const dd   = String(date.getDate()).padStart(2, '0');
  const mm   = String(date.getMonth() + 1).padStart(2, '0');
  const yy   = String(date.getFullYear()).slice(-2);
  const yyyy = String(date.getFullYear());
  const monthLetter = (formatObj.month_codes || MONTH_CODES)[mm] || mm;

  // DATE_SERIAL: Excel-style days since 1899-12-30
  const EPOCH = new Date(1899, 11, 30);
  const dateSerial = Math.floor((date - EPOCH) / 86400000);

  const parts = formatObj.parts || [];
  let result = '';
  for (const part of parts) {
    switch (part.type) {
      case 'text':        result += part.value || ''; break;
      case 'dd':          result += dd; break;
      case 'mm':          result += mm; break;
      case 'month_letter':result += monthLetter; break;
      case 'yy':          result += yy; break;
      case 'yyyy':        result += yyyy; break;
      case 'seq':         result += String(seq).padStart(part.pad || 2, '0'); break;
      case 'sku_prefix':  result += skuPrefix; break;
      case 'date_serial': result += String(dateSerial); break;
      case 'dup_suffix':  result += seq > 1 ? (part.prefix || '-') + String(seq - 1) : ''; break;
      default: break;
    }
  }
  return result;
}

/**
 * Generate 5 preview examples (seq 1-5).
 */
export function previewExamples(formatObj, ctx) {
  return [1, 2, 3, 4, 5].map(seq => ({
    seq,
    result: renderBatchId(formatObj, { ...ctx, seq }),
  }));
}

/** Parse format_json string safely */
export function parseFormatJson(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

// ── PATTERN MODE ──────────────────────────────────────────────
const VALID_TOKENS = /\{(TEXT:[^}]+|DD|MM|MONTH_LETTER|YY|YYYY|SEQ:\d+|SKU_PREFIX|DATE_SERIAL|DUP_SUFFIX)\}/g;

export function validatePattern(pattern) {
  const errors = [];
  const allTokens = [...pattern.matchAll(/\{[^}]*\}/g)].map(m => m[0]);
  for (const t of allTokens) {
    if (!t.match(/^\{(TEXT:[^}]+|DD|MM|MONTH_LETTER|YY|YYYY|SEQ:\d+|SKU_PREFIX|DATE_SERIAL|DUP_SUFFIX)\}$/)) {
      errors.push(`Unknown token: ${t}`);
    }
  }
  return errors;
}

export function patternToParts(pattern) {
  const parts = [];
  let last = 0;
  const re = /\{(TEXT:[^}]+|DD|MM|MONTH_LETTER|YY|YYYY|SEQ:\d+|SKU_PREFIX|DATE_SERIAL|DUP_SUFFIX)\}/g;
  let m;
  while ((m = re.exec(pattern)) !== null) {
    if (m.index > last) {
      const literal = pattern.slice(last, m.index);
      if (literal) parts.push({ type: 'text', value: literal });
    }
    const tok = m[1];
    if (tok.startsWith('TEXT:'))        parts.push({ type: 'text', value: tok.slice(5) });
    else if (tok === 'DD')              parts.push({ type: 'dd' });
    else if (tok === 'MM')              parts.push({ type: 'mm' });
    else if (tok === 'MONTH_LETTER')    parts.push({ type: 'month_letter' });
    else if (tok === 'YY')              parts.push({ type: 'yy' });
    else if (tok === 'YYYY')            parts.push({ type: 'yyyy' });
    else if (tok.startsWith('SEQ:'))    parts.push({ type: 'seq', pad: parseInt(tok.split(':')[1]) || 2 });
    else if (tok === 'SKU_PREFIX')      parts.push({ type: 'sku_prefix' });
    else if (tok === 'DATE_SERIAL')     parts.push({ type: 'date_serial' });
    else if (tok === 'DUP_SUFFIX')      parts.push({ type: 'dup_suffix', prefix: '-', value: 'seq_minus_1' });
    last = m.index + m[0].length;
  }
  if (last < pattern.length) {
    const literal = pattern.slice(last);
    if (literal) parts.push({ type: 'text', value: literal });
  }
  return parts;
}

export function partsToPattern(parts) {
  return parts.map(p => {
    switch (p.type) {
      case 'text':         return p.value ? `{TEXT:${p.value}}` : '';
      case 'dd':           return '{DD}';
      case 'mm':           return '{MM}';
      case 'month_letter': return '{MONTH_LETTER}';
      case 'yy':           return '{YY}';
      case 'yyyy':         return '{YYYY}';
      case 'seq':          return `{SEQ:${p.pad || 2}}`;
      case 'sku_prefix':   return '{SKU_PREFIX}';
      case 'date_serial':  return '{DATE_SERIAL}';
      case 'dup_suffix':   return '{DUP_SUFFIX}';
      default: return '';
    }
  }).join('');
}

// ── STARTER TEMPLATES ────────────────────────────────────────
export const STARTER_TEMPLATES = [
  {
    id: 'swiggy_kfb',
    label: 'Swiggy KFB',
    description: 'KFB + Day + Month-Letter + YY + SEQ(2)',
    parts: [
      { type: 'text', value: 'KFB' },
      { type: 'dd' },
      { type: 'month_letter' },
      { type: 'yy' },
      { type: 'seq', pad: 2 },
    ],
    reset_scope: 'DAILY',
  },
  {
    id: 'prefix_yymmdd_seq3',
    label: 'Prefix + YYMMDD + SEQ(3)',
    description: 'SKU prefix + YYMMDD + 3-digit sequence',
    parts: [
      { type: 'sku_prefix' },
      { type: 'yy' },
      { type: 'mm' },
      { type: 'dd' },
      { type: 'seq', pad: 3 },
    ],
    reset_scope: 'DAILY',
  },
  {
    id: 'date_serial_seq',
    label: 'Date Serial + SKU + SEQ(2)',
    description: 'Excel date serial + SKU prefix + 2-digit seq + dup-suffix',
    parts: [
      { type: 'date_serial' },
      { type: 'sku_prefix' },
      { type: 'seq', pad: 2 },
      { type: 'dup_suffix', prefix: '-', value: 'seq_minus_1' },
    ],
    reset_scope: 'DAILY',
  },
];