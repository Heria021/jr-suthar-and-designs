import {
  PaymentsWorkspace,
  type AllocationTarget,
  type ContactOption,
  type DailyPaymentTotal,
  type PaymentRow,
} from "@/components/payments/payments-workspace"
import { createClient } from "@/lib/supabase/server"

export default async function PaymentsPage() {
  const supabase = await createClient()
  const [
    { data: payments, error: paymentsError },
    { data: contacts, error: contactsError },
    { data: paymentStatuses, error: paymentStatusesError },
    { data: saleBalances, error: saleBalancesError },
    { data: purchaseBalances, error: purchaseBalancesError },
    { data: sales, error: salesError },
    { data: purchases, error: purchasesError },
    { data: dailyTotals, error: totalsError },
  ] = await Promise.all([
    supabase
      .from("payments")
      .select(
        "id,payment_number,contact_id,direction,amount,payment_method,reference_number,notes,status,reversed_payment_id,reversal_reason,created_at"
      )
      .order("created_at", { ascending: false })
      .limit(150),
    supabase
      .from("contacts")
      .select("id,name,phone,contact_type,is_active")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("payment_allocation_status")
      .select(
        "payment_id,document_allocated_amount,opening_applied_amount,effective_allocated_amount,effective_remaining_amount"
      ),
    supabase
      .from("sale_balances")
      .select("sale_id,paid_amount,due_amount,payment_status"),
    supabase
      .from("purchase_balances")
      .select("purchase_id,paid_amount,due_amount,payment_status"),
    supabase
      .from("sales")
      .select("id,sale_number,customer_id,sale_date,total_amount,status,created_at")
      .eq("status", "finalized")
      .order("sale_date"),
    supabase
      .from("purchases")
      .select(
        "id,purchase_number,supplier_id,purchase_date,total_amount,status,created_at"
      )
      .eq("status", "finalized")
      .order("purchase_date"),
    supabase
      .from("daily_payment_totals")
      .select("payment_date,payment_method,received_amount,paid_amount,net_amount")
      .order("payment_date", { ascending: false })
      .limit(30),
  ])

  if (paymentsError) throw new Error(paymentsError.message)
  if (contactsError) throw new Error(contactsError.message)
  if (paymentStatusesError) throw new Error(paymentStatusesError.message)
  if (saleBalancesError) throw new Error(saleBalancesError.message)
  if (purchaseBalancesError) throw new Error(purchaseBalancesError.message)
  if (salesError) throw new Error(salesError.message)
  if (purchasesError) throw new Error(purchasesError.message)
  if (totalsError) throw new Error(totalsError.message)

  const contactMap = new Map((contacts ?? []).map((contact) => [contact.id, contact]))
  const paymentStatusMap = new Map(
    (paymentStatuses ?? []).map((status) => [status.payment_id, status])
  )

  const paymentRows: PaymentRow[] = (payments ?? []).map((payment) => {
    const contact = contactMap.get(payment.contact_id)
    const status = paymentStatusMap.get(payment.id)
    const documentAllocatedAmount = Number(status?.document_allocated_amount ?? 0)
    const openingAppliedAmount = Number(status?.opening_applied_amount ?? 0)
    const allocatedAmount = Number(
      status?.effective_allocated_amount ?? documentAllocatedAmount
    )
    const remainingAmount =
      payment.status === "completed"
        ? Number(
            status?.effective_remaining_amount ??
              Math.max(Number(payment.amount) - allocatedAmount, 0)
          )
        : 0

    return {
      id: payment.id,
      payment_number: payment.payment_number,
      contact_id: payment.contact_id,
      contact_name: contact?.name ?? null,
      contact_phone: contact?.phone ?? null,
      direction: payment.direction as "in" | "out",
      amount: Number(payment.amount),
      document_allocated_amount: documentAllocatedAmount,
      opening_applied_amount: openingAppliedAmount,
      allocated_amount: allocatedAmount,
      remaining_amount: remainingAmount,
      payment_method: payment.payment_method,
      reference_number: payment.reference_number,
      notes: payment.notes,
      status: payment.status,
      reversed_payment_id: payment.reversed_payment_id,
      reversal_reason: payment.reversal_reason,
      created_at: payment.created_at,
    }
  })

  const saleBalanceMap = new Map((saleBalances ?? []).map((row) => [row.sale_id, row]))
  const purchaseBalanceMap = new Map(
    (purchaseBalances ?? []).map((row) => [row.purchase_id, row])
  )

  const saleTargets: AllocationTarget[] = (sales ?? [])
    .map((sale) => {
      const balance = saleBalanceMap.get(sale.id)
      return {
        id: sale.id,
        kind: "sale" as const,
        number: sale.sale_number,
        contact_id: sale.customer_id,
        contact_name: contactMap.get(sale.customer_id)?.name ?? "Customer",
        date: sale.sale_date,
        total_amount: Number(sale.total_amount),
        due_amount: Number(balance?.due_amount ?? 0),
      }
    })
    .filter((target) => target.due_amount > 0)

  const purchaseTargets: AllocationTarget[] = (purchases ?? [])
    .map((purchase) => {
      const balance = purchaseBalanceMap.get(purchase.id)
      return {
        id: purchase.id,
        kind: "purchase" as const,
        number: purchase.purchase_number,
        contact_id: purchase.supplier_id,
        contact_name: contactMap.get(purchase.supplier_id)?.name ?? "Supplier",
        date: purchase.purchase_date,
        total_amount: Number(purchase.total_amount),
        due_amount: Number(balance?.due_amount ?? 0),
      }
    })
    .filter((target) => target.due_amount > 0)

  return (
    <PaymentsWorkspace
      payments={paymentRows}
      contacts={(contacts ?? []) as ContactOption[]}
      targets={[...saleTargets, ...purchaseTargets]}
      dailyTotals={(dailyTotals ?? []).map((total) => ({
        payment_date: total.payment_date,
        payment_method: total.payment_method,
        received_amount: Number(total.received_amount),
        paid_amount: Number(total.paid_amount),
        net_amount: Number(total.net_amount),
      })) satisfies DailyPaymentTotal[]}
    />
  )
}
