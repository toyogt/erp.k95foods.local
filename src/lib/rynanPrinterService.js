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
 *   buildDataPayload()   — builds the DATA command JSON payload (POD field values)
 *   buildPurgePayload()  — builds the purge JSON payload
 *
 * LAYER 3 — TRANSPORT (HTTP + audit persistence)
 *   postToMiddleware()   — raw HTTP POST with retry + timeout
 *   sendStarCommand()    — sends N STAR commands (one per label), saves audit records
 *
 * LAYER 4 — HIGH-LEVEL EXPORTS
 *   sendRynanPrintCommand()         — called by Demo/Bulk print steps
 *   sendRynanTestCommand()          — test ping
 *   sendPurgeCommand()              — purge printer heads
 *   getPrinterStatus()              — cartridge / ink check
 *   getRynanMiddlewareSnapshot()    — health + printers + metrics
 *   fetchRynanMiddlewareJobStatus() — job status by ID
 *   fetchPrinterTemplateList()      — RQLI: get all templates on printer (retries up to 3)
 *   checkTemplateExists()           — check one template name against RQLI list (retries up to 3)
 */

import { base44 } from '@/api/base44Client';

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1 — CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const MIDDLEWARE_ENDPOINTS = {
  PRINT:          '/print',
  PURGE:          '/purge',
  PRINTER_STATUS: '/printer-status',
  HEALTH:         '/health',
  PRINTERS:       '/printers',
  METRICS:        '/metrics',
  JOB_STATUS:     '/job',
};

export const PRINTER_COMMANDS = {
  STAR:  'STAR',
  STOP:  'STOP',
  DATA:  'DATA',   // Send POD field values — one DATA command = one label printed
  MON:   'MON',
  RQLI:  'RQLI',   // Query template list — printer responds with RSLI
  PURGE: 'PURGE',
};

export const PRINT_PRIORITY = {
  NORMAL: 'normal',
  HIGH:   'high',
};

const HARD_FAILURE_CODES = ['NYES', 'RSAL', 'RSMPOD', 'SYSN', 'FAILED', 'ERROR', 'FULL', 'NOK'];

// Max number of STAR command attempts per label before giving up and doing MON check
const MAX_STAR_READY_ATTEMPTS = 5;

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2 — JSON BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

export function buildStarCommand(printer, templateName, priority = PRINT_PRIORITY.NORMAL) {
  return {
    printer_id: printer.printer_id,
    printer: {
      ip:   printer.ip_address,
      port: printer.port,
    },
    command: {
      command:      PRINTER_COMMANDS.STAR,
      templatename: templateName,
      startpage:    "1",
      endpage:      "1",
      loop:         "true",
    },
    priority: priority === PRINT_PRIORITY.HIGH ? PRINT_PRIORITY.HIGH : PRINT_PRIORITY.NORMAL,
  };
}

/**
 * buildDataPayload
 *
 * Constructs the DATA command payload to send POD field values to the printer.
 * The DATA command triggers printing of exactly ONE label.
 * Call it N times to print N labels.
 *
 * @param {object} printer    - LblPrinterConfig record
 * @param {object} podValues  - Plain object of POD field values: { POD1: "val", POD2: "val", ... }
 *                              Keys must match exactly what the template expects (e.g. POD1, POD2, POD3, POD4)
 *
 * Example:
 *   buildDataPayload(printer, { POD1: "₹95.00", POD2: "01PC46129", POD3: "17/04/2026", POD4: "28/04/2026" })
 *
 * Produces:
 *   { printer_id, printer: { ip, port }, command: { command: "DATA", data: { POD1, POD2, ... } } }
 */
export function buildDataPayload(printer, podValues = {}) {
  return {
    printer_id: printer.printer_id,
    printer: {
      ip:   printer.ip_address,
      port: printer.port,
    },
    command: {
      command: PRINTER_COMMANDS.DATA,
      data:    podValues,
    },
  };
}

