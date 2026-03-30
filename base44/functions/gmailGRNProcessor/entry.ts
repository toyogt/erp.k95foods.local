import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Detect platform from sender email or subject
function detectPlatform(from, subject) {
  const text = `${from} ${subject}`.toLowerCase();
  if (text.includes('swiggy')) return 'swiggy';
  if (text.includes('zepto')) return 'zepto';
  if (text.includes('blinkit') || text.includes('grofers')) return 'blinkit';
  return 'other';
}

// Decode base64url encoded Gmail message parts
function decodeBase64(data) {
  return atob(data.replace(/-/g, '+').replace(/_/g, '/'));
}

// Get plain text body from message payload
function extractBody(payload) {
  if (payload.body?.data) return decodeBase64(payload.body.data);
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) return decodeBase64(part.body.data);
      if (part.parts) {
        const nested = extractBody(part);
        if (nested) return nested;
      }
    }
  }
  return '';
}

// Get header value from message headers
function getHeader(headers, name) {
  return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

// Extract PDF attachment data (base64)
function extractAttachments(payload) {
  const attachments = [];
  function scan(parts) {
    if (!parts) return;
    for (const part of parts) {
      if (part.mimeType === 'application/pdf' && part.body?.attachmentId) {
        attachments.push({ attachmentId: part.body.attachmentId, filename: part.filename });
      }
      if (part.parts) scan(part.parts);
    }
  }
  scan(payload.parts ?? []);
  return attachments;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const base44 = createClientFromRequest(req);

    const messageIds = body.data?.new_message_ids ?? [];
    if (messageIds.length === 0) {
      return Response.json({ processed: 0, message: 'No new messages' });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    let processed = 0;
    const results = [];

    for (const messageId of messageIds) {
      // Fetch full message
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        { headers: authHeader }
      );
      if (!msgRes.ok) continue;
      const message = await msgRes.json();

      const headers = message.payload?.headers ?? [];
      const from = getHeader(headers, 'From');
      const subject = getHeader(headers, 'Subject');
      const date = getHeader(headers, 'Date');
      const body_text = extractBody(message.payload ?? {});

      const platform = detectPlatform(from, subject);

      // Skip if not from a known platform (unless subject contains GRN/debit note keywords)
      const isRelevant = platform !== 'other' ||
        /grn|goods.receipt|debit.note|discrepancy|inbound|asn/i.test(subject);
      if (!isRelevant) continue;

      // Determine doc type from subject
      const isDebitNote = /debit.note|debit note/i.test(subject);
      const isGRN = /grn|goods.receipt|inbound.receipt|asn/i.test(subject) || !isDebitNote;

      // Fetch PDF attachments if any
      let pdfBase64 = null;
      const attachments = extractAttachments(message.payload ?? {});
      if (attachments.length > 0) {
        const attRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachments[0].attachmentId}`,
          { headers: authHeader }
        );
        if (attRes.ok) {
          const attData = await attRes.json();
          pdfBase64 = attData.data;
        }
      }

      // Use LLM to extract structured data
      const extractPrompt = isDebitNote
        ? `Extract debit note data from this email. Return JSON with: debit_note_number, debit_note_date (YYYY-MM-DD), invoice_number, po_number, customer_name, debit_note_amount (number), taxable_amount (number), igst_amount (number), narration. Email from: ${from}. Subject: ${subject}. Body: ${body_text.slice(0, 3000)}`
        : `Extract GRN (Goods Receipt Note) data from this email. Return JSON with: grn_number, grn_date (YYYY-MM-DD), invoice_number, po_number, asn_number, inbound_number, customer_name, warehouse_location, grn_total_qty (number), grn_total_amount (number). Email from: ${from}. Subject: ${subject}. Body: ${body_text.slice(0, 3000)}`;

      const extracted = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: extractPrompt,
        response_json_schema: {
          type: 'object',
          properties: isDebitNote
            ? {
                debit_note_number: { type: 'string' },
                debit_note_date: { type: 'string' },
                invoice_number: { type: 'string' },
                po_number: { type: 'string' },
                customer_name: { type: 'string' },
                debit_note_amount: { type: 'number' },
                taxable_amount: { type: 'number' },
                igst_amount: { type: 'number' },
                narration: { type: 'string' },
              }
            : {
                grn_number: { type: 'string' },
                grn_date: { type: 'string' },
                invoice_number: { type: 'string' },
                po_number: { type: 'string' },
                asn_number: { type: 'string' },
                inbound_number: { type: 'string' },
                customer_name: { type: 'string' },
                warehouse_location: { type: 'string' },
                grn_total_qty: { type: 'number' },
                grn_total_amount: { type: 'number' },
              },
        },
      });

      if (isDebitNote) {
        if (!extracted.debit_note_number) {
          results.push({ messageId, status: 'skipped', reason: 'Could not extract debit note number' });
          continue;
        }
        // Check for duplicate
        const existing = await base44.asServiceRole.entities.CustomerDebitNote.filter({
          debit_note_number: extracted.debit_note_number,
        });
        if (existing.length > 0) {
          results.push({ messageId, status: 'duplicate', debit_note_number: extracted.debit_note_number });
          continue;
        }
        await base44.asServiceRole.entities.CustomerDebitNote.create({
          platform,
          debit_note_number: extracted.debit_note_number || '',
          debit_note_date: extracted.debit_note_date || '',
          invoice_number: extracted.invoice_number || '',
          po_number: extracted.po_number || '',
          customer_name: extracted.customer_name || '',
          debit_note_amount: extracted.debit_note_amount || 0,
          taxable_amount: extracted.taxable_amount || 0,
          igst_amount: extracted.igst_amount || 0,
          narration: extracted.narration || '',
          status: 'received',
          email_subject: subject,
          notes: `Auto-imported from Gmail on ${new Date().toISOString().slice(0, 10)}. From: ${from}`,
        });
        results.push({ messageId, status: 'created', type: 'debit_note', number: extracted.debit_note_number });
      } else {
        if (!extracted.grn_number) {
          results.push({ messageId, status: 'skipped', reason: 'Could not extract GRN number' });
          continue;
        }
        // Check for duplicate
        const existing = await base44.asServiceRole.entities.CustomerGRN.filter({
          grn_number: extracted.grn_number,
        });
        if (existing.length > 0) {
          results.push({ messageId, status: 'duplicate', grn_number: extracted.grn_number });
          continue;
        }
        await base44.asServiceRole.entities.CustomerGRN.create({
          platform,
          grn_number: extracted.grn_number || '',
          grn_date: extracted.grn_date || '',
          invoice_number: extracted.invoice_number || '',
          po_number: extracted.po_number || '',
          asn_number: extracted.asn_number || '',
          inbound_number: extracted.inbound_number || '',
          customer_name: extracted.customer_name || '',
          warehouse_location: extracted.warehouse_location || '',
          grn_total_qty: extracted.grn_total_qty || 0,
          grn_total_amount: extracted.grn_total_amount || 0,
          status: 'pending_match',
          email_subject: subject,
          email_received_date: date,
          notes: `Auto-imported from Gmail on ${new Date().toISOString().slice(0, 10)}. From: ${from}`,
        });
        results.push({ messageId, status: 'created', type: 'grn', number: extracted.grn_number });
      }

      processed++;
    }

    return Response.json({ processed, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});