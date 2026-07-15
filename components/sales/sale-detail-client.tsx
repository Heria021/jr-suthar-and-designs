"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  DownloadIcon,
  PlusIcon,
  PrinterIcon,
  ReceiptIndianRupeeIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  addSaleItemAction,
  cancelSaleAction,
  finalizeSaleAction,
  recordSalePaymentAction,
  removeSaleItemAction,
  updateSaleItemAction,
} from "@/app/(app)/sales/actions"
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
import { Separator } from "@/components/ui/separator"
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
import type { SaleInvoiceData } from "@/lib/invoice/sales"

export type ProductOption = {
  id: string
  name: string
  sku: string | null
  unit_name: string
  loose_sale_price: number
  has_box: boolean
  box_units: number | null
  box_sale_price: number | null
  stock_on_hand: number
  is_active: boolean
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

function today() {
  return new Date().toISOString().slice(0, 10)
}

function statusVariant(
  status: string
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "cancelled") return "destructive"
  if (status === "draft") return "secondary"
  return "outline"
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SaleDetailClient({
  invoice,
  products,
}: {
  invoice: SaleInvoiceData
  products: ProductOption[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isDraft = invoice.sale.status === "draft"
  const isFinalized = invoice.sale.status === "finalized"
  const isCancelled = invoice.sale.status === "cancelled"

  async function run(
    loading: string,
    success: string,
    action: () => Promise<{ ok: true } | { ok: false; error: string }>
  ) {
    const toastId = toast.loading(loading)
    const result = await action()
    if (!result.ok) {
      toast.error(result.error, { id: toastId })
      return
    }
    toast.success(success, { id: toastId })
    router.refresh()
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {invoice.sale.sale_number}
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            {invoice.customer.name} ·{" "}
            {dateFormatter.format(new Date(invoice.sale.sale_date))}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isFinalized && (
            <>
              <Link
                href={`/sales/${invoice.sale.id}/print`}
                target="_blank"
                className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "shadow-none gap-1.5")}
              >
                <PrinterIcon className="size-3.5" />
                Print
              </Link>
              <a
                href={`/sales/${invoice.sale.id}/invoice`}
                className={cn(buttonVariants({ size: "sm" }), "shadow-none gap-1.5")}
              >
                <DownloadIcon className="size-3.5" />
                Download PDF
              </a>
            </>
          )}
          <Link
            href="/sales"
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "shadow-none")}
          >
            Back
          </Link>
        </div>
      </div>

      {/* Summary metrics */}
      <div className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-foreground">Bill summary</h2>
            <Badge
              variant={statusVariant(invoice.sale.status)}
              className="shadow-none capitalize"
            >
              {invoice.sale.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Payment breakdown for bill {invoice.sale.sale_number}.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-3 pb-4 border-b border-border/40">
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total</span>
            <p className="text-xl font-bold text-foreground mt-1">{money(invoice.sale.total_amount)}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Paid</span>
            <p className="text-xl font-bold text-foreground mt-1">{money(invoice.balance.paid_amount)}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Due</span>
            <p className={cn("text-xl font-bold mt-1", invoice.balance.due_amount > 0 ? "text-destructive" : "text-foreground")}>
              {money(invoice.balance.due_amount)}
            </p>
          </div>
        </div>
      </div>

      {/* Add item form — draft only */}
      {isDraft && (
        <div className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">Add item</h2>
            <p className="text-xs text-muted-foreground">
              Select a product, mode, and quantity to add to the bill.
            </p>
          </div>
          <AddItemPanel
            saleId={invoice.sale.id}
            products={products}
            pending={isPending}
            onSubmit={(formData) =>
              startTransition(() =>
                void run("Adding item...", "Item added", () =>
                  addSaleItemAction(formData)
                )
              )
            }
          />
        </div>
      )}

      {/* Items table */}
      <div className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Bill items</h2>
          <p className="text-xs text-muted-foreground">
            {isDraft
              ? "Edit quantities, mode, or price and hit Update. Remove items with the trash icon."
              : "Line items included in this bill."}
          </p>
        </div>
        <ItemsTable
          saleId={invoice.sale.id}
          isDraft={isDraft}
          items={invoice.items}
          pending={isPending}
          onUpdate={(formData) =>
            startTransition(() =>
              void run("Updating item...", "Item updated", () =>
                updateSaleItemAction(formData)
              )
            )
          }
          onRemove={(formData) =>
            startTransition(() =>
              void run("Removing item...", "Item removed", () =>
                removeSaleItemAction(formData)
              )
            )
          }
        />
      </div>

      {/* Finalize — draft only */}
      {isDraft && (
        <div className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">Finalize bill</h2>
            <p className="text-xs text-muted-foreground">
              Apply a discount and record the initial payment to finalize.
            </p>
          </div>
          <FinalizePanel
            saleId={invoice.sale.id}
            discount={invoice.sale.discount_amount}
            pending={isPending}
            onSubmit={(formData) =>
              startTransition(() =>
                void run("Finalizing bill...", "Bill finalized", () =>
                  finalizeSaleAction(formData)
                )
              )
            }
          />
        </div>
      )}

      {/* Record payment + Cancel — finalized only */}
      {isFinalized && (
        <>
          <div className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-foreground">Record payment</h2>
              <p className="text-xs text-muted-foreground">
                Log a payment received against this bill.
              </p>
            </div>
            <LaterPaymentPanel
              saleId={invoice.sale.id}
              customerId={invoice.sale.customer_id}
              due={invoice.balance.due_amount}
              pending={isPending}
              onSubmit={(formData) =>
                startTransition(() =>
                  void run("Recording payment...", "Payment recorded", () =>
                    recordSalePaymentAction(formData)
                  )
                )
              }
            />
          </div>

          <Separator className="my-2" />

          <div className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-foreground">Cancel bill</h2>
              <p className="text-xs text-muted-foreground">
                Paid bills must have payments reversed before cancellation.
              </p>
            </div>
            <CancelPanel
              saleId={invoice.sale.id}
              pending={isPending}
              onSubmit={(formData) =>
                startTransition(() =>
                  void run("Cancelling bill...", "Bill cancelled", () =>
                    cancelSaleAction(formData)
                  )
                )
              }
            />
          </div>
        </>
      )}

      {/* Cancelled notice */}
      {isCancelled && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive font-medium">This bill has been cancelled.</p>
        </div>
      )}
    </div>
  )
}

