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

      for (const row of rows) {
        const name = row['Customer Name'] || row['ID'] || '';
        if (!name) continue;
        const priceList = row['Default Price List'] || '';
        const gstin = row['GSTIN / UIN'] || '';
        const pan = row['PAN'] || '';
        const phone = row['Mobile No'] || '';
        const email = row['Email Id'] || '';
        const checkOutstanding = row['Check Outstanding'] === '1';
        const outstandingLimit = parseFloat(row['Outstanding Limit']) || 0;
        const currentOutstanding = parseFloat(row['Current Outstanding']) || 0;
        const leverageOutstanding = parseFloat(row['Leverage Outstanding']) || 0;
        const billingAddress = row['Customer Primary Address'] || '';
        const gstCategory = row['GST Category'] || '';

        try {
          await base44.asServiceRole.entities.Customer.create({
            name,
            price_list: priceList,
            gstin,
            pan,
            phone,
            email,
            check_outstanding: checkOutstanding,
            outstanding_limit: outstandingLimit,
            current_outstanding: currentOutstanding,
            leverage_outstanding: leverageOutstanding,
            billing_address: billingAddress,
            gst_category: gstCategory,
            status: 'active',
          });
          results.customers.success++;
        } catch {
          results.customers.failed++;
        }
      }
    }

    // ---- IMPORT ITEM PRICES ----
    if (item_price_csv_url) {
      const csvText = await fetch(item_price_csv_url).then(r => r.text());
      const rows = parseCSV(csvText);

      for (const row of rows) {
        const itemCode = row['Item Code'] || '';
        const priceList = row['Price List'] || '';
        const rate = parseFloat(row['Rate']) || 0;
        if (!itemCode || !priceList || !rate) { results.rates.failed++; continue; }

        try {
          await base44.asServiceRole.entities.SalesRateList.create({
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
          results.rates.success++;
        } catch {
          results.rates.failed++;
        }
      }
    }

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});