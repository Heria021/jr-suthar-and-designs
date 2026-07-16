import {
  NewPurchaseWorkspace,
  type PurchaseProductOption,
  type SupplierOption,
} from "@/components/purchases/new-purchase-workspace"
import { createClient } from "@/lib/supabase/server"

export default async function NewPurchasePage() {
  const supabase = await createClient()
  const [{ data: suppliers, error: suppliersError }, { data: products, error: productsError }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("id,name,phone,address,contact_type")
        .eq("is_active", true)
        .in("contact_type", ["supplier", "both"])
        .order("name")
        .returns<SupplierOption[]>(),
      supabase
        .from("products")
        .select("id,name,sku,unit_name,loose_cost_price,has_box,box_units,box_cost_price")
        .eq("is_active", true)
        .order("name")
        .returns<PurchaseProductOption[]>(),
    ])

  if (suppliersError) throw new Error(suppliersError.message)
  if (productsError) throw new Error(productsError.message)

  return <NewPurchaseWorkspace suppliers={suppliers ?? []} products={products ?? []} />
}
