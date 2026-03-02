import { createRoot } from 'react-dom/client';
import { createElement } from 'react';

/**
 * Opens a hidden iframe, renders a React component into it, then triggers print.
 * component: React component to render
 * props: props to pass to the component
 */
export function printReactComponent(component, props = {}) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-9999px';
  iframe.style.left = '-9999px';
  iframe.style.width = '6.5in';
  iframe.style.height = '4.5in';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const iDoc = iframe.contentDocument || iframe.contentWindow.document;
  iDoc.open();
  iDoc.write(`<!DOCTYPE html><html><head>
    <style>
      @page { size: 6in 4in; margin: 0; }
      body { margin: 0; padding: 0; background: #fff; }
    </style>
  </head><body><div id="print-root"></div></body></html>`);
  iDoc.close();

  const root = createRoot(iDoc.getElementById('print-root'));
  root.render(createElement(component, props));

  // Wait for render then print
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => {
      root.unmount();
      document.body.removeChild(iframe);
    }, 2000);
  }, 300);
}