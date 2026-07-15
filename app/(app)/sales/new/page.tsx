import { NewSaleWorkspace, type CustomerOption, type InvoiceProductOption } from "@/components/sales/new-sale-workspace"
import { createClient } from "@/lib/supabase/server"

export default async function NewSalePage() {
  const supabase = await createClient()
  const [{ data: contacts, error: contactsError }, { data: products, error: productsError }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("id,name,phone,address,contact_type")
        .eq("is_active", true)
        .in("contact_type", ["customer", "both"])
        .order("name")
        .returns<CustomerOption[]>(),
      supabase
        .from("products")
        .select(
          "id,name,sku,unit_name,loose_sale_price,has_box,box_units,box_sale_price,stock_on_hand"
        )
        .eq("is_active", true)
        .order("name")
        .returns<InvoiceProductOption[]>(),
    ])

  if (contactsError) throw new Error(contactsError.message)
  if (productsError) throw new Error(productsError.message)

  return (
    <NewSaleWorkspace
      customers={contacts ?? []}
      products={products ?? []}
    />
  )
}
