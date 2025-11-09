import jsPDF from "jspdf"
import QRCode from "qrcode"

// px → mm helper (assuming 96dpi)
const pxToMm = (px: number) => (px / 96) * 25.4

type PdfOpts = {
  qrs: { subjectId: string; token: string }[]
  title?: string
  cols?: number
  qrPx?: number         // will be converted to mm
  cellPaddingMm?: number
  filename?: string
}

async function generatePdfLabels({
  qrs,
  title = "QR Labels",
  cols = 4,
  qrPx = 160,
  cellPaddingMm = 3,
  filename = "labels.pdf",
}: PdfOpts) {
  const doc = new jsPDF("p", "mm", "a4")
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  const margin = 10 // mm
  const gap = 3     // mm between cells
  const colW = (pageW - margin * 2 - gap * (cols - 1)) / cols
  const qrMm = pxToMm(qrPx)

  const headerH = 7   // subjectId line
  const footerH = 10  // token line(s)
  const cellH = cellPaddingMm + headerH + qrMm + footerH + cellPaddingMm

  // Optional page heading
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.text(title, margin, 12)
  let x = margin, y = 16 // start below title

  // Pre-generate QR images as data URLs (fast + deterministic)
  const imgs = await Promise.all(
    qrs.map((q) => QRCode.toDataURL(q.token, { width: qrPx, margin: 0 }))
  )

  doc.setFont("helvetica", "normal")

  qrs.forEach((q, i) => {
    const col = i % cols
    if (i && col === 0) {
      // new row
      y += cellH + gap
      x = margin
    } else if (i) {
      x += colW + gap
    }

    // New page if needed
    if (y + cellH > pageH - margin) {
      doc.addPage()
      // page title on each page (optional)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(14)
      doc.text(title, margin, 12)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(11)
      x = margin
      y = 16
    }

    // Cell boundary (nice for cutting)
    doc.roundedRect(x, y, colW, cellH, 2, 2)

    // Subject ID (top)
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    const idY = y + cellPaddingMm + 5
    // clamp/wrap subjectId to cell width
    const idLines = doc.splitTextToSize(q.subjectId, colW - cellPaddingMm * 2)
    doc.text(idLines, x + cellPaddingMm, idY)

    // QR (centered)
    const imgX = x + (colW - qrMm) / 2
    const imgY = y + cellPaddingMm + headerH
    doc.addImage(imgs[i], "PNG", imgX, imgY, qrMm, qrMm)

    // Token (bottom, monospace feel)
    doc.setFont("courier", "normal")
    doc.setFontSize(9)
    const tokenTop = imgY + qrMm + 3
    const tokenBoxW = colW - cellPaddingMm * 2
    const tokenLines = doc.splitTextToSize(q.token, tokenBoxW)
    doc.text(tokenLines, x + cellPaddingMm, tokenTop)

    // reset font for next cell
    doc.setFont("helvetica", "normal")
  })

  doc.save(filename)
}
