/**
 * LblPrinterDiagnosticPanel
 *
 * Displays intelligent printer error diagnosis to the operator.
 * Called when useDemoPrintPollStatus returns a poll error.
 *
 * Features:
 *   - Calls diagnosePrinterError backend to get a matched rule + suggestion
 *   - Colour-codes by recommendation_type
 *   - Shows a "View Detailed Logs" collapsible for the relevant command history
 *   - "Was this helpful?" thumbs feedback logged to AuditLog
 */

import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  AlertTriangle, Wifi, Layout, Cpu, Database, HelpCircle,
  ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Loader2,
  Terminal, CheckCircle2, XCircle, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

// ── Colour map per recommendation type ──────────────────────────────────────
const TYPE_CONFIG = {
  Connectivity: {
    bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800',
    iconColor: 'text-red-600', Icon: Wifi,
    badge: 'bg-red-100 text-red-700',
  },
  Template: {
    bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800',
    iconColor: 'text-orange-600', Icon: Layout,
    badge: 'bg-orange-100 text-orange-700',
  },
  PrinterState: {
    bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800',
    iconColor: 'text-amber-600', Icon: Cpu,
    badge: 'bg-amber-100 text-amber-700',
  },
  DataIssue: {
    bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800',
    iconColor: 'text-purple-600', Icon: Database,
    badge: 'bg-purple-100 text-purple-700',
  },
  Consumable: {
    bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800',
    iconColor: 'text-yellow-600', Icon: AlertTriangle,
    badge: 'bg-yellow-100 text-yellow-700',
  },
  General: {
    bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-800',
    iconColor: 'text-slate-500', Icon: HelpCircle,
    badge: 'bg-slate-100 text-slate-600',
  },
};

function StatusBadge({ status }) {
  if (status === 'failed') return <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />;
  if (status === 'acknowledged') return <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />;
  return <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
}

