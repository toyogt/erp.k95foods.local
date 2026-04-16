/**
 * Rynan Middleware Printer Service
 * Handles all communication with the Rynan label printer middleware.
 *
 * Middleware contract (POST /print):
 * {
 *   "printer_id": "P1",
 *   "printer": { "ip": "192.168.1.100", "port": 9100 },
 *   "command": { "command": "STAR", "templatename": "DEMO" },
 *   "priority": "normal"   // "normal" | "high"
 * }
 *
 * Response (always HTTP 200):
 *   success + status === "completed" + printer_ok === true  → print sent
 *   success === false + status === "failed"                  → printer error
 *   success === false + no job_id                            → validation error
 *
 * NOTE: Only ONE command object per /print call. Arrays are rejected.
 * NOTE: label_data is NOT part of the /print payload — it is sent via a
 *       separate data-write command BEFORE issuing the STAR command, OR
 *       it is embedded in the templatename as a pre-configured template
 *       on the middleware side. The ERP sends template name + printer ID only.
 */

import { base44 } from '@/api/base44Client';

// Hard printer failure codes — do NOT retry
const HARD_FAILURE_CODES = ['NYES', 'RSAL', 'RSMPOD', 'SYSN', 'FAILED', 'ERROR', 'FULL', 'NOK'];

/** Normalise a base URL so it always resolves to /print */
function buildPrintUrl(baseUrl) {
  const url = baseUrl.replace(/\/print\/?$/, '').replace(/\/$/, '');
  return `${url}/print`;
}

/** Build the URL for non-print endpoints */
function buildEndpointUrl(baseUrl, path) {
  const url = baseUrl.replace(/\/print\/?$/, '').replace(/\/$/, '');
  return `${url}${path}`;
}

