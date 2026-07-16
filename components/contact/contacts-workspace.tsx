"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon, SearchIcon, UsersIcon } from "lucide-react"
import { toast } from "sonner"

import {
  createContactAction,
  type ContactPayload,
} from "@/app/(app)/contact/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type ContactListRow = {
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

type FilterValue = "all" | "customer" | "supplier" | "both" | "inactive"

type ContactFormState = {
  name: string
  phone: string
  address: string
  contact_type: ContactPayload["contact_type"]
  opening_balance_mode: "none" | "owes" | "advance"
  opening_balance: string
  notes: string
}

const filters: { label: string; value: FilterValue }[] = [
  { label: "All", value: "all" },
  { label: "Customers", value: "customer" },
  { label: "Suppliers", value: "supplier" },
  { label: "Both", value: "both" },
  { label: "Inactive", value: "inactive" },
]

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
})

function money(value: number) {
  return moneyFormatter.format(Number(value))
}

function emptyForm(): ContactFormState {
  return {
    name: "",
    phone: "",
    address: "",
    contact_type: "customer",
    opening_balance_mode: "none",
    opening_balance: "0",
    notes: "",
  }
}

function payloadFromForm(form: ContactFormState): ContactPayload {
  if (!form.name.trim()) {
    throw new Error("Contact name is required")
  }

  const amount = Number(form.opening_balance || 0)
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Opening balance must be zero or more")
  }

  let openingBalance = 0
  if (form.opening_balance_mode === "owes") {
    openingBalance = amount
  } else if (form.opening_balance_mode === "advance") {
    openingBalance = -amount
  }

  return {
    name: form.name.trim(),
    phone: form.phone.trim() || null,
    address: form.address.trim() || null,
    contact_type: form.contact_type,
    opening_balance: openingBalance,
    opening_balance_date: new Date().toISOString().slice(0, 10),
    notes: form.notes.trim() || null,
  }
}

function openingBalanceCopy(type: ContactPayload["contact_type"]) {
  if (type === "supplier") {
    return {
      helper: "Use this only for old supplier balances before this ERP.",
      options: [
        ["none", "No balance"],
        ["owes", "Payment due"],
        ["advance", "Advance paid"],
      ] as const,
    }
  }

  if (type === "both") {
    return {
      helper: "Use this only when this contact already has an old balance.",
      options: [
        ["none", "No balance"],
        ["owes", "Payment due"],
        ["advance", "Overpaid / advance"],
      ] as const,
    }
  }

  return {
    helper: "Use this only for old customer balances before this ERP.",
    options: [
      ["none", "No balance"],
      ["owes", "Payment due"],
      ["advance", "Advance received"],
    ] as const,
  }
}

