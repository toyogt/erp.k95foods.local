import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { invoice_file, supplier_name, po_id } = body;

    if (!invoice_file) {
      return Response.json({ error: 'invoice_file required' }, { status: 400 });
    }

    // Call LLM to extract invoice data
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an invoice data extraction expert. Extract the following from the supplier invoice:
1. Supplier name/company
2. Invoice number
3. Invoice date (YYYY-MM-DD format)
4. Total amount (numeric)
5. Line items: item description, quantity, unit, rate, amount

${supplier_name ? `Expected supplier: ${supplier_name}` : ''}
${po_id ? `This is for PO: ${po_id}` : ''}

Return ONLY valid JSON with this structure:
{
  "supplier_name": "...",
  "invoice_number": "...",
  "invoice_date": "YYYY-MM-DD",
  "total_amount": 0,
  "items": [
    { "description": "...", "qty": 0, "uom": "...", "rate": 0, "amount": 0 }
  ],
  "warnings": ["..."]
}`,
      add_context_from_internet: false,
      file_urls: [invoice_file],
      response_json_schema: {
        type: 'object',
        properties: {
          supplier_name: { type: 'string' },
          invoice_number: { type: 'string' },
          invoice_date: { type: 'string' },
          total_amount: { type: 'number' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                qty: { type: 'number' },
                uom: { type: 'string' },
                rate: { type: 'number' },
                amount: { type: 'number' },
              },
            },
          },
          warnings: { type: 'array', items: { type: 'string' } },
        },
      },
    });

    return Response.json(response);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});