import { SalesWorkspace, type SaleRow } from "@/components/sales/sales-workspace"
import { createClient } from "@/lib/supabase/server"

export default async function SalesPage() {
  const supabase = await createClient()
  const [{ data: sales, error }, { data: balances }] = await Promise.all([
    supabase
      .from("sales")
      .select("id,sale_number,sale_date,status,total_amount,customer_id,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("sale_balances").select("sale_id,paid_amount,due_amount,payment_status"),
  ])

  if (error) throw new Error(error.message)

  const customerIds = [...new Set((sales ?? []).map((sale) => sale.customer_id))]
  const { data: contacts } = customerIds.length
    ? await supabase.from("contacts").select("id,name,phone").in("id", customerIds)
    : { data: [] }

  const contactMap = new Map((contacts ?? []).map((c) => [c.id, c]))
  const balanceMap = new Map((balances ?? []).map((b) => [b.sale_id, b]))

  const rows: SaleRow[] = (sales ?? []).map((sale) => {
    const customer = contactMap.get(sale.customer_id)
    const balance = balanceMap.get(sale.id)
    return {
      id: sale.id,
      sale_number: sale.sale_number,
      sale_date: sale.sale_date,
      status: sale.status,
      total_amount: Number(sale.total_amount),
      customer_id: sale.customer_id,
      created_at: sale.created_at,
      customer_name: customer?.name ?? null,
      customer_phone: customer?.phone ?? null,
      paid_amount: Number(balance?.paid_amount ?? 0),
      due_amount: Number(balance?.due_amount ?? 0),
      payment_status: balance?.payment_status ?? null,
    }
  })

  return <SalesWorkspace initialSales={rows} />
}
