import { readFile } from "node:fs/promises"
import path from "node:path"

import { NextResponse } from "next/server"
import PDFDocument from "pdfkit/js/pdfkit.standalone.js"

import { businessProfile } from "@/lib/invoice/business-profile"
import { getSaleInvoiceData } from "@/lib/invoice/sales"

export const runtime = "nodejs"

function money(value: number) {
  return `Rs. ${Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function textRight(doc: PDFKit.PDFDocument, text: string, x: number, y: number, width: number) {
  doc.text(text, x, y, { width, align: "right" })
}

async function readPublicJpegDataUri(publicPath: string) {
  const assetPath = publicPath.replace(/^\//, "")
  const image = await readFile(path.join(process.cwd(), "public", assetPath)).catch(
    () => null
  )

  if (!image) {
    return null
  }

  return `data:image/jpeg;base64,${image.toString("base64")}`
}

function drawItemsHeader(doc: PDFKit.PDFDocument, y: number) {
  doc.save()
  doc.moveTo(28, y - 8).lineTo(566, y - 8).strokeColor("#111111").stroke()
  doc.moveTo(28, y + 18).lineTo(566, y + 18).strokeColor("#111111").stroke()
  doc.fillColor("#444444").font("Helvetica").fontSize(8)
  doc.text("#", 38, y)
  doc.text("PRODUCT", 68, y)
  textRight(doc, "MODE", 310, y, 50)
  textRight(doc, "QTY", 370, y, 45)
  textRight(doc, "RATE", 425, y, 60)
  textRight(doc, "AMOUNT", 495, y, 60)
  doc.restore()
  return y + 28
}

function ensurePageRoom(doc: PDFKit.PDFDocument, y: number, height: number) {
  if (y + height <= 610) {
    return y
  }

  doc.addPage()
  return drawItemsHeader(doc, 52)
}

function drawFooter({
  doc,
  footerY,
  qrImage,
  dueAmount,
}: {
  doc: PDFKit.PDFDocument
  footerY: number
  qrImage: string | null
  dueAmount: number
}) {
  const left = 28
  const right = 566
  const width = right - left

  doc.roundedRect(left, footerY, width, 54, 4).strokeColor("#111111").stroke()
  doc.font("Helvetica").fontSize(8).fillColor("#444444")
  doc.text("TERMS & CONDITIONS", left + 14, footerY + 11, {
    characterSpacing: 0.8,
  })
  doc.font("Helvetica").fontSize(8.5).fillColor("#111111")
  doc.text("- Goods once sold will not be taken back or exchanged without prior approval.", left + 18, footerY + 27)
  doc.text("- Payment for Udhaar bills is due within 30 days of invoice date.", left + 18, footerY + 40)

  const paymentY = footerY + 70
  doc.moveTo(left, paymentY - 12).lineTo(right, paymentY - 12).strokeColor("#111111").stroke()

  doc.font("Helvetica").fontSize(8).fillColor("#444444").text("BANK DETAILS", left, paymentY, {
    characterSpacing: 0.8,
  })
  doc.font("Helvetica").fontSize(8.8).fillColor("#111111")
  doc.text(`Bank Name: ${businessProfile.bank.name}`, left, paymentY + 17)
  doc.text(`A/C Name: ${businessProfile.bank.accountName}`, left, paymentY + 32)
  doc.text(`Account No: ${businessProfile.bank.accountNumber}`, left, paymentY + 47)
  doc.text(`IFSC Code: ${businessProfile.bank.ifsc}`, left, paymentY + 62)

  const qrSize = 74
  const qrX = right - qrSize
  const qrTextX = qrX - 150
  doc.font("Helvetica").fontSize(8).fillColor("#444444").text("UPI PAYMENT", qrTextX, paymentY, {
    width: 132,
    align: "right",
    characterSpacing: 0.8,
  })
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111")
  doc.text(money(dueAmount), qrTextX, paymentY + 18, {
    width: 132,
    align: "right",
  })
  doc.font("Helvetica").fontSize(8.5).fillColor("#555555")
  doc.text("Scan QR to pay Narayani Traders", qrTextX, paymentY + 38, {
    width: 132,
    align: "right",
    lineGap: 1,
  })
  if (qrImage) {
    doc.image(qrImage, qrX, paymentY + 2, { width: qrSize })
  }

  doc.moveTo(left, footerY + 154).lineTo(right, footerY + 154).dash(3, { space: 3 }).strokeColor("#111111").stroke().undash()
  doc.font("Helvetica-Oblique").fontSize(9).fillColor("#555555")
  doc.text("Thank you for your business!", left, footerY + 164, {
    width,
    align: "center",
  })
  doc.fillColor("#111111")
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const invoice = await getSaleInvoiceData(id)
  const qrImage = await readPublicJpegDataUri(businessProfile.payment.qrPublicPath)
  const doc = new PDFDocument({ size: "A4", margin: 28 })
  const chunks: Buffer[] = []

  doc.on("data", (chunk: Buffer) => chunks.push(chunk))
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)))
  })

  const invoiceDate = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(new Date(invoice.sale.sale_date))

  doc.font("Helvetica-Bold").fontSize(20).text(businessProfile.name, 28, 32)
  doc.fontSize(8).text(businessProfile.tagline.toUpperCase(), 28, 58, {
    characterSpacing: 1.8,
  })
  doc.font("Helvetica").fontSize(10).text(`Phone: ${businessProfile.phone}`, 28, 76)
  doc.text(`Email: ${businessProfile.email}`, 28, 92)
  doc.font("Courier-Bold").fontSize(9).text(`GSTIN: ${businessProfile.gstin}`, 28, 108)

  doc.font("Helvetica-Bold").fontSize(9)
  textRight(doc, "ESTIMATE INVOICE", 300, 34, 260)
  doc.fontSize(21)
  textRight(doc, invoice.sale.sale_number, 300, 52, 260)
  doc.font("Helvetica").fontSize(11)
  textRight(doc, `Date: ${invoiceDate}`, 300, 84, 260)
  textRight(
    doc,
    `Status: ${invoice.balance.payment_status.replaceAll("_", " ")}`,
    300,
    104,
    260
  )

  doc.lineWidth(1.5).moveTo(28, 132).lineTo(566, 132).stroke().lineWidth(1)
  doc.font("Helvetica-Bold").fontSize(8).text("FROM", 28, 148, { characterSpacing: 1.5 })
  doc.fontSize(11).text(businessProfile.name, 28, 168)
  doc.font("Helvetica").fontSize(10)
  businessProfile.addressLines.forEach((line, index) => {
    doc.text(line, 28, 188 + index * 16)
  })

  doc.font("Helvetica-Bold").fontSize(8).text("BILL TO", 300, 148, { characterSpacing: 1.5 })
  doc.fontSize(11).text(invoice.customer.name, 300, 168)
  doc.font("Helvetica")
  let billToY = 188
  if (invoice.customer.address) {
    const addressHeight = doc.heightOfString(invoice.customer.address, { width: 240 })
    doc.text(invoice.customer.address, 300, billToY, { width: 240 })
    billToY += Math.max(16, addressHeight + 4)
  }
  doc.text(`Phone: ${invoice.customer.phone ?? "-"}`, 300, billToY)
  if (invoice.customer.notes) {
    doc.fillColor("#555555").text(`Notes: ${invoice.customer.notes}`, 300, billToY + 18, {
      width: 240,
    })
    doc.fillColor("#000000")
  }
  doc.moveTo(28, 238).lineTo(566, 238).stroke()

  let y = drawItemsHeader(doc, 262)
  invoice.items.forEach((item, index) => {
    const descriptionHeight = doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .heightOfString(item.product_name_snapshot, { width: 230 })
    const rowHeight = Math.max(28, descriptionHeight + 14)
    y = ensurePageRoom(doc, y, rowHeight)
    doc.font("Helvetica").fontSize(9)
    doc.text(String(index + 1).padStart(2, "0"), 38, y + 2)
    doc.font("Helvetica-Bold").text(item.product_name_snapshot, 68, y + 2, { width: 230 })
    doc.font("Helvetica").text(item.entry_mode, 310, y + 2, {
      width: 50,
      align: "right",
    })
    textRight(doc, String(item.entered_quantity), 370, y + 2, 45)
    textRight(doc, money(item.price_per_entry), 420, y + 2, 65)
    textRight(doc, money(item.line_total), 490, y + 2, 66)
    y += rowHeight
    doc.moveTo(28, y - 4).lineTo(566, y - 4).strokeColor("#dddddd").stroke().strokeColor("#000000")
  })

  if (y > 500) {
    doc.addPage()
    y = 54
  } else {
    y += 18
  }

  if (invoice.sale.notes) {
    doc.font("Helvetica").fontSize(8).fillColor("#444444").text("BILL NOTES", 28, y, {
      characterSpacing: 0.8,
    })
    doc.font("Helvetica").fontSize(9).fillColor("#111111").text(invoice.sale.notes, 28, y + 16, {
      width: 260,
    })
  }

  const sx = 330
  doc.font("Helvetica").fontSize(10)
  doc.text("Subtotal", sx, y)
  textRight(doc, money(invoice.sale.subtotal), 450, y, 110)
  y += 24
  doc.text("Discount", sx, y)
  textRight(doc, `- ${money(invoice.sale.discount_amount)}`, 450, y, 110)
  y += 22
  doc.moveTo(sx, y).lineTo(566, y).stroke()
  y += 14
  doc.font("Helvetica-Bold").fontSize(13).text("Grand Total", sx, y)
  textRight(doc, money(invoice.sale.total_amount), 450, y, 110)
  y += 24
  doc.moveTo(sx, y).lineTo(566, y).lineWidth(1.5).stroke().lineWidth(1)
  y += 14
  doc.font("Helvetica").fontSize(10).text("Amount Paid", sx, y)
  textRight(doc, `- ${money(invoice.balance.paid_amount)}`, 450, y, 110)
  y += 26
  doc.font("Helvetica-Bold").text("Balance Due", sx, y)
  textRight(doc, money(invoice.balance.due_amount), 450, y, 110)

  const footerY = 636
  if (y + 28 > footerY) {
    doc.addPage()
    drawFooter({
      doc,
      footerY,
      qrImage,
      dueAmount: invoice.balance.due_amount,
    })
  } else {
    drawFooter({
      doc,
      footerY,
      qrImage,
      dueAmount: invoice.balance.due_amount,
    })
  }

  doc.end()
  const pdf = await done

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.sale.sale_number}.pdf"`,
    },
  })
}
