"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon, ReceiptTextIcon, SearchIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import Link from "next/link"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

export type SaleRow = {
  id: string
  sale_number: string
  sale_date: string
  status: string
  total_amount: number
  customer_id: string
  created_at: string
  customer_name: string | null
  customer_phone: string | null
  paid_amount: number
  due_amount: number
  payment_status: string | null
}

type FilterValue = "all" | "draft" | "pending" | "partial" | "paid" | "cancelled"

const filters: { label: string; value: FilterValue }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Pending", value: "pending" },
  { label: "Partial", value: "partial" },
  { label: "Paid", value: "paid" },
  { label: "Cancelled", value: "cancelled" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
})

function money(value: number) {
  return moneyFormatter.format(Number(value))
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" })

function resolvedFilter(sale: SaleRow): FilterValue {
  if (sale.status === "cancelled") return "cancelled"
  if (sale.status === "draft") return "draft"
  // Derive from amounts — more reliable than payment_status field
  if (sale.due_amount <= 0 && sale.paid_amount > 0) return "paid"
  if (sale.paid_amount > 0 && sale.due_amount > 0) return "partial"
  // Fallback to payment_status for edge cases
  if (sale.payment_status === "paid") return "paid"
  if (sale.payment_status === "partial") return "partial"
  return "pending"
}

function resolvedLabel(sale: SaleRow): string {
  if (sale.status === "cancelled") return "Cancelled"
  if (sale.status === "draft") return "Draft"
  const f = resolvedFilter(sale)
  return f.charAt(0).toUpperCase() + f.slice(1)
}

function resolvedVariant(sale: SaleRow): "default" | "secondary" | "outline" | "destructive" {
  if (sale.status === "cancelled") return "destructive"
  if (sale.status === "draft") return "secondary"
  const f = resolvedFilter(sale)
  if (f === "paid") return "outline"
  if (f === "partial") return "default"
  return "outline"
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SalesWorkspace({ initialSales }: { initialSales: SaleRow[] }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<FilterValue>("all")

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()

    return initialSales.filter((sale) => {
      const matchesSearch =
        !term ||
        sale.sale_number.toLowerCase().includes(term) ||
        (sale.customer_name ?? "").toLowerCase().includes(term) ||
        (sale.customer_phone ?? "").toLowerCase().includes(term)

      const saleFilter = resolvedFilter(sale)
      const matchesFilter = filter === "all" || saleFilter === filter

      return matchesSearch && matchesFilter
    })
  }, [initialSales, query, filter])

  return (
    <div className="flex w-full flex-col gap-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sales</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            All bills, payment status, and customer transactions at a glance.
          </p>
        </div>
        <Link
          href="/sales/new"
          className={cn(buttonVariants({ size: "sm" }), "shadow-none gap-1.5")}
        >
          <PlusIcon className="size-4" />
          New Bill
        </Link>
      </div>

      {/* Sales list section */}
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Sales list</h2>
          <p className="text-xs text-muted-foreground">
            Click a bill to open its detail page.
          </p>
        </div>

        {/* Search + filter bar */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search bill number or customer"
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

        {/* Table */}
        <div className="overflow-hidden rounded-lg border bg-secondary/50">
          {filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-secondary/60">
                  <TableHead className="h-10 min-w-[200px] px-4 text-xs font-medium text-muted-foreground">
                    Bill
                  </TableHead>
                  <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                    Customer
                  </TableHead>
                  <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                    Date
                  </TableHead>
                  <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                    Total
                  </TableHead>
                  <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                    Paid
                  </TableHead>
                  <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                    Due
                  </TableHead>
                  <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((sale) => {
                  const variant = resolvedVariant(sale)
                  const label = resolvedLabel(sale)
                  const dueAmount = Number(sale.due_amount)
                  const paidAmount = Number(sale.paid_amount)

                  return (
                    <TableRow
                      key={sale.id}
                      className="cursor-pointer transition-colors hover:bg-secondary/40"
                      onClick={() => router.push(`/sales/${sale.id}`)}
                    >
                      <TableCell className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-secondary/60 text-secondary-foreground">
                            <ReceiptTextIcon className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {sale.sale_number}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {dateFormatter.format(new Date(sale.sale_date))}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {sale.customer_name ?? "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {sale.customer_phone ?? "No phone"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {dateFormatter.format(new Date(sale.sale_date))}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-foreground whitespace-nowrap">
                        {money(Number(sale.total_amount))}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-foreground whitespace-nowrap">
                        {money(paidAmount)}
                      </TableCell>
                      <TableCell className="text-sm font-medium whitespace-nowrap">
                        <span className={dueAmount > 0 ? "text-destructive" : "text-foreground"}>
                          {money(dueAmount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={variant}
                          className="shadow-none rounded-md font-medium capitalize"
                        >
                          {label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <ReceiptTextIcon className="size-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-foreground">
                  {query || filter !== "all" ? "No matching sales" : "No sales yet"}
                </h2>
                <p className="max-w-sm text-xs text-muted-foreground">
                  {query || filter !== "all"
                    ? "Try a different search term or filter."
                    : "Create a bill to start the sales workflow."}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
