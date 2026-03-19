import React, { useState, useEffect } from 'react';
import { getDiagnosticsReport } from '@/lib/routeValidator';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, AlertTriangle, Copy, RefreshCw } from 'lucide-react';

export default function RoutesDiagnostics() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const data = getDiagnosticsReport();
    setReport(data);
    setLoading(false);
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      const data = getDiagnosticsReport();
      setReport(data);
      setLoading(false);
    }, 300);
  };

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (!report) return <div className="p-4">Error loading diagnostics</div>;

  const { summary, validation, details } = report;
  const isHealthy = summary.isHealthy;
  const hasErrors = validation.errors.length > 0;
  const hasWarnings = validation.warnings.length > 0;

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Routes Diagnostics</h1>
          <p className="text-sm text-slate-500 mt-1">
            Last updated: {new Date(report.timestamp).toLocaleString()}
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Health Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`rounded-lg p-4 border-2 ${isHealthy ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            {isHealthy ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <span className={`font-semibold ${isHealthy ? 'text-green-900' : 'text-red-900'}`}>
              {isHealthy ? 'Healthy' : 'Issues Found'}
            </span>
          </div>
          <p className={`text-sm ${isHealthy ? 'text-green-700' : 'text-red-700'}`}>
            {summary.errorCount} errors, {summary.warningCount} warnings
          </p>
        </div>

        <div className="rounded-lg p-4 border-2 border-slate-200 bg-slate-50">
          <div className="text-2xl font-bold text-slate-900">{summary.totalPages}</div>
          <div className="text-xs text-slate-500 mt-1">Total Pages</div>
        </div>

        <div className="rounded-lg p-4 border-2 border-slate-200 bg-slate-50">
          <div className="text-2xl font-bold text-slate-900">{summary.totalModules}</div>
          <div className="text-xs text-slate-500 mt-1">Total Modules</div>
        </div>

        <div className="rounded-lg p-4 border-2 border-slate-200 bg-slate-50">
          <div className="text-2xl font-bold text-slate-900">{details.roles.length}</div>
          <div className="text-xs text-slate-500 mt-1">Role Types</div>
        </div>
      </div>

      {/* Errors */}
      {hasErrors && (
        <div className="rounded-lg bg-red-50 border-2 border-red-200 p-4">
          <h2 className="flex items-center gap-2 font-semibold text-red-900 mb-3">
            <AlertCircle className="w-5 h-5" />
            Errors ({validation.errors.length})
          </h2>
          <ul className="space-y-2">
            {validation.errors.map((err, i) => (
              <li key={i} className="text-sm text-red-700 flex gap-2">
                <span className="text-red-400 mt-0.5">•</span>
                <span>{err}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {hasWarnings && (
        <div className="rounded-lg bg-amber-50 border-2 border-amber-200 p-4">
          <h2 className="flex items-center gap-2 font-semibold text-amber-900 mb-3">
            <AlertTriangle className="w-5 h-5" />
            Warnings ({validation.warnings.length})
          </h2>
          <ul className="space-y-2">
            {validation.warnings.map((warn, i) => (
              <li key={i} className="text-sm text-amber-700 flex gap-2">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>{warn}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pages by Module */}
      <div className="rounded-lg border-2 border-slate-200 p-4">
        <h2 className="font-semibold text-slate-900 mb-4">Pages by Module</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {details.pagesByModule.map((item, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200">
              <span className="text-sm font-medium text-slate-700">{item.module}</span>
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-900 text-white text-xs font-semibold">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* All Roles */}
      <div className="rounded-lg border-2 border-slate-200 p-4">
        <h2 className="font-semibold text-slate-900 mb-4">All Defined Roles</h2>
        <div className="flex flex-wrap gap-2">
          {details.roles.map((role, i) => (
            <span key={i} className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-sm font-medium border border-slate-200">
              {role}
            </span>
          ))}
        </div>
      </div>

      {/* Raw JSON */}
      <div className="rounded-lg border-2 border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Raw Report JSON</h2>
          <Button
            onClick={handleCopyJSON}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Copy className="w-4 h-4" />
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
        <pre className="bg-slate-900 text-slate-100 rounded p-4 overflow-x-auto text-xs max-h-96">
          {JSON.stringify(report, null, 2)}
        </pre>
      </div>

      {/* Footer */}
      <div className="text-xs text-slate-500 text-center">
        Registry Config Source: lib/registryConfig.js
      </div>
    </div>
  );
}