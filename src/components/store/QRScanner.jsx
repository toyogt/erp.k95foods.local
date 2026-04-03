import { useState, useRef, useEffect } from 'react';
import { Camera, X, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function QRScanner({ onScan, label = 'Scan QR Code' }) {
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);

  async function startCamera() {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      // Start scanning frames
      intervalRef.current = setInterval(scanFrame, 500);
    } catch (err) {
      console.warn('Camera access denied:', err);
      setShowCamera(false);
    }
  }

  function scanFrame() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Use BarcodeDetector API if available (Chrome, Edge, Android)
    if ('BarcodeDetector' in window) {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      detector.detect(canvas).then(barcodes => {
        if (barcodes.length > 0) {
          const val = barcodes[0].rawValue;
          if (val) {
            onScan(val);
            stopCamera();
          }
        }
      }).catch(() => {});
    }
  }

  function stopCamera() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  if (showCamera) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 bg-black/80">
          <p className="text-white text-sm font-semibold">{label}</p>
          <button onClick={stopCamera} className="text-white p-2"><X className="w-6 h-6" /></button>
        </div>
        <div className="flex-1 relative">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-56 h-56 border-2 border-white/60 rounded-2xl" />
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
        <div className="px-4 py-4 bg-black/80 text-center">
          <p className="text-white/70 text-xs">Point camera at QR code. Scanning automatically...</p>
          <p className="text-white/50 text-xs mt-1">Or type the code manually in the input field</p>
        </div>
      </div>
    );
  }

  return (
    <Button type="button" variant="outline" size="sm" className="gap-2 h-9" onClick={startCamera}>
      <Camera className="w-4 h-4" /> Scan
    </Button>
  );
}