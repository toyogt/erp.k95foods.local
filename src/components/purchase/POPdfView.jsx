import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { formatINR, formatDateDDMMYYYY } from './purchaseHelpers';

const COMPANY = {
  name: 'K95 FOODS PVT LTD',
  address: 'PLOT NO. 1299, M.I.E, PART - B Bahadurgarh, Jhajjar',
  state: 'Haryana - 124507',
  fssai: '10020011008320',
  mobile: '+917982750081',
  msme: 'DL05D0005564',
  gstin: '06AAHCK7191E1ZF',
  stateCode: '06',
  email: 'accounts@toyokombucha.com',
  purchaseEmail: 'purchase@toyokombucha.com',
  purchaseMobile: '+917042255057',
  logo: 'https://www.toyokombucha.com/cdn/shop/files/WebsiteLogo_95x@2x.png?v=1613724224',
};

const PDF_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Arial+Narrow&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #fff; font-family: Arial, Helvetica, sans-serif; }
  .po-sheet { width: 794px; min-height: 1123px; background: #fff; padding: 0; position: relative; }
  .po-topbar { height: 8px; display: flex; width: 100%; }
  .po-topbar-blue { background: #003399; flex: 0 0 63%; }
  .po-topbar-red { background: #cc0000; flex: 1; }
  .po-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 22px 40px 0 40px; }
  .po-company-name { font-size: 26px; font-weight: 900; color: #1a1a2e; letter-spacing: 0.5px; line-height: 1.1; margin-bottom: 8px; font-family: Arial Black, Arial, Helvetica, sans-serif; }
  .po-company-info { font-size: 9.5px; color: #333; line-height: 1.75; }
  .po-logo { height: 58px; object-fit: contain; margin-top: 4px; }
  .po-title { text-align: center; font-size: 18px; font-weight: 900; letter-spacing: 2px; color: #000; margin: 22px 40px 10px 40px; }
  .po-table { width: calc(100% - 80px); margin: 0 40px; border-collapse: collapse; font-size: 10px; }
  .po-table td, .po-table th { border: 0.7px solid #555; padding: 4px 6px; vertical-align: middle; }
  .po-t1 .lbl { font-weight: 700; }
  .po-t1 .po-num { font-weight: 700; font-size: 11px; }
  .po-table-gap { height: 12px; }
  .po-t2 td { vertical-align: top; padding: 5px 6px; font-size: 9.5px; line-height: 1.65; }
  .po-t2 .lbl { font-weight: 700; font-size: 10px; }
  .po-t2 .v-name { font-weight: 700; font-style: italic; font-size: 10px; }
  .po-t2 .s-name { font-weight: 700; font-size: 10px; }
  .po-party-heading { font-size: 13px; font-weight: 900; letter-spacing: 0.5px; color: #000; margin: 10px 40px 5px 40px; font-family: Arial Black, Arial, Helvetica, sans-serif; }
  .po-items { width: calc(100% - 80px); margin: 0 40px; border-collapse: collapse; font-size: 10px; }
  .po-items th, .po-items td { border: 0.7px solid #555; padding: 4px 5px; vertical-align: middle; }
  .th-blue { color: #003acc; font-weight: 700; font-size: 10px; }
  .th-orange { color: #cc6600; font-weight: 700; font-size: 10px; text-align: right; }
  .item-desc { font-weight: 700; font-style: italic; }
  .empty-row td.grey { background: #e4e4e4; }
  .empty-row td { height: 20px; }
  .subtotal-row td { height: 22px; }
  .subtotal-row .span-left { border: none; background: transparent; }
  .subtotal-row .lbl-cell { text-align: right; font-weight: 700; color: #003acc; font-size: 10px; padding-right: 6px; }
  .subtotal-row .val-cell { text-align: right; font-size: 10px; width: 90px; }
  .total-row td { height: 26px; }
  .total-row .lbl-cell { text-align: right; font-weight: 900; font-size: 13px; color: #000; padding-right: 6px; }
  .total-row .val-cell { text-align: right; font-weight: 900; font-size: 13px; color: #000; width: 90px; }
  .bottom-row td { height: 20px; }
  .po-terms { margin: 14px 40px 0 40px; font-size: 9px; color: #333; line-height: 1.6; }
  .po-terms-title { font-weight: 700; font-size: 10px; margin-bottom: 4px; }
`;

function buildEmptyRows(count) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push(
      <tr key={`empty-${i}`} className="empty-row">
        <td className="grey"></td>
        <td className="grey"></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
    );
  }
  return rows;
}

export default function POPdfView({ po }) {
  const sheetRef = useRef(null);

  const { data: poItems = [] } = useQuery({
    queryKey: ['po-pdf-items', po.po_id],
    queryFn: () => base44.entities.PurchaseOrderItem.filter({ po_id: po.po_id }, 'line_number', 100),
    staleTime: 20000,
  });

  const subtotal = po.subtotal || poItems.reduce((sum, it) => sum + ((it.rate || it.unit_price || 0) * (it.qty || it.quantity || 0)), 0);
  const gstAmount = po.gst_amount || 0;
  const gstRate = po.gst_rate || (subtotal > 0 ? ((gstAmount / subtotal) * 100) : 0);
  const total = po.total_amount || (subtotal + gstAmount);
  const emptyRowCount = Math.max(0, 4 - poItems.length);

  function handlePrint() {
    const content = sheetRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Purchase Order - ${po.po_id}</title><style>${PDF_STYLES}
      @media print { .po-sheet { box-shadow: none; width: 100%; } }
    </style></head><body>${content.outerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }

  return (
    <div className="space-y-4">
      <Button
        variant="outline"
        onClick={handlePrint}
        className="h-11 w-full font-bold gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
      >
        <Download className="w-4 h-4" /> Download / Print Purchase Order
      </Button>

      {/* Preview with scroll */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-slate-100 p-4">
        <style>{PDF_STYLES}</style>
        <div className="po-sheet mx-auto shadow-lg" ref={sheetRef}>
          {/* Top colour bar */}
          <div className="po-topbar">
            <div className="po-topbar-blue" />
            <div className="po-topbar-red" />
          </div>

          {/* Header */}
          <div className="po-header">
            <div>
              <div className="po-company-name">{COMPANY.name}</div>
              <div className="po-company-info">
                {COMPANY.address}<br />
                {COMPANY.state} FSSAI Number: {COMPANY.fssai}<br />
                Mobile No. {COMPANY.mobile} &nbsp;&nbsp; MSME No. {COMPANY.msme}<br />
                GSTIN/UIN: {COMPANY.gstin} State Name : Haryana, Code : {COMPANY.stateCode}<br />
                {COMPANY.email}
              </div>
            </div>
            <img src={COMPANY.logo} alt="K95 Foods" className="po-logo" crossOrigin="anonymous" />
          </div>

          {/* Title */}
          <div className="po-title">PURCHASE ORDER</div>

          {/* Table 1 — Meta */}
          <table className="po-table po-t1">
            <colgroup>
              <col style={{ width: '80px' }} />
              <col style={{ width: '192px' }} />
              <col />
            </colgroup>
            <tbody>
              <tr>
                <td className="lbl">Date</td>
                <td className="lbl">Quotation No &amp; Date</td>
                <td className="lbl">Purchase Order Number</td>
              </tr>
              <tr>
                <td>{formatDateDDMMYYYY(po.po_date)}</td>
                <td>{po.quotation_number || 'Telephonic'}</td>
                <td className="po-num">{po.po_id}</td>
              </tr>
              <tr>
                <td className="lbl">Due Date</td>
                <td className="lbl">Ship Via</td>
                <td className="lbl">Mode of Payment</td>
              </tr>
              <tr>
                <td>{formatDateDDMMYYYY(po.due_date)}</td>
                <td>{po.ship_via || ''}</td>
                <td>{po.payment_terms || po.custom_payment_terms || ''}</td>
              </tr>
            </tbody>
          </table>

          <div className="po-table-gap" />

          {/* Table 2 — Vendor / Ship To */}
          <table className="po-table po-t2">
            <colgroup>
              <col style={{ width: '50%' }} />
              <col style={{ width: '50%' }} />
            </colgroup>
            <tbody>
              <tr>
                <td className="lbl">Vendor Name</td>
                <td className="lbl">Ship To</td>
              </tr>
              <tr>
                <td style={{ verticalAlign: 'top' }}>
                  <div className="v-name">{po.supplier_name || '—'}</div>
                  {po.supplier_address && <>{po.supplier_address}<br /></>}
                  {po.supplier_gstin && <>GSTIN-{po.supplier_gstin}<br /></>}
                  {po.supplier_contact && <>CONTACT:- {po.supplier_contact}<br /></>}
                  {po.supplier_email && <>EMAIL:- {po.supplier_email}</>}
                </td>
                <td style={{ verticalAlign: 'top' }}>
                  <div className="s-name">{COMPANY.name}</div>
                  {po.delivery_address || (<>
                    {COMPANY.address}<br />
                    {COMPANY.state} FSSAI Number: {COMPANY.fssai}<br />
                    Mobile No. {COMPANY.purchaseMobile} &nbsp;&nbsp; MSME No. {COMPANY.msme}<br />
                    GSTIN/UIN: {COMPANY.gstin} State Name : Haryana, Code : {COMPANY.stateCode}<br />
                    {COMPANY.purchaseEmail}
                  </>)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Party Details heading */}
          <div className="po-party-heading">PARTY DETAILS</div>

          {/* Items table */}
          <table className="po-items">
            <colgroup>
              <col style={{ width: '46px' }} />
              <col />
              <col style={{ width: '54px' }} />
              <col style={{ width: '54px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '90px' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="th-blue" style={{ textAlign: 'center' }}>Item #</th>
                <th className="th-blue" style={{ textAlign: 'left' }}>Description</th>
                <th className="th-blue" style={{ textAlign: 'center' }}>QTY</th>
                <th className="th-blue" style={{ textAlign: 'center' }}>Unit</th>
                <th className="th-orange">Unit Price</th>
                <th className="th-orange">Total Price</th>
              </tr>
            </thead>
            <tbody>
              {poItems.map((it, i) => {
                const qty = it.qty || it.quantity || 0;
                const rate = it.rate || it.unit_price || 0;
                const lineTotal = it.amount || it.total_price || (rate * qty);
                return (
                  <tr key={it.id || i}>
                    <td style={{ textAlign: 'center' }}>{i + 1}</td>
                    <td className="item-desc">{it.item_name || it.item_code}</td>
                    <td style={{ textAlign: 'center' }}>{qty}</td>
                    <td style={{ textAlign: 'center' }}>{it.uom_code || 'Pcs'}</td>
                    <td style={{ textAlign: 'right' }}>{formatINR(rate)}</td>
                    <td style={{ textAlign: 'right' }}>{formatINR(lineTotal)}</td>
                  </tr>
                );
              })}

              {buildEmptyRows(emptyRowCount)}

              {/* SUB TOTAL */}
              <tr className="subtotal-row">
                <td colSpan={4} className="span-left lbl-cell">SUB TOTAL</td>
                <td className="val-cell" style={{ borderLeft: '0.7px solid #555' }}></td>
                <td className="val-cell">{formatINR(subtotal)}</td>
              </tr>

              {/* GST */}
              <tr className="subtotal-row">
                <td colSpan={4} className="span-left lbl-cell">GST</td>
                <td className="val-cell" style={{ borderLeft: '0.7px solid #555' }}></td>
                <td className="val-cell">{formatINR(gstAmount)}</td>
              </tr>

              {/* GST RATE */}
              <tr className="subtotal-row">
                <td colSpan={4} className="span-left lbl-cell">GST RATE ( IN % )</td>
                <td className="val-cell" style={{ borderLeft: '0.7px solid #555' }}></td>
                <td className="val-cell">{gstRate > 0 ? `${Number(gstRate).toFixed(2)}%` : '—'}</td>
              </tr>

              {/* Freight if applicable */}
              {(po.estimated_freight > 0 || po.actual_freight > 0) && (
                <tr className="subtotal-row">
                  <td colSpan={4} className="span-left lbl-cell">FREIGHT</td>
                  <td className="val-cell" style={{ borderLeft: '0.7px solid #555' }}></td>
                  <td className="val-cell">{formatINR(po.actual_freight || po.estimated_freight)}</td>
                </tr>
              )}

              {/* TOTAL */}
              <tr className="total-row">
                <td colSpan={4} className="span-left lbl-cell">TOTAL</td>
                <td className="val-cell" style={{ borderLeft: '0.7px solid #555' }}></td>
                <td className="val-cell">{formatINR(total)}</td>
              </tr>

              {/* Bottom empty row */}
              <tr className="bottom-row">
                <td colSpan={6}></td>
              </tr>
            </tbody>
          </table>

          {/* Terms & Conditions */}
          {po.terms_and_conditions && (
            <div className="po-terms">
              <div className="po-terms-title">Terms &amp; Conditions:</div>
              {po.terms_and_conditions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}