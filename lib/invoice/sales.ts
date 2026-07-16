import { createClient } from "@/lib/supabase/server"

export type SaleInvoiceData = {
  sale: {
    id: string
    sale_number: string
    sale_date: string
    status: string
    subtotal: number
    discount_amount: number
    total_amount: number
    notes: string | null
    finalized_at: string | null
    customer_id: string
  }
  customer: {
    name: string
    phone: string | null
    address: string | null
    notes: string | null
  }
  items: {
    id: string
    product_id: string
    product_name_snapshot: string
    entry_mode: string
    unit_name: string
    entered_quantity: number
    base_units_per_entry: number
    base_quantity: number
    price_per_entry: number
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

export async function getSaleInvoiceData(id: string): Promise<SaleInvoiceData> {
  const supabase = await createClient()
  const [
    { data: sale, error: saleError },
    { data: items, error: itemsError },
    { data: balance, error: balanceError },
  ] = await Promise.all([
    supabase.from("sales").select("*").eq("id", id).single(),
    supabase
      .from("sale_items")
      .select(
        "id,product_id,product_name_snapshot,entry_mode,entered_quantity,base_units_per_entry,base_quantity,price_per_entry,line_total"
      )
      .eq("sale_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("sale_balances")
      .select("paid_amount,due_amount,payment_status")
      .eq("sale_id", id)
      .single(),
  ])

  if (saleError) throw new Error(saleError.message)
  if (itemsError) throw new Error(itemsError.message)
  if (balanceError) throw new Error(balanceError.message)

  const [{ data: customer, error: customerError }, { data: allocations }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("name,phone,address,notes")
        .eq("id", sale.customer_id)
        .single(),
      supabase
        .from("payment_allocations")
        .select("payment_id,allocated_amount")
        .eq("sale_id", id),
    ])

  if (customerError) throw new Error(customerError.message)

  const allocationRows = allocations ?? []
  const productIds = (items ?? []).map((item) => item.product_id)
  const { data: products } = productIds.length
    ? await supabase.from("products").select("id,unit_name").in("id", productIds)
    : { data: [] }
  const productUnitMap = new Map(
    (products ?? []).map((product) => [product.id, product.unit_name])
  )
  const paymentIds = allocationRows.map((allocation) => allocation.payment_id)
  const { data: payments } = paymentIds.length
    ? await supabase
        .from("payments")
        .select("id,payment_number,created_at,payment_method,direction,status,reversed_payment_id")
        .in("id", paymentIds)
    : { data: [] }
  const paymentMap = new Map((payments ?? []).map((payment) => [payment.id, payment]))

  return {
    sale: {
      ...sale,
      subtotal: Number(sale.subtotal),
      discount_amount: Number(sale.discount_amount),
      total_amount: Number(sale.total_amount),
    },
    customer,
    items: (items ?? []).map((item) => ({
      ...item,
      unit_name: productUnitMap.get(item.product_id) ?? "unit",
      price_per_entry: Number(item.price_per_entry),
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
          amount: payment.direction === "in" ? allocatedAmount : -allocatedAmount,
        }
      })
      .filter((payment): payment is SaleInvoiceData["payments"][number] =>
        Boolean(payment)
      ),
  }
}
