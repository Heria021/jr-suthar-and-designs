import { notFound } from "next/navigation"

import { SaleDetailClient, type ProductOption } from "@/components/sales/sale-detail-client"
import { getSaleInvoiceData } from "@/lib/invoice/sales"
import { createClient } from "@/lib/supabase/server"

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  let invoice

  try {
    invoice = await getSaleInvoiceData(id)
  } catch {
    notFound()
  }

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select(
      "id,name,sku,unit_name,loose_sale_price,has_box,box_units,box_sale_price,stock_on_hand,is_active"
    )
    .eq("is_active", true)
    .order("name")
    .returns<ProductOption[]>()

  if (productsError) throw new Error(productsError.message)

  return <SaleDetailClient invoice={invoice} products={products ?? []} />
}