export function buildPurgePayload(printer) {
  return {
    printer_id: printer.printer_id,
    printer: {
      ip:   printer.ip_address,
      port: printer.port,
    },
    command: {
      command: PRINTER_COMMANDS.PURGE,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 3 — TRANSPORT UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function getPrinterBase(printer) {
  const raw = printer.register_app_link || printer.api_endpoint || '';
  return raw.replace(/\/print\/?$/, '').replace(/\/$/, '');
}

function buildHeaders(printer, includeContentType = true) {
  const headers = {};
  if (includeContentType) headers['Content-Type'] = 'application/json';
  if (printer.auth_header_key && printer.auth_header_value) {
    headers[printer.auth_header_key] = printer.auth_header_value;
  }
  return headers;
}

function genCommandId() {
  return `CMD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

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

function isResponseSuccess(body) {
  if (!body) return false;
  if (body.success !== true) return false;
  if (body.status === 'failed') return false;
  if (body.printer_ok === false) return false;
  const code = (body.printer_protocol_error_code || '').toUpperCase();
  if (code && HARD_FAILURE_CODES.some(f => code.includes(f))) return false;
  return true;
}

/**
 * isStopReadyResponse
 * Returns true when the STOP command was acknowledged (printer responds with STAR/READY).
 */
function isStopReadyResponse(body) {
  if (!body) return false;
  if (body.success !== true) return false;
  // STOP success = printer responds with STAR/READY (same as STAR ack)
  const prp = body.printer_response_payload;
  if (prp?.command === 'STAR' && prp?.status === 'READY') return true;
  const r1 = body?.response?.response;
  if (r1?.command === 'STAR' && r1?.status === 'READY') return true;
  if (body.printer_response_command === 'STAR' && body.printer_response_status === 'READY') return true;
  // Also accept generic success
  return body.printer_ok === true && body.status === 'completed';
}

/**
 * extractActiveTemplateFromMon
 * Parses a MON response body and returns the currently active template name on the printer.
 * Returns null if not determinable.
 */
function extractActiveTemplateFromMon(body) {
  if (!body) return null;
  // Check known locations where active template may appear
  const prp = body.printer_response_payload;
  if (prp?.current_template) return String(prp.current_template).trim();
  if (prp?.templatename) return String(prp.templatename).trim();
  if (prp?.template) return String(prp.template).trim();
  const r1 = body?.response?.response;
  if (r1?.current_template) return String(r1.current_template).trim();
  if (r1?.templatename) return String(r1.templatename).trim();
  if (body.printer_response_payload?.active_template) return String(body.printer_response_payload.active_template).trim();
  return null;
}

/**
 * isStarReadyResponse
 * Returns true only when the printer responded with STAR command + READY status.
 * This is the definitive success signal: { "command": "STAR", "status": "READY" }
 */
function isStarReadyResponse(body) {
  if (!body) return false;
  if (body.success !== true) return false;
  // Check primary location: printer_response_payload
  const prp = body.printer_response_payload;
  if (prp?.command === 'STAR' && prp?.status === 'READY') return true;
  // Check nested response locations
  const r1 = body?.response?.response;
  if (r1?.command === 'STAR' && r1?.status === 'READY') return true;
  const r2 = body?.response?.details?.response;
  if (r2?.command === 'STAR' && r2?.status === 'READY') return true;
  // Check top-level response_command + response_status
  if (body.printer_response_command === 'STAR' && body.printer_response_status === 'READY') return true;
  return false;
}

/**
 * isDataAckResponse
 * Returns true when the DATA command was successfully acknowledged by the printer.
 * The printer echoes back the DATA command with a success status.
 */
function isDataAckResponse(body) {
  if (!body) return false;
  if (body.success !== true) return false;
  if (body.status === 'failed') return false;
  if (body.printer_ok === false) return false;
  const code = (body.printer_protocol_error_code || '').toUpperCase();
  if (code && HARD_FAILURE_CODES.some(f => code.includes(f))) return false;
  return true;
}

function extractErrorMessage(body) {
  return (
    body?.error ||
    body?.printer_reason ||
    body?.printer_protocol_error_description ||
    (body?.printer_protocol_error_code ? `Printer error code: ${body.printer_protocol_error_code}` : null) ||
    `Print ${body?.status || 'failed'}`
  );
}

function isRetryableError(error, responseBody) {
  if (responseBody) {
    const code = (responseBody.printer_protocol_error_code || responseBody.printer_response_status || '').toUpperCase();
    if (HARD_FAILURE_CODES.some(f => code.includes(f))) return false;
  }
  if (error instanceof TypeError) return true;
  return false;
}

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
// TEMPLATE LIST EXTRACTION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * extractTemplateList
 *
 * Parses the raw RQLI middleware response body and returns a clean string[]
 * of template names registered on the physical printer.
 *
 * The middleware response to RQLI has the printer's RSLI data in multiple
 * locations. We check all known locations in priority order:
 *
 * Priority order (from real middleware RQLI response):
 *   1. body.printer_response_payload.template      — parsed object ✅ PRIMARY
 *   2. body.response.response.template             — nested response object
 *   3. body.response.details.response.template     — deeper nesting
 *   4. body.printer_raw_response                   — JSON string (parse it)
 *   5. body.template / body.templates              — flat fallbacks
 */
function extractTemplateList(body) {
  if (!body) return [];

  const fromObj = (obj) => {
    if (!obj) return null;
    if (Array.isArray(obj.template) && obj.template.length > 0) return obj.template.map(String);
    if (Array.isArray(obj.templates) && obj.templates.length > 0) return obj.templates.map(String);
    return null;
  };

  const fromJsonStr = (str) => {
    if (typeof str !== 'string') return null;
    try {
      const parsed = JSON.parse(str);
      return fromObj(parsed);
    } catch (_) { return null; }
  };

  // 1. printer_response_payload.template
  const r1 = fromObj(body.printer_response_payload);
  if (r1) return r1;

  // 2. body.response.response.template
  const r2 = fromObj(body?.response?.response);
  if (r2) return r2;

  // 3. body.response.details.response.template
  const r3 = fromObj(body?.response?.details?.response);
  if (r3) return r3;

  // 4. printer_raw_response as JSON string
  const r4 = fromJsonStr(body.printer_raw_response);
  if (r4) return r4;

  // 5. printer_response_payload as JSON string
  const r5 = fromJsonStr(body.printer_response_payload);
  if (r5) return r5;

  // 6. Flat fallbacks on body itself
  const r6 = fromObj(body);
  if (r6) return r6;

  return [];
}

/**
 * isRsliResponse
 *
 * Returns true if the middleware response indicates that the printer
 * responded with an RSLI command (template list response).
 */
function isRsliResponse(body) {
  if (!body) return false;
  if (body.printer_response_command === 'RSLI') return true;
  if (body?.response?.response_command === 'RSLI') return true;
  if (body?.response?.response?.command === 'RSLI') return true;
  if (body?.response?.details?.response_command === 'RSLI') return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 4 — HIGH-LEVEL EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * fetchPrinterTemplateList
 *
 * Sends a RQLI command to the printer and returns the full list of template
 * names loaded on the physical printer. Retries up to maxRetries times,
 * checking each time that the printer responded with an RSLI command.
 *
 * Protocol:
 *   POST /print { command: { command: "RQLI" } }
 *   Printer responds: { command: "RSLI", template: ["Default-1", ...] }
 *
 * @param {object} printer       - LblPrinterConfig record
 * @param {number} [maxRetries=3]- Max RQLI attempts before giving up
 * @returns {{ templates: string[], error: string|null, unavailable: bool }}
 */
export async function fetchPrinterTemplateList(printer, maxRetries = 3) {
  const base      = getPrinterBase(printer);
  const headers   = buildHeaders(printer, true);
  const timeoutMs = printer.request_timeout_ms || 10000;

  const rqliPayload = {
    printer_id: printer.printer_id,
    printer:    { ip: printer.ip_address, port: printer.port },
    command:    { command: PRINTER_COMMANDS.RQLI },
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[RQLI] Attempt ${attempt}/${maxRetries} — sending RQLI to ${base}`);

    const { body, error: transportError } = await postToMiddleware(
      `${base}${MIDDLEWARE_ENDPOINTS.PRINT}`,
      rqliPayload,
      headers,
      timeoutMs
    );

    // Transport failure (network down, timeout)
    if (transportError && !body) {
      console.warn(`[RQLI] Attempt ${attempt}: transport error — ${transportError}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
        continue;
      }
      return {
        templates:   [],
        error:       `Cannot reach middleware after ${maxRetries} attempts: ${transportError}`,
        unavailable: true,
      };
    }

    // Check if printer responded with RSLI
    if (!isRsliResponse(body)) {
      console.warn(`[RQLI] Attempt ${attempt}: printer did not respond with RSLI. Got command: ${body?.printer_response_command || 'N/A'}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
        continue;
      }
    }

    // Extract template list
    const templates = extractTemplateList(body);
    if (templates.length > 0) {
      console.log(`[RQLI] Attempt ${attempt}: success — found ${templates.length} templates`, templates);
      return { templates, error: null, unavailable: false };
    }

    console.warn(`[RQLI] Attempt ${attempt}: RSLI received but template array is empty.`);
    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }

  return {
    templates:   [],
    error:       `Printer returned no templates after ${maxRetries} attempts. Template list unavailable.`,
    unavailable: true,
  };
}

/**
 * checkTemplateExists
 *
 * Fetches the template list from the printer via RQLI (up to 3 retries)
 * and checks if the given templateName is present (case-insensitive).
 *
 * Returns:
 *   found                — true if template name is in the list
 *   availableTemplates   — full list of templates on the printer
 *   error                — error string if list could not be retrieved
 *   templateListUnavailable — true if RQLI failed to get any list
 *
 * @param {object} printer       - LblPrinterConfig record
 * @param {string} templateName  - Template name to find (e.g. "TK-EXPE-LS-GLS-330")
 * @param {number} [maxRetries=3]
 * @returns {{ found: bool, availableTemplates: string[], error: string|null, templateListUnavailable: bool }}
 */
export async function checkTemplateExists(printer, templateName, maxRetries = 3) {
  const { templates, error, unavailable } = await fetchPrinterTemplateList(printer, maxRetries);

  if (unavailable || templates.length === 0) {
    return {
      found:                false,
      availableTemplates:   templates,
      error:                error || 'Could not read template list from printer',
      templateListUnavailable: true,
    };
  }

  const normalizedTarget = templateName.trim().toLowerCase();
  const found = templates.some(t => String(t).trim().toLowerCase() === normalizedTarget);

  console.log(`[RQLI] Template check: "${templateName}" → ${found ? 'FOUND ✓' : 'NOT FOUND ✗'}`);
  console.log(`[RQLI] Available templates (${templates.length}):`, templates);

  return {
    found,
    availableTemplates:   templates,
    error:                null,
    templateListUnavailable: false,
  };
}

/**
 * sendStarCommand
 *
 * Core print function. Correct protocol:
 *
 *   PHASE 1 — One-time printer setup (runs ONCE per batch):
 *     1. STOP  — clear any previous running job
 *     2. STAR  — load the desired template (retry up to MAX_STAR_READY_ATTEMPTS)
 *     3. MON   — verify the active template on the printer matches what we sent
 *
 *   PHASE 2 — Data loop (runs N times = quantity):
 *     4. DATA  — send POD field values → triggers exactly 1 physical label print
 *
 * This is efficient: template setup happens once, DATA is streamed N times.
 *
 * @param {object} printer       - LblPrinterConfig record
 * @param {string} templateName  - Middleware template name (e.g. "TK-EXPE-LS-GLS-330")
 * @param {number} quantity      - How many labels to print (DATA sent this many times)
 * @param {object} context       - { jobId, commandType, user, podValues }
 *   podValues: { POD1: "val", POD2: "val", ... } — sent in each DATA command
 * @returns {{ success, sentCount, failedAt, lastCommandRecord, lastMiddlewareJobId, errorMessage }}
 */
export async function sendStarCommand(printer, templateName, quantity = 1, { jobId, commandType = 'demo', user, podValues = {} } = {}) {
  if (!jobId) {
    jobId = `JOB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  const endpointUrl = `${getPrinterBase(printer)}${MIDDLEWARE_ENDPOINTS.PRINT}`;
  const headers     = buildHeaders(printer);
  const priority    = printer.default_priority || PRINT_PRIORITY.NORMAL;
  const timeoutMs   = printer.request_timeout_ms || 15000;

  const starPayload = buildStarCommand(printer, templateName, priority);
  const stopPayload = {
    printer_id: printer.printer_id,
    printer:    { ip: printer.ip_address, port: printer.port },
    command:    { command: PRINTER_COMMANDS.STOP },
  };
  const monPayload = {
    printer_id: printer.printer_id,
    printer:    { ip: printer.ip_address, port: printer.port },
    command:    { command: PRINTER_COMMANDS.MON },
    priority,
  };

  let sentCount = 0;
  let lastCommandRecord = null;
  let lastMiddlewareJobId = null;

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 1: One-time printer setup — STOP → STAR (retry) → MON (verify)
  // ─────────────────────────────────────────────────────────────────────────

  // Step 1: STOP — clear previous job state
  const stopResult = await postToMiddleware(endpointUrl, stopPayload, headers, timeoutMs, 1);
  console.log(`[STOP] ok=${isStopReadyResponse(stopResult.body)}, error=${stopResult.error || 'none'}`);

  // Step 2: STAR — load template, retry up to MAX_STAR_READY_ATTEMPTS
  let starReady = false;
  let jobIdFromStar = null;
  const starAttemptResponses = [];

  for (let attempt = 1; attempt <= MAX_STAR_READY_ATTEMPTS; attempt++) {
    console.log(`[STAR] Attempt ${attempt}/${MAX_STAR_READY_ATTEMPTS} — loading template "${templateName}"`);

    const { statusCode, body, error: transportError } = await postToMiddleware(
      endpointUrl, starPayload, headers, timeoutMs, 1
    );
    starAttemptResponses.push({ attempt, statusCode, body, transportError });

    if (!transportError && isStarReadyResponse(body)) {
      starReady = true;
      jobIdFromStar = body?.job_id || null;
      console.log(`[STAR] READY on attempt ${attempt}`);
      break;
    }

    console.warn(`[STAR] Attempt ${attempt} not READY: ${transportError || extractErrorMessage(body)}`);
    if (attempt < MAX_STAR_READY_ATTEMPTS) {
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }

  // Step 3: MON — verify active template matches
  let templateConfirmed = false;
  if (starReady) {
    const monResult = await postToMiddleware(endpointUrl, monPayload, headers, timeoutMs, 1);
    const monActiveTemplate = extractActiveTemplateFromMon(monResult.body);

    if (monActiveTemplate !== null) {
      templateConfirmed = monActiveTemplate.trim().toLowerCase() === templateName.trim().toLowerCase();
      console.log(`[MON] Active: "${monActiveTemplate}" — Expected: "${templateName}" — Match: ${templateConfirmed}`);
    } else {
      // MON couldn't confirm template — accept STAR/READY as sufficient
      console.warn(`[MON] Could not read active template — accepting STAR/READY`);
      templateConfirmed = true;
    }
  }

  // If setup failed, do a full diagnostic to give user a useful error message
  if (!templateConfirmed) {
    console.log(`[SETUP] Template setup failed after ${MAX_STAR_READY_ATTEMPTS} STAR attempts. Running diagnostic...`);
    const monCheck = await checkAndSyncPrinterConfig(printer, templateName);

    let finalErrorMessage;
    if (monCheck.templateListUnavailable) {
      finalErrorMessage = `Unable to set template "${templateName}" as current template. Could not verify template list — contact admin.`;
    } else if (monCheck.templateFound === false) {
      finalErrorMessage = `Unable to set template "${templateName}" in the printer — this template does not exist on the printer. Please load the template first.`;
    } else {
      finalErrorMessage = `Unable to activate template "${templateName}". The template exists on the printer but could not be set as active. Contact admin.`;
    }

    const record = await persistCommand({
      commandId: genCommandId(), jobId, printerId: printer.printer_id, endpointUrl,
      commandType, quantity: 0,
      status: 'failed',
      requestPayload: starPayload,
      responsePayload: { starAttempts: starAttemptResponses, monCheck },
      responseStatusCode: null,
      errorMessage: finalErrorMessage,
      sentBy: user?.email,
    });

    return {
      success: false, sentCount: 0, failedAt: 0,
      lastCommandRecord: record, lastMiddlewareJobId: null,
      errorMessage: finalErrorMessage,
      templateNotOnPrinter: monCheck.templateFound === false && !monCheck.templateListUnavailable,
      templateExistsButFailed: monCheck.templateFound === true,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 2: Send all commands (STOP, STAR, MON, DATA×quantity) in ONE request
  //
  // The Rynan middleware supports batching multiple commands in a single
  // POST using the `commands` array format. This reduces 1000+ HTTP requests
  // to just ONE, dramatically improving throughput:
  //   - Old (serial):     1000 labels = 1000 HTTP requests ≈ 3+ minutes
  //   - Old (concurrent): 1000 labels = 100 HTTP requests ≈ 30 seconds
  //   - New (batch):      1000 labels = 1 HTTP request ≈ 2-5 seconds
  //
  // Payload format:
  //   { printer_id, printer, commands: [...], await_response, continue_on_error }
  // ─────────────────────────────────────────────────────────────────────────

  const commands = [];

  // Build STOP command
  commands.push({ command: PRINTER_COMMANDS.STOP });

  // Build STAR command
  const starCmd = buildStarCommand(printer, templateName, priority);
  commands.push({
    command: starCmd.command.command,
    templatename: starCmd.command.templatename,
    priority: starCmd.priority,
  });

  // Build MON command (verify template was loaded)
  commands.push({ command: PRINTER_COMMANDS.MON, priority });

  // Build N × DATA commands (one per label)
  const dataSample = buildDataPayload(printer, podValues);
  for (let i = 0; i < quantity; i++) {
    commands.push({
      command: dataSample.command.command,
      data: dataSample.command.data,
    });
  }

  // Send all commands in one batch request
  const batchPayload = {
    printer_id: printer.printer_id,
    printer: { ip: printer.ip_address, port: printer.port },
    commands,
    await_response: false, // Fire and forget — printer queues internally
    continue_on_error: true, // Continue printing remaining labels if one fails
  };

  console.log(
    `[BATCH] Sending ${commands.length} commands (STOP, STAR, MON, DATA×${quantity}) in single request`
  );

  const { statusCode, body, error: transportError } = await postToMiddleware(
    endpointUrl,
    batchPayload,
    headers,
    printer.request_timeout_ms || 30000, // Longer timeout for large batches
    1
  );

  if (transportError && !body) {
    const errorMsg = `Cannot reach middleware: ${transportError}`;
    console.error(`[BATCH] Transport error: ${errorMsg}`);

    const record = await persistCommand({
      commandId: genCommandId(),
      jobId,
      printerId: printer.printer_id,
      endpointUrl,
      commandType,
      quantity: 0,
      status: 'failed',
      requestPayload: batchPayload,
      responsePayload: null,
      responseStatusCode: null,
      errorMessage: errorMsg,
      sentBy: user?.email,
    });

    return {
      success: false,
      sentCount: 0,
      failedAt: 0,
      lastCommandRecord: record,
      lastMiddlewareJobId: null,
      errorMessage: errorMsg,
      templateNotOnPrinter: false,
      templateExistsButFailed: false,
    };
  }

  // Batch was submitted successfully
  sentCount = quantity;
  lastMiddlewareJobId = body?.job_id || jobIdFromStar || null;

  console.log(
    `[BATCH] Submitted: ${quantity} DATA commands. Middleware job ID: ${lastMiddlewareJobId || 'N/A'}`
  );

  // Single audit record for entire batch
  const record = await persistCommand({
    commandId: genCommandId(),
    jobId,
    middlewareJobId: lastMiddlewareJobId,
    printerId: printer.printer_id,
    endpointUrl,
    commandType,
    quantity: sentCount,
    status: 'acknowledged',
    requestPayload: batchPayload,
    responsePayload: body,
    responseStatusCode: statusCode || 200,
    errorMessage: null,
    sentBy: user?.email,
  });
  lastCommandRecord = record;

  return {
    success: true,
    sentCount,
    failedAt: null,
    lastCommandRecord,
    lastMiddlewareJobId,
    errorMessage: null,
    templateNotOnPrinter: false,
    templateExistsButFailed: false,
  };
}

/**
 * sendRynanPrintCommand
 * Backward-compatible wrapper — delegates to sendStarCommand() with quantity = 1.
 */
export async function sendRynanPrintCommand(printer, { templateName, priority, podValues } = {}, { jobId, commandType, user } = {}) {
  const result = await sendStarCommand(printer, templateName || '', 1, { jobId, commandType, user, podValues: podValues || {} });
  return {
    success:         result.success,
    commandRecord:   result.lastCommandRecord,
    responseBody:    result.lastCommandRecord?.response_payload || null,
    errorMessage:    result.errorMessage,
    middlewareJobId: result.lastMiddlewareJobId,
  };
}

/**
 * sendRynanTestCommand
 * Sends a single STAR command using the printer's demo or default template.
 */
export async function sendRynanTestCommand(printer, user) {
  const templateName = printer.demo_template || printer.default_template || '';
  const testJobId = `TEST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return sendRynanPrintCommand(printer, { templateName }, { jobId: testJobId, commandType: 'test_ping', user });
}

/**
 * sendPurgeCommand
 * Sends a purge command to clean the printer heads. Endpoint: POST /print
 */
export async function sendPurgeCommand(printer, user) {
  const endpointUrl = `${getPrinterBase(printer)}${MIDDLEWARE_ENDPOINTS.PRINT}`;
  const headers     = buildHeaders(printer);
  const payload     = buildPurgePayload(printer);

  const { statusCode, body, error: transportError } = await postToMiddleware(
    endpointUrl, payload, headers, printer.request_timeout_ms || 15000
  );

  const ok = !transportError && body?.success !== false;
  const commandId = `PURGE-${Date.now()}`;

  await base44.entities.LblPrintCommand.create({
    command_id:           commandId,
    job_id:               `MAINTENANCE-${commandId}`,
    printer_id:           printer.printer_id,
    endpoint_url:         endpointUrl,
    command_type:         'test_ping',
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
 * checkAndSyncPrinterConfig
 *
 * Full 5-step printer validation flow:
 *   Step 1 — GET /printers → check if printer_id exists and IP/port match
 *   Step 2 — Auto-fix: POST /printers (register) or PUT /printers/{id} (update IP/port)
 *   Step 3 — POST /print { command: "MON" } → live connection + cartridge check
 *   Step 4 — Parse MON response for cartridge/ink status (RSAL error codes)
 *   Step 5 — POST /print { command: "RQLI" } → fetch template list, check if our template exists
 *             (retries up to 3 times, verifies RSLI response command)
 *
 * @param {object} printer       - LblPrinterConfig record
 * @param {string} [templateName] - If provided, runs Step 5 RQLI template check
 */
export async function checkAndSyncPrinterConfig(printer, templateName = null) {
  const base        = getPrinterBase(printer);
  const headers     = buildHeaders(printer, false);
  const jsonHeaders = buildHeaders(printer, true);
  const timeoutMs   = printer.request_timeout_ms || 10000;

  const result = {
    configOk:              false,
    configAction:          null,
    configError:           null,
    connectionOk:          false,
    connectionError:       null,
    has_cartridge:         false,
    ink_level:             null,
    cartridgeError:        null,
    templateFound:         null,
    availableTemplates:    [],
    templateError:         null,
    templateListUnavailable: false,
    mon_raw:               null,
    printers_raw:          null,
  };

  // ── STEP 1: GET /printers ─────────────────────────────────────────────────
  let printersData = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${base}${MIDDLEWARE_ENDPOINTS.PRINTERS}`, { headers, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    printersData = await res.json();
    result.printers_raw = printersData;
  } catch (err) {
    result.configOk     = false;
    result.configAction = 'error';
    result.configError  = `Cannot reach middleware: ${err.message}`;
    return result;
  }

  const existingEntry = printersData?.[printer.printer_id];
  const expectedIp    = printer.ip_address;
  const expectedPort  = printer.port;

  // ── STEP 2: Register or update printer config if needed ───────────────────
  if (!existingEntry) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(`${base}${MIDDLEWARE_ENDPOINTS.PRINTERS}`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ printer_id: printer.printer_id, printer: { ip: expectedIp, port: expectedPort } }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      result.configAction = 'created';
      result.configOk     = true;
    } catch (err) {
      result.configAction = 'error';
      result.configError  = `Failed to register printer: ${err.message}`;
      return result;
    }
  } else {
    const ipMatch   = existingEntry.ip   === expectedIp;
    const portMatch = existingEntry.port === expectedPort;

    if (!ipMatch || !portMatch) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(`${base}${MIDDLEWARE_ENDPOINTS.PRINTERS}/${printer.printer_id}`, {
          method: 'PUT',
          headers: jsonHeaders,
          body: JSON.stringify({ printer: { ip: expectedIp, port: expectedPort } }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        result.configAction = 'updated';
        result.configOk     = true;
      } catch (err) {
        result.configAction = 'error';
        result.configError  = `Failed to update printer config: ${err.message}`;
        return result;
      }
    } else {
      result.configAction = 'found';
      result.configOk     = true;
    }
  }

  // ── STEP 3 + 4: MON command — live connection + cartridge check ───────────
  const monPayload = {
    printer_id: printer.printer_id,
    printer:    { ip: expectedIp, port: expectedPort },
    command:    { command: PRINTER_COMMANDS.MON },
    priority:   PRINT_PRIORITY.NORMAL,
  };

  try {
    const { body, error: transportError } = await postToMiddleware(
      `${base}${MIDDLEWARE_ENDPOINTS.PRINT}`,
      monPayload,
      jsonHeaders,
      timeoutMs
    );

    if (transportError && !body) {
      result.connectionOk    = false;
      result.connectionError = transportError;
      return result;
    }

    result.mon_raw = body;

    const monSuccess = body?.success === true && body?.status !== 'failed' && body?.printer_ok !== false;
    result.connectionOk = monSuccess;

    if (!monSuccess) {
      result.connectionError = body?.printer_reason || body?.printer_protocol_error_description || body?.error || `MON returned status: ${body?.status}`;
    }

    // Parse cartridge/ink from MON response (RSAL error codes)
    const errorCode  = (body?.printer_protocol_error_code || '').toUpperCase();
    const rawPayload = body?.printer_response_payload || {};

    const noCartridgeCodes = ['RSAL004', 'RSAL005'];
    const inkOutCodes      = ['RSAL007'];
    const inkLowCodes      = ['RSAL008'];

    if (noCartridgeCodes.some(c => errorCode.replace(' ', '').includes(c))) {
      result.has_cartridge  = false;
      result.cartridgeError = errorCode.includes('004') ? 'No cartridge installed' : 'Invalid cartridge detected';
    } else if (inkOutCodes.some(c => errorCode.replace(' ', '').includes(c))) {
      result.has_cartridge  = true;
      result.ink_level      = 0;
      result.cartridgeError = 'Ink is empty — replace cartridge';
    } else if (inkLowCodes.some(c => errorCode.replace(' ', '').includes(c))) {
      result.has_cartridge  = true;
      result.cartridgeError = 'Ink level is low';
      result.ink_level      = rawPayload?.inkVolume ?? 10;
    } else if (monSuccess) {
      result.has_cartridge  = rawPayload?.printHeadStatus !== 'error' && rawPayload?.printHeadStatus !== 'missing';
      result.ink_level      = rawPayload?.inkVolume ?? null;
      result.cartridgeError = null;
    } else {
      result.has_cartridge  = false;
      result.cartridgeError = result.connectionError;
    }

  } catch (err) {
    result.connectionOk    = false;
    result.connectionError = err.message;
  }

  // ── STEP 5: RQLI Template Check (always dedicated RQLI, never MON fallback) ─
  // We ALWAYS use a dedicated RQLI command for template checking.
  // MON does NOT reliably return the full template list.
  // RQLI is the correct command — printer responds with RSLI + full template array.
  // We retry up to 3 times and verify the response command is RSLI before accepting.
  if (templateName) {
    console.log(`[STEP5] Running RQLI template check for: "${templateName}"`);
    const tplCheck = await checkTemplateExists(printer, templateName, 3);
    result.templateFound          = tplCheck.found;
    result.availableTemplates     = tplCheck.availableTemplates;
    result.templateError          = tplCheck.error;
    result.templateListUnavailable = tplCheck.templateListUnavailable;
    console.log(`[STEP5] RQLI result: found=${tplCheck.found}, total=${tplCheck.availableTemplates.length}, unavailable=${tplCheck.templateListUnavailable}`);
  }

  return result;
}

/**
 * getPrinterStatus
 * Legacy wrapper — calls checkAndSyncPrinterConfig() and maps to old return shape.
 */
export async function getPrinterStatus(printer) {
  const full = await checkAndSyncPrinterConfig(printer);
  return {
    success:       full.configOk,
    has_cartridge: full.has_cartridge,
    ink_level:     full.ink_level,
    mon_output:    full.mon_raw ? JSON.stringify(full.mon_raw).substring(0, 200) : null,
    raw:           full,
    errorMessage:  full.configError || full.connectionError || full.cartridgeError || null,
  };
}

/**
 * getRynanMiddlewareSnapshot
 * Fetches health, connected printers, and metrics in parallel.
 */
export async function getRynanMiddlewareSnapshot(printer) {
  const base    = getPrinterBase(printer);
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
    health:        health.status === 'fulfilled'   ? health.value            : null,
    healthError:   health.status === 'rejected'    ? health.reason?.message  : null,
    printers:      printers.status === 'fulfilled' ? printers.value          : null,
    printersError: printers.status === 'rejected'  ? printers.reason?.message : null,
    metrics:       metrics.status === 'fulfilled'  ? metrics.value           : null,
    metricsError:  metrics.status === 'rejected'   ? metrics.reason?.message : null,
  };
}

/**
 * fetchRynanPodStatus
 *
 * Sends RQLP command to the printer to query the last printed label's POD data.
 * The printer responds with RSFP: { value: "1/5", data: { col1, col2, ... } }
 *   - value "X/Y" → X = labels printed so far, Y = total labels in the job
 *   - data colN → maps to PODN sent in the DATA command
 *
 * @param {object} printer       - LblPrinterConfig record
 * @returns {{
 *   success: bool,
 *   printedCount: number,
 *   totalCount: number,
 *   allPrinted: bool,
 *   printerPodData: object,  // { col1: "...", col2: "...", ... }
 *   raw: object,
 *   errorMessage: string|null
 * }}
 */
export async function fetchRynanPodStatus(printer) {
  const base      = getPrinterBase(printer);
  const headers   = buildHeaders(printer, true);
  const timeoutMs = printer.request_timeout_ms || 15000;

  const rqlpPayload = {
    printer_id: printer.printer_id,
    printer:    { ip: printer.ip_address, port: printer.port },
    command:    { command: 'RQLP' },
  };

  const { statusCode, body, error: transportError } = await postToMiddleware(
    `${base}${MIDDLEWARE_ENDPOINTS.PRINT}`,
    rqlpPayload,
    headers,
    timeoutMs
  );

  if (transportError && !body) {
    return { success: false, printedCount: 0, totalCount: 0, allPrinted: false, printerPodData: {}, raw: null, errorMessage: transportError };
  }

  if (!body?.success) {
    return { success: false, printedCount: 0, totalCount: 0, allPrinted: false, printerPodData: {}, raw: body, errorMessage: body?.error || `HTTP ${statusCode}` };
  }

  // Parse value "X/Y"
  const valueStr = body?.printer_response_payload?.value || body?.response?.response?.value || '';
  const [printedStr, totalStr] = valueStr.split('/');
  const printedCount = parseInt(printedStr, 10) || 0;
  const totalCount   = parseInt(totalStr, 10)   || 0;

  // Extract col data
  const printerPodData = body?.printer_response_payload?.data
    || body?.response?.response?.data
    || {};

  return {
    success:       true,
    printedCount,
    totalCount,
    allPrinted:    totalCount > 0 && printedCount >= totalCount,
    printerPodData,
    raw:           body,
    errorMessage:  null,
  };
}

/**
 * fetchRynanMiddlewareJobStatus
 * Checks the status of a specific middleware print job by ID.
 */
export async function fetchRynanMiddlewareJobStatus({ printer, middlewareJobId }) {
  const base    = getPrinterBase(printer);
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