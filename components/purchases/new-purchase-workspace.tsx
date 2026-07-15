"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon, FilePlus2Icon } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { createContactAction } from "@/app/(app)/contact/actions"
import { createDraftPurchaseFromPayloadAction } from "@/app/(app)/purchases/actions"
import { ContactQuickFields } from "@/components/contact/contact-quick-fields"
import { Button, buttonVariants } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export type SupplierOption = {
  id: string
  name: string
  phone: string | null
  address: string | null
  contact_type: string
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function NewPurchaseWorkspace({
  suppliers,
}: {
  suppliers: SupplierOption[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [supplierId, setSupplierId] = useState("")
  const [supplierName, setSupplierName] = useState("")
  const [supplierPhone, setSupplierPhone] = useState("")
  const [supplierAddress, setSupplierAddress] = useState("")
  const [purchaseDate, setPurchaseDate] = useState(today())
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("")
  const [notes, setNotes] = useState("")

  function submit() {
    startTransition(async () => {
      try {
        if (!supplierName.trim()) throw new Error("Supplier name is required")

        const toastId = toast.loading(
          supplierId ? "Creating purchase..." : "Creating supplier..."
        )
        let resolvedSupplierId = supplierId

        if (!resolvedSupplierId) {
          const created = await createContactAction({
            name: supplierName.trim(),
            phone: supplierPhone.trim() || null,
            address: supplierAddress.trim() || null,
            contact_type: "supplier",
            opening_balance: 0,
            opening_balance_date: today(),
            notes: null,
          })

          if (!created.ok) {
            toast.error(created.error, { id: toastId })
            return
          }

          resolvedSupplierId = created.data.id
          toast.loading("Creating purchase...", { id: toastId })
        }

        const result = await createDraftPurchaseFromPayloadAction({
          supplier_id: resolvedSupplierId,
          purchase_date: purchaseDate,
          supplier_invoice_number: supplierInvoiceNumber.trim() || null,
          notes: notes.trim() || null,
        })

        if (!result.ok) {
          toast.error(result.error, { id: toastId })
          return
        }

        toast.success("Purchase draft created", { id: toastId })
        router.push(`/purchases/${result.data.id}`)
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Check purchase")
      }
    })
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            New Purchase
          </h1>
          <p className="text-sm text-muted-foreground">
            Type or select a supplier, then add products and finalize stock inward.
          </p>
        </div>
        <Link
          href="/purchases"
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            "shadow-none"
          )}
        >
          <ArrowLeftIcon className="size-3.5" />
          Back
        </Link>
      </div>

      <div className="space-y-8">
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">
              Purchase details
            </h2>
            <p className="text-xs text-muted-foreground">
              Supplier and purchase reference information.
            </p>
          </div>

          <DraftFields
            suppliers={suppliers}
            supplierId={supplierId}
            supplierName={supplierName}
            supplierPhone={supplierPhone}
            supplierAddress={supplierAddress}
            purchaseDate={purchaseDate}
            supplierInvoiceNumber={supplierInvoiceNumber}
            onSupplierChange={(value) => {
              setSupplierName(value.name)
              setSupplierPhone(value.phone)
              setSupplierAddress(value.address)
              setSupplierId(value.contactId)
            }}
            onPurchaseDateChange={setPurchaseDate}
            onSupplierInvoiceNumberChange={setSupplierInvoiceNumber}
          />
        </section>

        <section className="space-y-3 pb-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">Notes</h2>
            <p className="text-xs text-muted-foreground">
              Optional internal notes for this purchase.
            </p>
          </div>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-20 shadow-none"
            placeholder="Optional"
          />
        </section>

        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            className="gap-1.5 shadow-none"
            onClick={submit}
            disabled={isPending}
          >
            <FilePlus2Icon className="size-3.5" />
            {isPending ? "Creating..." : "Create draft"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function DraftFields({
  suppliers,
  supplierId,
  supplierName,
  supplierPhone,
  supplierAddress,
  purchaseDate,
  supplierInvoiceNumber,
  onSupplierChange,
  onPurchaseDateChange,
  onSupplierInvoiceNumberChange,
}: {
  suppliers: SupplierOption[]
  supplierId: string
  supplierName: string
  supplierPhone: string
  supplierAddress: string
  purchaseDate: string
  supplierInvoiceNumber: string
  onSupplierChange: (value: { name: string; phone: string; address: string; contactId: string }) => void
  onPurchaseDateChange: (value: string) => void
  onSupplierInvoiceNumberChange: (value: string) => void
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
      <ContactQuickFields
        label="Supplier"
        kind="supplier"
        options={suppliers}
        name={supplierName}
        phone={supplierPhone}
        address={supplierAddress}
        selectedId={supplierId}
        onChange={onSupplierChange}
      />
      <div className="space-y-2">
        <Label>Purchase date</Label>
        <DatePicker value={purchaseDate} onChange={onPurchaseDateChange} />
      </div>
      <div className="space-y-2 lg:col-span-2">
        <Label>Supplier invoice number</Label>
        <Input
          value={supplierInvoiceNumber}
          onChange={(event) =>
            onSupplierInvoiceNumberChange(event.target.value)
          }
          placeholder="Optional"
          className="shadow-none"
        />
      </div>
    </div>
  )
}
