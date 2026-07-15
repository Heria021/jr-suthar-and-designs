"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { PackageIcon, PlusIcon, SearchIcon } from "lucide-react"

import type { ProductRow } from "@/app/(app)/products/page"
import { money, numberText, statusFor } from "@/components/products/product-form"
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

type FilterValue = "all" | "low" | "out" | "inactive"

const filters: { label: string; value: FilterValue }[] = [
  { label: "All", value: "all" },
  { label: "Low stock", value: "low" },
  { label: "Out of stock", value: "out" },
  { label: "Inactive", value: "inactive" },
]

export function ProductsWorkspace({
  initialProducts,
}: {
  initialProducts: ProductRow[]
}) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<FilterValue>("all")

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()

    return initialProducts.filter((product) => {
      const matchesSearch =
        !term ||
        product.name.toLowerCase().includes(term) ||
        product.sku?.toLowerCase().includes(term)

      const matchesFilter =
        filter === "all" ||
        (filter === "low" &&
          product.is_active &&
          product.stock_on_hand > 0 &&
          product.stock_on_hand <= product.reorder_level) ||
        (filter === "out" &&
          product.is_active &&
          product.stock_on_hand === 0) ||
        (filter === "inactive" && !product.is_active)

      return matchesSearch && matchesFilter
    })
  }, [filter, initialProducts, query])

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Products
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Manage inventory, stock levels, product pricing, and packaging.
          </p>
        </div>
        <Link
          href="/products/new"
          className={buttonVariants({ variant: "default", size: "sm" })}
        >
          <PlusIcon className="size-4" />
          New Product
        </Link>
      </div>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Product list</h2>
          <p className="text-xs text-muted-foreground">
            Click a product to open its detail page and edit form.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="relative w-full">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products or SKU"
              className="h-9 border bg-secondary/50 pl-9 shadow-none focus-visible:ring-1"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {filters.map((item) => {
              const isSelected = filter === item.value

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className={
                    isSelected
                      ? "h-8 shrink-0 rounded-md border border-primary bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm"
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
                    <TableHead className="h-10 min-w-[230px] px-4 text-xs font-medium text-muted-foreground">
                      Product
                    </TableHead>
                    <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                      Unit
                    </TableHead>
                    <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                      Current stock
                    </TableHead>
                    <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                      Reorder
                    </TableHead>
                    <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                      Loose sale
                    </TableHead>
                    <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                      Box info
                    </TableHead>
                    <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((product) => {
                    const status = statusFor(product)
                    const lowStock =
                      product.stock_on_hand <= product.reorder_level &&
                      product.is_active

                    return (
                      <TableRow
                        key={product.id}
                        className="cursor-pointer transition-colors hover:bg-secondary/40"
                        onClick={() => router.push(`/products/${product.id}`)}
                      >
                        <TableCell className="px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-secondary/60 text-secondary-foreground">
                              <PackageIcon className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {product.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {product.sku || "No SKU"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {product.unit_name}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium text-foreground">
                            {numberText(product.stock_on_hand)}
                          </div>
                          {lowStock ? (
                            <div className="mt-0.5 flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-500">
                              <span className="size-1.5 rounded-full bg-amber-500" />
                              Needs attention
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {numberText(product.reorder_level)}
                        </TableCell>
                        <TableCell className="text-sm font-medium text-foreground">
                          {money(product.loose_sale_price)}
                        </TableCell>
                        <TableCell>
                          {product.has_box ? (
                            <div>
                              <div className="text-sm text-foreground">
                                {product.box_units} units
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {money(product.box_sale_price)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={status.variant}
                            className="rounded-md font-medium"
                          >
                            {status.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              title="No products found"
              description="Try a different search or filter."
            />
          )}
        </div>
      </section>
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
        <PackageIcon className="size-5" />
      </div>
      <div className="space-y-1">
        <h2 className="font-medium">{title}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
