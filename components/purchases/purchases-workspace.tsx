"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon, SearchIcon, TruckIcon } from "lucide-react"

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
import { cn } from "@/lib/utils"

export type PurchaseRow = {
  id: string
  purchase_number: string
  supplier_invoice_number: string | null
  purchase_date: string
  status: string
  total_amount: number
  supplier_id: string
  created_at: string
  supplier_name: string | null
  supplier_phone: string | null
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

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
})

function money(value: number) {
  return moneyFormatter.format(Number(value))
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" })

function resolvedFilter(purchase: PurchaseRow): FilterValue {
  if (purchase.status === "cancelled") return "cancelled"
  if (purchase.status === "draft") return "draft"
  if (purchase.due_amount <= 0 && purchase.paid_amount > 0) return "paid"
  if (purchase.paid_amount > 0 && purchase.due_amount > 0) return "partial"
  if (purchase.payment_status === "paid") return "paid"
  if (purchase.payment_status === "partial") return "partial"
  return "pending"
}

function resolvedLabel(purchase: PurchaseRow) {
  const filter = resolvedFilter(purchase)
  return filter.charAt(0).toUpperCase() + filter.slice(1)
}

function resolvedVariant(
  purchase: PurchaseRow
): "default" | "secondary" | "outline" | "destructive" {
  const filter = resolvedFilter(purchase)
  if (filter === "cancelled") return "destructive"
  if (filter === "draft") return "secondary"
  if (filter === "partial") return "default"
  return "outline"
}

export function PurchasesWorkspace({
  initialPurchases,
}: {
  initialPurchases: PurchaseRow[]
}) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<FilterValue>("all")

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()

    return initialPurchases.filter((purchase) => {
      const matchesSearch =
        !term ||
        purchase.purchase_number.toLowerCase().includes(term) ||
        (purchase.supplier_invoice_number ?? "").toLowerCase().includes(term) ||
        (purchase.supplier_name ?? "").toLowerCase().includes(term) ||
        (purchase.supplier_phone ?? "").toLowerCase().includes(term)

      const purchaseFilter = resolvedFilter(purchase)
      return matchesSearch && (filter === "all" || purchaseFilter === filter)
    })
  }, [filter, initialPurchases, query])

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Purchases
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Restocking bills, supplier dues, and purchase payment status.
          </p>
        </div>
        <Link
          href="/purchases/new"
          className={cn(buttonVariants({ size: "sm" }), "gap-1.5 shadow-none")}
        >
          <PlusIcon className="size-4" />
          New Purchase
        </Link>
      </div>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">
            Purchase list
          </h2>
          <p className="text-xs text-muted-foreground">
            Click a purchase to open items, finalization, payment, and
            cancellation controls.
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search purchase, supplier invoice, or supplier"
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
                  className={
                    isSelected
                      ? "h-8 shrink-0 rounded-md border bg-primary px-3 text-xs font-medium text-primary-foreground"
                      : "h-8 shrink-0 rounded-md border bg-secondary/50 px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  }
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border bg-secondary/50">
          {filtered.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-secondary/60">
                    <TableHead className="h-10 min-w-[210px] px-4 text-xs font-medium text-muted-foreground">
                      Purchase
                    </TableHead>
                    <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                      Supplier
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
                  {filtered.map((purchase) => (
                    <TableRow
                      key={purchase.id}
                      className="cursor-pointer transition-colors hover:bg-secondary/40"
                      onClick={() => router.push(`/purchases/${purchase.id}`)}
                    >
                      <TableCell className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-secondary/60 text-secondary-foreground">
                            <TruckIcon className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {purchase.purchase_number}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {purchase.supplier_invoice_number ||
                                "No supplier invoice"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <p className="truncate text-sm font-medium text-foreground">
                          {purchase.supplier_name ?? "-"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {purchase.supplier_phone ?? "No phone"}
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {dateFormatter.format(new Date(purchase.purchase_date))}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {money(purchase.total_amount)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {money(purchase.paid_amount)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {money(purchase.due_amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={resolvedVariant(purchase)}
                          className="rounded-md font-medium"
                        >
                          {resolvedLabel(purchase)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <TruckIcon className="size-5" />
              </div>
              <div className="space-y-1">
                <h2 className="font-medium">No purchases found</h2>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Try another search or create a new purchase draft.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
