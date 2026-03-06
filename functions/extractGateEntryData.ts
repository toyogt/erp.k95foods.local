import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { vehicle_photo, invoice_photo, transport_type } = body;

    if (!invoice_photo) {
      return Response.json({ error: 'invoice_photo required' }, { status: 400 });
    }

    if (transport_type === 'vehicle' && !vehicle_photo) {
      return Response.json({ error: 'vehicle_photo required for vehicle transport type' }, { status: 400 });
    }

    // Extract vehicle number only if transport is vehicle type
    let vehicleResult = { vehicle_number: null };
    if (transport_type === 'vehicle' && vehicle_photo) {
      vehicleResult = await base44.integrations.Core.InvokeLLM({
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
    }

    // Use AI to extract invoice details from invoice photo
    const invoiceResult = await base44.integrations.Core.InvokeLLM({
      prompt: `Look at this invoice photo and extract the following details:
      1. Invoice number (the unique invoice ID) - THIS IS CRITICAL AND MUST BE EXTRACTED CLEARLY
      2. Supplier/vendor name
      
      Return a JSON object with:
      {
        "invoice_number": "EXTRACTED INVOICE NUMBER or null if NOT CLEARLY VISIBLE",
        "supplier_name": "EXTRACTED SUPPLIER NAME or null"
      }
      Be very precise - only extract invoice_number if you can read it clearly. Return null otherwise.`,
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