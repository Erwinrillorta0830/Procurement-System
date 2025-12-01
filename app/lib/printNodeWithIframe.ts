// src/lib/printNodeWithIframe.ts
export function printNodeWithIframe(source: HTMLElement, title = 'Document') {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title>
<style>
  @page { size: A4; margin: 12mm; }
  html, body { background:#fff; font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
  /* minimal utilities so we don't depend on Tailwind in the iframe */
  .w-a4 { width: 210mm; margin: 0 auto; }
  .h1 { font-size: 22px; font-weight: 700; }
  .muted { color: #334155; font-size: 12px; }
  .text-right { text-align: right; }

  table { border-collapse: collapse; width: 100%; }
  thead { display: table-header-group; }
  tfoot { display: table-row-group; }
  tr { page-break-inside: avoid; }
  th, td { border-top: 1px solid #E5E7EB; padding: 8px; font-size: 12px; vertical-align: top; }
  th { background: #F8FAFC; text-align: left; }
</style>
</head><body></body></html>`);
    doc.close();

    // Clone ONLY the inner content (no off-screen/hide styles)
    const clone = source.cloneNode(true) as HTMLElement;
    clone.removeAttribute('aria-hidden');
    clone.style.cssText = ''; // strip inline styles if any
    doc.body.appendChild(clone);

    // Wait two frames so layout/fonts resolve, then print
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            iframe.contentWindow!.focus();
            iframe.contentWindow!.print();
            setTimeout(() => document.body.removeChild(iframe), 1000);
        });
    });
}
