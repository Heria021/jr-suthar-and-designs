"use server"

import { createClient } from "@/lib/supabase/server"

export type GlobalSearchResult = {
  id: string
  title: string
  subtitle: string
  href: string
  kind: "Product" | "Contact" | "Sale" | "Purchase" | "Payment"
}

function match(value: string | null | undefined, query: string) {
  return value?.toLowerCase().includes(query) ?? false
}

export async function globalSearchAction(
  input: string
): Promise<{ ok: true; data: GlobalSearchResult[] } | { ok: false; error: string }> {
  const query = input.trim().toLowerCase()
  if (query.length < 2) return { ok: true, data: [] }

  try {
    const supabase = await createClient()
    const [
      { data: products, error: productsError },
      { data: contacts, error: contactsError },
      { data: sales, error: salesError },
      { data: purchases, error: purchasesError },
      { data: payments, error: paymentsError },
    ] = await Promise.all([
      supabase
        .from("products")
        .select("id,name,sku,stock_on_hand")
        .eq("is_active", true)
        .limit(80),
      supabase
        .from("contacts")
        .select("id,name,phone,address,contact_type")
        .eq("is_active", true)
        .limit(80),
      supabase
        .from("sales")
        .select("id,sale_number,status,total_amount")
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("purchases")
        .select("id,purchase_number,supplier_invoice_number,status,total_amount")
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("payments")
        .select("id,payment_number,payment_method,amount")
        .order("created_at", { ascending: false })
        .limit(80),
    ])

    const firstError =
      productsError ?? contactsError ?? salesError ?? purchasesError ?? paymentsError
    if (firstError) throw new Error(firstError.message)

    const results: GlobalSearchResult[] = [
      ...(products ?? [])
        .filter((product) => match(product.name, query) || match(product.sku, query))
        .map((product) => ({
          id: `product-${product.id}`,
          title: product.name,
          subtitle: `Product${product.sku ? ` · ${product.sku}` : ""} · stock ${product.stock_on_hand}`,
          href: `/products/${product.id}`,
          kind: "Product" as const,
        })),
      ...(contacts ?? [])
        .filter(
          (contact) =>
            match(contact.name, query) ||
            match(contact.phone, query) ||
            match(contact.address, query) ||
            match(contact.contact_type, query)
        )
        .map((contact) => ({
          id: `contact-${contact.id}`,
          title: contact.name,
          subtitle: `Contact · ${contact.contact_type.replace("_", " ")}${contact.phone ? ` · ${contact.phone}` : ""}`,
          href: `/contact/${contact.id}`,
          kind: "Contact" as const,
        })),
      ...(sales ?? [])
        .filter((sale) => match(sale.sale_number, query) || match(sale.status, query))
        .map((sale) => ({
          id: `sale-${sale.id}`,
          title: sale.sale_number,
          subtitle: `Sale · ${sale.status} · ₹${Number(sale.total_amount).toLocaleString("en-IN")}`,
          href: `/sales/${sale.id}`,
          kind: "Sale" as const,
        })),
      ...(purchases ?? [])
        .filter(
          (purchase) =>
            match(purchase.purchase_number, query) ||
            match(purchase.supplier_invoice_number, query) ||
            match(purchase.status, query)
        )
        .map((purchase) => ({
          id: `purchase-${purchase.id}`,
          title: purchase.purchase_number,
          subtitle: `Purchase · ${purchase.status} · ₹${Number(purchase.total_amount).toLocaleString("en-IN")}`,
          href: `/purchases/${purchase.id}`,
          kind: "Purchase" as const,
        })),
      ...(payments ?? [])
        .filter(
          (payment) =>
            match(payment.payment_number, query) ||
            match(payment.payment_method, query)
        )
        .map((payment) => ({
          id: `payment-${payment.id}`,
          title: payment.payment_number,
          subtitle: `Payment · ${payment.payment_method} · ₹${Number(payment.amount).toLocaleString("en-IN")}`,
          href: `/payments/${payment.id}`,
          kind: "Payment" as const,
        })),
    ]

    return { ok: true, data: results.slice(0, 20) }
  } catch {
    return { ok: false, error: "Search failed. Try again." }
  }
}
