import { useEffect, useRef, useState, useCallback } from 'react';
import { createWorker } from 'tesseract.js';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, CameraOff, RefreshCw, ScanLine, Printer } from 'lucide-react';

const STATUS = {
  IDLE: 'idle',
  STARTING: 'starting',
  SCANNING: 'scanning',       // Step 1: scanning for product barcode
  SERIAL_AIM: 'serial_aim',   // Step 2: user aims at serial number box
  OCR: 'ocr',
  DONE: 'done',
  ERROR: 'error',
};

// Pure date pattern — DD-MM-YYYY, MM/DD/YYYY, YYYY-MM-DD etc — should be excluded
const DATE_PATTERN = /^(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}[-\/]\d{1,2}[-\/]\d{1,2})$/;

// A valid serial must have BOTH letters AND digits, optionally with dashes/dots
// and be at least 6 chars. Pure numbers (like barcode digits) are excluded.
const SERIAL_PATTERN = /^(?=[A-Z0-9\-\.]{6,}$)(?=.*[A-Z])(?=.*[0-9])[A-Z0-9\-\.]{6,}$/i;

function extractSerial(rawText) {
  const lines = rawText.split(/\n/).map(l => l.trim()).filter(Boolean);

  // Strategy 1: find line after "BOX SERIAL NUMBER" or "SERIAL" label
  for (let i = 0; i < lines.length; i++) {
    if (/serial\s*(number)?/i.test(lines[i])) {
      // Next non-empty line after the label heading is the serial value
      for (let j = i + 1; j < lines.length; j++) {
        const candidate = lines[j].replace(/\s+/g, '').toUpperCase();
        if (SERIAL_PATTERN.test(candidate) && !DATE_PATTERN.test(candidate)) {
          return candidate;
        }
      }
    }
  }

  // Strategy 2: pick the longest token that matches serial pattern and is not a date
  const allTokens = rawText.split(/[\s\n\r,;:]+/)
    .map(t => t.replace(/[^A-Z0-9\-\.]/gi, '').toUpperCase())
    .filter(t => SERIAL_PATTERN.test(t) && !DATE_PATTERN.test(t));

  if (allTokens.length === 0) return null;

  // Prefer the longest one (serial numbers tend to be long)
  allTokens.sort((a, b) => b.length - a.length);
  return allTokens[0];
}

