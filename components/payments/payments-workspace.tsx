"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  LinkIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  allocatePaymentModuleAction,
  recordPaymentModuleAction,
  type PaymentMethod,
} from "@/app/(app)/payments/actions"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export type PaymentRow = {
  id: string
  payment_number: string
  contact_id: string
  contact_name: string | null
  contact_phone: string | null
  direction: "in" | "out"
  amount: number
  document_allocated_amount: number
  opening_applied_amount: number
  allocated_amount: number
  remaining_amount: number
  payment_method: string
  reference_number: string | null
  notes: string | null
  status: string
  reversed_payment_id: string | null
  reversal_reason: string | null
  created_at: string
}

export type ContactOption = {
  id: string
  name: string
  phone: string | null
  contact_type: "customer" | "supplier" | "both" | "walk_in"
  is_active: boolean
}

export type AllocationTarget = {
  id: string
  kind: "sale" | "purchase"
  number: string
  contact_id: string
  contact_name: string
  date: string
  total_amount: number
  due_amount: number
}

export type DailyPaymentTotal = {
  payment_date: string
  payment_method: string
  received_amount: number
  paid_amount: number
  net_amount: number
}

type DirectionFilter = "all" | "in" | "out" | "advance" | "reversed"

const methods: { label: string; value: PaymentMethod }[] = [
  { label: "Cash", value: "cash" },
  { label: "UPI", value: "upi" },
  { label: "Bank", value: "bank" },
  { label: "Card", value: "card" },
  { label: "Other", value: "other" },
]

const directionFilters: { label: string; value: DirectionFilter }[] = [
  { label: "All", value: "all" },
  { label: "Received", value: "in" },
  { label: "Paid", value: "out" },
  { label: "Advance", value: "advance" },
  { label: "Reversed", value: "reversed" },
]

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
})

