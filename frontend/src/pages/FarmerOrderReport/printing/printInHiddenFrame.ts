// printing/printInHiddenFrame.ts
// Silent print via hidden <iframe> (no focus change / no new tab)

import QRCode from "qrcode"

type QR = { subjectId: string; token: string }

/**
 * Builds the HTML for a grid of QR cards.
 */
function buildHtml(opts: {
  title: string
  imgs: string[] // data URLs for each QR
  qrs: QR[]
  sizePx: number
  cols: number
}) {
  const { title, imgs, qrs, sizePx, cols } = opts

  const cards = qrs
    .map((q, i) => {
      const img = imgs[i]
      return `
        <div class="card">
          <div class="id">${escapeHtml(q.subjectId)}</div>
          <div class="qr"><img src="${img}" width="${sizePx}" height="${sizePx}" /></div>
          <div class="token">${escapeHtml(q.token)}</div>
        </div>`
    })
    .join("")

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body { font: 14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; margin: 0; padding: 16px; }
    h2 { margin: 0 0 16px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(${Math.max(1, cols)}, minmax(0, 1fr));
      gap: 12px;
    }
    .card {
      display: flex; flex-direction: column; gap: 6px;
      border: 1px solid #e5e7eb; border-radius: 12px;
      padding: 12px 16px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .id { font-weight: 600; font-size: 12px; word-break: break-word; }
    .qr { display: grid; place-items: center; }
    .qr img { display: block; }
    .token {
      font-family: ui-monospace,SFMono-Regular,Menlo,monospace;
      font-size: 11px; color: #374151; word-break: break-all;
    }
    @media print {
      body { padding: 0; }
      .grid { gap: 8px; }
      .card { border: 1px solid #ddd; }
    }
  </style>
</head>
<body>
  <h2>${escapeHtml(title)}</h2>
  <div class="grid">${cards}</div>
  <script>
    // Ensure images are loaded before print (esp. on Firefox)
    function allImgsLoaded() {
      const imgs = Array.from(document.images);
      return imgs.length === 0 || imgs.every(img => img.complete);
    }
    function waitForImagesThenPrint() {
      if (allImgsLoaded()) {
        // Give layout a tick, then print
        setTimeout(() => {
          try { window.focus(); } catch {}
          try { window.print(); } catch {}
        }, 50);
      } else {
        let remaining = Array.from(document.images).filter(i => !i.complete);
        remaining.forEach(img => img.addEventListener('load', () => {
          if (allImgsLoaded()) {
            setTimeout(() => {
              try { window.focus(); } catch {}
              try { window.print(); } catch {}
            }, 50);
          }
        }));
        // Fallback timeout in case some load events never fire
        setTimeout(() => { try { window.print(); } catch {} }, 1200);
      }
    }
    // In an iframe we want to auto-print without grabbing parent focus.
    window.addEventListener('load', waitForImagesThenPrint);
  </script>
</body>
</html>`
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Public API: silently print a grid of QR cards in a hidden iframe.
 * - No window.open (avoids popup blockers + avoids focusing a new tab).
 * - Doesn’t change the current page focus.
 */
export async function printInHiddenFrameQRCards(
  qrs: QR[],
  title: string,
  sizePx = 180,
  cols = 4,
) {
  if (!qrs?.length) return

  // Pre-render QR images as data URLs (no external scripts in iframe)
  const imgs = await Promise.all(
    qrs.map((q) => QRCode.toDataURL(q.token, { width: sizePx, margin: 0 }))
  )

  const html = buildHtml({ title, imgs, qrs, sizePx, cols })

  // Create hidden iframe (sandboxed same-origin doc)
  const iframe = document.createElement("iframe")
  iframe.style.position = "fixed"
  iframe.style.right = "0"
  iframe.style.bottom = "0"
  iframe.style.width = "0"
  iframe.style.height = "0"
  iframe.style.border = "0"
  iframe.style.opacity = "0"
  // Use srcdoc so it's same-origin and we can print
  ;(iframe as any).srcdoc = html

  // Important: do NOT set focus to iframe; keep user on current page.
  document.body.appendChild(iframe)

  // Cleanup after print (most browsers fire 'afterprint' in the iframe)
  const cleanup = () => {
    try {
      iframe.parentNode?.removeChild(iframe)
    } catch {}
  }

  // Extra safety cleanup (in case 'afterprint' isn’t fired)
  setTimeout(cleanup, 10000)

  // If the browser doesn't auto-run the print on load for some reason,
  // we hook the iframe's load and trigger it ourselves.
  iframe.addEventListener("load", () => {
    try {
      const win = iframe.contentWindow
      if (!win) return
      // If our inline script didn’t call print (shouldn’t happen), force it.
      setTimeout(() => {
        try { win.focus() } catch {}
        try { win.print() } catch {}
      }, 300)
      win.addEventListener?.("afterprint", cleanup)
    } catch {
      // As a last resort, just clean up.
      cleanup()
    }
  })
}
