/**
 * Scanner-First Input Component
 * Optimized for barcode/QR scanners with auto-focus and quick confirm
 */

import { useState, useRef, useEffect } from 'react';
import { AlertCircle, Check } from 'lucide-react';

export default function ScanInput({
  label,
  placeholder = 'Scan barcode or QR code',
  onScanned,
  onError,
  type = 'barcode', // barcode | qr | manual
  required = true,
  autofocus = true,
  scanTimeout = 100,
  debounce = 200,
  showValidation = true,
  helperText,
}) {
  const [value, setValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef(null);
  const scanBufferRef = useRef('');
  const debounceTimerRef = useRef(null);

  // Auto-focus on mount and after scan
  useEffect(() => {
    if (autofocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autofocus]);

  // Handle scanner input (device sends complete barcode + Enter)
  const handleKeyDown = (e) => {
    // Enter key triggers scan
    if (e.key === 'Enter') {
      e.preventDefault();
      processScan(value);
      return;
    }

    // Tab key submits if value exists
    if (e.key === 'Tab' && value) {
      e.preventDefault();
      processScan(value);
      return;
    }

    // Build scan buffer
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      setIsScanning(true);
      scanBufferRef.current += e.key;

      // Clear timeout if already running
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Wait for scan complete
      debounceTimerRef.current = setTimeout(() => {
        setIsScanning(false);
      }, scanTimeout);
    }
  };

  const handleChange = (e) => {
    const newValue = e.target.value;
    setValue(newValue);
    setError(null);
    setSuccess(false);

    // Clear debounce on manual change
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      setIsScanning(false);
    }
  };

  const processScan = async (scannedValue) => {
    if (!scannedValue.trim()) {
      setError('Scan is empty');
      return;
    }

    // Prevent duplicate scans within 500ms
    const now = Date.now();
    if (lastScan && now - lastScan < 500) {
      return;
    }

    setLastScan(now);
    setIsScanning(false);
    scanBufferRef.current = '';

    try {
      // Validate format based on type
      if (type === 'qr' && !scannedValue.startsWith('QR_')) {
        throw new Error('Invalid QR code format');
      }

      // Call parent handler
      if (onScanned) {
        const result = await onScanned(scannedValue);
        
        if (result === false) {
          throw new Error('Scan rejected by handler');
        }

        setSuccess(true);
        setError(null);
        setValue('');

        // Reset success message after 2 seconds
        setTimeout(() => setSuccess(false), 2000);

        // Keep focus for next scan
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }
    } catch (err) {
      setError(err.message || 'Scan failed');
      setSuccess(false);
      if (onError) {
        onError(err);
      }
    }
  };

  const handleManualSubmit = () => {
    if (value) {
      processScan(value);
    }
  };

  const containerClass = `
    space-y-2
    rounded-lg border-2 transition-colors
    ${error ? 'border-red-300 bg-red-50' : ''}
    ${success ? 'border-green-300 bg-green-50' : 'border-slate-200 bg-white'}
    p-4
  `;

  const inputClass = `
    w-full h-14 text-lg font-mono
    border-0 outline-none
    bg-transparent
    placeholder-slate-400
    text-slate-900
    caret-slate-900
    focus:ring-0
  `;

  return (
    <div className={containerClass}>
      {label && (
        <label className="block text-sm font-bold text-slate-900">
          {label}
          {required && <span className="text-red-600 ml-1">*</span>}
        </label>
      )}

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={inputClass}
        autoComplete="off"
        spellCheck="false"
        disabled={isScanning}
      />

      {/* Status indicators */}
      <div className="flex items-center gap-2 h-6">
        {isScanning && (
          <div className="flex items-center gap-2 text-amber-600">
            <div className="w-2 h-2 bg-amber-600 rounded-full animate-pulse" />
            <span className="text-sm font-medium">Scanning...</span>
          </div>
        )}

        {success && !isScanning && (
          <div className="flex items-center gap-2 text-green-700">
            <Check className="w-5 h-5" />
            <span className="text-sm font-medium">Scanned successfully</span>
          </div>
        )}

        {error && !isScanning && (
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}
      </div>

      {helperText && !error && (
        <p className="text-xs text-slate-500 mt-2">{helperText}</p>
      )}

      {/* Manual submit button for kiosks/touch */}
      {value && (
        <button
          onClick={handleManualSubmit}
          className="w-full h-12 mt-2 bg-slate-900 text-white font-bold text-base rounded-lg hover:bg-slate-800 active:bg-slate-700 transition-colors"
        >
          Confirm Scan
        </button>
      )}

      {/* Focus hint */}
      <div className="text-xs text-slate-400 mt-2">
        {type === 'barcode' && 'Scan barcode or press Enter'}
        {type === 'qr' && 'Scan QR code or press Enter'}
        {type === 'manual' && 'Type code and press Enter'}
      </div>
    </div>
  );
}