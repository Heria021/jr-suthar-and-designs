import { notFound } from "next/navigation"

import { type ProductRow } from "@/app/(app)/products/page"
import { type StockMovementRow } from "@/app/(app)/products/actions"
import { ProductDetailWorkspace } from "@/components/products/product-detail-workspace"
import { createClient } from "@/lib/supabase/server"

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: product, error: productError }, { data: movements, error: movementsError }] =
    await Promise.all([
      supabase
        .from("products")
        .select(
          "id,name,sku,unit_name,loose_sale_price,loose_cost_price,has_box,box_units,box_sale_price,box_cost_price,stock_on_hand,reorder_level,is_active,version"
        )
        .eq("id", id)
        .maybeSingle<ProductRow>(),
      supabase
        .from("stock_movements")
        .select(
          "id,movement_type,quantity_delta,reason,stock_before,stock_after,occurred_at"
        )
        .eq("product_id", id)
        .order("occurred_at", { ascending: false })
        .limit(50)
        .returns<StockMovementRow[]>(),
    ])

  if (productError) {
    throw new Error(productError.message)
  }
  if (movementsError) {
    throw new Error(movementsError.message)
  }
  if (!product) {
    notFound()
  }

  return (
    <ProductDetailWorkspace
      key={`${product.id}-${product.version}-${product.stock_on_hand}`}
      product={product}
      movements={movements ?? []}
    />
  )
}