export function ContactsWorkspace({
  initialContacts,
}: {
  initialContacts: ContactListRow[]
}) {
  const router = useRouter()
  const [contacts, setContacts] = useState(initialContacts)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<FilterValue>("all")
  const [showCreate, setShowCreate] = useState(false)
  const [isPending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()

    return contacts.filter((contact) => {
      const matchesSearch =
        !term ||
        contact.name.toLowerCase().includes(term) ||
        contact.phone?.toLowerCase().includes(term) ||
        contact.address?.toLowerCase().includes(term)

      const matchesFilter =
        filter === "all" ||
        (filter === "inactive" && !contact.is_active) ||
        (filter !== "inactive" &&
          contact.is_active &&
          (contact.contact_type === filter ||
            (filter === "customer" && contact.contact_type === "walk_in") ||
            (filter === "customer" && contact.contact_type === "both") ||
            (filter === "supplier" && contact.contact_type === "both")))

      return matchesSearch && matchesFilter
    })
  }, [contacts, filter, query])

  return (
    <div className="flex w-full flex-col gap-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Contacts</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Manage your customers and suppliers, track balances, and record notes.
          </p>
        </div>
        <Button
          size="sm"
          className="shadow-none cursor-pointer gap-1.5"
          onClick={() => setShowCreate((v) => !v)}
        >
          <PlusIcon className="size-4" />
          New Contact
        </Button>
      </div>

      {/* Inline create form */}
      {showCreate && (
        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">New contact</h2>
            <p className="text-xs text-muted-foreground">
              Customers and suppliers share one contact record.
            </p>
          </div>
          <ContactForm
            pending={isPending}
            onCancel={() => setShowCreate(false)}
            onSubmit={(form) => {
              startTransition(async () => {
                let payload: ContactPayload
                try {
                  payload = payloadFromForm(form)
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Check the form")
                  return
                }

                const toastId = toast.loading("Creating contact...")
                const result = await createContactAction(payload)
                if (!result.ok) {
                  toast.error(result.error, { id: toastId })
                  return
                }

                toast.success("Contact created", { id: toastId })
                setShowCreate(false)
                setContacts((current) => [
                  ...current,
                  {
                    id: result.data.id,
                    ...payload,
                    opening_balance: payload.opening_balance ?? 0,
                    opening_balance_date: payload.opening_balance_date ?? null,
                    address: payload.address ?? null,
                    is_active: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    version: 1,
                    customer_balance:
                      payload.contact_type === "supplier"
                        ? 0
                        : (payload.opening_balance ?? 0),
                    supplier_balance:
                      payload.contact_type === "customer" ||
                      payload.contact_type === "walk_in"
                        ? 0
                        : (payload.opening_balance ?? 0),
                  },
                ])
                router.refresh()
              })
            }}
          />
        </section>
      )}

      {/* Contact list */}
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Contact list</h2>
          <p className="text-xs text-muted-foreground">
            Click a contact to open their detail page.
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search contacts or phone"
              className="h-9 border bg-secondary/50 pl-9 shadow-none focus-visible:ring-1"
            />
          </div>

          <div className="flex max-w-full shrink-0 items-center gap-1.5 overflow-x-auto">
            {filters.map((item) => {
              const isSelected = filter === item.value
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className={`h-8 shrink-0 border rounded-md px-3 text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border bg-secondary/50">
          {filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-secondary/60">
                  <TableHead className="h-10 min-w-[240px] px-4 text-xs font-medium text-muted-foreground">
                    Contact
                  </TableHead>
                  <TableHead className="h-10 text-xs font-medium text-muted-foreground">Type</TableHead>
                  <TableHead className="h-10 text-xs font-medium text-muted-foreground">Customer balance</TableHead>
                  <TableHead className="h-10 text-xs font-medium text-muted-foreground">Supplier balance</TableHead>
                  <TableHead className="h-10 text-xs font-medium text-muted-foreground">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((contact) => (
                  <TableRow
                    key={contact.id}
                    className="cursor-pointer transition-colors hover:bg-secondary/40"
                    onClick={() => router.push(`/contact/${contact.id}`)}
                  >
                    <TableCell className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-secondary/60 text-secondary-foreground">
                          <UsersIcon className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {contact.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {contact.phone || "No phone"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground capitalize">
                      {contact.contact_type.replace("_", " ")}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-foreground">
                      {money(contact.customer_balance)}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-foreground">
                      {money(contact.supplier_balance)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={contact.is_active ? "outline" : "secondary"}
                        className="rounded-md font-medium"
                      >
                        {contact.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              title="No contacts found"
              description="Try a different search or filter."
            />
          )}
        </div>
      </section>
    </div>
  )
}

function ContactForm({
  pending,
  onSubmit,
  onCancel,
}: {
  pending: boolean
  onSubmit: (form: ContactFormState) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState(emptyForm())
  const openingBalance = openingBalanceCopy(form.contact_type)

  function patch(update: Partial<ContactFormState>) {
    setForm((current) => ({ ...current, ...update }))
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(form)
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Name"
          value={form.name}
          onChange={(value) => patch({ name: value })}
        />
        <TextField
          label="Phone"
          value={form.phone}
          onChange={(value) => patch({ phone: value })}
          placeholder="Optional"
        />
      </div>

      <div className="space-y-2">
        <Label>Address</Label>
        <Textarea
          value={form.address}
          onChange={(event) => patch({ address: event.target.value })}
          className="min-h-20 w-full shadow-none"
          placeholder="Optional"
        />
      </div>

      <div className="space-y-2">
        <Label>Type</Label>
        <Select
          value={form.contact_type}
          onValueChange={(value) =>
            patch({ contact_type: value as ContactPayload["contact_type"] })
          }
        >
          <SelectTrigger className="w-full shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="customer">Customer</SelectItem>
            <SelectItem value="supplier">Supplier</SelectItem>
            <SelectItem value="both">Both</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Opening balance</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {openingBalance.options.map(([value, label]) => (
            <Button
              key={value}
              type="button"
              onClick={() =>
                patch({ opening_balance_mode: value as ContactFormState["opening_balance_mode"] })
              }
              className={cn(
                "h-auto justify-start rounded-md border px-3 py-2 text-left text-xs font-medium shadow-none",
                form.opening_balance_mode === value
                  ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{openingBalance.helper}</p>
      </div>

      {form.opening_balance_mode !== "none" ? (
        <TextField
          label="Opening amount"
          type="number"
          step="0.01"
          value={form.opening_balance}
          onChange={(value) => patch({ opening_balance: value })}
        />
      ) : null}

      <div className="space-y-2">
        <Label>Note</Label>
        <Textarea
          value={form.notes}
          onChange={(event) => patch({ notes: event.target.value })}
          className="min-h-24 shadow-none"
          placeholder="Optional"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" className="shadow-none" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={pending} type="submit" className="shadow-none">
          {pending ? "Saving..." : "Create contact"}
        </Button>
      </div>
    </form>
  )
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  step,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  step?: string
  placeholder?: string
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        step={step}
        value={value}
        placeholder={placeholder}
        min={type === "number" ? "0" : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="shadow-none"
      />
    </div>
  )
}

function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
        <UsersIcon className="size-5" />
      </div>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