export default function BarcodeOCRTest() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const workerRef = useRef(null);
  const rafRef = useRef(null);
  const ocrRunningRef = useRef(false);

  const [status, setStatus] = useState(STATUS.IDLE);
  const [scannedBarcode, setScannedBarcode] = useState(null);
  const [detectedSerial, setDetectedSerial] = useState(null);
  const [ocrRawText, setOcrRawText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [workerReady, setWorkerReady] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [alignScore, setAlignScore] = useState(0); // 0-100 alignment score shown to user
  const savedBarcodeRef = useRef(null);
  const stableCountRef = useRef(0);       // how many consecutive frames barcode is well-centred
  const lastBarcodeValueRef = useRef(null);
  const STABLE_FRAMES_NEEDED = 5;        // must be stable for 5 frames before OCR fires

  // Init Tesseract worker
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const worker = await createWorker('eng');
        if (!cancelled) {
          workerRef.current = worker;
          setWorkerReady(true);
        }
      } catch (e) {
        if (!cancelled) {
          // Allow page to function even if OCR fails to init
          setWorkerReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      try { workerRef.current?.terminate(); } catch(_) {}
    };
  }, []);

  // Init BarcodeDetector
  useEffect(() => {
    if ('BarcodeDetector' in window) {
      detectorRef.current = new window.BarcodeDetector({ formats: ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code'] });
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    ocrRunningRef.current = false;
  }, []);

  const startCamera = useCallback(async () => {
    setStatus(STATUS.STARTING);
    setScannedBarcode(null);
    setDetectedSerial(null);
    setOcrRawText('');
    setErrorMsg('');
    ocrRunningRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraActive(true);
      setStatus(STATUS.SCANNING);
      scanLoop();
    } catch (e) {
      setStatus(STATUS.ERROR);
      setErrorMsg('Camera access denied or not available.');
    }
  }, []); // eslint-disable-line

  const scanLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(scanLoop);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    if (detectorRef.current) {
      detectorRef.current.detect(canvas).then(barcodes => {
        if (ocrRunningRef.current) return;

        if (barcodes.length === 0) {
          // No barcode visible — reset stability
          stableCountRef.current = 0;
          lastBarcodeValueRef.current = null;
          setAlignScore(0);
          rafRef.current = requestAnimationFrame(scanLoop);
          return;
        }

        const bc = barcodes[0];
        const { x, y, width, height } = bc.boundingBox;
        const cw = canvas.width;
        const ch = canvas.height;

        // Barcode centre relative to frame
        const bcCx = x + width / 2;
        const bcCy = y + height / 2;

        // How centred horizontally (0=edge, 1=perfect centre)
        const hScore = 1 - Math.abs(bcCx / cw - 0.5) * 2;

        // How centred vertically (want barcode roughly in middle 40-70% vertically)
        const relY = bcCy / ch;
        const vScore = relY >= 0.3 && relY <= 0.75 ? 1 : 0.3;

        // Barcode width should be at least 40% of frame width (close enough)
        const sizeScore = Math.min(width / cw / 0.4, 1);

        const score = Math.round(hScore * 0.4 * 100 + vScore * 0.3 * 100 + sizeScore * 0.3 * 100);
        setAlignScore(score);

        const isAligned = score >= 70 && bc.rawValue === lastBarcodeValueRef.current;

        if (isAligned) {
          stableCountRef.current += 1;
        } else {
          stableCountRef.current = 1;
          lastBarcodeValueRef.current = bc.rawValue;
        }

        if (stableCountRef.current >= STABLE_FRAMES_NEEDED) {
          // Locked and stable — save barcode, now ask user to aim at serial
          const barcode = bc.rawValue;
          setScannedBarcode(barcode);
          savedBarcodeRef.current = barcode;
          stableCountRef.current = 0;
          lastBarcodeValueRef.current = null;
          setAlignScore(0);
          setStatus(STATUS.SERIAL_AIM);
          // Keep camera running — user will tap "Read Serial" button
          rafRef.current = requestAnimationFrame(scanLoop);
        } else {
          rafRef.current = requestAnimationFrame(scanLoop);
        }
      }).catch(() => {
        rafRef.current = requestAnimationFrame(scanLoop);
      });
    } else {
      // No BarcodeDetector — still allow manual trigger
      rafRef.current = requestAnimationFrame(scanLoop);
    }
  }, []); // eslint-disable-line

  const runOCR = useCallback(async (canvas) => {
    if (ocrRunningRef.current) return;
    ocrRunningRef.current = true;
    setStatus(STATUS.OCR);

    if (!workerRef.current) {
      setOcrRawText('OCR engine not available.');
      setDetectedSerial(null);
      setStatus(STATUS.DONE);
      stopCamera();
      return;
    }

    // Use full frame — serial can appear anywhere on the label
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = canvas.width;
    cropCanvas.height = canvas.height;
    const cropCtx = cropCanvas.getContext('2d');
    cropCtx.drawImage(canvas, 0, 0);

    try {
      const { data } = await workerRef.current.recognize(cropCanvas);
      const raw = data.text || '';
      setOcrRawText(raw);

      const serial = extractSerial(raw);
      setDetectedSerial(serial);
      setStatus(STATUS.DONE);
      stopCamera();
    } catch (e) {
      setStatus(STATUS.ERROR);
      setErrorMsg('OCR failed: ' + (e?.message || 'unknown error'));
      ocrRunningRef.current = false;
    }
  }, [stopCamera]);

  const handleManualOCR = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.readyState < 2) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    runOCR(canvas);
  }, [runOCR]);

  const reset = () => {
    stopCamera();
    setStatus(STATUS.IDLE);
    setScannedBarcode(null);
    setDetectedSerial(null);
    setOcrRawText('');
    setErrorMsg('');
    setAlignScore(0);
    savedBarcodeRef.current = null;
    stableCountRef.current = 0;
    lastBarcodeValueRef.current = null;
  };

  // Restart camera to retry OCR but keep the already-scanned barcode
  const retryOCR = useCallback(async () => {
    setDetectedSerial(null);
    setOcrRawText('');
    setErrorMsg('');
    ocrRunningRef.current = false;
    setStatus(STATUS.STARTING);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraActive(true);
      setStatus(STATUS.SCANNING);
      scanLoop();
    } catch (e) {
      setStatus(STATUS.ERROR);
      setErrorMsg('Camera access denied or not available.');
    }
  }, []); // eslint-disable-line

  const statusLabel = {
    [STATUS.IDLE]: 'Ready',
    [STATUS.STARTING]: 'Starting camera…',
    [STATUS.SCANNING]: 'Point camera at label — scanning for barcode…',
    [STATUS.OCR]: 'Barcode found! Reading serial number…',
    [STATUS.DONE]: 'Done!',
    [STATUS.ERROR]: errorMsg || 'Error',
  }[status];

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-start p-4 gap-4">
      <div className="w-full max-w-lg">
        <h1 className="text-white text-xl font-bold text-center mb-1">Barcode + Serial OCR Test</h1>
        <p className="text-slate-400 text-sm text-center mb-4">Scan the product barcode — app will auto-read the serial number text from the same label</p>

        {/* Camera viewfinder */}
        <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden mb-4 border-2 border-slate-700">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />

          {/* Overlay guide lines with alignment indicator */}
          {cameraActive && status === STATUS.SCANNING && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Target box — user should fit barcode inside this */}
              <div className={`absolute inset-x-8 border-2 rounded-lg transition-colors duration-200 ${
                alignScore >= 70 ? 'border-green-400' : alignScore >= 40 ? 'border-yellow-400' : 'border-red-400 opacity-70'
              }`} style={{ top: '28%', bottom: '35%' }} />

              {/* Corner brackets */}
              {['top-[28%] left-8', 'top-[28%] right-8', 'bottom-[35%] left-8', 'bottom-[35%] right-8'].map((pos, i) => (
                <div key={i} className={`absolute w-5 h-5 ${pos} ${alignScore >= 70 ? 'border-green-400' : 'border-yellow-400'} ${
                  i === 0 ? 'border-t-2 border-l-2' : i === 1 ? 'border-t-2 border-r-2' : i === 2 ? 'border-b-2 border-l-2' : 'border-b-2 border-r-2'
                }`} />
              ))}

              {/* Alignment bar at bottom of viewfinder */}
              <div className="absolute bottom-3 left-6 right-6">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-150 ${
                        alignScore >= 70 ? 'bg-green-400' : alignScore >= 40 ? 'bg-yellow-400' : 'bg-red-400'
                      }`}
                      style={{ width: `${alignScore}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold w-10 text-right ${
                    alignScore >= 70 ? 'text-green-300' : alignScore >= 40 ? 'text-yellow-300' : 'text-red-300'
                  }`}>
                    {alignScore >= 70 ? '✓ OK' : `${alignScore}%`}
                  </span>
                </div>
                <p className="text-white/70 text-xs text-center mt-1">
                  {alignScore >= 70 ? 'Hold still — locking…' : alignScore > 0 ? 'Align barcode to centre box' : 'Point at label barcode'}
                </p>
              </div>
            </div>
          )}

          {/* Status overlay */}
          {(status === STATUS.OCR) && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <div className="text-white text-center px-4">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-400" />
                <p className="text-sm font-semibold">Reading serial number…</p>
              </div>
            </div>
          )}

          {!cameraActive && status === STATUS.IDLE && (
            <div className="absolute inset-0 flex items-center justify-center">
              <CameraOff className="text-slate-600 w-12 h-12" />
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className={`rounded-xl px-4 py-3 mb-4 text-sm font-medium text-center ${
          status === STATUS.DONE ? 'bg-green-900/60 text-green-300 border border-green-700' :
          status === STATUS.ERROR ? 'bg-red-900/60 text-red-300 border border-red-700' :
          status === STATUS.OCR ? 'bg-blue-900/60 text-blue-300 border border-blue-700' :
          'bg-slate-800 text-slate-300 border border-slate-700'
        }`}>
          {statusLabel}
        </div>

        {/* Results */}
        {(scannedBarcode || detectedSerial) && (
          <Card className="bg-slate-800 border-slate-700 p-4 mb-4 space-y-4">
            {scannedBarcode && (
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Product Barcode (scanned)</p>
                <p className="text-white font-mono text-lg font-bold break-all">{scannedBarcode}</p>
              </div>
            )}
            {detectedSerial && (
              <div className="border-t border-slate-700 pt-3">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Serial Number (OCR read)</p>
                <p className="text-yellow-300 font-mono text-lg font-bold break-all">{detectedSerial}</p>
              </div>
            )}
            {ocrRawText && (
              <div className="border-t border-slate-700 pt-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Raw OCR Text</p>
                <pre className="text-slate-400 text-xs whitespace-pre-wrap break-all max-h-24 overflow-y-auto">{ocrRawText}</pre>
              </div>
            )}
          </Card>
        )}

        {/* Controls */}
        <div className="space-y-3">
          {!cameraActive && status !== STATUS.DONE && (
            <Button
              onClick={startCamera}
              disabled={!workerReady || status === STATUS.STARTING}
              className="w-full h-14 text-base font-bold min-h-[56px] bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              <Camera className="w-5 h-5 mr-2" />
              {workerReady ? 'Start Camera & Scan' : 'Loading OCR engine…'}
            </Button>
          )}

          {cameraActive && status === STATUS.SCANNING && (
            <>
              {/* Manual trigger if BarcodeDetector not available */}
              {!detectorRef.current && (
                <Button
                  onClick={handleManualOCR}
                  className="w-full h-14 text-base font-bold min-h-[56px] bg-yellow-500 hover:bg-yellow-600 text-black"
                >
                  <ScanLine className="w-5 h-5 mr-2" />
                  Capture & Read Now
                </Button>
              )}
              <Button
                onClick={stopCamera}
                variant="outline"
                className="w-full h-12 text-base min-h-[48px] border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                <CameraOff className="w-5 h-5 mr-2" />
                Cancel
              </Button>
            </>
          )}

          {(status === STATUS.DONE || status === STATUS.ERROR) && (
            <div className="space-y-3">
              {/* Retry OCR only — keep the barcode, just re-read serial */}
              {status === STATUS.DONE && !detectedSerial && (
                <Button
                  onClick={retryOCR}
                  className="w-full h-14 text-base font-bold min-h-[56px] bg-yellow-500 hover:bg-yellow-600 text-black"
                >
                  <ScanLine className="w-5 h-5 mr-2" />
                  Retry Serial Read (barcode saved)
                </Button>
              )}
              <Button
                onClick={reset}
                className="w-full h-14 text-base font-bold min-h-[56px] bg-slate-700 hover:bg-slate-600"
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                Scan Again (full reset)
              </Button>
            </div>
          )}
        </div>

        {!workerReady && (
          <p className="text-slate-500 text-xs text-center mt-3">Loading OCR engine in background…</p>
        )}

        {/* ── PRINT TEST LABEL ── */}
        <div className="mt-8 border-t border-slate-700 pt-6">
          <h2 className="text-white text-base font-bold mb-1">Print Test Label</h2>
          <p className="text-slate-400 text-xs mb-4">Fill in test values and print a 4×6 label — barcode on top, serial as large text below</p>
          <TestLabelPrinter />
        </div>
      </div>
    </div>
  );
}

function TestLabelPrinter() {
  const [fields, setFields] = useState({
    product_name: 'Test Product',
    brand_name: 'Test Brand',
    barcode_value: '8901234567890',
    serial_number: 'TP-2026-00042',
    mfg_date: new Date().toISOString().split('T')[0],
    exp_date: '',
    bottles_per_box: '6',
  });

  const set = (k, v) => setFields(f => ({ ...f, [k]: v }));

  const printLabel = () => {
    function fmtDate(d) {
      if (!d) return '—';
      const p = d.split('-');
      return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : d;
    }
    const barcodeUrl = `https://barcodeapi.org/api/128/${encodeURIComponent(fields.barcode_value)}`;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Test Label</title>
      <style>
        @page { size: 4in 6in; margin: 0; }
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }
        .label { width: 4in; height: 6in; padding: 0.15in; display: flex; flex-direction: column; gap: 0; }
        .divider { border-top: 0.5pt solid #ccc; margin: 0.07in 0; }
        .field-label { font-size: 6.5pt; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
      </style>
    </head><body>
      <div class="label">
        <!-- Brand + Product -->
        <div>
          <div style="font-size:7pt;color:#777;text-transform:uppercase;letter-spacing:0.08em;">${fields.brand_name}</div>
          <div style="font-size:15pt;font-weight:bold;line-height:1.2;">${fields.product_name}</div>
          ${fields.bottles_per_box ? `<div style="font-size:8pt;color:#555;margin-top:1pt;">${fields.bottles_per_box} bottles per box</div>` : ''}
        </div>
        <div class="divider"></div>

        <!-- Dates -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4pt;">
          <div>
            <div class="field-label">Mfg Date</div>
            <div style="font-size:12pt;font-weight:bold;">${fmtDate(fields.mfg_date)}</div>
          </div>
          ${fields.exp_date ? `<div>
            <div class="field-label">Exp Date</div>
            <div style="font-size:12pt;font-weight:bold;color:#b91c1c;">${fmtDate(fields.exp_date)}</div>
          </div>` : ''}
        </div>
        <div class="divider"></div>

        <!-- Product Barcode -->
        <div style="display:flex;flex-direction:column;align-items:center;">
          <div class="field-label" style="align-self:flex-start;margin-bottom:3pt;">Product Barcode</div>
          <img src="${barcodeUrl}" style="height:0.65in;max-width:3.5in;" />
          <div style="font-size:7.5pt;color:#555;margin-top:1pt;font-family:monospace;">${fields.barcode_value}</div>
        </div>
        <div class="divider"></div>

        <!-- Serial Number — immediately below barcode, large text -->
        <div style="display:flex;flex-direction:column;align-items:center;background:#f8f8f8;border:1pt solid #ddd;border-radius:4pt;padding:0.08in 0.1in;">
          <div class="field-label" style="margin-bottom:5pt;">Box Serial Number</div>
          <div style="font-size:24pt;font-weight:bold;font-family:'Courier New',Courier,monospace;letter-spacing:0.06em;text-align:center;word-break:break-all;">
            ${fields.serial_number}
          </div>
        </div>
      </div>
    </body></html>`);
    win.document.close();
    win.focus();
    win.onload = () => setTimeout(() => win.print(), 300);
    setTimeout(() => { try { win.print(); } catch(e) {} }, 2000);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-slate-300 text-xs mb-1 block">Product Name</Label>
          <Input value={fields.product_name} onChange={e => set('product_name', e.target.value)}
            className="bg-slate-800 border-slate-600 text-white h-12 text-base" />
        </div>
        <div>
          <Label className="text-slate-300 text-xs mb-1 block">Brand Name</Label>
          <Input value={fields.brand_name} onChange={e => set('brand_name', e.target.value)}
            className="bg-slate-800 border-slate-600 text-white h-12 text-base" />
        </div>
        <div>
          <Label className="text-slate-300 text-xs mb-1 block">Bottles per Box</Label>
          <Input value={fields.bottles_per_box} onChange={e => set('bottles_per_box', e.target.value)}
            className="bg-slate-800 border-slate-600 text-white h-12 text-base" />
        </div>
        <div className="col-span-2">
          <Label className="text-slate-300 text-xs mb-1 block">Product Barcode Value</Label>
          <Input value={fields.barcode_value} onChange={e => set('barcode_value', e.target.value)}
            className="bg-slate-800 border-slate-600 text-white h-12 text-base font-mono" />
        </div>
        <div className="col-span-2">
          <Label className="text-slate-300 text-xs mb-1 block">Serial Number (printed as text)</Label>
          <Input value={fields.serial_number} onChange={e => set('serial_number', e.target.value)}
            className="bg-slate-800 border-slate-600 text-yellow-300 h-12 text-base font-mono font-bold" />
        </div>
        <div>
          <Label className="text-slate-300 text-xs mb-1 block">Mfg Date</Label>
          <Input type="date" value={fields.mfg_date} onChange={e => set('mfg_date', e.target.value)}
            className="bg-slate-800 border-slate-600 text-white h-12 text-base" />
        </div>
        <div>
          <Label className="text-slate-300 text-xs mb-1 block">Exp Date (optional)</Label>
          <Input type="date" value={fields.exp_date} onChange={e => set('exp_date', e.target.value)}
            className="bg-slate-800 border-slate-600 text-white h-12 text-base" />
        </div>
      </div>
      <Button
        onClick={printLabel}
        className="w-full h-14 text-base font-bold min-h-[56px] bg-emerald-600 hover:bg-emerald-700"
      >
        <Printer className="w-5 h-5 mr-2" />
        Print Test Label (4×6)
      </Button>
    </div>
  );
}