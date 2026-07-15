"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import {
  CheckIcon,
  PlusIcon,
  ReceiptIndianRupeeIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  addPurchaseItemAction,
  cancelPurchaseAction,
  finalizePurchaseAction,
  recordPurchasePaymentAction,
  removePurchaseItemAction,
  updatePurchaseItemAction,
} from "@/app/(app)/purchases/actions"
import { createProductAction } from "@/app/(app)/products/actions"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
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
import { Switch } from "@/components/ui/switch"
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
import type { PurchaseData } from "@/lib/invoice/purchases"

export type PurchaseProductOption = {
  id: string
  name: string
  sku: string | null
  unit_name: string
  loose_cost_price: number
  has_box: boolean
  box_units: number | null
  box_cost_price: number | null
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

export function PurchaseDetailClient({
  purchase,
  products,
}: {
  purchase: PurchaseData
  products: PurchaseProductOption[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isDraft = purchase.purchase.status === "draft"
  const isFinalized = purchase.purchase.status === "finalized"
  const isCancelled = purchase.purchase.status === "cancelled"

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

  async function addPurchaseItemWithProduct(formData: FormData) {
    let productId = String(formData.get("product_id") ?? "")

    if (!productId) {
      const productName = String(formData.get("product_name") ?? "").trim()
      const unitName = String(formData.get("unit_name") ?? "").trim()
      const cost = Number(formData.get("cost_per_entry"))

      if (!productName) return { ok: false as const, error: "Product name is required" }
      if (!unitName) return { ok: false as const, error: "Unit name is required for new products" }
      if (!Number.isFinite(cost) || cost <= 0) {
        return {
          ok: false as const,
          error: "Purchase cost is required for new products",
        }
      }

      const created = await createProductAction({
        name: productName,
        sku: null,
        unit_name: unitName,
        loose_sale_price: cost,
        loose_cost_price: cost,
        has_box: false,
        box_units: null,
        box_sale_price: null,
        box_cost_price: null,
        reorder_level: 0,
        opening_stock: 0,
      })

      if (!created.ok) return created
      productId = created.data.id
      formData.set("product_id", productId)
      formData.set("entry_mode", "loose")
    }

    return addPurchaseItemAction(formData)
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {purchase.purchase.purchase_number}
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            {purchase.supplier.name} ·{" "}
            {dateFormatter.format(new Date(purchase.purchase.purchase_date))}
            {purchase.purchase.supplier_invoice_number
              ? ` · ${purchase.purchase.supplier_invoice_number}`
              : ""}
          </p>
        </div>
        <Link
          href="/purchases"
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            "shadow-none"
          )}
        >
          Back
        </Link>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-foreground">
              Purchase summary
            </h2>
            <Badge
              variant={statusVariant(purchase.purchase.status)}
              className="capitalize shadow-none"
            >
              {purchase.purchase.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Supplier payable and stock-in totals for this purchase.
          </p>
        </div>

        <div className="grid gap-6 border-b border-border/40 pb-4 sm:grid-cols-3">
          <SummaryMetric label="Total" value={money(purchase.purchase.total_amount)} />
          <SummaryMetric label="Paid" value={money(purchase.balance.paid_amount)} />
          <SummaryMetric
            label="Due"
            value={money(purchase.balance.due_amount)}
            danger={purchase.balance.due_amount > 0}
          />
        </div>
      </div>

      {isDraft ? (
        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">Add item</h2>
            <p className="text-xs text-muted-foreground">
              Add products received from the supplier. Stock increases only
              after finalization.
            </p>
          </div>
          <AddItemPanel
            purchaseId={purchase.purchase.id}
            products={products}
            pending={isPending}
            onSubmit={(formData) =>
              startTransition(() =>
                void run("Adding item...", "Item added", () =>
                  addPurchaseItemWithProduct(formData)
                )
              )
            }
          />
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">
            Purchase items
          </h2>
          <p className="text-xs text-muted-foreground">
            {isDraft
              ? "Edit quantities, mode, or cost before finalizing."
              : "Line items included in this restocking purchase."}
          </p>
        </div>
        <ItemsTable
          purchaseId={purchase.purchase.id}
          isDraft={isDraft}
          items={purchase.items}
          pending={isPending}
          onUpdate={(formData) =>
            startTransition(() =>
              void run("Updating item...", "Item updated", () =>
                updatePurchaseItemAction(formData)
              )
            )
          }
          onRemove={(formData) =>
            startTransition(() =>
              void run("Removing item...", "Item removed", () =>
                removePurchaseItemAction(formData)
              )
            )
          }
        />
      </section>

      {isDraft ? (
        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">
              Finalize purchase
            </h2>
            <p className="text-xs text-muted-foreground">
              Finalizing increases stock, updates supplier balance, and can
              optionally update product costs.
            </p>
          </div>
          <FinalizePanel
            purchaseId={purchase.purchase.id}
            discount={purchase.purchase.discount_amount}
            additionalCost={purchase.purchase.additional_cost}
            pending={isPending}
            onSubmit={(formData) =>
              startTransition(() =>
                void run("Finalizing purchase...", "Purchase finalized", () =>
                  finalizePurchaseAction(formData)
                )
              )
            }
          />
        </section>
      ) : null}

      {isFinalized ? (
        <>
          <section className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-foreground">
                Supplier payment
              </h2>
              <p className="text-xs text-muted-foreground">
                Record an outgoing payment against this purchase.
              </p>
            </div>
            <LaterPaymentPanel
              purchaseId={purchase.purchase.id}
              supplierId={purchase.purchase.supplier_id}
              due={purchase.balance.due_amount}
              pending={isPending}
              onSubmit={(formData) =>
                startTransition(() =>
                  void run("Recording payment...", "Payment recorded", () =>
                    recordPurchasePaymentAction(formData)
                  )
                )
              }
            />
          </section>

          <PaymentHistory payments={purchase.payments} />

          <Separator className="my-2" />

          <section className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-foreground">
                Cancel purchase
              </h2>
              <p className="text-xs text-muted-foreground">
                Cancellation reverses stock only when no allocated payments exist
                and stock will not go negative.
              </p>
            </div>
            <CancelPanel
              purchaseId={purchase.purchase.id}
              pending={isPending}
              onSubmit={(formData) =>
                startTransition(() =>
                  void run("Cancelling purchase...", "Purchase cancelled", () =>
                    cancelPurchaseAction(formData)
                  )
                )
              }
            />
          </section>
        </>
      ) : null}

      {isCancelled ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm font-medium text-destructive">
            This purchase has been cancelled.
          </p>
          {purchase.purchase.cancellation_reason ? (
            <p className="mt-1 text-xs text-destructive/80">
              {purchase.purchase.cancellation_reason}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function AddItemPanel({
  purchaseId,
  products,
  pending,
  onSubmit,
}: {
  purchaseId: string
  products: PurchaseProductOption[]
  pending: boolean
  onSubmit: (formData: FormData) => void
}) {
  const [productId, setProductId] = useState("")
  const [productName, setProductName] = useState("")
  const [unitName, setUnitName] = useState("")
  const [mode, setMode] = useState("loose")
  const selectedProduct = products.find((product) => product.id === productId)

  function patchProductName(nextName: string) {
    const exact = products.find(
      (product) =>
        product.name.trim().toLowerCase() === nextName.trim().toLowerCase()
    )
    setProductName(nextName)
    setProductId(exact?.id ?? "")
    setUnitName(exact?.unit_name ?? unitName)
    if (!exact?.has_box) setMode("loose")
  }

  function selectProduct(product: PurchaseProductOption | null) {
    if (!product) {
      setProductId("")
      setProductName("")
      setUnitName("")
      setMode("loose")
      return
    }

    setProductId(product.id)
    setProductName(product.name)
    setUnitName(product.unit_name)
    if (!product.has_box) setMode("loose")
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="purchase_id" value={purchaseId} />
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="product_name" value={productName} />
      <input type="hidden" name="unit_name" value={unitName} />
      <input type="hidden" name="entry_mode" value={mode} />

      <div className="space-y-2">
        <Label>Product</Label>
        <Combobox<PurchaseProductOption>
          items={products}
          value={selectedProduct ?? null}
          inputValue={productName}
          itemToStringLabel={(product) => product.name}
          itemToStringValue={(product) => product.id}
          isItemEqualToValue={(item, value) => item.id === value.id}
          onInputValueChange={patchProductName}
          onValueChange={selectProduct}
        >
          <ComboboxInput
            placeholder="Type product name"
            showClear
            className="w-full shadow-none"
          />
          {productName.trim() ? (
            <ComboboxContent>
              <ComboboxEmpty>No product found. Keep typing to create new.</ComboboxEmpty>
              <ComboboxList>
                {(product: PurchaseProductOption) => (
                  <ComboboxItem key={product.id} value={product}>
                    <span className="min-w-0 flex-1 truncate">
                      {product.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {product.sku ? `${product.sku} · ` : ""}
                      stock {product.stock_on_hand}
                    </span>
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          ) : null}
        </Combobox>
        {selectedProduct ? (
          <div className="flex items-center gap-2 rounded-md border bg-secondary/50 px-3 py-2 text-sm">
            <CheckIcon className="size-4 text-emerald-600" />
            <span className="font-medium">{selectedProduct.name}</span>
            <span className="text-muted-foreground">
              Stock {selectedProduct.stock_on_hand}
            </span>
          </div>
        ) : productName.trim() ? (
          <p className="text-xs text-muted-foreground">
            New product will be created when you add this item.
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {!productId && productName.trim() ? (
          <div className="space-y-2">
            <Label>Unit name</Label>
            <Input
              value={unitName}
              onChange={(event) => setUnitName(event.target.value)}
              placeholder="pcs, kg, box"
              className="shadow-none"
            />
          </div>
        ) : null}
        <div className="space-y-2">
          <Label>Mode</Label>
          <Select value={mode} onValueChange={(value) => value && setMode(value)}>
            <SelectTrigger className="w-full shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="loose">Loose</SelectItem>
              <SelectItem value="box" disabled={!selectedProduct?.has_box}>
                Box
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <TextInput label="Qty" name="quantity" type="number" defaultValue="1" />
        <TextInput
          label={productId ? "Cost override" : "Cost"}
          name="cost_per_entry"
          type="number"
          step="0.01"
          placeholder={productId ? "Auto" : "Required"}
        />
      </div>

      <div className="flex justify-end">
        <Button
          disabled={pending}
          type="submit"
          size="sm"
          className="gap-1.5 shadow-none"
        >
          <PlusIcon className="size-3.5" />
          Add item
        </Button>
      </div>
    </form>
  )
}

function ItemsTable({
  purchaseId,
  isDraft,
  items,
  pending,
  onUpdate,
  onRemove,
}: {
  purchaseId: string
  isDraft: boolean
  items: PurchaseData["items"]
  pending: boolean
  onUpdate: (formData: FormData) => void
  onRemove: (formData: FormData) => void
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-secondary/50">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-secondary/60">
            <TableHead className="h-10 px-4 text-xs font-medium text-muted-foreground">
              Product
            </TableHead>
            <TableHead className="h-10 text-xs font-medium text-muted-foreground">
              Mode
            </TableHead>
            <TableHead className="h-10 text-xs font-medium text-muted-foreground">
              Qty
            </TableHead>
            <TableHead className="h-10 text-xs font-medium text-muted-foreground">
              Cost
            </TableHead>
            <TableHead className="h-10 text-xs font-medium text-muted-foreground">
              Total
            </TableHead>
            {isDraft ? <TableHead className="h-10" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className="transition-colors hover:bg-secondary/40">
              <TableCell className="px-4 py-3 text-sm font-medium">
                {item.product_name_snapshot}
              </TableCell>
              {isDraft ? (
                <TableCell colSpan={4} className="py-2">
                  <ItemEditRow
                    purchaseId={purchaseId}
                    item={item}
                    pending={pending}
                    onUpdate={onUpdate}
                  />
                </TableCell>
              ) : (
                <>
                  <TableCell className="text-sm capitalize text-muted-foreground">
                    {item.entry_mode}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.entered_quantity} x {item.base_units_per_entry}
                  </TableCell>
                  <TableCell className="text-sm">
                    {money(item.cost_per_entry)}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {money(item.line_total)}
                  </TableCell>
                </>
              )}
              {isDraft ? (
                <TableCell className="py-2">
                  <form action={onRemove}>
                    <input
                      type="hidden"
                      name="purchase_id"
                      value={purchaseId}
                    />
                    <input
                      type="hidden"
                      name="purchase_item_id"
                      value={item.id}
                    />
                    <Button
                      disabled={pending}
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="text-destructive shadow-none hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </form>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
          {!items.length ? (
            <TableRow>
              <TableCell
                colSpan={isDraft ? 6 : 5}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                No purchase items yet.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}

function ItemEditRow({
  purchaseId,
  item,
  pending,
  onUpdate,
}: {
  purchaseId: string
  item: PurchaseData["items"][number]
  pending: boolean
  onUpdate: (formData: FormData) => void
}) {
  const [mode, setMode] = useState(item.entry_mode)

  return (
    <form action={onUpdate} className="grid gap-2 grid-cols-[140px_90px_130px_auto]">
      <input type="hidden" name="purchase_id" value={purchaseId} />
      <input type="hidden" name="purchase_item_id" value={item.id} />
      <input type="hidden" name="entry_mode" value={mode} />
      <Select value={mode} onValueChange={(value) => value && setMode(value)}>
        <SelectTrigger className="h-9 w-full shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="loose">Loose</SelectItem>
          <SelectItem value="box">Box</SelectItem>
        </SelectContent>
      </Select>
      <Input
        name="quantity"
        type="number"
        min="1"
        defaultValue={item.entered_quantity}
        className="h-9 shadow-none"
      />
      <Input
        name="cost_per_entry"
        type="number"
        min="0"
        step="0.01"
        defaultValue={item.cost_per_entry}
        className="h-9 shadow-none"
      />
      <Button
        disabled={pending}
        type="submit"
        variant="secondary"
        size="sm"
        className="h-9 shadow-none"
      >
        Update
      </Button>
    </form>
  )
}

function FinalizePanel({
  purchaseId,
  discount,
  additionalCost,
  pending,
  onSubmit,
}: {
  purchaseId: string
  discount: number
  additionalCost: number
  pending: boolean
  onSubmit: (formData: FormData) => void
}) {
  const [method, setMethod] = useState("cash")
  const [updateCost, setUpdateCost] = useState(true)

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="purchase_id" value={purchaseId} />
      <input type="hidden" name="payment_method" value={method} />
      <input
        type="hidden"
        name="update_product_cost"
        value={String(updateCost)}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TextInput
          label="Discount"
          name="discount_amount"
          type="number"
          step="0.01"
          defaultValue={String(discount)}
        />
        <TextInput
          label="Additional cost"
          name="additional_cost"
          type="number"
          step="0.01"
          defaultValue={String(additionalCost)}
        />
        <TextInput
          label="Initial payment"
          name="payment_amount"
          type="number"
          step="0.01"
          defaultValue="0"
        />
        <TextInput
          label="Payment date"
          name="payment_date"
          type="date"
          defaultValue={today()}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Payment method</Label>
          <Select
            value={method}
            onValueChange={(value) => value && setMethod(value)}
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
        <TextInput label="Reference" name="reference_number" placeholder="Optional" />
      </div>

      <label className="flex items-center justify-between gap-4 rounded-lg border bg-secondary/50 px-4 py-3 text-sm">
        <span>
          <span className="font-medium text-foreground">Update product costs</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Finalization can copy purchase cost into product cost prices.
          </span>
        </span>
        <Switch checked={updateCost} onCheckedChange={setUpdateCost} />
      </label>

      <div className="flex justify-end">
        <Button disabled={pending} type="submit" size="sm" className="gap-1.5 shadow-none">
          <ReceiptIndianRupeeIcon className="size-3.5" />
          Finalize purchase
        </Button>
      </div>
    </form>
  )
}

function LaterPaymentPanel({
  purchaseId,
  supplierId,
  due,
  pending,
  onSubmit,
}: {
  purchaseId: string
  supplierId: string
  due: number
  pending: boolean
  onSubmit: (formData: FormData) => void
}) {
  const [method, setMethod] = useState("cash")

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="purchase_id" value={purchaseId} />
      <input type="hidden" name="supplier_id" value={supplierId} />
      <input type="hidden" name="payment_method" value={method} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="Amount"
          name="amount"
          type="number"
          step="0.01"
          defaultValue={String(Math.max(due, 0))}
        />
        <TextInput label="Date" name="payment_date" type="date" defaultValue={today()} />
        <div className="space-y-2">
          <Label>Method</Label>
          <Select
            value={method}
            onValueChange={(value) => value && setMethod(value)}
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

function PaymentHistory({ payments }: { payments: PurchaseData["payments"] }) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">
          Payment history
        </h2>
        <p className="text-xs text-muted-foreground">
          Outgoing payments allocated to this purchase.
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border bg-secondary/50">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-secondary/60">
              <TableHead className="h-10 px-4 text-xs font-medium text-muted-foreground">
                Payment
              </TableHead>
              <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                Date
              </TableHead>
              <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                Method
              </TableHead>
              <TableHead className="h-10 text-xs font-medium text-muted-foreground">
                Amount
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.payment_number}>
                <TableCell className="px-4 py-3 text-sm font-medium">
                  {payment.payment_number}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {dateFormatter.format(new Date(payment.payment_date))}
                </TableCell>
                <TableCell className="text-sm capitalize text-muted-foreground">
                  {payment.payment_method}
                </TableCell>
                <TableCell className="text-sm font-medium">
                  {money(payment.amount)}
                </TableCell>
              </TableRow>
            ))}
            {!payments.length ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-20 text-center text-sm text-muted-foreground"
                >
                  No payments recorded.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

function CancelPanel({
  purchaseId,
  pending,
  onSubmit,
}: {
  purchaseId: string
  pending: boolean
  onSubmit: (formData: FormData) => void
}) {
  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="purchase_id" value={purchaseId} />
      <TextInput label="Reason" name="reason" />
      <div className="flex justify-end">
        <Button
          disabled={pending}
          type="submit"
          variant="destructive"
          size="sm"
          className="gap-1.5 shadow-none"
        >
          <XCircleIcon className="size-3.5" />
          Cancel purchase
        </Button>
      </div>
    </form>
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
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <p
        className={cn(
          "mt-1 text-xl font-bold",
          danger ? "text-destructive" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  )
}

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
  defaultValue?: string | number
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
