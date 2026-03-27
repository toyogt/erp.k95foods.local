import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Parse a CSV string into array of objects
function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values = [];
    let current = '';
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { values.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    values.push(current.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = (values[i] || '').replace(/^"|"$/g, '').trim(); });
    return row;
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { customer_csv_url, item_price_csv_url } = body;

    const results = { customers: { success: 0, failed: 0 }, rates: { success: 0, failed: 0 } };

    // ---- IMPORT CUSTOMERS ----
    if (customer_csv_url) {
      const csvText = await fetch(customer_csv_url).then(r => r.text());
      const rows = parseCSV(csvText);
      const records = [];

      for (const row of rows) {
        const name = row['Customer Name'] || row['ID'] || '';
        if (!name) continue;
        records.push({
          name,
          price_list: row['Default Price List'] || '',
          gstin: row['GSTIN / UIN'] || '',
          pan: row['PAN'] || '',
          phone: row['Mobile No'] || '',
          email: row['Email Id'] || '',
          check_outstanding: row['Check Outstanding'] === '1',
          outstanding_limit: parseFloat(row['Outstanding Limit']) || 0,
          current_outstanding: parseFloat(row['Current Outstanding']) || 0,
          leverage_outstanding: parseFloat(row['Leverage Outstanding']) || 0,
          billing_address: row['Customer Primary Address'] || '',
          gst_category: row['GST Category'] || '',
          status: 'active',
        });
      }

      // Bulk insert in chunks of 50
      const CHUNK = 50;
      for (let i = 0; i < records.length; i += CHUNK) {
        try {
          await base44.asServiceRole.entities.Customer.bulkCreate(records.slice(i, i + CHUNK));
          results.customers.success += Math.min(CHUNK, records.length - i);
        } catch {
          results.customers.failed += Math.min(CHUNK, records.length - i);
        }
      }
    }

    // ---- IMPORT ITEM PRICES ----
    if (item_price_csv_url) {

      const csvText = await fetch(item_price_csv_url).then(r => r.text());
      const rows = parseCSV(csvText);

      const records = [];
      for (const row of rows) {
        const itemCode = row['Item Code'] || '';
        const priceList = row['Price List'] || '';
        const rate = parseFloat(row['Rate']) || 0;
        if (!itemCode || !priceList || !rate) { results.rates.failed++; continue; }
        records.push({
          item_code: itemCode,
          item_name: row['Item Name'] || '',
          price_list: priceList,
          rate,
          uom: row['UOM'] || 'Pcs',
          brand: row['Brand'] || '',
          currency: row['Currency'] || 'INR',
          valid_from: row['Valid From'] || '',
          valid_upto: row['Valid Upto'] || '',
          packing_unit: parseFloat(row['Packing Unit']) || 0,
          is_active: true,
        });
      }

      const CHUNK = 50;
      for (let i = 0; i < records.length; i += CHUNK) {
        try {
          await base44.asServiceRole.entities.SalesRateList.bulkCreate(records.slice(i, i + CHUNK));
          results.rates.success += Math.min(CHUNK, records.length - i);
        } catch {
          results.rates.failed += Math.min(CHUNK, records.length - i);
        }
      }
    }

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});