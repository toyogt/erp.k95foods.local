import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import BoxLabelForm from '@/components/labels/BoxLabelForm';
import MyRequestsList from '@/components/labels/MyRequestsList';

function printCalibration() {
  const html = `<!DOCTYPE html><html><head>
    <style>
      @page { size: 6in 4in; margin: 0; }
      html, body { margin: 0; padding: 0; width: 6in; height: 4in; overflow: hidden; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .label {
        width: 6in; height: 4in;
        border: 3pt solid black;
        position: relative;
        font-family: monospace;
        font-size: 7pt;
        background: white;
      }
      /* Corner marks */
      .corner { position: absolute; width: 0.25in; height: 0.25in; border-color: black; border-style: solid; }
      .tl { top: 0; left: 0; border-width: 2pt 0 0 2pt; }
      .tr { top: 0; right: 0; border-width: 2pt 2pt 0 0; }
      .bl { bottom: 0; left: 0; border-width: 0 0 2pt 2pt; }
      .br { bottom: 0; right: 0; border-width: 0 2pt 2pt 0; }
      /* Grid lines */
      .grid-h { position: absolute; left: 0; right: 0; height: 0; border-top: 0.5pt dashed #aaa; }
      .grid-v { position: absolute; top: 0; bottom: 0; width: 0; border-left: 0.5pt dashed #aaa; }
      /* Rulers */
      .ruler-h { position: absolute; top: 0.35in; left: 0; right: 0; height: 0.15in; }
      .ruler-v { position: absolute; left: 0.35in; top: 0; bottom: 0; width: 0.15in; }
      .tick { position: absolute; font-size: 5pt; color: #555; }
      .center-box { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); text-align: center; line-height: 1.6; }
      .crosshair-h { position: absolute; top: 50%; left: 0.5in; right: 0.5in; border-top: 1pt solid #999; }
      .crosshair-v { position: absolute; left: 50%; top: 0.5in; bottom: 0.5in; border-left: 1pt solid #999; }
    </style>
  </head><body>
    <div class="label">
      <!-- Corners -->
      <div class="corner tl"></div>
      <div class="corner tr"></div>
      <div class="corner bl"></div>
      <div class="corner br"></div>
      <!-- Horizontal grid lines at 1in intervals -->
      <div class="grid-h" style="top:1in"></div>
      <div class="grid-h" style="top:2in"></div>
      <div class="grid-h" style="top:3in"></div>
      <!-- Vertical grid lines at 1in intervals -->
      <div class="grid-v" style="left:1in"></div>
      <div class="grid-v" style="left:2in"></div>
      <div class="grid-v" style="left:3in"></div>
      <div class="grid-v" style="left:4in"></div>
      <div class="grid-v" style="left:5in"></div>
      <!-- Crosshairs at center -->
      <div class="crosshair-h"></div>
      <div class="crosshair-v"></div>
      <!-- Horizontal ruler ticks -->
      <div class="tick" style="top:0.05in;left:0.02in">0</div>
      <div class="tick" style="top:0.05in;left:0.97in">1"</div>
      <div class="tick" style="top:0.05in;left:1.97in">2"</div>
      <div class="tick" style="top:0.05in;left:2.97in">3"</div>
      <div class="tick" style="top:0.05in;left:3.97in">4"</div>
      <div class="tick" style="top:0.05in;left:4.97in">5"</div>
      <div class="tick" style="top:0.05in;left:5.7in">6"</div>
      <!-- Vertical ruler ticks -->
      <div class="tick" style="top:0.97in;left:0.02in">1"</div>
      <div class="tick" style="top:1.97in;left:0.02in">2"</div>
      <div class="tick" style="top:2.97in;left:0.02in">3"</div>
      <div class="tick" style="top:3.7in;left:0.02in">4"</div>
      <!-- Center info -->
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

  useEffect(() => { loadAll(); }, []);

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
      20
    );
    setRequests(reqs);
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  );

  // Two-column on desktop, stacked on mobile
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Box Label Print</h2>
          <p className="text-sm text-slate-500">Create requests, get approval, then generate & print 6×4 labels.</p>
        </div>
        {user?.role === 'admin' && (
          <button
            onClick={printCalibration}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            🖨 Print Calibration Label
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Left: form */}
        <BoxLabelForm
          products={products}
          user={user}
          onSubmitted={() => loadRequests(user)}
        />

        {/* Right: requests list */}
        <MyRequestsList
          requests={requests}
          products={products}
          user={user}
          onRefresh={() => loadRequests(user)}
        />
      </div>
    </div>
  );
}