"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"

type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string }

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
    revalidatePath("/purchases")
    return { ok: true, data: data as T } satisfies ActionResult<T>
  } catch (error) {
    return fail(error)
  }
}

export async function createDraftPurchaseFromPayloadAction(payload: {
  supplier_id: string
  purchase_date: string
  supplier_invoice_number: string | null
  notes: string | null
}) {
  const result = await rpc<{ id: string }>("create_draft_purchase", {
    p_idempotency_key: key("purchase-draft"),
    p_payload: payload,
  })

  if (result.ok) {
    revalidatePath(`/purchases/${result.data.id}`)
  }

  return result
}

export async function addPurchaseItemAction(formData: FormData) {
  const purchaseId = String(formData.get("purchase_id"))
  const result = await rpc<{ id: string }>("add_purchase_item", {
    p_idempotency_key: key("purchase-item-add"),
    p_purchase_id: purchaseId,
    p_product_id: String(formData.get("product_id")),
    p_entry_mode: String(formData.get("entry_mode")),
    p_quantity: Number(formData.get("quantity")),
    p_cost_per_entry:
      String(formData.get("cost_per_entry") ?? "").trim() === ""
        ? null
        : Number(formData.get("cost_per_entry")),
  })
  if (result.ok) revalidatePath(`/purchases/${purchaseId}`)
  return result
}

export async function updatePurchaseItemAction(formData: FormData) {
  const purchaseId = String(formData.get("purchase_id"))
  const result = await rpc<{ id: string }>("update_purchase_item", {
    p_idempotency_key: key("purchase-item-update"),
    p_purchase_item_id: String(formData.get("purchase_item_id")),
    p_entry_mode: String(formData.get("entry_mode")),
    p_quantity: Number(formData.get("quantity")),
    p_cost_per_entry:
      String(formData.get("cost_per_entry") ?? "").trim() === ""
        ? null
        : Number(formData.get("cost_per_entry")),
  })
  if (result.ok && purchaseId) revalidatePath(`/purchases/${purchaseId}`)
  return result
}

export async function removePurchaseItemAction(formData: FormData) {
  const purchaseId = String(formData.get("purchase_id"))
  const result = await rpc<{ id: string }>("remove_purchase_item", {
    p_idempotency_key: key("purchase-item-remove"),
    p_purchase_item_id: String(formData.get("purchase_item_id")),
  })
  if (result.ok && purchaseId) revalidatePath(`/purchases/${purchaseId}`)
  return result
}

export async function finalizePurchaseAction(formData: FormData) {
  const purchaseId = String(formData.get("purchase_id"))
  const paymentAmount = Number(formData.get("payment_amount") ?? 0)

  const result = await rpc<{ id: string; total_amount: number }>("finalize_purchase", {
    p_idempotency_key: key("purchase-finalize"),
    p_purchase_id: purchaseId,
    p_discount_amount: Number(formData.get("discount_amount") ?? 0),
    p_additional_cost: Number(formData.get("additional_cost") ?? 0),
    p_update_product_cost: String(formData.get("update_product_cost")) === "true",
    p_initial_payment:
      Number.isFinite(paymentAmount) && paymentAmount > 0
        ? {
            amount: paymentAmount,
            payment_method: String(formData.get("payment_method") ?? "cash"),
            payment_date: String(formData.get("payment_date") ?? ""),
            reference_number:
              String(formData.get("reference_number") ?? "").trim() || null,
            notes: "Initial purchase payment",
        }
        : null,
  })
  if (result.ok) revalidatePath(`/purchases/${purchaseId}`)
  return result
}

export async function recordPurchasePaymentAction(formData: FormData) {
  try {
    const purchaseId = String(formData.get("purchase_id"))
    const amount = Number(formData.get("amount"))
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Payment amount must be positive")
    }

    const supabase = await createClient()
    const { data: balance, error: balanceError } = await supabase
      .from("purchase_balances")
      .select("due_amount")
      .eq("purchase_id", purchaseId)
      .single()

    if (balanceError) throw new Error(balanceError.message)
    if (amount > Number(balance.due_amount)) {
      throw new Error("Payment cannot exceed purchase due")
    }

    const payment = await rpc<{ id: string }>("record_payment", {
      p_idempotency_key: key("purchase-payment"),
      p_payload: {
        contact_id: String(formData.get("supplier_id")),
        direction: "out",
        amount,
        payment_method: String(formData.get("payment_method") ?? "cash"),
        payment_date: String(formData.get("payment_date") ?? ""),
        reference_number:
          String(formData.get("reference_number") ?? "").trim() || null,
        notes: String(formData.get("notes") ?? "").trim() || null,
        auto_allocate: false,
      },
    })

    if (!payment.ok) return payment

    const allocation = await rpc<{ id: string }>("allocate_payment", {
      p_idempotency_key: key("purchase-payment-allocation"),
      p_payment_id: payment.data.id,
      p_sale_id: null,
      p_purchase_id: purchaseId,
      p_amount: amount,
    })

    if (!allocation.ok) return allocation

    revalidatePath(`/purchases/${purchaseId}`)
    return { ok: true, data: payment.data } satisfies ActionResult<{ id: string }>
  } catch (error) {
    return fail(error)
  }
}

export async function cancelPurchaseAction(formData: FormData) {
  const purchaseId = String(formData.get("purchase_id"))
  const result = await rpc<{ id: string }>("cancel_purchase", {
    p_idempotency_key: key("purchase-cancel"),
    p_purchase_id: purchaseId,
    p_reason: String(formData.get("reason") ?? "").trim(),
  })
  if (result.ok) revalidatePath(`/purchases/${purchaseId}`)
  return result
}