/** Generate a command ID */
function genCommandId() {
  return `CMD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

/**
 * Determine if a middleware response is a true success.
 * Per middleware contract:
 *   success === true AND status === "completed" AND printer_ok !== false
 * API always returns HTTP 200 — must inspect JSON fields.
 */
function isResponseSuccess(body) {
  if (!body) return false;
  if (body.success !== true) return false;
  // If job_id is absent it's a validation error (not a printer error)
  if (!body.job_id) return false;
  if (body.status === 'failed') return false;
  if (body.printer_ok === false) return false;
  const code = (body.printer_protocol_error_code || '').toUpperCase();
  if (code && HARD_FAILURE_CODES.some(f => code.includes(f))) return false;
  return true;
}

/**
 * Determine if an error is retryable (transport/timeout/empty) vs hard failure.
 */
function isRetryableError(error, responseBody) {
  // Hard printer failure codes are not retryable
  if (responseBody) {
    const code = (responseBody.printer_protocol_error_code || responseBody.printer_response_status || '').toUpperCase();
    if (HARD_FAILURE_CODES.some(f => code.includes(f))) return false;
  }
  // Network/timeout errors are retryable
  if (error instanceof TypeError) return true; // fetch network error
  return false;
}

/**
 * Persist a print command record to LblPrintCommand entity.
 */
async function persistCommand({ commandId, jobId, middlewareJobId, printerId, endpointUrl, commandType, quantity, status, requestPayload, responsePayload, responseStatusCode, errorMessage, sentBy }) {
  return base44.entities.LblPrintCommand.create({
    command_id: commandId,
    job_id: jobId,
    middleware_job_id: middlewareJobId || null,
    printer_id: printerId,
    endpoint_url: endpointUrl,
    command_type: commandType,
    quantity: quantity || 0,
    status,
    request_payload: requestPayload,
    response_payload: responsePayload || null,
    response_status_code: responseStatusCode || null,
    error_message: errorMessage || null,
    sent_at: new Date().toISOString(),
    sent_by: sentBy || null,
  });
}

/**
 * Build the exact /print payload the middleware expects.
 *
 * The middleware only accepts:
 *   command.command    — printer command string e.g. "STAR"
 *   command.templatename — template name as registered on the middleware e.g. "DEMO"
 *
 * Any additional fields (label_data, quantity, type, etc.) are NOT sent to the middleware.
 * Label data variables are pre-loaded into the template on the middleware side.
 *
 * @param {object} printer         - LblPrinterConfig record
 * @param {string} templateName    - Middleware template name (e.g. "Default-1")
 * @param {string} [commandString] - Printer command string (default: "STAR")
 * @param {string} [priority]      - "normal" | "high" (default: printer config)
 */
function buildPrintPayload(printer, templateName, commandString = 'STAR', priority = 'normal') {
  return {
    printer_id: printer.printer_id,
    printer: {
      ip: printer.ip_address,
      port: printer.port || 9100,
    },
    command: {
      command: commandString,
      templatename: templateName,
    },
    priority: priority === 'high' ? 'high' : 'normal',
  };
}

/**
 * Send a print command to the Rynan middleware.
 *
 * @param {object} printer        - LblPrinterConfig record
 * @param {object} options        - { templateName, commandString, priority, jobId, commandType, quantity, user }
 * @returns {{ success, commandRecord, responseBody, errorMessage, middlewareJobId }}
 */
export async function sendRynanPrintCommand(printer, { templateName, commandString = 'STAR', priority } = {}, { jobId, commandType, quantity, user } = {}) {
  const endpointUrl = buildPrintUrl(printer.register_app_link || printer.api_endpoint || '');
  const commandId = genCommandId();
  const resolvedPriority = priority || printer.default_priority || 'normal';

  const payload = buildPrintPayload(printer, templateName || '', commandString, resolvedPriority);

  const headers = { 'Content-Type': 'application/json' };
  if (printer.auth_header_key && printer.auth_header_value) {
    headers[printer.auth_header_key] = printer.auth_header_value;
  }

  const maxRetries = printer.send_retries || 1;
  let lastError = null;
  let lastResponseBody = null;
  let lastStatusCode = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutMs = printer.request_timeout_ms || 15000;
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(endpointUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      lastStatusCode = res.status;

      // 400 / 415 = client payload error — non-retryable
      if (res.status === 400 || res.status === 415) {
        const body = await res.json().catch(() => ({}));
        lastResponseBody = body;
        const record = await persistCommand({
          commandId, jobId, printerId: printer.printer_id, endpointUrl,
          commandType, quantity, status: 'failed',
          requestPayload: payload, responsePayload: body,
          responseStatusCode: res.status,
          errorMessage: `HTTP ${res.status}: payload/header error`,
          sentBy: user?.email,
        });
        return { success: false, commandRecord: record, responseBody: body, errorMessage: `HTTP ${res.status}: payload/header error` };
      }

      const body = await res.json().catch(() => null);
      lastResponseBody = body;

      if (res.status === 200 && body) {
        const ok = isResponseSuccess(body);
        const middlewareJobId = body.job_id || null;
        // Extract human-readable error from middleware response
        const errorMsg = ok ? null : (
          body.error ||
          body.printer_reason ||
          body.printer_protocol_error_description ||
          (body.printer_protocol_error_code ? `Printer error code: ${body.printer_protocol_error_code}` : null) ||
          `Print ${body.status || 'failed'}`
        );
        const record = await persistCommand({
          commandId, jobId, middlewareJobId, printerId: printer.printer_id, endpointUrl,
          commandType, quantity,
          status: ok ? 'acknowledged' : 'failed',
          requestPayload: payload, responsePayload: body,
          responseStatusCode: 200,
          errorMessage: errorMsg,
          sentBy: user?.email,
        });
        return { success: ok, commandRecord: record, responseBody: body, errorMessage: errorMsg, middlewareJobId };
      }

      // Non-200 non-400/415 — check retryability
      if (!isRetryableError(null, lastResponseBody) || attempt === maxRetries) break;

    } catch (err) {
      lastError = err;
      if (!isRetryableError(err, null) || attempt === maxRetries) break;
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }

  // All attempts exhausted — persist failure
  const errMsg = lastError?.message || `HTTP ${lastStatusCode || 'unknown'} error`;
  const record = await persistCommand({
    commandId, jobId, printerId: printer.printer_id, endpointUrl,
    commandType, quantity, status: 'failed',
    requestPayload: payload, responsePayload: lastResponseBody,
    responseStatusCode: lastStatusCode,
    errorMessage: errMsg,
    sentBy: user?.email,
  });
  return { success: false, commandRecord: record, responseBody: lastResponseBody, errorMessage: errMsg };
}

/**
 * Send a test ping — uses the printer's demo_template or default_template.
 * Useful to verify connectivity without printing a real label.
 */
export async function sendRynanTestCommand(printer, user) {
  const templateName = printer.demo_template || printer.default_template || '';
  return sendRynanPrintCommand(
    printer,
    { templateName, commandString: 'STAR' },
    { commandType: 'test_ping', user }
  );
}

/**
 * Fetch middleware health, printers, and metrics in parallel.
 */
export async function getRynanMiddlewareSnapshot(printer) {
  const base = (printer.register_app_link || printer.api_endpoint || '').replace(/\/print\/?$/, '').replace(/\/$/, '');
  const headers = {};
  if (printer.auth_header_key && printer.auth_header_value) {
    headers[printer.auth_header_key] = printer.auth_header_value;
  }

  const fetchJson = async (path) => {
    const res = await fetch(`${base}${path}`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  const [health, printers, metrics] = await Promise.allSettled([
    fetchJson('/health'),
    fetchJson('/printers'),
    fetchJson('/metrics'),
  ]);

  return {
    health: health.status === 'fulfilled' ? health.value : null,
    healthError: health.status === 'rejected' ? health.reason?.message : null,
    printers: printers.status === 'fulfilled' ? printers.value : null,
    printersError: printers.status === 'rejected' ? printers.reason?.message : null,
    metrics: metrics.status === 'fulfilled' ? metrics.value : null,
    metricsError: metrics.status === 'rejected' ? metrics.reason?.message : null,
  };
}

/**
 * Fetch printer cartridge/ink status via MON command.
 * Middleware endpoint: GET /printer-status?printer_id=<id>
 * Expected response: { has_cartridge: bool, ink_level: number (0-100), mon_output: string }
 */
export async function getPrinterStatus(printer) {
  const base = (printer.register_app_link || printer.api_endpoint || '').replace(/\/print\/?$/, '').replace(/\/$/, '');
  const headers = {};
  if (printer.auth_header_key && printer.auth_header_value) {
    headers[printer.auth_header_key] = printer.auth_header_value;
  }
  try {
    const res = await fetch(`${base}/printer-status?printer_id=${encodeURIComponent(printer.printer_id)}`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { success: true, has_cartridge: data.has_cartridge ?? false, ink_level: data.ink_level ?? null, mon_output: data.mon_output || data.mon_command_output || null, raw: data };
  } catch (err) {
    return { success: false, errorMessage: err.message };
  }
}

/**
 * Send a purge command to the printer via middleware.
 * Middleware endpoint: POST /purge with { printer_id, printer: { ip, port } }
 */
export async function sendPurgeCommand(printer, user) {
  const base = (printer.register_app_link || printer.api_endpoint || '').replace(/\/print\/?$/, '').replace(/\/$/, '');
  const headers = { 'Content-Type': 'application/json' };
  if (printer.auth_header_key && printer.auth_header_value) {
    headers[printer.auth_header_key] = printer.auth_header_value;
  }
  const payload = {
    printer_id: printer.printer_id,
    printer: { ip: printer.ip_address, port: printer.port || 2030 },
    command: { type: 'purge' },
  };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), printer.request_timeout_ms || 15000);
    const res = await fetch(`${base}/purge`, { method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal });
    clearTimeout(timer);
    const data = await res.json().catch(() => ({}));
    const ok = res.ok && data.success !== false;
    await base44.entities.LblPrintCommand.create({
      command_id: `PURGE-${Date.now()}`,
      job_id: null,
      printer_id: printer.printer_id,
      command_type: 'test_ping', // reuse closest type; purge is a maintenance op
      status: ok ? 'sent' : 'failed',
      request_payload: payload,
      response_payload: data,
      response_status_code: res.status,
      error_message: ok ? null : (data.message || `HTTP ${res.status}`),
      sent_at: new Date().toISOString(),
      sent_by: user?.email || null,
    });
    return { success: ok, raw: data };
  } catch (err) {
    await base44.entities.LblPrintCommand.create({
      command_id: `PURGE-${Date.now()}`,
      job_id: null,
      printer_id: printer.printer_id,
      command_type: 'test_ping',
      status: 'failed',
      request_payload: payload,
      error_message: err.message,
      sent_at: new Date().toISOString(),
      sent_by: user?.email || null,
    });
    return { success: false, errorMessage: err.message };
  }
}

/**
 * Fetch a specific middleware job status.
 * Returns { status: 'completed'|'pending'|'failed', raw }
 */
export async function fetchRynanMiddlewareJobStatus({ printer, middlewareJobId }) {
  const base = (printer.register_app_link || printer.api_endpoint || '').replace(/\/print\/?$/, '').replace(/\/$/, '');
  const headers = {};
  if (printer.auth_header_key && printer.auth_header_value) {
    headers[printer.auth_header_key] = printer.auth_header_value;
  }

  const res = await fetch(`${base}/job/${middlewareJobId}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.json();

  // Normalise status
  const s = (raw.status || raw.state || '').toLowerCase();
  let status = 'pending';
  if (['completed', 'done', 'success'].includes(s)) status = 'completed';
  else if (['failed', 'error', 'cancelled'].includes(s)) status = 'failed';

  return { status, raw };
}