import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const bool = (v) => v === '1' || v === 'true' || v === 'True' || v === true;
const num = (v) => v !== '' && v != null ? parseFloat(v) || 0 : 0;
const str = (v) => (v || '').trim();

function mapRow(row) {
  return {
    name: str(row['Customer Name'] || row['ID']),
    series: str(row['Series']),
    customer_type: str(row['Customer Type']),
    customer_group: str(row['Customer Group']),
    gst_category: str(row['GST Category']),
    salutation: str(row['Salutation']),
    outlet_id: str(row['Outlet ID']),
    territory: str(row['Territory']),
    gender: str(row['Gender']),
    from_lead: str(row['From Lead']),
    from_opportunity: str(row['From Opportunity']),
    from_prospect: str(row['From Prospect']),
    account_manager: str(row['Account Manager']),
    image: str(row['Image']),
    billing_currency: str(row['Billing Currency']),
    default_bank_account: str(row['Default Company Bank Account']),
    check_outstanding: bool(row['Check Outstanding']),
    price_list: str(row['Default Price List']),
    outstanding_limit: num(row['Outstanding Limit']),
    current_outstanding: num(row['Current Outstanding']),
    leverage_outstanding: num(row['Leverage Outstanding']),
    is_internal_customer: bool(row['Is Internal Customer']),
    represents_company: bool(row['Represents Company']),
    market_segment: str(row['Market Segment']),
    industry: str(row['Industry']),
    customer_pos_id: str(row['Customer POS id']),
    website: str(row['Website']),
    print_language: str(row['Print Language']),
    customer_details: str(row['Customer Details']),
    customer_primary_address: str(row['Customer Primary Address']),
    primary_address: str(row['Primary Address']),
    customer_primary_contact: str(row['Customer Primary Contact']),
    mobile_no: str(row['Mobile No']),
    email: str(row['Email Id']),
    first_name: str(row['First Name']),
    last_name: str(row['Last Name']),
    gstin: str(row['GSTIN / UIN']),
    pan: str(row['PAN']),
    tax_id: str(row['Tax ID']),
    tax_category: str(row['Tax Category']),
    tax_withholding_category: str(row['Tax Withholding Category']),
    payment_terms: str(row['Default Payment Terms Template']),
    loyalty_program: str(row['Loyalty Program']),
    loyalty_program_tier: str(row['Loyalty Program Tier']),
    sales_partner: str(row['Sales Partner']),
    commission_rate: num(row['Commission Rate']),
    allow_invoice_without_so: bool(row['Allow Sales Invoice Creation Without Sales Order']),
    allow_invoice_without_dn: bool(row['Allow Sales Invoice Creation Without Delivery Note']),
    is_frozen: bool(row['Is Frozen']),
    disabled: bool(row['Disabled']),
    tally_synced: bool(row['Tally Synced']),
    tally_sync_date: str(row['Tally Sync Date']),
    tally_sync_status: str(row['Tally Sync Status']),
    tally_parent_group: str(row['Tally Parent Group']),
    status: bool(row['Disabled']) ? 'inactive' : 'active',
  };
}

function parseCSV(text) {
  const lines = text.split('\n');
  if (lines.length < 2) return [];

  // Parse headers (handle quoted fields)
  const parseRow = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseRow(line);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = values[idx] || ''; });
    rows.push(obj);
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

    const { csv_url, dry_run = false } = await req.json();
    if (!csv_url) return Response.json({ error: 'csv_url is required' }, { status: 400 });

    // Fetch the CSV
    const csvResp = await fetch(csv_url);
    if (!csvResp.ok) return Response.json({ error: 'Failed to fetch CSV' }, { status: 400 });
    const csvText = await csvResp.text();

    const rows = parseCSV(csvText);
    console.log(`Parsed ${rows.length} rows from CSV`);

    if (dry_run) {
      const sample = rows.slice(0, 3).map(mapRow);
      return Response.json({ total: rows.length, sample, dry_run: true });
    }

    // Fetch existing customers to skip duplicates
    const existing = await base44.asServiceRole.entities.Customer.list();
    const existingNames = new Set(existing.map(c => (c.name || '').toLowerCase()));
    const existingGSTINs = new Set(existing.filter(c => c.gstin).map(c => c.gstin.toLowerCase()));
    const existingMobiles = new Set(existing.filter(c => c.mobile_no).map(c => c.mobile_no.replace(/\s+/g, '')));

    const toCreate = [];
    const skipped = [];

    for (const row of rows) {
      const mapped = mapRow(row);
      if (!mapped.name) continue;

      const dupByName = existingNames.has(mapped.name.toLowerCase());
      const dupByGSTIN = mapped.gstin && existingGSTINs.has(mapped.gstin.toLowerCase());
      const dupByMobile = mapped.mobile_no && existingMobiles.has(mapped.mobile_no.replace(/\s+/g, ''));

      if (dupByName || dupByGSTIN || dupByMobile) {
        const reason = dupByName ? 'name' : dupByGSTIN ? 'GSTIN' : 'mobile';
        skipped.push({ name: mapped.name, reason });
        continue;
      }

      // Register in sets so intra-CSV duplicates are also caught
      existingNames.add(mapped.name.toLowerCase());
      if (mapped.gstin) existingGSTINs.add(mapped.gstin.toLowerCase());
      if (mapped.mobile_no) existingMobiles.add(mapped.mobile_no.replace(/\s+/g, ''));

      toCreate.push(mapped);
    }

    console.log(`Creating ${toCreate.length} new, skipping ${skipped.length} duplicates`);

    // Sequential with delay to stay within rate limits
    let created = 0;
    const errors = [];
    for (const record of toCreate) {
      try {
        await base44.asServiceRole.entities.Customer.create(record);
        created++;
      } catch (e) {
        errors.push({ name: record.name, error: e.message });
      }
      await new Promise(res => setTimeout(res, 400));
    }

    return Response.json({
      success: true,
      total_in_csv: rows.length,
      created,
      skipped: skipped.length,
      skipped_details: skipped.slice(0, 20),
      errors: errors.length,
      error_details: errors.slice(0, 10),
    });

  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});