function money(value: number) {
  return moneyFormatter.format(Number(value))
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" })

function methodLabel(method: string) {
  return methods.find((entry) => entry.value === method)?.label ?? method
}

function canReceivePayment(contact: ContactOption) {
  return ["customer", "both", "walk_in"].includes(contact.contact_type)
}

function canPayContact(contact: ContactOption) {
  return ["supplier", "both"].includes(contact.contact_type)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PaymentsWorkspace({
  payments,
  contacts,
  targets,
  dailyTotals,
}: {
  payments: PaymentRow[]
  contacts: ContactOption[]
  targets: AllocationTarget[]
  dailyTotals: DailyPaymentTotal[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Layout and active form states
  const [activeForm, setActiveForm] = useState<"record" | "allocate" | null>(null)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<DirectionFilter>("all")

  // Record Payment States
  const [recordDirection, setRecordDirection] = useState<"in" | "out">("in")
  const [recordContactId, setRecordContactId] = useState("")
  const [recordAmount, setRecordAmount] = useState("")
  const [recordMethod, setRecordMethod] = useState<PaymentMethod>("cash")
  const [recordReference, setRecordReference] = useState("")
  const [recordNotes, setRecordNotes] = useState("")

  // Manual Allocation States
  const [allocatePaymentId, setAllocatePaymentId] = useState("")
  const [allocateTargetKey, setAllocateTargetKey] = useState("")
  const [allocateAmount, setAllocateAmount] = useState("")

  const totals = useMemo(() => {
    return payments.reduce(
      (acc, payment) => {
        if (payment.status !== "completed") return acc
        if (payment.direction === "in") acc.received += payment.amount
        else acc.paid += payment.amount
        acc.unallocated += payment.remaining_amount
        return acc
      },
      { received: 0, paid: 0, unallocated: 0 }
    )
  }, [payments])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return payments.filter((payment) => {
      const matchesSearch =
        !term ||
        payment.payment_number.toLowerCase().includes(term) ||
        (payment.contact_name ?? "").toLowerCase().includes(term) ||
        (payment.contact_phone ?? "").toLowerCase().includes(term) ||
        (payment.reference_number ?? "").toLowerCase().includes(term)

      const matchesFilter =
        filter === "all" ||
        payment.direction === filter ||
        (filter === "advance" &&
          payment.status === "completed" &&
          payment.remaining_amount > 0 &&
          !payment.reversed_payment_id) ||
        (filter === "reversed" &&
          (payment.status === "reversed" || Boolean(payment.reversed_payment_id)))

      return matchesSearch && matchesFilter
    })
  }, [payments, query, filter])

  // Lists filtered by dynamic selections for the forms
  const eligibleContacts = useMemo(() => {
    return contacts.filter((contact) =>
      recordDirection === "in" ? canReceivePayment(contact) : canPayContact(contact)
    )
  }, [contacts, recordDirection])

  const openPayments = useMemo(() => {
    return payments.filter(
      (payment) =>
        payment.remaining_amount > 0 &&
        payment.status === "completed" &&
        !payment.reversed_payment_id
    )
  }, [payments])

  const selectedPayment = useMemo(() => {
    return openPayments.find((payment) => payment.id === allocatePaymentId)
  }, [openPayments, allocatePaymentId])

  const eligibleTargets = useMemo(() => {
    return selectedPayment
      ? targets.filter((target) => {
          return (
            target.contact_id === selectedPayment.contact_id &&
            ((selectedPayment.direction === "in" && target.kind === "sale") ||
              (selectedPayment.direction === "out" && target.kind === "purchase"))
          )
        })
      : []
  }, [targets, selectedPayment])

  const selectedTarget = useMemo(() => {
    return eligibleTargets.find(
      (target) => `${target.kind}:${target.id}` === allocateTargetKey
    )
  }, [eligibleTargets, allocateTargetKey])

  // ─── Submissions ────────────────────────────────────────────────────────────

  function submitRecord() {
    startTransition(async () => {
      if (!recordContactId) {
        toast.error("Please select a contact")
        return
      }
      const recordAmountNum = Number(recordAmount)
      if (isNaN(recordAmountNum) || recordAmountNum <= 0) {
        toast.error("Amount must be greater than zero")
        return
      }

      const toastId = toast.loading(
        recordDirection === "in" ? "Recording customer payment..." : "Recording supplier payment..."
      )
      const result = await recordPaymentModuleAction({
        contact_id: recordContactId,
        direction: recordDirection,
        amount: recordAmountNum,
        payment_method: recordMethod,
        reference_number: recordReference.trim() || null,
        notes: recordNotes.trim() || null,
        auto_allocate: true,
      })

      if (!result.ok) {
        toast.error(result.error, { id: toastId })
        return
      }

      toast.success("Payment recorded", { id: toastId })
      setRecordAmount("")
      setRecordContactId("")
      setRecordReference("")
      setRecordNotes("")
      setActiveForm(null)
      router.refresh()
    })
  }

  function submitAllocate() {
    startTransition(async () => {
      if (!allocatePaymentId) {
        toast.error("Please select a payment")
        return
      }
      if (!allocateTargetKey || !selectedTarget) {
        toast.error("Please select a target document")
        return
      }
      const allocateAmountNum = Number(allocateAmount)
      if (isNaN(allocateAmountNum) || allocateAmountNum <= 0) {
        toast.error("Amount must be greater than zero")
        return
      }

      const toastId = toast.loading("Allocating payment...")
      const result = await allocatePaymentModuleAction({
        payment_id: allocatePaymentId,
        sale_id: selectedTarget.kind === "sale" ? selectedTarget.id : null,
        purchase_id: selectedTarget.kind === "purchase" ? selectedTarget.id : null,
        amount: allocateAmountNum,
      })

      if (!result.ok) {
        toast.error(result.error, { id: toastId })
        return
      }

      toast.success("Payment allocated", { id: toastId })
      setAllocatePaymentId("")
      setAllocateTargetKey("")
      setAllocateAmount("")
      setActiveForm(null)
      router.refresh()
    })
  }

  return (
    <div className="flex w-full flex-col gap-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Payments
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Payments apply to opening balance first, then pending bills or purchases.
            Any leftover stays as advance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="shadow-none gap-1.5"
            onClick={() => setActiveForm((prev) => (prev === "record" ? null : "record"))}
          >
            <PlusIcon className="size-3.5" />
            Record Payment
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="shadow-none gap-1.5"
            onClick={() => setActiveForm((prev) => (prev === "allocate" ? null : "allocate"))}
          >
            <LinkIcon className="size-3.5" />
            Manual Allocation
          </Button>
        </div>
      </div>

      {/* Summary Metrics */}
      <section className="grid gap-6 border-b border-border/40 pb-5 sm:grid-cols-4">
        <SummaryMetric label="Received" value={money(totals.received)} />
        <SummaryMetric label="Paid" value={money(totals.paid)} />
        <SummaryMetric label="Net" value={money(totals.received - totals.paid)} />
        <SummaryMetric
          label="Advance"
          value={money(totals.unallocated)}
          danger={totals.unallocated > 0}
        />
      </section>

      {/* ── inline forms ──────────────────────────────────────────────────── */}

      {/* Record Payment Form */}
      {activeForm === "record" && (
        <div className="space-y-4 pb-6 border-b border-border/40">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">Record payment</h2>
            <p className="text-xs text-muted-foreground">
              The system applies this payment automatically. Extra amount remains as advance.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={recordDirection === "in" ? "secondary" : "outline"}
                  className="shadow-none h-9"
                  onClick={() => {
                    setRecordDirection("in")
                    setRecordContactId("")
                  }}
                >
                  Customer (In)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={recordDirection === "out" ? "secondary" : "outline"}
                  className="shadow-none h-9"
                  onClick={() => {
                    setRecordDirection("out")
                    setRecordContactId("")
                  }}
                >
                  Supplier (Out)
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{recordDirection === "in" ? "Customer" : "Supplier"}</Label>
              <Select
                value={recordContactId}
                onValueChange={(value) => value && setRecordContactId(value)}
              >
                <SelectTrigger className="w-full shadow-none h-9">
                  <SelectValue placeholder="Select contact" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleContacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name} {contact.phone ? `(${contact.phone})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={recordAmount}
                onChange={(e) => setRecordAmount(e.target.value)}
                className="shadow-none h-9"
              />
            </div>

            <div className="space-y-2">
              <Label>Method</Label>
              <Select
                value={recordMethod}
                onValueChange={(value) => value && setRecordMethod(value as PaymentMethod)}
              >
                <SelectTrigger className="w-full shadow-none h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {methods.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reference</Label>
              <Input
                value={recordReference}
                onChange={(e) => setRecordReference(e.target.value)}
                placeholder="Optional"
                className="shadow-none h-9"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={recordNotes}
                onChange={(e) => setRecordNotes(e.target.value)}
                placeholder="Optional"
                className="min-h-20 shadow-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shadow-none"
              onClick={() => setActiveForm(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="shadow-none gap-1.5"
              onClick={submitRecord}
              disabled={isPending}
            >
              <PlusIcon className="size-3.5" />
              {isPending ? "Recording..." : "Record payment"}
            </Button>
          </div>
        </div>
      )}

      {/* Manual Allocation Form */}
      {activeForm === "allocate" && (
        <div className="space-y-4 pb-6 border-b border-border/40">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">Manual allocation</h2>
            <p className="text-xs text-muted-foreground">
              Use this only when you need to move remaining advance to a specific document.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Payment</Label>
              <Select
                value={allocatePaymentId}
                onValueChange={(value) => {
                  if (!value) return
                  setAllocatePaymentId(value)
                  setAllocateTargetKey("")
                  const payment = openPayments.find((entry) => entry.id === value)
                  setAllocateAmount(payment ? String(payment.remaining_amount) : "")
                }}
              >
                <SelectTrigger className="w-full shadow-none h-9">
                  <SelectValue placeholder="Select advance payment" />
                </SelectTrigger>
                <SelectContent>
                  {openPayments.map((payment) => (
                    <SelectItem key={payment.id} value={payment.id}>
                      {payment.payment_number} — {payment.contact_name} — {money(payment.remaining_amount)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target Document</Label>
              <Select
                value={allocateTargetKey}
                onValueChange={(value) => value && setAllocateTargetKey(value)}
              >
                <SelectTrigger className="w-full shadow-none h-9">
                  <SelectValue placeholder="Select due document" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleTargets.map((target) => (
                    <SelectItem
                      key={`${target.kind}:${target.id}`}
                      value={`${target.kind}:${target.id}`}
                    >
                      {target.number} — {money(target.due_amount)} due
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={allocateAmount}
                onChange={(e) => setAllocateAmount(e.target.value)}
                className="shadow-none h-9"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shadow-none"
              onClick={() => setActiveForm(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="shadow-none gap-1.5"
              onClick={submitAllocate}
              disabled={isPending}
            >
              <LinkIcon className="size-3.5" />
              {isPending ? "Allocating..." : "Allocate payment"}
            </Button>
          </div>
        </div>
      )}

      {/* Main Lists Section */}
      <section className="space-y-8">
        <PaymentsList
          payments={filtered}
          query={query}
          filter={filter}
          onQueryChange={setQuery}
          onFilterChange={setFilter}
        />
        <DailyTotals totals={dailyTotals} />
      </section>
    </div>
  )
}

// ─── Payments List ────────────────────────────────────────────────────────────

function PaymentsList({
  payments,
  query,
  filter,
  onQueryChange,
  onFilterChange,
}: {
  payments: PaymentRow[]
  query: string
  filter: DirectionFilter
  onQueryChange: (value: string) => void
  onFilterChange: (value: DirectionFilter) => void
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">Payments list</h2>
        <p className="text-xs text-muted-foreground">
          Click a payment to view allocations or reverse it.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search payments"
            className="pl-9 shadow-none h-9 border bg-secondary/50"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {directionFilters.map((entry) => {
            const isSelected = filter === entry.value
            return (
              <button
                key={entry.value}
                type="button"
                onClick={() => onFilterChange(entry.value)}
                className={`h-8 shrink-0 border rounded-md px-3 text-xs font-medium transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {entry.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-secondary/50">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-secondary/60">
              <TableHead className="h-10 px-4 text-xs font-medium text-muted-foreground">
                Payment
              </TableHead>
              <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                Contact
              </TableHead>
              <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                Method
              </TableHead>
              <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                Amount
              </TableHead>
              <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                Advance
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow
                key={payment.id}
                className="cursor-pointer transition-colors hover:bg-secondary/40"
              >
                <TableCell className="px-4 py-3">
                  <Link href={`/payments/${payment.id}`} className="block">
                    <div className="flex items-center gap-2">
                      {payment.direction === "in" ? (
                        <ArrowDownLeftIcon className="size-4 text-emerald-600" />
                      ) : (
                        <ArrowUpRightIcon className="size-4 text-destructive" />
                      )}
                      <span className="font-medium">{payment.payment_number}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {dateFormatter.format(new Date(payment.created_at))}
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="text-sm">
                  <div className="font-medium">
                    {payment.contact_name ?? "Unknown contact"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {payment.contact_phone ?? "No phone"}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  <Badge variant="secondary" className="capitalize shadow-none">
                    {methodLabel(payment.payment_method)}
                  </Badge>
                </TableCell>
                <TableCell
                  className={cn(
                    "text-sm font-semibold",
                    payment.direction === "in"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive"
                  )}
                >
                  {payment.direction === "in" ? "+" : "-"}
                  {money(payment.amount)}
                </TableCell>
                <TableCell className="text-sm">
                  <div>
                    {payment.remaining_amount > 0 ? (
                      <span className="font-medium text-destructive">
                        {money(payment.remaining_amount)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {payment.opening_applied_amount > 0 ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Opening {money(payment.opening_applied_amount)}
                      </div>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!payments.length ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  No payments found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

// ─── Daily Totals ─────────────────────────────────────────────────────────────

function DailyTotals({ totals }: { totals: DailyPaymentTotal[] }) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">
          Daily payment totals
        </h2>
        <p className="text-xs text-muted-foreground">
          Recent totals grouped by date and method.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border bg-secondary/50">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-secondary/60">
              <TableHead className="h-10 px-4 text-xs font-medium text-muted-foreground">
                Date
              </TableHead>
              <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                Method
              </TableHead>
              <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                Received
              </TableHead>
              <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                Paid
              </TableHead>
              <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                Net
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {totals.map((total) => (
              <TableRow
                key={`${total.payment_date}:${total.payment_method}`}
                className="hover:bg-secondary/40"
              >
                <TableCell className="px-4 py-3 text-sm">
                  {dateFormatter.format(new Date(total.payment_date))}
                </TableCell>
                <TableCell className="text-sm capitalize">
                  {methodLabel(total.payment_method)}
                </TableCell>
                <TableCell className="text-sm text-emerald-600 dark:text-emerald-400">
                  {money(total.received_amount)}
                </TableCell>
                <TableCell className="text-sm text-destructive">
                  {money(total.paid_amount)}
                </TableCell>
                <TableCell className="text-sm font-medium">
                  {money(total.net_amount)}
                </TableCell>
              </TableRow>
            ))}
            {!totals.length ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  No payment totals yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

// ─── Helper components ────────────────────────────────────────────────────────

function SummaryMetric({
  label,
  value,
  danger,
}: {
  label: string
  value: string
  danger?: boolean
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold text-foreground",
          danger && "text-destructive"
        )}
      >
        {value}
      </p>
    </div>
  )
}
