"use client"

import { useState } from "react"
import {
  PackageIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import type { ProductRow } from "@/app/(app)/products/page"
import type { ProductPayload, StockMovementRow } from "@/app/(app)/products/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type ProductFormState = {
  name: string
  sku: string
  unit_name: string
  loose_sale_price: string
  loose_cost_price: string
  has_box: boolean
  box_units: string
  box_sale_price: string
  box_cost_price: string
  reorder_level: string
  opening_stock: string
}

export const correctionReasons = [
  "Damaged",
  "Expired",
  "Missing",
  "Free sample",
  "Personal use",
  "Counting correction",
  "Other",
]

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
})

export function money(value: number | null) {
  return value === null ? "-" : moneyFormatter.format(Number(value))
}

export function numberText(value: number) {
  return Number(value).toLocaleString("en-IN")
}

export function statusFor(product: ProductRow) {
  if (!product.is_active) {
    return { label: "Inactive", variant: "outline" as const }
  }
  if (product.stock_on_hand === 0) {
    return { label: "Out", variant: "destructive" as const }
  }
  if (product.stock_on_hand <= product.reorder_level) {
    return { label: "Low", variant: "secondary" as const }
  }
  return { label: "Active", variant: "outline" as const }
}

function emptyForm(): ProductFormState {
  return {
    name: "",
    sku: "",
    unit_name: "piece",
    loose_sale_price: "",
    loose_cost_price: "",
    has_box: false,
    box_units: "",
    box_sale_price: "",
    box_cost_price: "",
    reorder_level: "0",
    opening_stock: "0",
  }
}

function formFromProduct(product: ProductRow): ProductFormState {
  return {
    name: product.name,
    sku: product.sku ?? "",
    unit_name: product.unit_name,
    loose_sale_price: String(product.loose_sale_price),
    loose_cost_price: String(product.loose_cost_price),
    has_box: product.has_box,
    box_units: product.box_units === null ? "" : String(product.box_units),
    box_sale_price:
      product.box_sale_price === null ? "" : String(product.box_sale_price),
    box_cost_price:
      product.box_cost_price === null ? "" : String(product.box_cost_price),
    reorder_level: String(product.reorder_level),
    opening_stock: "0",
  }
}

export function toNumber(value: string, field: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${field} must be zero or more`)
  }
  return parsed
}

export function toInteger(value: string, field: string) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${field} must be a whole number`)
  }
  return parsed
}

export function payloadFromForm(
  form: ProductFormState,
  includeOpeningStock: boolean
) {
  if (!form.name.trim()) {
    throw new Error("Product name is required")
  }
  if (!form.unit_name.trim()) {
    throw new Error("Unit name is required")
  }

  const payload: ProductPayload = {
    name: form.name.trim(),
    sku: form.sku.trim() || null,
    unit_name: form.unit_name.trim(),
    loose_sale_price: toNumber(form.loose_sale_price, "Loose sale price"),
    loose_cost_price: toNumber(form.loose_cost_price, "Loose cost price"),
    has_box: form.has_box,
    box_units: null,
    box_sale_price: null,
    box_cost_price: null,
    reorder_level: toInteger(form.reorder_level || "0", "Reorder level"),
  }

  if (includeOpeningStock) {
    payload.opening_stock = toInteger(
      form.opening_stock || "0",
      "Opening stock"
    )
  }

  if (form.has_box) {
    payload.box_units = toInteger(form.box_units, "Box units")
    payload.box_sale_price = toNumber(form.box_sale_price, "Box sale price")
    payload.box_cost_price = toNumber(form.box_cost_price, "Box cost price")

    if (payload.box_units <= 1) {
      throw new Error("Box units must be more than 1")
    }
  }

  return payload
}

function movementLabel(type: string) {
  return type.replaceAll("_", " ")
}

