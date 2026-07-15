"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"

export type ProductActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; stale?: boolean }

export type ProductPayload = {
  name: string
  sku: string | null
  unit_name: string
  loose_sale_price: number
  loose_cost_price: number
  has_box: boolean
  box_units: number | null
  box_sale_price: number | null
  box_cost_price: number | null
  reorder_level: number
  opening_stock?: number
}

export type StockMovementRow = {
  id: string
  movement_type: string
  quantity_delta: number
  reason: string | null
  stock_before: number
  stock_after: number
  occurred_at: string
}

function idempotencyKey(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function actionError<T = never>(error: unknown): ProductActionResult<T> {
  const message =
    error instanceof Error ? error.message : "Something went wrong. Try again."
  const stale = /optimistic lock|40001|stale/i.test(message)

  return {
    ok: false,
    stale,
    error: stale
      ? "This product was updated elsewhere. Refresh and try again."
      : message,
  }
}

async function rpc<T>(
  name: string,
  args: Record<string, unknown>
): Promise<ProductActionResult<T>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc(name, args)

    if (error) {
      throw new Error(error.message)
    }

    revalidatePath("/products")
    return { ok: true, data: data as T }
  } catch (error) {
    return actionError(error)
  }
}

export async function createProductAction(payload: ProductPayload) {
  const result = await rpc<{ id: string }>("create_product", {
    p_idempotency_key: idempotencyKey("create-product"),
    p_payload: payload,
  })
  if (result.ok) {
    revalidatePath(`/products/${result.data.id}`)
  }
  return result
}

export async function updateProductAction(
  productId: string,
  expectedVersion: number,
  payload: Partial<ProductPayload>
) {
  const result = await rpc<{ id: string }>("update_product", {
    p_idempotency_key: idempotencyKey("update-product"),
    p_product_id: productId,
    p_expected_version: expectedVersion,
    p_payload: payload,
  })
  if (result.ok) {
    revalidatePath(`/products/${productId}`)
  }
  return result
}

export async function deactivateProductAction(
  productId: string,
  expectedVersion: number
) {
  const result = await rpc<{ id: string }>("deactivate_product", {
    p_idempotency_key: idempotencyKey("deactivate-product"),
    p_product_id: productId,
    p_expected_version: expectedVersion,
  })
  if (result.ok) {
    revalidatePath(`/products/${productId}`)
  }
  return result
}

export async function reactivateProductAction(
  productId: string,
  expectedVersion: number
) {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("products")
      .update({ is_active: true, version: expectedVersion })
      .eq("id", productId)
      .eq("version", expectedVersion)
      .select("id")
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }
    if (!data) {
      throw new Error("optimistic lock conflict on products")
    }

    revalidatePath("/products")
    revalidatePath(`/products/${productId}`)
    return { ok: true, data } as ProductActionResult<{ id: string }>
  } catch (error) {
    return actionError(error)
  }
}

export async function correctStockAction(
  productId: string,
  actualStock: number,
  reason: string
) {
  const result = await rpc<{ id: string; quantity_delta: number }>(
    "correct_stock",
    {
      p_idempotency_key: idempotencyKey("correct-stock"),
      p_product_id: productId,
      p_actual_stock: actualStock,
      p_reason: reason,
    }
  )
  if (result.ok) {
    revalidatePath(`/products/${productId}`)
  }
  return result
}
