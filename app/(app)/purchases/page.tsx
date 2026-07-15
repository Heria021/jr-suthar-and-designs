import {
  PurchasesWorkspace,
  type PurchaseRow,
} from "@/components/purchases/purchases-workspace"
import { createClient } from "@/lib/supabase/server"

export default async function PurchasesPage() {
  const supabase = await createClient()
  const [{ data: purchases, error }, { data: balances }] = await Promise.all([
    supabase
      .from("purchases")
      .select(
        "id,purchase_number,supplier_invoice_number,purchase_date,status,total_amount,supplier_id,created_at"
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("purchase_balances")
      .select("purchase_id,paid_amount,due_amount,payment_status"),
  ])

  if (error) throw new Error(error.message)

  const supplierIds = [
    ...new Set((purchases ?? []).map((purchase) => purchase.supplier_id)),
  ]
  const { data: contacts } = supplierIds.length
    ? await supabase
        .from("contacts")
        .select("id,name,phone")
        .in("id", supplierIds)
    : { data: [] }

  const contactMap = new Map((contacts ?? []).map((contact) => [contact.id, contact]))
  const balanceMap = new Map(
    (balances ?? []).map((balance) => [balance.purchase_id, balance])
  )

  const rows: PurchaseRow[] = (purchases ?? []).map((purchase) => {
    const supplier = contactMap.get(purchase.supplier_id)
    const balance = balanceMap.get(purchase.id)

    return {
      id: purchase.id,
      purchase_number: purchase.purchase_number,
      supplier_invoice_number: purchase.supplier_invoice_number,
      purchase_date: purchase.purchase_date,
      status: purchase.status,
      total_amount: Number(purchase.total_amount),
      supplier_id: purchase.supplier_id,
      created_at: purchase.created_at,
      supplier_name: supplier?.name ?? null,
      supplier_phone: supplier?.phone ?? null,
      paid_amount: Number(balance?.paid_amount ?? 0),
      due_amount: Number(balance?.due_amount ?? 0),
      payment_status: balance?.payment_status ?? null,
    }
  })

  return <PurchasesWorkspace initialPurchases={rows} />
}
