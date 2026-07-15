import { notFound } from "next/navigation"

import {
  PaymentDetailClient,
  type PaymentAllocationRow,
  type PaymentDetail,
} from "@/components/payments/payment-detail-client"
import { createClient } from "@/lib/supabase/server"

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: payment, error } = await supabase
    .from("payments")
    .select(
      "id,payment_number,contact_id,direction,amount,payment_method,payment_date,reference_number,notes,status,reversed_payment_id,reversal_reason,created_at"
    )
    .eq("id", id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!payment) notFound()

  const [
    { data: contact, error: contactError },
    { data: allocations, error: allocationsError },
    { data: reversal, error: reversalError },
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("id,name,phone,contact_type")
      .eq("id", payment.contact_id)
      .single(),
    supabase
      .from("payment_allocations")
      .select("id,payment_id,sale_id,purchase_id,allocated_amount,created_at")
      .eq("payment_id", id)
      .order("created_at"),
    supabase
      .from("payments")
      .select("id,payment_number")
      .eq("reversed_payment_id", id)
      .maybeSingle(),
  ])

  if (contactError) throw new Error(contactError.message)
  if (allocationsError) throw new Error(allocationsError.message)
  if (reversalError) throw new Error(reversalError.message)

  const saleIds = (allocations ?? [])
    .map((allocation) => allocation.sale_id)
    .filter((value): value is string => Boolean(value))
  const purchaseIds = (allocations ?? [])
    .map((allocation) => allocation.purchase_id)
    .filter((value): value is string => Boolean(value))

  const [{ data: sales }, { data: purchases }] = await Promise.all([
    saleIds.length
      ? supabase
          .from("sales")
          .select("id,sale_number,sale_date,total_amount")
          .in("id", saleIds)
      : { data: [] },
    purchaseIds.length
      ? supabase
          .from("purchases")
          .select("id,purchase_number,purchase_date,total_amount")
          .in("id", purchaseIds)
      : { data: [] },
  ])

  const saleMap = new Map((sales ?? []).map((sale) => [sale.id, sale]))
  const purchaseMap = new Map(
    (purchases ?? []).map((purchase) => [purchase.id, purchase])
  )

  const detail: PaymentDetail = {
    id: payment.id,
    payment_number: payment.payment_number,
    contact_id: payment.contact_id,
    contact_name: contact.name,
    contact_phone: contact.phone,
    contact_type: contact.contact_type,
    direction: payment.direction as "in" | "out",
    amount: Number(payment.amount),
    payment_method: payment.payment_method,
    payment_date: payment.payment_date,
    reference_number: payment.reference_number,
    notes: payment.notes,
    status: payment.status,
    reversed_payment_id: payment.reversed_payment_id,
    reversal_reason: payment.reversal_reason,
    created_at: payment.created_at,
    reversed_by_payment_id: reversal?.id ?? null,
    reversed_by_payment_number: reversal?.payment_number ?? null,
  }

  const allocationRows: PaymentAllocationRow[] = (allocations ?? []).map(
    (allocation) => {
      const sale = allocation.sale_id ? saleMap.get(allocation.sale_id) : null
      const purchase = allocation.purchase_id
        ? purchaseMap.get(allocation.purchase_id)
        : null

      return {
        id: allocation.id,
        kind: sale ? "sale" : "purchase",
        document_id: sale?.id ?? purchase?.id ?? "",
        document_number: sale?.sale_number ?? purchase?.purchase_number ?? "-",
        document_date: sale?.sale_date ?? purchase?.purchase_date ?? "",
        document_total: Number(sale?.total_amount ?? purchase?.total_amount ?? 0),
        allocated_amount: Number(allocation.allocated_amount),
        created_at: allocation.created_at,
      }
    }
  )

  return <PaymentDetailClient payment={detail} allocations={allocationRows} />
}
