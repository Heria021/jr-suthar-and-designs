"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"

export type ContactActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; stale?: boolean }

export type ContactPayload = {
  name: string
  phone: string | null
  address?: string | null
  contact_type: "customer" | "supplier" | "both" | "walk_in"
  opening_balance?: number
  opening_balance_date?: string
  notes: string | null
}

export type PaymentPayload = {
  contact_id: string
  direction: "in" | "out"
  amount: number
  payment_method: "cash" | "upi" | "bank" | "card" | "other"
  payment_date: string
  reference_number: string | null
  notes: string | null
  auto_allocate: boolean
}

function idempotencyKey(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function actionError<T = never>(error: unknown): ContactActionResult<T> {
  const message =
    error instanceof Error ? error.message : "Something went wrong. Try again."
  const stale = /optimistic lock|40001|stale/i.test(message)

  return {
    ok: false,
    stale,
    error: stale
      ? "This contact was updated elsewhere. Refresh and try again."
      : message,
  }
}

async function rpc<T>(
  name: string,
  args: Record<string, unknown>
): Promise<ContactActionResult<T>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc(name, args)

    if (error) {
      throw new Error(error.message)
    }

    revalidatePath("/contact")
    return { ok: true, data: data as T }
  } catch (error) {
    return actionError(error)
  }
}

export async function createContactAction(payload: ContactPayload) {
  return rpc<{ id: string }>("create_contact", {
    p_idempotency_key: idempotencyKey("create-contact"),
    p_payload: payload,
  })
}

export async function updateContactAction(
  contactId: string,
  expectedVersion: number,
  payload: Partial<ContactPayload>
) {
  return rpc<{ id: string }>("update_contact", {
    p_idempotency_key: idempotencyKey("update-contact"),
    p_contact_id: contactId,
    p_expected_version: expectedVersion,
    p_payload: payload,
  })
}

export async function deactivateContactAction(
  contactId: string,
  expectedVersion: number
) {
  return rpc<{ id: string }>("deactivate_contact", {
    p_idempotency_key: idempotencyKey("deactivate-contact"),
    p_contact_id: contactId,
    p_expected_version: expectedVersion,
  })
}

export async function reactivateContactAction(
  contactId: string,
  expectedVersion: number
) {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("contacts")
      .update({ is_active: true, version: expectedVersion })
      .eq("id", contactId)
      .select("id")
      .single()

    if (error) {
      throw new Error(error.message)
    }

    revalidatePath("/contact")
    revalidatePath(`/contact/${contactId}`)
    return { ok: true, data } as ContactActionResult<{ id: string }>
  } catch (error) {
    return actionError(error)
  }
}

export async function recordPaymentAction(payload: PaymentPayload) {
  const result = await rpc<{ id: string }>("record_payment", {
    p_idempotency_key: idempotencyKey("record-payment"),
    p_payload: payload,
  })

  if (result.ok) {
    revalidatePath(`/contact/${payload.contact_id}`)
  }

  return result
}

export async function getContactStatementAction(contactId: string) {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc("contact_statement", {
      p_contact_id: contactId,
    })

    if (error) {
      throw new Error(error.message)
    }

    return { ok: true, data } as ContactActionResult<unknown>
  } catch (error) {
    return actionError(error)
  }
}
