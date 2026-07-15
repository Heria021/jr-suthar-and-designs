import { notFound } from "next/navigation"

import {
  PurchaseDetailClient,
  type PurchaseProductOption,
} from "@/components/purchases/purchase-detail-client"
import { getPurchaseData } from "@/lib/invoice/purchases"
import { createClient } from "@/lib/supabase/server"

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  let purchase

  try {
    purchase = await getPurchaseData(id)
  } catch {
    notFound()
  }

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select(
      "id,name,sku,unit_name,loose_cost_price,has_box,box_units,box_cost_price,stock_on_hand,is_active"
    )
    .eq("is_active", true)
    .order("name")
    .returns<PurchaseProductOption[]>()

  if (productsError) throw new Error(productsError.message)

  return <PurchaseDetailClient purchase={purchase} products={products ?? []} />
}
