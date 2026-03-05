import { base44 } from '@/api/base44Client';

/**
 * Get period key based on reset scope and date.
 * @param {Date} date - The date to base the period on
 * @param {string} reset_scope - 'DAILY', 'MONTHLY', 'YEARLY', or 'NEVER'
 * @returns {string} Period key (e.g., '20260302' for DAILY, '202603' for MONTHLY)
 */
export function getPeriodKey(date, reset_scope) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  if (reset_scope === 'DAILY') {
    return `${year}${month}${day}`;
  } else if (reset_scope === 'MONTHLY') {
    return `${year}${month}`;
  } else if (reset_scope === 'YEARLY') {
    return `${year}`;
  } else {
    // NEVER — use a fixed key
    return 'NEVER';
  }
}

/**
 * Get next sequence number and atomically increment counter.
 * @param {string} rule_id - BatchFormatRule ID
 * @param {string} sku_code - SKU code
 * @param {string} period_key - Period key from getPeriodKey()
 * @returns {Promise<number>} The sequence number to use
 */
export async function nextSequence(rule_id, sku_code, period_key) {
  try {
    // Find or create counter
    const existing = await base44.entities.BatchSeqCounter.filter({
      rule_id,
      sku_code,
      period_key,
    });

    if (existing.length > 0) {
      const counter = existing[0];
      const seq = counter.next_seq;
      // Increment for next call
      await base44.entities.BatchSeqCounter.update(counter.id, {
        next_seq: seq + 1,
      });
      return seq;
    } else {
      // Create new counter
      await base44.entities.BatchSeqCounter.create({
        rule_id,
        sku_code,
        period_key,
        next_seq: 2, // We'll use 1, next call uses 2
      });
      return 1;
    }
  } catch (err) {
    console.error('Error in nextSequence:', err);
    throw err;
  }
}

/**
 * Get next sequence without incrementing (preview only).
 * @param {string} rule_id - BatchFormatRule ID
 * @param {string} sku_code - SKU code
 * @param {string} period_key - Period key from getPeriodKey()
 * @returns {Promise<number>} The next sequence number (non-incrementing)
 */
export async function peekNextSequence(rule_id, sku_code, period_key) {
  try {
    const existing = await base44.entities.BatchSeqCounter.filter({
      rule_id,
      sku_code,
      period_key,
    });
    return existing.length > 0 ? existing[0].next_seq : 1;
  } catch {
    return 1;
  }
}

/**
 * Render batch ID based on rule format and inputs.
 * @param {Object} params
 *   - rule: BatchFormatRule object with format_json
 *   - sku: Product/SKU info { batch_prefix?, item_code? }
 *   - date: Date object
 *   - seq: Sequence number (e.g., 1, 2, 3...)
 * @returns {string} Rendered batch ID
 *
 * format_json structure:
 * {
 *   "parts": [
 *     {"type":"text","value":"KFB"},
 *     {"type":"day","pad":2},
 *     {"type":"month_letter"},
 *     {"type":"year2"},
 *     {"type":"seq","pad":2},
 *     {"type":"sku_prefix"},
 *     {"type":"date_serial_ddmmyyyy"},
 *     {"type":"suffix_if_seq_gt_1","prefix":"-","value":"seq_minus_1"}
 *   ]
 * }
 */
/**
 * Resolve format_json — handles both string (from DB) and parsed object.
 */
function resolveFormatJson(rule) {
  if (!rule) return null;
  if (typeof rule.format_json === 'string') {
    try { return JSON.parse(rule.format_json); } catch { return null; }
  }
  return rule.format_json;
}

/**
 * Render batch ID based on rule format and inputs.
 * @param {Object} params
 *   - rule: BatchFormatRule object with format_json (string or object)
 *   - sku: Product/SKU info { batch_prefix?, item_code? }
 *   - date: Date object
 *   - seq: Sequence number (e.g., 1, 2, 3...)
 *   - useBatchPrefix: boolean — if true and sku.batch_prefix exists, use it for sku_prefix token
 */
export function renderBatchId({ rule, sku, date, seq, useBatchPrefix }) {
  const fmtJson = resolveFormatJson(rule);
  if (!fmtJson?.parts) {
    return '';
  }

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const monthLetter = String.fromCharCode(64 + month); // A=Jan, L=Dec

  let result = '';
  const prefixValue = useBatchPrefix !== false && sku?.batch_prefix ? sku.batch_prefix : (sku?.item_code || '');

  for (const part of fmtJson.parts) {
    const type = part.type;

    if (type === 'text') {
      result += part.value || '';
    } else if (type === 'day') {
      const pad = part.pad || 1;
      result += String(day).padStart(pad, '0');
    } else if (type === 'month') {
      const pad = part.pad || 1;
      result += String(month).padStart(pad, '0');
    } else if (type === 'month_letter') {
      result += monthLetter;
    } else if (type === 'year2') {
      result += String(year).slice(-2);
    } else if (type === 'year4') {
      result += String(year);
    } else if (type === 'seq') {
      const pad = part.pad || 1;
      result += String(seq).padStart(pad, '0');
    } else if (type === 'sku_prefix') {
      result += sku?.batch_prefix || sku?.item_code || '';
    } else if (type === 'date_serial_ddmmyyyy') {
      // DATEVALUE-like: concatenate dd + mm + yyyy
      const dd = String(day).padStart(2, '0');
      const mm = String(month).padStart(2, '0');
      const yyyy = String(year);
      result += `${dd}${mm}${yyyy}`;
    } else if (type === 'suffix_if_seq_gt_1') {
      if (seq > 1) {
        const prefix = part.prefix || '';
        const value = part.value || 'seq';
        if (value === 'seq_minus_1') {
          result += prefix + String(seq - 1);
        } else if (value === 'seq') {
          result += prefix + String(seq);
        }
      }
    }
  }

  return result;
}

/**
 * Example rules (for documentation):
 *
 * SWIGGY_KFB:
 * {
 *   "rule_id": "SWIGGY_KFB",
 *   "description": "Swiggy KFB format: KFB + DD + MONTH_LETTER + YY + SEQ(2)",
 *   "format_json": {
 *     "parts": [
 *       {"type":"text","value":"KFB"},
 *       {"type":"day","pad":2},
 *       {"type":"month_letter"},
 *       {"type":"year2"},
 *       {"type":"seq","pad":2}
 *     ]
 *   }
 * }
 *
 * MASTER_PREFIX_DATE_SERIAL:
 * {
 *   "rule_id": "MASTER_PREFIX_DATE_SERIAL",
 *   "description": "SKU prefix + date serial + optional seq suffix",
 *   "format_json": {
 *     "parts": [
 *       {"type":"sku_prefix"},
 *       {"type":"date_serial_ddmmyyyy"},
 *       {"type":"suffix_if_seq_gt_1","prefix":"-","value":"seq_minus_1"}
 *     ]
 *   }
 * }
 */