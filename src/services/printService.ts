/**
 * Dedicated Rock-Solid Print Service
 * Solves "thermal print varala" / browser iframe print issues:
 * 1. Creates an active, sized invisible iframe (opacity 0.001, 800x800) so Chromium & WebKit render full layout and trigger print dialog
 * 2. Injects precise @page rules (e.g. 104mm auto for 4-inch thermal, 80mm for 3-inch, A4 for laser)
 * 3. Graceful fallback to window.print() if iframe printing is restricted by browser sandbox
 */

export function printHtmlDirectly(
  htmlContent: string,
  title = 'Invoice Print',
  paperWidthMm: number = 104
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Remove any previously created print iframe
      const oldIframe = document.getElementById('shopbilling-print-frame');
      if (oldIframe) {
        oldIframe.remove();
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'shopbilling-print-frame';
      // Use opacity 0.001 and non-zero dimensions: Chromium WILL NOT print visibility:hidden or 0x0 iframes!
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '800px';
      iframe.style.height = '800px';
      iframe.style.border = '0';
      iframe.style.opacity = '0.001';
      iframe.style.pointerEvents = 'none';
      iframe.style.zIndex = '-9999';

      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        // Fallback to standard window.print()
        window.print();
        resolve(true);
        return;
      }

      const pageCss =
        paperWidthMm === 210
          ? 'size: A4 portrait; margin: 4mm;'
          : paperWidthMm === 148
          ? 'size: A5 landscape; margin: 3mm;'
          : `size: ${paperWidthMm}mm auto; margin: 0mm;`;

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${title}</title>
            <style>
              @page {
                ${pageCss}
              }
              *, *::before, *::after {
                box-sizing: border-box !important;
              }
              html, body {
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                font-family: 'Courier New', Courier, monospace, monospace;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              @media screen {
                body {
                  padding: 8px;
                }
              }
              @media print {
                body {
                  margin: 0 !important;
                  padding: 0 !important;
                }
              }
            </style>
          </head>
          <body>
            ${htmlContent}
          </body>
        </html>
      `);
      doc.close();

      // Give browser time to parse DOM, then invoke print
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve(true);
        } catch (err) {
          console.warn('Iframe print error, falling back to window.print():', err);
          window.print();
          resolve(false);
        } finally {
          setTimeout(() => {
            iframe.remove();
          }, 3500);
        }
      }, 250);
    } catch (e) {
      console.error('Print service exception:', e);
      window.print();
      resolve(false);
    }
  });
}
