import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  // Handle quoted fields
  function splitLine(line) {
    const result = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { result.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    result.push(cur.trim());
    return result;
  }
  const headers = splitLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });
    rows.push(row);
  }
  return rows;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { mode } = body; // 'customers' | 'rates' | 'both'

    const CUSTOMER_CSV = 'https://media.base44.com/files/public/69c237f5cfd7eab4cd2d386a/1b1fe6943_Customer.csv';
    const RATES_CSV = 'https://media.base44.com/files/public/69c237f5cfd7eab4cd2d386a/4ab72c9b0_ItemPrice.csv';

    const results = {};

    // ── CUSTOMERS ──
    if (mode === 'customers' || mode === 'both') {
      const csvText = await fetch(CUSTOMER_CSV).then(r => r.text());
      const rows = parseCSV(csvText);

      const customers = rows
        .filter(r => r['Customer Name'] && r['Customer Name'].trim())
        .map(r => ({
          name: (r['Customer Name'] || r['ID'] || '').trim(),
          code: (r['ID'] || '').trim(),
          gstin: (r['GSTIN / UIN'] || '').trim(),
          pan: (r['PAN'] || '').trim(),
          phone: (r['Mobile No'] || '').trim(),
          email: (r['Email Id'] || '').trim(),
          gst_category: (r['GST Category'] || '').trim() || 'Registered Regular',
          payment_terms: (r['Default Payment Terms Template'] || '').trim(),
          price_list: (r['Default Price List'] || '').trim(),
          check_outstanding: r['Check Outstanding'] === '1',
          outstanding_limit: parseFloat(r['Outstanding Limit'] || '0') || 0,
          current_outstanding: parseFloat(r['Current Outstanding'] || '0') || 0,
          leverage_outstanding: parseFloat(r['Leverage Outstanding'] || '0') || 0,
          status: r['Disabled'] === '1' ? 'inactive' : 'active',
          region: (r['Territory'] || '').trim(),
          notes: (r['Customer Group'] || '').trim(),
        }));

      let custCreated = 0;
      const BATCH = 50;
      for (let i = 0; i < customers.length; i += BATCH) {
        const batch = customers.slice(i, i + BATCH);
        await base44.asServiceRole.entities.Customer.bulkCreate(batch);
        custCreated += batch.length;
      }
      results.customers = { imported: custCreated, total: customers.length };
    }

    // ── SALES RATE LIST ──
    if (mode === 'rates' || mode === 'both') {
      const csvText = await fetch(RATES_CSV).then(r => r.text());
      const rows = parseCSV(csvText);

      const rates = rows
        .filter(r => r['Item Code'] && r['Rate'] && r['Price List'])
        .map(r => ({
          item_code: (r['Item Code'] || '').trim(),
          item_name: (r['Item Name'] || r['Item Description'] || '').trim(),
          price_list: (r['Price List'] || '').trim(),
          rate: parseFloat(r['Rate'] || '0') || 0,
          uom: (r['UOM'] || 'Pcs').trim(),
          packing_unit: parseFloat(r['Packing Unit'] || '0') || 0,
          brand: (r['Brand'] || '').trim(),
          currency: (r['Currency'] || 'INR').trim(),
          valid_from: (r['Valid From'] || '').trim() || null,
          valid_upto: (r['Valid Upto'] || '').trim() || null,
          is_active: r['Selling'] !== '0',
        }));

      let ratesCreated = 0;
      const BATCH = 50;
      for (let i = 0; i < rates.length; i += BATCH) {
        const batch = rates.slice(i, i + BATCH);
        await base44.asServiceRole.entities.SalesRateList.bulkCreate(batch);
        ratesCreated += batch.length;
      }
      results.rates = { imported: ratesCreated, total: rates.length };
    }

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});