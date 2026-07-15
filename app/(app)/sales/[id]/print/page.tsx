import { notFound } from "next/navigation"

import { InvoicePrint } from "@/components/sales/invoice-print"
import { getSaleInvoiceData } from "@/lib/invoice/sales"

export default async function SalePrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const invoice = await getSaleInvoiceData(id).catch(() => null)

  if (!invoice) {
    notFound()
  }

  return <InvoicePrint invoice={invoice} />
}
