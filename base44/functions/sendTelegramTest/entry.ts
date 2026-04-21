import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { chat_id, name } = await req.json();
    if (!chat_id) {
      return Response.json({ error: 'Missing chat_id' }, { status: 400 });
    }

    const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!token) {
      return Response.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 500 });
    }

    const text = `✅ Test notification from K95 ERP\n\nHello ${name || 'User'}! Your Telegram notifications are working correctly.`;

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text, parse_mode: 'HTML' }),
    });

    const data = await res.json();
    if (!data.ok) {
      return Response.json({ success: false, error: data.description }, { status: 400 });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});