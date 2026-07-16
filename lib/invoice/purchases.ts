import { createClient } from "@/lib/supabase/server"

export type PurchaseData = {
  purchase: {
    id: string
    purchase_number: string
    supplier_invoice_number: string | null
    purchase_date: string
    status: string
    subtotal: number
    discount_amount: number
    additional_cost: number
    total_amount: number
    notes: string | null
    finalized_at: string | null
    supplier_id: string
    cancellation_reason: string | null
  }
  supplier: {
    name: string
    phone: string | null
    notes: string | null
  }
  items: {
    id: string
    product_name_snapshot: string
    entry_mode: string
    entered_quantity: number
    base_units_per_entry: number
    base_quantity: number
    cost_per_entry: number
    line_total: number
  }[]
  balance: {
    paid_amount: number
    due_amount: number
    payment_status: string
  }
  payments: {
    payment_number: string
    payment_date: string
    payment_method: string
    direction: "in" | "out"
    status: string
    allocated_amount: number
    amount: number
  }[]
}

export async function getPurchaseData(id: string): Promise<PurchaseData> {
  const supabase = await createClient()
  const [
    { data: purchase, error: purchaseError },
    { data: items, error: itemsError },
    { data: balance, error: balanceError },
  ] = await Promise.all([
    supabase.from("purchases").select("*").eq("id", id).single(),
    supabase
      .from("purchase_items")
      .select(
        "id,product_name_snapshot,entry_mode,entered_quantity,base_units_per_entry,base_quantity,cost_per_entry,line_total"
      )
      .eq("purchase_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("purchase_balances")
      .select("paid_amount,due_amount,payment_status")
      .eq("purchase_id", id)
      .single(),
  ])

  if (purchaseError) throw new Error(purchaseError.message)
  if (itemsError) throw new Error(itemsError.message)
  if (balanceError) throw new Error(balanceError.message)

  const [{ data: supplier, error: supplierError }, { data: allocations }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("name,phone,notes")
        .eq("id", purchase.supplier_id)
        .single(),
      supabase
        .from("payment_allocations")
        .select("payment_id,allocated_amount")
        .eq("purchase_id", id),
    ])

  if (supplierError) throw new Error(supplierError.message)

  const allocationRows = allocations ?? []
  const paymentIds = allocationRows.map(
    (allocation) => allocation.payment_id
  )
  const { data: payments } = paymentIds.length
    ? await supabase
        .from("payments")
        .select("id,payment_number,created_at,payment_method,direction,status,reversed_payment_id")
        .in("id", paymentIds)
    : { data: [] }
  const paymentMap = new Map((payments ?? []).map((payment) => [payment.id, payment]))

  return {
    purchase: {
      ...purchase,
      subtotal: Number(purchase.subtotal),
      discount_amount: Number(purchase.discount_amount),
      additional_cost: Number(purchase.additional_cost),
      total_amount: Number(purchase.total_amount),
    },
    supplier,
    items: (items ?? []).map((item) => ({
      ...item,
      cost_per_entry: Number(item.cost_per_entry),
      line_total: Number(item.line_total),
    })),
    balance: {
      paid_amount: Number(balance.paid_amount),
      due_amount: Number(balance.due_amount),
      payment_status: balance.payment_status,
    },
    payments: allocationRows
      .map((allocation) => {
        const payment = paymentMap.get(allocation.payment_id)
        if (!payment) return null
        const allocatedAmount = Number(allocation.allocated_amount)
        return {
          payment_number: payment.payment_number,
          payment_date: payment.created_at,
          payment_method: payment.payment_method,
          direction: payment.direction as "in" | "out",
          status: payment.status,
          allocated_amount: allocatedAmount,
          amount: payment.direction === "out" ? allocatedAmount : -allocatedAmount,
        }
      })
      .filter((payment): payment is PurchaseData["payments"][number] =>
        Boolean(payment)
      ),
  }
}
