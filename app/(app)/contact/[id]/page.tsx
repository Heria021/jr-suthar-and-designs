import { notFound } from "next/navigation"

import { ContactDetailClient } from "@/components/contact/contact-detail-client"
import { createClient } from "@/lib/supabase/server"

export type ContactDetail = {
  id: string
  name: string
  phone: string | null
  address: string | null
  contact_type: "customer" | "supplier" | "both" | "walk_in"
  opening_balance: number
  opening_balance_date: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  version: number
  customer_balance: number
  supplier_balance: number
}

export type ContactStatementRow = {
  entry_date: string | null
  entry_at: string | null
  entry_type: string
  reference_id: string
  description: string
  debit: number
  credit: number
  running_balance: number
}

export type ContactPaymentRow = {
  id: string
  payment_number: string
  direction: "in" | "out"
  amount: number
  payment_method: string
  reference_number: string | null
  notes: string | null
  status: string
  created_at: string
}

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const [
    { data: contact, error: contactError },
    { data: balance, error: balanceError },
    { data: statement, error: statementError },
    { error: paymentsError },
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select(
        "id,name,phone,address,contact_type,opening_balance,opening_balance_date,notes,is_active,created_at,updated_at,version"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("contact_balances")
      .select("customer_balance,supplier_balance")
      .eq("contact_id", id)
      .single(),
    supabase.rpc("contact_statement", { p_contact_id: id }),
    supabase
      .from("payments")
      .select(
        "id,payment_number,direction,amount,payment_method,reference_number,notes,status,created_at"
      )
      .eq("contact_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ])

  if (contactError) {
    notFound()
  }
  if (balanceError) {
    throw new Error(balanceError.message)
  }
  if (statementError) {
    throw new Error(statementError.message)
  }
  if (paymentsError) {
    throw new Error(paymentsError.message)
  }

  const detail = {
    ...contact,
    customer_balance: Number(balance?.customer_balance ?? 0),
    supplier_balance: Number(balance?.supplier_balance ?? 0),
  } satisfies ContactDetail

  return (
    <ContactDetailClient
      contact={detail}
      statement={(statement ?? []) as ContactStatementRow[]}
    />
  )
}
