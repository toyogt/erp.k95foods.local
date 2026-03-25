/**
 * PDF Preview Panel for Sales Order creation
 * Shows the uploaded PDF side-by-side with extracted data
 */
export default function PDFPreviewPanel({ pdfUrl }) {
  if (!pdfUrl) return null;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
      <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-700">Purchase Order PDF Preview</span>
        <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline font-medium">
          Open Full Size ↗
        </a>
      </div>
      <div style={{ height: '400px' }}>
        <iframe
          src={`${pdfUrl}#toolbar=0&navpanes=0`}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Purchase Order PDF"
        />
      </div>
    </div>
  );
}