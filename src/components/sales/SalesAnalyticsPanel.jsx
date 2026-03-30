import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { Sparkles, ChevronDown, ChevronUp, Loader2, RefreshCw } from 'lucide-react';

/**
 * Reusable AI analytics panel for sales module pages.
 * Pass `context` (string label) and `data` (array or object to analyse).
 * Optionally pass `extraContext` (string) for additional background.
 */
export default function SalesAnalyticsPanel({ context = 'Sales Data', data = [], extraContext = '' }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);

  async function generateReport() {
    setLoading(true);
    setReport(null);
    const summary = JSON.stringify(
      Array.isArray(data) ? data.slice(0, 200) : data,
      null, 2
    ).slice(0, 12000); // keep prompt manageable

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a senior business analyst for K95 ERP, a fast-growing FMCG company.
Analyse the following ${context} data and produce a DEEP, DETAILED business intelligence report.

${extraContext ? `Additional context: ${extraContext}\n` : ''}
Data:
${summary}

Your report must include:
1. **Executive Summary** – key headline numbers and overall health
2. **Key Trends & Patterns** – what is growing, declining, stagnant
3. **Top Performers** – top 5 by relevant metric with commentary
4. **Risk & Anomalies** – anything unusual, overdue, at-risk
5. **Segment / Group Breakdown** – breakdown by category/group/territory/status
6. **Actionable Recommendations** – at least 5 specific, prioritised actions for the sales team
7. **Data Quality Notes** – missing fields, incomplete records to clean up

Format each section with a clear heading (use ## for headings). Be specific with numbers and percentages. Use ₹ for INR amounts.`,
      model: 'claude_sonnet_4_6',
    });

    setReport(typeof result === 'string' ? result : result?.report || JSON.stringify(result));
    setLoading(false);
  }

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && !report && !loading) generateReport();
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-violet-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-900">AI Analytics — {context}</p>
            <p className="text-xs text-slate-500">Deep analysis generated automatically · uses advanced AI</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {report && !loading && (
            <button
              onClick={(e) => { e.stopPropagation(); generateReport(); }}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              title="Refresh analysis"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-slate-100 px-4 py-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
              <p className="text-sm text-slate-500">Generating deep analysis… this takes 15–30 seconds</p>
            </div>
          )}

          {!loading && report && (
            <div className="prose prose-sm max-w-none text-slate-700">
              {report.split('\n').map((line, i) => {
                if (line.startsWith('## ')) {
                  return (
                    <h3 key={i} className="text-sm font-bold text-slate-900 mt-4 mb-1.5 border-b border-slate-100 pb-1">
                      {line.replace('## ', '')}
                    </h3>
                  );
                }
                if (line.startsWith('**') && line.endsWith('**')) {
                  return <p key={i} className="text-xs font-semibold text-slate-800 mt-2">{line.replace(/\*\*/g, '')}</p>;
                }
                if (line.startsWith('- ') || line.startsWith('• ')) {
                  return (
                    <div key={i} className="flex gap-2 text-xs text-slate-600 my-0.5">
                      <span className="text-violet-400 shrink-0 mt-0.5">•</span>
                      <span dangerouslySetInnerHTML={{ __html: line.replace(/^[-•]\s/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                    </div>
                  );
                }
                if (line.trim() === '') return <div key={i} className="my-1" />;
                return (
                  <p key={i} className="text-xs text-slate-600 my-0.5"
                    dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
                  />
                );
              })}
            </div>
          )}

          {!loading && !report && (
            <div className="text-center py-6">
              <Button className="h-11 bg-violet-600 hover:bg-violet-700 text-white" onClick={generateReport}>
                <Sparkles className="w-4 h-4 mr-2" /> Generate Analysis
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}