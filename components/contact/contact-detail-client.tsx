"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  deactivateContactAction,
  reactivateContactAction,
  recordPaymentAction,
  updateContactAction,
  type ContactPayload,
  type PaymentPayload,
} from "@/app/(app)/contact/actions"
import type {
  ContactDetail,
  ContactStatementRow,
} from "@/app/(app)/contact/[id]/page"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
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
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type ContactFormState = {
  name: string
  phone: string
  address: string
  contact_type: ContactPayload["contact_type"]
  notes: string
}

type PaymentFormState = {
  direction: "in" | "out"
  amount: string
  payment_method: PaymentPayload["payment_method"]
  reference_number: string
  notes: string
}

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
})

function money(value: number) {
  return moneyFormatter.format(Number(value))
}

function formFromContact(contact: ContactDetail): ContactFormState {
  return {
    name: contact.name,
    phone: contact.phone ?? "",
    address: contact.address ?? "",
    contact_type: contact.contact_type,
    notes: contact.notes ?? "",
  }
}

function paymentDefaults(contact: ContactDetail): PaymentFormState {
  const canReceive =
    contact.contact_type === "customer" ||
    contact.contact_type === "both" ||
    contact.contact_type === "walk_in"

  return {
    direction: canReceive ? "in" : "out",
    amount: "",
    payment_method: "cash",
    reference_number: "",
    notes: "",
  }
}

