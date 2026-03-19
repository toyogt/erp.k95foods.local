/**
 * Traceability Explorer
 * Search and visualize material/product genealogy
 */

import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  getBackwardTrace,
  getForwardTrace,
  getCompleteGenealogy,
  getBatchTrace,
  getLotTrace,
  getCrateTrace,
  getPalletTrace,
  getDispatchTrace,
  getSkuTrace,
} from '@/lib/traceabilityEngine';
import TraceTimeline from '@/components/traceability/TraceTimeline';
import TraceExportDialog from '@/components/traceability/TraceExportDialog';
import { AlertCircle, ArrowLeft, ArrowRight, Download, Filter } from 'lucide-react';
import { format } from 'date-fns';

export default function TraceabilityExplorer() {
  const [user, setUser] = useState(null);
  const [searchType, setSearchType] = useState('batch');
  const [searchValue, setSearchValue] = useState('');
  const [traceDirection, setTraceDirection] = useState('complete');
  const [trace, setTrace] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => setUser(u)).catch(() => {});
  }, []);

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      setError('Please enter a search value');
      return;
    }

    setLoading(true);
    setError(null);
    setTrace(null);

    try {
      let result;

      if (searchType === 'batch') {
        result = await getBatchTrace(searchValue);
      } else if (searchType === 'lot') {
        result = await getLotTrace(searchValue);
      } else if (searchType === 'crate') {
        result = await getCrateTrace(searchValue);
      } else if (searchType === 'pallet') {
        result = await getPalletTrace(searchValue);
      } else if (searchType === 'dispatch') {
        result = await getDispatchTrace(searchValue);
      } else if (searchType === 'sku') {
        result = await getSkuTrace(searchValue);
      }

      if (traceDirection === 'backward' && result.batchId) {
        result = await getBackwardTrace('Batch', searchValue);
      } else if (traceDirection === 'forward' && result.batchId) {
        result = await getForwardTrace('Batch', searchValue);
      } else if (traceDirection === 'complete' && result.batchId) {
        result = await getCompleteGenealogy('Batch', searchValue);
      }

      setTrace(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Material & Product Traceability</h1>
        <p className="text-sm text-slate-600 mt-1">
          Track complete genealogy from raw materials to finished goods. Find sources of issues or trace product recalls.
        </p>
      </div>

      {/* Search Controls */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-2">Search Type</label>
            <Select value={searchType} onValueChange={setSearchType}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="batch">Batch</SelectItem>
                <SelectItem value="lot">Lot</SelectItem>
                <SelectItem value="crate">Crate</SelectItem>
                <SelectItem value="pallet">Pallet</SelectItem>
                <SelectItem value="dispatch">Dispatch Document</SelectItem>
                <SelectItem value="sku">Product Code (SKU)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700 block mb-2">Trace Direction</label>
            <Select value={traceDirection} onValueChange={setTraceDirection}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="backward">
                  <span className="flex items-center gap-2">
                    <ArrowLeft className="w-3 h-3" />
                    Backward (Sources)
                  </span>
                </SelectItem>
                <SelectItem value="forward">
                  <span className="flex items-center gap-2">
                    <ArrowRight className="w-3 h-3" />
                    Forward (Derivatives)
                  </span>
                </SelectItem>
                <SelectItem value="complete">Complete Genealogy</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700 block mb-2">
              {searchType.charAt(0).toUpperCase() + searchType.slice(1)} ID
            </label>
            <Input
              placeholder={`Enter ${searchType} ID...`}
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSearch()}
              className="h-9"
            />
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleSearch}
              disabled={loading || !searchValue.trim()}
              className="w-full bg-slate-900 hover:bg-slate-800"
            >
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      {/* Results */}
      {trace && (
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-lg p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              {searchType.toUpperCase()}: {searchValue}
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-600 font-medium">Total Events</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {trace.completeTimeline?.length || trace.timeline?.length || 0}
                </p>
              </div>

              {trace.summary && (
                <>
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-600 font-medium">Source Materials</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">
                      {trace.summary.sources}
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-600 font-medium">Derivatives</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">
                      {trace.summary.derivatives}
                    </p>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-600 font-medium">Final Dispatches</p>
                    <p className="text-2xl font-bold text-purple-600 mt-1">
                      {trace.summary.finalDispatches}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Timeline View */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Event Timeline</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExport(true)}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export Report
              </Button>
            </div>

            <TraceTimeline
              events={trace.completeTimeline || trace.timeline || []}
              searchType={searchType}
            />
          </div>

          {/* Backward Trace (if complete genealogy) */}
          {trace.backward && trace.backward.sources.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <ArrowLeft className="w-5 h-5 text-blue-600" />
                Source Materials (Backward Trace)
              </h3>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {trace.backward.sources.map((source, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-white rounded border border-blue-100"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {source.type} - {source.id}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {source.event} • {format(new Date(source.timestamp), 'MMM d, HH:mm')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        {source.qty} {source.unit}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Forward Trace (if complete genealogy) */}
          {trace.forward && trace.forward.derivatives.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <ArrowRight className="w-5 h-5 text-green-600" />
                Downstream Products (Forward Trace)
              </h3>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {trace.forward.derivatives.map((deriv, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-white rounded border border-green-100"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {deriv.type} - {deriv.id}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {deriv.event} • {format(new Date(deriv.timestamp), 'MMM d, HH:mm')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        {deriv.qty} {deriv.unit}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {trace.forward.finalDispatches.length > 0 && (
                <div className="mt-4 pt-4 border-t border-green-200">
                  <p className="text-xs font-medium text-green-900 mb-2">Final Dispatches:</p>
                  <div className="flex flex-wrap gap-2">
                    {trace.forward.finalDispatches.map((disp, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold"
                      >
                        {disp.dispatchId}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!trace && !loading && (
        <div className="text-center py-12 text-slate-500">
          <Filter className="w-8 h-8 mx-auto mb-3 text-slate-400" />
          <p>Enter a {searchType} ID and click Search to view genealogy.</p>
        </div>
      )}

      {/* Export Dialog */}
      {showExport && trace && (
        <TraceExportDialog
          trace={trace}
          searchType={searchType}
          searchValue={searchValue}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}