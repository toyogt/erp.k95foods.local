/**
 * diagnosePrinterError
 *
 * Backend intelligent diagnosis engine for Rynan printer failures.
 *
 * Input payload:
 *   job_id        — LabellingJob record ID
 *   error_message — The raw error string from the failed poll/command (optional)
 *
 * Process:
 *   1. Fetches last 10 LblPrintCommand records for the job (chronological context)
 *   2. Loads all active PrinterDiagnosticRule records from DB
 *   3. Runs a confidence-scored rule-matching engine against logs + error
 *   4. Returns the best-matched rule's action + message, or a generic fallback
 *
 * Output:
 *   {
 *     matched: boolean,
 *     rule_id, rule_name, confidence_score,
 *     recommendation_type,
 *     suggested_action,
 *     diagnostic_message,
 *     relevant_command_ids: string[],
 *     analysed_commands: { command_id, command_type, status, error_message, sent_at }[]
 *   }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Built-in fallback rules (used when DB has no active rules) ───────────────
const BUILT_IN_RULES = [
  {
    rule_id: 'BUILTIN-001',
    rule_name: 'Zero-of-Zero Count Parse Failure',
    error_pattern: 'parse|0.*0|cannot read|undefined',
    match_field: 'error_message',
    context_condition: 'zero_out_of_zero',
    recommendation_type: 'PrinterState',
    suggested_action: 'The printer has not yet reported any label count. Wait a few seconds and refresh, or physically confirm the label was printed.',
    diagnostic_message: 'The live printer status returned 0 printed out of 0 total. This usually means the printer cleared its job counter after completing the demo run, or the printer connection was interrupted before it could report. The system could not parse a valid count from the response.',
    confidence_score: 85,
  },
  {
    rule_id: 'BUILTIN-002',
    rule_name: 'Network / Timeout Error',
    error_pattern: 'timeout|network|fetch|abort|econnrefused|econnreset',
    match_field: 'error_message',
    context_condition: 'prior_network_error',
    recommendation_type: 'Connectivity',
    suggested_action: 'Check the network cable connecting the printer to the system and verify the printer is powered on.',
    diagnostic_message: 'Multiple recent commands failed due to network or timeout errors. The middleware could not reach the printer. This is typically caused by a disconnected network cable, printer powered off, or incorrect printer IP address in the configuration.',
    confidence_score: 90,
  },
  {
    rule_id: 'BUILTIN-003',
    rule_name: 'Template Not Found on Printer',
    error_pattern: 'template|STAR|templatename|not.*load|not.*found',
    match_field: 'error_message',
    context_condition: 'prior_star_failed',
    recommendation_type: 'Template',
    suggested_action: 'Load the correct label template on the printer, then retry the demo print.',
    diagnostic_message: 'The STAR command (which activates the label template) failed in a recent command. This indicates the required template file is not installed or loaded on the Rynan printer. You need to load the template directly on the printer before retrying.',
    confidence_score: 88,
  },
  {
    rule_id: 'BUILTIN-004',
    rule_name: 'Printer Buffer Full / Consumable Error',
    error_pattern: 'FULL|RSAL|ribbon|ink|consumable|RSMPOD',
    match_field: 'any',
    context_condition: 'none',
    recommendation_type: 'Consumable',
    suggested_action: 'Check the printer ribbon / ink cartridge and resolve any physical printer alerts before retrying.',
    diagnostic_message: 'The printer returned an error code associated with consumables (ink, ribbon) or a full buffer. Check the printer display for specific error messages and resolve the physical issue before retrying the print job.',
    confidence_score: 92,
  },
  {
    rule_id: 'BUILTIN-005',
    rule_name: 'All Commands Failed (General)',
    error_pattern: '',
    match_field: 'any',
    context_condition: 'all_commands_failed',
    recommendation_type: 'General',
    suggested_action: 'Restart the printer and the middleware service, then retry.',
    diagnostic_message: 'All recent print commands for this job have failed. This could indicate a systemic issue with the printer, middleware, or network. A full restart of the printer and middleware service is recommended.',
    confidence_score: 50,
  },
];

// ── Rule matching helpers ────────────────────────────────────────────────────

function matchesPattern(pattern, value) {
  if (!pattern) return false;
  try {
    const regex = new RegExp(pattern, 'i');
    return regex.test(String(value || ''));
  } catch {
    return String(value || '').toLowerCase().includes(pattern.toLowerCase());
  }
}

function getFieldValue(cmd, field) {
  switch (field) {
    case 'error_message':          return cmd.error_message || '';
    case 'response_payload_error': return cmd.response_payload?.error || cmd.response_payload?.printer_reason || '';
    case 'printer_protocol_error_code': return cmd.response_payload?.printer_protocol_error_code || '';
    case 'status':                 return cmd.status || '';
    case 'any':
      return [
        cmd.error_message,
        cmd.response_payload?.error,
        cmd.response_payload?.printer_reason,
        cmd.response_payload?.printer_protocol_error_code,
        cmd.status,
      ].join(' ');
    default: return '';
  }
}

function evaluateContextCondition(condition, commands, errorMessage) {
  if (condition === 'none') return true;

  const failedCmds = commands.filter(c => c.status === 'failed');
  const starCmds   = commands.filter(c => c.request_payload?.command?.command === 'STAR');
  const networkErr = /timeout|network|fetch|abort|econnrefused|econnreset/i;

  switch (condition) {
    case 'zero_out_of_zero':
      return /0.*0|parse|cannot|undefined/i.test(errorMessage || '');
    case 'prior_star_failed':
      return starCmds.some(c => c.status === 'failed');
    case 'prior_star_succeeded':
      return starCmds.some(c => c.status === 'acknowledged');
    case 'prior_network_error':
      return commands.some(c => networkErr.test(c.error_message || ''));
    case 'all_commands_failed':
      return failedCmds.length >= 3 && failedCmds.length === commands.length;
    case 'count_not_incremented':
      // Check if DATA commands were sent but status didn't change
      return commands.filter(c => c.command_type === 'demo' && c.status === 'acknowledged').length > 0
          && failedCmds.length > 0;
    default:
      return true;
  }
}

function scoreRule(rule, commands, errorMessage) {
  // Pattern match check
  const hasPattern = rule.error_pattern && rule.error_pattern.trim().length > 0;
  let patternMatched = false;

  if (hasPattern) {
    // Check against current error OR any recent command
    patternMatched = matchesPattern(rule.error_pattern, errorMessage)
      || commands.some(cmd => matchesPattern(rule.error_pattern, getFieldValue(cmd, rule.match_field || 'any')));
  } else {
    // No pattern = context-only rule
    patternMatched = true;
  }

  if (!patternMatched) return 0;

  // Context condition check
  const contextMatched = evaluateContextCondition(rule.context_condition || 'none', commands, errorMessage);
  if (!contextMatched) return 0;

  // Score = base confidence, boosted if both pattern AND context matched
  return (hasPattern && contextMatched) ? rule.confidence_score + 10 : rule.confidence_score;
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user   = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorised' }, { status: 401 });

    const { job_id, error_message = '' } = await req.json();
    if (!job_id) return Response.json({ error: 'job_id is required' }, { status: 400 });

    // 1. Fetch recent LblPrintCommand records for this job
    const recentCommands = await base44.entities.LblPrintCommand.filter({ job_id });
    // Sort by created_date ascending (oldest first for context analysis)
    const sorted = [...recentCommands].sort((a, b) =>
      new Date(a.created_date) - new Date(b.created_date)
    );
    const last10 = sorted.slice(-10);

    // 2. Load active diagnostic rules from DB
    let dbRules = [];
    try {
      dbRules = await base44.entities.PrinterDiagnosticRule.filter({ is_active: true });
    } catch {
      // Entity may not exist yet — fall through to built-in rules
    }

    const allRules = dbRules.length > 0 ? dbRules : BUILT_IN_RULES;

    // 3. Score all rules against command history + current error
    const scoredRules = allRules
      .map(rule => ({ rule, score: scoreRule(rule, last10, error_message) }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score);

    // 4. Build summary of analysed commands for the frontend log viewer
    const analysedCommands = last10.map(c => ({
      command_id:   c.command_id,
      command_type: c.command_type,
      status:       c.status,
      error_message: c.error_message || null,
      sent_at:      c.sent_at || c.created_date,
      request_command: c.request_payload?.command?.command || null,
    }));

    // 5. Return best match or generic fallback
    if (scoredRules.length === 0) {
      return Response.json({
        matched: false,
        recommendation_type: 'General',
        suggested_action: 'The printer status could not be determined. Please physically verify the demo labels and tick the confirmation checkbox to proceed.',
        diagnostic_message: 'No matching diagnostic rule was found for this error pattern. Check that the printer is powered on, connected to the network, and that the middleware service is running.',
        relevant_command_ids: last10.filter(c => c.status === 'failed').map(c => c.command_id),
        analysed_commands: analysedCommands,
        confidence_score: 0,
      });
    }

    const best = scoredRules[0];
    const relevantIds = last10
      .filter(c => c.status === 'failed' || matchesPattern(best.rule.error_pattern, getFieldValue(c, best.rule.match_field || 'any')))
      .map(c => c.command_id);

    return Response.json({
      matched:             true,
      rule_id:             best.rule.rule_id,
      rule_name:           best.rule.rule_name,
      confidence_score:    best.score,
      recommendation_type: best.rule.recommendation_type,
      suggested_action:    best.rule.suggested_action,
      diagnostic_message:  best.rule.diagnostic_message,
      relevant_command_ids: relevantIds,
      analysed_commands:   analysedCommands,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});