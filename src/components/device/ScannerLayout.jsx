/**
 * Scanner-First Layout
 * Optimized for handheld barcode/QR scanners
 */

import { useDeviceMode } from '@/hooks/useDeviceMode';

export default function ScannerLayout({
  children,
  title,
  subtitle,
  scanFocus = true,
}) {
  const { sizes } = useDeviceMode();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      {(title || subtitle) && (
        <div className="bg-slate-900 text-white p-4 flex-shrink-0">
          {title && <h1 className="text-2xl font-bold">{title}</h1>}
          {subtitle && <p className="text-sm text-slate-300 mt-1">{subtitle}</p>}
        </div>
      )}

      {/* Content area - scrollable */}
      <div className={`flex-1 overflow-y-auto ${sizes.padding}`}>
        <div className={`space-y-6 max-w-2xl mx-auto ${scanFocus ? 'pb-32' : ''}`}>
          {children}
        </div>
      </div>

      {/* Scan hint footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-amber-50 border-t-2 border-amber-200 p-3 text-center text-sm font-medium text-amber-900">
        Ready to scan. Point camera at barcode.
      </div>
    </div>
  );
}