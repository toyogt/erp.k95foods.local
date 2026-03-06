import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { vehicle_photo, invoice_photo } = body;

    if (!vehicle_photo || !invoice_photo) {
      return Response.json({ error: 'Both vehicle_photo and invoice_photo required' }, { status: 400 });
    }

    // Use AI to extract vehicle number from vehicle photo
    const vehicleResult = await base44.integrations.Core.InvokeLLM({
      prompt: `Look at this photo of a vehicle and extract the vehicle registration number/license plate. 
      Return ONLY a JSON object with exactly one field:
      {
        "vehicle_number": "THE EXTRACTED REGISTRATION NUMBER or null if not clearly visible"
      }
      Be strict - only extract if clearly visible. Return null if you cannot read it.`,
      file_urls: [vehicle_photo],
      response_json_schema: {
        type: 'object',
        properties: {
          vehicle_number: { type: ['string', 'null'] },
        },
        required: ['vehicle_number'],
      },
    });

    // Use AI to extract invoice details from invoice photo
    const invoiceResult = await base44.integrations.Core.InvokeLLM({
      prompt: `Look at this invoice photo and extract the following details:
      1. Invoice number (the unique invoice ID)
      2. Supplier/vendor name
      
      Return a JSON object with:
      {
        "invoice_number": "EXTRACTED INVOICE NUMBER or null",
        "supplier_name": "EXTRACTED SUPPLIER NAME or null"
      }
      Be precise - extract exactly as shown in the document.`,
      file_urls: [invoice_photo],
      response_json_schema: {
        type: 'object',
        properties: {
          invoice_number: { type: ['string', 'null'] },
          supplier_name: { type: ['string', 'null'] },
        },
        required: ['invoice_number', 'supplier_name'],
      },
    });

    // Combine results
    const result = {
      vehicle_number: vehicleResult.vehicle_number || '',
      invoice_number: invoiceResult.invoice_number || '',
      supplier_name: invoiceResult.supplier_name || '',
    };

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});