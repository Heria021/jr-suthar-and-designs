"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"

type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export type PaymentMethod = "cash" | "upi" | "bank" | "card" | "other"

export type RecordPaymentInput = {
  contact_id: string
  direction: "in" | "out"
  amount: number
  payment_method: PaymentMethod
  reference_number: string | null
  notes: string | null
  auto_allocate: boolean
}

export type AllocatePaymentInput = {
  payment_id: string
  sale_id: string | null
  purchase_id: string | null
  amount: number
}

function key(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function fail(error: unknown): ActionResult<never> {
  return {
    ok: false,
    error: error instanceof Error ? error.message : "Something went wrong",
  }
}

async function rpc<T>(name: string, args: Record<string, unknown>) {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc(name, args)
    if (error) throw new Error(error.message)
    revalidatePath("/payments")
    return { ok: true, data: data as T } satisfies ActionResult<T>
  } catch (error) {
    return fail(error)
  }
}

export async function recordPaymentModuleAction(payload: RecordPaymentInput) {
  if (!payload.contact_id) return { ok: false, error: "Contact is required" }
  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    return { ok: false, error: "Payment amount must be positive" }
  }

  const result = await rpc<{ id: string }>("record_payment", {
    p_idempotency_key: key("payment-record"),
    p_payload: payload,
  })

  if (result.ok) {
    revalidatePath(`/payments/${result.data.id}`)
    revalidatePath(`/contact/${payload.contact_id}`)
  }

  return result
}

export async function allocatePaymentModuleAction(payload: AllocatePaymentInput) {
  if (!payload.payment_id) return { ok: false, error: "Payment is required" }
  if (!payload.sale_id && !payload.purchase_id) {
    return { ok: false, error: "Allocation target is required" }
  }
  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    return { ok: false, error: "Allocation amount must be positive" }
  }

  const result = await rpc<{ id: string }>("allocate_payment", {
    p_idempotency_key: key("payment-allocate"),
    p_payment_id: payload.payment_id,
    p_sale_id: payload.sale_id,
    p_purchase_id: payload.purchase_id,
    p_amount: payload.amount,
  })

  if (result.ok) {
    revalidatePath(`/payments/${payload.payment_id}`)
    if (payload.sale_id) revalidatePath(`/sales/${payload.sale_id}`)
    if (payload.purchase_id) revalidatePath(`/purchases/${payload.purchase_id}`)
  }

  return result
}

export async function reversePaymentModuleAction(
  paymentId: string,
  reason: string
) {
  if (!paymentId) return { ok: false, error: "Payment is required" }
  if (!reason.trim()) return { ok: false, error: "Reversal reason is required" }

  const result = await rpc<{ id: string; reversed_payment_id: string }>(
    "reverse_payment",
    {
      p_idempotency_key: key("payment-reverse"),
      p_payment_id: paymentId,
      p_reason: reason.trim(),
    }
  )

  if (result.ok) {
    revalidatePath(`/payments/${paymentId}`)
    revalidatePath(`/payments/${result.data.id}`)
  }

  return result
}
