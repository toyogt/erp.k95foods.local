import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PHONE_NUMBER_ID = '618305764705443';
const TEMPLATE_NAME = 'eatasks';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = Deno.env.get('META_WHATSAPP_API_KEY');
    if (!apiKey) {
      return Response.json({ error: 'WhatsApp API key not configured' }, { status: 500 });
    }

    const body = await req.json();
    const { phone_number, task_name, priority, category, assigned_by, due_date, due_time, description } = body;

    if (!phone_number || !task_name) {
      return Response.json({ error: 'phone_number and task_name are required' }, { status: 400 });
    }

    // Clean phone number — remove +, spaces, dashes
    const cleanPhone = phone_number.replace(/[\s\-\+]/g, '');

    const payload = {
      messaging_product: 'whatsapp',
      to: cleanPhone,
      type: 'template',
      template: {
        name: TEMPLATE_NAME,
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: task_name || '-' },
              { type: 'text', text: priority || 'Normal' },
              { type: 'text', text: category || 'General' },
              { type: 'text', text: assigned_by || '-' },
              { type: 'text', text: due_date || '-' },
              { type: 'text', text: due_time || '4:00 PM' },
              { type: 'text', text: description || 'No description provided' },
            ],
          },
        ],
      },
    };

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('WhatsApp API error:', JSON.stringify(result));
      return Response.json({ error: 'WhatsApp send failed', details: result }, { status: response.status });
    }

    return Response.json({ success: true, message_id: result.messages?.[0]?.id });
  } catch (error) {
    console.error('WhatsApp notification error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});