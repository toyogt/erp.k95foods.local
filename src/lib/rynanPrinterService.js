/**
 * rynanPrinterService.js
 *
 * Single source of truth for ALL communication with the Rynan label printer middleware.
 *
 * ─── ARCHITECTURE ────────────────────────────────────────────────────────────
 *
 * LAYER 1 — CONSTANTS
 *   All middleware API endpoint paths and accepted command strings.
 *
 * LAYER 2 — JSON BUILDERS (pure, no side effects)
 *   buildStarCommand()   — builds the STAR print JSON payload
 *   buildPurgePayload()  — builds the purge JSON payload
 *
 * LAYER 3 — TRANSPORT (HTTP + audit persistence)
 *   postToMiddleware()   — raw HTTP POST with retry + timeout
 *   sendStarCommand()    — sends N STAR commands (one per label), saves audit records
 *
 * LAYER 4 — HIGH-LEVEL EXPORTS
 *   sendRynanPrintCommand()    — called by Demo/Bulk print steps
 *   sendRynanTestCommand()     — test ping
 *   sendPurgeCommand()         — purge printer heads
 *   getPrinterStatus()         — cartridge / ink check
 *   getRynanMiddlewareSnapshot()— health + printers + metrics
 *   fetchRynanMiddlewareJobStatus() — job status by ID
 */

import { base44 } from '@/api/base44Client';

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1 — CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All middleware REST endpoint paths.
 * Usage: MIDDLEWARE_ENDPOINTS.PRINT → "/print"
 */
export const MIDDLEWARE_ENDPOINTS = {
  PRINT:          '/print',           // POST — send a STAR command to trigger one label print
  PURGE:          '/purge',           // POST — purge print heads
  PRINTER_STATUS: '/printer-status',  // GET  — cartridge + ink level check (param: ?printer_id=)
  HEALTH:         '/health',          // GET  — middleware health check
  PRINTERS:       '/printers',        // GET  — list all connected printers
  METRICS:        '/metrics',         // GET  — job counts, error stats
  JOB_STATUS:     '/job',             // GET  — job status by ID: /job/{middlewareJobId}
};

/**
 * Printer command strings accepted by the Rynan middleware.
 * Only STAR is used for label printing. Others are for reference / future use.
 */
export const PRINTER_COMMANDS = {
  STAR:  'STAR',   // Trigger label print using a pre-loaded template
  MON:   'MON',    // Query printer monitor status (ink, cartridge)
  PURGE: 'purge',  // Purge print heads — sent via /purge endpoint, not /print
};

/**
 * Priority levels accepted by the /print endpoint.
 */
export const PRINT_PRIORITY = {
  NORMAL: 'normal',
  HIGH:   'high',
};

/**
 * Printer protocol error codes that indicate a hard (non-retryable) failure.
 */
const HARD_FAILURE_CODES = ['NYES', 'RSAL', 'RSMPOD', 'SYSN', 'FAILED', 'ERROR', 'FULL', 'NOK'];

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2 — JSON BUILDERS (pure functions — no HTTP, no DB)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * buildStarCommand
 *
 * Builds the exact JSON payload that must be sent to POST /print
 * to trigger one label to print using the STAR command.
 *
 * The Rynan middleware contract:
 *   - command.command    : always "STAR"
 *   - command.templatename : the template name pre-configured on the middleware
 *   - printer_id / printer.ip / printer.port : identify the physical printer
 *   - priority : "normal" | "high"
 *
 * ⚠️ DO NOT add label_data, quantity, batch_no, mrp etc. here.
 *    Label variables live inside the template on the middleware side.
 *    One call to /print = one label printed.
 *
 * @param {object} printer      - LblPrinterConfig record
 * @param {string} templateName - Middleware template name (e.g. "Default-1")
 * @param {string} [priority]   - "normal" | "high"
 * @returns {object} JSON payload ready to POST to /print
 */
export function buildStarCommand(printer, templateName, priority = PRINT_PRIORITY.NORMAL) {
  return {
    printer_id: printer.printer_id,
    printer: {
      ip:   printer.ip_address,
      port: printer.port || 9100,
    },
    command: {
      command:      PRINTER_COMMANDS.STAR,
      templatename: templateName,
    },
    priority: priority === PRINT_PRIORITY.HIGH ? PRINT_PRIORITY.HIGH : PRINT_PRIORITY.NORMAL,
  };
}

/**
 * buildPurgePayload
 *
 * Builds the JSON payload for POST /purge.
 * Purge clears dried ink from print heads — maintenance only.
 *
 * @param {object} printer - LblPrinterConfig record
 * @returns {object} JSON payload ready to POST to /purge
 */
