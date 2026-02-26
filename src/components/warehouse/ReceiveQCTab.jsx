import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ScanLine, CheckCircle, AlertCircle, AlertTriangle, Loader2, Upload } from 'lucide-react';

const QC_ITEMS = [
  'Label correctly affixed and legible',
  'No damage or leakage',
  'MRP and batch match',
  'Bottle fill level acceptable',
];

function parseSerial(raw) {
  try { const o = JSON.parse(raw); if (o.s) return o.s; } catch (_) {}
  return raw.trim();
}

function genSessionId() {
  return 'SES-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}

export default function ReceiveQCTab({ user }) {
  const [palletInput, setPalletInput] = useState('');
  const [sessionLoading, setSessionLoading] = useState(false);

  const [sessionError, setSessionError] = useState('');
  const [session, setSession] = useState(null);
  const [palletRecord, setPalletRecord] = useState(null);
  const [expectedLinks, setExpectedLinks] = useState([]);
  const [scanned, setScanned] = useState([]);
  const [warehouseLocation, setWarehouseLocation] = useState('WAREHOUSE-1');
  const [boxInput, setBoxInput] = useState('');
  const [scanMsg, setScanMsg] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [discrepancy, setDiscrepancy] = useState(null);
  const [qcMode, setQcMode] = useState(false);
  const [qcSamples, setQcSamples] = useState([]);
  const [qcSampleCount, setQcSampleCount] = useState(4);
  const [currentQc, setCurrentQc] = useState(null);
  const [qcBoxInput, setQcBoxInput] = useState('');
  const [qcUploading, setQcUploading] = useState(false);
  const [qcResults, setQcResults] = useState([]);
  const palletRef = useRef(null);
  const boxRef = useRef(null);
  const qcRef = useRef(null);

  useEffect(() => { palletRef.current?.focus(); }, []);
  useEffect(() => { if (session) boxRef.current?.focus(); }, [session]);

  async function openSession() {
    const pid = palletInput.trim().toUpperCase();
    if (!pid) return;
    setSessionLoading(true);
    setSessionError('');

    // Find the most recent BoxPallet record for this pallet_id
    const pallets = await base44.entities.BoxPallet.filter({ pallet_id: pid }, '-created_date', 1);
    if (!pallets.length) {
      setSessionError(`Pallet "${pid}" not found. Only handed-over pallets can be received.`);
      setSessionLoading(false);
      return;
    }
    const palletRec = pallets[0];

    // Get links for this specific pallet build (by record id, fallback to pallet_id)
    let links = await base44.entities.BoxPalletLink.filter(
      { box_pallet_record_id: palletRec.id },
      '-created_date',
      500
    );
    if (!links.length) {
      // Fallback for older records without box_pallet_record_id
      links = await base44.entities.BoxPalletLink.filter({ pallet_id: pid }, '-created_date', 500);
    }

    const sess = await base44.entities.BoxReceivingSession.create({
      session_id: genSessionId(),
      pallet_id: pid,
      box_pallet_record_id: palletRec.id,
      status: 'OPEN',
      started_at: new Date().toISOString(),
      started_by: user?.email || '',
      expected_count: links.length,
      warehouse_location: warehouseLocation,
    });

    setPalletRecord(palletRec);
    setExpectedLinks(links);
    setSession(sess);
    setScanned([]);
    setCompleted(false);
    setDiscrepancy(null);
    setSessionLoading(false);
  }

  async function handleBoxScan() {
    const raw = boxInput.trim();
    if (!raw || !session) return;
    setBoxInput('');
    const serial = parseSerial(raw);

    if (scanned.find(s => s === serial)) {
      setScanMsg({ ok: false, msg: `Already scanned: ${serial}` });
      boxRef.current?.focus(); return;
    }

    const labels = await base44.entities.BoxLabel.filter({ box_serial: serial }, '-created_date', 1);
    if (!labels.length) {
      setScanMsg({ ok: false, msg: `Box not found: ${serial}` });
      boxRef.current?.focus(); return;
    }
    const lbl = labels[0];
    await base44.entities.BoxLabel.update(lbl.id, {
      status: 'IN_STOCK',
      current_location: warehouseLocation,
      received_at: new Date().toISOString(),
      received_by: user?.email || '',
    });
    setScanned(prev => [...prev, serial]);
    setScanMsg({ ok: true, msg: `✓ ${serial} received` });
    boxRef.current?.focus();
  }

  async function completeReceiving() {
    setCompleting(true);
    const expectedSerials = expectedLinks.map(l => l.box_serial);
    const missing = expectedSerials.filter(s => !scanned.includes(s));
    const extra = scanned.filter(s => !expectedSerials.includes(s));

    let disc = null;
    if (missing.length || extra.length) {
      disc = await base44.entities.BoxDiscrepancyReport.create({
        pallet_id: session.pallet_id,
        session_id: session.id,
        missing_serials: missing,
        extra_serials: extra,
        missing_count: missing.length,
        extra_count: extra.length,
        status: 'OPEN',
        reported_at: new Date().toISOString(),
        reported_by: user?.email || '',
      });
      setDiscrepancy(disc);
    }

    await base44.entities.BoxReceivingSession.update(session.id, {
      status: 'COMPLETED',
      completed_at: new Date().toISOString(),
      completed_by: user?.email || '',
      received_count: scanned.length,
      has_discrepancy: !!(missing.length || extra.length),
    });

    // Mark pallet as RECEIVED
    if (palletRecord) {
      await base44.entities.BoxPallet.update(palletRecord.id, { status: 'RECEIVED' });
    }

    setCompleted(true);
    setCompleting(false);
  }

  async function startQC() {
    const settings = await base44.entities.AppSetting.filter({ key: 'QC_SAMPLE_COUNT' }, '-created_date', 1).catch(() => []);
    if (settings.length) setQcSampleCount(parseInt(settings[0].value) || 4);
    setQcMode(true);
    setQcSamples([]);
    setQcResults([]);
  }

  async function addQcScan() {
    const serial = parseSerial(qcBoxInput.trim());
    if (!serial) return;
    setQcBoxInput('');
    setCurrentQc({ serial, checks: QC_ITEMS.map(q => ({ q, pass: null })), photo: null });
  }

  function toggleCheck(idx, val) {
    setCurrentQc(prev => ({
      ...prev,
      checks: prev.checks.map((c, i) => i === idx ? { ...c, pass: val } : c),
    }));
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !currentQc) return;
    setQcUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setCurrentQc(prev => ({ ...prev, photo: file_url }));
    setQcUploading(false);
  }

  async function submitQcSample() {
    if (!currentQc) return;
    const pass = currentQc.checks.every(c => c.pass === true);
    await base44.entities.BoxQCInspection.create({
      box_serial: currentQc.serial,
      pallet_id: session.pallet_id,
      session_id: session.id,
      result: pass ? 'PASS' : 'FAIL',
      checked_by: user?.email || '',
      checked_at: new Date().toISOString(),
      checklist_json: currentQc.checks,
      photo_url: currentQc.photo || '',
    });
    const newSamples = [...qcSamples, { serial: currentQc.serial, pass }];
    setQcSamples(newSamples);
    setQcResults(prev => [...prev, { serial: currentQc.serial, pass }]);
    setCurrentQc(null);

    if (!pass && palletRecord) {
      await base44.entities.BoxPallet.update(palletRecord.id, {
        status: 'QUARANTINE',
      });
    }
    qcRef.current?.focus();
  }

  function resetAll() {
    setSession(null);
    setPalletRecord(null);
    setPalletInput('');
    setCompleted(false);
    setQcMode(false);
    setSessionError('');
    setScanned([]);
    setScanMsg(null);
  }

  return (
    <div className="space-y-4">
      {/* Pallet Scan */}
      {!session && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h3 className="font-semibold text-slate-800">Scan Inbound Pallet</h3>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase mb-1.5 block">Warehouse Location</label>
            <input
              className="w-full h-10 px-3 text-sm rounded-xl border border-slate-300 focus:outline-none"
              value={warehouseLocation}
              onChange={e => setWarehouseLocation(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase mb-1.5 block">Pallet ID</label>
            <div className="flex gap-2">
              <input
                ref={palletRef}
                style={{ fontSize: '16px' }}
                className="flex-1 h-12 px-3 rounded-xl border border-slate-300 focus:border-sky-500 focus:outline-none font-mono"
                placeholder="Scan or type Pallet ID…"
                value={palletInput}
                onChange={e => { setPalletInput(e.target.value.toUpperCase()); setSessionError(''); }}
                onKeyDown={e => e.key === 'Enter' && openSession()}
              />
              <Button onClick={openSession} disabled={!palletInput.trim() || sessionLoading} className="bg-sky-600 hover:bg-sky-700 h-11 gap-2">
                {sessionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Open Session'}
              </Button>
            </div>
            {sessionError && (
              <div className="flex items-center gap-2 mt-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {sessionError}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active Session */}
      {session && !completed && (
        <>
          <div className="bg-sky-50 border border-sky-200 rounded-2xl px-5 py-3 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-sky-600 uppercase">Session: {session.pallet_id}</span>
              <p className="text-sm text-slate-700">Expected: <b>{expectedLinks.length}</b> boxes · Loc: <b>{warehouseLocation}</b></p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-sky-700">{scanned.length}</span>
              <p className="text-xs text-sky-600">scanned</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 uppercase">Scan Box QR</span>
            </div>
            <div className="flex gap-2">
              <input
                ref={boxRef}
                style={{ fontSize: '16px' }}
                className="flex-1 h-12 px-3 rounded-xl border border-slate-300 focus:border-sky-500 focus:outline-none font-mono"
                placeholder="Scan Box QR…"
                value={boxInput}
                onChange={e => setBoxInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleBoxScan()}
              />
              <Button onClick={handleBoxScan} disabled={!boxInput.trim()} className="bg-sky-600 hover:bg-sky-700 h-12">Add</Button>
            </div>
            {scanMsg && (
              <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl ${scanMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                {scanMsg.ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {scanMsg.msg}
              </div>
            )}
          </div>

          <Button
            onClick={completeReceiving}
            disabled={completing || scanned.length === 0}
            className="w-full h-12 bg-slate-900 hover:bg-slate-800 rounded-xl gap-2"
          >
            {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : `Complete Receiving (${scanned.length} / ${expectedLinks.length})`}
          </Button>
        </>
      )}

      {/* Completed */}
      {completed && (
        <div className="space-y-3">
          {discrepancy ? (
            <div className="flex items-start gap-2 bg-red-50 border border-red-300 rounded-2xl p-4">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-700">Discrepancy Reported</p>
                <p className="text-sm text-red-600">Missing: {discrepancy.missing_count} · Extra: {discrepancy.extra_count}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <p className="font-semibold text-emerald-800">Receiving complete — no discrepancy.</p>
            </div>
          )}

          {!qcMode && (
            <Button onClick={startQC} variant="outline" className="w-full h-11 gap-2">
              Start QC Sampling ({qcSampleCount} samples)
            </Button>
          )}

          {qcMode && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <h3 className="font-bold text-slate-800">QC Sampling</h3>
              <p className="text-xs text-slate-500">Samples done: {qcSamples.length} / {qcSampleCount}</p>

              {qcResults.map((r, i) => (
                <div key={i} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl ${r.pass ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  {r.pass ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {r.serial} — {r.pass ? 'PASS' : 'FAIL'}
                </div>
              ))}

              {!currentQc && qcSamples.length < qcSampleCount && (
                <div className="flex gap-2">
                  <input
                    ref={qcRef}
                    className="flex-1 h-10 px-3 text-sm rounded-xl border border-slate-300 focus:outline-none font-mono"
                    placeholder="Scan QC box…"
                    value={qcBoxInput}
                    onChange={e => setQcBoxInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addQcScan()}
                  />
                  <Button onClick={addQcScan} disabled={!qcBoxInput.trim()} className="bg-sky-600 hover:bg-sky-700 h-10">Scan</Button>
                </div>
              )}

              {currentQc && (
                <div className="space-y-3 border border-slate-200 rounded-xl p-4">
                  <p className="font-semibold text-slate-800 text-sm">Box: <span className="font-mono">{currentQc.serial}</span></p>
                  {currentQc.checks.map((c, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-slate-700 flex-1">{c.q}</span>
                      <div className="flex gap-2">
                        <button onClick={() => toggleCheck(i, true)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold ${c.pass === true ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-emerald-100'}`}>✓ Pass</button>
                        <button onClick={() => toggleCheck(i, false)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold ${c.pass === false ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-red-100'}`}>✗ Fail</button>
                      </div>
                    </div>
                  ))}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Photo (optional)</label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-sky-600 hover:text-sky-800">
                      <Upload className="w-4 h-4" />
                      {qcUploading ? 'Uploading…' : currentQc.photo ? 'Photo uploaded ✓' : 'Upload photo'}
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} disabled={qcUploading} />
                    </label>
                  </div>
                  <Button onClick={submitQcSample}
                    disabled={currentQc.checks.some(c => c.pass === null) || qcUploading}
                    className="w-full bg-sky-600 hover:bg-sky-700 h-10">Submit Sample</Button>
                </div>
              )}

              {qcSamples.length >= qcSampleCount && (
                <div className={`flex items-center gap-2 p-3 rounded-xl ${qcResults.some(r => !r.pass) ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'} font-semibold text-sm`}>
                  {qcResults.some(r => !r.pass) ? '⚠ QC FAILED — Pallet quarantined.' : '✓ QC PASSED — All samples OK.'}
                </div>
              )}
            </div>
          )}

          <Button variant="outline" onClick={resetAll} className="w-full h-10">
            Start New Session
          </Button>
        </div>
      )}
    </div>
  );
}