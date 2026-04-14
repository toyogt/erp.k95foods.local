/**
 * labelFieldComputer.js
 * Computes all label POD field values from job + product data.
 * Used by LblLabelPreviewCard and demo/bulk print command builders.
 *
 * POD Field definitions (based on Rynan middleware):
 *   POD1  — MRP (e.g. "69.00")
 *   POD2  — MRP with USP (e.g. "₹69.00 (USP: ₹0.35/ml)")
 *   POD3  — "Incl. of all taxes"
 *   POD4  — Batch No. (e.g. "GB46119-1")
 *   POD5  — Manufacturing Date (DD/MM/YYYY)
 *   POD6  — Expiry Date/Use By Date (DD/MM/YYYY)
 *   POD7  — USP value only (e.g. "0.35")
 *   POD8  — Manufacturing Date -1 day (for variant SKU offset)
 *   POD9  — Expiry Date -1 day (for variant SKU offset)
 *   POD10 — Net Weight (e.g. "200 ml")
 *   POD11 — USP with unit (e.g. "₹0.35/ml")
 *   POD12 — MRP and USP combined (e.g. "69.00 / 0.35")
 */

import moment from 'moment';

/**
 * @param {object} params
 * @param {string|number} params.mrp           – MRP in INR (e.g. 69)
 * @param {number}        params.mlPerBottle   – Volume in ml (e.g. 200)
 * @param {string}        params.mfgDate       – DD/MM/YYYY or YYYY-MM-DD
 * @param {string}        params.labellingDate – DD/MM/YYYY or YYYY-MM-DD (optional)
 * @param {number}        params.shelfLifeDays – Shelf life in days
 * @param {string}        params.batchNo       – Batch number string
 * @param {string}        params.productName   – Product display name
 * @returns {object} computed label fields
 */
export function computeLabelFields({ mrp, mlPerBottle, mfgDate, labellingDate, shelfLifeDays, batchNo, productName }) {
  // Parse MFG date
  let mfgMoment = null;
  if (mfgDate) {
    mfgMoment = mfgDate.includes('/')
      ? moment(mfgDate, 'DD/MM/YYYY', true)
      : moment(mfgDate, 'YYYY-MM-DD', true);
    if (!mfgMoment.isValid()) mfgMoment = null;
  }

  // Parse labelling date (used for expiry base if provided)
  let labellingMoment = null;
  if (labellingDate) {
    labellingMoment = labellingDate.includes('/')
      ? moment(labellingDate, 'DD/MM/YYYY', true)
      : moment(labellingDate, 'YYYY-MM-DD', true);
    if (!labellingMoment.isValid()) labellingMoment = null;
  }

  // Expiry base: prefer labelling date, fall back to mfg date
  const expiryBase = labellingMoment || mfgMoment;

  // Compute expiry
  let expiryMoment = null;
  if (expiryBase && shelfLifeDays && Number(shelfLifeDays) > 0) {
    expiryMoment = expiryBase.clone().add(Number(shelfLifeDays), 'days');
  }

  // USP = MRP / ml
  let uspValue = null;
  if (mrp && mlPerBottle && Number(mlPerBottle) > 0) {
    uspValue = (Number(mrp) / Number(mlPerBottle)).toFixed(2);
  }

  const mrpFormatted = mrp ? Number(mrp).toFixed(2) : '';
  const mfgFormatted = mfgMoment ? mfgMoment.format('DD/MM/YYYY') : '';
  const expiryFormatted = expiryMoment ? expiryMoment.format('DD/MM/YYYY') : '';

  // Offset dates (-1 day) for variant SKU (e.g. Swiggy Noice variant)
  const mfgOffsetFormatted = mfgMoment ? mfgMoment.clone().subtract(1, 'day').format('DD/MM/YYYY') : '';
  const expiryOffsetFormatted = expiryMoment ? expiryMoment.clone().subtract(1, 'day').format('DD/MM/YYYY') : '';

  return {
    // POD1
    mrp: mrpFormatted,
    // POD2
    mrpWithUsp: mrpFormatted && uspValue ? `₹${mrpFormatted} (USP: ₹${uspValue}/ml)` : mrpFormatted ? `₹${mrpFormatted}` : '',
    // POD3
    taxLine: 'Incl. of all taxes',
    // POD4
    batchNo: batchNo || '',
    // POD5
    mfgDate: mfgFormatted,
    // POD6
    expiryDate: expiryFormatted,
    // POD7
    usp: uspValue || '',
    // POD8
    mfgDateOffset: mfgOffsetFormatted,
    // POD9
    expiryDateOffset: expiryOffsetFormatted,
    // POD10
    netWeight: mlPerBottle ? `${mlPerBottle} ml` : '',
    // POD11
    uspWithUnit: uspValue ? `₹${uspValue}/ml` : '',
    // POD12
    mrpAndUsp: mrpFormatted && uspValue ? `${mrpFormatted} / ${uspValue}` : '',
    // Meta
    productName: productName || '',
  };
}