function parseAmount(value: string, label: string) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${label} must be greater than zero`)
  }
  return amount
}

type ActiveForm = "edit" | "payment" | null

export function ContactDetailClient({
  contact,
  statement,
}: {
  contact: ContactDetail
  statement: ContactStatementRow[]
}) {
  const router = useRouter()
  const [activeForm, setActiveForm] = useState<ActiveForm>(null)
  const [isPending, startTransition] = useTransition()

  const canReceive =
    contact.contact_type === "customer" ||
    contact.contact_type === "both" ||
    contact.contact_type === "walk_in"
  const canPay =
    contact.contact_type === "supplier" || contact.contact_type === "both"

  function toggle(form: ActiveForm) {
    setActiveForm((cur) => (cur === form ? null : form))
  }

  function deactivate() {
    startTransition(async () => {
      const toastId = toast.loading("Deactivating contact...")
      const result = await deactivateContactAction(contact.id, contact.version)
      if (!result.ok) {
        toast.error(result.error, { id: toastId })
        return
      }
      toast.success("Contact deactivated", { id: toastId })
      router.refresh()
    })
  }

  function reactivate() {
    startTransition(async () => {
      const toastId = toast.loading("Reactivating contact...")
      const result = await reactivateContactAction(contact.id, contact.version)
      if (!result.ok) {
        toast.error(result.error, { id: toastId })
        return
      }
      toast.success("Contact reactivated", { id: toastId })
      router.refresh()
    })
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {contact.name}
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Contact details, balances, payment history, and account statement in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {contact.is_active && (
            <Button
              variant="secondary"
              size="sm"
              className="shadow-none cursor-pointer"
              onClick={() => toggle("edit")}
            >
              {activeForm === "edit" ? "Close" : "Edit"}
            </Button>
          )}
          {contact.is_active && (
            <Button
              variant="secondary"
              size="sm"
              className="shadow-none cursor-pointer"
              disabled={!contact.is_active}
              onClick={() => toggle("payment")}
            >
              {activeForm === "payment" ? "Close" : "Record payment"}
            </Button>
          )}
          <Link
            href="/contact"
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "shadow-none")}
          >
            Back
          </Link>
        </div>
      </div>

      {/* Edit form — collapsible */}
      {activeForm === "edit" && (
        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">Edit contact</h2>
            <p className="text-xs text-muted-foreground">
              Update name, phone, type, and notes for {contact.name}.
            </p>
          </div>
          <EditForm
            contact={contact}
            pending={isPending}
            onCancel={() => setActiveForm(null)}
            onSubmit={(payload) => {
              startTransition(async () => {
                const toastId = toast.loading("Saving contact...")
                const result = await updateContactAction(
                  contact.id,
                  contact.version,
                  payload
                )
                if (!result.ok) {
                  toast.error(result.error, { id: toastId })
                  return
                }
                toast.success("Contact saved", { id: toastId })
                setActiveForm(null)
                router.refresh()
              })
            }}
          />
        </section>
      )}

      {/* Record payment form — collapsible */}
      {activeForm === "payment" && (
        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">Record payment</h2>
            <p className="text-xs text-muted-foreground">
              Payments are kept separate from bills and purchase invoices.
            </p>
          </div>
          <PaymentForm
            contact={contact}
            canReceive={canReceive}
            canPay={canPay}
            pending={isPending}
            onCancel={() => setActiveForm(null)}
            onSubmit={(payload) => {
              startTransition(async () => {
                const toastId = toast.loading("Recording payment...")
                const result = await recordPaymentAction(payload)
                if (!result.ok) {
                  toast.error(result.error, { id: toastId })
                  return
                }
                toast.success("Payment recorded", { id: toastId })
                setActiveForm(null)
                router.refresh()
              })
            }}
          />
        </section>
      )}

      {/* Contact details section — only shown when no form is open */}
      {activeForm === null && (
        <ContactDetailsSection
          contact={contact}
          pending={isPending}
          onDeactivate={deactivate}
          onReactivate={reactivate}
        />
      )}

      {/* Statement section */}
      {activeForm === null && (
        <StatementSection statement={statement} />
      )}

    </div>
  )
}

// ─── Contact Details Section ──────────────────────────────────────────────────

function ContactDetailsSection({
  contact,
  pending,
  onDeactivate,
  onReactivate,
}: {
  contact: ContactDetail
  pending: boolean
  onDeactivate: () => void
  onReactivate: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-foreground">Contact details</h2>
          <Badge
            variant={contact.is_active ? "outline" : "secondary"}
            className="shadow-none"
          >
            {contact.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Balance summary and account information for {contact.name}
          {contact.phone ? ` · ${contact.phone}` : ""}.
        </p>
      </div>

      {/* Balance metrics */}
      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4 pb-4 border-b border-border/40">
        <div>
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Customer balance
          </span>
          <p className="text-xl font-bold text-foreground mt-1">
            {money(contact.customer_balance)}
          </p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Supplier balance
          </span>
          <p className="text-xl font-bold text-foreground mt-1">
            {money(contact.supplier_balance)}
          </p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Opening balance
          </span>
          <p className="text-xl font-bold text-foreground mt-1">
            {money(contact.opening_balance)}
          </p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Type
          </span>
          <p className="text-xl font-bold text-foreground mt-1 capitalize">
            {contact.contact_type.replace("_", " ")}
          </p>
        </div>
      </div>

      {/* Detail lines */}
      <div className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
        <DetailLine label="Phone" value={contact.phone || "—"} />
        <DetailLine label="Address" value={contact.address || "—"} />
        <DetailLine
          label="Opening date"
          value={
            contact.opening_balance_date
              ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
                new Date(contact.opening_balance_date)
              )
              : "—"
          }
        />
        {contact.notes && (
          <div className="sm:col-span-2">
            <DetailLine label="Notes" value={contact.notes} />
          </div>
        )}
      </div>

      {/* Deactivate / Reactivate row */}
      <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          {contact.contact_type === "walk_in"
            ? "Walk-in Customer is permanent and cannot be deactivated."
            : contact.is_active
              ? "Contact is active and available for billing and transactions."
              : "Contact is inactive. Historical data remains visible."}
        </p>
        {contact.contact_type !== "walk_in" && (
          <>
            {contact.is_active ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="shadow-none shrink-0"
                disabled={pending}
                onClick={onDeactivate}
              >
                Deactivate
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shadow-none shrink-0"
                disabled={pending}
                onClick={onReactivate}
              >
                Reactivate
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}

// ─── Statement Section ────────────────────────────────────────────────────────

function StatementSection({ statement }: { statement: ContactStatementRow[] }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">Account statement</h2>
        <p className="text-xs text-muted-foreground">
          Latest transactions first.
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border bg-secondary/50">
        {statement.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-secondary/60">
                <TableHead className="h-10 px-4 text-xs font-medium text-muted-foreground">Date & time</TableHead>
                <TableHead className="h-10 text-xs font-medium text-muted-foreground">Type</TableHead>
                <TableHead className="h-10 text-xs font-medium text-muted-foreground">Description</TableHead>
                <TableHead className="h-10 text-xs font-medium text-muted-foreground">Debit</TableHead>
                <TableHead className="h-10 text-xs font-medium text-muted-foreground">Credit</TableHead>
                <TableHead className="h-10 px-4 text-xs font-medium text-muted-foreground">
                  Balance
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statement.map((entry) => (
                <TableRow
                  key={`${entry.entry_type}-${entry.reference_id}`}
                  className="transition-colors hover:bg-secondary/40"
                >
                  <TableCell className="px-4 py-3 text-sm">
                    {entry.entry_at || entry.entry_date ? (
                      <span className="flex flex-col gap-0.5">
                        <span>
                          {new Intl.DateTimeFormat("en-IN", {
                            dateStyle: "medium",
                          }).format(new Date(entry.entry_at ?? entry.entry_date ?? ""))}
                        </span>
                        {entry.entry_at ? (
                          <span className="text-xs text-muted-foreground">
                            {new Intl.DateTimeFormat("en-IN", {
                              timeStyle: "short",
                            }).format(new Date(entry.entry_at))}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-sm capitalize text-muted-foreground">
                    {entry.entry_type}
                  </TableCell>
                  <TableCell className="text-sm text-foreground">
                    {entry.entry_type.toLowerCase() === "sale" || entry.entry_type.toLowerCase() === "invoice" ? (
                      <Link
                        href={`/sales/${entry.reference_id}`}
                        className="cursor-pointer hover:underline hover:text-foreground transition-colors"
                      >
                        {entry.description}
                      </Link>
                    ) : (
                      entry.description
                    )}
                  </TableCell>
                  <TableCell className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                    {entry.debit > 0 ? money(entry.debit) : "—"}
                  </TableCell>
                  <TableCell className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    {entry.credit > 0 ? money(entry.credit) : "—"}
                  </TableCell>
                  <TableCell className="px-4 text-sm font-bold text-foreground">
                    {money(entry.running_balance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex min-h-32 items-center justify-center text-xs text-muted-foreground">
            No statement entries recorded for this contact.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Edit Form ────────────────────────────────────────────────────────────────


function EditForm({
  contact,
  pending,
  onSubmit,
  onCancel,
}: {
  contact: ContactDetail
  pending: boolean
  onSubmit: (payload: Partial<ContactPayload>) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState(formFromContact(contact))

  function patch(update: Partial<ContactFormState>) {
    setForm((current) => ({ ...current, ...update }))
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!form.name.trim()) {
          toast.error("Contact name is required")
          return
        }
        onSubmit({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          contact_type: form.contact_type,
          notes: form.notes.trim() || null,
        })
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
        <div className="space-y-2 sm:col-span-2">
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
            disabled={contact.contact_type === "walk_in"}
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
              {contact.contact_type === "walk_in" ? (
                <SelectItem value="walk_in">Walk-in</SelectItem>
              ) : null}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          value={form.notes}
          onChange={(event) => patch({ notes: event.target.value })}
          className="min-h-24 shadow-none"
          placeholder="Optional"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" className="shadow-none" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={pending} type="submit" className="shadow-none">
          {pending ? "Saving..." : "Save contact"}
        </Button>
      </div>
    </form>
  )
}

// ─── Payment Form ─────────────────────────────────────────────────────────────

function PaymentForm({
  contact,
  canReceive,
  canPay,
  pending,
  onSubmit,
  onCancel,
}: {
  contact: ContactDetail
  canReceive: boolean
  canPay: boolean
  pending: boolean
  onSubmit: (payload: PaymentPayload) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState(paymentDefaults(contact))

  function patch(update: Partial<PaymentFormState>) {
    setForm((current) => ({ ...current, ...update }))
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        try {
          const amount = parseAmount(form.amount, "Payment amount")
          onSubmit({
            contact_id: contact.id,
            direction: form.direction,
            amount,
            payment_method: form.payment_method,
            reference_number: form.reference_number.trim() || null,
            notes: form.notes.trim() || null,
            auto_allocate: true,
          })
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Check payment")
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Payment type</Label>
          <Select
            value={form.direction}
            onValueChange={(value) =>
              patch({ direction: value as PaymentFormState["direction"] })
            }
          >
            <SelectTrigger className="w-full shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {canReceive ? <SelectItem value="in">Customer paid us</SelectItem> : null}
              {canPay ? <SelectItem value="out">We paid supplier</SelectItem> : null}
            </SelectContent>
          </Select>
        </div>
        <TextField
          label="Amount"
          type="number"
          step="0.01"
          value={form.amount}
          onChange={(value) => patch({ amount: value })}
        />
        <div className="space-y-2">
          <Label>Method</Label>
          <Select
            value={form.payment_method}
            onValueChange={(value) =>
              patch({ payment_method: value as PaymentPayload["payment_method"] })
            }
          >
            <SelectTrigger className="w-full shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="upi">UPI</SelectItem>
              <SelectItem value="bank">Bank</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <TextField
          label="Reference"
          value={form.reference_number}
          onChange={(value) => patch({ reference_number: value })}
          placeholder="Optional"
        />
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          value={form.notes}
          onChange={(event) => patch({ notes: event.target.value })}
          className="min-h-24 shadow-none"
          placeholder="Optional"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" className="shadow-none" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={pending} type="submit" className="shadow-none">
          {pending ? "Saving..." : "Record payment"}
        </Button>
      </div>
    </form>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