export function buildPurgePayload(printer) {
  return {
    printer_id: printer.printer_id,
    printer: {
      ip:   printer.ip_address,
      port: printer.port || 9100,
    },
    command: {
      type: PRINTER_COMMANDS.PURGE,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 3 — TRANSPORT UTILITIES (HTTP + audit)
// ─────────────────────────────────────────────────────────────────────────────

/** Strip trailing /print or / from base URL then append a path */
function buildUrl(baseUrl, path) {
  const base = (baseUrl || '').replace(/\/print\/?$/, '').replace(/\/$/, '');
  return `${base}${path}`;
}

/** Build auth + content-type headers from printer config */
function buildHeaders(printer, includeContentType = true) {
  const headers = {};
  if (includeContentType) headers['Content-Type'] = 'application/json';
  if (printer.auth_header_key && printer.auth_header_value) {
    headers[printer.auth_header_key] = printer.auth_header_value;
  }
  return headers;
}

/** Generate a unique command ID */
function genCommandId() {
  return `CMD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

/** Persist an LblPrintCommand audit record */
async function persistCommand({ commandId, jobId, middlewareJobId, printerId, endpointUrl, commandType, quantity, status, requestPayload, responsePayload, responseStatusCode, errorMessage, sentBy }) {
  return base44.entities.LblPrintCommand.create({
    command_id:           commandId,
    job_id:               jobId || null,
    middleware_job_id:    middlewareJobId || null,
    printer_id:           printerId,
    endpoint_url:         endpointUrl,
    command_type:         commandType,
    quantity:             quantity || 0,
    status,
    request_payload:      requestPayload,
    response_payload:     responsePayload || null,
    response_status_code: responseStatusCode || null,
    error_message:        errorMessage || null,
    sent_at:              new Date().toISOString(),
    sent_by:              sentBy || null,
  });
}

/** Check if a middleware response body indicates a genuine success */
function isResponseSuccess(body) {
  if (!body) return false;
  if (body.success !== true) return false;
  if (!body.job_id) return false;           // missing job_id = validation error
  if (body.status === 'failed') return false;
  if (body.printer_ok === false) return false;
  const code = (body.printer_protocol_error_code || '').toUpperCase();
  if (code && HARD_FAILURE_CODES.some(f => code.includes(f))) return false;
  return true;
}

/** Extract a human-readable error message from a middleware response */
function extractErrorMessage(body) {
  return (
    body?.error ||
    body?.printer_reason ||
    body?.printer_protocol_error_description ||
    (body?.printer_protocol_error_code ? `Printer error code: ${body.printer_protocol_error_code}` : null) ||
    `Print ${body?.status || 'failed'}`
  );
}

/** Is this failure retryable (network/timeout) vs hard failure? */
function isRetryableError(error, responseBody) {
  if (responseBody) {
    const code = (responseBody.printer_protocol_error_code || responseBody.printer_response_status || '').toUpperCase();
    if (HARD_FAILURE_CODES.some(f => code.includes(f))) return false;
  }
  if (error instanceof TypeError) return true; // fetch network failure
  return false;
}

/**
 * postToMiddleware
 *
 * Raw HTTP POST to a middleware endpoint with timeout + retry support.
 * Returns { statusCode, body } — does NOT persist to DB.
 *
 * @param {string} url          - Full middleware URL
 * @param {object} payload      - JSON payload to POST
 * @param {object} headers      - HTTP headers
 * @param {number} timeoutMs    - Abort timeout in ms
 * @param {number} maxRetries   - How many attempts before giving up
 * @returns {{ statusCode, body, error }}
 */
async function postToMiddleware(url, payload, headers, timeoutMs = 15000, maxRetries = 1) {
  let lastError = null;
  let lastBody = null;
  let lastStatusCode = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, {
        method:  'POST',
        headers,
        body:    JSON.stringify(payload),
        signal:  controller.signal,
      });
      clearTimeout(timer);

      lastStatusCode = res.status;
      const body = await res.json().catch(() => null);
      lastBody = body;

      // Non-retryable HTTP errors
      if (res.status === 400 || res.status === 415) {
        return { statusCode: res.status, body, error: `HTTP ${res.status}: payload error` };
      }

      return { statusCode: res.status, body, error: null };

    } catch (err) {
      lastError = err;
      if (!isRetryableError(err, null) || attempt === maxRetries) break;
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }

  return {
    statusCode: lastStatusCode,
    body:       lastBody,
    error:      lastError?.message || `HTTP ${lastStatusCode || 'unknown'} error`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 4 — HIGH-LEVEL EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * sendStarCommand
 *
 * Core print function. Sends N STAR commands to the middleware — one per label.
 * Each call to /print triggers exactly one label to be printed by the physical printer.
 *
 * Flow for each label (repeated `quantity` times):
 *   1. Build STAR JSON payload via buildStarCommand()
 *   2. POST to {middleware_base_url}/print
 *   3. Parse response — check success criteria
 *   4. Persist LblPrintCommand audit record
 *   5. If any call fails → stop loop, return failure
 *
 * @param {object} printer       - LblPrinterConfig record
 * @param {string} templateName  - Middleware template name (e.g. "Default-1")
 * @param {number} quantity      - How many labels to print (sends this many POST calls)
 * @param {object} context       - { jobId, commandType, user }
 * @returns {{ success, sentCount, failedAt, lastCommandRecord, lastMiddlewareJobId, errorMessage }}
 */
export async function sendStarCommand(printer, templateName, quantity = 1, { jobId, commandType = 'demo', user } = {}) {
  const endpointUrl = buildUrl(printer.register_app_link || printer.api_endpoint || '', MIDDLEWARE_ENDPOINTS.PRINT);
  const headers     = buildHeaders(printer);
  const priority    = printer.default_priority || PRINT_PRIORITY.NORMAL;
  const timeoutMs   = printer.request_timeout_ms || 15000;
  const maxRetries  = printer.send_retries || 1;

  // Build the payload once — it's identical for every label of this template
  const payload = buildStarCommand(printer, templateName, priority);

  let sentCount = 0;
  let lastCommandRecord = null;
  let lastMiddlewareJobId = null;

  for (let i = 0; i < quantity; i++) {
    const commandId = genCommandId();

    const { statusCode, body, error: transportError } = await postToMiddleware(
      endpointUrl, payload, headers, timeoutMs, maxRetries
    );

    // Transport / HTTP error (network down, timeout, 400, etc.)
    if (transportError && !body) {
      const record = await persistCommand({
        commandId, jobId, printerId: printer.printer_id, endpointUrl,
        commandType, quantity: 1,
        status: 'failed',
        requestPayload: payload, responsePayload: body,
        responseStatusCode: statusCode,
        errorMessage: transportError,
        sentBy: user?.email,
      });
      return {
        success: false, sentCount, failedAt: i + 1,
        lastCommandRecord: record, lastMiddlewareJobId: null,
        errorMessage: transportError,
      };
    }

    const ok = isResponseSuccess(body);
    const middlewareJobId = body?.job_id || null;
    const errorMsg = ok ? null : extractErrorMessage(body);

    const record = await persistCommand({
      commandId, jobId, middlewareJobId, printerId: printer.printer_id, endpointUrl,
      commandType, quantity: 1,
      status: ok ? 'acknowledged' : 'failed',
      requestPayload: payload, responsePayload: body,
      responseStatusCode: statusCode || 200,
      errorMessage: errorMsg,
      sentBy: user?.email,
    });

    lastCommandRecord    = record;
    lastMiddlewareJobId  = middlewareJobId;

    if (!ok) {
      return {
        success: false, sentCount, failedAt: i + 1,
        lastCommandRecord: record, lastMiddlewareJobId: middlewareJobId,
        errorMessage: errorMsg,
      };
    }

    sentCount++;
  }

  return {
    success: true, sentCount, failedAt: null,
    lastCommandRecord, lastMiddlewareJobId,
    errorMessage: null,
  };
}

/**
 * sendRynanPrintCommand
 *
 * Backward-compatible wrapper used by LblDemoPrintStep and other callers.
 * Delegates to sendStarCommand() with quantity = 1.
 *
 * @param {object} printer   - LblPrinterConfig record
 * @param {object} options   - { templateName, commandString (ignored — always STAR), priority }
 * @param {object} context   - { jobId, commandType, quantity (ignored — always 1 per call), user }
 */
export async function sendRynanPrintCommand(printer, { templateName, priority } = {}, { jobId, commandType, user } = {}) {
  const result = await sendStarCommand(
    printer,
    templateName || '',
    1,
    { jobId, commandType, user }
  );
  // Map to legacy return shape
  return {
    success:          result.success,
    commandRecord:    result.lastCommandRecord,
    responseBody:     result.lastCommandRecord?.response_payload || null,
    errorMessage:     result.errorMessage,
    middlewareJobId:  result.lastMiddlewareJobId,
  };
}

/**
 * sendRynanTestCommand
 *
 * Sends a single STAR command using the printer's demo or default template.
 * Used for connectivity checks from the Printer Center page.
 */
export async function sendRynanTestCommand(printer, user) {
  const templateName = printer.demo_template || printer.default_template || '';
  return sendRynanPrintCommand(
    printer,
    { templateName },
    { commandType: 'test_ping', user }
  );
}

/**
 * sendPurgeCommand
 *
 * Sends a purge command to clean the printer heads.
 * Endpoint: POST /purge
 */
export async function sendPurgeCommand(printer, user) {
  const endpointUrl = buildUrl(printer.register_app_link || printer.api_endpoint || '', MIDDLEWARE_ENDPOINTS.PURGE);
  const headers     = buildHeaders(printer);
  const payload     = buildPurgePayload(printer);

  const { statusCode, body, error: transportError } = await postToMiddleware(
    endpointUrl, payload, headers, printer.request_timeout_ms || 15000
  );

  const ok = !transportError && body?.success !== false;
  const commandId = `PURGE-${Date.now()}`;

  await base44.entities.LblPrintCommand.create({
    command_id:           commandId,
    job_id:               null,
    printer_id:           printer.printer_id,
    endpoint_url:         endpointUrl,
    command_type:         'test_ping', // closest available type for maintenance ops
    status:               ok ? 'sent' : 'failed',
    request_payload:      payload,
    response_payload:     body || null,
    response_status_code: statusCode || null,
    error_message:        ok ? null : (transportError || body?.message || `HTTP ${statusCode}`),
    sent_at:              new Date().toISOString(),
    sent_by:              user?.email || null,
  });

  return { success: ok, raw: body, errorMessage: ok ? null : (transportError || body?.message) };
}

/**
 * getPrinterStatus
 *
 * Fetches cartridge presence and ink level from the middleware.
 * Endpoint: GET /printer-status?printer_id={id}
 *
 * Expected response: { has_cartridge: bool, ink_level: 0-100, mon_output: string }
 */
export async function getPrinterStatus(printer) {
  const base = (printer.register_app_link || printer.api_endpoint || '').replace(/\/print\/?$/, '').replace(/\/$/, '');
  const headers = buildHeaders(printer, false);
  try {
    const url = `${base}${MIDDLEWARE_ENDPOINTS.PRINTER_STATUS}?printer_id=${encodeURIComponent(printer.printer_id)}`;
    const res  = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      success:      true,
      has_cartridge: data.has_cartridge ?? false,
      ink_level:    data.ink_level ?? null,
      mon_output:   data.mon_output || data.mon_command_output || null,
      raw:          data,
    };
  } catch (err) {
    return { success: false, errorMessage: err.message };
  }
}

/**
 * getRynanMiddlewareSnapshot
 *
 * Fetches health, connected printers, and metrics in parallel.
 * Used by the Rynan Printer Center diagnostics page.
 */
export async function getRynanMiddlewareSnapshot(printer) {
  const base    = (printer.register_app_link || printer.api_endpoint || '').replace(/\/print\/?$/, '').replace(/\/$/, '');
  const headers = buildHeaders(printer, false);

  const fetchJson = async (path) => {
    const res = await fetch(`${base}${path}`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  const [health, printers, metrics] = await Promise.allSettled([
    fetchJson(MIDDLEWARE_ENDPOINTS.HEALTH),
    fetchJson(MIDDLEWARE_ENDPOINTS.PRINTERS),
    fetchJson(MIDDLEWARE_ENDPOINTS.METRICS),
  ]);

  return {
    health:         health.status === 'fulfilled'   ? health.value          : null,
    healthError:    health.status === 'rejected'    ? health.reason?.message : null,
    printers:       printers.status === 'fulfilled' ? printers.value        : null,
    printersError:  printers.status === 'rejected'  ? printers.reason?.message : null,
    metrics:        metrics.status === 'fulfilled'  ? metrics.value         : null,
    metricsError:   metrics.status === 'rejected'   ? metrics.reason?.message : null,
  };
}

/**
 * fetchRynanMiddlewareJobStatus
 *
 * Checks the status of a specific middleware print job by ID.
 * Endpoint: GET /job/{middlewareJobId}
 */
export async function fetchRynanMiddlewareJobStatus({ printer, middlewareJobId }) {
  const base    = (printer.register_app_link || printer.api_endpoint || '').replace(/\/print\/?$/, '').replace(/\/$/, '');
  const headers = buildHeaders(printer, false);

  const res = await fetch(`${base}${MIDDLEWARE_ENDPOINTS.JOB_STATUS}/${middlewareJobId}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.json();

  const s = (raw.status || raw.state || '').toLowerCase();
  let status = 'pending';
  if (['completed', 'done', 'success'].includes(s)) status = 'completed';
  else if (['failed', 'error', 'cancelled'].includes(s)) status = 'failed';

  return { status, raw };
}