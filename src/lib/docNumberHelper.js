/**
 * Shared document number generator.
 * Uses BatchSeqCounter to produce sequential numbers in format:
 *   SO/25-26/005001
 *   INV/25-26/005001
 */
import { base44 } from '@/api/base44Client';

function getFiscalYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed; April = 3
  if (month >= 3) return `${String(year).slice(-2)}-${String(year + 1).slice(-2)}`;
  return `${String(year - 1).slice(-2)}-${String(year).slice(-2)}`;
}

/**
 * Generate next document number and persist the counter.
 * @param {'SO'|'INV'} prefix - document type prefix
 * @param {number} startFrom - starting sequence if no counter exists (default 5001)
 */
export async function generateDocNumber(prefix, startFrom = 5001) {
  const fiscalYear = getFiscalYear();
  const batchKey = `${prefix}_${fiscalYear}`;

  const counters = await base44.entities.BatchSeqCounter.filter({ batch_key: batchKey });
  let nextSeq = startFrom;
  let counterId = null;

  if (counters.length > 0) {
    nextSeq = (counters[0].last_seq || startFrom - 1) + 1;
    counterId = counters[0].id;
  }

  const docNumber = `${prefix}/${fiscalYear}/${String(nextSeq).padStart(6, '0')}`;

  // Persist immediately so concurrent calls don't collide
  if (counterId) {
    await base44.entities.BatchSeqCounter.update(counterId, { last_seq: nextSeq });
  } else {
    await base44.entities.BatchSeqCounter.create({ batch_key: batchKey, last_seq: nextSeq });
  }

  return docNumber;
}