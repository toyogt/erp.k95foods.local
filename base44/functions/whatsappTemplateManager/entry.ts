import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const API_VERSION = 'v21.0';

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
    const { action } = body;

    const wabaId = body.waba_id === '__FROM_ENV__' ? Deno.env.get('WHATSAPP_BUSINESS_ACCOUNT_ID') : body.waba_id;
    const phoneNumId = body.phone_number_id === '__FROM_ENV__' ? Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') : body.phone_number_id;

    // ─── ACTION: Create template on Meta ───
    if (action === 'create_template') {
      const { template_name, category, language, header_text, body_text, footer_text, example_values } = body;
      const waba_id = wabaId;
      if (!waba_id || !template_name || !body_text) {
        return Response.json({ error: 'waba_id, template_name, and body_text are required' }, { status: 400 });
      }

      const components = [];

      if (header_text) {
        components.push({
          type: 'HEADER',
          format: 'TEXT',
          text: header_text,
        });
      }

      const bodyComponent = {
        type: 'BODY',
        text: body_text,
      };

      if (example_values && example_values.length > 0) {
        bodyComponent.example = {
          body_text: [example_values],
        };
      }
      components.push(bodyComponent);

      if (footer_text) {
        components.push({
          type: 'FOOTER',
          text: footer_text,
        });
      }

      const payload = {
        name: template_name,
        language: language || 'en',
        category: category || 'UTILITY',
        components,
      };

      const response = await fetch(
        `https://graph.facebook.com/${API_VERSION}/${waba_id}/message_templates`,
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
        console.error('Meta create template error:', JSON.stringify(result));
        return Response.json({ error: 'Failed to create template on Meta', details: result }, { status: response.status });
      }

      return Response.json({ success: true, meta_template_id: result.id, status: result.status });
    }

    // ─── ACTION: Send message using a template ───
    if (action === 'send_message') {
      const { phone_number, template_name, language, parameters } = body;
      const phone_number_id = phoneNumId;
      if (!phone_number_id || !phone_number || !template_name) {
        return Response.json({ error: 'phone_number_id, phone_number, and template_name are required' }, { status: 400 });
      }

      const cleanPhone = phone_number.replace(/[\s\-\+]/g, '');

      const bodyParams = (parameters || []).map(p => ({
        type: 'text',
        text: String(p || '-'),
      }));

      const msgPayload = {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'template',
        template: {
          name: template_name,
          language: { code: language || 'en' },
          components: bodyParams.length > 0 ? [
            { type: 'body', parameters: bodyParams },
          ] : [],
        },
      };

      const response = await fetch(
        `https://graph.facebook.com/${API_VERSION}/${phone_number_id}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(msgPayload),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('WhatsApp send error:', JSON.stringify(result));
        return Response.json({ error: 'Failed to send message', details: result }, { status: response.status });
      }

      return Response.json({ success: true, message_id: result.messages?.[0]?.id });
    }

    // ─── ACTION: Check template status ───
    if (action === 'check_status') {
      const { template_name } = body;
      const waba_id = wabaId;
      if (!waba_id) {
        return Response.json({ error: 'waba_id is required' }, { status: 400 });
      }

      const url = template_name
        ? `https://graph.facebook.com/${API_VERSION}/${waba_id}/message_templates?name=${template_name}`
        : `https://graph.facebook.com/${API_VERSION}/${waba_id}/message_templates?limit=100`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      const result = await response.json();
      if (!response.ok) {
        return Response.json({ error: 'Failed to fetch templates', details: result }, { status: response.status });
      }

      return Response.json({ success: true, templates: result.data || [] });
    }

    // ─── ACTION: Delete template from Meta ───
    if (action === 'delete_template') {
      const { template_name } = body;
      const waba_id = wabaId;
      if (!waba_id || !template_name) {
        return Response.json({ error: 'waba_id and template_name are required' }, { status: 400 });
      }

      const response = await fetch(
        `https://graph.facebook.com/${API_VERSION}/${waba_id}/message_templates?name=${template_name}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${apiKey}` },
        }
      );

      const result = await response.json();
      if (!response.ok) {
        return Response.json({ error: 'Failed to delete template', details: result }, { status: response.status });
      }

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action. Use: create_template, send_message, check_status, delete_template' }, { status: 400 });
  } catch (error) {
    console.error('WhatsApp Template Manager error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});