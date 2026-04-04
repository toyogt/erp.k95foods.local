import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import nodemailer from 'npm:nodemailer@6.9.13';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Read SMTP credentials from secrets
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '587');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASSWORD');

    if (!smtpHost || !smtpUser || !smtpPass) {
      return Response.json({ error: 'SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD in secrets.' }, { status: 400 });
    }

    // Read settings from AppSetting entity
    const allSettings = await base44.asServiceRole.entities.AppSetting.list();
    const getSetting = (key, def) => allSettings.find(s => s.key === key)?.value ?? def;

    const notificationsEnabled = getSetting('store_expiry_notification_enabled', 'false') === 'true';
    const managerEmail = getSetting('store_manager_email', '');
    const thresholdDays = parseInt(getSetting('store_expiry_threshold_days', '30'));
    const fromName = getSetting('store_smtp_from_name', 'K95 Store');

    if (!notificationsEnabled) {
      return Response.json({ message: 'Expiry notifications are disabled in Store Settings.' });
    }
    if (!managerEmail) {
      return Response.json({ error: 'Manager email not configured in Store Settings.' }, { status: 400 });
    }

    // Find near-expiry lots
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const threshold = new Date(today);
    threshold.setDate(threshold.getDate() + thresholdDays);
    const thresholdStr = threshold.toISOString().split('T')[0];

    const allLots = await base44.asServiceRole.entities.StoreLot.filter({ status: 'putaway' });
    const nearExpiry = allLots.filter(lot => {
      if (!lot.expiry_date) return false;
      return lot.expiry_date >= todayStr && lot.expiry_date <= thresholdStr;
    });

    if (nearExpiry.length === 0) {
      return Response.json({ sent: false, message: `No lots expiring within ${thresholdDays} days.` });
    }

    // Sort by expiry date ascending
    nearExpiry.sort((a, b) => a.expiry_date < b.expiry_date ? -1 : 1);

    const rows = nearExpiry.map(lot => {
      const daysLeft = Math.ceil((new Date(lot.expiry_date) - today) / 86400000);
      const urgency = daysLeft <= 7 ? '#dc2626' : daysLeft <= 14 ? '#d97706' : '#16a34a';
      return `
        <tr style="border-bottom:1px solid #e2e8f0">
          <td style="padding:8px 12px;font-family:monospace">${lot.lot_id}</td>
          <td style="padding:8px 12px">${lot.item_name || lot.item_code}</td>
          <td style="padding:8px 12px">${lot.expiry_date}</td>
          <td style="padding:8px 12px;color:${urgency};font-weight:600">${daysLeft} day(s)</td>
          <td style="padding:8px 12px">${lot.remaining_quantity ?? lot.quantity} ${lot.uom || ''}</td>
        </tr>`;
    }).join('');

    const todayFormatted = today.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto">
        <div style="background:#0f172a;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
          <h2 style="margin:0;font-size:18px">⚠️ Near-Expiry Stock Alert</h2>
          <p style="margin:4px 0 0;opacity:0.7;font-size:13px">Generated on ${todayFormatted}</p>
        </div>
        <div style="background:white;padding:20px 24px;border:1px solid #e2e8f0;border-top:none">
          <p style="color:#475569;font-size:14px">
            <strong>${nearExpiry.length} lot(s)</strong> are expiring within <strong>${thresholdDays} days</strong>. Please take action.
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:12px">
            <thead>
              <tr style="background:#f1f5f9">
                <th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569">Lot ID</th>
                <th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569">Item</th>
                <th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569">Expiry Date</th>
                <th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569">Days Left</th>
                <th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569">Remaining Qty</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="color:#94a3b8;font-size:12px;margin-top:20px">This is an automated alert from K95 ERP Store Management System.</p>
        </div>
      </div>`;

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"${fromName}" <${smtpUser}>`,
      to: managerEmail,
      subject: `⚠️ Near-Expiry Alert: ${nearExpiry.length} lot(s) expiring within ${thresholdDays} days — ${todayFormatted}`,
      html,
    });

    return Response.json({ sent: true, count: nearExpiry.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});