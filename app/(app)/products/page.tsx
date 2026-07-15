import { ProductsWorkspace } from "@/components/products/products-workspace"
import { createClient } from "@/lib/supabase/server"

export type ProductRow = {
  id: string
  name: string
  sku: string | null
  unit_name: string
  loose_sale_price: number
  loose_cost_price: number
  has_box: boolean
  box_units: number | null
  box_sale_price: number | null
  box_cost_price: number | null
  stock_on_hand: number
  reorder_level: number
  is_active: boolean
  version: number
}

export default async function ProductsPage() {
  const supabase = await createClient()
  const { data: products, error } = await supabase
    .from("products")
    .select(
      "id,name,sku,unit_name,loose_sale_price,loose_cost_price,has_box,box_units,box_sale_price,box_cost_price,stock_on_hand,reorder_level,is_active,version"
    )
    .order("name", { ascending: true })
    .returns<ProductRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return <ProductsWorkspace initialProducts={products ?? []} />
}