export default function LblPrinterDiagnosticPanel({ jobId, pollError, user }) {
  const [diagnosis, setDiagnosis]       = useState(null);
  const [loading, setLoading]           = useState(false);
  const [showLogs, setShowLogs]         = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState(null); // 'helpful' | 'not_helpful'
  const [feedbackSaving, setFeedbackSaving] = useState(false);

  useEffect(() => {
    if (!jobId || !pollError) return;

    let cancelled = false;
    setLoading(true);
    setDiagnosis(null);
    setFeedbackGiven(null);

    base44.functions.invoke('diagnosePrinterError', {
      job_id:       jobId,
      error_message: pollError,
    }).then(res => {
      if (!cancelled) setDiagnosis(res?.data || null);
    }).catch(() => {
      if (!cancelled) setDiagnosis(null);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [jobId, pollError]);

  const handleFeedback = async (helpful) => {
    if (feedbackGiven || feedbackSaving) return;
    setFeedbackSaving(true);
    try {
      await base44.entities.AuditLog.create({
        audit_id:    `DIAG-FB-${Date.now()}`,
        action:      helpful ? 'Diagnostic suggestion marked helpful' : 'Diagnostic suggestion marked unhelpful',
        action_type: 'update',
        module:      'LABELLING',
        entity_type: 'PrinterDiagnosticRule',
        entity_id:   diagnosis?.rule_id || 'unknown',
        entity_code: diagnosis?.rule_name || 'No rule matched',
        after_state: {
          job_id:             jobId,
          poll_error:         pollError,
          rule_matched:       diagnosis?.matched,
          recommendation_type: diagnosis?.recommendation_type,
          feedback:           helpful ? 'helpful' : 'not_helpful',
        },
        actor_email: user?.email || '',
        actor_name:  user?.full_name || '',
        criticality: 'info',
        tags: ['printer', 'diagnosis', 'feedback'],
      });
      setFeedbackGiven(helpful ? 'helpful' : 'not_helpful');
    } catch {
      setFeedbackGiven(helpful ? 'helpful' : 'not_helpful');
    } finally {
      setFeedbackSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        <span>Analysing printer command history for diagnosis…</span>
      </div>
    );
  }

  if (!diagnosis) {
    // Fallback plain error
    return (
      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>Live printer count unavailable ({pollError}). Proceed by physically confirming the labels below.</span>
      </div>
    );
  }

  const cfg   = TYPE_CONFIG[diagnosis.recommendation_type] || TYPE_CONFIG.General;
  const Icon  = cfg.Icon;
  const cmds  = diagnosis.analysed_commands || [];

  return (
    <div className={`border rounded-lg overflow-hidden ${cfg.border}`}>

      {/* ── Main diagnosis card ── */}
      <div className={`p-3 space-y-2 ${cfg.bg}`}>

        {/* Header row */}
        <div className="flex items-start gap-2">
          <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.iconColor}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-sm font-semibold ${cfg.text}`}>
                {diagnosis.recommendation_type} Issue Detected
              </p>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
                {diagnosis.matched ? `${diagnosis.recommendation_type}` : 'General'}
              </span>
              {diagnosis.confidence_score > 0 && (
                <span className="text-xs text-slate-500">
                  {diagnosis.confidence_score}% confidence
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Suggested action — prominent */}
        <div className={`bg-white/70 border rounded-lg p-2.5 ${cfg.border}`}>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Suggested Action</p>
          <p className={`text-sm font-medium ${cfg.text}`}>{diagnosis.suggested_action}</p>
        </div>

        {/* Detailed explanation */}
        <p className={`text-xs leading-relaxed ${cfg.text} opacity-90`}>
          {diagnosis.diagnostic_message}
        </p>

        {/* Feedback row */}
        <div className="flex items-center gap-3 pt-1">
          <span className="text-xs text-slate-500">Was this helpful?</span>
          {feedbackGiven ? (
            <span className="text-xs font-medium text-slate-600">
              {feedbackGiven === 'helpful' ? '✓ Thanks for the feedback!' : '✓ Noted — we will improve this.'}
            </span>
          ) : (
            <>
              <button
                onClick={() => handleFeedback(true)}
                disabled={feedbackSaving}
                className="flex items-center gap-1 text-xs text-green-700 hover:text-green-900 transition-colors"
              >
                <ThumbsUp className="w-3.5 h-3.5" /> Yes
              </button>
              <button
                onClick={() => handleFeedback(false)}
                disabled={feedbackSaving}
                className="flex items-center gap-1 text-xs text-red-700 hover:text-red-900 transition-colors"
              >
                <ThumbsDown className="w-3.5 h-3.5" /> No
              </button>
            </>
          )}

          {/* View logs toggle */}
          {cmds.length > 0 && (
            <button
              onClick={() => setShowLogs(v => !v)}
              className="ml-auto flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 font-medium transition-colors"
            >
              <Terminal className="w-3.5 h-3.5" />
              {showLogs ? 'Hide' : 'View'} Command Logs ({cmds.length})
              {showLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>

      {/* ── Collapsible Command Log Table ── */}
      {showLogs && cmds.length > 0 && (
        <div className="border-t border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left px-3 py-2 text-slate-700 font-semibold">Command</th>
                <th className="text-left px-3 py-2 text-slate-700 font-semibold">Type</th>
                <th className="text-left px-3 py-2 text-slate-700 font-semibold">Status</th>
                <th className="text-left px-3 py-2 text-slate-700 font-semibold">Error</th>
                <th className="text-left px-3 py-2 text-slate-700 font-semibold">Sent At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cmds.map((cmd, idx) => {
                const isRelevant = diagnosis.relevant_command_ids?.includes(cmd.command_id);
                return (
                  <tr
                    key={cmd.command_id || idx}
                    className={`hover:bg-slate-50 ${isRelevant && cmd.status === 'failed' ? 'bg-red-50' : ''}`}
                  >
                    <td className="px-3 py-2 font-mono text-slate-700">
                      {cmd.request_command || cmd.command_type}
                      {isRelevant && (
                        <span className="ml-1.5 text-xs font-medium text-red-600 bg-red-100 px-1 py-0.5 rounded">key</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{cmd.command_type}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <StatusBadge status={cmd.status} />
                        <span className={cmd.status === 'failed' ? 'text-red-700 font-medium' : 'text-slate-600'}>
                          {cmd.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-500 max-w-xs truncate" title={cmd.error_message || ''}>
                      {cmd.error_message || <span className="text-slate-300 italic">—</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                      {cmd.sent_at ? format(new Date(cmd.sent_at), 'dd/MM/yyyy HH:mm:ss') : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}