// ─── Add Item Panel ───────────────────────────────────────────────────────────

function AddItemPanel({
  saleId,
  products,
  pending,
  onSubmit,
}: {
  saleId: string
  products: ProductOption[]
  pending: boolean
  onSubmit: (formData: FormData) => void
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "")
  const [mode, setMode] = useState("loose")

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="sale_id" value={saleId} />
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="entry_mode" value={mode} />

      {/* Product — full width */}
      <div className="space-y-2">
        <Label>Product</Label>
        <Select value={productId} onValueChange={(v) => v && setProductId(v)}>
          <SelectTrigger className="w-full shadow-none">
            <SelectValue placeholder="Select a product" />
          </SelectTrigger>
          <SelectContent>
            {products.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.name} — stock {product.stock_on_hand}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mode / Qty / Price — 3 columns */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Mode</Label>
          <Select value={mode} onValueChange={(v) => v && setMode(v)}>
            <SelectTrigger className="w-full shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="loose">Loose</SelectItem>
              <SelectItem value="box">Box</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Qty</Label>
          <Input name="quantity" type="number" min="1" defaultValue="1" className="shadow-none" />
        </div>
        <div className="space-y-2">
          <Label>Price override</Label>
          <Input name="price_per_entry" type="number" min="0" step="0.01" placeholder="Auto" className="shadow-none" />
        </div>
      </div>

      {/* Add button — own row */}
      <div className="flex justify-end">
        <Button disabled={pending} type="submit" size="sm" className="shadow-none gap-1.5">
          <PlusIcon className="size-3.5" />
          Add item
        </Button>
      </div>
    </form>
  )
}


// ─── Items Table ──────────────────────────────────────────────────────────────

