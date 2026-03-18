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
  SCANNING: 'scanning',
  OCR: 'ocr',
  DONE: 'done',
  ERROR: 'error',
};

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

  // Init Tesseract worker
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const worker = await createWorker('eng');
      if (!cancelled) {
        workerRef.current = worker;
        setWorkerReady(true);
      }
    })();
    return () => {
      cancelled = true;
      workerRef.current?.terminate();
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

    // Barcode detection
    if (detectorRef.current) {
      detectorRef.current.detect(canvas).then(barcodes => {
        if (barcodes.length > 0 && !ocrRunningRef.current) {
          const barcode = barcodes[0].rawValue;
          setScannedBarcode(barcode);
          // Trigger OCR on current frame
          runOCR(canvas);
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
    if (ocrRunningRef.current || !workerRef.current) return;
    ocrRunningRef.current = true;
    setStatus(STATUS.OCR);

    // Crop bottom-half of label where serial is typically printed
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = canvas.width;
    cropCanvas.height = Math.floor(canvas.height * 0.5);
    const cropCtx = cropCanvas.getContext('2d');
    cropCtx.drawImage(canvas, 0, Math.floor(canvas.height * 0.5), canvas.width, cropCanvas.height, 0, 0, cropCanvas.width, cropCanvas.height);

    try {
      const { data } = await workerRef.current.recognize(cropCanvas);
      const raw = data.text || '';
      setOcrRawText(raw);
      // Try to extract serial: any alphanumeric token 6+ chars
      const tokens = raw.split(/[\s\n\r]+/).filter(t => /^[A-Z0-9\-]{6,}$/i.test(t));
      setDetectedSerial(tokens.length > 0 ? tokens.join(' | ') : null);
      setStatus(STATUS.DONE);
      stopCamera();
    } catch (e) {
      setStatus(STATUS.ERROR);
      setErrorMsg('OCR failed. Please try again.');
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
  };

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

          {/* Overlay guide lines */}
          {cameraActive && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-x-6 top-1/4 bottom-1/4 border-2 border-yellow-400 rounded-lg opacity-60" />
              <div className="absolute inset-x-6 top-1/4 bottom-1/4 flex items-center justify-center">
                <ScanLine className="text-yellow-400 w-8 h-8 opacity-70 animate-pulse" />
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
            <Button
              onClick={reset}
              className="w-full h-14 text-base font-bold min-h-[56px] bg-slate-700 hover:bg-slate-600"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              Scan Again
            </Button>
          )}
        </div>

        {!workerReady && (
          <p className="text-slate-500 text-xs text-center mt-3">Loading OCR engine in background…</p>
        )}
      </div>
    </div>
  );
}