/**
 * Client-side PDF text extraction using PDF.js from CDN.
 * Extracts all text from a PDF file URL in ~200-500ms (browser-side).
 * This eliminates the 10-30s server-side extraction bottleneck.
 */

let pdfjsLib = null;

async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  
  // PDF.js is loaded via dynamic import from CDN
  if (!window.pdfjsLib) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  
  pdfjsLib = window.pdfjsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  return pdfjsLib;
}

/**
 * Extract all text from a PDF file URL.
 * @param {string} pdfUrl - URL of the PDF file
 * @returns {Promise<string>} - Full text content of the PDF
 */
export async function extractTextFromPDF(pdfUrl) {
  const lib = await loadPdfJs();
  const pdf = await lib.getDocument(pdfUrl).promise;
  
  const pages = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join('\n');
    pages.push(pageText);
  }
  
  return pages.join('\n');
}

/**
 * Extract text from a File object (drag & drop / file input).
 * @param {File} file - The PDF file object
 * @returns {Promise<string>} - Full text content
 */
export async function extractTextFromFile(file) {
  const lib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data: arrayBuffer }).promise;
  
  const pages = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join('\n');
    pages.push(pageText);
  }
  
  return pages.join('\n');
}