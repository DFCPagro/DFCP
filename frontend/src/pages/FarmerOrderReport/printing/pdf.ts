import jsPDF from "jspdf"
import QRCode from "qrcode"

const pxToMm = (px: number) => (px / 96) * 25.4

export type PdfMeta = { itemName?: string; date?: string; shift?: string; deliverer?: string }

export type PdfBuildOptions = {
  qrs: { subjectId: string; token: string }[]
  title?: string
  fileBase?: string
  cols?: number
  qrPx?: number
  marginMm?: number
  gapMm?: number
  cellPaddingMm?: number
  rows?: number | "auto"
  meta?: PdfMeta | null
  openMode?: "tab" | "download"
}

export async function generatePdfLabels({
  qrs,
  title = "QR Labels",
  fileBase = "labels",
  cols = 4,
  qrPx = 160,
  marginMm = 10,
  gapMm = 4,
  cellPaddingMm = 4,
  rows = "auto",
  meta = null,
  openMode = "tab",
}: PdfBuildOptions) {
  const doc = new jsPDF("p", "mm", "a4")
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  // Title
  const titleY = 12
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text(title, marginMm, titleY)

  const contentTop = titleY + 6
  const usableW = pageW - marginMm * 2
  const usableH = pageH - contentTop - marginMm

  const colW = (usableW - gapMm * (cols - 1)) / cols
  const qrMm = pxToMm(qrPx)

  const headerH = 7
  const metaH = meta ? 6 : 0
  const footerH = 9
  const cardH = cellPaddingMm + headerH + metaH + qrMm + footerH + cellPaddingMm

  const rowsPerPage =
    rows === "auto" ? Math.max(1, Math.floor((usableH + gapMm) / (cardH + gapMm))) : rows

  const imgs = await Promise.all(
    qrs.map((q) => QRCode.toDataURL(q.token, { width: qrPx, margin: 0 }))
  )

  function drawCard(iOnPage: number, q: { subjectId: string; token: string }, imgUrl: string) {
    const col = iOnPage % cols
    const row = Math.floor(iOnPage / cols)

    const x = marginMm + col * (colW + gapMm)
    const y = contentTop + row * (cardH + gapMm)

    doc.roundedRect(x, y, colW, cardH, 2, 2)

    // subject id
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    const idLines = doc.splitTextToSize(q.subjectId, colW - cellPaddingMm * 2)
    doc.text(idLines, x + cellPaddingMm, y + cellPaddingMm + 4)

    // meta
    let afterHeaderY = y + cellPaddingMm + headerH
    if (meta) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      const metaBits = [
        meta.itemName,
        meta.date,
        meta.shift ? `Shift: ${meta.shift}` : undefined,
        meta.deliverer ? `By: ${meta.deliverer}` : undefined,
      ].filter(Boolean)
      const metaText = metaBits.join(" · ")
      const metaLines = doc.splitTextToSize(metaText, colW - cellPaddingMm * 2)
      doc.text(metaLines, x + cellPaddingMm, afterHeaderY + 3)
      afterHeaderY += metaH
    }

    // QR
    const qrX = x + (colW - qrMm) / 2
    const qrY = afterHeaderY + 2
    doc.addImage(imgUrl, "PNG", qrX, qrY, qrMm, qrMm)

    // token
    doc.setFont("courier", "normal")
    doc.setFontSize(9)
    const tokenTop = qrY + qrMm + 3
    const tokenBoxW = colW - cellPaddingMm * 2
    const tokenLines = doc.splitTextToSize(q.token, tokenBoxW)
    doc.text(tokenLines, x + cellPaddingMm, tokenTop)
  }

  const perPage = cols * rowsPerPage
  qrs.forEach((q, i) => {
    const pageIndex = Math.floor(i / perPage)
    const indexOnPage = i % perPage

    if (i > 0 && indexOnPage === 0) {
      doc.addPage()
      doc.setFont("helvetica", "bold")
      doc.setFontSize(16)
      doc.text(title, marginMm, titleY)
    }

    drawCard(indexOnPage, q, imgs[i])
  })

  if (openMode === "download") {
    doc.save(`${fileBase}.pdf`)
    return
  }

  const blob = doc.output("blob")
  const url = URL.createObjectURL(blob)
  const win = window.open(url, "_blank")
  if (!win) {
    const a = document.createElement("a")
    a.href = url
    a.download = `${fileBase}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } else {
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
}
