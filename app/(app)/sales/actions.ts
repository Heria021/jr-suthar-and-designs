"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export type CompleteSaleItemInput = {
  product_id: string
  entry_mode: "loose" | "box"
  quantity: number
  price_per_entry: number | null
}

export type SalePaymentMethod = "cash" | "upi" | "bank" | "card" | "other"

export type CompleteSaleInput = {
  customer_id: string | null
  customer: {
    name: string
    phone: string | null
    address: string | null
  }
  sale_date: string
  discount_amount: number
  notes: string | null
  items: CompleteSaleItemInput[]
  initial_payment: {
    amount: number
    payment_method: SalePaymentMethod
    reference_number: string | null
    notes: string | null
  } | null
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
    revalidatePath("/sales")
    return { ok: true, data: data as T } satisfies ActionResult<T>
  } catch (error) {
    return fail(error)
  }
}

export async function createCompleteSaleAction(
  payload: CompleteSaleInput
): Promise<ActionResult<{ id: string; total_amount: number }>> {
  try {
    if (!payload.customer_id && !payload.customer.name.trim()) {
      throw new Error("Customer name is required")
    }
    if (!payload.items.length) {
      throw new Error("Add at least one item")
    }
    if (payload.discount_amount < 0) {
      throw new Error("Discount cannot be negative")
    }

    for (const item of payload.items) {
      if (!item.product_id) {
        throw new Error("Every item must have a product")
      }
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new Error("Item quantity must be a positive whole number")
      }

      if (item.price_per_entry != null && item.price_per_entry < 0) {
        throw new Error("Item rate cannot be negative")
      }
    }

    if (payload.initial_payment && payload.initial_payment.amount < 0) {
      throw new Error("Payment cannot be negative")
    }

    const result = await rpc<{ id: string; total_amount: number }>("complete_sale", {
      p_idempotency_key: key("sale-complete"),
      p_payload: payload,
    })

    if (result.ok) revalidatePath(`/sales/${result.data.id}`)
    return result
  } catch (error) {
    return fail(error)
  }
}

export async function createDraftSaleAction(formData: FormData) {
  const customerId = String(formData.get("customer_id") ?? "")
  const saleDate = String(formData.get("sale_date") ?? "")
  const notes = String(formData.get("notes") ?? "").trim()
  const discount = Number(formData.get("discount_amount") ?? 0)

  const result = await rpc<{ id: string }>("create_draft_sale", {
    p_idempotency_key: key("sale-draft"),
    p_payload: {
      customer_id: customerId || undefined,
      sale_date: saleDate || undefined,
      discount_amount: Number.isFinite(discount) ? discount : 0,
      notes: notes || null,
    },
  })

  if (!result.ok) {
    redirect(`/sales/new?error=${encodeURIComponent(result.error)}`)
  }

  redirect(`/sales/${result.data.id}`)
}

export async function addSaleItemAction(formData: FormData) {
  return rpc<{ id: string }>("add_sale_item", {
    p_idempotency_key: key("sale-item-add"),
    p_sale_id: String(formData.get("sale_id")),
    p_product_id: String(formData.get("product_id")),
    p_entry_mode: String(formData.get("entry_mode")),
    p_quantity: Number(formData.get("quantity")),
    p_price_per_entry:
      String(formData.get("price_per_entry") ?? "").trim() === ""
        ? null
        : Number(formData.get("price_per_entry")),
  })
}

export async function updateSaleItemAction(formData: FormData) {
  return rpc<{ id: string }>("update_sale_item", {
    p_idempotency_key: key("sale-item-update"),
    p_sale_item_id: String(formData.get("sale_item_id")),
    p_entry_mode: String(formData.get("entry_mode")),
    p_quantity: Number(formData.get("quantity")),
    p_price_per_entry:
      String(formData.get("price_per_entry") ?? "").trim() === ""
        ? null
        : Number(formData.get("price_per_entry")),
  })
}

export async function removeSaleItemAction(formData: FormData) {
  return rpc<{ id: string }>("remove_sale_item", {
    p_idempotency_key: key("sale-item-remove"),
    p_sale_item_id: String(formData.get("sale_item_id")),
  })
}

export async function finalizeSaleAction(formData: FormData) {
  const paymentAmount = Number(formData.get("payment_amount") ?? 0)

  return rpc<{ id: string; total_amount: number }>("finalize_sale", {
    p_idempotency_key: key("sale-finalize"),
    p_sale_id: String(formData.get("sale_id")),
    p_discount_amount: Number(formData.get("discount_amount") ?? 0),
    p_initial_payment:
      Number.isFinite(paymentAmount) && paymentAmount > 0
        ? {
            amount: paymentAmount,
            payment_method: String(formData.get("payment_method") ?? "cash"),
            notes: "Initial sale payment",
          }
        : null,
  })
}

export async function recordSalePaymentAction(formData: FormData) {
  try {
    const saleId = String(formData.get("sale_id"))
    const amount = Number(formData.get("amount"))
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Payment amount must be positive")
    }

    const payment = await rpc<{ id: string }>("record_sale_payment", {
      p_idempotency_key: key("sale-payment"),
      p_sale_id: saleId,
      p_payload: {
        amount,
        payment_method: String(formData.get("payment_method") ?? "cash"),
        reference_number: String(formData.get("reference_number") ?? "") || null,
        notes: String(formData.get("notes") ?? "") || null,
      },
    })

    if (!payment.ok) return payment

    revalidatePath(`/sales/${saleId}`)
    return { ok: true, data: payment.data } satisfies ActionResult<{ id: string }>
  } catch (error) {
    return fail(error)
  }
}

export async function cancelSaleAction(formData: FormData) {
  return rpc<{ id: string }>("cancel_sale", {
    p_idempotency_key: key("sale-cancel"),
    p_sale_id: String(formData.get("sale_id")),
    p_reason: String(formData.get("reason") ?? "").trim(),
  })
}
