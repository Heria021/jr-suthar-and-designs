"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowDownLeftIcon,
  ArrowLeftIcon,
  ArrowUpRightIcon,
  RotateCcwIcon,
} from "lucide-react"
import { toast } from "sonner"

import { reversePaymentModuleAction } from "@/app/(app)/payments/actions"
import { Button, buttonVariants } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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

export type PaymentDetail = {
  id: string
  payment_number: string
  contact_id: string
  contact_name: string
  contact_phone: string | null
  contact_type: string
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
  reversed_by_payment_id: string | null
  reversed_by_payment_number: string | null
}

export type PaymentAllocationRow = {
  id: string
  kind: "sale" | "purchase"
  document_id: string
  document_number: string
  document_date: string
  document_total: number
  allocated_amount: number
  created_at: string
}

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
  return method.charAt(0).toUpperCase() + method.slice(1)
}

export function PaymentDetailClient({
  payment,
  allocations,
}: {
  payment: PaymentDetail
  allocations: PaymentAllocationRow[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [reason, setReason] = useState("")
  const documentAllocatedAmount = payment.document_allocated_amount
  const openingAppliedAmount = payment.opening_applied_amount
  const remainingAmount = payment.remaining_amount
  const canReverse =
    payment.status === "completed" &&
    !payment.reversed_payment_id &&
    !payment.reversed_by_payment_id

  function reversePayment() {
    startTransition(async () => {
      const toastId = toast.loading("Reversing payment...")
      const result = await reversePaymentModuleAction(payment.id, reason)

      if (!result.ok) {
        toast.error(result.error, { id: toastId })
        return
      }

      toast.success("Payment reversed", { id: toastId })
      router.refresh()
    })
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            {payment.direction === "in" ? (
              <ArrowDownLeftIcon className="size-5 text-emerald-600" />
            ) : (
              <ArrowUpRightIcon className="size-5 text-destructive" />
            )}
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {payment.payment_number}
            </h1>
          </div>
          <p className="max-w-xl text-sm text-muted-foreground">
            {payment.contact_name} ·{" "}
            {dateFormatter.format(new Date(payment.created_at))} ·{" "}
            {methodLabel(payment.payment_method)}
          </p>
        </div>
        <Link
          href="/payments"
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            "gap-1.5 shadow-none"
          )}
        >
          <ArrowLeftIcon className="size-3.5" />
          Back
        </Link>
      </div>

      <section className="grid gap-6 border-b border-border/40 pb-5 sm:grid-cols-4">
        <SummaryMetric label="Amount" value={money(payment.amount)} />
        <SummaryMetric label="Bills" value={money(documentAllocatedAmount)} />
        <SummaryMetric label="Opening" value={money(openingAppliedAmount)} />
        <SummaryMetric
          label="Advance"
          value={money(remainingAmount)}
          danger={remainingAmount > 0}
        />
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <InfoBlock
          title="Contact"
          rows={[
            ["Name", payment.contact_name],
            ["Phone", payment.contact_phone ?? "-"],
            ["Type", payment.contact_type.replaceAll("_", " ")],
          ]}
        />
        <InfoBlock
          title="Payment details"
          rows={[
            ["Direction", payment.direction === "in" ? "Received" : "Paid"],
            ["Status", payment.status],
            ["Reference", payment.reference_number ?? "-"],
            ["Notes", payment.notes ?? "-"],
          ]}
        />
      </section>

      {payment.reversed_payment_id ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          This is a reversal payment for another payment. Reason:{" "}
          {payment.reversal_reason ?? "-"}
        </div>
      ) : null}

      {payment.reversed_by_payment_id ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          This payment has already been reversed by{" "}
          <Link
            href={`/payments/${payment.reversed_by_payment_id}`}
            className="font-medium underline underline-offset-4"
          >
            {payment.reversed_by_payment_number}
          </Link>
          .
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">
            Allocations
          </h2>
          <p className="text-xs text-muted-foreground">
            Documents this payment has been applied to. Opening balance is applied
            in the summary because it is account-level.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border bg-secondary/50">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-secondary/60">
                <TableHead className="h-10 px-4 text-xs font-medium text-muted-foreground">
                  Document
                </TableHead>
                <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                  Date
                </TableHead>
                <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                  Total
                </TableHead>
                <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                  Allocated
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allocations.map((allocation) => (
                <TableRow key={allocation.id} className="hover:bg-secondary/40">
                  <TableCell className="px-4 py-3 text-sm font-medium">
                    <Link
                      href={
                        allocation.kind === "sale"
                          ? `/sales/${allocation.document_id}`
                          : `/purchases/${allocation.document_id}`
                      }
                      className="underline-offset-4 hover:underline"
                    >
                      {allocation.document_number}
                    </Link>
                    <div className="text-xs capitalize text-muted-foreground">
                      {allocation.kind}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {allocation.document_date
                      ? dateFormatter.format(new Date(allocation.document_date))
                      : "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {money(allocation.document_total)}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {money(allocation.allocated_amount)}
                  </TableCell>
                </TableRow>
              ))}
              {!allocations.length ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    This payment is not allocated yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </section>

      {canReverse ? (
        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">
              Reverse payment
            </h2>
            <p className="text-xs text-muted-foreground">
              Reversal creates an opposite payment and reverses all allocations.
            </p>
          </div>
          <div className="space-y-4 rounded-lg border bg-background p-4">
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="min-h-20 shadow-none"
                placeholder="Required"
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="gap-1.5 shadow-none"
                onClick={reversePayment}
                disabled={isPending}
              >
                <RotateCcwIcon className="size-3.5" />
                {isPending ? "Reversing..." : "Reverse payment"}
              </Button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}

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

function InfoBlock({
  title,
  rows,
}: {
  title: string
  rows: [string, string][]
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="space-y-2 rounded-lg border bg-secondary/50 px-4 py-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right font-medium capitalize">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
