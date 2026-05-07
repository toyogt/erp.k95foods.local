/**
 * Derive a printer-friendly size code (e.g. "4x6", "4x3", "100x150mm")
 * from a BoxLabelTemplate's page dimensions + unit.
 *
 * Matching strategy used against agent-reported `size_code`:
 *   - Convert template W×H to inches (rounded to 1 decimal, then trimmed).
 *   - Use orientation-agnostic sorted order so 4x6 == 6x4.
 *   - Returns BOTH a primary code and a list of acceptable aliases.
 */

function mmToInch(mm) { return mm / 25.4; }

function roundDim(v) {
  // Round to 1 decimal; drop trailing .0
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function deriveSizeCode(template) {
  if (!template) return { primary: '', aliases: [] };
  const unit = template.page_unit === 'inch' ? 'inch' : 'mm';
  const wRaw = Number(template.page_width) || 0;
  const hRaw = Number(template.page_height) || 0;
  const wIn = unit === 'inch' ? wRaw : mmToInch(wRaw);
  const hIn = unit === 'inch' ? hRaw : mmToInch(hRaw);

  // Orientation-agnostic: smaller dim first
  const [a, b] = wIn <= hIn ? [wIn, hIn] : [hIn, wIn];
  const aR = roundDim(a);
  const bR = roundDim(b);

  const primary = `${aR}x${bR}`;             // e.g. "4x6"
  const aliases = new Set([
    primary,
    `${bR}x${aR}`,                            // reversed
    `${aR}x${bR}in`,
    `${bR}x${aR}in`,
  ]);

  // Also include a mm alias for agents that report in mm
  if (unit === 'mm') {
    aliases.add(`${roundDim(Math.min(wRaw, hRaw))}x${roundDim(Math.max(wRaw, hRaw))}mm`);
    aliases.add(`${roundDim(Math.max(wRaw, hRaw))}x${roundDim(Math.min(wRaw, hRaw))}mm`);
  }

  return { primary, aliases: Array.from(aliases) };
}

/**
 * Does an agent-reported printer size_code match our template's size?
 * Comparison is case-insensitive and trims whitespace.
 */
export function sizeMatches(printerSizeCode, templateAliases) {
  if (!printerSizeCode) return false;
  const norm = String(printerSizeCode).trim().toLowerCase().replace(/\s+/g, '');
  return templateAliases.some(a => String(a).trim().toLowerCase().replace(/\s+/g, '') === norm);
}