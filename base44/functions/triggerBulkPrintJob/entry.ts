/**
 * triggerBulkPrintJob
 *
 * Background backend function that handles the entire Rynan printer bulk print sequence.
 * Called ONCE from the frontend — runs STOP → STAR → MON → DATA × N entirely server-side.
 *
 * This prevents the browser from blocking while thousands of DATA commands are sent.
 *
 * Input payload:
 *   job_id          — LabellingJob record ID
 *   command_type    — 'bulk_start' | 'bulk_resume'
 *
 * The function reads printer config, template, and POD values directly from the database
 * so the frontend only needs to pass the job_id.
 *
 * On success: sets job status = 'bulk_printing', current_printed_qty stays as-is (RQLP polls live).
 * On failure: returns error message for the frontend to display.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Constants (mirrors frontend rynanPrinterService.js) ──────────────────────
const MIDDLEWARE_ENDPOINTS = { PRINT: '/print' };

const PRINTER_COMMANDS = {
  STAR: 'STAR',
  STOP: 'STOP',
  DATA: 'DATA',
  MON:  'MON',
};

const HARD_FAILURE_CODES = ['NYES', 'RSAL', 'RSMPOD', 'SYSN', 'FAILED', 'ERROR', 'FULL', 'NOK'];
const MAX_STAR_ATTEMPTS  = 5;

// ── Transport helpers ─────────────────────────────────────────────────────────

function getPrinterBase(printer) {
  const raw = printer.register_app_link || printer.api_endpoint || '';
  return raw.replace(/\/print\/?$/, '').replace(/\/$/, '');
}

function buildHeaders(printer) {
  const headers = { 'Content-Type': 'application/json' };
  if (printer.auth_header_key && printer.auth_header_value) {
    headers[printer.auth_header_key] = printer.auth_header_value;
  }
  return headers;
}

async function post(url, payload, headers, timeoutMs = 15000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const body = await res.json().catch(() => null);
    return { statusCode: res.status, body, error: null };
  } catch (err) {
    return { statusCode: null, body: null, error: err.message };
  }
}

function isStarReady(body) {
  if (!body || body.success !== true) return false;
  const prp = body.printer_response_payload;
  if (prp?.command === 'STAR' && prp?.status === 'READY') return true;
  const r1 = body?.response?.response;
  if (r1?.command === 'STAR' && r1?.status === 'READY') return true;
  if (body.printer_response_command === 'STAR' && body.printer_response_status === 'READY') return true;
  return false;
}

function isDataAck(body) {
  if (!body || body.success !== true) return false;
  if (body.status === 'failed' || body.printer_ok === false) return false;
  const code = (body.printer_protocol_error_code || '').toUpperCase();
  if (code && HARD_FAILURE_CODES.some(f => code.includes(f))) return false;
  return true;
}

function extractActiveTemplate(body) {
  const prp = body?.printer_response_payload;
  if (prp?.current_template) return String(prp.current_template).trim();
  if (prp?.templatename) return String(prp.templatename).trim();
  const r1 = body?.response?.response;
  if (r1?.current_template) return String(r1.current_template).trim();
  return null;
}

function genCommandId() {
  return `CMD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user   = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorised' }, { status: 401 });

    const { job_id, command_type = 'bulk_start' } = await req.json();
    if (!job_id) return Response.json({ error: 'job_id is required' }, { status: 400 });

    // ── Load job ──────────────────────────────────────────────────────────────
    const jobs = await base44.entities.LabellingJob.filter({ id: job_id });
    const job  = jobs?.[0];
    if (!job) return Response.json({ error: `Job not found: ${job_id}` }, { status: 404 });

    const planned        = job.quantity_bottles_planned || 0;
    const alreadyPrinted = job.current_printed_qty || 0;
    const toPrint        = planned - alreadyPrinted;

    if (toPrint <= 0) {
      return Response.json({ error: 'All labels already printed — nothing to send.' }, { status: 400 });
    }

    // ── Load printer (auto-resolve by line_id) ────────────────────────────────
    const allPrinters = await base44.entities.LblPrinterConfig.filter({ is_active: true });
    const printer     = allPrinters.find(p => p.line_id === job.line_id) || null;
    if (!printer) {
      return Response.json({ error: `No active printer found for line: ${job.line_id}` }, { status: 404 });
    }

    // ── Load print template ───────────────────────────────────────────────────
    if (!job.printer_template_id) {
      return Response.json({ error: 'No print template assigned to this job.' }, { status: 400 });
    }
    const templates   = await base44.entities.LblPrintTemplate.filter({ id: job.printer_template_id, is_active: true });
    const template    = templates?.[0];
    const templateName = template?.middleware_template_name || '';
    if (!templateName) {
      return Response.json({ error: 'Template has no middleware name configured.' }, { status: 400 });
    }

    // ── Load POD values from demo print command ───────────────────────────────
    // Try both job.id (DB record ID) and job.job_id (string field) since demo
    // commands may be stored with either depending on which sendStarCommand path was used.
    let demoCmds = await base44.entities.LblPrintCommand.filter({ job_id: job.id, command_type: 'demo' });
    if (!demoCmds || demoCmds.length === 0) {
      demoCmds = await base44.entities.LblPrintCommand.filter({ job_id: job.job_id, command_type: 'demo' });
    }
    const dataCmd  = demoCmds.find(c => c.request_payload?.command?.command === 'DATA')
      || demoCmds.find(c => c.request_payload?.command?.data)
      || demoCmds[0]
      || null;
    const podValues = dataCmd?.request_payload?.command?.data || {};

    if (Object.keys(podValues).length === 0) {
      return Response.json({
        success: false,
        error: 'No label data (POD values) found from the demo print. Please re-send the demo print before starting bulk printing.',
        missingPodData: true,
      }, { status: 422 });
    }

    const base     = getPrinterBase(printer);
    const headers  = buildHeaders(printer);
    const endpoint = `${base}${MIDDLEWARE_ENDPOINTS.PRINT}`;
    const timeout  = printer.request_timeout_ms || 15000;

    const stopPayload = {
      printer_id: printer.printer_id,
      printer: { ip: printer.ip_address, port: printer.port },
      command: { command: PRINTER_COMMANDS.STOP },
    };
    const starPayload = {
      printer_id: printer.printer_id,
      printer: { ip: printer.ip_address, port: printer.port },
      command: { command: PRINTER_COMMANDS.STAR, templatename: templateName, startpage: '1', endpage: '1', loop: 'true' },
      priority: printer.default_priority || 'normal',
    };
    const monPayload = {
      printer_id: printer.printer_id,
      printer: { ip: printer.ip_address, port: printer.port },
      command: { command: PRINTER_COMMANDS.MON },
      priority: printer.default_priority || 'normal',
    };

    // ── PHASE 1 — STOP ───────────────────────────────────────────────────────
    await post(endpoint, stopPayload, headers, timeout);

    // ── PHASE 1 — STAR (up to MAX_STAR_ATTEMPTS retries) ────────────────────
    let starReady = false;
    for (let attempt = 1; attempt <= MAX_STAR_ATTEMPTS; attempt++) {
      const { body } = await post(endpoint, starPayload, headers, timeout);
      if (isStarReady(body)) { starReady = true; break; }
      if (attempt < MAX_STAR_ATTEMPTS) await new Promise(r => setTimeout(r, 1000 * attempt));
    }

    if (!starReady) {
      // Persist failure command
      await base44.entities.LblPrintCommand.create({
        command_id: genCommandId(), job_id: job.job_id,
        printer_id: printer.printer_id, endpoint_url: endpoint,
        command_type, quantity: 0, status: 'failed',
        request_payload: starPayload,
        error_message: `Template "${templateName}" could not be activated after ${MAX_STAR_ATTEMPTS} attempts.`,
        sent_at: new Date().toISOString(), sent_by: user.email,
      });
      return Response.json({
        success: false,
        error: `Template "${templateName}" is not loaded on the printer or could not be activated. Load it first then retry.`,
        templateNotOnPrinter: true,
      }, { status: 422 });
    }

    // ── PHASE 1 — MON verification ───────────────────────────────────────────
    const monResult = await post(endpoint, monPayload, headers, timeout);
    const activeTemplate = extractActiveTemplate(monResult.body);
    if (activeTemplate !== null) {
      const match = activeTemplate.trim().toLowerCase() === templateName.trim().toLowerCase();
      if (!match) {
        return Response.json({
          success: false,
          error: `Printer has template "${activeTemplate}" active, but job needs "${templateName}". Please reload the correct template.`,
        }, { status: 422 });
      }
    }

    // ── PHASE 2 — Update DB status & return IMMEDIATELY to unblock frontend ─
    await base44.entities.LabellingJob.update(job.id, { status: 'bulk_printing' });

    await base44.entities.LblEventLog.create({
      event_id:           `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      job_id:             job.job_id,
      plan_id:            job.plan_id,
      action_type:        'bulk_print_started',
      description:        `Bulk print started — ${toPrint.toLocaleString()} DATA commands queued for printer "${printer.printer_id}" using template "${templateName}".`,
      performed_by_email: user.email,
      performed_by_name:  user.full_name || user.email,
      timestamp:          new Date().toISOString(),
    });

    // ── BACKGROUND DATA LOOP — runs after response is sent to frontend ────────
    // We use EdgeRuntime.waitUntil so the DATA loop continues even after
    // the HTTP response is returned. The frontend receives the dashboard signal
    // instantly and the printer receives DATA commands in the background.
    const dataLoop = async () => {
      let sentCount  = 0;
      let lastBody   = null;
      let lastStatus = null;

      for (let i = 0; i < toPrint; i++) {
        const dataPayload = {
          printer_id: printer.printer_id,
          printer: { ip: printer.ip_address, port: printer.port },
          command: { command: PRINTER_COMMANDS.DATA, data: podValues },
        };

        const { statusCode, body, error: transportError } = await post(endpoint, dataPayload, headers, timeout);

        if (transportError && !body) {
          const errMsg = `Network error at label ${i + 1}/${toPrint}: ${transportError}`;
          await base44.entities.LblPrintCommand.create({
            command_id: genCommandId(), job_id: job.job_id,
            printer_id: printer.printer_id, endpoint_url: endpoint,
            command_type, quantity: sentCount, status: 'failed',
            request_payload: dataPayload, error_message: errMsg,
            sent_at: new Date().toISOString(), sent_by: user.email,
          });
          return;
        }

        if (!isDataAck(body)) {
          const errMsg = body?.error || body?.printer_reason || `DATA command ${i + 1}/${toPrint} rejected by printer`;
          await base44.entities.LblPrintCommand.create({
            command_id: genCommandId(), job_id: job.job_id,
            printer_id: printer.printer_id, endpoint_url: endpoint,
            command_type, quantity: sentCount, status: 'failed',
            request_payload: dataPayload, response_payload: body,
            response_status_code: statusCode, error_message: errMsg,
            sent_at: new Date().toISOString(), sent_by: user.email,
          });
          return;
        }

        sentCount++;
        lastBody   = body;
        lastStatus = statusCode;
      }

      // Persist single audit record for entire DATA run
      await base44.entities.LblPrintCommand.create({
        command_id:           genCommandId(),
        job_id:               job.job_id,
        printer_id:           printer.printer_id,
        endpoint_url:         endpoint,
        command_type,
        quantity:             sentCount,
        status:               'acknowledged',
        request_payload:      { command: { command: 'DATA', data: podValues } },
        response_payload:     lastBody,
        response_status_code: lastStatus || 200,
        sent_at:              new Date().toISOString(),
        sent_by:              user.email,
      });
    };

    // Fire the DATA loop in background — do NOT await it
    try {
      EdgeRuntime.waitUntil(dataLoop());
    } catch (_e) {
      // EdgeRuntime not available in all envs — fall back to un-awaited promise
      dataLoop().catch(() => {});
    }

    // ── Return immediately — frontend can show dashboard now ─────────────────
    return Response.json({
      success:   true,
      toPrint,
      message:   `Printer initialised. ${toPrint.toLocaleString()} label commands dispatching in background.`,
      immediate: true,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});