export function ProductForm({
  mode,
  product,
  pending,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit"
  product?: ProductRow
  pending: boolean
  onSubmit: (payload: ProductPayload) => void
  onCancel?: () => void
}) {
  const [form, setForm] = useState<ProductFormState>(
    product ? formFromProduct(product) : emptyForm()
  )

  function patch(update: Partial<ProductFormState>) {
    setForm((current) => ({ ...current, ...update }))
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        try {
          onSubmit(payloadFromForm(form, mode === "create"))
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Check product")
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Name"
          value={form.name}
          onChange={(value) => patch({ name: value })}
        />
        <TextField
          label="SKU"
          value={form.sku}
          onChange={(value) => patch({ sku: value })}
          placeholder="Optional"
        />
        <TextField
          label="Unit name"
          value={form.unit_name}
          onChange={(value) => patch({ unit_name: value })}
        />
        <TextField
          label="Reorder level"
          type="number"
          value={form.reorder_level}
          onChange={(value) => patch({ reorder_level: value })}
        />
        <TextField
          label="Loose sale price"
          type="number"
          step="0.01"
          value={form.loose_sale_price}
          onChange={(value) => patch({ loose_sale_price: value })}
        />
        <TextField
          label="Loose cost price"
          type="number"
          step="0.01"
          value={form.loose_cost_price}
          onChange={(value) => patch({ loose_cost_price: value })}
        />
        {mode === "create" ? (
          <TextField
            label="Opening stock"
            type="number"
            value={form.opening_stock}
            onChange={(value) => patch({ opening_stock: value })}
          />
        ) : null}
      </div>

      <label className="flex items-center justify-between gap-4 py-2 text-sm">
        <span>
          <span className="font-semibold text-foreground">Has box pricing</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Enable when the product is sold as both loose units and boxes.
          </span>
        </span>
        <Switch
          checked={form.has_box}
          onCheckedChange={(checked) => patch({ has_box: checked })}
        />
      </label>

      {form.has_box ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Box units"
            type="number"
            value={form.box_units}
            onChange={(value) => patch({ box_units: value })}
          />
          <TextField
            label="Box sale price"
            type="number"
            step="0.01"
            value={form.box_sale_price}
            onChange={(value) => patch({ box_sale_price: value })}
          />
          <TextField
            label="Box cost price"
            type="number"
            step="0.01"
            value={form.box_cost_price}
            onChange={(value) => patch({ box_cost_price: value })}
          />
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            className="shadow-none cursor-pointer"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        <Button disabled={pending} type="submit" className="shadow-none">
          {pending ? "Saving..." : mode === "create" ? "Create product" : "Save changes"}
        </Button>
      </div>
    </form>
  )
}

export function ProductDetailsSection({
  product,
  pending,
  onDeactivate,
  onReactivate,
}: {
  product: ProductRow
  pending: boolean
  onDeactivate: () => void
  onReactivate: () => void
}) {
  const status = statusFor(product)
  const stockValue = product.stock_on_hand * Number(product.loose_cost_price)

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-foreground">Product details</h2>
          <Badge variant={status.variant} className="shadow-none">{status.label}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Key metrics, unit definitions, and pricing settings for {product.name}{product.sku ? ` · SKU: ${product.sku}` : ""}.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4 pb-4 border-b border-border/40">
        <div>
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Current Stock</span>
          <p className="text-xl font-bold text-foreground mt-1">{numberText(product.stock_on_hand)}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Stock Value</span>
          <p className="text-xl font-bold text-foreground mt-1">{money(stockValue)}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Loose Sale</span>
          <p className="text-xl font-bold text-foreground mt-1">{money(product.loose_sale_price)}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Loose Cost</span>
          <p className="text-xl font-bold text-foreground mt-1">{money(product.loose_cost_price)}</p>
        </div>
      </div>

      <div className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
        <DetailLine label="Unit" value={product.unit_name} />
        <DetailLine label="Reorder level" value={numberText(product.reorder_level)} />
        <DetailLine
          label="Box units"
          value={product.has_box ? `${product.box_units} units` : "-"}
        />
        <DetailLine
          label="Box sale"
          value={product.has_box ? money(product.box_sale_price) : "-"}
        />
        <DetailLine
          label="Box cost"
          value={product.has_box ? money(product.box_cost_price) : "-"}
        />
      </div>

      <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          {product.is_active
            ? "Product is active and available for billing and inventory."
            : "Product is inactive. Historical data remains visible."}
        </p>
        {product.is_active ? (
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
      </div>
    </div>
  )
}

export function CorrectStockForm({
  product,
  pending,
  onSubmit,
}: {
  product: ProductRow
  pending: boolean
  onSubmit: (actualStock: number, reason: string) => void
}) {
  const [actual, setActual] = useState(String(product.stock_on_hand))
  const [reason, setReason] = useState("Counting correction")
  const actualNumber = Number(actual)
  const delta = Number.isFinite(actualNumber)
    ? actualNumber - product.stock_on_hand
    : 0

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        try {
          const actualStock = toInteger(actual, "Actual stock")
          if (!reason.trim()) throw new Error("Reason is required")
          onSubmit(actualStock, reason.trim())
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Check stock")
        }
      }}
    >
      <div className="rounded-lg border bg-secondary/30 p-4 text-sm">
        System: {numberText(product.stock_on_hand)} · Actual:{" "}
        {Number.isFinite(actualNumber) ? numberText(actualNumber) : "-"} ·
        Delta: {delta >= 0 ? "+" : ""}
        {numberText(delta)}
      </div>
      <TextField
        label="Actual counted stock"
        type="number"
        value={actual}
        onChange={setActual}
      />
      <div className="space-y-2">
        <Label>Reason</Label>
        <NativeSelect
          className="w-full"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        >
          {correctionReasons.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex justify-end">
        <Button disabled={pending} type="submit" variant="destructive" className="shadow-none">
          {pending ? "Saving..." : "Apply correction"}
        </Button>
      </div>
    </form>
  )
}

export function CorrectStockCard({
  product,
  pending,
  onSubmit,
}: {
  product: ProductRow
  pending: boolean
  onSubmit: (actualStock: number, reason: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TriangleAlertIcon className="size-4 text-muted-foreground" />
          Correct stock
        </CardTitle>
      </CardHeader>
      <CardContent>
        <CorrectStockForm product={product} pending={pending} onSubmit={onSubmit} />
      </CardContent>
    </Card>
  )
}

export function StockHistorySection({
  movements,
}: {
  movements: StockMovementRow[]
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">Stock history</h2>
        <p className="text-xs text-muted-foreground">
          Chronological history of stock adjustments, billing movements, and counts.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border bg-secondary/50">
        {movements.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-secondary/60">
                  <TableHead className="h-10 text-xs font-medium text-muted-foreground px-4">Date</TableHead>
                  <TableHead className="h-10 text-xs font-medium text-muted-foreground">Type</TableHead>
                  <TableHead className="h-10 text-xs font-medium text-muted-foreground">Quantity</TableHead>
                  <TableHead className="h-10 text-xs font-medium text-muted-foreground px-4">Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((movement) => (
                  <TableRow key={movement.id} className="transition-colors hover:bg-secondary/40">
                    <TableCell className="whitespace-nowrap text-sm px-4 py-3 text-foreground">
                      {new Intl.DateTimeFormat("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(movement.occurred_at))}
                    </TableCell>
                    <TableCell className="text-sm capitalize text-muted-foreground">
                      {movementLabel(movement.movement_type)}
                    </TableCell>
                    <TableCell
                      className={
                        movement.quantity_delta > 0
                          ? "text-sm font-semibold text-emerald-600 dark:text-emerald-400"
                          : movement.quantity_delta < 0
                            ? "text-sm font-semibold text-rose-600 dark:text-rose-400"
                            : "text-sm font-semibold"
                      }
                    >
                      {movement.quantity_delta > 0 ? "+" : ""}
                      {movement.quantity_delta}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground px-4 py-3">
                      {movement.reason || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center p-6">
            <div className="flex size-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <PackageIcon className="size-4" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">No stock history</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Movements appear here after stock, sale, purchase, or correction activity.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-2 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
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
        className="shadow-none"
        type={type}
        step={step}
        value={value}
        placeholder={placeholder}
        min={type === "number" ? "0" : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
