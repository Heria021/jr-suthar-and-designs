import {
  NewPurchaseWorkspace,
  type SupplierOption,
} from "@/components/purchases/new-purchase-workspace"
import { createClient } from "@/lib/supabase/server"

export default async function NewPurchasePage() {
  const supabase = await createClient()
  const { data: suppliers, error } = await supabase
    .from("contacts")
    .select("id,name,phone,address,contact_type")
    .eq("is_active", true)
    .in("contact_type", ["supplier", "both"])
    .order("name")
    .returns<SupplierOption[]>()

  if (error) throw new Error(error.message)

  return <NewPurchaseWorkspace suppliers={suppliers ?? []} />
}
