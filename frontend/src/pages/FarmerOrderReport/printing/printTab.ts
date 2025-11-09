// printing/printTab.ts
import QRCode from "qrcode"

export async function openPrintTab(
  qrs: { subjectId: string; token: string }[],
  title: string,
  sizePx = 180,
  cols = 4,
) {
  // Pre-render QR images so the new tab is fully static
  const imgs = await Promise.all(
    qrs.map((q) => QRCode.toDataURL(q.token, { width: sizePx, margin: 0 }))
  )

  const cardsHtml = qrs
    .map((q, i) => {
      const img = imgs[i]
      return `
      <div class="card">
        <div class="id">${q.subjectId}</div>
        <div class="qr"><img src="${img}" width="${sizePx}" height="${sizePx}" /></div>
        <div class="token">${q.token}</div>
      </div>`
    })
    .join("")

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    *{box-sizing:border-box}
    body{font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:16px;margin:0}
    h2{margin:0 0 16px}
    .toolbar{position:sticky;top:0;background:#fff;padding:8px 0;margin-bottom:8px;border-bottom:1px solid #eee;display:flex;gap:8px}
    .btn{padding:8px 12px;border-radius:10px;border:1px solid #444;background:#111;color:#fff;cursor:pointer}
    .grid{display:grid;grid-template-columns:repeat(${cols}, minmax(0,1fr));gap:12px}
    .card{display:flex;flex-direction:column;gap:6px;padding:12px 16px;border:1px solid #e5e7eb;border-radius:12px;break-inside:avoid}
    .id{font-weight:600;font-size:12px;word-break:break-word}
    .qr{display:grid;place-items:center}
    .qr img{display:block}
    .token{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:#374151;word-break:break-all}
    @media print{
      .toolbar{display:none}
      body{padding:0}
      .grid{gap:8px}
      .card{page-break-inside:avoid;break-inside:avoid}
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn" onclick="window.print()">Print</button>
  </div>
  <h2>${title}</h2>
  <div class="grid">${cardsHtml}</div>

  <script>
    // Best-effort: when the tab finishes loading, blur itself quickly.
    // This helps some Chromium builds keep the opener focused.
    window.addEventListener('load', () => {
      setTimeout(() => { try { window.blur() } catch(e) {} }, 0)
    })
  </script>
</body>
</html>`

  // IMPORTANT: open synchronously from the click handler, without 'noopener'/'noreferrer'
  const tab = window.open("", "_blank")
  if (!tab) {
    // Popup blocked — nothing else we can do without downloads (which you don't want)
    console.warn("Popup blocked by the browser.")
    return
  }

  // Write the HTML into the new tab (so it's not empty)
  try {
    tab.document.open()
    tab.document.write(html)
    tab.document.close()
  } catch (e) {
    console.error("Failed writing to new tab:", e)
  }

  // Immediately try to keep focus on the current window
  // (Not guaranteed on all browsers, but works in many Chromium builds)
  setTimeout(() => {
    try { tab.blur() } catch {}
    try { window.focus() } catch {}
    try { (window.opener as any)?.focus?.() } catch {}
  }, 0)
}
