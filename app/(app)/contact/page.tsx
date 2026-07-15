import { ContactsWorkspace, type ContactListRow } from "@/components/contact/contacts-workspace"
import { createClient } from "@/lib/supabase/server"

export default async function ContactPage() {
  const supabase = await createClient()
  const [{ data: contacts, error: contactsError }, { data: balances, error: balancesError }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select(
          "id,name,phone,address,contact_type,opening_balance,opening_balance_date,notes,is_active,created_at,updated_at,version"
        )
        .order("name", { ascending: true }),
      supabase
        .from("contact_balances")
        .select("contact_id,customer_balance,supplier_balance"),
    ])

  if (contactsError) {
    throw new Error(contactsError.message)
  }
  if (balancesError) {
    throw new Error(balancesError.message)
  }

  const balanceByContact = new Map(
    (balances ?? []).map((balance) => [balance.contact_id, balance])
  )

  const rows = (contacts ?? []).map((contact) => {
    const balance = balanceByContact.get(contact.id)

    return {
      ...contact,
      customer_balance: Number(balance?.customer_balance ?? 0),
      supplier_balance: Number(balance?.supplier_balance ?? 0),
    }
  }) satisfies ContactListRow[]

  return <ContactsWorkspace initialContacts={rows} />
}
