"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { PlusIcon, SaveIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import {
  createCompleteSaleAction,
  type SalePaymentMethod,
} from "@/app/(app)/sales/actions"
import { createContactAction } from "@/app/(app)/contact/actions"
import { ContactQuickFields } from "@/components/contact/contact-quick-fields"
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
import { DatePicker } from "@/components/ui/date-picker"

// ─── Types ────────────────────────────────────────────────────────────────────

export type CustomerOption = {
  id: string
  name: string
  phone: string | null
  address: string | null
  contact_type: string
}

export type InvoiceProductOption = {
  id: string
  name: string
  sku: string | null
  unit_name: string
  loose_sale_price: number
  has_box: boolean
  box_units: number | null
  box_sale_price: number | null
  stock_on_hand: number
}

type DraftItem = {
  localId: string
  product_id: string
  entry_mode: "loose" | "box"
  quantity: string
  price_per_entry: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
})

function money(value: number) {
  return moneyFormatter.format(Number(value))
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function newItem(): DraftItem {
  return {
    localId: crypto.randomUUID(),
    product_id: "",
    entry_mode: "loose",
    quantity: "1",
    price_per_entry: "0",
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NewSaleWorkspace({
  customers,
  products,
}: {
  customers: CustomerOption[]
  products: InvoiceProductOption[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Bill details
  const [customerId, setCustomerId] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerAddress, setCustomerAddress] = useState("")
  const [saleDate, setSaleDate] = useState(today())

  // Items
  const [items, setItems] = useState<DraftItem[]>(() =>
    products.length ? [newItem()] : []
  )


  // Payment & discount
  const [discount, setDiscount] = useState("0")
  const [paymentAmount, setPaymentAmount] = useState("0")
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>("cash")
  const [paymentDate, setPaymentDate] = useState(today())
  const [paymentReference, setPaymentReference] = useState("")

  // Notes
  const [notes, setNotes] = useState("")

  // Set of all product_ids currently in the list
  const usedProductIds = useMemo(
    () => new Set(items.map((i) => i.product_id).filter(Boolean)),
    [items]
  )

  // Totals
  const totals = useMemo(() => {
    let subtotal = 0
    for (const item of items) {
      const qty = Number(item.quantity) || 0
      const rate = Number(item.price_per_entry) || 0
      subtotal += qty * rate
    }
    const discountAmount = Math.max(Number(discount) || 0, 0)
    const total = Math.max(subtotal - discountAmount, 0)
    const paid = Math.max(Number(paymentAmount) || 0, 0)
    return { subtotal, discountAmount, total, paid, due: Math.max(total - paid, 0) }
  }, [items, discount, paymentAmount])

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function patchItem(localId: string, update: Partial<DraftItem>) {
    setItems((current) =>
      current.map((item) => (item.localId === localId ? { ...item, ...update } : item))
    )
  }

  function handleProductChange(localId: string, productId: string) {
    const product = products.find((p) => p.id === productId)
    patchItem(localId, {
      product_id: productId,
      entry_mode: "loose",
      price_per_entry: product ? String(product.loose_sale_price) : "0",
    })
  }

  function handleModeChange(localId: string, mode: "loose" | "box") {
    const item = items.find((i) => i.localId === localId)
    const product = products.find((p) => p.id === item?.product_id)
    patchItem(localId, {
      entry_mode: mode,
      price_per_entry:
        mode === "box" && product?.box_sale_price != null
          ? String(product.box_sale_price)
          : String(product?.loose_sale_price ?? 0),
    })
  }

  function addItem() {
    setItems((current) => {
      const next = newItem()
      return [...current, next]
    })
  }

  function removeItem(localId: string) {
    setItems((current) => current.filter((i) => i.localId !== localId))
  }

  // ─── Submit ────────────────────────────────────────────────────────────────

  function submit() {
    startTransition(async () => {
      try {
        const discountAmount = Number(discount || 0)
        const initialPaymentAmount = Number(paymentAmount || 0)

        if (!customerName.trim()) throw new Error("Customer name is required")
        if (!items.length) throw new Error("Add at least one item")
        if (discountAmount < 0) throw new Error("Discount cannot be negative")
        if (initialPaymentAmount < 0) throw new Error("Payment cannot be negative")

        const payloadItems = items.map((item) => {
          const quantity = Number(item.quantity)
          const price = Number(item.price_per_entry)
          const product = products.find((p) => p.id === item.product_id)

          if (!item.product_id || !product) throw new Error("Select a product for each row")
          if (!Number.isInteger(quantity) || quantity <= 0)
            throw new Error("Quantity must be a positive whole number")
          if (!Number.isFinite(price) || price < 0)
            throw new Error("Rate cannot be negative")
          if (item.entry_mode === "box" && !product.has_box)
            throw new Error(`${product.name} does not support box billing`)

          return {
            product_id: item.product_id,
            entry_mode: item.entry_mode,
            quantity,
            price_per_entry: price,
          }
        })

        if (discountAmount > totals.subtotal)
          throw new Error("Discount cannot exceed subtotal")

        const toastId = toast.loading(
          customerId ? "Creating invoice..." : "Creating customer..."
        )
        let resolvedCustomerId = customerId

        if (!resolvedCustomerId) {
          const created = await createContactAction({
            name: customerName.trim(),
            phone: customerPhone.trim() || null,
            address: customerAddress.trim() || null,
            contact_type: "customer",
            opening_balance: 0,
            opening_balance_date: today(),
            notes: null,
          })

          if (!created.ok) {
            toast.error(created.error, { id: toastId })
            return
          }

          resolvedCustomerId = created.data.id
          toast.loading("Creating invoice...", { id: toastId })
        }

        const result = await createCompleteSaleAction({
          customer_id: resolvedCustomerId,
          sale_date: saleDate,
          discount_amount: discountAmount,
          notes: notes.trim() || null,
          items: payloadItems,
          initial_payment:
            initialPaymentAmount > 0
              ? {
                  amount: initialPaymentAmount,
                  payment_method: paymentMethod,
                  payment_date: paymentDate,
                  reference_number: paymentReference.trim() || null,
                  notes: "Initial invoice payment",
                }
              : null,
        })

        if (!result.ok) {
          toast.error(result.error, { id: toastId })
          return
        }

        toast.success("Invoice created", { id: toastId })
        router.push(`/sales/${result.data.id}`)
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Check invoice details")
      }
    })
  }

  const allProductsUsed = usedProductIds.size >= products.length

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex w-full flex-col gap-8">

      {/* Page header */}
      <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">New Bill</h1>
          <p className="text-sm text-muted-foreground">
            Type or select a customer, add items, then record the initial payment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="shadow-none gap-1.5"
            onClick={submit}
            disabled={isPending || !products.length}
          >
            <SaveIcon className="size-3.5" />
            {isPending ? "Creating..." : "Create invoice"}
          </Button>
          <Link
            href="/sales"
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "shadow-none")}
          >
            Back
          </Link>
        </div>
      </div>

      {/* ── Bill details ──────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Bill details</h2>
          <p className="text-xs text-muted-foreground">Customer and invoice date.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <ContactQuickFields
            label="Customer"
            kind="customer"
            options={customers}
            name={customerName}
            phone={customerPhone}
            address={customerAddress}
            selectedId={customerId}
            onChange={(value) => {
              setCustomerName(value.name)
              setCustomerPhone(value.phone)
              setCustomerAddress(value.address)
              setCustomerId(value.contactId)
            }}
          />
          <div className="space-y-2">
            <Label>Invoice date</Label>
            <DatePicker value={saleDate} onChange={setSaleDate} />
          </div>
        </div>
      </section>

      {/* ── Items ─────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Items</h2>
          <p className="text-xs text-muted-foreground">
            Add products to this bill. Each product can only be added once.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border bg-secondary/50">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-secondary/60">
                <TableHead className="h-10 px-4 text-xs font-medium text-muted-foreground min-w-48">Product</TableHead>
                <TableHead className="h-10 text-xs font-medium text-muted-foreground w-36">Mode</TableHead>
                <TableHead className="h-10 text-xs font-medium text-muted-foreground w-24">Qty</TableHead>
                <TableHead className="h-10 text-xs font-medium text-muted-foreground w-32">Rate</TableHead>
                <TableHead className="h-10 text-xs font-medium text-muted-foreground">Total</TableHead>
                <TableHead className="h-10 w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const product = products.find((p) => p.id === item.product_id)
                const qty = Number(item.quantity) || 0
                const rate = Number(item.price_per_entry) || 0

                return (
                  <TableRow key={item.localId} className="hover:bg-secondary/40">
                    <TableCell className="px-4 py-2">
                      <SaleProductCombobox
                        product={product}
                        products={products}
                        usedProductIds={usedProductIds}
                        onSelect={(productId) =>
                          handleProductChange(item.localId, productId)
                        }
                      />
                    </TableCell>

                    {/* Mode select */}
                    <TableCell className="py-2">
                      <Select
                        value={item.entry_mode}
                        onValueChange={(v) =>
                          v && handleModeChange(item.localId, v as DraftItem["entry_mode"])
                        }
                      >
                        <SelectTrigger className="shadow-none h-9">
                          <SelectValue>
                            {item.entry_mode === "loose" ? "Loose" : "Box"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="loose">Loose</SelectItem>
                          <SelectItem value="box" disabled={!product?.has_box}>
                            Box
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Qty */}
                    <TableCell className="py-2">
                      <Input
                        className="w-20 shadow-none h-9"
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => patchItem(item.localId, { quantity: e.target.value })}
                      />
                    </TableCell>

                    {/* Rate */}
                    <TableCell className="py-2">
                      <Input
                        className="w-28 shadow-none h-9"
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.price_per_entry}
                        onChange={(e) => patchItem(item.localId, { price_per_entry: e.target.value })}
                      />
                    </TableCell>

                    {/* Line total */}
                    <TableCell className="text-sm font-medium text-foreground whitespace-nowrap">
                      {money(qty * rate)}
                    </TableCell>

                    {/* Remove */}
                    <TableCell className="py-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="shadow-none text-destructive hover:text-destructive hover:bg-destructive/10 h-9 w-9 p-0"
                        onClick={() => removeItem(item.localId)}
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}

              {!items.length && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                    Add at least one item to the bill.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Add item — own row below the table */}
        <div className="flex justify-start">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="shadow-none gap-1.5"
            onClick={addItem}
            disabled={!products.length || allProductsUsed}
          >
            <PlusIcon className="size-3.5" />
            Add item
          </Button>
          {allProductsUsed && products.length > 0 && (
            <p className="ml-3 self-center text-xs text-muted-foreground">
              All products have been added.
            </p>
          )}
        </div>
      </section>

      {/* ── Payment & Discount ────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Payment &amp; discount</h2>
          <p className="text-xs text-muted-foreground">
            Apply a discount and record the initial payment received.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField label="Discount" type="number" step="0.01" value={discount} onChange={setDiscount} />
          <TextField label="Initial payment" type="number" step="0.01" value={paymentAmount} onChange={setPaymentAmount} />

          <div className="space-y-2">
            <Label>Payment method</Label>
            <Select
              value={paymentMethod}
              onValueChange={(v) => v && setPaymentMethod(v as SalePaymentMethod)}
            >
              <SelectTrigger className="w-full shadow-none">
                <SelectValue>
                  {({ cash: "Cash", upi: "UPI", bank: "Bank", card: "Card", other: "Other" } as Record<string, string>)[paymentMethod]}
                </SelectValue>
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

          <div className="space-y-2">
            <Label>Payment date</Label>
            <DatePicker value={paymentDate} onChange={setPaymentDate} />
          </div>
          <TextField label="Reference" value={paymentReference} onChange={setPaymentReference} placeholder="Optional" />

          {/* Totals summary */}
          <div className="space-y-1.5 rounded-lg border bg-secondary/50 px-4 py-3 text-sm sm:col-span-2 lg:col-span-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{money(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Discount</span>
              <span>− {money(totals.discountAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold text-foreground border-t border-border/40 pt-1.5 mt-1">
              <span>Total</span>
              <span>{money(totals.total)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Paid</span>
              <span>− {money(totals.paid)}</span>
            </div>
            <div className="flex justify-between font-semibold text-foreground">
              <span>Due</span>
              <span className={totals.due > 0 ? "text-destructive" : ""}>{money(totals.due)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Notes ─────────────────────────────────────────────────────────── */}
      <section className="space-y-3 pb-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Notes</h2>
          <p className="text-xs text-muted-foreground">Optional notes for this bill.</p>
        </div>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-20 shadow-none"
          placeholder="Optional"
        />
      </section>
    </div>
  )
}

function SaleProductCombobox({
  product,
  products,
  usedProductIds,
  onSelect,
}: {
  product: InvoiceProductOption | undefined
  products: InvoiceProductOption[]
  usedProductIds: Set<string>
  onSelect: (productId: string) => void
}) {
  const [inputValue, setInputValue] = useState(product?.name ?? "")
  const availableProducts = products.filter(
    (entry) => !usedProductIds.has(entry.id) || entry.id === product?.id
  )
  const shouldShowList = inputValue.trim().length > 0

  return (
    <Combobox<InvoiceProductOption>
      items={shouldShowList ? availableProducts : []}
      value={product ?? null}
      inputValue={inputValue}
      itemToStringLabel={(entry) => entry.name}
      itemToStringValue={(entry) => entry.id}
      isItemEqualToValue={(entry, value) => entry.id === value.id}
      onInputValueChange={setInputValue}
      onValueChange={(entry) => {
        if (!entry) return
        setInputValue(entry.name)
        onSelect(entry.id)
      }}
    >
      <ComboboxInput
        placeholder="Search product"
        className="h-9 w-full max-w-[320px] shadow-none"
      />
      {shouldShowList ? (
        <ComboboxContent>
          <ComboboxEmpty>No products found.</ComboboxEmpty>
          <ComboboxList>
            {(entry: InvoiceProductOption) => (
              <ComboboxItem key={entry.id} value={entry}>
                <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  stock {entry.stock_on_hand}
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      ) : null}
    </Combobox>
  )
}

// ─── Text Field ───────────────────────────────────────────────────────────────

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
        onChange={(e) => onChange(e.target.value)}
        className="shadow-none"
      />
    </div>
  )
}