function ItemsTable({
  saleId,
  isDraft,
  items,
  pending,
  onUpdate,
  onRemove,
}: {
  saleId: string
  isDraft: boolean
  items: SaleInvoiceData["items"]
  pending: boolean
  onUpdate: (formData: FormData) => void
  onRemove: (formData: FormData) => void
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-secondary/50">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-secondary/60">
            <TableHead className="h-10 px-4 text-xs font-medium text-muted-foreground">Product</TableHead>
            <TableHead className="h-10 text-xs font-medium text-muted-foreground">Mode</TableHead>
            <TableHead className="h-10 text-xs font-medium text-muted-foreground">Qty</TableHead>
            <TableHead className="h-10 text-xs font-medium text-muted-foreground">Rate</TableHead>
            <TableHead className="h-10 text-xs font-medium text-muted-foreground">Total</TableHead>
            {isDraft && <TableHead className="h-10 text-xs font-medium text-muted-foreground"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className="transition-colors hover:bg-secondary/40">
              <TableCell className="px-4 py-3 text-sm font-medium text-foreground">
                {item.product_name_snapshot}
              </TableCell>
              {isDraft ? (
                <TableCell colSpan={4} className="py-2">
                  <ItemEditRow
                    saleId={saleId}
                    item={item}
                    pending={pending}
                    onUpdate={onUpdate}
                  />
                </TableCell>
              ) : (
                <>
                  <TableCell className="text-sm capitalize text-muted-foreground">{item.entry_mode}</TableCell>
                  <TableCell className="text-sm text-foreground">
                    {item.entered_quantity} × {item.base_units_per_entry}
                  </TableCell>
                  <TableCell className="text-sm text-foreground">{money(item.price_per_entry)}</TableCell>
                  <TableCell className="text-sm font-medium text-foreground">{money(item.line_total)}</TableCell>
                </>
              )}
              {isDraft && (
                <TableCell className="py-2">
                  <form action={onRemove}>
                    <input type="hidden" name="sale_item_id" value={item.id} />
                    <Button
                      disabled={pending}
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="shadow-none text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </form>
                </TableCell>
              )}
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={isDraft ? 6 : 5}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                No items yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

// ─── Item Edit Row ────────────────────────────────────────────────────────────

function ItemEditRow({
  saleId,
  item,
  pending,
  onUpdate,
}: {
  saleId: string
  item: SaleInvoiceData["items"][number]
  pending: boolean
  onUpdate: (formData: FormData) => void
}) {
  const [mode, setMode] = useState(item.entry_mode)

  return (
    <form action={onUpdate} className="grid gap-2 grid-cols-[140px_90px_130px_auto]">
      <input type="hidden" name="sale_id" value={saleId} />
      <input type="hidden" name="sale_item_id" value={item.id} />
      <input type="hidden" name="entry_mode" value={mode} />
      <Select value={mode} onValueChange={(v) => v && setMode(v)}>
        <SelectTrigger className="h-9 w-full shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="loose">Loose</SelectItem>
          <SelectItem value="box">Box</SelectItem>
        </SelectContent>
      </Select>
      <Input name="quantity" type="number" min="1" defaultValue={item.entered_quantity} className="shadow-none h-9" />
      <Input name="price_per_entry" type="number" min="0" step="0.01" defaultValue={item.price_per_entry} className="shadow-none h-9" />
      <Button disabled={pending} type="submit" variant="secondary" size="sm" className="shadow-none h-9">
        Update
      </Button>
    </form>
  )
}

// ─── Finalize Panel ───────────────────────────────────────────────────────────

function FinalizePanel({
  saleId,
  discount,
  pending,
  onSubmit,
}: {
  saleId: string
  discount: number
  pending: boolean
  onSubmit: (formData: FormData) => void
}) {
  const [method, setMethod] = useState("cash")

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="sale_id" value={saleId} />
      <input type="hidden" name="payment_method" value={method} />
      <div className="grid gap-4 sm:grid-cols-4">
        <TextInput label="Discount" name="discount_amount" type="number" step="0.01" defaultValue={String(discount)} />
        <TextInput label="Initial payment" name="payment_amount" type="number" step="0.01" defaultValue="0" />
        <div className="space-y-2">
          <Label>Method</Label>
          <Select value={method} onValueChange={(v) => v && setMethod(v)}>
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
        <TextInput label="Payment date" name="payment_date" type="date" defaultValue={today()} />
      </div>
      <div className="flex justify-end">
        <Button disabled={pending} type="submit" size="sm" className="shadow-none gap-1.5">
          <ReceiptIndianRupeeIcon className="size-3.5" />
          Finalize
        </Button>
      </div>
    </form>
  )
}

// ─── Later Payment Panel ──────────────────────────────────────────────────────

function LaterPaymentPanel({
  saleId,
  customerId,
  due,
  pending,
  onSubmit,
}: {
  saleId: string
  customerId: string
  due: number
  pending: boolean
  onSubmit: (formData: FormData) => void
}) {
  const [method, setMethod] = useState("cash")

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="sale_id" value={saleId} />
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="payment_method" value={method} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Amount" name="amount" type="number" step="0.01" defaultValue={String(Math.max(due, 0))} />
        <TextInput label="Date" name="payment_date" type="date" defaultValue={today()} />
        <div className="space-y-2">
          <Label>Method</Label>
          <Select value={method} onValueChange={(v) => v && setMethod(v)}>
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
        <TextInput label="Reference" name="reference_number" placeholder="Optional" />
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea name="notes" className="min-h-20 shadow-none" placeholder="Optional" />
      </div>
      <div className="flex justify-end">
        <Button disabled={pending} type="submit" size="sm" className="shadow-none">
          Record payment
        </Button>
      </div>
    </form>
  )
}

// ─── Cancel Panel ─────────────────────────────────────────────────────────────

function CancelPanel({
  saleId,
  pending,
  onSubmit,
}: {
  saleId: string
  pending: boolean
  onSubmit: (formData: FormData) => void
}) {
  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="sale_id" value={saleId} />
      <TextInput label="Reason" name="reason" />
      <div className="flex justify-end">
        <Button disabled={pending} type="submit" variant="destructive" size="sm" className="shadow-none gap-1.5">
          <XCircleIcon className="size-3.5" />
          Cancel bill
        </Button>
      </div>
    </form>
  )
}

// ─── Text Input Helper ────────────────────────────────────────────────────────

function TextInput({
  label,
  name,
  type = "text",
  step,
  defaultValue,
  placeholder,
}: {
  label: string
  name: string
  type?: string
  step?: string
  defaultValue?: string
  placeholder?: string
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        name={name}
        type={type}
        step={step}
        defaultValue={defaultValue}
        placeholder={placeholder}
        min={type === "number" ? "0" : undefined}
        className="shadow-none"
      />
    </div>
  )
}
