import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import BoxLabelForm from '@/components/labels/BoxLabelForm';
import MyRequestsList from '@/components/labels/MyRequestsList';
import ActiveRunLoader from '@/components/labels/ActiveRunLoader';

// Lines available for box label printing
const LABEL_LINES = ['LABEL-LINE-1', 'LABEL-LINE-2'];

function printCalibration() {
  const html = `<!DOCTYPE html><html><head>
    <style>
      @page { size: 6in 4in; margin: 0; }
      html, body { margin: 0; padding: 0; width: 6in; height: 4in; overflow: hidden; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .label { width: 6in; height: 4in; border: 3pt solid black; position: relative; font-family: monospace; font-size: 7pt; background: white; }
      .corner { position: absolute; width: 0.25in; height: 0.25in; border-color: black; border-style: solid; }
      .tl { top: 0; left: 0; border-width: 2pt 0 0 2pt; }
      .tr { top: 0; right: 0; border-width: 2pt 2pt 0 0; }
      .bl { bottom: 0; left: 0; border-width: 0 0 2pt 2pt; }
      .br { bottom: 0; right: 0; border-width: 0 2pt 2pt 0; }
      .grid-h { position: absolute; left: 0; right: 0; height: 0; border-top: 0.5pt dashed #aaa; }
      .grid-v { position: absolute; top: 0; bottom: 0; width: 0; border-left: 0.5pt dashed #aaa; }
      .tick { position: absolute; font-size: 5pt; color: #555; }
      .center-box { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); text-align: center; line-height: 1.6; }
      .crosshair-h { position: absolute; top: 50%; left: 0.5in; right: 0.5in; border-top: 1pt solid #999; }
      .crosshair-v { position: absolute; left: 50%; top: 0.5in; bottom: 0.5in; border-left: 1pt solid #999; }
    </style>
  </head><body>
    <div class="label">
      <div class="corner tl"></div><div class="corner tr"></div>
      <div class="corner bl"></div><div class="corner br"></div>
      <div class="grid-h" style="top:1in"></div><div class="grid-h" style="top:2in"></div><div class="grid-h" style="top:3in"></div>
      <div class="grid-v" style="left:1in"></div><div class="grid-v" style="left:2in"></div>
      <div class="grid-v" style="left:3in"></div><div class="grid-v" style="left:4in"></div><div class="grid-v" style="left:5in"></div>
      <div class="crosshair-h"></div><div class="crosshair-v"></div>
      <div class="tick" style="top:0.05in;left:0.02in">0</div>
      <div class="tick" style="top:0.05in;left:0.97in">1"</div>
      <div class="tick" style="top:0.05in;left:1.97in">2"</div>
      <div class="tick" style="top:0.05in;left:2.97in">3"</div>
      <div class="tick" style="top:0.05in;left:3.97in">4"</div>
      <div class="tick" style="top:0.05in;left:4.97in">5"</div>
      <div class="tick" style="top:0.05in;left:5.7in">6"</div>
      <div class="tick" style="top:0.97in;left:0.02in">1"</div>
      <div class="tick" style="top:1.97in;left:0.02in">2"</div>
      <div class="tick" style="top:2.97in;left:0.02in">3"</div>
      <div class="tick" style="top:3.7in;left:0.02in">4"</div>
      <div class="center-box">
        <div style="font-size:10pt;font-weight:bold;">6 × 4 inch</div>
        <div style="font-size:7pt;color:#555;">CALIBRATION LABEL</div>
        <div style="font-size:6pt;color:#999;margin-top:4pt;">Grid: 1" squares · @page size: 6in 4in · margin: 0</div>
        <div style="font-size:6pt;color:#999;">If edges clip, reduce printer margins to 0.</div>
      </div>
    </div>
  </body></html>`;
  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}

export default function BoxLabelPrint() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selected line + resolved active run
  const [selectedLine, setSelectedLine] = useState(LABEL_LINES[0]);
  const [activeRun, setActiveRun] = useState(undefined); // undefined = not yet resolved

  // Admin override mode (admin prints without active run)
  const [adminOverride, setAdminOverride] = useState(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => { loadAll(); }, []);

  // Reset run state when line changes
  useEffect(() => { setActiveRun(undefined); setAdminOverride(false); }, [selectedLine]);

  async function loadAll() {
    setLoading(true);
    const [u, prods] = await Promise.all([
      base44.auth.me(),
      base44.entities.ProductMaster.filter({ is_active: true }, 'product_name', 200),
    ]);
    setUser(u);
    setProducts(prods);
    await loadRequests(u);
    setLoading(false);
  }

  async function loadRequests(u) {
    const reqs = await base44.entities.LabelPrintRequest.filter(
      { requested_by: (u || user)?.email || '' },
      '-requested_at',
      100
    );
    setRequests(reqs);
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  );

  // Determine if the form should be shown
  const canPrint = !!activeRun || (isAdmin && adminOverride);
  const isAdminOverride = isAdmin && adminOverride;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Box Label Print</h2>
          <p className="text-sm text-slate-500">Box labels are locked to the active approved labelling run.</p>
        </div>
        {isAdmin && (
          <button
            onClick={printCalibration}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            🖨 Print Calibration Label
          </button>
        )}
      </div>

      {/* Line selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <label className="block text-xs font-semibold text-slate-500 uppercase">Select Labelling Line</label>
        <div className="flex gap-3 flex-wrap">
          {LABEL_LINES.map(l => (
            <button
              key={l}
              onClick={() => setSelectedLine(l)}
              className={`flex-1 min-w-[120px] py-3 rounded-xl border text-sm font-semibold transition-colors
                ${selectedLine === l ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Active run status */}
        <ActiveRunLoader
          key={selectedLine}
          lineMachineId={selectedLine}
          onRunLoaded={run => { setActiveRun(run); setAdminOverride(false); }}
        />

        {/* Admin override option — only shown when no active run */}
        {isAdmin && activeRun === null && !adminOverride && (
          <button
            onClick={() => setAdminOverride(true)}
            className="w-full py-2 rounded-xl border border-dashed border-red-400 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors"
          >
            Admin Override: Print without active run
          </button>
        )}
        {isAdmin && adminOverride && (
          <button
            onClick={() => setAdminOverride(false)}
            className="text-xs text-slate-500 hover:underline"
          >
            ✕ Cancel override
          </button>
        )}
      </div>

      {/* Main content — only shown if allowed */}
      {canPrint ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <BoxLabelForm
            activeRun={activeRun}
            user={user}
            products={products}
            isAdminOverride={isAdminOverride}
            onSubmitted={() => loadRequests(user)}
          />
          <MyRequestsList
            requests={requests}
            products={products}
            user={user}
            onRefresh={() => loadRequests(user)}
          />
        </div>
      ) : activeRun === null && !isAdmin ? (
        // Non-admin, no active run → full block
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-6 text-center space-y-2">
          <p className="text-lg font-bold text-amber-800">Printing blocked</p>
          <p className="text-sm text-amber-700">No approved labelling run is active on <b>{selectedLine}</b>.</p>
          <p className="text-sm text-amber-600">Ask your supervisor to approve and start the run before printing box labels.</p>
        </div>
      ) : activeRun === undefined ? null : null}
    </div>
  );
}